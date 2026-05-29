import { app, BrowserWindow } from "electron";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  clearTranscriptSpeakers,
  deleteSpeakersForMeeting,
  deleteTranscriptForMeeting,
  getMeeting,
  insertTranscriptSegment,
  listTranscript,
  setSpeakerEmbedding,
  setSpeakerMatch,
  setStatus,
  updatePipeline,
  updateTranscriptSpeaker,
  upsertSpeaker,
} from "./db.js";
import type { Pipeline } from "./db.js";
import { extractClip, mixToMono16k } from "./audio-mix.js";
import { speakerHintForMeeting } from "./calendar.js";
import {
  isInstalled as sidecarInstalled,
  runDiarizeOnly,
  runWhisperX,
  type RunResult,
  type SpeakerEmbedding,
} from "./python-sidecar.js";
import { broadcastVoiceLibraryChanged } from "./broadcast.js";
import { getAiLanguage, getHfToken } from "./settings.js";
import {
  findBestMatch,
  mergeIntoLibrary,
  type MatchVerdict,
} from "./voice-match.js";

export type WhisperModel =
  | "tiny"
  | "base"
  | "small"
  | "medium"
  | "large-v3-turbo"
  | "large-v3";

interface WhisperXProgress {
  stage: string;
  pct: number;
  note?: string | null;
  model?: string | null;
}

function emitProgress(meetingId: string, e: WhisperXProgress) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("transcribe:progress", {
      meetingId,
      stage: e.stage,
      pct: e.pct,
      note: e.note ?? undefined,
      model: e.model ?? undefined,
    });
  }
}

export class WhisperXNotInstalledError extends Error {
  constructor() {
    super("WhisperX is not installed. Open Settings to install it.");
    this.name = "WhisperXNotInstalledError";
  }
}

export async function transcribeMeeting(opts: {
  meetingId: string;
  model?: WhisperModel;
  /** Exact speaker count — when set, forces pyannote to this many clusters
   *  and ignores the calendar-derived min/max hint. */
  numSpeakers?: number;
}): Promise<{
  ok: boolean;
  segments: number;
  speakers: number;
  mixedPath: string;
}> {
  const meeting = getMeeting(opts.meetingId);
  if (!meeting) throw new Error(`Meeting ${opts.meetingId} not found`);
  if (!meeting.mic_wav_path && !meeting.sys_wav_path) {
    throw new Error("Meeting has no audio");
  }

  if (!(await sidecarInstalled())) {
    throw new WhisperXNotInstalledError();
  }

  const workDir = path.join(
    app.getPath("userData"),
    "meetings",
    opts.meetingId,
  );
  await mkdir(workDir, { recursive: true });
  const mixedPath = path.join(workDir, "mixed-16k.wav");

  setStatus(opts.meetingId, "transcribing");
  emitProgress(opts.meetingId, { stage: "mixing", pct: 50, note: "ffmpeg" });
  await mixToMono16k({
    micWavPath: meeting.mic_wav_path,
    sysWavPath: meeting.sys_wav_path,
    outputPath: mixedPath,
    targetSampleRate: 16000,
  });

  const hfToken = await getHfToken();
  const aiLanguage = await getAiLanguage();
  // Cap pyannote's clustering with the linked event's invitee count when
  // available. Tighter bounds noticeably improve diarization on short
  // meetings where pyannote tends to over-split. Falls back to 0/0 (no
  // hint) when the meeting isn't linked or the event has no attendees.
  const { minSpeakers, maxSpeakers } = speakerHintForMeeting(opts.meetingId);
  const pipeline: Pipeline = {};
  const result = await runWhisperX(
    {
      wav: mixedPath,
      model: opts.model ?? "large-v3-turbo",
      language: aiLanguage,
      diarize: !!hfToken,
      hfToken: hfToken ?? undefined,
      numSpeakers:
        opts.numSpeakers && opts.numSpeakers > 0
          ? opts.numSpeakers
          : undefined,
      minSpeakers,
      maxSpeakers,
      extractEmbeddings: !!hfToken,
    },
    (e) => {
      // Capture the model used for each pipeline step so it can be shown in
      // the meeting header after processing completes.
      if (e.model) {
        if (e.stage === "loading-model" || e.stage === "transcribing") {
          pipeline.transcribe = e.model;
        } else if (
          e.stage === "loading-align" ||
          e.stage === "aligning"
        ) {
          pipeline.align = e.model;
        } else if (
          e.stage === "loading-diarize" ||
          e.stage === "diarizing" ||
          e.stage === "diarize-loaded" ||
          e.stage === "diarize-segments" ||
          e.stage === "diarize-assigned"
        ) {
          pipeline.diarize = e.model;
        }
      }
      emitProgress(opts.meetingId, e);
    },
  );

  // Wipe both transcript AND per-meeting speakers so re-running the full
  // pipeline doesn't pile new pyannote IDs on top of stale ones from a
  // previous pass (the "I asked for 9 but the chip shows 14" symptom —
  // 9 fresh + 5 leftover from the prior run with bigger cluster count).
  // The voice_library entries themselves stay — only this meeting's view
  // into them resets.
  deleteTranscriptForMeeting(opts.meetingId);
  deleteSpeakersForMeeting(opts.meetingId);
  const speakerLabels = new Map<string, string>();
  let count = 0;
  for (let i = 0; i < result.segments.length; i++) {
    const seg = result.segments[i];
    if (!seg.text) continue;
    const speakerId = seg.speaker ?? null;
    if (speakerId && !speakerLabels.has(speakerId)) {
      speakerLabels.set(
        speakerId,
        prettySpeakerName(speakerId, speakerLabels.size),
      );
      upsertSpeaker(opts.meetingId, speakerId, speakerLabels.get(speakerId)!);
    }
    insertTranscriptSegment({
      meeting_id: opts.meetingId,
      segment_idx: i,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      speaker_id: speakerId,
      text: seg.text,
    });
    count++;
  }

  const wasDiarized = speakerLabels.size > 0;
  // Only retain the diarize entry if it actually produced speakers.
  if (!wasDiarized) delete pipeline.diarize;
  updatePipeline(opts.meetingId, pipeline);

  // Voice-library matching: per-cluster embedding → cosine-match against the
  // global library → either auto-assign a known name, flag for user review, or
  // leave as an unknown speaker. Best-effort — failures here must not break
  // transcription.
  let postProcess: VoicePostProcessSummary = {
    meetingId: opts.meetingId,
    autoLinked: [],
    needsReviewCount: 0,
    totalSpeakers: speakerLabels.size,
  };
  if (wasDiarized && result.speakers && result.speakers.length > 0) {
    try {
      const speakersDir = path.join(workDir, "speakers");
      await mkdir(speakersDir, { recursive: true });
      const matchSummary = await matchSpeakersAgainstLibrary({
        meetingId: opts.meetingId,
        speakersDir,
        mixedWavPath: mixedPath,
        speakers: result.speakers,
        segments: result.segments,
        defaultLabels: speakerLabels,
      });
      postProcess = {
        meetingId: opts.meetingId,
        autoLinked: matchSummary.autoLinked,
        needsReviewCount: matchSummary.needsReviewCount,
        totalSpeakers: speakerLabels.size,
      };
    } catch (err) {
      console.warn("[whisper] voice-library matching failed:", err);
    }
  }

  setStatus(opts.meetingId, wasDiarized ? "diarized" : "transcribed");
  const matchNote =
    wasDiarized && result.speakers && result.speakers.length > 0
      ? `, ${postProcess.autoLinked.length} auto-tagged${
          postProcess.needsReviewCount > 0
            ? `, ${postProcess.needsReviewCount} to review`
            : ""
        }`
      : "";
  emitProgress(opts.meetingId, {
    stage: "done",
    pct: 100,
    note: `${count} segments, ${speakerLabels.size} speaker(s)${matchNote}`,
  });
  // Broadcast a structured summary so the renderer can show an auto-link toast
  // and pop a review banner when speakers landed in the borderline / unknown
  // bands. Fired AFTER status flip so the next detail refresh has the
  // post-match speakers table state.
  if (wasDiarized) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("voice:postProcess", postProcess);
    }
    // Library stats (n_meetings, last_heard_ms) shift whenever speakers get
    // matched against existing entries, even when no new entry is created.
    // Ping any open People view to refresh.
    broadcastVoiceLibraryChanged();
  }
  return {
    ok: true,
    segments: count,
    speakers: speakerLabels.size,
    mixedPath,
  };
}

/**
 * Re-run pyannote diarization against an existing transcript without
 * re-transcribing. Useful when the original run skipped diarization (no HF
 * token configured, network failure, etc.) — the user keeps the transcript
 * and only pays the diarization cost, which is a fraction of the full
 * pipeline.
 */
export async function rediarizeMeeting(opts: {
  meetingId: string;
  /** Exact speaker count — when set, forces pyannote to this many clusters. */
  numSpeakers?: number;
}): Promise<{ ok: true; speakers: number; segmentsTagged: number }> {
  const meeting = getMeeting(opts.meetingId);
  if (!meeting) throw new Error(`Meeting ${opts.meetingId} not found`);
  if (!meeting.mic_wav_path && !meeting.sys_wav_path) {
    throw new Error("Meeting has no audio");
  }
  if (!(await sidecarInstalled())) throw new WhisperXNotInstalledError();
  const hfToken = await getHfToken();
  if (!hfToken) {
    throw new Error(
      "Hugging Face token required for diarization — set it in Settings.",
    );
  }
  const transcript = listTranscript(opts.meetingId);
  if (transcript.length === 0) {
    throw new Error(
      "No transcript to diarize against — process the meeting first.",
    );
  }

  const workDir = path.join(
    app.getPath("userData"),
    "meetings",
    opts.meetingId,
  );
  await mkdir(workDir, { recursive: true });
  const mixedPath = path.join(workDir, "mixed-16k.wav");

  setStatus(opts.meetingId, "transcribing");
  emitProgress(opts.meetingId, { stage: "mixing", pct: 50, note: "ffmpeg" });
  await mixToMono16k({
    micWavPath: meeting.mic_wav_path,
    sysWavPath: meeting.sys_wav_path,
    outputPath: mixedPath,
    targetSampleRate: 16000,
  });

  const { minSpeakers, maxSpeakers } = speakerHintForMeeting(opts.meetingId);

  // Capture the diarize-step model name as it streams so we can persist it
  // in the same pipeline_json shape the full run produces.
  const pipeline: Pipeline = parseExistingPipeline(meeting.pipeline_json);
  const result = await runDiarizeOnly(
    {
      wav: mixedPath,
      hfToken,
      // Exact count wins over the calendar-derived range; only one of them
      // gets used downstream — the python side ignores min/max when
      // num_speakers > 0.
      numSpeakers:
        opts.numSpeakers && opts.numSpeakers > 0
          ? opts.numSpeakers
          : undefined,
      minSpeakers,
      maxSpeakers,
      segments: transcript.map((t) => ({
        idx: t.segment_idx,
        start_ms: t.start_ms,
        end_ms: t.end_ms,
      })),
    },
    (e) => {
      if (e.model && (e.stage.startsWith("loading-diarize") || e.stage.startsWith("diariz"))) {
        pipeline.diarize = e.model;
      }
      emitProgress(opts.meetingId, e);
    },
  );

  // Wipe any stale per-meeting speakers + transcript speaker tags so we apply
  // the fresh diarization on a clean slate. Voice-library entries themselves
  // are untouched — those live in a separate table.
  deleteSpeakersForMeeting(opts.meetingId);
  clearTranscriptSpeakers(opts.meetingId);

  // Apply assignments. Build a default-name map keyed by the order each
  // speaker first appears, so the labels match what the full pipeline would
  // have produced (Speaker 1, Speaker 2, …).
  const speakerLabels = new Map<string, string>();
  for (const a of result.assignments) {
    if (!speakerLabels.has(a.speaker)) {
      speakerLabels.set(a.speaker, prettySpeakerName(a.speaker, speakerLabels.size));
      upsertSpeaker(opts.meetingId, a.speaker, speakerLabels.get(a.speaker)!);
    }
    updateTranscriptSpeaker(opts.meetingId, a.segment_idx, a.speaker);
  }

  // Synthesize the RunResult["segments"] shape so we can reuse the existing
  // post-process helper — it only reads start_ms/end_ms/speaker.
  const fakeSegments: RunResult["segments"] = transcript.map((t) => ({
    text: t.text,
    start_ms: t.start_ms,
    end_ms: t.end_ms,
    speaker:
      result.assignments.find((a) => a.segment_idx === t.segment_idx)?.speaker ??
      null,
    words: [],
  }));

  let postProcess: VoicePostProcessSummary = {
    meetingId: opts.meetingId,
    autoLinked: [],
    needsReviewCount: 0,
    totalSpeakers: speakerLabels.size,
  };
  if (result.speakers && result.speakers.length > 0) {
    try {
      const speakersDir = path.join(workDir, "speakers");
      await mkdir(speakersDir, { recursive: true });
      const matchSummary = await matchSpeakersAgainstLibrary({
        meetingId: opts.meetingId,
        speakersDir,
        mixedWavPath: mixedPath,
        speakers: result.speakers,
        segments: fakeSegments,
        defaultLabels: speakerLabels,
      });
      postProcess = {
        meetingId: opts.meetingId,
        autoLinked: matchSummary.autoLinked,
        needsReviewCount: matchSummary.needsReviewCount,
        totalSpeakers: speakerLabels.size,
      };
    } catch (err) {
      console.warn("[whisper] voice-library matching failed (rediarize):", err);
    }
  }

  updatePipeline(opts.meetingId, pipeline);
  setStatus(opts.meetingId, "diarized");
  emitProgress(opts.meetingId, {
    stage: "done",
    pct: 100,
    note: `${result.assignments.length} segments, ${speakerLabels.size} speaker(s)`,
  });
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("voice:postProcess", postProcess);
  }
  // Re-diarize also wipes + repopulates the speakers table, which the
  // People view's last_heard / n_meetings subqueries depend on. Ping the
  // tab so it doesn't show stale stats.
  broadcastVoiceLibraryChanged();
  return {
    ok: true,
    speakers: speakerLabels.size,
    segmentsTagged: result.assignments.length,
  };
}

function parseExistingPipeline(json: string | null): Pipeline {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Pipeline;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Summary of the post-transcription voice-library pass, broadcast to all
 * renderer windows as `voice:postProcess`. The renderer subscribes to surface
 * an auto-link toast and pop a review banner without having to diff speakers
 * across detail refreshes.
 */
export interface VoicePostProcessSummary {
  meetingId: string;
  autoLinked: Array<{
    speakerId: string;
    displayName: string;
    confidence: number;
  }>;
  needsReviewCount: number;
  totalSpeakers: number;
}

async function matchSpeakersAgainstLibrary(opts: {
  meetingId: string;
  speakersDir: string;
  mixedWavPath: string;
  speakers: SpeakerEmbedding[];
  segments: RunResult["segments"];
  defaultLabels: Map<string, string>;
}): Promise<{
  autoLinked: VoicePostProcessSummary["autoLinked"];
  needsReviewCount: number;
}> {
  // Pass 1 — per cluster: extract a sample clip, persist the embedding on the
  // per-meeting speaker row, and compute a match verdict against the library.
  interface Pending {
    speakerId: string;
    embedding: Float32Array | null;
    fallbackName: string;
    verdict: MatchVerdict | null;
  }
  const pending: Pending[] = [];

  for (const sp of opts.speakers) {
    if (!sp.id) continue;
    const fallbackName =
      opts.defaultLabels.get(sp.id) ?? prettySpeakerName(sp.id, 0);

    // Extract a distinctive sample wav clip so the UI can play a preview
    // later. We deliberately ignore the sidecar-supplied window — it picks
    // the first segment, which tends to capture greetings and crosstalk.
    // Instead, pick the speaker's longest solo segment so the user has the
    // clearest possible voice fingerprint to identify.
    const window =
      pickDistinctSampleWindow(opts.segments, sp.id) ??
      // Fallback to the sidecar window when transcription couldn't isolate a
      // segment long enough (very short interjections, single-word
      // contributions).
      (sp.sample_end_ms > sp.sample_start_ms
        ? { startMs: sp.sample_start_ms, endMs: sp.sample_end_ms }
        : null);
    let sampleClipPath: string | null = null;
    if (window) {
      const out = path.join(opts.speakersDir, `${safeFilename(sp.id)}.wav`);
      try {
        await extractClip({
          inputWavPath: opts.mixedWavPath,
          startMs: window.startMs,
          endMs: window.endMs,
          outputPath: out,
        });
        sampleClipPath = out;
      } catch (err) {
        console.warn(`[whisper] sample-clip extraction failed for ${sp.id}:`, err);
      }
    }

    const embedding = sp.embedding ? new Float32Array(sp.embedding) : null;
    setSpeakerEmbedding({
      meetingId: opts.meetingId,
      speakerId: sp.id,
      embedding,
      sampleClipPath,
    });

    pending.push({
      speakerId: sp.id,
      embedding,
      fallbackName,
      verdict: embedding ? findBestMatch(embedding) : null,
    });
  }

  // Pass 2 — resolve auto-assignments GLOBALLY so one library person can't be
  // tagged onto two clusters in the same meeting. Collect the auto-strength
  // edges (each cluster's best candidate that cleared the auto bar), sort by
  // similarity desc, then greedily assign best-first with both-sided
  // uniqueness (each cluster and each person claimed at most once). A cluster
  // whose best person is taken by a stronger match falls through to review.
  const edges = pending
    .filter((p) => p.verdict?.decision === "auto-assign" && p.verdict.best)
    .map((p) => ({
      speakerId: p.speakerId,
      personId: p.verdict!.best!.entry.id,
      name: p.verdict!.best!.entry.display_name,
      sim: p.verdict!.best!.similarity,
      embedding: p.embedding,
    }))
    .sort((a, b) => b.sim - a.sim);

  const autoLinked: VoicePostProcessSummary["autoLinked"] = [];
  const assignedSpeakers = new Set<string>();
  const usedPersons = new Set<string>();
  for (const e of edges) {
    if (assignedSpeakers.has(e.speakerId) || usedPersons.has(e.personId)) {
      continue;
    }
    setSpeakerMatch({
      meetingId: opts.meetingId,
      speakerId: e.speakerId,
      voiceLibraryId: e.personId,
      matchConfidence: e.sim,
      needsReview: false,
      displayName: e.name,
    });
    if (e.embedding) {
      mergeIntoLibrary({ libraryId: e.personId, newEmbedding: e.embedding });
    }
    assignedSpeakers.add(e.speakerId);
    usedPersons.add(e.personId);
    autoLinked.push({
      speakerId: e.speakerId,
      displayName: e.name,
      confidence: e.sim,
    });
  }

  // Pass 3 — anything that produced an embedding but didn't auto-assign is
  // flagged for review, keeping its generic label + the best candidate's score
  // so the panel can still surface "did you mean X?". Clusters with no
  // embedding are left untouched (same as before — no review noise for them).
  let needsReviewCount = 0;
  for (const p of pending) {
    if (assignedSpeakers.has(p.speakerId) || !p.embedding) continue;
    setSpeakerMatch({
      meetingId: opts.meetingId,
      speakerId: p.speakerId,
      voiceLibraryId: null,
      matchConfidence: p.verdict?.best?.similarity ?? null,
      needsReview: true,
      displayName: p.fallbackName,
    });
    needsReviewCount++;
  }

  return { autoLinked, needsReviewCount };
}

/**
 * Pick the longest segment attributed to `speakerId` and trim it to a
 * "distinctive" sample window: skip the first 0.5s (often a breath or
 * trailing fragment from the previous speaker) and cap at 8s. Returns null
 * when no segments were attributed to this speaker — caller should fall back
 * to whatever the sidecar suggested.
 *
 * Why longest: pyannote occasionally splits a single utterance into two
 * adjacent segments, but the longest is virtually always a clean run from
 * the same speaker. Picking it over the first segment avoids capturing
 * common phrases like "yeah, exactly" that don't carry much voice
 * information.
 */
function pickDistinctSampleWindow(
  segments: RunResult["segments"],
  speakerId: string,
): { startMs: number; endMs: number } | null {
  const OFFSET_MS = 500;
  const MAX_MS = 8000;
  const MIN_USABLE_MS = 1500;
  let best: { start: number; end: number; dur: number } | null = null;
  for (const seg of segments) {
    if (seg.speaker !== speakerId) continue;
    const dur = seg.end_ms - seg.start_ms;
    if (!best || dur > best.dur) {
      best = { start: seg.start_ms, end: seg.end_ms, dur };
    }
  }
  if (!best) return null;
  // Apply the 0.5s offset only when there's enough room for a usable clip
  // after it; otherwise short interjections would shrink to a click.
  if (best.dur >= MIN_USABLE_MS + OFFSET_MS) {
    const startMs = best.start + OFFSET_MS;
    const endMs = Math.min(best.end, startMs + MAX_MS);
    return { startMs, endMs };
  }
  return {
    startMs: best.start,
    endMs: Math.min(best.end, best.start + MAX_MS),
  };
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function prettySpeakerName(speakerId: string, idx: number): string {
  const m = /SPEAKER_(\d+)/.exec(speakerId);
  if (m) return `Speaker ${Number(m[1]) + 1}`;
  return `Speaker ${idx + 1}`;
}
