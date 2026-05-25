import { app } from "electron";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { WavWriter } from "./wav-writer.js";
import { createMeeting, finalizeMeeting } from "./db.js";

export type AudioChannel = "mic" | "system";

export interface ActiveMeeting {
  meetingId: string;
  startedAtMs: number;
  startedAtPerf: number;
  dir: string;
  writers: Partial<Record<AudioChannel, WavWriter>>;
  sampleRates: Partial<Record<AudioChannel, number>>;
}

export interface MeetingResult {
  meetingId: string;
  micWavPath: string | null;
  sysWavPath: string | null;
  durationMs: number;
  startedAtMs: number;
  endedAtMs: number;
}

const active = new Map<string, ActiveMeeting>();

function meetingsRoot(): string {
  return path.join(app.getPath("userData"), "meetings");
}

export async function startMeeting(opts?: {
  title?: string;
}): Promise<{ meetingId: string; dir: string }> {
  const meetingId = randomUUID();
  const dir = path.join(meetingsRoot(), meetingId);
  await mkdir(dir, { recursive: true });
  const startedAtMs = Date.now();
  const startedAtPerf = performance.now();
  active.set(meetingId, {
    meetingId,
    startedAtMs,
    startedAtPerf,
    dir,
    writers: {},
    sampleRates: {},
  });
  createMeeting({ id: meetingId, title: opts?.title, startedAtMs });
  return { meetingId, dir };
}

export function appendFrames(
  meetingId: string,
  channel: AudioChannel,
  samples: Float32Array,
  sampleRate: number,
): void {
  const meeting = active.get(meetingId);
  if (!meeting) return;
  let writer = meeting.writers[channel];
  if (!writer) {
    const filePath = path.join(meeting.dir, `${channel}.wav`);
    writer = new WavWriter({
      filePath,
      sampleRate,
      numChannels: 1,
      bitsPerSample: 16,
    });
    meeting.writers[channel] = writer;
    meeting.sampleRates[channel] = sampleRate;
  }
  writer.writeFloat32Samples(samples);
}

export async function stopMeeting(meetingId: string): Promise<MeetingResult> {
  const meeting = active.get(meetingId);
  if (!meeting) {
    throw new Error(`No active meeting with id ${meetingId}`);
  }
  active.delete(meetingId);

  const micWriter = meeting.writers.mic;
  const sysWriter = meeting.writers.system;
  const [micResult, sysResult] = await Promise.all([
    micWriter ? micWriter.finalize() : Promise.resolve(null),
    sysWriter ? sysWriter.finalize() : Promise.resolve(null),
  ]);

  // Flag silent capture so it doesn't slip past unnoticed (the WAV file still
  // exists at full duration so the symptom is otherwise invisible until
  // transcription returns no system-speaker text). -60 dBFS ≈ peak 0.001.
  if (sysResult && sysResult.peakSample < 0.001 && sysResult.durationMs > 1000) {
    console.warn(
      `[recorder] system audio appears silent for meeting ${meetingId} ` +
        `(peak=${sysResult.peakSample.toExponential(2)}, ` +
        `dur=${(sysResult.durationMs / 1000).toFixed(1)}s). ` +
        `Check Screen Recording permission and that output device wasn't muted/redirected.`,
    );
  }
  if (micResult && micResult.peakSample < 0.001 && micResult.durationMs > 1000) {
    console.warn(
      `[recorder] mic audio appears silent for meeting ${meetingId} ` +
        `(peak=${micResult.peakSample.toExponential(2)}, ` +
        `dur=${(micResult.durationMs / 1000).toFixed(1)}s).`,
    );
  }

  const endedAtMs = Date.now();
  const result: MeetingResult = {
    meetingId,
    micWavPath: micResult?.filePath ?? null,
    sysWavPath: sysResult?.filePath ?? null,
    durationMs: endedAtMs - meeting.startedAtMs,
    startedAtMs: meeting.startedAtMs,
    endedAtMs,
  };
  finalizeMeeting({
    id: meetingId,
    endedAtMs,
    durationMs: result.durationMs,
    micWavPath: result.micWavPath,
    sysWavPath: result.sysWavPath,
  });
  return result;
}

export function isActive(meetingId: string): boolean {
  return active.has(meetingId);
}
