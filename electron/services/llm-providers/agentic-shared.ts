/**
 * Helpers shared by every provider that runs an agentic loop over MCP-style
 * tools. Today that's `anthropic.ts` (TS-side loop driving the Messages API)
 * and `claude-code.ts` (CLI-side loop, we just observe stream-json events).
 *
 * Keep this module dependency-free apart from the LLM types — it's pulled
 * by both providers and any new agentic backend should drop in here too.
 */

import type { LlmUsage } from "./types.js";

/** Name of the synthetic tool the Anthropic agent loop uses to signal
 *  "I'm done, here is the structured output." It's scaffolding, not a
 *  knowledge-base consultation, so we filter it out of `tools_used` and
 *  refuse to surface it in progress notes. The claude-code CLI doesn't
 *  use this tool — it parses JSON from the final result block instead —
 *  but exporting the constant from one place keeps the contract explicit. */
export const EMIT_NOTES_TOOL_NAME = "emit_notes";

/** One entry of `LlmUsage.tools_used`. Re-exported so callers can type
 *  intermediate variables without reaching into LlmUsage. */
export type ToolUseEntry = NonNullable<LlmUsage["tools_used"]>[number];

/** Pull the most relevant string argument from a tool input so the UI can
 *  show *what* the agent looked at, not just *which* tool it ran. The key
 *  order mirrors the conventions used by the bundled MCP tools and the
 *  claude-code CLI's built-in toolset:
 *  - Read / Glob → `file_path` or `path`
 *  - Grep → `pattern`
 *  - WebFetch → `url`
 *  - Bash → `command`
 *  - Filesystem MCP search → `query`
 *  Returns `undefined` when none of those keys carry a string, so callers
 *  can fall back to showing the bare tool name. */
export function extractToolTarget(
  input: Record<string, unknown> | undefined,
): string | undefined {
  if (!input) return undefined;
  const arg =
    (typeof input.file_path === "string" && input.file_path) ||
    (typeof input.path === "string" && input.path) ||
    (typeof input.pattern === "string" && input.pattern) ||
    (typeof input.query === "string" && input.query) ||
    (typeof input.url === "string" && input.url) ||
    (typeof input.command === "string" && input.command) ||
    "";
  return arg || undefined;
}

/** Compact one-line description of a tool call, suitable for the progress
 *  badge in the meeting header. Trims long paths from the left so the
 *  filename stays visible. */
export function formatToolCall(
  name: string,
  input: Record<string, unknown> | undefined,
): string {
  const target = extractToolTarget(input);
  if (!target) return name;
  const short = target.length > 40 ? "…" + target.slice(-40) : target;
  return `${name} ${short}`;
}

/** Accumulates `tools_used` entries during an agentic run. Filters out the
 *  Anthropic `emit_notes` finisher so it never shows up as a KB read —
 *  claude-code never emits that name, so the filter is a no-op there. */
export class ToolUseCollector {
  private readonly items: ToolUseEntry[] = [];

  /** Record one tool call. Pass the raw `input` map; the target argument
   *  is extracted via `extractToolTarget`. */
  push(name: string, input: Record<string, unknown> | undefined): void {
    if (name === EMIT_NOTES_TOOL_NAME) return;
    this.items.push({ name, target: extractToolTarget(input) });
  }

  /** Return a defensive copy. The caller typically stores this in
   *  `LlmUsage.tools_used` and we don't want later pushes to mutate it. */
  snapshot(): ToolUseEntry[] {
    return this.items.slice();
  }
}
