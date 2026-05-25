import { app, BrowserWindow } from "electron";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  deleteTranscriptForMeeting,
  getMeeting,
  insertTranscriptSegment,
  setSpeakerEmbedding,
  setSpeakerMatch,
  setStatus,
  updatePipeline,
  upsertSpeaker,
} from "./db.js";
import type { Pipeline } from "./db.js";
import { extractClip, mixToMono16k } from "./audio-mix.js";
import { speakerHintForMeeting } from "./calendar.js";
import {
  isInstalled as sidecarInstalled,
  runWhisperX,
  type RunResult,
  type SpeakerEmbedding,
} from "./python-sidecar.js";
import { getHfToken } from "./settings.js";
import {
  AUTO_THRESHOLD,
  findBestMatch,
  mergeIntoLibrary,
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
  emitProgress(opts.meetingId, { stage: "mixing", pct: 4, note: "ffmpeg" });
  await mixToMono16k({
    micWavPath: meeting.mic_wav_path,
    sysWavPath: meeting.sys_wav_path,
    outputPath: mixedPath,
    targetSampleRate: 16000,
  });

  const hfToken = await getHfToken();
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
      language: "auto",
      diarize: !!hfToken,
      hfToken: hfToken ?? undefined,
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

  deleteTranscriptForMeeting(opts.meetingId);
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
  }
  return {
    ok: true,
    segments: count,
    speakers: speakerLabels.size,
    mixedPath,
  };
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
  const autoLinked: VoicePostProcessSummary["autoLinked"] = [];
  let needsReviewCount = 0;

  for (const sp of opts.speakers) {
    if (!sp.id) continue;
    const fallbackName =
      opts.defaultLabels.get(sp.id) ?? prettySpeakerName(sp.id, 0);

    // 1) Extract a distinctive sample wav clip so the UI can play a preview
    //    later. We deliberately ignore the sidecar-supplied window — it picks
    //    the first segment, which tends to capture greetings and crosstalk.
    //    Instead, pick the speaker's longest solo segment so the user has the
    //    clearest possible voice fingerprint to identify.
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

    // 2) Persist embedding + clip path on the per-meeting speaker row.
    const embedding = sp.embedding ? new Float32Array(sp.embedding) : null;
    setSpeakerEmbedding({
      meetingId: opts.meetingId,
      speakerId: sp.id,
      embedding,
      sampleClipPath,
    });

    if (!embedding) continue;

    // 3) Cross-meeting match against the voice library.
    const verdict = findBestMatch(embedding);
    if (verdict.decision === "auto-assign" && verdict.best) {
      setSpeakerMatch({
        meetingId: opts.meetingId,
        speakerId: sp.id,
        voiceLibraryId: verdict.best.entry.id,
        matchConfidence: verdict.best.similarity,
        needsReview: false,
        displayName: verdict.best.entry.display_name,
      });
      mergeIntoLibrary({
        libraryId: verdict.best.entry.id,
        newEmbedding: embedding,
      });
      autoLinked.push({
        speakerId: sp.id,
        displayName: verdict.best.entry.display_name,
        confidence: verdict.best.similarity,
      });
    } else if (verdict.decision === "needs-review" && verdict.best) {
      // Keep generic "Speaker N" label until the user confirms or rejects.
      setSpeakerMatch({
        meetingId: opts.meetingId,
        speakerId: sp.id,
        voiceLibraryId: null,
        matchConfidence: verdict.best.similarity,
        needsReview: true,
        displayName: fallbackName,
      });
      needsReviewCount++;
    } else {
      setSpeakerMatch({
        meetingId: opts.meetingId,
        speakerId: sp.id,
        voiceLibraryId: null,
        matchConfidence: null,
        needsReview: true,
        displayName: fallbackName,
      });
      needsReviewCount++;
    }
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

// Suppress "unused" warning when AUTO_THRESHOLD is re-exported elsewhere.
void AUTO_THRESHOLD;

function prettySpeakerName(speakerId: string, idx: number): string {
  const m = /SPEAKER_(\d+)/.exec(speakerId);
  if (m) return `Speaker ${Number(m[1]) + 1}`;
  return `Speaker ${idx + 1}`;
}
