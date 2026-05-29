import type {
  LlmAgenticGenerateOpts,
  LlmGenerateOpts,
  LlmProviderInstance,
  LlmUsage,
} from "./types.js";
import { LlmProviderConfigError } from "./types.js";
import {
  EMIT_NOTES_TOOL_NAME,
  ToolUseCollector,
} from "./agentic-shared.js";

/** Per-million-token rates in USD, list price as of May 2026. Used to derive
 *  cost_usd from the token counts returned by the Anthropic Messages API
 *  (which itself doesn't precompute cost). Cache reads bill at 10% of base
 *  input; cache writes at 125%. */
const ANTHROPIC_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

function pricingFor(model: string): { input: number; output: number } | null {
  // Exact match first, then prefix (so e.g. "claude-sonnet-4-6-20251022"
  // resolves to the sonnet-4-6 row).
  if (model in ANTHROPIC_PRICING) return ANTHROPIC_PRICING[model];
  for (const [key, rate] of Object.entries(ANTHROPIC_PRICING)) {
    if (model.startsWith(key)) return rate;
  }
  return null;
}

function deriveCost(
  model: string,
  u: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  },
): number | undefined {
  const rate = pricingFor(model);
  if (!rate) return undefined;
  const inT = u.input_tokens ?? 0;
  const outT = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  // input_tokens excludes cache reads/writes — they're reported separately.
  const cost =
    (inT * rate.input +
      outT * rate.output +
      cacheRead * rate.input * 0.1 +
      cacheWrite * rate.input * 1.25) /
    1_000_000;
  return Number(cost.toFixed(6));
}

export interface AnthropicModelInfo {
  id: string;
  display_name?: string;
  type?: string;
  created_at?: string;
}

export interface AnthropicDetectResult {
  ok: boolean;
  endpoint: string;
  error?: string;
  models?: AnthropicModelInfo[];
}

const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Probe `GET /v1/models` to validate the key and populate the Settings
 * dropdown. On 401 the API returns an "invalid x-api-key" JSON body — we
 * surface its message in `error` so the user knows what to fix.
 */
export async function detectAnthropic(opts: {
  endpoint: string;
  apiKey: string | null;
}): Promise<AnthropicDetectResult> {
  const endpoint = opts.endpoint.replace(/\/+$/, "");
  if (!opts.apiKey) {
    return { ok: false, endpoint, error: "No API key configured." };
  }
  const url = `${endpoint}/models`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: {
        "x-api-key": opts.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        endpoint,
        error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await res.json()) as { data?: AnthropicModelInfo[] };
    return {
      ok: true,
      endpoint,
      models: Array.isArray(data.data) ? data.data : [],
    };
  } catch (err) {
    return {
      ok: false,
      endpoint,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function anthropicLabel(model: string): string {
  // claude-sonnet-4-6 → "claude · sonnet-4-6", matching the
  // "{provider} · {model}" badge convention used elsewhere.
  const stripped = model.replace(/^claude-/, "");
  return `claude · ${stripped}`;
}

export function createAnthropicProvider(opts: {
  endpoint: string;
  apiKey: string | null;
  model: string | null;
}): LlmProviderInstance {
  if (!opts.apiKey) {
    throw new LlmProviderConfigError(
      "Anthropic provider selected but no API key configured. Open Settings to add one.",
    );
  }
  if (!opts.model) {
    throw new LlmProviderConfigError(
      "Anthropic provider selected but no model configured. Pick one in Settings.",
    );
  }
  const endpoint = opts.endpoint.replace(/\/+$/, "");
  const apiKey = opts.apiKey;
  const configuredModel = opts.model;

  async function postMessages(body: unknown): Promise<{
    content?: AnthropicContentBlock[];
    stop_reason?: string;
    error?: { message?: string };
    usage?: AnthropicUsage;
  }> {
    const url = `${endpoint}/messages`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(
        `Anthropic request failed at ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Anthropic returned HTTP ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    return (await res.json()) as {
      content?: AnthropicContentBlock[];
      stop_reason?: string;
      error?: { message?: string };
      usage?: AnthropicUsage;
    };
  }

  function resolveModel(override?: string): string {
    return override?.trim() || configuredModel;
  }

  return {
    kind: "anthropic",
    label: anthropicLabel(configuredModel),
    labelFor(modelOverride?: string) {
      return anthropicLabel(resolveModel(modelOverride));
    },
    agentMode: "via-tool-host",
    async generate(
      genOpts: LlmGenerateOpts,
    ): Promise<{ raw: string; usage?: LlmUsage }> {
      const model = resolveModel(genOpts.modelOverride);
      const label = anthropicLabel(model);
      const startedAt = Date.now();
      genOpts.onProgress?.("model", 2, `anthropic ${model}`, label);

      // Forced tool use, not "JSON only" prompting. Anthropic's Messages API
      // has no strict-JSON mode, but tool_choice pinned to a single tool
      // forces the model to emit one tool_use block whose `input` already
      // conforms to the schema — no parsing fragility, no escape weirdness.
      const systemBlocks =
        genOpts.system !== undefined && genOpts.system.length > 0
          ? [
              {
                type: "text" as const,
                text: genOpts.system,
                // Ephemeral cache: ~10% cost on hit, 5-minute TTL. Long
                // enough for back-to-back meeting processing to share the
                // schema/example prefix, short enough to not pay for stale
                // caches.
                cache_control: { type: "ephemeral" as const },
              },
            ]
          : undefined;

      const body = {
        model,
        max_tokens: genOpts.maxTokens ?? 4000,
        temperature: genOpts.temperature ?? 0.2,
        ...(systemBlocks ? { system: systemBlocks } : {}),
        messages: [{ role: "user" as const, content: genOpts.prompt }],
        tools: [
          {
            name: "emit_notes",
            description:
              "Emit the structured meeting notes matching the required schema.",
            input_schema: genOpts.schema as object,
          },
        ],
        tool_choice: { type: "tool" as const, name: "emit_notes" },
      };

      genOpts.onProgress?.("generating", 35, undefined, label);
      const data = await postMessages(body);
      if (data.error) {
        throw new Error(`Anthropic error: ${data.error.message ?? "unknown"}`);
      }
      const toolUse = data.content?.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        const textBlock = data.content?.find((b) => b.type === "text");
        const textHint =
          textBlock && textBlock.type === "text"
            ? textBlock.text.slice(0, 200)
            : "<none>";
        throw new Error(
          `Anthropic returned no tool_use block (stop_reason=${data.stop_reason ?? "unknown"}, text=${textHint})`,
        );
      }
      const raw = JSON.stringify(toolUse.input);
      genOpts.onProgress?.("writing", 90, undefined, label);
      const usage: LlmUsage = {
        billing_kind: "metered",
        model,
        duration_ms: Date.now() - startedAt,
        num_turns: 1,
        input_tokens: data.usage?.input_tokens,
        output_tokens: data.usage?.output_tokens,
        cache_creation_input_tokens:
          data.usage?.cache_creation_input_tokens,
        cache_read_input_tokens: data.usage?.cache_read_input_tokens,
        cost_usd: data.usage
          ? deriveCost(model, data.usage)
          : undefined,
      };
      return { raw, usage };
    },

    async agenticGenerate(
      genOpts: LlmAgenticGenerateOpts,
    ): Promise<{ raw: string; usage?: LlmUsage }> {
      const model = resolveModel(genOpts.modelOverride);
      const label = anthropicLabel(model);
      const maxTurns = genOpts.maxTurns ?? 20;
      const startedAt = Date.now();
      // Accumulate token usage across turns. Each messages.create call
      // returns a fresh `usage` block for that turn; we sum them to get a
      // run-total for the whole agent loop.
      const totals = {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      };
      let turnsUsed = 0;
      const toolsUsed = new ToolUseCollector();
      genOpts.onProgress?.("model", 2, `anthropic ${model} · agent`, label);

      // Pull the user's MCP tools and convert to Anthropic's tool format.
      // Prepend `emit_notes` so the model has the finishing tool in scope
      // from turn 1 — without it, models tend to keep exploring rather than
      // commit to output, even when prompted to wrap up.
      const mcpTools = await genOpts.toolHost.listTools();
      const tools = [
        {
          name: EMIT_NOTES_TOOL_NAME,
          description:
            "Emit the final structured meeting notes once you have enough context. Call this exactly once, as your last tool call.",
          input_schema: genOpts.schema as object,
        },
        ...mcpTools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema,
        })),
      ];

      const systemBlocks =
        genOpts.system !== undefined && genOpts.system.length > 0
          ? [
              {
                type: "text" as const,
                text: genOpts.system,
                cache_control: { type: "ephemeral" as const },
              },
            ]
          : undefined;

      // Conversation state. We treat each model turn as a unit: the model
      // either calls tools (we run them, append results, continue) or calls
      // emit_notes (we extract the JSON and break).
      const messages: Array<{
        role: "user" | "assistant";
        content: unknown;
      }> = [{ role: "user", content: genOpts.prompt }];

      for (let turn = 0; turn < maxTurns; turn++) {
        // Progress: log per-turn so the UI can show "agent · turn N".
        const turnPct = Math.min(20 + Math.floor((turn / maxTurns) * 65), 85);
        genOpts.onProgress?.(
          "agent",
          turnPct,
          `turn ${turn + 1}`,
          label,
        );

        const body = {
          model,
          max_tokens: genOpts.maxTokens ?? 4000,
          temperature: genOpts.temperature ?? 0.2,
          ...(systemBlocks ? { system: systemBlocks } : {}),
          messages,
          tools,
        };
        const data = await postMessages(body);
        if (data.error) {
          throw new Error(
            `Anthropic error: ${data.error.message ?? "unknown"}`,
          );
        }
        // Accumulate before we potentially return — even the final turn
        // (the one that emits emit_notes) costs tokens.
        if (data.usage) {
          totals.input_tokens += data.usage.input_tokens ?? 0;
          totals.output_tokens += data.usage.output_tokens ?? 0;
          totals.cache_creation_input_tokens +=
            data.usage.cache_creation_input_tokens ?? 0;
          totals.cache_read_input_tokens +=
            data.usage.cache_read_input_tokens ?? 0;
        }
        turnsUsed = turn + 1;
        const content = data.content ?? [];

        // Append assistant turn verbatim — Anthropic requires that any
        // tool_use blocks in the conversation history are followed by a
        // user turn whose tool_result blocks reference them by id.
        messages.push({ role: "assistant", content });

        const toolUseBlocks = content.filter(
          (b): b is AnthropicToolUseBlock => b.type === "tool_use",
        );
        // Record everything except emit_notes — the collector filters that
        // out internally since it's our finishing tool, not a KB read.
        for (const block of toolUseBlocks) {
          toolsUsed.push(
            block.name,
            (block.input ?? {}) as Record<string, unknown>,
          );
        }
        const emitCall = toolUseBlocks.find(
          (b) => b.name === EMIT_NOTES_TOOL_NAME,
        );
        if (emitCall) {
          genOpts.onProgress?.("writing", 90, undefined, label);
          const usage: LlmUsage = {
            billing_kind: "metered",
            model,
            duration_ms: Date.now() - startedAt,
            num_turns: turnsUsed,
            ...totals,
            cost_usd: deriveCost(model, totals),
            tools_used: toolsUsed.snapshot(),
          };
          return { raw: JSON.stringify(emitCall.input), usage };
        }

        if (toolUseBlocks.length === 0) {
          // No tool calls + no emit_notes = model gave up. One nudge then
          // bail, rather than silently looping or guessing.
          if (data.stop_reason === "end_turn" || data.stop_reason === "stop_sequence") {
            messages.push({
              role: "user",
              content:
                "You must finish by calling the emit_notes tool with the structured notes. Do that now using the context you have.",
            });
            continue;
          }
          throw new Error(
            `Anthropic agent loop produced no tool_use (stop_reason=${data.stop_reason ?? "unknown"})`,
          );
        }

        // Execute every tool call in parallel — they're independent reads
        // (filesystem MCP doesn't have stateful tools) and parallel cuts
        // wall-clock noticeably when the model fans out to a few files.
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            let resultText: string;
            try {
              resultText = await genOpts.toolHost.callTool(
                block.name,
                (block.input ?? {}) as Record<string, unknown>,
              );
            } catch (err) {
              resultText = `ERROR: ${
                err instanceof Error ? err.message : String(err)
              }`;
            }
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: resultText.slice(0, 50_000),
            };
          }),
        );
        messages.push({ role: "user", content: toolResults });
      }

      throw new Error(
        `Anthropic agent loop exceeded ${maxTurns} turns without calling emit_notes`,
      );
    },
  };
}

type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | AnthropicToolUseBlock;

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
