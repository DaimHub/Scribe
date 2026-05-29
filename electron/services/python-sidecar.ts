import { app, BrowserWindow } from "electron";
import path from "node:path";
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { FFMPEG_PATH } from "./audio-mix.js";

const exec = promisify(execFile);

/** Build an env where the bundled ffmpeg binary is on PATH.
 *  WhisperX's audio loader shells out to `ffmpeg` (not the Python library). */
function envWithFfmpeg(): NodeJS.ProcessEnv {
  // "ffmpeg" (no separator) is the no-bundled-binary fallback — leave PATH be
  // and let WhisperX find a system ffmpeg.
  if (!FFMPEG_PATH.includes(path.sep)) return { ...process.env };
  const dir = path.dirname(FFMPEG_PATH);
  const sep = process.platform === "win32" ? ";" : ":";
  const existing = process.env.PATH ?? "";
  return { ...process.env, PATH: existing ? `${dir}${sep}${existing}` : dir };
}

const here = path.dirname(fileURLToPath(import.meta.url));
// dist-electron/services/* → project root is two levels up in dev,
// resources/python/* in production. Try both.
function locatePythonScript(name: string): string {
  const dev = path.resolve(here, "..", "..", "python", name);
  const prod = process.resourcesPath
    ? path.join(process.resourcesPath, "python", name)
    : "";
  return prod && existsSync(prod) ? prod : dev;
}

// Venv resolution order:
//   1. Bundled inside the packaged app (Resources/python-venv) — production.
//   2. Project root python-venv — dev, populated by scripts/bootstrap-python.sh.
//   3. userData/python-venv — legacy in-app installer fallback.
// Cached after first resolution so we don't hit the filesystem on every IPC.
let cachedVenvDir: string | null = null;
function resolveVenvDir(): string {
  if (cachedVenvDir) return cachedVenvDir;
  const candidates: string[] = [];
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "python-venv"));
  }
  candidates.push(path.resolve(here, "..", "..", "python-venv"));
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "bin", "python3"))) {
      cachedVenvDir = dir;
      return dir;
    }
  }
  cachedVenvDir = path.join(app.getPath("userData"), "python-venv");
  return cachedVenvDir;
}

export const VENV_DIR = (): string => resolveVenvDir();

const VENV_BIN = (): string => path.join(VENV_DIR(), "bin");
const VENV_PYTHON = (): string => path.join(VENV_BIN(), "python3");
const VENV_PIP = (): string => path.join(VENV_BIN(), "pip");

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findSystemPython(): Promise<string> {
  // Try common names in order; resolve via `which`
  for (const candidate of ["python3.12", "python3.11", "python3"]) {
    try {
      const { stdout } = await exec("/bin/sh", ["-lc", `command -v ${candidate}`]);
      const p = stdout.trim();
      if (p) return p;
    } catch {
      /* keep trying */
    }
  }
  throw new Error(
    "No system python3 found. Install with: brew install python@3.11",
  );
}

export async function isInstalled(): Promise<boolean> {
  return exists(VENV_PYTHON());
}

export interface InstallProgress {
  stage: string;
  line?: string;
}

/**
 * Bootstrap a python venv at userData/python-venv and pip install whisperx +
 * deps. Streams pip output back as progress events.
 */
export async function ensureVenv(
  onProgress?: (p: InstallProgress) => void,
): Promise<void> {
  if (await isInstalled()) return;
  const sysPython = await findSystemPython();
  await mkdir(app.getPath("userData"), { recursive: true });

  onProgress?.({ stage: "create-venv" });
  await exec(sysPython, ["-m", "venv", VENV_DIR()]);

  onProgress?.({ stage: "upgrade-pip" });
  await exec(VENV_PIP(), ["install", "--upgrade", "pip", "wheel"]);

  // Install in two passes so that torch comes first (huge), then the rest can resolve
  // against the installed torch version.
  onProgress?.({ stage: "install-torch" });
  await runPip(["install", "torch", "torchaudio"], onProgress);

  onProgress?.({ stage: "install-whisperx" });
  await runPip(
    ["install", "whisperx", "faster-whisper", "transformers", "ctranslate2"],
    onProgress,
  );

  // pyannote.audio 4.x must win even though whisperx pins `<4.0` — its
  // metadata constraint is stale, but it only calls Pipeline.from_pretrained,
  // which works across the version bump. Install explicitly after whisperx
  // so pip's resolver doesn't fall back to 3.x.
  onProgress?.({ stage: "install-pyannote" });
  await runPip(
    ["install", "--upgrade", "pyannote.audio>=4.0,<5"],
    onProgress,
  );

  onProgress?.({ stage: "selftest" });
  await selftest();
}

// ANSI/CSI escape sequences (color codes, cursor movement, line clears).
// Matches both ESC[ … <letter> and ESC] … BEL terminator OSC sequences.
const ANSI_RE = /\[[\d;?]*[ -/]*[@-~]|\][^]*/g;

function cleanLine(s: string): string {
  return s.replace(ANSI_RE, "").replace(/\r/g, "").trim();
}

function runPip(
  args: string[],
  onProgress?: (p: InstallProgress) => void,
): Promise<void> {
  // Force pip to emit plain text without colors or animated progress bars.
  const finalArgs = [
    "--no-color",
    "--progress-bar",
    "off",
    "--disable-pip-version-check",
    ...args,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(VENV_PIP(), finalArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Belt-and-braces: many CLIs honor these
        NO_COLOR: "1",
        PIP_NO_COLOR: "1",
        PIP_PROGRESS_BAR: "off",
        TERM: "dumb",
      },
    });
    const onChunk = (chunk: Buffer) => {
      // Split on both \n and \r so progress-bar carriage-return updates don't
      // smush together into one giant line. Then strip ANSI noise.
      for (const raw of chunk.toString("utf8").split(/[\r\n]+/)) {
        const line = cleanLine(raw);
        if (!line) continue;
        onProgress?.({ stage: args[0], line });
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pip ${args.join(" ")} exited with code ${code}`));
    });
  });
}

export async function selftest(): Promise<{
  ok: true;
  versions: Record<string, string>;
}> {
  const { stdout } = await exec(VENV_PYTHON(), [
    locatePythonScript("whisperx_runner.py"),
    "--selftest",
  ]);
  return JSON.parse(stdout);
}

export interface RunOpts {
  wav: string;
  model?: string;
  language?: string;
  diarize?: boolean;
  hfToken?: string;
  /** Exact speaker count — overrides min/max when set. */
  numSpeakers?: number;
  minSpeakers?: number;
  maxSpeakers?: number;
  noAlign?: boolean;
  extractEmbeddings?: boolean;
}

export interface ProgressEvent {
  stage: string;
  pct: number;
  note?: string | null;
  model?: string | null;
}

export interface SpeakerEmbedding {
  id: string;
  embedding: number[] | null;
  sample_start_ms: number;
  sample_end_ms: number;
  total_duration_ms: number;
}

export interface RunResult {
  language: string;
  segments: Array<{
    text: string;
    start_ms: number;
    end_ms: number;
    speaker: string | null;
    words: Array<{
      text: string;
      start_ms: number | null;
      end_ms: number | null;
      speaker: string | null;
      score: number | null;
    }>;
  }>;
  speakers?: SpeakerEmbedding[];
}

export interface DiarizeOnlyOpts {
  wav: string;
  hfToken: string;
  /** Exact speaker count (overrides min/max range when set). */
  numSpeakers?: number;
  minSpeakers?: number;
  maxSpeakers?: number;
  diarizeModel?: string;
  segments: Array<{ idx: number; start_ms: number; end_ms: number }>;
}

export interface DiarizeOnlyResult {
  assignments: Array<{ segment_idx: number; speaker: string }>;
  speakers: SpeakerEmbedding[];
}

// --- Persistent daemon ------------------------------------------------------
// Spawned lazily on the first runWhisperX call, kept alive between
// transcriptions so the Python interpreter + torch/whisperx imports + model
// weights stay in memory (saves 10–40 s per subsequent run).

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  onProgress?: (e: ProgressEvent) => void;
}

interface SidecarHandle {
  child: ChildProcessWithoutNullStreams;
  ready: Promise<void>;
  pending: Map<string, PendingRequest>;
  // Tail of stderr that wasn't valid progress JSON — used to enrich crash
  // diagnostics if the child dies unexpectedly.
  stderrTail: string;
  idleTimer: NodeJS.Timeout | null;
}

let sidecar: SidecarHandle | null = null;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function startSidecar(): SidecarHandle {
  const child = spawn(VENV_PYTHON(), [locatePythonScript("whisperx_runner.py"), "--serve"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: envWithFfmpeg(),
  });

  const pending = new Map<string, PendingRequest>();
  const handle: SidecarHandle = {
    child,
    pending,
    stderrTail: "",
    idleTimer: null,
    ready: new Promise<void>((resolve, reject) => {
      const onFirstLine = (line: string) => {
        try {
          const ev = JSON.parse(line);
          if (ev?.event === "ready") {
            resolve();
            return true;
          }
        } catch {
          /* ignore */
        }
        return false;
      };
      // Latch the "ready" detection into the main line handler below.
      readyResolver = { check: onFirstLine, reject };
    }),
  };

  // Line-buffered stdout
  let stdoutBuf = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString("utf8");
    let nl: number;
    while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      handleStdoutLine(handle, line);
    }
  });

  // Line-buffered stderr — progress events live here.
  let stderrBuf = "";
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    handle.stderrTail = (handle.stderrTail + text).slice(-4096);
    stderrBuf += text;
    let nl: number;
    while ((nl = stderrBuf.indexOf("\n")) >= 0) {
      const line = stderrBuf.slice(0, nl).trim();
      stderrBuf = stderrBuf.slice(nl + 1);
      if (!line) continue;
      handleStderrLine(handle, line);
    }
  });

  child.on("error", (err) => {
    rejectAllPending(handle, err);
  });
  child.on("exit", (code, signal) => {
    if (sidecar === handle) sidecar = null;
    const err = new Error(
      `WhisperX sidecar exited (code=${code} signal=${signal}). stderr tail:\n${handle.stderrTail.slice(-1500)}`,
    );
    rejectAllPending(handle, err);
  });

  return handle;
}

// Captured during startSidecar() so the FIRST stdout line can finalize the
// `ready` promise. Cleared once resolved.
let readyResolver: { check: (line: string) => boolean; reject: (err: Error) => void } | null = null;

function handleStdoutLine(handle: SidecarHandle, line: string) {
  if (readyResolver && readyResolver.check(line)) {
    readyResolver = null;
    return;
  }
  let ev: unknown;
  try {
    ev = JSON.parse(line);
  } catch {
    console.warn(`[whisperx:stdout] non-JSON line: ${line.slice(0, 200)}`);
    return;
  }
  if (!ev || typeof ev !== "object") return;
  const e = ev as { event?: string; id?: string; ok?: boolean; result?: unknown; message?: string };
  if (!e.id) return;
  const req = handle.pending.get(e.id);
  if (!req) return;
  handle.pending.delete(e.id);
  if (e.event === "result" && e.ok) {
    req.resolve(e.result);
  } else if (e.event === "error") {
    req.reject(new Error(e.message ?? "WhisperX returned error event"));
  } else {
    req.reject(new Error(`Unexpected event for request ${e.id}: ${line.slice(0, 200)}`));
  }
  scheduleIdle(handle);
}

function handleStderrLine(handle: SidecarHandle, line: string) {
  let ev: unknown;
  try {
    ev = JSON.parse(line);
  } catch {
    console.warn(`[whisperx:stderr] ${line.slice(0, 200)}`);
    return;
  }
  if (!ev || typeof ev !== "object") return;
  const e = ev as {
    event?: string;
    id?: string;
    stage?: string;
    pct?: number;
    note?: string | null;
    model?: string | null;
  };
  if (e.event !== "progress" || typeof e.stage !== "string" || typeof e.pct !== "number") {
    return;
  }
  const req = e.id ? handle.pending.get(e.id) : null;
  const progress: ProgressEvent = {
    stage: e.stage,
    pct: e.pct,
    note: e.note ?? null,
    model: e.model ?? null,
  };
  console.log(
    `[whisperx] ${progress.stage} ${progress.pct}%${progress.model ? ` · ${progress.model}` : ""}${progress.note ? ` · ${progress.note}` : ""}`,
  );
  req?.onProgress?.(progress);
}

function rejectAllPending(handle: SidecarHandle, err: Error) {
  for (const req of handle.pending.values()) {
    req.reject(err);
  }
  handle.pending.clear();
  if (handle.idleTimer) {
    clearTimeout(handle.idleTimer);
    handle.idleTimer = null;
  }
}

function scheduleIdle(handle: SidecarHandle) {
  if (handle.pending.size > 0) return;
  if (handle.idleTimer) clearTimeout(handle.idleTimer);
  handle.idleTimer = setTimeout(() => {
    if (sidecar === handle && handle.pending.size === 0) {
      void shutdownSidecar();
    }
  }, IDLE_TIMEOUT_MS);
}

export async function shutdownSidecar(): Promise<void> {
  const h = sidecar;
  if (!h) return;
  sidecar = null;
  try {
    h.child.stdin.write(JSON.stringify({ type: "shutdown" }) + "\n");
  } catch {
    /* already dead */
  }
  // Give it a moment to exit gracefully before SIGKILL.
  setTimeout(() => {
    if (!h.child.killed) h.child.kill("SIGTERM");
  }, 500);
}

export async function runWhisperX(
  opts: RunOpts,
  onProgress?: (e: ProgressEvent) => void,
): Promise<RunResult> {
  return invokeSidecar<RunResult>(
    "run",
    {
      wav: opts.wav,
      model: opts.model ?? "large-v3-turbo",
      language: opts.language ?? "auto",
      no_align: !!opts.noAlign,
      diarize: !!(opts.diarize && opts.hfToken),
      hf_token: opts.hfToken,
      num_speakers: opts.numSpeakers ?? 0,
      min_speakers: opts.minSpeakers ?? 0,
      max_speakers: opts.maxSpeakers ?? 0,
      extract_embeddings: !!opts.extractEmbeddings,
    },
    onProgress,
  );
}

export async function runDiarizeOnly(
  opts: DiarizeOnlyOpts,
  onProgress?: (e: ProgressEvent) => void,
): Promise<DiarizeOnlyResult> {
  return invokeSidecar<DiarizeOnlyResult>(
    "diarize-only",
    {
      wav: opts.wav,
      hf_token: opts.hfToken,
      num_speakers: opts.numSpeakers ?? 0,
      min_speakers: opts.minSpeakers ?? 0,
      max_speakers: opts.maxSpeakers ?? 0,
      diarize_model: opts.diarizeModel,
      segments: opts.segments,
    },
    onProgress,
  );
}

async function invokeSidecar<T>(
  type: string,
  payload: Record<string, unknown>,
  onProgress?: (e: ProgressEvent) => void,
): Promise<T> {
  if (!sidecar) sidecar = startSidecar();
  const handle = sidecar;
  if (handle.idleTimer) {
    clearTimeout(handle.idleTimer);
    handle.idleTimer = null;
  }
  await handle.ready;
  const id = randomUUID();

  return new Promise<T>((resolve, reject) => {
    handle.pending.set(id, {
      resolve: (result) => resolve(result as T),
      reject,
      onProgress,
    });
    const command = { type, id, payload };
    try {
      handle.child.stdin.write(JSON.stringify(command) + "\n");
    } catch (err) {
      handle.pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export function emitTo(meetingId: string, channel: string) {
  return (e: ProgressEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, {
        meetingId,
        stage: e.stage,
        pct: e.pct,
        note: e.note ?? undefined,
      });
    }
  };
}
