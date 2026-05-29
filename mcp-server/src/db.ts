import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

// --- Schema-mirrored types ------------------------------------------------
//
// These mirror electron/services/db.ts deliberately rather than importing
// from it — that file pulls in Electron's `app` module, which fails outside
// the Electron runtime. Schema is the contract; if it shifts, queries here
// need updating manually.

export type MeetingStatus =
  | "recording"
  | "recorded"
  | "transcribing"
  | "transcribed"
  | "diarized"
  | "done"
  | "error";

export interface MeetingRow {
  id: string;
  title: string;
  started_at_ms: number;
  ended_at_ms: number | null;
  mic_wav_path: string | null;
  sys_wav_path: string | null;
  status: MeetingStatus;
  duration_ms: number | null;
  summary_json: string | null;
  folder_id: string | null;
  position: number;
  pinned: 0 | 1;
  pipeline_json: string | null;
  notes_template_id: string | null;
  bullets_json: string | null;
  scratchpad: string | null;
}

/**
 * Subset of electron/services/db.ts `Pipeline` the MCP server reads/writes.
 * Stage values are human-readable engine labels rendered as badges in the
 * meeting header. The index signature preserves the richer fields the app
 * writes (notes_usage, etc.) across a read-modify-write without modelling
 * them here.
 */
export interface Pipeline {
  transcribe?: string;
  align?: string;
  diarize?: string;
  notes?: string;
  notes_template_id?: string;
  notes_template_name?: string;
  [k: string]: unknown;
}

export interface TranscriptRow {
  meeting_id: string;
  segment_idx: number;
  start_ms: number;
  end_ms: number;
  speaker_id: string | null;
  text: string;
}

export interface SpeakerRow {
  meeting_id: string;
  speaker_id: string;
  display_name: string;
  sample_clip_path: string | null;
  voice_library_id: string | null;
  match_confidence: number | null;
  needs_review: 0 | 1;
}

export interface TaskRow {
  id: number;
  meeting_id: string;
  assignee_speaker_id: string | null;
  text: string;
  done: 0 | 1;
  created_at_ms: number;
}

export interface TagRow {
  id: string;
  name: string;
  color: string | null;
  auto: 0 | 1;
  created_at_ms: number;
}

export interface VoiceLibraryRow {
  id: string;
  display_name: string;
  dim: number;
  sample_clip_path: string | null;
  n_meetings: number;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface CalendarEventRow {
  id: string;
  account_id: string;
  source_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at_ms: number;
  end_at_ms: number;
  hangout_link: string | null;
  attendees_json: string | null;
  meeting_id: string | null;
  updated_at_ms: number;
}

// --- Path resolution ------------------------------------------------------

/**
 * Mirror Electron's `app.getPath("userData")` per platform. The MCP server
 * runs outside Electron (Claude Desktop spawns it), so we recompute the
 * path here. `SCRIBE_DB_PATH` env override is for testing.
 */
export function resolveDbPath(): string {
  const override = process.env.SCRIBE_DB_PATH;
  if (override) return override;
  return path.join(resolveUserDataDir(), "data", "scribe.db");
}

/**
 * Resolve the Scribe userData directory itself (not the db file). Used to
 * locate settings.json (write gate) and logs/mcp.log (audit trail). When
 * SCRIBE_DB_PATH is overridden, walk up from the db file rather than
 * recomputing — keeps dev (Electron userData) and prod consistent.
 */
export function resolveUserDataDir(): string {
  const override = process.env.SCRIBE_DB_PATH;
  if (override) {
    // .../<userData>/data/scribe.db → .../<userData>
    return path.dirname(path.dirname(override));
  }
  const home = homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Scribe");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return path.join(appData, "Scribe");
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  return path.join(xdg, "Scribe");
}

// --- Lazy DB handle -------------------------------------------------------

let db: DatabaseSync | null = null;
const stmts: Record<string, StatementSync> = {};

function getDb(): DatabaseSync {
  if (db) return db;
  const file = resolveDbPath();
  if (!existsSync(file)) {
    throw new Error(
      `Scribe database not found at ${file}. Open Scribe at least once to initialize it, or set SCRIBE_DB_PATH to point at the db file.`,
    );
  }
  // Read-only: the MCP server never mutates Scribe's state in Phase 1.
  // Writers (the Electron app) keep the WAL; readers see a consistent
  // snapshot without lock contention.
  db = new DatabaseSync(file, { readOnly: true });
  return db;
}

function prep(key: string, sql: string): StatementSync {
  let s = stmts[key];
  if (!s) {
    s = getDb().prepare(sql);
    stmts[key] = s;
  }
  return s;
}

// --- Queries --------------------------------------------------------------

export interface ListMeetingsOpts {
  fromMs?: number;
  toMs?: number;
  limit?: number;
}

export function listMeetings(opts: ListMeetingsOpts = {}): MeetingRow[] {
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (opts.fromMs !== undefined) {
    clauses.push("started_at_ms >= ?");
    args.push(opts.fromMs);
  }
  if (opts.toMs !== undefined) {
    clauses.push("started_at_ms < ?");
    args.push(opts.toMs);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const sql = `SELECT * FROM meetings ${where} ORDER BY started_at_ms DESC LIMIT ?`;
  args.push(limit);
  return getDb().prepare(sql).all(...(args as never[])) as unknown as MeetingRow[];
}

export function getMeeting(id: string): MeetingRow | null {
  const row = prep("getMeeting", "SELECT * FROM meetings WHERE id = ?").get(id);
  return (row as MeetingRow | undefined) ?? null;
}

export function listTranscript(meetingId: string): TranscriptRow[] {
  return prep(
    "listTranscript",
    "SELECT * FROM transcripts WHERE meeting_id = ? ORDER BY start_ms ASC",
  ).all(meetingId) as unknown as TranscriptRow[];
}

export function listSpeakers(meetingId: string): SpeakerRow[] {
  return prep(
    "listSpeakers",
    `SELECT meeting_id, speaker_id, display_name, sample_clip_path,
            voice_library_id, match_confidence, needs_review
       FROM speakers WHERE meeting_id = ?`,
  ).all(meetingId) as unknown as SpeakerRow[];
}

export function listTasks(meetingId: string): TaskRow[] {
  return prep(
    "listTasks",
    "SELECT * FROM tasks WHERE meeting_id = ? ORDER BY id ASC",
  ).all(meetingId) as unknown as TaskRow[];
}

export function listTagsForMeeting(meetingId: string): TagRow[] {
  return prep(
    "listTagsForMeeting",
    `SELECT t.* FROM tags t
       JOIN meeting_tags mt ON mt.tag_id = t.id
      WHERE mt.meeting_id = ?
      ORDER BY t.name ASC`,
  ).all(meetingId) as unknown as TagRow[];
}

export function listVoiceLibrary(): VoiceLibraryRow[] {
  return prep(
    "listVoiceLibrary",
    `SELECT id, display_name, dim, sample_clip_path, n_meetings,
            created_at_ms, updated_at_ms
       FROM voice_library ORDER BY display_name COLLATE NOCASE ASC`,
  ).all() as unknown as VoiceLibraryRow[];
}

export interface PersonRow extends VoiceLibraryRow {
  last_heard_ms: number | null;
  last_meeting_id: string | null;
  last_meeting_title: string | null;
}

export function getPerson(id: string): PersonRow | null {
  const row = prep(
    "getPerson",
    `SELECT vl.id, vl.display_name, vl.dim, vl.sample_clip_path, vl.n_meetings,
            vl.created_at_ms, vl.updated_at_ms,
            (SELECT MAX(m.started_at_ms) FROM speakers s
               JOIN meetings m ON m.id = s.meeting_id
              WHERE s.voice_library_id = vl.id) AS last_heard_ms,
            (SELECT m.id FROM speakers s
               JOIN meetings m ON m.id = s.meeting_id
              WHERE s.voice_library_id = vl.id
              ORDER BY m.started_at_ms DESC LIMIT 1) AS last_meeting_id,
            (SELECT m.title FROM speakers s
               JOIN meetings m ON m.id = s.meeting_id
              WHERE s.voice_library_id = vl.id
              ORDER BY m.started_at_ms DESC LIMIT 1) AS last_meeting_title
       FROM voice_library vl WHERE vl.id = ?`,
  ).get(id);
  return (row as PersonRow | undefined) ?? null;
}

export function listMeetingsForPerson(id: string, limit = 20): MeetingRow[] {
  return prep(
    "listMeetingsForPerson",
    `SELECT DISTINCT m.* FROM meetings m
       JOIN speakers s ON s.meeting_id = m.id
      WHERE s.voice_library_id = ?
      ORDER BY m.started_at_ms DESC LIMIT ?`,
  ).all(id, limit) as unknown as MeetingRow[];
}

// --- Search ---------------------------------------------------------------
//
// Uses the transcripts_fts virtual table the app maintains via triggers.
// Falls back to a LIKE-scan on titles only if the FTS table is missing
// (older DBs that pre-date the FTS migration).

export interface SearchHit {
  meeting_id: string;
  title: string;
  started_at_ms: number;
  snippet: string;
}

export function searchMeetings(opts: {
  query: string;
  fromMs?: number;
  toMs?: number;
  limit?: number;
}): SearchHit[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
  const q = opts.query.trim();
  if (!q) return [];
  const dateClauses: string[] = [];
  const dateArgs: unknown[] = [];
  if (opts.fromMs !== undefined) {
    dateClauses.push("m.started_at_ms >= ?");
    dateArgs.push(opts.fromMs);
  }
  if (opts.toMs !== undefined) {
    dateClauses.push("m.started_at_ms < ?");
    dateArgs.push(opts.toMs);
  }
  const dateWhere = dateClauses.length ? `AND ${dateClauses.join(" AND ")}` : "";
  // FTS5: distinct per meeting (a single meeting can match many segments).
  // snippet() returns ~30-word excerpt around the first hit.
  try {
    const sql = `
      SELECT m.id AS meeting_id, m.title AS title, m.started_at_ms AS started_at_ms,
             snippet(transcripts_fts, 2, '«', '»', '…', 32) AS snippet
        FROM transcripts_fts
        JOIN meetings m ON m.id = transcripts_fts.meeting_id
       WHERE transcripts_fts MATCH ? ${dateWhere}
       GROUP BY m.id
       ORDER BY m.started_at_ms DESC
       LIMIT ?`;
    return getDb()
      .prepare(sql)
      .all(q, ...(dateArgs as never[]), limit) as unknown as SearchHit[];
  } catch {
    // FTS missing or query syntax invalid — fall back to title LIKE.
    const like = `%${q}%`;
    const sql = `
      SELECT m.id AS meeting_id, m.title AS title, m.started_at_ms AS started_at_ms,
             '' AS snippet
        FROM meetings m
       WHERE m.title LIKE ? ${dateWhere}
       ORDER BY m.started_at_ms DESC
       LIMIT ?`;
    return getDb()
      .prepare(sql)
      .all(like, ...(dateArgs as never[]), limit) as unknown as SearchHit[];
  }
}

// --- Aggregated tasks across meetings (for "open items this week") --------

export interface AggregatedTaskRow {
  id: number;
  meeting_id: string;
  meeting_title: string;
  meeting_started_at_ms: number;
  assignee_speaker_id: string | null;
  assignee_name: string | null;
  text: string;
  done: 0 | 1;
  created_at_ms: number;
}

export function listTasksAggregated(opts: {
  meetingId?: string;
  doneOnly?: boolean;
  openOnly?: boolean;
  sinceMs?: number;
  limit?: number;
}): AggregatedTaskRow[] {
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (opts.meetingId) {
    clauses.push("t.meeting_id = ?");
    args.push(opts.meetingId);
  }
  if (opts.doneOnly) clauses.push("t.done = 1");
  if (opts.openOnly) clauses.push("t.done = 0");
  if (opts.sinceMs !== undefined) {
    clauses.push("m.started_at_ms >= ?");
    args.push(opts.sinceMs);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 500));
  const sql = `
    SELECT t.id, t.meeting_id, m.title AS meeting_title,
           m.started_at_ms AS meeting_started_at_ms,
           t.assignee_speaker_id,
           (SELECT display_name FROM speakers s
             WHERE s.meeting_id = t.meeting_id
               AND s.speaker_id = t.assignee_speaker_id) AS assignee_name,
           t.text, t.done, t.created_at_ms
      FROM tasks t
      JOIN meetings m ON m.id = t.meeting_id
      ${where}
     ORDER BY m.started_at_ms DESC, t.id ASC
     LIMIT ?`;
  args.push(limit);
  return getDb().prepare(sql).all(...(args as never[])) as unknown as AggregatedTaskRow[];
}

// --- Calendar link --------------------------------------------------------

export function getLinkedEvent(meetingId: string): CalendarEventRow | null {
  const row = prep(
    "getLinkedEvent",
    "SELECT * FROM calendar_events WHERE meeting_id = ? LIMIT 1",
  ).get(meetingId);
  return (row as CalendarEventRow | undefined) ?? null;
}

// =========================================================================
// WRITE LAYER (Phase 2)
// =========================================================================
//
// All writes are gated on the user's `mcp_allow_writes` setting, read on
// every call (cheap — settings.json is <1KB) so the user can flip the
// toggle without restarting Claude Desktop. Each write is logged to
// `${userData}/logs/mcp.log` as one JSON-line per call for the audit
// trail. We open a parallel writable handle so the read-only cached
// statements above aren't disturbed.

// --- Settings gate --------------------------------------------------------

interface ScribeSettings {
  mcp_allow_writes?: boolean;
  [k: string]: unknown;
}

/**
 * Read the Electron app's settings.json to check whether writes are
 * currently allowed. Returns false on any read error (missing file,
 * malformed JSON, etc.) — fail-closed is the right default for a gate.
 */
export function readMcpAllowWrites(): boolean {
  const file = path.join(resolveUserDataDir(), "settings.json");
  if (!existsSync(file)) return false;
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as ScribeSettings;
    return parsed.mcp_allow_writes === true;
  } catch {
    return false;
  }
}

export class McpWritesDisabledError extends Error {
  constructor() {
    super(
      "Writes are disabled. Open Scribe → Settings → Intégration Claude and turn on \"Autoriser Claude à modifier\".",
    );
    this.name = "McpWritesDisabledError";
  }
}

// --- Audit log ------------------------------------------------------------

function logPath(): string {
  return path.join(resolveUserDataDir(), "logs", "mcp.log");
}

export interface AuditEntry {
  tool: string;
  args?: Record<string, unknown>;
  status: "ok" | "denied" | "error";
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
}

export function appendAudit(entry: AuditEntry): void {
  const line =
    JSON.stringify({ ts: Date.now(), ...entry }, (_k, v) =>
      // Trim verbose fields so the log stays scannable.
      typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "…" : v,
    ) + "\n";
  try {
    mkdirSync(path.dirname(logPath()), { recursive: true });
    appendFileSync(logPath(), line, "utf8");
  } catch {
    // Audit log failures must not block writes — surfacing them would
    // be worse than losing a log line.
  }
}

// --- Writable DB handle ---------------------------------------------------

let writeDb: DatabaseSync | null = null;

function getWriteDb(): DatabaseSync {
  if (writeDb) return writeDb;
  const file = resolveDbPath();
  if (!existsSync(file)) {
    throw new Error(`Scribe database not found at ${file}.`);
  }
  // Default open mode = read+write. Same file the app uses; WAL handles
  // concurrent access. Foreign keys ON so cascades work the same way as
  // in the app.
  writeDb = new DatabaseSync(file);
  writeDb.exec("PRAGMA foreign_keys = ON;");
  return writeDb;
}

function prepW(key: string, sql: string): StatementSync {
  let s = writeStmts[key];
  if (!s) {
    s = getWriteDb().prepare(sql);
    writeStmts[key] = s;
  }
  return s;
}
const writeStmts: Record<string, StatementSync> = {};

/**
 * Atomic transaction wrapper. Used to make bulk write operations all-or-
 * nothing — if any individual write throws, the whole batch is rolled
 * back. node:sqlite has no built-in `db.transaction(fn)` helper (unlike
 * better-sqlite3), so we drive BEGIN/COMMIT/ROLLBACK manually.
 */
export function transaction<T>(fn: () => T): T {
  const db = getWriteDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* swallow rollback errors so we surface the original cause */
    }
    throw e;
  }
}

// --- Summary --------------------------------------------------------------

export interface SummaryInput {
  executive_summary: Array<{ topic: string; detail: string }>;
  full_summary: string;
  sections?: Array<{ title: string; content: string }>;
  decisions?: string[];
}

export function setSummary(meetingId: string, summary: SummaryInput): void {
  // Mirror the shape the Electron app writes via setSummary() in db.ts so
  // the renderer's MeetingSummary parser stays happy.
  const payload = JSON.stringify({
    executive_summary: summary.executive_summary,
    full_summary: summary.full_summary,
    sections: summary.sections ?? [],
    decisions: summary.decisions ?? [],
    generated_at_ms: Date.now(),
  });
  prepW(
    "setSummary",
    "UPDATE meetings SET summary_json = ? WHERE id = ?",
  ).run(payload, meetingId);
}

// --- Status + pipeline ----------------------------------------------------
//
// Mirror electron/services/db.ts setStatus() and updatePipeline(). The MCP
// `set_summary` tool uses these to flip a meeting to the terminal `done`
// state and stamp a notes badge in the same transaction — so "processed via
// Claude over MCP" is a real end state instead of a row stuck at `diarized`
// with an orphan summary.

export function setStatus(meetingId: string, status: MeetingStatus): void {
  prepW(
    "setStatus",
    "UPDATE meetings SET status = ? WHERE id = ?",
  ).run(status, meetingId);
}

/**
 * Read-modify-write merge into pipeline_json, same semantics as the app's
 * updatePipeline(): keys already on the row (e.g. notes_usage written by the
 * in-app pipeline) are preserved unless the patch overwrites them. Passing a
 * key as `undefined` clears it — JSON.stringify drops undefined values.
 */
export function updatePipeline(
  meetingId: string,
  patch: Partial<Pipeline>,
): void {
  const row = prepW(
    "getPipelineJson",
    "SELECT pipeline_json FROM meetings WHERE id = ?",
  ).get(meetingId) as { pipeline_json: string | null } | undefined;
  let current: Pipeline = {};
  if (row?.pipeline_json) {
    try {
      current = JSON.parse(row.pipeline_json) as Pipeline;
    } catch {
      current = {};
    }
  }
  const next: Pipeline = { ...current, ...patch };
  prepW(
    "updatePipeline",
    "UPDATE meetings SET pipeline_json = ? WHERE id = ?",
  ).run(JSON.stringify(next), meetingId);
}

// --- Meeting title --------------------------------------------------------

export function setMeetingTitle(meetingId: string, title: string): void {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("title must not be empty");
  prepW(
    "setMeetingTitle",
    "UPDATE meetings SET title = ? WHERE id = ?",
  ).run(trimmed, meetingId);
}

// --- Key points (bullets) -------------------------------------------------

/**
 * Replace a meeting's condensed "key points". Pass an array of bullet
 * strings (inline markdown allowed); empty entries are dropped and an empty
 * result clears the column. Mirrors the bullets_json the Electron notes pass
 * writes via setBullets() in electron/services/db.ts.
 */
export function setBullets(meetingId: string, bullets: string[]): void {
  const cleaned = bullets.map((b) => b.trim()).filter((b) => b.length > 0);
  prepW(
    "setBullets",
    "UPDATE meetings SET bullets_json = ? WHERE id = ?",
  ).run(cleaned.length > 0 ? JSON.stringify(cleaned) : null, meetingId);
}

// --- Scratch pad ----------------------------------------------------------

/** Replace a meeting's free-form scratch pad text. Empty string clears it. */
export function setScratchpad(meetingId: string, text: string): void {
  prepW(
    "setScratchpad",
    "UPDATE meetings SET scratchpad = ? WHERE id = ?",
  ).run(text.length > 0 ? text : null, meetingId);
}

// --- Tasks (action items) -------------------------------------------------

export function addActionItem(opts: {
  meetingId: string;
  text: string;
  assigneeSpeakerId?: string | null;
}): TaskRow {
  const text = opts.text.trim();
  if (!text) throw new Error("action item text must not be empty");
  // Validate the speaker belongs to this meeting — keeps the task table
  // consistent with the speakers table the way the app does.
  if (opts.assigneeSpeakerId) {
    const check = prepW(
      "checkSpeakerInMeeting",
      "SELECT 1 FROM speakers WHERE meeting_id = ? AND speaker_id = ?",
    ).get(opts.meetingId, opts.assigneeSpeakerId);
    if (!check) {
      throw new Error(
        `speaker ${opts.assigneeSpeakerId} not found in meeting ${opts.meetingId}`,
      );
    }
  }
  const now = Date.now();
  const res = prepW(
    "insertTask",
    `INSERT INTO tasks (meeting_id, assignee_speaker_id, text, done, created_at_ms)
     VALUES (?, ?, ?, 0, ?)`,
  ).run(opts.meetingId, opts.assigneeSpeakerId ?? null, text, now);
  const id = Number(res.lastInsertRowid);
  return {
    id,
    meeting_id: opts.meetingId,
    assignee_speaker_id: opts.assigneeSpeakerId ?? null,
    text,
    done: 0,
    created_at_ms: now,
  };
}

export function setActionItemDone(taskId: number, done: boolean): void {
  prepW(
    "setTaskDone",
    "UPDATE tasks SET done = ? WHERE id = ?",
  ).run(done ? 1 : 0, taskId);
}

export function deleteActionItem(taskId: number): void {
  prepW("deleteTask", "DELETE FROM tasks WHERE id = ?").run(taskId);
}

export function getTask(taskId: number): TaskRow | null {
  const row = prepW("getTask", "SELECT * FROM tasks WHERE id = ?").get(taskId);
  return (row as TaskRow | undefined) ?? null;
}

// --- Tags -----------------------------------------------------------------

export function findOrCreateTag(name: string): TagRow {
  const trimmed = name.trim().replace(/^#+/, "");
  if (!trimmed) throw new Error("tag name must not be empty");
  // Existing tag (case-insensitive match, same as the app)
  const existing = prepW(
    "findTagByName",
    "SELECT * FROM tags WHERE name = ? COLLATE NOCASE LIMIT 1",
  ).get(trimmed) as TagRow | undefined;
  if (existing) return existing;
  const id = randomUUID();
  const now = Date.now();
  prepW(
    "insertTag",
    `INSERT INTO tags (id, name, color, auto, created_at_ms)
     VALUES (?, ?, NULL, 0, ?)`,
  ).run(id, trimmed, now);
  return {
    id,
    name: trimmed,
    color: null,
    auto: 0,
    created_at_ms: now,
  };
}

export function attachTagToMeeting(meetingId: string, tagId: string): void {
  // INSERT OR IGNORE matches the app's idempotent behaviour. auto = 0
  // because Claude is acting on the user's behalf — not the diarisation
  // auto-tag pipeline, which is reserved for the LLM tag-attach flow.
  prepW(
    "attachTag",
    `INSERT OR IGNORE INTO meeting_tags (meeting_id, tag_id, auto)
     VALUES (?, ?, 0)`,
  ).run(meetingId, tagId);
}

export function detachTagFromMeeting(meetingId: string, tagId: string): void {
  prepW(
    "detachTag",
    "DELETE FROM meeting_tags WHERE meeting_id = ? AND tag_id = ?",
  ).run(meetingId, tagId);
}

// --- Speakers -------------------------------------------------------------

export function renameSpeaker(opts: {
  meetingId: string;
  speakerId: string;
  displayName: string;
}): void {
  const name = opts.displayName.trim();
  if (!name) throw new Error("display_name must not be empty");
  prepW(
    "renameSpeaker",
    "UPDATE speakers SET display_name = ? WHERE meeting_id = ? AND speaker_id = ?",
  ).run(name, opts.meetingId, opts.speakerId);
}
