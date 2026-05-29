"use client";

type AudioChannel = "mic" | "system";

export interface CaptureHandle {
  stop(): Promise<void>;
  getLevel(channel: AudioChannel): number;
  /**
   * Swap the active microphone mid-recording. Tears down the current mic
   * pipeline and rebuilds it against `deviceId` (or the system default when
   * undefined), reusing the same AudioContext so the WAV writer keeps the same
   * channel + sample rate. Frames briefly pause during the swap.
   */
  setMicDevice(deviceId: string | undefined): Promise<void>;
}

export interface CaptureOptions {
  meetingId: string;
  /** Preferred microphone deviceId; falls back to the system default. */
  micDeviceId?: string;
  onError?: (err: Error) => void;
  /**
   * System (other-participant) audio is best-effort — it needs Screen Recording
   * permission on macOS. When it can't be captured the mic keeps recording, so
   * this is surfaced as a soft, actionable notice rather than a hard error.
   */
  onSystemAudioUnavailable?: () => void;
}

// Path to the PCM tap AudioWorklet (copied verbatim from public/ to the web root).
const WORKLET_PATH = "audio-worklets/pcm-tap.worklet.js";

// In the packaged app the renderer loads via file:// from out/index.html, where a
// leading "/" points at the filesystem root and addModule fails ("Unable to load a
// worklet's module."). Resolve relative to the document there; over http (dev) the
// web root works either way.
function workletUrl(): string {
  return window.location.protocol === "file:"
    ? new URL(WORKLET_PATH, document.baseURI).href
    : `/${WORKLET_PATH}`;
}

async function buildPipeline(
  ctx: AudioContext,
  stream: MediaStream,
  channel: AudioChannel,
  meetingId: string,
  levels: Record<AudioChannel, number>,
): Promise<{ teardown: () => void }> {
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "scribe-pcm-tap", {
    processorOptions: { batchSamples: Math.round(ctx.sampleRate * 0.1) },
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
  });

  node.port.onmessage = (e) => {
    const samples = e.data as Float32Array;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    levels[channel] = peak;
    window.scribe.audio.sendFrames(
      meetingId,
      channel,
      ctx.sampleRate,
      samples.buffer as ArrayBuffer,
    );
  };

  source.connect(node);

  return {
    teardown() {
      try {
        source.disconnect();
        node.disconnect();
        node.port.close();
      } catch (err) {
        // Don't throw — recording is already over and the user can't act on
        // this — but log so leaked AudioContexts are visible in devtools.
        console.warn(`audio-capture teardown (${channel}):`, err);
      }
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

async function startMic(
  ctx: AudioContext,
  deviceId: string | undefined,
  meetingId: string,
  levels: Record<AudioChannel, number>,
): Promise<{ teardown: () => void }> {
  const micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // `ideal` rather than `exact` so a stale/missing deviceId degrades to the
      // system default instead of failing capture outright.
      deviceId: deviceId ? { ideal: deviceId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });
  return buildPipeline(ctx, micStream, "mic", meetingId, levels);
}

export async function startCapture(opts: CaptureOptions): Promise<CaptureHandle> {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  await ctx.audioWorklet.addModule(workletUrl());

  const levels: Record<AudioChannel, number> = { mic: 0, system: 0 };
  let micPipeline: { teardown: () => void } | null = null;
  let sysTeardown: (() => void) | null = null;

  try {
    micPipeline = await startMic(ctx, opts.micDeviceId, opts.meetingId, levels);
  } catch (err) {
    opts.onError?.(err instanceof Error ? err : new Error(String(err)));
  }

  try {
    const sysStream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });
    const audioTracks = sysStream.getAudioTracks();
    if (audioTracks.length === 0) {
      for (const t of sysStream.getTracks()) t.stop();
      throw new Error("getDisplayMedia returned no audio track");
    }
    for (const t of sysStream.getVideoTracks()) t.stop();
    const audioOnly = new MediaStream(audioTracks);
    const sys = await buildPipeline(ctx, audioOnly, "system", opts.meetingId, levels);
    sysTeardown = sys.teardown;
  } catch (err) {
    // Best-effort: the mic is already recording, so losing system audio isn't
    // fatal. The usual cause on macOS is missing Screen Recording permission —
    // the desktop capturer then finds no sources and getDisplayMedia rejects
    // with the opaque "Invalid capture constraints". Surface a soft notice
    // (with an actionable "open settings" affordance) instead of a hard error.
    console.warn("audio-capture: system audio capture failed:", err);
    opts.onSystemAudioUnavailable?.();
  }

  return {
    async stop() {
      micPipeline?.teardown();
      sysTeardown?.();
      await ctx.close();
    },
    getLevel(channel) {
      return levels[channel];
    },
    async setMicDevice(deviceId) {
      micPipeline?.teardown();
      micPipeline = null;
      levels.mic = 0;
      try {
        micPipeline = await startMic(ctx, deviceId, opts.meetingId, levels);
      } catch (err) {
        opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
  };
}
