"use client";

type AudioChannel = "mic" | "system";

export interface CaptureHandle {
  stop(): Promise<void>;
  getLevel(channel: AudioChannel): number;
}

export interface CaptureOptions {
  meetingId: string;
  onError?: (err: Error) => void;
}

const WORKLET_URL = "/audio-worklets/pcm-tap.worklet.js";

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

export async function startCapture(opts: CaptureOptions): Promise<CaptureHandle> {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  await ctx.audioWorklet.addModule(WORKLET_URL);

  const levels: Record<AudioChannel, number> = { mic: 0, system: 0 };
  const teardowns: Array<() => void> = [];

  try {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    const mic = await buildPipeline(ctx, micStream, "mic", opts.meetingId, levels);
    teardowns.push(mic.teardown);
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
      opts.onError?.(new Error("System audio not available — grant Screen Recording permission."));
    } else {
      for (const t of sysStream.getVideoTracks()) t.stop();
      const audioOnly = new MediaStream(audioTracks);
      const sys = await buildPipeline(ctx, audioOnly, "system", opts.meetingId, levels);
      teardowns.push(sys.teardown);
    }
  } catch (err) {
    opts.onError?.(err instanceof Error ? err : new Error(String(err)));
  }

  return {
    async stop() {
      for (const t of teardowns) t();
      await ctx.close();
    },
    getLevel(channel) {
      return levels[channel];
    },
  };
}
