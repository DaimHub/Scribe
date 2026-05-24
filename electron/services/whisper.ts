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
import {
  isInstalled as sidecarInstalled,
  runWhisperX,
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
  const pipeline: Pipeline = {};
  const result = await runWhisperX(
    {
      wav: mixedPath,
      model: opts.model ?? "large-v3-turbo",
      language: "auto",
      diarize: !!hfToken,
      hfToken: hfToken ?? undefined,
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
  let autoAssigned = 0;
  let flaggedForReview = 0;
  if (wasDiarized && result.speakers && result.speakers.length > 0) {
    try {
      const speakersDir = path.join(workDir, "speakers");
      await mkdir(speakersDir, { recursive: true });
      const matchSummary = await matchSpeakersAgainstLibrary({
        meetingId: opts.meetingId,
        speakersDir,
        mixedWavPath: mixedPath,
        speakers: result.speakers,
        defaultLabels: speakerLabels,
      });
      autoAssigned = matchSummary.autoAssigned;
      flaggedForReview = matchSummary.flaggedForReview;
    } catch (err) {
      console.warn("[whisper] voice-library matching failed:", err);
    }
  }

  setStatus(opts.meetingId, wasDiarized ? "diarized" : "transcribed");
  const matchNote =
    wasDiarized && result.speakers && result.speakers.length > 0
      ? `, ${autoAssigned} auto-tagged${
          flaggedForReview > 0 ? `, ${flaggedForReview} to review` : ""
        }`
      : "";
  emitProgress(opts.meetingId, {
    stage: "done",
    pct: 100,
    note: `${count} segments, ${speakerLabels.size} speaker(s)${matchNote}`,
  });
  return {
    ok: true,
    segments: count,
    speakers: speakerLabels.size,
    mixedPath,
  };
}

async function matchSpeakersAgainstLibrary(opts: {
  meetingId: string;
  speakersDir: string;
  mixedWavPath: string;
  speakers: SpeakerEmbedding[];
  defaultLabels: Map<string, string>;
}): Promise<{ autoAssigned: number; flaggedForReview: number }> {
  let autoAssigned = 0;
  let flaggedForReview = 0;

  for (const sp of opts.speakers) {
    if (!sp.id) continue;
    const fallbackName =
      opts.defaultLabels.get(sp.id) ?? prettySpeakerName(sp.id, 0);

    // 1) Extract a sample wav clip so the UI can play a preview later.
    let sampleClipPath: string | null = null;
    if (sp.sample_end_ms > sp.sample_start_ms) {
      const out = path.join(opts.speakersDir, `${safeFilename(sp.id)}.wav`);
      try {
        await extractClip({
          inputWavPath: opts.mixedWavPath,
          startMs: sp.sample_start_ms,
          endMs: sp.sample_end_ms,
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
      autoAssigned++;
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
      flaggedForReview++;
    } else {
      setSpeakerMatch({
        meetingId: opts.meetingId,
        speakerId: sp.id,
        voiceLibraryId: null,
        matchConfidence: null,
        needsReview: true,
        displayName: fallbackName,
      });
      flaggedForReview++;
    }
  }

  return { autoAssigned, flaggedForReview };
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
