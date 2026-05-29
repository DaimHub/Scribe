import { app } from "electron";
import path from "node:path";
import { access, mkdir, stat, unlink } from "node:fs/promises";
import { constants, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type {
  LlmGenerateOpts,
  LlmProviderInstance,
} from "./types.js";
import { LlmProviderConfigError } from "./types.js";

export type LlmModel =
  | "gemma-3-4b"
  | "gemma-3-12b"
  | "llama-3.2-3b"
  | "qwen-2.5-7b";

export const BUNDLED_LLM_MODELS: LlmModel[] = [
  "gemma-3-4b",
  "gemma-3-12b",
  "llama-3.2-3b",
  "qwen-2.5-7b",
];

interface BundledModelDef {
  /** Stable identifier persisted in settings. */
  id: LlmModel;
  /** Human-readable label for UI rows. */
  displayName: string;
  /** Approximate on-disk size in megabytes. Used by the UI to set
   *  expectations before the download starts — the actual stream emits
   *  a `total` from the Content-Length header which we surface live. */
  approxSizeMb: number;
  /** Direct download URL of the GGUF weights on HuggingFace. */
  url: string;
  /** Local filename under userData/models. */
  file: string;
}

const MODEL_DEFS: Record<LlmModel, BundledModelDef> = {
  "gemma-3-4b": {
    id: "gemma-3-4b",
    displayName: "Gemma 3 (4B)",
    approxSizeMb: 2500,
    url: "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
    file: "google_gemma-3-4b-it-Q4_K_M.gguf",
  },
  "gemma-3-12b": {
    id: "gemma-3-12b",
    displayName: "Gemma 3 (12B)",
    approxSizeMb: 7100,
    url: "https://huggingface.co/bartowski/google_gemma-3-12b-it-GGUF/resolve/main/google_gemma-3-12b-it-Q4_K_M.gguf",
    file: "google_gemma-3-12b-it-Q4_K_M.gguf",
  },
  "llama-3.2-3b": {
    id: "llama-3.2-3b",
    displayName: "Llama 3.2 (3B)",
    approxSizeMb: 2000,
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    file: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
  },
  "qwen-2.5-7b": {
    id: "qwen-2.5-7b",
    displayName: "Qwen 2.5 (7B)",
    approxSizeMb: 4400,
    url: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    file: "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
  },
};

export function isBundledModel(s: string): s is LlmModel {
  return (BUNDLED_LLM_MODELS as string[]).includes(s);
}

export function getBundledModelDef(model: LlmModel): BundledModelDef {
  return MODEL_DEFS[model];
}

function bundledLabel(model: LlmModel): string {
  // gemma-3-4b → "gemma · 3-4b", llama-3.2-3b → "llama · 3.2-3b"
  const m = /^([a-z]+)-(.+)$/.exec(model);
  return m ? `${m[1]} · ${m[2]}` : model;
}

function modelsDir(): string {
  return path.join(app.getPath("userData"), "models");
}

function modelPath(model: LlmModel): string {
  return path.join(modelsDir(), MODEL_DEFS[model].file);
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** True when the model file exists on disk and looks complete enough to
 *  load (i.e. not a 0-byte aborted download). The 100 MB threshold is a
 *  generous lower bound — even the smallest bundled model is >2 GB. */
export async function isBundledModelDownloaded(
  model: LlmModel,
): Promise<boolean> {
  const dest = modelPath(model);
  if (!(await exists(dest))) return false;
  const s = await stat(dest);
  return s.size > 100_000_000;
}

/** Thrown by `BundledProvider.generate()` when the selected model isn't
 *  on disk yet. The UI catches this and tells the user to open Settings
 *  and download the model — generation never auto-downloads anymore,
 *  because lazy downloads of multi-GB files mid-process were surprising
 *  the user (no progress bar, no cancel, no "is it stuck?"). */
export class BundledModelNotDownloadedError extends Error {
  constructor(public readonly model: LlmModel) {
    super(
      `Bundled LLM "${model}" is not downloaded yet. Open Settings → AI provider to download it first.`,
    );
    this.name = "BundledModelNotDownloadedError";
  }
}

export interface DownloadProgress {
  downloadedBytes: number;
  /** Bytes the HTTP response says we'll receive total, when Content-Length
   *  is present. Null on servers that don't return it (rare on HF). */
  totalBytes: number | null;
}

/** Download (or re-download) a bundled model. Streams progress via the
 *  callback. Returns the absolute path of the GGUF on disk. */
export async function downloadBundledModel(
  model: LlmModel,
  onProgress?: (p: DownloadProgress) => void,
): Promise<string> {
  await mkdir(modelsDir(), { recursive: true });
  const def = MODEL_DEFS[model];
  const dest = path.join(modelsDir(), def.file);
  const res = await fetch(def.url);
  if (!res.ok || !res.body) {
    throw new Error(
      `Model download failed for ${model}: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const total = Number(res.headers.get("content-length") ?? "") || null;
  let downloaded = 0;
  // Emit an initial 0% tick so the UI can switch from "Downloading…" to a
  // progress bar without waiting for the first chunk (which can take
  // seconds on a cold connection).
  onProgress?.({ downloadedBytes: 0, totalBytes: total });
  const ts = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = res.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          downloaded += value.byteLength;
          onProgress?.({ downloadedBytes: downloaded, totalBytes: total });
          controller.enqueue(value);
        }
      }
      controller.close();
    },
  });
  await pipeline(
    Readable.fromWeb(
      ts as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
    ),
    createWriteStream(dest),
  );
  return dest;
}

// LLM no longer runs in-process. See electron/llm-worker.cjs for the why —
// short version: node-llama-cpp's Metal backend has a reproducible segfault
// on Apple Silicon during sequence init that takes down the whole Electron
// process, including any in-flight recording. Forking into a child contains
// the blast radius.
let activeWorker: ChildProcess | null = null;

export async function disposeCachedLlmModel(): Promise<void> {
  if (activeWorker && !activeWorker.killed) {
    activeWorker.kill("SIGTERM");
    activeWorker = null;
  }
}

/** Remove a bundled model's .gguf from disk and free its worker if loaded.
 *  No-op if the file isn't there (already deleted, never downloaded). The
 *  caller is responsible for refusing this while a download is in flight —
 *  unlinking a half-written file would leave the streaming pipeline writing
 *  into a ghost inode on macOS/Linux and a hard error on Windows. */
export async function deleteBundledModel(model: LlmModel): Promise<void> {
  await disposeCachedLlmModel();
  const dest = modelPath(model);
  try {
    await unlink(dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

function locateWorkerScript(): string {
  // dist-electron/services/llm-providers/bundled.js → ../../llm-worker.cjs
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "llm-worker.cjs");
}

interface WorkerResult {
  raw: string;
  /** Tokenizer counts surfaced from the worker. Undefined when the model's
   *  tokenizer threw during the count step (we don't fail generation over
   *  missing telemetry). */
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

// Lines emitted by the llama.cpp Metal backend's static-destructor abort on
// process exit (`GGML_ASSERT([rsets->data count] == 0)`). The result has
// already been sent over IPC before exit, so the assert is purely cosmetic —
// it's a benign refcount check during process teardown. Filter the well-known
// signature so we don't print a 30-line "crash" stack on every successful
// generation. See: https://github.com/ggml-org/llama.cpp/pull/17869.
const GGML_CLEANUP_NOISE_PATTERNS = [
  /ggml-metal-device/,
  /GGML_ASSERT/,
  /GGML_BACKTRACE_LLDB/,
  /Using native backtrace/,
  /github\.com\/ggml-org\/llama\.cpp/,
  /ggml_print_backtrace/,
  /ggml_abort/,
];
// Stack frame: "  0  libggml-base.dylib   0x000000010919944c ggml_print_backtrace + 276"
// or with module unknown: "  10  ???   0x0000000177dd03cc 0x0 + 6305940428"
const STACK_FRAME_PATTERN = /^\s*\d+\s+\S+\s+0x[0-9a-f]+/i;

function isGgmlCleanupNoise(line: string): boolean {
  if (STACK_FRAME_PATTERN.test(line)) return true;
  for (const re of GGML_CLEANUP_NOISE_PATTERNS) if (re.test(line)) return true;
  return false;
}

function pipeStderrFiltered(stream: NodeJS.ReadableStream): void {
  let buf = "";
  stream.setEncoding?.("utf8");
  stream.on("data", (chunk: string) => {
    buf += chunk;
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      if (isGgmlCleanupNoise(line)) continue;
      process.stderr.write(`${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buf && !isGgmlCleanupNoise(buf)) process.stderr.write(buf);
  });
}

function runLlmWorker(
  payload: {
    modelPath: string;
    prompt: string;
    schema: unknown;
    maxTokens: number;
    temperature: number;
    contextSize: number;
    badge: string;
  },
  onProgress: (
    stage: string,
    pct: number,
    note?: string,
    model?: string,
  ) => void,
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = fork(locateWorkerScript(), [], {
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    if (child.stderr) pipeStderrFiltered(child.stderr);
    activeWorker = child;

    let settled = false;
    const finishOk = (r: WorkerResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const finishErr = (e: Error) => {
      if (settled) return;
      settled = true;
      reject(e);
    };

    child.on("message", (msg: { type: string; [k: string]: unknown }) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "progress") {
        onProgress(
          (msg.stage as string) ?? "",
          (msg.pct as number) ?? 0,
          msg.note as string | undefined,
          msg.model as string | undefined,
        );
      } else if (msg.type === "result" && typeof msg.raw === "string") {
        finishOk({
          raw: msg.raw,
          inputTokens:
            typeof msg.inputTokens === "number" ? msg.inputTokens : undefined,
          outputTokens:
            typeof msg.outputTokens === "number"
              ? msg.outputTokens
              : undefined,
          durationMs:
            typeof msg.durationMs === "number" ? msg.durationMs : undefined,
        });
      } else if (msg.type === "error") {
        finishErr(new Error((msg.message as string) ?? "LLM worker error"));
      }
    });

    child.on("error", (err) => finishErr(err));
    child.on("exit", (code, signal) => {
      if (activeWorker === child) activeWorker = null;
      if (settled) return;
      finishErr(
        new Error(
          `LLM worker exited unexpectedly (code=${code}, signal=${signal}). ` +
            `This is a known Metal-backend segfault on Apple Silicon; ` +
            `the recording and transcript are unaffected.`,
        ),
      );
    });

    child.send({ type: "generate", payload });
  });
}

export function createBundledProvider(modelName: string): LlmProviderInstance {
  if (!isBundledModel(modelName)) {
    throw new LlmProviderConfigError(
      `Unknown bundled LLM model "${modelName}". Available: ${BUNDLED_LLM_MODELS.join(", ")}`,
    );
  }
  const model = modelName;
  const label = bundledLabel(model);
  return {
    kind: "bundled",
    label,
    labelFor: () => label,
    agentMode: "none",
    async generate(
      opts: LlmGenerateOpts,
    ): Promise<{ raw: string; usage?: import("./types.js").LlmUsage }> {
      // Generation no longer downloads the model on the fly — it's an
      // explicit user action in Settings. We check up-front and throw a
      // typed error so the renderer can render a friendly CTA instead of
      // spinning a generic "Processing…" for 10 minutes.
      if (!(await isBundledModelDownloaded(model))) {
        throw new BundledModelNotDownloadedError(model);
      }
      const downloadedPath = modelPath(model);
      opts.onProgress?.("model", 5, `loading ${model}`, label);
      // node-llama-cpp's chat worker takes a single prompt; concatenate the
      // optional system block ahead of the user prompt. Other providers
      // (OpenAI/Ollama/Anthropic) use a dedicated system role.
      const fullPrompt =
        opts.system && opts.system.length > 0
          ? `${opts.system}\n\n${opts.prompt}`
          : opts.prompt;
      const workerResult = await runLlmWorker(
        {
          modelPath: downloadedPath,
          prompt: fullPrompt,
          schema: opts.schema,
          maxTokens: opts.maxTokens ?? 4000,
          temperature: opts.temperature ?? 0.2,
          contextSize: opts.contextSize ?? 8192,
          badge: label,
        },
        (stage, pct, note, m) =>
          opts.onProgress?.(stage, pct, note, m ?? label),
      );
      const usage: import("./types.js").LlmUsage = {
        // Bundled runs entirely on the user's hardware. Mark as
        // subscription so the UI doesn't show a "$0.00" metered badge that
        // implies an API call happened.
        billing_kind: "subscription",
        model,
        input_tokens: workerResult.inputTokens,
        output_tokens: workerResult.outputTokens,
        duration_ms: workerResult.durationMs,
        num_turns: 1,
      };
      return { raw: workerResult.raw, usage };
    },
  };
}
