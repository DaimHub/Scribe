import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type {
  LlmCallUsage,
  LlmGenerateOpts,
  LlmProviderInstance,
  LlmUsage,
} from "./types.js";
import { LlmProviderConfigError } from "./types.js";
import {
  extractToolTarget,
  formatToolCall,
  ToolUseCollector,
} from "./agentic-shared.js";

const execFileAsync = promisify(execFile);

/** Hardcoded model list — `claude` CLI doesn't expose a discovery endpoint
 *  short of running an actual session, so we ship the well-known ids. Users
 *  on a newer CLI version can still type a custom id via Settings. */
export const CLAUDE_CODE_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
] as const;

export interface ClaudeCodeDetectResult {
  installed: boolean;
  authed: boolean;
  version?: string;
  error?: string;
}

/**
 * Probe the `claude` CLI: confirm it's on PATH and that the user is
 * authenticated. Both checks are cheap (no network round-trip beyond what
 * `auth status` does internally). Surfaced in Settings so the user sees a
 * red/green status before trying to generate.
 */
export async function detectClaudeCode(): Promise<ClaudeCodeDetectResult> {
  try {
    const { stdout } = await execFileAsync("claude", ["--version"], {
      timeout: 5000,
    });
    const version = stdout.trim().split(/\s+/).pop() ?? "";
    // `auth status` returns 0 when logged in, non-zero otherwise. We treat
    // any non-zero exit as "not authed" — the user fixes it via `claude
    // login` outside our process.
    let authed = false;
    try {
      await execFileAsync("claude", ["auth", "status"], { timeout: 5000 });
      authed = true;
    } catch {
      authed = false;
    }
    return { installed: true, authed, version };
  } catch (err) {
    return {
      installed: false,
      authed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Spawn `claude -p` and capture its JSON output. Subscription auth flows
 * from the user's `claude login` session; we deliberately strip
 * ANTHROPIC_API_KEY from the child env so it can't accidentally fall
 * through to the metered API (which would defeat the whole point of this
 * provider).
 */
/** Sentinel value persisted in settings when the user wants to be prompted
 *  on every run instead of locking in a default. The provider never sends
 *  this string to the CLI — every code path that reaches the spawn must
 *  resolve it to a real model id via the per-call override. */
export const CLAUDE_CODE_ASK_SENTINEL = "ask";

export function createClaudeCodeProvider(opts: {
  model: string;
  kbPath: string | null;
}): LlmProviderInstance {
  if (!opts.model) {
    throw new LlmProviderConfigError(
      "Claude (subscription) provider selected but no model configured. Pick one in Settings.",
    );
  }
  const configuredModel = opts.model;
  const kbPath = opts.kbPath;

  function resolveModel(override?: string): string {
    const trimmed = override?.trim();
    if (trimmed) return trimmed;
    if (configuredModel === CLAUDE_CODE_ASK_SENTINEL) {
      // The renderer should have intercepted before reaching the provider;
      // this is a defensive fallback so a bug doesn't silently pick the
      // wrong model behind the user's back.
      throw new LlmProviderConfigError(
        'Claude (subscription) is set to "Ask each time" but no model was picked for this run. Pick one in the dialog before generating.',
      );
    }
    return configuredModel;
  }

  function shortLabel(m: string): string {
    return `claude-cli · ${m.replace(/^claude-/, "")}`;
  }

  return {
    kind: "claude-code",
    label: shortLabel(configuredModel),
    labelFor(modelOverride?: string) {
      return shortLabel(resolveModel(modelOverride));
    },
    agentMode: "built-in",
    async generate(
      genOpts: LlmGenerateOpts,
    ): Promise<{ raw: string; usage?: LlmUsage }> {
      const model = resolveModel(genOpts.modelOverride);
      const label = shortLabel(model);
      const startedAt = Date.now();
      genOpts.onProgress?.("model", 2, `claude-cli ${model}`, label);

      // The CLI doesn't have a forced-JSON mode for the *content*; the
      // outer `--output-format json` wraps the model's text response in
      // metadata, but the text itself is whatever the model produced.
      // Spell out the schema requirement in the system + user prompts so
      // the model emits a single JSON object we can parse.
      const schemaInstruction = `\n\nWhen you have enough context, respond with ONLY a JSON object — no prose, no code fences — matching this JSON Schema exactly:\n${JSON.stringify(genOpts.schema, null, 2)}`;
      const systemPrompt = (genOpts.system ?? "") + schemaInstruction;

      // Use stream-json so we can show what the agent is actually doing —
      // without it the progress bar just drifts in the dark for the whole
      // claude -p duration (often minutes). Each NDJSON line is one event
      // (session start, assistant turn, tool_use, tool_result, api_retry,
      // final result). `--verbose` is required to enable the rich event
      // stream; we deliberately skip `--include-partial-messages` because
      // it would flood with per-token deltas we don't need.
      // Pass the prompt via stdin instead of argv. Meeting transcripts can
      // easily run 30-100KB; combined with our system_prompt and the env
      // claude-mem hooks inject (~26k tokens of context), the argv+env
      // size can blow past macOS's E2BIG limit and cause the spawned
      // process to hang with no output (the API call still fires because
      // claude already loaded the binary before parsing argv fully).
      const args = [
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        model,
        "--max-turns",
        "20",
        // Intentionally NO --strict-mcp-config: we want the user's globally
        // configured MCP servers (claude-mem, etc.) to load automatically so
        // the agent has access to the same tools it would have in a regular
        // `claude` session. If a user's MCP hangs the agent, they fix it in
        // their own claude config — we don't shadow it.
        "--system-prompt",
        systemPrompt,
      ];
      if (kbPath) {
        args.push("--add-dir", kbPath);
      }

      // Strip the Anthropic API key from the spawned env so the CLI must
      // use the user's logged-in subscription credentials. If the key
      // lingers, the CLI will silently bill the metered API.
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;

      genOpts.onProgress?.("agent", 20, "session starting", label);

      let resultEvent: ClaudeStreamResultEvent | null = null;
      const toolsUsed = new ToolUseCollector();
      // Per-call breakdown. Each `assistant` stream event = one LLM call in
      // the CLI's agent loop; we record its token usage and the tools it
      // invoked so the UI can show "turn 3 read 8 files and used 12k input
      // tokens" instead of just the final aggregate.
      const calls: LlmCallUsage[] = [];

      // Diagnostic: print exactly what we're about to spawn so the user can
      // reproduce it in their own shell when debugging hangs. Goes to
      // stderr so it doesn't pollute the JSON stream parsing.
      process.stderr.write(
        `\n[claude-code] spawning: claude ${args
          .map((a) => (a.includes(" ") ? `"${a.slice(0, 80)}…"` : a))
          .join(" ")}\n`,
      );

      await new Promise<void>((resolve, reject) => {
        // stdin: "pipe" so we can stream the (potentially large) prompt in,
        // then close. This bypasses the macOS argv size limit entirely
        // and matches the documented "prompt via stdin" mode of claude -p.
        const child = spawn("claude", args, {
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });
        process.stderr.write(`[claude-code] pid: ${child.pid}\n`);
        // Write the prompt and immediately close to signal EOF.
        child.stdin?.write(genOpts.prompt);
        child.stdin?.end();
        let stdoutBuffer = "";
        const errChunks: Buffer[] = [];
        let lastEventAt = Date.now();
        let killedByTimeout = false;
        // Hard timeout — kill the child if it hasn't finished after 5
        // minutes. Without this, a stuck MCP probe or rate-limit retry
        // loop could leave the UI spinning forever.
        const HARD_TIMEOUT_MS = 5 * 60_000;
        const hardTimeout = setTimeout(() => {
          killedByTimeout = true;
          process.stderr.write(
            `[claude-code] hard timeout (${HARD_TIMEOUT_MS / 1000}s) — killing pid ${child.pid}\n`,
          );
          child.kill("SIGTERM");
          // SIGKILL fallback if SIGTERM doesn't take effect in 2s.
          setTimeout(() => {
            if (!child.killed) child.kill("SIGKILL");
          }, 2000);
        }, HARD_TIMEOUT_MS);
        // Watchdog: if claude goes silent for too long (no stdout AND no
        // stderr), nudge the UI so the user knows we're waiting. Doesn't
        // kill the child — just a heads-up. Cleared on first event.
        const watchdog = setInterval(() => {
          const idleMs = Date.now() - lastEventAt;
          if (idleMs > 30_000) {
            genOpts.onProgress?.(
              "agent",
              pct,
              `silent for ${Math.floor(idleMs / 1000)}s`,
              label,
            );
          }
        }, 15_000);
        // Heuristic pct creep: every meaningful event nudges it forward,
        // capped well below `writing` (90%) so we don't whiplash backwards.
        let pct = 20;
        const bumpPct = (delta: number) => {
          pct = Math.min(85, pct + delta);
        };

        function handleEvent(ev: ClaudeStreamEvent) {
          if (ev.type === "system" && ev.subtype === "init") {
            bumpPct(3);
            const sid =
              typeof ev.session_id === "string"
                ? ev.session_id.slice(0, 8)
                : "ready";
            genOpts.onProgress?.("agent", pct, `session ${sid}`, label);
          } else if (ev.type === "system" && ev.subtype === "api_retry") {
            // Rate limits / transient errors — surface to the user so they
            // know a long stall is just a retry, not a hang.
            const errStr =
              typeof (ev as { error?: unknown }).error === "string"
                ? ((ev as { error?: string }).error as string)
                : "transient error";
            genOpts.onProgress?.("agent", pct, `retrying: ${errStr}`, label);
          } else if (ev.type === "assistant" && ev.message?.content) {
            const toolUses = ev.message.content.filter(
              (b) => b.type === "tool_use",
            ) as unknown as Array<{
              name: string;
              input?: Record<string, unknown>;
            }>;
            if (toolUses.length > 0) {
              bumpPct(3);
              const summary = toolUses
                .map((tu) => formatToolCall(tu.name, tu.input))
                .join(" · ");
              genOpts.onProgress?.("agent", pct, summary, label);
              for (const tu of toolUses) {
                toolsUsed.push(tu.name, tu.input);
              }
            }
            // Record per-call usage and the tools invoked on this turn. We
            // capture even calls without tool_uses (pure-text turns) since
            // the model still spent tokens "thinking" — useful for spotting
            // turns that contributed nothing actionable.
            const callTools = toolUses.map((tu) => ({
              name: tu.name,
              target: extractToolTarget(tu.input),
            }));
            calls.push({
              input_tokens: ev.message.usage?.input_tokens,
              output_tokens: ev.message.usage?.output_tokens,
              cache_creation_input_tokens:
                ev.message.usage?.cache_creation_input_tokens,
              cache_read_input_tokens:
                ev.message.usage?.cache_read_input_tokens,
              tools_used: callTools.length > 0 ? callTools : undefined,
            });
          } else if (ev.type === "user" && ev.message?.content) {
            const toolResults = ev.message.content.filter(
              (b) => b.type === "tool_result",
            );
            if (toolResults.length > 0) {
              bumpPct(2);
              genOpts.onProgress?.(
                "agent",
                pct,
                `${toolResults.length} tool result${toolResults.length > 1 ? "s" : ""}`,
                label,
              );
            }
          } else if (ev.type === "result") {
            resultEvent = ev;
          }
        }

        child.stdout?.on("data", (b: Buffer) => {
          lastEventAt = Date.now();
          // Mirror stdout to our parent stderr while debugging — keeps the
          // raw stream visible even when JSON.parse silently drops a line.
          // The "[claude-code stdout]" prefix makes it grep-friendly.
          process.stderr.write(`[claude-code stdout] ${b.toString("utf8")}`);
          stdoutBuffer += b.toString("utf8");
          // Process all complete lines; keep the trailing partial in the
          // buffer for the next chunk.
          let nl = stdoutBuffer.indexOf("\n");
          while (nl !== -1) {
            const line = stdoutBuffer.slice(0, nl).trim();
            stdoutBuffer = stdoutBuffer.slice(nl + 1);
            if (line.length > 0) {
              try {
                handleEvent(JSON.parse(line) as ClaudeStreamEvent);
              } catch (err) {
                process.stderr.write(
                  `[claude-code] failed to parse line: ${(err as Error).message}\n  line: ${line.slice(0, 200)}\n`,
                );
              }
            }
            nl = stdoutBuffer.indexOf("\n");
          }
        });

        child.stderr?.on("data", (b: Buffer) => {
          lastEventAt = Date.now();
          errChunks.push(b);
          // Echo stderr to our parent stderr so `npm run dev` shows it
          // live — critical when debugging hangs, since the CLI itself
          // writes auth/network hiccups to stderr.
          process.stderr.write(`[claude-code stderr] ${b.toString("utf8")}`);
        });

        child.on("error", (err: Error) => {
          clearInterval(watchdog);
          clearTimeout(hardTimeout);
          process.stderr.write(`[claude-code] spawn error: ${err.message}\n`);
          reject(
            new Error(
              `Failed to spawn claude CLI: ${err.message}. Is Claude Code installed and on PATH?`,
            ),
          );
        });

        child.on("close", (code: number | null) => {
          clearInterval(watchdog);
          clearTimeout(hardTimeout);
          process.stderr.write(`[claude-code] exited with code ${code}\n`);
          if (killedByTimeout) {
            reject(
              new Error(
                `claude -p killed after ${HARD_TIMEOUT_MS / 1000}s hard timeout. Last event ${Math.floor((Date.now() - lastEventAt) / 1000)}s ago.`,
              ),
            );
            return;
          }
          if (code !== 0) {
            const errText = Buffer.concat(errChunks).toString("utf8");
            reject(
              new Error(
                `claude -p exited ${code}: ${errText.slice(0, 500) || "no stderr"}`,
              ),
            );
            return;
          }
          if (!resultEvent) {
            reject(
              new Error(
                "claude -p completed without a result event (stream-json output was empty or malformed)",
              ),
            );
            return;
          }
          resolve();
        });
      });

      genOpts.onProgress?.("writing", 90, undefined, label);

      // The result event carries the same fields as the old `json` wrapper,
      // just inside an event envelope. Keep the rest of the parsing path
      // identical so usage capture etc. stays in one place.
      const wrapper = resultEvent as unknown as ClaudeCodeWrapper;
      if (wrapper.error) {
        throw new Error(`claude -p error: ${wrapper.error}`);
      }
      const text = wrapper.result ?? "";
      const raw = extractJsonObject(text);
      if (!raw) {
        throw new Error(
          `claude -p produced no JSON object. First 300 chars of result: ${text.slice(0, 300)}`,
        );
      }

      const usage: LlmUsage = {
        billing_kind: "subscription",
        // The CLI sometimes returns total_cost_usd as a string ("0.0123"),
        // sometimes as a number. Coerce defensively.
        cost_usd:
          typeof wrapper.total_cost_usd === "number"
            ? wrapper.total_cost_usd
            : typeof wrapper.total_cost_usd === "string"
              ? Number(wrapper.total_cost_usd) || undefined
              : undefined,
        model: wrapper.model ?? model,
        session_id: wrapper.session_id,
        duration_ms: wrapper.duration_ms ?? Date.now() - startedAt,
        num_turns: wrapper.num_turns,
        input_tokens: wrapper.usage?.input_tokens,
        output_tokens: wrapper.usage?.output_tokens,
        cache_creation_input_tokens:
          wrapper.usage?.cache_creation_input_tokens,
        cache_read_input_tokens: wrapper.usage?.cache_read_input_tokens,
        tools_used: toolsUsed.snapshot(),
        calls: calls.length > 0 ? calls : undefined,
      };

      return { raw, usage };
    },
  };
}

interface ClaudeCodeWrapper {
  result?: string;
  error?: string;
  session_id?: string;
  model?: string;
  total_cost_usd?: number | string;
  duration_ms?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

type ClaudeStreamEvent =
  | {
      type: "system";
      subtype: "init";
      session_id?: string;
      model?: string;
    }
  | {
      type: "system";
      subtype: "api_retry";
      error?: string;
    }
  | {
      type: "system";
      subtype: string;
      [k: string]: unknown;
    }
  | {
      type: "assistant";
      message?: {
        content?: Array<{ type: string; [k: string]: unknown }>;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      };
    }
  | {
      type: "user";
      message?: {
        content?: Array<{ type: string; [k: string]: unknown }>;
      };
    }
  | ClaudeStreamResultEvent;

interface ClaudeStreamResultEvent {
  type: "result";
  subtype?: "success" | "error" | string;
  result?: string;
  error?: string;
  session_id?: string;
  model?: string;
  total_cost_usd?: number | string;
  duration_ms?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/** Extract the first balanced JSON object from a string. Strips optional
 *  ```json … ``` code fences first. Returns null when nothing parses. */
function extractJsonObject(text: string): string | null {
  // Code fence first — models often wrap JSON in ```json blocks despite
  // being told not to. Be lenient.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  // Find the first `{` and the matching closing `}` by depth count.
  const start = candidate.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return candidate.slice(start, i + 1);
      }
    }
  }
  return null;
}
