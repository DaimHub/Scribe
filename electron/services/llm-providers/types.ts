export interface LlmGenerateOpts {
  /** User-turn content. Providers send this as the user message. */
  prompt: string;
  /** Optional system-turn content. Providers that support a dedicated system
   *  role send it as such (OpenAI, Ollama chat, Anthropic system block);
   *  providers without one (node-llama-cpp) concatenate it ahead of `prompt`.
   *  Splitting the prompt this way is what lets Anthropic mark the stable
   *  prefix with cache_control. */
  system?: string;
  /** JSON Schema describing the expected response shape. Each provider maps
   *  it to its native structured-output API (Ollama `format`, OpenAI
   *  `response_format`, Anthropic forced tool use, llama.cpp grammar). */
  schema: unknown;
  maxTokens?: number;
  temperature?: number;
  /** Per-call model override. When unset, the provider uses its configured
   *  model. Only consumed by remote-API providers (anthropic, openai); the
   *  bundled provider ignores it. */
  modelOverride?: string;
  /** node-llama-cpp specific. Other providers ignore it. */
  contextSize?: number;
  onProgress?: (
    stage: string,
    pct: number,
    note?: string,
    model?: string,
  ) => void;
}

/** Minimal tool surface the agent loop needs from an MCP client. Decouples
 *  the provider from `electron/services/mcp-client.ts` so the provider
 *  module stays portable. */
export interface AgentToolHost {
  listTools(): Promise<
    Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  >;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

export interface LlmAgenticGenerateOpts extends LlmGenerateOpts {
  /** Tool host the agent can call during the loop. The provider injects an
   *  additional `emit_notes` tool whose input matches `schema` — the loop
   *  ends when the model calls it. */
  toolHost: AgentToolHost;
  /** Safety cap on the number of model turns. Tool execution is cheap but
   *  Anthropic charges per turn; runaway loops should fail fast. */
  maxTurns?: number;
}

/** Per-call usage report. Every field is optional because each provider
 *  exposes a slightly different subset — the claude-code CLI gives
 *  `total_cost_usd` + session id, the Anthropic API gives token-level
 *  breakdown but no precomputed cost (we derive it). Persisted into the
 *  meeting's `pipeline_json` so the UI can render it after the fact. */
export interface LlmUsage {
  /** Best-effort cost in USD. Anthropic API: computed from token counts +
   *  per-model rates. claude-code CLI: read from the wrapper (always
   *  zeroish under a live Max subscription, equal to the API-equivalent
   *  spend after the June 15 2026 split). */
  cost_usd?: number;
  /** Model id reported by the provider — useful when the user picked an
   *  override at call time and the badge derived from settings would lie. */
  model?: string;
  /** CLI session id (claude-code only) — handy for cross-referencing with
   *  `claude /history` if the user wants to inspect the run. */
  session_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  /** Wall-clock duration of the LLM step (excluding our orchestration
   *  overhead). claude-code reports `duration_ms`; for Anthropic we
   *  measure around the request set. */
  duration_ms?: number;
  /** Agent-loop turns spent. 1 for single-shot. */
  num_turns?: number;
  /** Free-form badge appended to the pipeline label, e.g. "subscription"
   *  vs "metered" — lets the UI hint at billing context without the user
   *  having to know which provider is active. */
  billing_kind?: "subscription" | "metered";
  /** Tools the agent invoked during the run. Lets the UI surface "KB
   *  consulted: 5 files" so the user can verify the knowledge base was
   *  actually used instead of just configured. Empty array (or absent)
   *  means single-shot generation with no tool use. */
  tools_used?: Array<{ name: string; target?: string }>;
  /** Per-call breakdown of the agent loop. One entry per LLM round-trip:
   *  for claude-cli that's one entry per `assistant` stream event, for the
   *  Anthropic direct provider it's one entry per `messages.create`. The
   *  top-level token totals are the sum across calls — `calls` lets the UI
   *  show the shape of the loop (which turn used the most context, which
   *  turn called Read 12 times, etc.). Absent on single-shot providers. */
  calls?: LlmCallUsage[];
}

/** One LLM call inside an agentic loop. Mirrors the per-turn fields of
 *  `LlmUsage` plus the tools that were invoked during that specific call. */
export interface LlmCallUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  /** Tools the model called during this turn. Aggregated across all calls
   *  in `LlmUsage.tools_used` for convenience. */
  tools_used?: Array<{ name: string; target?: string }>;
}

/** How a provider participates in agentic generation:
 *  - "none": single-shot only. Bundled, openai, ollama.
 *  - "built-in": provider drives its own agent loop internally and consumes
 *    the KB path at creation time. Ignores any toolHost passed in. Today
 *    only claude-code (CLI uses `--add-dir`).
 *  - "via-tool-host": needs the caller to inject an MCP-style toolHost at
 *    call time. Today only anthropic. */
export type LlmAgentMode = "none" | "built-in" | "via-tool-host";

export interface LlmProviderInstance {
  /** Stable identifier of the provider kind. Mostly used by UI badges; the
   *  dispatcher in `llm.ts` keys off `agentMode` instead so a new provider
   *  can be added without touching dispatch code. */
  kind: "bundled" | "ollama" | "openai" | "anthropic" | "claude-code";
  /** Short label rendered as the pipeline badge on the meeting header.
   *  E.g. "gemma · 3-4b", "ollama · llama3.2:3b", "openai · gpt-4o-mini". */
  label: string;
  /** Compute the label for a per-call model override. Each provider knows
   *  its own naming convention (e.g. claude-code uses "claude-cli · …"
   *  while anthropic uses "claude · …"). Returns `label` if no override. */
  labelFor(modelOverride?: string): string;
  /** Declares how the provider supports agents. The dispatcher uses this to
   *  decide whether to spin up an MCP tool host and which entry point to
   *  call. */
  agentMode: LlmAgentMode;
  /** Generate raw text (expected to be JSON matching `schema`). Caller is
   *  responsible for JSON.parse + validation — providers return raw text so
   *  the caller can surface useful error messages on malformed output.
   *  Usage is optional: providers that don't track it just omit the field. */
  generate(
    opts: LlmGenerateOpts,
  ): Promise<{ raw: string; usage?: LlmUsage }>;
  /** Agent loop with an injected tool host. Required when `agentMode` is
   *  "via-tool-host"; absent otherwise. */
  agenticGenerate?(
    opts: LlmAgenticGenerateOpts,
  ): Promise<{ raw: string; usage?: LlmUsage }>;
}

export class LlmProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmProviderConfigError";
  }
}
