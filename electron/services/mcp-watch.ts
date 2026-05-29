import { app } from "electron";
import { mkdirSync, watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { broadcastTreeInvalidated } from "./broadcast.js";

let watcher: FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

/**
 * The Scribe MCP server runs as its own process (spawned by Claude Desktop /
 * Claude Code), so its writes to the shared SQLite DB never pass through this
 * main process — none of the in-process invalidation broadcasts fire, and an
 * open meeting view stays stale until a manual reload. The server does append
 * one JSON line to logs/mcp.log on every write tool call (only writes — reads
 * don't audit), after the DB transaction has committed. We watch that file and
 * treat any growth as "something changed", rebroadcasting tree:invalidated so
 * renderers refetch the tree (status) and the selected meeting's detail
 * (summary, tasks, speakers, pipeline) — the same refresh path used after a
 * local write.
 *
 * The log dir is derived from this app's userData, the same location the MCP
 * server resolves to by default; if the two ever diverge the MCP feature is
 * already broken (Claude would be reading a different DB).
 */
export function startMcpWriteWatcher(): void {
  if (watcher) return;
  const logDir = path.join(app.getPath("userData"), "logs");
  try {
    // The dir may not exist yet (no MCP write has happened). Create it so we
    // can attach the watcher now and catch the very first audit-log line.
    mkdirSync(logDir, { recursive: true });
    watcher = watch(logDir, { persistent: false }, (_event, filename) => {
      // Only react to the audit log. `filename` can be null on some platforms;
      // when we can't tell, assume relevant — a spurious refetch is harmless.
      if (filename && filename !== "mcp.log") return;
      // Appends emit a burst of fs events; collapse them into one broadcast.
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        broadcastTreeInvalidated();
      }, 100);
    });
  } catch (err) {
    console.warn("MCP write watcher failed to start:", err);
  }
}

export function stopMcpWriteWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  watcher?.close();
  watcher = null;
}
