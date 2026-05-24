import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import ffmpegStatic from "ffmpeg-static";

const exec = promisify(execFile);

const FFMPEG = (ffmpegStatic as unknown as string) ?? "ffmpeg";

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export interface MixOpts {
  micWavPath: string | null;
  sysWavPath: string | null;
  outputPath: string;
  targetSampleRate?: number;
}

export async function mixToMono16k(opts: MixOpts): Promise<string> {
  const sr = opts.targetSampleRate ?? 16000;
  const hasMic = opts.micWavPath ? await exists(opts.micWavPath) : false;
  const hasSys = opts.sysWavPath ? await exists(opts.sysWavPath) : false;

  if (!hasMic && !hasSys) {
    throw new Error("No audio inputs available to mix.");
  }

  const args: string[] = ["-y", "-loglevel", "error"];

  if (hasMic) args.push("-i", opts.micWavPath!);
  if (hasSys) args.push("-i", opts.sysWavPath!);

  if (hasMic && hasSys) {
    args.push(
      "-filter_complex",
      "[0:a][1:a]amix=inputs=2:normalize=0:duration=longest[mix]",
      "-map",
      "[mix]",
    );
  } else {
    args.push("-map", "0:a");
  }

  args.push("-ar", String(sr), "-ac", "1", "-c:a", "pcm_s16le", opts.outputPath);

  await exec(FFMPEG, args);
  return opts.outputPath;
}

export async function ffmpegBinary(): Promise<string> {
  return FFMPEG;
}

export interface ExtractClipOpts {
  inputWavPath: string;
  startMs: number;
  endMs: number;
  outputPath: string;
  targetSampleRate?: number;
}

/** Crop a [startMs, endMs] window out of a wav file. Used to save a short
 *  voice sample per speaker for the tagging UI. */
export async function extractClip(opts: ExtractClipOpts): Promise<string> {
  const sr = opts.targetSampleRate ?? 16000;
  const startSec = (opts.startMs / 1000).toFixed(3);
  const durSec = ((opts.endMs - opts.startMs) / 1000).toFixed(3);
  if (Number(durSec) <= 0) {
    throw new Error("Invalid clip range");
  }
  await exec(FFMPEG, [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    startSec,
    "-t",
    durSec,
    "-i",
    opts.inputWavPath,
    "-ar",
    String(sr),
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    opts.outputPath,
  ]);
  return opts.outputPath;
}
