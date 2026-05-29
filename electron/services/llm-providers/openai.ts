import type { LlmGenerateOpts, LlmProviderInstance } from "./types.js";
import { LlmProviderConfigError } from "./types.js";

export interface OpenAiModelInfo {
  id: string;
  owned_by?: string;
}

export interface OpenAiDetectResult {
  ok: boolean;
  endpoint: string;
  error?: string;
  models?: OpenAiModelInfo[];
}

/**
 * Probe an OpenAI-compatible endpoint with `GET /models`. Works against
 * OpenAI itself, LM Studio (port 1234), vLLM, OpenRouter, Together, Groq,
 * and any other server that follows the OpenAI API shape. Some servers
 * (e.g. LM Studio with a single loaded model) return just one entry.
 */
export async function detectOpenAi(opts: {
  endpoint: string;
  apiKey: string | null;
}): Promise<OpenAiDetectResult> {
  const endpoint = opts.endpoint.replace(/\/+$/, "");
  const url = `${endpoint}/models`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const headers: Record<string, string> = {};
    if (opts.apiKey) headers["Authorization"] = `Bearer ${opts.apiKey}`;
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        endpoint,
        error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await res.json()) as { data?: OpenAiModelInfo[] };
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

function openAiLabel(model: string): string {
  return `openai · ${model}`;
}

export function createOpenAiProvider(opts: {
  endpoint: string;
  apiKey: string | null;
  model: string | null;
}): LlmProviderInstance {
  if (!opts.model) {
    throw new LlmProviderConfigError(
      "OpenAI-compatible provider selected but no model configured. Pick one in Settings.",
    );
  }
  const endpoint = opts.endpoint.replace(/\/+$/, "");
  const apiKey = opts.apiKey;
  const model = opts.model;
  const label = openAiLabel(model);
  return {
    kind: "openai",
    label,
    labelFor: () => label,
    agentMode: "none",
    async generate(
      genOpts: LlmGenerateOpts,
    ): Promise<{ raw: string; usage?: import("./types.js").LlmUsage }> {
      const startedAt = Date.now();
      genOpts.onProgress?.("model", 2, `openai ${model}`, label);
      // We use `response_format: { type: "json_object" }` rather than the
      // strict json_schema variant because not all OpenAI-compatible servers
      // support strict mode, and OpenAI's strict mode requires every object
      // to have `additionalProperties: false` and a `required` array for
      // every property — constraints our NOTES_SCHEMA doesn't satisfy. The
      // prompt already specifies the schema explicitly, so json_object is
      // sufficient in practice.
      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (genOpts.system && genOpts.system.length > 0) {
        messages.push({ role: "system", content: genOpts.system });
      }
      messages.push({ role: "user", content: genOpts.prompt });
      const body = {
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: genOpts.temperature ?? 0.2,
        max_tokens: genOpts.maxTokens ?? 4000,
      };
      genOpts.onProgress?.("generating", 35, undefined, label);
      const url = `${endpoint}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new Error(
          `OpenAI request failed at ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `OpenAI returned HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };
      if (data.error) {
        throw new Error(`OpenAI error: ${data.error.message ?? "unknown"}`);
      }
      const raw = data.choices?.[0]?.message?.content ?? "";
      if (!raw) {
        throw new Error("OpenAI returned an empty response");
      }
      genOpts.onProgress?.("writing", 90, undefined, label);
      const usage: import("./types.js").LlmUsage = {
        // OpenAI-compatible endpoints can be a paid API (cloud) or a free
        // self-hosted server (LM Studio, vLLM, etc.). We can't tell which
        // from here, so default to metered — the cost column is empty
        // when prices aren't known, which is the truthful display either way.
        billing_kind: "metered",
        model,
        input_tokens: data.usage?.prompt_tokens,
        output_tokens: data.usage?.completion_tokens,
        duration_ms: Date.now() - startedAt,
        num_turns: 1,
      };
      return { raw, usage };
    },
  };
}
