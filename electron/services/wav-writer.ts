import { createWriteStream, type WriteStream } from "node:fs";
import { open, stat, FileHandle } from "node:fs/promises";

const RIFF_HEADER_BYTES = 44;

export interface WavWriterOpts {
  filePath: string;
  sampleRate: number;
  numChannels: number;
  bitsPerSample: 16;
}

export class WavWriter {
  private readonly opts: WavWriterOpts;
  private stream: WriteStream;
  private bytesWritten = 0;
  private closed = false;
  // Reused Int16 conversion buffer. Audio frames arrive at a roughly constant
  // size (~4800 samples = 9600 bytes), so a single allocation amortizes
  // across the whole recording instead of one per chunk.
  private convBuf: Buffer = Buffer.allocUnsafe(0);
  private peakSample = 0;

  constructor(opts: WavWriterOpts) {
    this.opts = opts;
    this.stream = createWriteStream(opts.filePath, { flags: "w" });
    // Write the full header up front (data size = 0). If the app crashes
    // before finalize(), the file still has a valid format chunk so a
    // recovery pass only needs to patch the size fields from disk dimensions.
    this.stream.write(buildHeader(opts, 0));
    this.bytesWritten = RIFF_HEADER_BYTES;
  }

  writeFloat32Samples(samples: Float32Array): void {
    if (this.closed) return;
    const byteLen = samples.length * 2;
    if (this.convBuf.length < byteLen) {
      this.convBuf = Buffer.allocUnsafe(byteLen);
    }
    const buf = this.convBuf;
    let peak = this.peakSample;
    for (let i = 0; i < samples.length; i++) {
      const raw = samples[i];
      const s = Math.max(-1, Math.min(1, raw));
      const v = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
      buf.writeInt16LE(v, i * 2);
      const abs = raw < 0 ? -raw : raw;
      if (abs > peak) peak = abs;
    }
    this.peakSample = peak;
    // WriteStream copies its input into its internal buffer, so it's safe to
    // reuse `convBuf` on the next call without waiting for `drain`.
    this.stream.write(buf.subarray(0, byteLen));
    this.bytesWritten += byteLen;
  }

  writeInt16Samples(samples: Int16Array): void {
    if (this.closed) return;
    const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    this.stream.write(buf);
    this.bytesWritten += buf.length;
  }

  async finalize(): Promise<{ filePath: string; bytes: number; durationMs: number; peakSample: number }> {
    if (this.closed) {
      return {
        filePath: this.opts.filePath,
        bytes: this.bytesWritten,
        durationMs: this.estimatedDurationMs(),
        peakSample: this.peakSample,
      };
    }
    this.closed = true;
    await new Promise<void>((resolve, reject) => {
      this.stream.end((err: NodeJS.ErrnoException | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await this.patchHeader();
    return {
      filePath: this.opts.filePath,
      bytes: this.bytesWritten,
      durationMs: this.estimatedDurationMs(),
      peakSample: this.peakSample,
    };
  }

  private estimatedDurationMs(): number {
    const dataBytes = this.bytesWritten - RIFF_HEADER_BYTES;
    const bytesPerSec = this.opts.sampleRate * this.opts.numChannels * 2;
    return Math.round((dataBytes / bytesPerSec) * 1000);
  }

  private async patchHeader(): Promise<void> {
    const dataSize = this.bytesWritten - RIFF_HEADER_BYTES;
    const header = buildHeader(this.opts, dataSize);
    let fh: FileHandle | null = null;
    try {
      fh = await open(this.opts.filePath, "r+");
      await fh.write(header, 0, header.length, 0);
    } finally {
      await fh?.close();
    }
  }
}

function buildHeader(
  opts: Pick<WavWriterOpts, "sampleRate" | "numChannels" | "bitsPerSample">,
  dataSize: number,
): Buffer {
  const { sampleRate, numChannels, bitsPerSample } = opts;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const h = Buffer.alloc(RIFF_HEADER_BYTES);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + dataSize, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(numChannels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34);
  h.write("data", 36);
  h.writeUInt32LE(dataSize, 40);
  return h;
}

/**
 * Patch the size fields in a WAV file's header from the actual file size on
 * disk. Used to recover a recording whose `finalize()` never ran (app crashed
 * mid-record). Returns null if the file doesn't exist or its format chunk
 * looks corrupt.
 */
export async function recoverWavFile(
  filePath: string,
): Promise<{ sampleRate: number; durationMs: number; bytes: number } | null> {
  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    return null;
  }
  if (stats.size <= RIFF_HEADER_BYTES) return null;

  let fh: FileHandle | null = null;
  try {
    fh = await open(filePath, "r+");
    const head = Buffer.alloc(RIFF_HEADER_BYTES);
    await fh.read(head, 0, RIFF_HEADER_BYTES, 0);
    if (head.toString("ascii", 0, 4) !== "RIFF") return null;
    if (head.toString("ascii", 8, 12) !== "WAVE") return null;
    const numChannels = head.readUInt16LE(22);
    const sampleRate = head.readUInt32LE(24);
    const bitsPerSample = head.readUInt16LE(34);
    if (!sampleRate || !numChannels || !bitsPerSample) return null;

    const dataSize = stats.size - RIFF_HEADER_BYTES;
    const patched = buildHeader(
      { sampleRate, numChannels, bitsPerSample: 16 },
      dataSize,
    );
    await fh.write(patched, 0, patched.length, 0);
    const bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8);
    return {
      sampleRate,
      bytes: stats.size,
      durationMs: Math.round((dataSize / bytesPerSec) * 1000),
    };
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}
