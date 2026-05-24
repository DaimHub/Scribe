// AudioWorklet processor that batches mono Float32 PCM frames and posts them to the main thread.
// Loaded via audioContext.audioWorklet.addModule("/audio-worklets/pcm-tap.worklet.js")
// then instantiated as new AudioWorkletNode(audioContext, "scribe-pcm-tap", { processorOptions: { batchSamples } }).

class PcmTapProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const batch = options?.processorOptions?.batchSamples ?? 4800; // ~100ms at 48kHz
    this.batchSize = batch;
    this.buffer = new Float32Array(this.batchSize);
    this.cursor = 0;
    // Per Web Audio spec, process() always gets 128 frames per channel. Hoist
    // the downmix scratch out of the hot path so multi-channel input doesn't
    // allocate 375×/sec on the audio thread.
    this.monoBuffer = new Float32Array(128);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch = input[0]; // mono — average channels if multi
    if (!ch) return true;

    let mono = ch;
    let monoLen = ch.length;
    if (input.length > 1) {
      if (this.monoBuffer.length < ch.length) {
        this.monoBuffer = new Float32Array(ch.length);
      }
      mono = this.monoBuffer;
      monoLen = ch.length;
      const inv = 1 / input.length;
      for (let i = 0; i < ch.length; i++) {
        let sum = 0;
        for (let c = 0; c < input.length; c++) sum += input[c][i] ?? 0;
        mono[i] = sum * inv;
      }
    }

    let offset = 0;
    while (offset < monoLen) {
      const space = this.batchSize - this.cursor;
      const take = Math.min(space, monoLen - offset);
      this.buffer.set(mono.subarray(offset, offset + take), this.cursor);
      this.cursor += take;
      offset += take;
      if (this.cursor >= this.batchSize) {
        // Transfer the full buffer (cursor === batchSize at this point) instead
        // of slicing — saves an alloc + copy of `batchSize` floats per flush.
        const out = this.buffer;
        this.buffer = new Float32Array(this.batchSize);
        this.cursor = 0;
        this.port.postMessage(out, [out.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("scribe-pcm-tap", PcmTapProcessor);
