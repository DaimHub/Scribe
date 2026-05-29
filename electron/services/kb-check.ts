import { readdir, stat, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export type KbCheckResult =
  | {
      ok: false;
      reason: "missing" | "not_dir" | "no_access" | "empty" | "error";
      message: string;
    }
  | {
      ok: true;
      path: string;
      files: number;
      truncated: boolean;
      size_bytes: number;
      /** Counts keyed by lowercased extension (".md", ".txt"...). `""` is
       *  used for files with no extension. */
      extensions: Record<string, number>;
      /** First few file names (relative paths) — gives the user a hint at
       *  what the agent will see when it lists the directory. */
      sample: string[];
    };

// Stay conservative on traversal — KB folders are typically Obsidian vaults
// or spec dumps in the low hundreds. A user pointing at $HOME by accident
// shouldn't lock the UI for minutes; cap and surface `truncated: true`.
const MAX_FILES = 1500;
const MAX_DEPTH = 4;
const SAMPLE_SIZE = 8;
const SKIP_DIRS = new Set([
  ".git",
  ".obsidian",
  "node_modules",
  ".DS_Store",
  "dist",
  "build",
  ".next",
]);

interface WalkState {
  files: number;
  size_bytes: number;
  extensions: Record<string, number>;
  sample: string[];
  truncated: boolean;
}

async function walk(
  root: string,
  rel: string,
  state: WalkState,
  depth: number,
): Promise<void> {
  if (state.truncated || depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = await readdir(path.join(root, rel), { withFileTypes: true });
  } catch {
    return; // permission denied on a subfolder → skip silently
  }
  for (const entry of entries) {
    if (state.truncated) return;
    if (entry.name.startsWith(".") && entry.name !== ".env") {
      // Filesystem MCP server hides dotfiles by default; mirror that here
      // so the count matches what the agent will actually see.
      if (SKIP_DIRS.has(entry.name)) continue;
      // Keep going for ".env"-style readable files even though we generally
      // skip dotfiles — they sometimes hold project context.
    }
    if (SKIP_DIRS.has(entry.name)) continue;
    const childRel = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      await walk(root, childRel, state, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    state.files += 1;
    if (state.files > MAX_FILES) {
      state.truncated = true;
      return;
    }
    if (state.sample.length < SAMPLE_SIZE) state.sample.push(childRel);
    const ext = path.extname(entry.name).toLowerCase();
    state.extensions[ext] = (state.extensions[ext] ?? 0) + 1;
    try {
      const s = await stat(path.join(root, childRel));
      state.size_bytes += s.size;
    } catch {
      /* race or permission — ignore */
    }
  }
}

/**
 * Validate that a configured KB path will work as input to the filesystem
 * MCP server (anthropic) or `--add-dir` (claude-code). Cheap enough to run
 * from the Settings UI on demand — no network, just a bounded fs walk.
 *
 * Returns a structured diagnostic so the UI can show a useful message
 * instead of "something went wrong".
 */
export async function checkKbFilesystem(p: string): Promise<KbCheckResult> {
  const trimmed = p.trim();
  if (!trimmed) {
    return { ok: false, reason: "missing", message: "Path is empty." };
  }
  let info;
  try {
    info = await stat(trimmed);
  } catch (err) {
    return {
      ok: false,
      reason: "missing",
      message:
        err instanceof Error
          ? err.message
          : "Path does not exist or is not accessible.",
    };
  }
  if (!info.isDirectory()) {
    return {
      ok: false,
      reason: "not_dir",
      message: "Path exists but is not a directory.",
    };
  }
  try {
    await access(trimmed, constants.R_OK);
  } catch {
    return {
      ok: false,
      reason: "no_access",
      message: "Path is not readable by Scribe.",
    };
  }
  const state: WalkState = {
    files: 0,
    size_bytes: 0,
    extensions: {},
    sample: [],
    truncated: false,
  };
  try {
    await walk(trimmed, "", state, 0);
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (state.files === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "Directory exists but contains no readable files.",
    };
  }
  return {
    ok: true,
    path: trimmed,
    files: state.files,
    truncated: state.truncated,
    size_bytes: state.size_bytes,
    extensions: state.extensions,
    sample: state.sample,
  };
}
