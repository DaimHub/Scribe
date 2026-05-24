/**
 * Pure matching logic for linking Scribe recordings to Google Calendar events.
 *
 * Inputs are plain data, no DB/Electron deps — easy to unit-test and reason
 * about in isolation.
 */
import type { CalendarEventRow } from "./db.js";

export interface RecordingSnapshot {
  id: string;
  title: string;
  started_at_ms: number;
  /** May be null mid-recording. When null, treated as `started_at + 10min`. */
  ended_at_ms: number | null;
}

export type MatchReason = "overlap" | "overlap+title" | "title";

export interface MatchCandidate {
  event: CalendarEventRow;
  confidence: number; // 0..1
  reason: MatchReason;
  overlapMs: number;
  titleScore: number;
}

const START_TOLERANCE_MS = 5 * 60 * 1000; // event may start up to 5 min before recording
const END_TOLERANCE_MS = 15 * 60 * 1000; // recording may run up to 15 min over
const MIN_OVERLAP_RATIO = 0.3; // overlap must cover ≥30% of the event
const MIN_EVENT_DURATION_MS = 2 * 60 * 1000; // skip "instantaneous" events
const MAX_EVENT_DURATION_MS = 8 * 60 * 60 * 1000; // skip all-day / 9h+ blocks
const MIN_CONFIDENCE_TO_LINK = 0.7;

const DEFAULT_RECORDING_DURATION_MS = 10 * 60 * 1000;

export function findMatchingEvent(
  recording: RecordingSnapshot,
  events: CalendarEventRow[],
): MatchCandidate | null {
  const candidates = scoreCandidates(recording, events);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  const top = candidates[0];

  if (top.confidence < MIN_CONFIDENCE_TO_LINK) return null;

  // If two candidates are tied closely, only return the top if its lead is
  // material — prevents flapping between back-to-back meetings.
  const second = candidates[1];
  if (second && top.confidence - second.confidence < 0.1) {
    return null;
  }

  return top;
}

/**
 * Lower-precision picker used by manual-link UIs. Returns up to `limit` ranked
 * candidates without enforcing the confidence cutoff.
 */
export function rankCandidates(
  recording: RecordingSnapshot,
  events: CalendarEventRow[],
  limit = 8,
): MatchCandidate[] {
  return scoreCandidates(recording, events)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

function scoreCandidates(
  recording: RecordingSnapshot,
  events: CalendarEventRow[],
): MatchCandidate[] {
  const recStart = recording.started_at_ms;
  const recEnd =
    recording.ended_at_ms ?? recStart + DEFAULT_RECORDING_DURATION_MS;

  const result: MatchCandidate[] = [];
  for (const ev of events) {
    // Already-linked events to a different meeting are not candidates.
    if (ev.meeting_id && ev.meeting_id !== recording.id) continue;

    const eventDuration = ev.end_at_ms - ev.start_at_ms;
    if (eventDuration < MIN_EVENT_DURATION_MS) continue;
    if (eventDuration > MAX_EVENT_DURATION_MS) continue;

    const evStartTol = ev.start_at_ms - START_TOLERANCE_MS;
    const evEndTol = ev.end_at_ms + END_TOLERANCE_MS;

    const overlapStart = Math.max(recStart, evStartTol);
    const overlapEnd = Math.min(recEnd, evEndTol);
    const overlapMs = Math.max(0, overlapEnd - overlapStart);
    if (overlapMs === 0) continue;

    const overlapRatio = overlapMs / eventDuration;
    if (overlapRatio < MIN_OVERLAP_RATIO) continue;

    const titleScore = titleSimilarity(recording.title, ev.title);

    // Weighted score. Overlap dominates; title is a tiebreaker.
    const score =
      Math.min(1, overlapRatio) * 0.75 + titleScore * 0.25;

    let reason: MatchReason = "overlap";
    if (titleScore >= 0.6) reason = "overlap+title";
    if (overlapRatio < 0.5 && titleScore >= 0.8) reason = "title";

    result.push({
      event: ev,
      confidence: clamp01(score),
      reason,
      overlapMs,
      titleScore,
    });
  }
  return result;
}

/**
 * Token-set ratio in [0, 1]. Robust to extra words, punctuation, and case.
 * Identical strings → 1; no token overlap → 0.
 */
function titleSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

const STOP_TOKENS = new Set([
  "the",
  "a",
  "an",
  "meeting",
  "sync",
  "call",
  "untitled",
  "weekly",
  "daily",
  "and",
  "with",
  "&",
  "and",
  "of",
  "for",
  "to",
]);

function tokenize(s: string): Set<string> {
  const cleaned = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const out = new Set<string>();
  for (const t of cleaned.split(/\s+/)) {
    if (!t) continue;
    if (t.length < 2) continue;
    if (STOP_TOKENS.has(t)) continue;
    out.add(t);
  }
  return out;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** True if `now` falls inside the event's natural window (no tolerance). */
export function isEventActiveAt(ev: CalendarEventRow, now: number): boolean {
  if (now < ev.start_at_ms) return false;
  if (now > ev.end_at_ms) return false;
  if (ev.end_at_ms - ev.start_at_ms > MAX_EVENT_DURATION_MS) return false;
  return true;
}
