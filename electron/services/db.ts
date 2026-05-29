import { app } from "electron";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { broadcastTreeInvalidated } from "./broadcast.js";

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
  /** Per-meeting override of the notes template. Null = use the global
   *  default at generation time. Persisted so regeneration reuses the same
   *  template, and so the UI can show the user's pick before generation. */
  notes_template_id: string | null;
  /** Condensed "key points" — a JSON array of strings (each a bullet, inline
   *  markdown allowed). Produced by the notes LLM pass alongside the summary;
   *  also settable via the MCP `set_bullets` tool. Null = not generated. */
  bullets_json: string | null;
  /** Free-form user scratch pad (plain markdown text). User-owned; never
   *  touched by the LLM pipeline. Settable in-app and via MCP `set_scratchpad`. */
  scratchpad: string | null;
}

export interface Pipeline {
  transcribe?: string;
  align?: string;
  diarize?: string;
  notes?: string;
  /** Recorded after generation so the meeting header can display which
   *  template was actually used (id for re-selection, name for the badge). */
  notes_template_id?: string;
  notes_template_name?: string;
  /** Per-meeting usage report from the LLM provider — token counts, derived
   *  cost, session id, etc. Only populated for providers that expose this
   *  (anthropic API, claude-code CLI). */
  notes_usage?: NotesUsage;
}

export interface NotesUsage {
  cost_usd?: number;
  model?: string;
  session_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  duration_ms?: number;
  num_turns?: number;
  billing_kind?: "subscription" | "metered";
  tools_used?: Array<{ name: string; target?: string }>;
  calls?: NotesCallUsage[];
}

export interface NotesCallUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  tools_used?: Array<{ name: string; target?: string }>;
}

export interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  position: number;
  created_at_ms: number;
  /**
   * Optional. When set, any meeting tagged with this tag is auto-moved into
   * this folder (on attach). Used to keep tagged work organized without the
   * user having to drag meetings around. Null = no association.
   */
  auto_tag_id: string | null;
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

export interface VoiceLibraryRow {
  id: string;
  display_name: string;
  email: string | null;
  /** 1 for the single person representing the app user ("you"), else 0. */
  is_me: 0 | 1;
  dim: number;
  sample_clip_path: string | null;
  n_meetings: number;
  created_at_ms: number;
  updated_at_ms: number;
}

/** One voice fingerprint of a person. A person may hold several (capped by
 *  the matcher) so the same voice matches across different acoustic setups. */
export interface PersonCentroid {
  embedding: Float32Array;
  nSamples: number;
}

/** A library person bundled with all of its centroids — the unit the matcher
 *  scores against (similarity = max over the person's centroids). */
export interface PersonWithCentroids {
  id: string;
  display_name: string;
  email: string | null;
  sample_clip_path: string | null;
  centroids: PersonCentroid[];
}

/**
 * VoiceLibraryRow enriched with "where did we last hear them" stats for the
 * People view. `last_heard_ms`/`last_meeting_*` are null for library entries
 * that haven't been linked back to a per-meeting speaker yet (e.g. an entry
 * that was renamed but never appeared in a subsequent meeting).
 */
export interface VoiceLibraryPerson extends VoiceLibraryRow {
  last_heard_ms: number | null;
  last_meeting_id: string | null;
  last_meeting_title: string | null;
}

export interface TaskRow {
  id: number;
  meeting_id: string;
  assignee_speaker_id: string | null;
  text: string;
  done: 0 | 1;
  /** 0 = none, 1 = low, 2 = medium, 3 = high. */
  priority: number;
  due_at_ms: number | null;
  created_at_ms: number;
}

export interface TagRow {
  id: string;
  name: string;
  color: string | null;
  auto: 0 | 1;
  created_at_ms: number;
}

export interface MeetingTagRow {
  meeting_id: string;
  tag_id: string;
  auto: 0 | 1;
}

export interface PersonalTaskRow {
  id: number;
  text: string;
  done: 0 | 1;
  due_at_ms: number | null;
  created_at_ms: number;
}

export interface CalendarAccountRow {
  id: string;
  provider: "google";
  email: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at_ms: number | null;
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

let db: DatabaseSync | null = null;
const stmts: Record<string, StatementSync> = {};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  auto_tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id, position);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled meeting',
  started_at_ms INTEGER NOT NULL,
  ended_at_ms INTEGER,
  mic_wav_path TEXT,
  sys_wav_path TEXT,
  status TEXT NOT NULL CHECK(status IN ('recording','recorded','transcribing','transcribed','diarized','done','error')),
  duration_ms INTEGER,
  summary_json TEXT,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_meetings_started_at ON meetings(started_at_ms DESC);

CREATE TABLE IF NOT EXISTS transcripts (
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  segment_idx INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  speaker_id TEXT,
  text TEXT NOT NULL,
  PRIMARY KEY (meeting_id, segment_idx)
);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_time ON transcripts(meeting_id, start_ms);

CREATE TABLE IF NOT EXISTS speakers (
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  embedding BLOB,
  PRIMARY KEY (meeting_id, speaker_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  assignee_speaker_id TEXT,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting ON tasks(meeting_id);

CREATE TABLE IF NOT EXISTS voice_library (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  is_me INTEGER NOT NULL DEFAULT 0,
  embedding BLOB NOT NULL,
  dim INTEGER NOT NULL,
  sample_clip_path TEXT,
  n_meetings INTEGER NOT NULL DEFAULT 1,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voice_library_name ON voice_library(display_name);

-- Per-person voice fingerprints. A person can hold several centroids so we
-- can match the same voice across different acoustic conditions (laptop mic
-- vs headset vs phone) instead of blurring them into one mean that matches
-- none of them well. A person with zero centroids is simply not yet
-- voice-matchable (replaces the old dim=0 placeholder hack).
CREATE TABLE IF NOT EXISTS voice_centroids (
  library_id TEXT NOT NULL REFERENCES voice_library(id) ON DELETE CASCADE,
  centroid_idx INTEGER NOT NULL,
  embedding BLOB NOT NULL,
  dim INTEGER NOT NULL,
  n_samples INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (library_id, centroid_idx)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  auto INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_tags (
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  auto INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meeting_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_tags_tag ON meeting_tags(tag_id);

CREATE TABLE IF NOT EXISTS personal_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  due_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_done ON personal_tasks(done);

CREATE TABLE IF NOT EXISTS calendar_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expires_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES calendar_accounts(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at_ms INTEGER NOT NULL,
  end_at_ms INTEGER NOT NULL,
  hangout_link TEXT,
  attendees_json TEXT,
  meeting_id TEXT REFERENCES meetings(id) ON DELETE SET NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE (account_id, source_event_id)
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at_ms);

CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
  meeting_id UNINDEXED,
  segment_idx UNINDEXED,
  text,
  tokenize = 'porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS transcripts_ai AFTER INSERT ON transcripts BEGIN
  INSERT INTO transcripts_fts(meeting_id, segment_idx, text)
  VALUES (new.meeting_id, new.segment_idx, new.text);
END;

CREATE TRIGGER IF NOT EXISTS transcripts_ad AFTER DELETE ON transcripts BEGIN
  DELETE FROM transcripts_fts
   WHERE meeting_id = old.meeting_id AND segment_idx = old.segment_idx;
END;

CREATE TRIGGER IF NOT EXISTS transcripts_au AFTER UPDATE ON transcripts BEGIN
  DELETE FROM transcripts_fts
   WHERE meeting_id = old.meeting_id AND segment_idx = old.segment_idx;
  INSERT INTO transcripts_fts(meeting_id, segment_idx, text)
  VALUES (new.meeting_id, new.segment_idx, new.text);
END;
`;

export function initDb(): DatabaseSync {
  if (db) return db;
  const dir = path.join(app.getPath("userData"), "data");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "scribe.db");
  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  // Idempotent migrations for existing DBs
  const meetingCols = db
    .prepare("PRAGMA table_info(meetings)")
    .all() as Array<{ name: string }>;
  const hasCol = (n: string) => meetingCols.some((c) => c.name === n);
  if (!hasCol("summary_json")) {
    db.exec("ALTER TABLE meetings ADD COLUMN summary_json TEXT");
  }
  if (!hasCol("folder_id")) {
    db.exec(
      "ALTER TABLE meetings ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL",
    );
  }
  if (!hasCol("position")) {
    db.exec("ALTER TABLE meetings ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasCol("pinned")) {
    db.exec("ALTER TABLE meetings ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasCol("pipeline_json")) {
    db.exec("ALTER TABLE meetings ADD COLUMN pipeline_json TEXT");
  }
  if (!hasCol("notes_template_id")) {
    db.exec("ALTER TABLE meetings ADD COLUMN notes_template_id TEXT");
  }
  if (!hasCol("bullets_json")) {
    db.exec("ALTER TABLE meetings ADD COLUMN bullets_json TEXT");
  }
  if (!hasCol("scratchpad")) {
    db.exec("ALTER TABLE meetings ADD COLUMN scratchpad TEXT");
  }
  const folderCols = db
    .prepare("PRAGMA table_info(folders)")
    .all() as Array<{ name: string }>;
  if (!folderCols.some((c) => c.name === "auto_tag_id")) {
    db.exec(
      "ALTER TABLE folders ADD COLUMN auto_tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL",
    );
  }
  // Indexes that reference columns added by migrations must run after the ALTERs
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_meetings_folder ON meetings(folder_id, position);",
  );
  // Lookups by auto_tag_id fire on every tag-attach — keep it indexed.
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_folders_auto_tag ON folders(auto_tag_id);",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_meetings_pinned ON meetings(pinned) WHERE pinned = 1;",
  );

  // Speaker columns added for voice-library matching.
  const speakerCols = db
    .prepare("PRAGMA table_info(speakers)")
    .all() as Array<{ name: string }>;
  const hasSpeakerCol = (n: string) => speakerCols.some((c) => c.name === n);
  if (!hasSpeakerCol("sample_clip_path")) {
    db.exec("ALTER TABLE speakers ADD COLUMN sample_clip_path TEXT");
  }
  if (!hasSpeakerCol("voice_library_id")) {
    db.exec(
      "ALTER TABLE speakers ADD COLUMN voice_library_id TEXT REFERENCES voice_library(id) ON DELETE SET NULL",
    );
  }
  if (!hasSpeakerCol("match_confidence")) {
    db.exec("ALTER TABLE speakers ADD COLUMN match_confidence REAL");
  }
  if (!hasSpeakerCol("needs_review")) {
    db.exec(
      "ALTER TABLE speakers ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0",
    );
  }
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_speakers_voice_lib ON speakers(voice_library_id);",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_speakers_review ON speakers(meeting_id, needs_review);",
  );

  // Voice library: optional email so a person carries a stable identity that
  // calendar invitees match against (name matching alone is too fragile).
  const voiceLibCols = db
    .prepare("PRAGMA table_info(voice_library)")
    .all() as Array<{ name: string }>;
  if (!voiceLibCols.some((c) => c.name === "email")) {
    db.exec("ALTER TABLE voice_library ADD COLUMN email TEXT");
  }
  // Self-identity flag: exactly one person can carry is_me=1 ("you"). Set
  // manually in the People view or auto-detected from the connected calendar
  // account email (see reconcileMeFromCalendar).
  if (!voiceLibCols.some((c) => c.name === "is_me")) {
    db.exec(
      "ALTER TABLE voice_library ADD COLUMN is_me INTEGER NOT NULL DEFAULT 0",
    );
  }
  // Created here (not in SCHEMA) so it runs after the column is guaranteed to
  // exist on both fresh and migrated DBs.
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_voice_library_email ON voice_library(email);",
  );
  // Seed the multi-centroid table from each person's legacy single embedding
  // (centroid 0) so voices stay matchable after the upgrade. Idempotent:
  // skips people who already have centroids, and placeholders (dim=0).
  db.exec(
    `INSERT INTO voice_centroids (library_id, centroid_idx, embedding, dim, n_samples)
       SELECT vl.id, 0, vl.embedding, vl.dim, MAX(vl.n_meetings, 1)
         FROM voice_library vl
        WHERE vl.dim > 0
          AND NOT EXISTS (
            SELECT 1 FROM voice_centroids c WHERE c.library_id = vl.id
          )`,
  );

  // Meeting action items gained priority + due date (task-manager redesign).
  const taskCols = db
    .prepare("PRAGMA table_info(tasks)")
    .all() as Array<{ name: string }>;
  if (!taskCols.some((c) => c.name === "priority")) {
    db.exec("ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0");
  }
  if (!taskCols.some((c) => c.name === "due_at_ms")) {
    db.exec("ALTER TABLE tasks ADD COLUMN due_at_ms INTEGER");
  }

  // Title + tag prefix search — NOCASE so case-insensitive LIKE 'foo%' uses
  // the index. (Substring search `%foo%` still goes through FTS5.)
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_meetings_title_nocase ON meetings(title COLLATE NOCASE);",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_tags_name_nocase ON tags(name COLLATE NOCASE);",
  );

  // Backfill FTS for any rows that existed before the FTS index was added.
  // One-time per existing meeting — subsequent writes are kept in sync by
  // triggers.
  const ftsCount = (
    db.prepare(`SELECT count(*) AS n FROM transcripts_fts`).get() as { n: number }
  ).n;
  const transcriptCount = (
    db.prepare(`SELECT count(*) AS n FROM transcripts`).get() as { n: number }
  ).n;
  if (ftsCount === 0 && transcriptCount > 0) {
    db.exec(
      `INSERT INTO transcripts_fts(meeting_id, segment_idx, text)
         SELECT meeting_id, segment_idx, text FROM transcripts`,
    );
  }

  stmts.insertMeeting = db.prepare(
    `INSERT INTO meetings (id, title, started_at_ms, status) VALUES (?, ?, ?, 'recording')`,
  );
  stmts.finalizeMeeting = db.prepare(
    `UPDATE meetings
       SET ended_at_ms = ?,
           duration_ms = ?,
           mic_wav_path = ?,
           sys_wav_path = ?,
           status = 'recorded'
     WHERE id = ?`,
  );
  stmts.setStatus = db.prepare(
    `UPDATE meetings SET status = ? WHERE id = ?`,
  );
  stmts.setTitle = db.prepare(
    `UPDATE meetings SET title = ? WHERE id = ?`,
  );
  stmts.setSummary = db.prepare(
    `UPDATE meetings SET summary_json = ? WHERE id = ?`,
  );
  stmts.setBullets = db.prepare(
    `UPDATE meetings SET bullets_json = ? WHERE id = ?`,
  );
  stmts.setScratchpad = db.prepare(
    `UPDATE meetings SET scratchpad = ? WHERE id = ?`,
  );
  stmts.getMeeting = db.prepare(`SELECT * FROM meetings WHERE id = ?`);
  stmts.listMeetings = db.prepare(
    `SELECT * FROM meetings ORDER BY started_at_ms DESC`,
  );
  stmts.deleteMeeting = db.prepare(`DELETE FROM meetings WHERE id = ?`);

  stmts.insertTranscript = db.prepare(
    `INSERT OR REPLACE INTO transcripts
       (meeting_id, segment_idx, start_ms, end_ms, speaker_id, text)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  stmts.listTranscripts = db.prepare(
    `SELECT * FROM transcripts WHERE meeting_id = ? ORDER BY start_ms ASC`,
  );
  stmts.updateTranscriptSpeaker = db.prepare(
    `UPDATE transcripts SET speaker_id = ? WHERE meeting_id = ? AND segment_idx = ?`,
  );

  stmts.upsertSpeaker = db.prepare(
    `INSERT INTO speakers (meeting_id, speaker_id, display_name)
     VALUES (?, ?, ?)
     ON CONFLICT(meeting_id, speaker_id) DO UPDATE SET display_name = excluded.display_name`,
  );
  stmts.listSpeakers = db.prepare(
    `SELECT meeting_id, speaker_id, display_name, sample_clip_path,
            voice_library_id, match_confidence, needs_review
       FROM speakers WHERE meeting_id = ?`,
  );
  stmts.updateSpeakerEmbedding = db.prepare(
    `UPDATE speakers
        SET embedding = ?, sample_clip_path = ?
      WHERE meeting_id = ? AND speaker_id = ?`,
  );
  stmts.updateSpeakerMatch = db.prepare(
    `UPDATE speakers
        SET voice_library_id = ?,
            match_confidence = ?,
            needs_review = ?,
            display_name = ?
      WHERE meeting_id = ? AND speaker_id = ?`,
  );
  stmts.getSpeakerEmbedding = db.prepare(
    `SELECT embedding, sample_clip_path FROM speakers
      WHERE meeting_id = ? AND speaker_id = ?`,
  );

  // Voice library
  stmts.listVoiceLibrary = db.prepare(
    `SELECT id, display_name, email, is_me, dim, sample_clip_path, n_meetings,
            created_at_ms, updated_at_ms
       FROM voice_library
       ORDER BY display_name ASC`,
  );
  // People view query: each row joins to its most recent appearance in a
  // meeting. Correlated subqueries are fine here — idx_speakers_voice_lib
  // keeps the per-row lookup at O(log n), and this query only runs on the
  // People page open (not on every detail refresh).
  stmts.listVoiceLibraryWithStats = db.prepare(
    `SELECT vl.id, vl.display_name, vl.email, vl.is_me, vl.dim, vl.sample_clip_path,
            (SELECT COUNT(DISTINCT s.meeting_id)
               FROM speakers s
              WHERE s.voice_library_id = vl.id) AS n_meetings,
            vl.created_at_ms, vl.updated_at_ms,
            (SELECT MAX(m.started_at_ms)
               FROM speakers s
               JOIN meetings m ON m.id = s.meeting_id
              WHERE s.voice_library_id = vl.id) AS last_heard_ms,
            (SELECT s.meeting_id
               FROM speakers s
               JOIN meetings m ON m.id = s.meeting_id
              WHERE s.voice_library_id = vl.id
              ORDER BY m.started_at_ms DESC LIMIT 1) AS last_meeting_id,
            (SELECT m.title
               FROM speakers s
               JOIN meetings m ON m.id = s.meeting_id
              WHERE s.voice_library_id = vl.id
              ORDER BY m.started_at_ms DESC LIMIT 1) AS last_meeting_title
       FROM voice_library vl
       ORDER BY COALESCE(
         (SELECT MAX(m.started_at_ms)
            FROM speakers s
            JOIN meetings m ON m.id = s.meeting_id
           WHERE s.voice_library_id = vl.id),
         vl.updated_at_ms
       ) DESC`,
  );
  stmts.insertVoiceLibrary = db.prepare(
    `INSERT INTO voice_library
       (id, display_name, email, embedding, dim, sample_clip_path,
        n_meetings, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  );
  // Bump the per-person meeting counter + touch timestamp whenever a new
  // observation is folded in (auto-match or manual assign).
  stmts.touchVoiceLibrary = db.prepare(
    `UPDATE voice_library
        SET n_meetings = n_meetings + 1,
            updated_at_ms = ?
      WHERE id = ?`,
  );
  // Backfill an email only when the person doesn't already have one — never
  // clobber a confirmed address with a guess from a later meeting.
  stmts.setVoiceLibraryEmail = db.prepare(
    `UPDATE voice_library
        SET email = ?, updated_at_ms = ?
      WHERE id = ? AND (email IS NULL OR email = '')`,
  );
  // Unconditional overwrite (incl. clearing to NULL) — for explicit manual
  // edits in the People view, which must be able to correct/remove an address.
  stmts.setVoiceLibraryEmailForce = db.prepare(
    `UPDATE voice_library
        SET email = ?, updated_at_ms = ?
      WHERE id = ?`,
  );
  stmts.renameVoiceLibrary = db.prepare(
    `UPDATE voice_library SET display_name = ?, updated_at_ms = ? WHERE id = ?`,
  );
  stmts.deleteVoiceLibrary = db.prepare(
    `DELETE FROM voice_library WHERE id = ?`,
  );

  // Self-identity ("you"). clearMe + setMeById run together in a transaction
  // to keep the one-person-only invariant. Being "me" doesn't bump
  // updated_at_ms — it shouldn't reorder the People list.
  stmts.clearMe = db.prepare(
    `UPDATE voice_library SET is_me = 0 WHERE is_me = 1`,
  );
  stmts.setMeById = db.prepare(
    `UPDATE voice_library SET is_me = 1 WHERE id = ?`,
  );
  stmts.getMeId = db.prepare(
    `SELECT id FROM voice_library WHERE is_me = 1 LIMIT 1`,
  );

  // Centroids — the matcher's source of truth for a person's voice.
  stmts.listAllCentroids = db.prepare(
    `SELECT library_id, centroid_idx, embedding, dim, n_samples
       FROM voice_centroids`,
  );
  stmts.listCentroidsForPerson = db.prepare(
    `SELECT centroid_idx, embedding, dim, n_samples
       FROM voice_centroids WHERE library_id = ?`,
  );
  stmts.insertCentroid = db.prepare(
    `INSERT INTO voice_centroids
       (library_id, centroid_idx, embedding, dim, n_samples)
     VALUES (?, ?, ?, ?, ?)`,
  );
  stmts.updateCentroid = db.prepare(
    `UPDATE voice_centroids
        SET embedding = ?, n_samples = ?
      WHERE library_id = ? AND centroid_idx = ?`,
  );

  // Tags + meeting_tags
  stmts.listTags = db.prepare(
    `SELECT id, name, color, auto, created_at_ms FROM tags ORDER BY name ASC`,
  );
  stmts.insertTag = db.prepare(
    `INSERT INTO tags (id, name, color, auto, created_at_ms) VALUES (?, ?, ?, ?, ?)`,
  );
  stmts.findTagByName = db.prepare(
    `SELECT id, name, color, auto, created_at_ms FROM tags WHERE name = ? COLLATE NOCASE`,
  );
  stmts.renameTag = db.prepare(
    `UPDATE tags SET name = ? WHERE id = ?`,
  );
  stmts.deleteTag = db.prepare(
    `DELETE FROM tags WHERE id = ?`,
  );
  stmts.attachTag = db.prepare(
    `INSERT OR IGNORE INTO meeting_tags (meeting_id, tag_id, auto) VALUES (?, ?, ?)`,
  );
  stmts.detachTag = db.prepare(
    `DELETE FROM meeting_tags WHERE meeting_id = ? AND tag_id = ?`,
  );
  stmts.listTagsForMeeting = db.prepare(
    `SELECT t.id, t.name, t.color, mt.auto AS auto, t.created_at_ms
       FROM meeting_tags mt
       JOIN tags t ON t.id = mt.tag_id
      WHERE mt.meeting_id = ?
      ORDER BY t.name ASC`,
  );
  stmts.clearAutoTagsForMeeting = db.prepare(
    `DELETE FROM meeting_tags WHERE meeting_id = ? AND auto = 1`,
  );
  stmts.listMeetingTagPairs = db.prepare(
    `SELECT meeting_id, tag_id FROM meeting_tags`,
  );

  // Personal tasks
  stmts.listPersonalTasks = db.prepare(
    `SELECT id, text, done, due_at_ms, created_at_ms
       FROM personal_tasks ORDER BY done ASC, COALESCE(due_at_ms, created_at_ms) ASC`,
  );
  stmts.insertPersonalTask = db.prepare(
    `INSERT INTO personal_tasks (text, done, due_at_ms, created_at_ms)
     VALUES (?, 0, ?, ?)`,
  );
  stmts.setPersonalTaskDone = db.prepare(
    `UPDATE personal_tasks SET done = ? WHERE id = ?`,
  );
  stmts.deletePersonalTask = db.prepare(
    `DELETE FROM personal_tasks WHERE id = ?`,
  );
  stmts.setPersonalTaskText = db.prepare(
    `UPDATE personal_tasks SET text = ?, due_at_ms = ? WHERE id = ?`,
  );

  // Calendar accounts
  stmts.listCalendarAccounts = db.prepare(
    `SELECT id, provider, email, access_token_enc, refresh_token_enc,
            token_expires_at_ms, created_at_ms, updated_at_ms
       FROM calendar_accounts ORDER BY created_at_ms ASC`,
  );
  stmts.insertCalendarAccount = db.prepare(
    `INSERT INTO calendar_accounts
       (id, provider, email, access_token_enc, refresh_token_enc,
        token_expires_at_ms, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  stmts.updateCalendarAccountTokens = db.prepare(
    `UPDATE calendar_accounts
        SET access_token_enc = ?, refresh_token_enc = ?,
            token_expires_at_ms = ?, updated_at_ms = ?
      WHERE id = ?`,
  );
  stmts.deleteCalendarAccount = db.prepare(
    `DELETE FROM calendar_accounts WHERE id = ?`,
  );
  stmts.getCalendarAccount = db.prepare(
    `SELECT id, provider, email, access_token_enc, refresh_token_enc,
            token_expires_at_ms, created_at_ms, updated_at_ms
       FROM calendar_accounts WHERE id = ?`,
  );

  // Calendar events
  stmts.listCalendarEvents = db.prepare(
    `SELECT id, account_id, source_event_id, title, description, location,
            start_at_ms, end_at_ms, hangout_link, attendees_json, meeting_id,
            updated_at_ms
       FROM calendar_events
      WHERE start_at_ms >= ? AND start_at_ms <= ?
      ORDER BY start_at_ms ASC`,
  );
  stmts.upsertCalendarEvent = db.prepare(
    `INSERT INTO calendar_events
       (id, account_id, source_event_id, title, description, location,
        start_at_ms, end_at_ms, hangout_link, attendees_json, meeting_id, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, source_event_id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       location = excluded.location,
       start_at_ms = excluded.start_at_ms,
       end_at_ms = excluded.end_at_ms,
       hangout_link = excluded.hangout_link,
       attendees_json = excluded.attendees_json,
       updated_at_ms = excluded.updated_at_ms`,
  );
  stmts.linkCalendarEventMeeting = db.prepare(
    `UPDATE calendar_events SET meeting_id = ? WHERE id = ?`,
  );

  stmts.insertTask = db.prepare(
    `INSERT INTO tasks (meeting_id, assignee_speaker_id, text, done, created_at_ms)
     VALUES (?, ?, ?, 0, ?)`,
  );
  stmts.listTasks = db.prepare(
    `SELECT * FROM tasks WHERE meeting_id = ? ORDER BY id ASC`,
  );
  stmts.setTaskDone = db.prepare(
    `UPDATE tasks SET done = ? WHERE id = ?`,
  );
  stmts.deleteTasksForMeeting = db.prepare(
    `DELETE FROM tasks WHERE meeting_id = ?`,
  );
  stmts.getTask = db.prepare(`SELECT * FROM tasks WHERE id = ?`);
  stmts.insertTaskFull = db.prepare(
    `INSERT INTO tasks (meeting_id, assignee_speaker_id, text, done, priority, due_at_ms, created_at_ms)
     VALUES (?, ?, ?, 0, ?, ?, ?)`,
  );
  stmts.setTaskPriority = db.prepare(
    `UPDATE tasks SET priority = ? WHERE id = ?`,
  );
  stmts.setTaskDueDate = db.prepare(
    `UPDATE tasks SET due_at_ms = ? WHERE id = ?`,
  );
  stmts.setTaskAssignee = db.prepare(
    `UPDATE tasks SET assignee_speaker_id = ? WHERE id = ?`,
  );
  stmts.updateTaskText = db.prepare(`UPDATE tasks SET text = ? WHERE id = ?`);
  stmts.deleteTask = db.prepare(`DELETE FROM tasks WHERE id = ?`);

  // Auto-detect "you" from the connected calendar account on every boot
  // (no-op once someone is marked, or when no account/match exists).
  reconcileMeFromCalendar();

  return db;
}

/**
 * Run `fn` inside a SQLite transaction. Commits on return, rolls back on
 * throw. Batching dozens of small writes (e.g. inserting tags + tasks after
 * an LLM run) inside a single transaction is ~50–100× faster than the same
 * writes one statement at a time under WAL.
 */
export function transaction<T>(fn: () => T): T {
  const db = initDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore rollback failure — original error is more important */
    }
    throw err;
  }
}

export function createMeeting(opts: {
  id: string;
  title?: string;
  startedAtMs: number;
}): void {
  initDb();
  stmts.insertMeeting.run(opts.id, opts.title ?? "Untitled meeting", opts.startedAtMs);
  broadcastTreeInvalidated();
}

export function finalizeMeeting(opts: {
  id: string;
  endedAtMs: number;
  durationMs: number;
  micWavPath: string | null;
  sysWavPath: string | null;
}): void {
  initDb();
  stmts.finalizeMeeting.run(
    opts.endedAtMs,
    opts.durationMs,
    opts.micWavPath,
    opts.sysWavPath,
    opts.id,
  );
  broadcastTreeInvalidated();
}

export function setStatus(id: string, status: MeetingStatus): void {
  initDb();
  stmts.setStatus.run(status, id);
  broadcastTreeInvalidated();
}

export function setTitle(id: string, title: string): void {
  initDb();
  stmts.setTitle.run(title, id);
  broadcastTreeInvalidated();
}

/**
 * True if the meeting's title still looks like the auto-generated default.
 * Used by the auto-linker to know it's safe to overwrite the title with the
 * calendar event's summary without clobbering a user-typed name.
 */
export function isMeetingTitleAutoGenerated(id: string): boolean {
  const m = getMeeting(id);
  if (!m) return false;
  const t = m.title.trim();
  return t === "" || t.toLowerCase() === "untitled meeting";
}

export function setSummary(id: string, summaryJson: string | null): void {
  initDb();
  stmts.setSummary.run(summaryJson, id);
  broadcastTreeInvalidated();
}

/**
 * Replace the condensed "key points" list. Pass a JSON-serialized array of
 * strings, or null to clear. Written by the notes LLM pass and by the MCP
 * `set_bullets` tool.
 */
export function setBullets(id: string, bulletsJson: string | null): void {
  initDb();
  stmts.setBullets.run(bulletsJson, id);
  broadcastTreeInvalidated();
}

/**
 * Replace the free-form scratch pad text (null/empty clears it). Saved from
 * the renderer on debounce and via the MCP `set_scratchpad` tool. No
 * broadcast: in-app edits already update optimistically and saves fire often.
 */
export function setScratchpad(id: string, text: string | null): void {
  initDb();
  stmts.setScratchpad.run(text && text.length > 0 ? text : null, id);
}

export function updatePipeline(id: string, patch: Partial<Pipeline>): void {
  initDb();
  const db = initDb();
  const row = db
    .prepare(`SELECT pipeline_json FROM meetings WHERE id = ?`)
    .get(id) as { pipeline_json: string | null } | undefined;
  let current: Pipeline = {};
  if (row?.pipeline_json) {
    try {
      current = JSON.parse(row.pipeline_json) as Pipeline;
    } catch {
      current = {};
    }
  }
  const next: Pipeline = { ...current, ...patch };
  db.prepare(`UPDATE meetings SET pipeline_json = ? WHERE id = ?`).run(
    JSON.stringify(next),
    id,
  );
}

export function setMeetingTemplate(id: string, templateId: string | null): void {
  const db = initDb();
  db.prepare(`UPDATE meetings SET notes_template_id = ? WHERE id = ?`).run(
    templateId,
    id,
  );
  broadcastTreeInvalidated();
}

export function getMeeting(id: string): MeetingRow | null {
  initDb();
  return (stmts.getMeeting.get(id) as unknown as MeetingRow | undefined) ?? null;
}

export function listMeetings(): MeetingRow[] {
  initDb();
  return stmts.listMeetings.all() as unknown as MeetingRow[];
}

export function deleteMeeting(id: string): void {
  initDb();
  stmts.deleteMeeting.run(id);
  broadcastTreeInvalidated();
}

export function insertTranscriptSegment(seg: TranscriptRow): void {
  initDb();
  stmts.insertTranscript.run(
    seg.meeting_id,
    seg.segment_idx,
    seg.start_ms,
    seg.end_ms,
    seg.speaker_id,
    seg.text,
  );
}

export function deleteTranscriptForMeeting(meetingId: string): void {
  initDb().prepare(`DELETE FROM transcripts WHERE meeting_id = ?`).run(meetingId);
}

export function deleteSpeakersForMeeting(meetingId: string): void {
  initDb().prepare(`DELETE FROM speakers WHERE meeting_id = ?`).run(meetingId);
}

export function clearTranscriptSpeakers(meetingId: string): void {
  initDb()
    .prepare(`UPDATE transcripts SET speaker_id = NULL WHERE meeting_id = ?`)
    .run(meetingId);
}

export function listTranscript(meetingId: string): TranscriptRow[] {
  initDb();
  return stmts.listTranscripts.all(meetingId) as unknown as TranscriptRow[];
}

export function updateTranscriptSpeaker(
  meetingId: string,
  segmentIdx: number,
  speakerId: string,
): void {
  initDb();
  stmts.updateTranscriptSpeaker.run(speakerId, meetingId, segmentIdx);
}

export function upsertSpeaker(
  meetingId: string,
  speakerId: string,
  displayName: string,
): void {
  initDb();
  stmts.upsertSpeaker.run(meetingId, speakerId, displayName);
}

export function listSpeakers(meetingId: string): SpeakerRow[] {
  initDb();
  return stmts.listSpeakers.all(meetingId) as unknown as SpeakerRow[];
}

// --- Embedding (de)serialization --------------------------------------------

export function embeddingToBlob(embedding: Float32Array | number[]): Uint8Array {
  const f32 =
    embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
  return new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
}

export function blobToEmbedding(blob: Uint8Array | Buffer): Float32Array {
  const buf = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  // Copy into a fresh buffer to guarantee 4-byte alignment regardless of the
  // upstream slice — Float32Array views require it.
  const aligned = new Uint8Array(buf.byteLength);
  aligned.set(buf);
  return new Float32Array(aligned.buffer, 0, aligned.byteLength / 4);
}

// --- Speaker embedding bookkeeping ------------------------------------------

export function setSpeakerEmbedding(opts: {
  meetingId: string;
  speakerId: string;
  embedding: Float32Array | null;
  sampleClipPath: string | null;
}): void {
  initDb();
  const blob = opts.embedding ? embeddingToBlob(opts.embedding) : null;
  stmts.updateSpeakerEmbedding.run(
    blob,
    opts.sampleClipPath,
    opts.meetingId,
    opts.speakerId,
  );
}

export function setSpeakerMatch(opts: {
  meetingId: string;
  speakerId: string;
  voiceLibraryId: string | null;
  matchConfidence: number | null;
  needsReview: boolean;
  displayName: string;
}): void {
  initDb();
  stmts.updateSpeakerMatch.run(
    opts.voiceLibraryId,
    opts.matchConfidence,
    opts.needsReview ? 1 : 0,
    opts.displayName,
    opts.meetingId,
    opts.speakerId,
  );
}

export function getSpeakerEmbedding(
  meetingId: string,
  speakerId: string,
): { embedding: Float32Array; sampleClipPath: string | null } | null {
  initDb();
  const row = stmts.getSpeakerEmbedding.get(meetingId, speakerId) as
    | { embedding: Uint8Array | null; sample_clip_path: string | null }
    | undefined;
  if (!row || !row.embedding) return null;
  return {
    embedding: blobToEmbedding(row.embedding),
    sampleClipPath: row.sample_clip_path,
  };
}

// --- Voice library CRUD -----------------------------------------------------

export function listVoiceLibrary(): VoiceLibraryRow[] {
  initDb();
  return stmts.listVoiceLibrary.all() as unknown as VoiceLibraryRow[];
}

export function listVoiceLibraryWithStats(): VoiceLibraryPerson[] {
  initDb();
  return stmts.listVoiceLibraryWithStats.all() as unknown as VoiceLibraryPerson[];
}

// In-memory cache of the deserialized people-with-centroids set. Scoring a
// meeting's speakers reads the whole library once per speaker; the cache
// avoids redoing a full table read + Float32Array copies each time.
let voiceLibraryCache: PersonWithCentroids[] | null = null;

function invalidateVoiceLibraryCache(): void {
  voiceLibraryCache = null;
}

interface CentroidDbRow {
  library_id: string;
  centroid_idx: number;
  embedding: Uint8Array;
  dim: number;
  n_samples: number;
}

/** Every library person bundled with its centroids — the matcher's input. */
export function listPeopleWithCentroids(): PersonWithCentroids[] {
  if (voiceLibraryCache) return voiceLibraryCache;
  initDb();
  const people = stmts.listVoiceLibrary.all() as unknown as VoiceLibraryRow[];
  const centroidRows =
    stmts.listAllCentroids.all() as unknown as CentroidDbRow[];
  const byPerson = new Map<string, PersonCentroid[]>();
  for (const c of centroidRows) {
    const list = byPerson.get(c.library_id) ?? [];
    list.push({
      embedding: blobToEmbedding(c.embedding),
      nSamples: c.n_samples,
    });
    byPerson.set(c.library_id, list);
  }
  voiceLibraryCache = people.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    email: p.email,
    sample_clip_path: p.sample_clip_path,
    centroids: byPerson.get(p.id) ?? [],
  }));
  return voiceLibraryCache;
}

/** Centroids of one person, with their stored index so callers can update a
 *  specific row in place. */
export function getCentroidsForPerson(
  id: string,
): Array<{ idx: number; embedding: Float32Array; nSamples: number }> {
  initDb();
  const rows = stmts.listCentroidsForPerson.all(id) as unknown as Array<{
    centroid_idx: number;
    embedding: Uint8Array;
    n_samples: number;
  }>;
  return rows.map((r) => ({
    idx: r.centroid_idx,
    embedding: blobToEmbedding(r.embedding),
    nSamples: r.n_samples,
  }));
}

export function addCentroid(opts: {
  libraryId: string;
  idx: number;
  embedding: Float32Array;
  nSamples: number;
}): void {
  initDb();
  stmts.insertCentroid.run(
    opts.libraryId,
    opts.idx,
    embeddingToBlob(opts.embedding),
    opts.embedding.length,
    opts.nSamples,
  );
  invalidateVoiceLibraryCache();
}

export function updateCentroid(opts: {
  libraryId: string;
  idx: number;
  embedding: Float32Array;
  nSamples: number;
}): void {
  initDb();
  stmts.updateCentroid.run(
    embeddingToBlob(opts.embedding),
    opts.nSamples,
    opts.libraryId,
    opts.idx,
  );
  invalidateVoiceLibraryCache();
}

/** Bump n_meetings + updated_at after folding a new observation into a person. */
export function touchPerson(id: string): void {
  initDb();
  stmts.touchVoiceLibrary.run(Date.now(), id);
  invalidateVoiceLibraryCache();
}

/** Attach an email to a person — no-op if they already have one. Used by the
 *  auto path (tagging from a calendar invitee) so a later meeting never
 *  clobbers a confirmed address. */
export function setPersonEmail(id: string, email: string): void {
  initDb();
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  stmts.setVoiceLibraryEmail.run(clean, Date.now(), id);
  invalidateVoiceLibraryCache();
  // Backfill is the automatic path (calendar-driven tagging) — a freshly
  // stamped address may be the user's own, so re-check self-identity.
  reconcileMeFromCalendar();
}

/** Overwrite (or clear, with null/empty) a person's email — used by explicit
 *  manual edits in the People view, where the user can correct or remove it. */
export function updatePersonEmail(id: string, email: string | null): void {
  initDb();
  const clean = email?.trim().toLowerCase() || null;
  stmts.setVoiceLibraryEmailForce.run(clean, Date.now(), id);
  invalidateVoiceLibraryCache();
}

/** Create a person row. Voice fingerprints live in voice_centroids and are
 *  added separately (a person can exist name-only until first heard). The
 *  legacy embedding/dim columns are zero-filled to satisfy the NOT NULL. */
export function createVoiceLibraryEntry(opts: {
  id: string;
  displayName: string;
  email: string | null;
  sampleClipPath: string | null;
}): VoiceLibraryRow {
  initDb();
  const now = Date.now();
  const email = opts.email?.trim().toLowerCase() || null;
  stmts.insertVoiceLibrary.run(
    opts.id,
    opts.displayName,
    email,
    new Uint8Array(0),
    0,
    opts.sampleClipPath,
    now,
    now,
  );
  invalidateVoiceLibraryCache();
  // A person created with an email (e.g. tagging the calendar's self invitee)
  // may be the user — re-check self-identity. is_me in the returned literal
  // stays 0; callers use .id, and renderers refetch on the broadcast.
  if (email) reconcileMeFromCalendar();
  return {
    id: opts.id,
    display_name: opts.displayName,
    email,
    is_me: 0,
    dim: 0,
    sample_clip_path: opts.sampleClipPath,
    n_meetings: 1,
    created_at_ms: now,
    updated_at_ms: now,
  };
}

export function renameVoiceLibraryEntry(id: string, displayName: string): void {
  initDb();
  stmts.renameVoiceLibrary.run(displayName, Date.now(), id);
  invalidateVoiceLibraryCache();
}

export function deleteVoiceLibraryEntry(id: string): void {
  initDb();
  stmts.deleteVoiceLibrary.run(id);
  invalidateVoiceLibraryCache();
}

/** Mark one person as "you" (clearing any previous one), or pass null to
 *  clear the flag entirely. Enforces the single-"me" invariant. */
export function markLibraryEntryAsMe(id: string | null): void {
  initDb();
  stmts.clearMe.run();
  if (id) stmts.setMeById.run(id);
  invalidateVoiceLibraryCache();
}

/** The library id of the person representing the app user, or null. */
export function getMeLibraryId(): string | null {
  initDb();
  const row = stmts.getMeId.get() as { id: string } | undefined;
  return row?.id ?? null;
}

/** Auto-link "you" to the person whose email matches a connected calendar
 *  account — but only when no one is marked yet, so a manual choice (or an
 *  earlier auto-link) always wins. Runs at startup and after auto email
 *  writes (e.g. tagging the calendar's self invitee, which carries your
 *  account address). */
export function reconcileMeFromCalendar(): void {
  initDb();
  if (getMeLibraryId()) return;
  const accountEmails = new Set(
    listCalendarAccounts()
      .map((a) => a.email?.trim().toLowerCase())
      .filter((e): e is string => !!e),
  );
  if (accountEmails.size === 0) return;
  const match = listVoiceLibrary().find(
    (p) => p.email && accountEmails.has(p.email.toLowerCase()),
  );
  if (match) {
    stmts.setMeById.run(match.id);
    invalidateVoiceLibraryCache();
  }
}

export function insertTask(
  meetingId: string,
  assigneeSpeakerId: string | null,
  text: string,
): void {
  initDb();
  stmts.insertTask.run(meetingId, assigneeSpeakerId, text, Date.now());
}

export function listTasks(meetingId: string): TaskRow[] {
  initDb();
  return stmts.listTasks.all(meetingId) as unknown as TaskRow[];
}

export function setTaskDone(taskId: number, done: boolean): void {
  initDb();
  stmts.setTaskDone.run(done ? 1 : 0, taskId);
}

export function deleteTasksForMeeting(meetingId: string): void {
  initDb();
  stmts.deleteTasksForMeeting.run(meetingId);
}

export function getTask(taskId: number): TaskRow | null {
  initDb();
  return (stmts.getTask.get(taskId) as unknown as TaskRow) ?? null;
}

export function addTask(
  meetingId: string,
  text: string,
  assigneeSpeakerId: string | null = null,
): TaskRow {
  initDb();
  const info = stmts.insertTask.run(
    meetingId,
    assigneeSpeakerId,
    text,
    Date.now(),
  );
  return stmts.getTask.get(
    Number(info.lastInsertRowid),
  ) as unknown as TaskRow;
}

export function duplicateTask(taskId: number): TaskRow | null {
  initDb();
  const src = stmts.getTask.get(taskId) as unknown as TaskRow | undefined;
  if (!src) return null;
  const info = stmts.insertTaskFull.run(
    src.meeting_id,
    src.assignee_speaker_id,
    src.text,
    src.priority,
    src.due_at_ms,
    Date.now(),
  );
  return stmts.getTask.get(
    Number(info.lastInsertRowid),
  ) as unknown as TaskRow;
}

export function setTaskPriority(taskId: number, priority: number): void {
  initDb();
  stmts.setTaskPriority.run(priority, taskId);
}

export function setTaskDueDate(taskId: number, dueAtMs: number | null): void {
  initDb();
  stmts.setTaskDueDate.run(dueAtMs, taskId);
}

export function setTaskAssignee(
  taskId: number,
  speakerId: string | null,
): void {
  initDb();
  stmts.setTaskAssignee.run(speakerId, taskId);
}

export function updateTaskText(taskId: number, text: string): void {
  initDb();
  stmts.updateTaskText.run(text, taskId);
}

export function deleteTask(taskId: number): void {
  initDb();
  stmts.deleteTask.run(taskId);
}

// --- Tags --------------------------------------------------------------------

export function listAllTags(): TagRow[] {
  initDb();
  return stmts.listTags.all() as unknown as TagRow[];
}

export function listTagsForMeeting(meetingId: string): TagRow[] {
  initDb();
  return stmts.listTagsForMeeting.all(meetingId) as unknown as TagRow[];
}

export function listAllMeetingTagPairs(): Array<{ meeting_id: string; tag_id: string }> {
  initDb();
  return stmts.listMeetingTagPairs.all() as unknown as Array<{
    meeting_id: string;
    tag_id: string;
  }>;
}

function tagColorFor(name: string): string {
  const PALETTE = [
    "#7c3aed",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#14b8a6",
    "#6366f1",
    "#84cc16",
    "#f97316",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function findOrCreateTag(name: string, auto = false): TagRow {
  initDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name required");
  const existing = stmts.findTagByName.get(trimmed) as TagRow | undefined;
  if (existing) return existing;
  const id = randomUUID();
  const now = Date.now();
  const color = tagColorFor(trimmed);
  stmts.insertTag.run(id, trimmed, color, auto ? 1 : 0, now);
  return { id, name: trimmed, color, auto: auto ? 1 : 0, created_at_ms: now };
}

export function renameTag(id: string, name: string): void {
  initDb();
  const trimmed = name.trim();
  if (!trimmed) return;
  stmts.renameTag.run(trimmed, id);
}

export function deleteTag(id: string): void {
  initDb();
  stmts.deleteTag.run(id);
}

export function attachTagToMeeting(
  meetingId: string,
  tagId: string,
  auto = false,
): void {
  const db = initDb();
  stmts.attachTag.run(meetingId, tagId, auto ? 1 : 0);
  // If a folder is associated with this tag, move the meeting into it (append
  // to the end of that folder's list). Raw UPDATEs so it composes with callers
  // that already opened a transaction — node sqlite doesn't support nested
  // BEGIN, and `moveItem()` opens its own.
  const folder = db
    .prepare(`SELECT id FROM folders WHERE auto_tag_id = ? LIMIT 1`)
    .get(tagId) as { id: string } | undefined;
  if (!folder) return;
  const current = db
    .prepare(`SELECT folder_id FROM meetings WHERE id = ?`)
    .get(meetingId) as { folder_id: string | null } | undefined;
  if (!current || current.folder_id === folder.id) return;
  const maxPos = db
    .prepare(
      `SELECT COALESCE(MAX(position), -1) AS p FROM meetings WHERE folder_id IS ?`,
    )
    .get(folder.id) as { p: number };
  db.prepare(
    `UPDATE meetings SET folder_id = ?, position = ? WHERE id = ?`,
  ).run(folder.id, maxPos.p + 1, meetingId);
}

export function detachTagFromMeeting(meetingId: string, tagId: string): void {
  initDb();
  stmts.detachTag.run(meetingId, tagId);
}

export function clearAutoTagsForMeeting(meetingId: string): void {
  initDb();
  stmts.clearAutoTagsForMeeting.run(meetingId);
}

// --- Personal tasks ----------------------------------------------------------

export function listPersonalTasks(): PersonalTaskRow[] {
  initDb();
  return stmts.listPersonalTasks.all() as unknown as PersonalTaskRow[];
}

export function createPersonalTask(opts: {
  text: string;
  dueAtMs?: number | null;
}): PersonalTaskRow {
  initDb();
  const now = Date.now();
  const due = opts.dueAtMs ?? null;
  const result = stmts.insertPersonalTask.run(opts.text, due, now);
  return {
    id: Number(result.lastInsertRowid),
    text: opts.text,
    done: 0,
    due_at_ms: due,
    created_at_ms: now,
  };
}

export function setPersonalTaskDone(id: number, done: boolean): void {
  initDb();
  stmts.setPersonalTaskDone.run(done ? 1 : 0, id);
}

export function updatePersonalTask(
  id: number,
  text: string,
  dueAtMs: number | null,
): void {
  initDb();
  stmts.setPersonalTaskText.run(text, dueAtMs, id);
}

export function deletePersonalTask(id: number): void {
  initDb();
  stmts.deletePersonalTask.run(id);
}

// --- Calendar accounts -------------------------------------------------------

interface CalendarAccountDbRow {
  id: string;
  provider: string;
  email: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at_ms: number | null;
  created_at_ms: number;
  updated_at_ms: number;
}

export function listCalendarAccounts(): CalendarAccountRow[] {
  initDb();
  const rows = stmts.listCalendarAccounts.all() as unknown as CalendarAccountDbRow[];
  return rows.map((r) => ({ ...r, provider: r.provider as "google" }));
}

export function getCalendarAccount(id: string): CalendarAccountRow | null {
  initDb();
  const row = stmts.getCalendarAccount.get(id) as
    | CalendarAccountDbRow
    | undefined;
  if (!row) return null;
  return { ...row, provider: row.provider as "google" };
}

export function insertCalendarAccount(opts: {
  provider: "google";
  email: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAtMs: number | null;
}): CalendarAccountRow {
  initDb();
  const id = randomUUID();
  const now = Date.now();
  stmts.insertCalendarAccount.run(
    id,
    opts.provider,
    opts.email,
    opts.accessTokenEnc,
    opts.refreshTokenEnc,
    opts.tokenExpiresAtMs,
    now,
    now,
  );
  return {
    id,
    provider: opts.provider,
    email: opts.email,
    access_token_enc: opts.accessTokenEnc,
    refresh_token_enc: opts.refreshTokenEnc,
    token_expires_at_ms: opts.tokenExpiresAtMs,
    created_at_ms: now,
    updated_at_ms: now,
  };
}

export function updateCalendarAccountTokens(opts: {
  id: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAtMs: number | null;
}): void {
  initDb();
  stmts.updateCalendarAccountTokens.run(
    opts.accessTokenEnc,
    opts.refreshTokenEnc,
    opts.tokenExpiresAtMs,
    Date.now(),
    opts.id,
  );
}

export function deleteCalendarAccount(id: string): void {
  initDb();
  stmts.deleteCalendarAccount.run(id);
}

// --- Calendar events ---------------------------------------------------------

export function listCalendarEvents(
  fromMs: number,
  toMs: number,
): CalendarEventRow[] {
  initDb();
  return stmts.listCalendarEvents.all(fromMs, toMs) as unknown as CalendarEventRow[];
}

export function upsertCalendarEvent(opts: {
  accountId: string;
  sourceEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAtMs: number;
  endAtMs: number;
  hangoutLink: string | null;
  attendeesJson: string | null;
}): void {
  initDb();
  const id = `${opts.accountId}:${opts.sourceEventId}`;
  stmts.upsertCalendarEvent.run(
    id,
    opts.accountId,
    opts.sourceEventId,
    opts.title,
    opts.description,
    opts.location,
    opts.startAtMs,
    opts.endAtMs,
    opts.hangoutLink,
    opts.attendeesJson,
    null,
    Date.now(),
  );
}

export function linkCalendarEventToMeeting(
  eventId: string,
  meetingId: string | null,
): void {
  initDb();
  stmts.linkCalendarEventMeeting.run(meetingId, eventId);
}

export function getCalendarEventForMeeting(
  meetingId: string,
): CalendarEventRow | null {
  const db = initDb();
  const row = db
    .prepare(
      `SELECT id, account_id, source_event_id, title, description, location,
              start_at_ms, end_at_ms, hangout_link, attendees_json, meeting_id,
              updated_at_ms
         FROM calendar_events WHERE meeting_id = ? LIMIT 1`,
    )
    .get(meetingId) as CalendarEventRow | undefined;
  return row ?? null;
}

/**
 * Returns calendar events whose start/end window overlaps the requested
 * range, regardless of pagination — used by the matcher when scoring a
 * specific recording, where we want a generous window around the recording's
 * time, not the user's calendar view window.
 */
export function listCalendarEventsOverlapping(
  fromMs: number,
  toMs: number,
): CalendarEventRow[] {
  const db = initDb();
  return db
    .prepare(
      `SELECT id, account_id, source_event_id, title, description, location,
              start_at_ms, end_at_ms, hangout_link, attendees_json, meeting_id,
              updated_at_ms
         FROM calendar_events
        WHERE end_at_ms >= ? AND start_at_ms <= ?
        ORDER BY start_at_ms ASC`,
    )
    .all(fromMs, toMs) as unknown as CalendarEventRow[];
}

/** Distinct meeting_ids that have a linked calendar event — for badges. */
export function listLinkedMeetingIds(): string[] {
  const db = initDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT meeting_id FROM calendar_events WHERE meeting_id IS NOT NULL`,
    )
    .all() as Array<{ meeting_id: string }>;
  return rows.map((r) => r.meeting_id);
}

/** Clear any existing link on an event id (used before re-pointing). */
export function clearLinkForEvent(eventId: string): void {
  initDb()
    .prepare(`UPDATE calendar_events SET meeting_id = NULL WHERE id = ?`)
    .run(eventId);
}

/** Clear any link pointing to this meeting (used when unlinking from meeting side). */
export function clearLinkForMeeting(meetingId: string): void {
  initDb()
    .prepare(`UPDATE calendar_events SET meeting_id = NULL WHERE meeting_id = ?`)
    .run(meetingId);
}

// --- Search ------------------------------------------------------------------

export interface MeetingSearchHit {
  meeting_id: string;
  title: string;
  matched_in: "title" | "transcript" | "tag" | "summary";
  snippet: string | null;
}

export function searchMeetings(query: string, limit = 40): MeetingSearchHit[] {
  const db = initDb();
  const q = query.trim();
  if (!q) return [];
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const hits = new Map<string, MeetingSearchHit>();

  const byTitle = db
    .prepare(
      `SELECT id, title FROM meetings
        WHERE title LIKE ? ESCAPE '\\' ORDER BY started_at_ms DESC LIMIT ?`,
    )
    .all(like, limit) as Array<{ id: string; title: string }>;
  for (const r of byTitle) {
    if (!hits.has(r.id)) {
      hits.set(r.id, {
        meeting_id: r.id,
        title: r.title,
        matched_in: "title",
        snippet: null,
      });
    }
  }

  const ftsQuery = toFtsMatchQuery(q);
  if (ftsQuery) {
    const byTranscript = db
      .prepare(
        `SELECT f.meeting_id AS id,
                m.title AS title,
                snippet(transcripts_fts, 2, '', '', '…', 12) AS snippet
           FROM transcripts_fts f
           JOIN meetings m ON m.id = f.meeting_id
          WHERE transcripts_fts MATCH ?
          ORDER BY rank, m.started_at_ms DESC
          LIMIT ?`,
      )
      .all(ftsQuery, limit) as Array<{
        id: string;
        title: string;
        snippet: string;
      }>;
    for (const r of byTranscript) {
      if (!hits.has(r.id)) {
        hits.set(r.id, {
          meeting_id: r.id,
          title: r.title,
          matched_in: "transcript",
          snippet: r.snippet,
        });
      }
    }
  }

  const byTag = db
    .prepare(
      `SELECT mt.meeting_id AS id, m.title AS title, t.name AS tag
         FROM meeting_tags mt
         JOIN tags t ON t.id = mt.tag_id
         JOIN meetings m ON m.id = mt.meeting_id
        WHERE t.name LIKE ? ESCAPE '\\'
        ORDER BY m.started_at_ms DESC LIMIT ?`,
    )
    .all(like, limit) as Array<{ id: string; title: string; tag: string }>;
  for (const r of byTag) {
    if (!hits.has(r.id)) {
      hits.set(r.id, {
        meeting_id: r.id,
        title: r.title,
        matched_in: "tag",
        snippet: `#${r.tag}`,
      });
    }
  }

  const bySummary = db
    .prepare(
      `SELECT id, title, summary_json FROM meetings
        WHERE summary_json IS NOT NULL AND summary_json LIKE ? ESCAPE '\\'
        ORDER BY started_at_ms DESC LIMIT ?`,
    )
    .all(like, limit) as Array<{
      id: string;
      title: string;
      summary_json: string;
    }>;
  for (const r of bySummary) {
    if (!hits.has(r.id)) {
      hits.set(r.id, {
        meeting_id: r.id,
        title: r.title,
        matched_in: "summary",
        snippet: makeSnippet(r.summary_json, q),
      });
    }
  }

  return Array.from(hits.values());
}

function makeSnippet(text: string, query: string): string {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text.slice(0, 120);
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + query.length + 60);
  const head = start > 0 ? "…" : "";
  const tail = end < text.length ? "…" : "";
  return `${head}${text.slice(start, end)}${tail}`.replace(/\s+/g, " ").trim();
}

/**
 * Turn a user search box value into an FTS5 MATCH expression. Each whitespace-
 * separated term becomes a prefix match ANDed together. Returns null if the
 * query has no usable tokens (e.g. only punctuation).
 */
function toFtsMatchQuery(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" AND ");
}

// --- Aggregated tasks (across all meetings) ----------------------------------

export interface AggregatedTaskRow extends TaskRow {
  meeting_title: string;
  meeting_started_at_ms: number;
  assignee_name: string | null;
  assignee_library_id: string | null;
}

export function listAllMeetingTasks(): AggregatedTaskRow[] {
  const db = initDb();
  return db
    .prepare(
      `SELECT t.*, m.title AS meeting_title, m.started_at_ms AS meeting_started_at_ms,
              s.display_name AS assignee_name, s.voice_library_id AS assignee_library_id
         FROM tasks t
         JOIN meetings m ON m.id = t.meeting_id
         LEFT JOIN speakers s
           ON s.meeting_id = t.meeting_id AND s.speaker_id = t.assignee_speaker_id
        ORDER BY t.done ASC, m.started_at_ms DESC, t.id ASC`,
    )
    .all() as unknown as AggregatedTaskRow[];
}

export interface UsageTotals {
  meetings: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  duration_ms: number;
  num_turns: number;
  /** Highest pre-computed cost across all runs — useful to surface "biggest
   *  single meeting" without doing per-row work in the UI. */
  max_single_cost_usd: number;
  /** Timestamp of the most recent meeting with usage data, for "last run"
   *  hints in the settings panel. */
  last_used_at_ms: number | null;
}

const EMPTY_USAGE_TOTALS: UsageTotals = {
  meetings: 0,
  cost_usd: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  duration_ms: 0,
  num_turns: 0,
  max_single_cost_usd: 0,
  last_used_at_ms: null,
};

/**
 * Sum usage across every meeting that has `pipeline_json.notes_usage`.
 * Optional filter narrows by billing kind so Settings can show the user a
 * separate total for their subscription-backed Claude CLI runs vs the
 * metered Anthropic API runs.
 *
 * We parse JSON per row in JS rather than in SQL — the meetings table is
 * small (hundreds, not millions) and json_extract gymnastics make the
 * filter logic awkward. Cheap enough.
 */
export function aggregateUsage(
  filter?: { billingKind?: "subscription" | "metered" },
): UsageTotals {
  const db = initDb();
  const rows = db
    .prepare(
      `SELECT pipeline_json, started_at_ms FROM meetings WHERE pipeline_json IS NOT NULL`,
    )
    .all() as Array<{
    pipeline_json: string;
    started_at_ms: number;
  }>;
  const totals = { ...EMPTY_USAGE_TOTALS };
  for (const row of rows) {
    let parsed: Pipeline | null = null;
    try {
      parsed = JSON.parse(row.pipeline_json) as Pipeline;
    } catch {
      continue;
    }
    const u = parsed.notes_usage;
    if (!u) continue;
    if (filter?.billingKind && u.billing_kind !== filter.billingKind) continue;
    totals.meetings += 1;
    totals.cost_usd += u.cost_usd ?? 0;
    totals.input_tokens += u.input_tokens ?? 0;
    totals.output_tokens += u.output_tokens ?? 0;
    totals.cache_creation_input_tokens +=
      u.cache_creation_input_tokens ?? 0;
    totals.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
    totals.duration_ms += u.duration_ms ?? 0;
    totals.num_turns += u.num_turns ?? 0;
    if ((u.cost_usd ?? 0) > totals.max_single_cost_usd) {
      totals.max_single_cost_usd = u.cost_usd ?? 0;
    }
    if (
      totals.last_used_at_ms === null ||
      row.started_at_ms > totals.last_used_at_ms
    ) {
      totals.last_used_at_ms = row.started_at_ms;
    }
  }
  return totals;
}
