import { app, BrowserWindow } from "electron";
import path from "node:path";
import { access, mkdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  attachTagToMeeting,
  clearAutoTagsForMeeting,
  deleteTasksForMeeting,
  getMeeting,
  insertTask,
  listAllTags,
  listSpeakers,
  listTranscript,
  setStatus,
  setSummary,
  transaction,
  updatePipeline,
  upsertSpeaker,
} from "./db.js";

// LLM no longer runs in-process. See electron/llm-worker.cjs for the why —
// short version: node-llama-cpp's Metal backend has a reproducible segfault
// on Apple Silicon during sequence init that takes down the whole Electron
// process, including any in-flight recording. Forking into a child contains
// the blast radius.
let activeWorker: ChildProcess | null = null;

export async function disposeCachedLlmModel(): Promise<void> {
  // Kept for API compatibility with main.ts before-quit hook.
  if (activeWorker && !activeWorker.killed) {
    activeWorker.kill("SIGTERM");
    activeWorker = null;
  }
}

function locateWorkerScript(): string {
  // dist-electron/services/llm.js → ../llm-worker.cjs
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "llm-worker.cjs");
}

interface WorkerResult {
  raw: string;
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
  onProgress: (stage: string, pct: number, note?: string, model?: string) => void,
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = fork(locateWorkerScript(), [], {
      // Inherit stderr so node-llama-cpp's load warnings appear in dev logs.
      stdio: ["ignore", "ignore", "inherit", "ipc"],
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
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
        finishOk({ raw: msg.raw });
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

export type LlmModel =
  | "gemma-3-4b"
  | "gemma-3-12b"
  | "llama-3.2-3b"
  | "qwen-2.5-7b";

const MODEL_FILES: Record<LlmModel, { url: string; file: string }> = {
  "gemma-3-4b": {
    url: "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
    file: "google_gemma-3-4b-it-Q4_K_M.gguf",
  },
  "gemma-3-12b": {
    url: "https://huggingface.co/bartowski/google_gemma-3-12b-it-GGUF/resolve/main/google_gemma-3-12b-it-Q4_K_M.gguf",
    file: "google_gemma-3-12b-it-Q4_K_M.gguf",
  },
  "llama-3.2-3b": {
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    file: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
  },
  "qwen-2.5-7b": {
    url: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
    file: "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
  },
};

interface NotesOutput {
  executive_summary: Array<{ topic: string; detail: string }>;
  full_summary: string;
  sections: Array<{ title: string; content: string }>;
  decisions: string[];
  action_items: Array<{ assignee: string; text: string }>;
  tags: string[];
}

function modelsDir(): string {
  return path.join(app.getPath("userData"), "models");
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function emit(
  meetingId: string,
  stage: string,
  pct: number,
  note?: string,
  model?: string,
) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("llm:progress", { meetingId, stage, pct, note, model });
  }
}

function llmBadge(model: LlmModel): string {
  // e.g. gemma-3-4b → "gemma · 3-4b", llama-3.2-3b → "llama · 3.2-3b"
  const m = /^([a-z]+)-(.+)$/.exec(model);
  return m ? `${m[1]} · ${m[2]}` : model;
}

async function ensureModel(
  model: LlmModel,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<string> {
  await mkdir(modelsDir(), { recursive: true });
  const { url, file } = MODEL_FILES[model];
  const dest = path.join(modelsDir(), file);
  if (await exists(dest)) {
    const s = await stat(dest);
    if (s.size > 100_000_000) return dest;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Model download failed: ${res.status}`);
  }
  const total = Number(res.headers.get("content-length") ?? "") || null;
  let downloaded = 0;
  const ts = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = res.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          downloaded += value.byteLength;
          onProgress?.(downloaded, total);
          controller.enqueue(value);
        }
      }
      controller.close();
    },
  });
  await pipeline(
    Readable.fromWeb(ts as unknown as import("node:stream/web").ReadableStream<Uint8Array>),
    createWriteStream(dest),
  );
  return dest;
}

function buildPrompt(opts: {
  transcript: { start_ms: number; end_ms: number; speaker_id: string | null; text: string }[];
  speakerLabels: Map<string, string>;
  availableTags: string[];
}): string {
  const lines: string[] = [];
  for (const seg of opts.transcript) {
    const label = seg.speaker_id
      ? (opts.speakerLabels.get(seg.speaker_id) ?? seg.speaker_id)
      : "Speaker";
    const t = formatMs(seg.start_ms);
    lines.push(`[${t}] ${label}: ${seg.text}`);
  }
  const transcriptText = lines.join("\n");

  const hasTags = opts.availableTags.length > 0;
  const tagListBlock = hasTags
    ? opts.availableTags.map((t) => `- ${t}`).join("\n")
    : "(no tags defined — return an empty array for \"tags\")";

  const tagsFieldSpec = hasTags
    ? `- "tags": array of tag names chosen ONLY from the "Available tags" list below. Pick every tag that genuinely matches a topic discussed in the meeting. Return each tag EXACTLY as written in the list (same spelling, same case). Do NOT invent new tags, do NOT modify spelling, do NOT add a leading #. Return an empty array if none of the available tags fit.`
    : `- "tags": MUST be an empty array []. No tags are defined.`;

  return `You are an assistant that produces thorough, structured meeting notes from transcripts.

Detect the transcript's language and write every string field in that language. Keep "assignee" as the literal speaker label from the transcript (e.g. "Alice", "Bob") or "Unassigned" if unclear.

You MUST output a JSON object with these fields, populated with NON-EMPTY content (except "tags", see below):
- "executive_summary": array of 3 to 6 short bullets. Each: {"topic": "<3-8 word headline>", "detail": "<one sentence with names/dates/numbers>"}.
- "full_summary": prose overview of 4 to 8 sentences capturing the meeting's arc end-to-end.
- "sections": array of 3 to 8 in-depth topic sections. Each: {"title": "<short topic title, max 6 words>", "content": "<2 to 6 sentences covering EVERYTHING said about this topic — context, who said what, conclusions, open questions, numbers, dates>"}. Together the sections MUST cover ALL distinct subjects discussed in the meeting, even minor ones. Do not summarize — be specific and verbose where the transcript supports it. Each section should stand on its own as a complete account of that topic.
- "decisions": array of concrete decisions (strings). Empty array only if none.
- "action_items": array of {"assignee": "<speaker name>", "text": "<task with any deadline>"}.
${tagsFieldSpec}

Available tags (the ONLY values allowed in "tags"):
${tagListBlock}

Example output (for a different meeting; assume "pricing", "launch", and "qa" are in the available tags list):
{
  "executive_summary": [
    {"topic": "Launch date confirmed", "detail": "The team agreed to ship the new pricing page on October 14th."},
    {"topic": "QA ownership", "detail": "Maya will own end-to-end testing and have it passing in CI by Friday."}
  ],
  "full_summary": "The team finalized the pricing page rollout, walked through pricing tiers, debated annual discounts, and assigned ownership for QA, copy, and customer comms. They also briefly covered next quarter's onboarding redesign and a customer escalation from Acme.",
  "sections": [
    {"title": "Pricing tier changes", "content": "Alice proposed merging Pro and Business into a single tier at $49. Bob pushed back, citing a churn risk from existing Business customers. They agreed Alice would run a 2-week experiment with 10% of new signups before deciding. Annual plans will get a 20% discount, unchanged from today."},
    {"title": "QA and launch readiness", "content": "Maya outlined the remaining test gaps: checkout flow, currency switching, and the SSO edge case. She committed to having all end-to-end tests in CI green by Friday October 11th. Sam will pair on the checkout coverage. Launch is locked for October 14th conditional on a green CI run by Friday EOD."},
    {"title": "Customer comms plan", "content": "Sam owns the launch email and will circulate a draft by Wednesday. The blog post is already drafted; legal review pending. Support will be staffed Saturday morning to handle inbound from the announcement."},
    {"title": "Acme escalation", "content": "An existing customer (Acme) reported a regression in the API rate limits. Bob will dig in and report back tomorrow; if it's a real incident he'll open a postmortem."},
    {"title": "Onboarding redesign (Q1 preview)", "content": "Brief preview of work scheduled for next quarter. No decisions made; Alice will share a brief in two weeks."}
  ],
  "decisions": ["Ship the pricing page on October 14th conditional on green CI by Friday.", "Run a 10% experiment on the merged Pro/Business tier."],
  "action_items": [
    {"assignee": "Maya", "text": "Land all end-to-end tests in CI by Friday Oct 11."},
    {"assignee": "Sam", "text": "Draft and circulate the launch email by Wednesday."},
    {"assignee": "Bob", "text": "Investigate Acme rate-limit regression and report back tomorrow."}
  ],
  "tags": ["pricing", "launch", "qa"]
}

Be concrete and quote specifics (dates, names, numbers) from the transcript. Cover ALL topics — do not collapse multiple topics into one section. Only output JSON, no other commentary.

Transcript:
${transcriptText}
`;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

const NOTES_SCHEMA = {
  type: "object",
  properties: {
    executive_summary: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          detail: { type: "string" },
        },
        required: ["topic", "detail"],
      },
    },
    full_summary: { type: "string" },
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
        },
        required: ["title", "content"],
      },
    },
    decisions: { type: "array", items: { type: "string" } },
    action_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          assignee: { type: "string" },
          text: { type: "string" },
        },
        required: ["assignee", "text"],
      },
    },
    tags: {
      type: "array",
      minItems: 0,
      maxItems: 16,
      items: { type: "string" },
    },
  },
  required: ["executive_summary", "full_summary", "sections", "action_items"],
} as const;

export async function generateNotes(opts: {
  meetingId: string;
  model?: LlmModel;
}): Promise<{
  ok: true;
  fullSummary: string;
  bullets: number;
  decisions: number;
  actionItems: number;
}> {
  const meeting = getMeeting(opts.meetingId);
  if (!meeting) throw new Error(`Meeting ${opts.meetingId} not found`);
  const transcript = listTranscript(opts.meetingId);
  if (transcript.length === 0) throw new Error("Meeting has no transcript");

  const model = opts.model ?? "gemma-3-4b";
  const badge = llmBadge(model);
  emit(opts.meetingId, "model", 2, `ensuring ${model}`, badge);
  const modelPath = await ensureModel(model, (d, t) => {
    if (t) {
      const pct = 2 + Math.round((d / t) * 25);
      emit(
        opts.meetingId,
        "model",
        pct,
        `download ${(d / 1024 / 1024).toFixed(0)}/${(t / 1024 / 1024).toFixed(0)}MB`,
        badge,
      );
    }
  });

  const speakers = listSpeakers(opts.meetingId);
  const labels = new Map(speakers.map((s) => [s.speaker_id, s.display_name]));

  // Only consider user-created tags. The LLM must pick from this list and is
  // forbidden from inventing new ones — tag creation is a manual UI action.
  const allTags = listAllTags();
  const tagByNormalizedName = new Map(
    allTags.map((t) => [t.name.trim().toLowerCase(), t]),
  );
  const availableTagNames = allTags.map((t) => t.name);

  const prompt = buildPrompt({
    transcript,
    speakerLabels: labels,
    availableTags: availableTagNames,
  });

  const workerResult = await runLlmWorker(
    {
      modelPath,
      prompt,
      schema: NOTES_SCHEMA,
      maxTokens: 4000,
      temperature: 0.2,
      contextSize: 8192,
      badge,
    },
    (stage, pct, note, model) =>
      emit(opts.meetingId, stage, pct, note, model ?? badge),
  );

  let parsed: NotesOutput;
  try {
    parsed = JSON.parse(workerResult.raw) as NotesOutput;
  } catch (err) {
    throw new Error(
      `LLM produced invalid JSON: ${(err as Error).message}\n${workerResult.raw.slice(0, 300)}`,
    );
  }

  emit(opts.meetingId, "writing", 90, undefined, badge);

  updatePipeline(opts.meetingId, { notes: badge });

  setSummary(opts.meetingId, JSON.stringify({
    executive_summary: parsed.executive_summary,
    full_summary: parsed.full_summary,
    sections: parsed.sections ?? [],
    decisions: parsed.decisions ?? [],
    generated_at_ms: Date.now(),
  }));

  // Refresh auto-attached tags from the model. The model may ONLY pick from
  // the user's existing tag list — any value that doesn't match an existing
  // tag (case-insensitive, leading-# stripped) is dropped. We never create a
  // new tag from transcription; tags are created exclusively by the user.
  // Manual attachments (auto = 0) are preserved by clearAutoTagsForMeeting
  // (which only touches auto=1 rows).
  transaction(() => {
    clearAutoTagsForMeeting(opts.meetingId);
    const seen = new Set<string>();
    for (const rawTag of parsed.tags ?? []) {
      const normalized = rawTag.trim().toLowerCase().replace(/^#+/, "");
      if (!normalized) continue;
      const tag = tagByNormalizedName.get(normalized);
      if (!tag) continue; // model hallucinated a tag — ignore it
      if (seen.has(tag.id)) continue;
      seen.add(tag.id);
      try {
        attachTagToMeeting(opts.meetingId, tag.id, true);
      } catch {
        /* ignore tag-failures so notes still save */
      }
    }
  });

  transaction(() => {
    deleteTasksForMeeting(opts.meetingId);
    for (const item of parsed.action_items) {
      let assigneeSpeakerId: string | null = null;
      if (item.assignee && item.assignee !== "Unassigned") {
        const match = speakers.find(
          (s) => s.display_name.toLowerCase() === item.assignee.toLowerCase(),
        );
        if (match) {
          assigneeSpeakerId = match.speaker_id;
        } else {
          const stableId = `unmatched:${item.assignee}`;
          upsertSpeaker(opts.meetingId, stableId, item.assignee);
          assigneeSpeakerId = stableId;
        }
      }
      insertTask(opts.meetingId, assigneeSpeakerId, item.text);
    }
  });

  setStatus(opts.meetingId, "done");
  emit(
    opts.meetingId,
    "done",
    100,
    `${parsed.action_items.length} actions`,
    badge,
  );

  return {
    ok: true,
    fullSummary: parsed.full_summary,
    bullets: parsed.executive_summary.length,
    decisions: parsed.decisions?.length ?? 0,
    actionItems: parsed.action_items.length,
  };
}
