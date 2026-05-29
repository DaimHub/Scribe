import { app } from "electron";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Claude reads global skills from `~/.claude/skills/<name>/SKILL.md`. Scribe
 * ships a canonical copy of its skill inside the app bundle; this module
 * exposes a one-click install/update flow so users don't have to copy the
 * file by hand.
 */

const SKILL_NAME = "scribe-mcp";
const SKILL_FILENAME = "SKILL.md";

/**
 * Everything from this marker line onward in a SKILL.md is the user's own
 * territory: Scribe never rewrites it (preserved verbatim across updates) and
 * it's excluded from the up-to-date check (so personal additions don't flag
 * the skill as "outdated"). The bundled skill ships the marker followed by an
 * empty "Mes ajouts" template. The exact string must match the one shipped in
 * mcp-server/skills/scribe-mcp/SKILL.md.
 */
const USER_SECTION_MARKER = "<!-- scribe:user-section -->";

/**
 * Split a SKILL.md into the Scribe-managed canonical part (up to and including
 * the marker) and the user-owned part (everything after it). When the marker
 * is absent — a legacy install, or a hand-written file — the whole file is
 * treated as canonical and there is no separable user part.
 */
function splitSkill(content: string): {
  canonical: string;
  userPart: string | null;
} {
  const i = content.indexOf(USER_SECTION_MARKER);
  if (i === -1) return { canonical: content, userPart: null };
  const end = i + USER_SECTION_MARKER.length;
  return { canonical: content.slice(0, end), userPart: content.slice(end) };
}

/**
 * Path to the SKILL.md inside the app bundle (production) or repo (dev).
 * Anchors on `import.meta.url` for the same reason getMcpServerScriptPath
 * does — `app.getAppPath()` resolves inconsistently in dev mode.
 *
 * Returns null when the file isn't on disk yet — typically because the
 * developer hasn't synced it from `~/.claude/skills/` into the repo, or
 * the packaged build is missing the extraResource entry.
 */
export function getBundledSkillPath(): string | null {
  const candidate = app.isPackaged
    ? path.join(process.resourcesPath, "skills", SKILL_NAME, SKILL_FILENAME)
    : (() => {
        // dist-electron/services/skill.js → ../../mcp-server/skills/<name>/SKILL.md
        const here = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(
          here,
          "..",
          "..",
          "mcp-server",
          "skills",
          SKILL_NAME,
          SKILL_FILENAME,
        );
      })();
  return existsSync(candidate) ? candidate : null;
}

/**
 * Absolute path to where the skill should be installed for Claude to pick
 * it up. ~/.claude is the global location read by Claude Desktop and
 * Claude Code regardless of project.
 */
export function getInstalledSkillPath(): string {
  return path.join(
    app.getPath("home"),
    ".claude",
    "skills",
    SKILL_NAME,
    SKILL_FILENAME,
  );
}

export type SkillStatus =
  | "not-installed"
  | "installed"
  | "outdated"
  | "missing";

export interface SkillInfo {
  status: SkillStatus;
  /** Absolute path to the canonical (bundled) SKILL.md. Null if not present. */
  bundledPath: string | null;
  /** Absolute path to the installed location, whether or not it exists. */
  installedPath: string;
  /** Size of the bundled file in bytes (null when missing). */
  bundledSize: number | null;
  /** Last-modified time of the installed file in epoch ms (null when not installed). */
  installedMtimeMs: number | null;
  /** True when the installed file has non-empty content below the user-section
   *  marker. Surfaced so the UI can reassure the user their additions survive
   *  updates. False when not installed or when the file has no user section. */
  hasUserSection: boolean;
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function getSkillInfo(): SkillInfo {
  const bundledPath = getBundledSkillPath();
  const installedPath = getInstalledSkillPath();
  const installedExists = existsSync(installedPath);

  let bundledSize: number | null = null;
  let installedMtimeMs: number | null = null;
  let hasUserSection = false;
  let status: SkillStatus;

  if (!bundledPath) {
    status = "missing";
  } else {
    const bundled = readFileSync(bundledPath, "utf8");
    bundledSize = Buffer.byteLength(bundled, "utf8");
    if (!installedExists) {
      status = "not-installed";
    } else {
      const installed = readFileSync(installedPath, "utf8");
      installedMtimeMs = Date.now(); // placeholder; we don't really need mtime
      const installedSplit = splitSkill(installed);
      const bundledSplit = splitSkill(bundled);
      // "Has a user section" = the user put their own content below the marker,
      // not merely the shipped empty template — keeps the reassurance hint
      // honest for fresh installs.
      hasUserSection =
        installedSplit.userPart !== null &&
        installedSplit.userPart.trim().length > 0 &&
        installedSplit.userPart.trim() !== (bundledSplit.userPart ?? "").trim();
      // Compare only the Scribe-managed (canonical) part. Anything the user
      // added below the marker is theirs — it must not flag the skill as
      // outdated.
      status =
        sha256(installedSplit.canonical) === sha256(bundledSplit.canonical)
          ? "installed"
          : "outdated";
    }
  }

  return {
    status,
    bundledPath,
    installedPath,
    bundledSize,
    installedMtimeMs,
    hasUserSection,
  };
}

export interface InstallResult {
  ok: boolean;
  installedPath: string;
  error?: string;
  /** True when a non-empty user section was carried over from the previous
   *  install onto the freshly-updated canonical. */
  preservedUserSection?: boolean;
  /** Set when a legacy (marker-less) file that differed from the bundle was
   *  backed up before being replaced. Points at the `.bak` copy. */
  backupPath?: string;
}

/**
 * Install/update the skill in the global skills directory, creating
 * intermediate dirs as needed. The canonical (Scribe-managed) part is always
 * refreshed from the bundle; the user-owned part below the marker is preserved
 * verbatim across updates. A legacy file with no marker is replaced after
 * being backed up to `<path>.bak`, so the user's prior edits are recoverable.
 */
export function installSkill(): InstallResult {
  const bundledPath = getBundledSkillPath();
  const target = getInstalledSkillPath();
  if (!bundledPath) {
    return {
      ok: false,
      installedPath: target,
      error:
        "Bundled skill file not found. In dev, ensure mcp-server/skills/scribe-mcp/SKILL.md exists.",
    };
  }
  try {
    const bundled = readFileSync(bundledPath, "utf8");
    const bundledSplit = splitSkill(bundled);
    let toWrite = bundled;
    let preservedUserSection = false;
    let backupPath: string | undefined;

    if (existsSync(target)) {
      const installed = readFileSync(target, "utf8");
      const installedSplit = splitSkill(installed);
      if (installedSplit.userPart !== null) {
        // Marker present: graft the user's section onto the fresh canonical so
        // their personal additions survive the update untouched.
        toWrite = bundledSplit.canonical + installedSplit.userPart;
        preservedUserSection =
          installedSplit.userPart.trim().length > 0 &&
          installedSplit.userPart.trim() !== (bundledSplit.userPart ?? "").trim();
      } else if (sha256(installed) !== sha256(bundled)) {
        // Legacy file with no marker: the user's edits (if any) can't be
        // separated from the old canonical, so refresh to the bundled file
        // (which carries the empty user template) but back it up first —
        // never silently discard the user's work.
        backupPath = `${target}.bak`;
        copyFileSync(target, backupPath);
      }
    }

    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, toWrite, "utf8");
    return { ok: true, installedPath: target, preservedUserSection, backupPath };
  } catch (e) {
    return {
      ok: false,
      installedPath: target,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Remove the installed SKILL.md (and its dedicated parent dir if empty —
 * we don't try to recursively clean up ~/.claude/skills which may hold
 * other skills the user has installed manually).
 */
export function uninstallSkill(): { ok: boolean; error?: string } {
  const target = getInstalledSkillPath();
  try {
    if (existsSync(target)) {
      rmSync(target);
    }
    // Best-effort directory cleanup: only the SKILL_NAME folder, not the
    // parent `skills/` which probably contains other skills.
    const dir = path.dirname(target);
    try {
      rmSync(dir, { recursive: false });
    } catch {
      /* directory non-empty or already gone — ignore */
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
