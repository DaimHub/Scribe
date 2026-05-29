import { BrowserWindow } from "electron";
import {
  attachTagToMeeting,
  clearAutoTagsForMeeting,
  deleteTasksForMeeting,
  getMeeting,
  getMeLibraryId,
  insertTask,
  listAllTags,
  listSpeakers,
  listTranscript,
  setBullets,
  setStatus,
  setSummary,
  transaction,
  updatePipeline,
  type NotesUsage,
} from "./db.js";
import {
  getAiLanguage,
  getKbFilesystemPath,
  type AiLanguage,
} from "./settings.js";
import { getActiveProvider } from "./llm-providers/index.js";
import { FilesystemMcpClient } from "./mcp-client.js";
import { resolveTemplate } from "./notes-templates.js";

export { disposeCachedLlmModel } from "./llm-providers/index.js";
export type { LlmModel } from "./llm-providers/index.js";

const LANGUAGE_LABEL: Record<Exclude<AiLanguage, "auto">, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
};

interface NotesOutput {
  executive_summary: Array<{ topic: string; detail: string }>;
  full_summary: string;
  sections: Array<{ title: string; content: string }>;
  decisions: string[];
  key_points: string[];
  action_items: Array<{ assignee: string; text: string }>;
  tags: string[];
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

// Stable, cacheable system prefix. The schema spec and example are
// identical across every meeting; on providers that support prompt caching
// (Anthropic), marking this block ephemeral cuts repeat-meeting cost to
// roughly 10% of the system tokens. The per-meeting variability (persona,
// language, transcript, assignee whitelist, tags) lives in the user block.
const SYSTEM_PROMPT_FIXED = `You are an assistant that produces structured meeting notes from transcripts.

You MUST output a JSON object with these fields, populated with NON-EMPTY content (except "tags", which may be empty):
- "executive_summary": array of 3 to 6 short bullets. Each {"topic": "<3-8 word headline>", "detail": "<one sentence with names/dates/numbers>"}.
- "full_summary": prose overview of 4 to 8 sentences capturing the meeting's arc end-to-end.
- "sections": array of 3 to 8 in-depth topic sections. Each {"title": "<short topic title, max 6 words>", "content": "<2 to 6 sentences covering EVERYTHING said about this topic — context, who said what, conclusions, open questions, numbers, dates>"}. Together the sections MUST cover ALL distinct subjects discussed in the meeting, even minor ones. Do not summarize — be specific and verbose where the transcript supports it. Each section should stand on its own as a complete account of that topic.
- "decisions": array of concrete decisions (strings). Empty array only if none.
- "key_points": array of 4 to 8 ultra-concise bullets — a TL;DR of the whole meeting for fast skimming. Each is ONE short line (a single clause, no "topic:" prefix and no trailing period required), capturing a top takeaway, decision, or number. Compress harder than the executive_summary; do not echo its wording verbatim.
- "action_items": array of {"assignee": "<speaker name>", "text": "<task with any deadline>"}.
- "tags": array of tag names chosen ONLY from the "Available tags" list in the user message. Pick every tag that genuinely matches a topic discussed. Return each tag EXACTLY as listed (same spelling, same case, no leading #). Do NOT invent new tags. Empty array if no tags fit or none are defined.

Markdown formatting is encouraged in the prose fields — "full_summary", every section "content", each "decisions" entry, each "key_points" entry, and the "detail" field of each executive bullet — when it genuinely helps readability. Use it for emphasis (**bold** for names/owners, *italics* for nuance), inline \`code\` for identifiers, bullet/numbered lists when the content is a list, and links with [text](url) when a URL was mentioned. Keep "topic", section "title", "assignee", and "tags" as plain text (no markdown). Do not wrap whole sections in code fences and do not invent headings — section titles already render as headings.

Example output (for a different meeting; assume "pricing", "launch", and "qa" are in that meeting's available tags list):
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
  "key_points": ["Pricing page ships Oct 14 if CI is green by Friday", "Pro and Business tiers merge at $49 behind a 10% experiment", "Annual plans keep the 20% discount", "Acme API rate-limit regression under investigation"],
  "action_items": [
    {"assignee": "<one of the allowed labels from the user message>", "text": "Land all end-to-end tests in CI by Friday Oct 11."},
    {"assignee": "<one of the allowed labels from the user message>", "text": "Draft and circulate the launch email by Wednesday."},
    {"assignee": "Unassigned", "text": "Investigate Acme rate-limit regression and report back tomorrow."}
  ],
  "tags": ["pricing", "launch", "qa"]
}

CRITICAL: never invent assignee names. Use only the "Allowed assignees" listed in each user message. Use "Unassigned" if no one in the transcript clearly owns an action. Do NOT borrow names ("Alice", "Bob", "Maya", "Sam") from the example above — it is structural only.

Only output JSON, no other commentary.`;

function buildPrompt(opts: {
  transcript: { start_ms: number; end_ms: number; speaker_id: string | null; text: string }[];
  speakerLabels: Map<string, string>;
  availableTags: string[];
  aiLanguage: AiLanguage;
  /** Template-specific persona/focus paragraph. Picked from the resolved
   *  NotesTemplate's `instructions` field (which the user may have edited
   *  or supplied via a custom template). The schema, example, and JSON
   *  contract live in the stable system block. */
  instructions: string;
  /** Display label of the speaker who is the app user, when one is marked
   *  ("me" in the People view). Lets the model attribute the reader's own
   *  action items and address them directly. Null when unknown. */
  meLabel: string | null;
}): { system: string; user: string } {
  const lines: string[] = [];
  for (const seg of opts.transcript) {
    const label = seg.speaker_id
      ? (opts.speakerLabels.get(seg.speaker_id) ?? seg.speaker_id)
      : "Speaker";
    const t = formatMs(seg.start_ms);
    lines.push(`[${t}] ${label}: ${seg.text}`);
  }
  const transcriptText = lines.join("\n");

  // Whitelist of allowed assignee labels — built from the actual speakers
  // present in this meeting (their current display_name + the raw speaker
  // id from the transcript). The LLM has a tendency to lift names from the
  // example block ("Sam", "Bob", "Maya") into action items when the
  // transcript itself doesn't make ownership obvious. Surfacing the exact
  // legal values here, plus rejecting unknown assignees post-parse,
  // eliminates that hallucination class.
  const allowedAssignees = new Set<string>(["Unassigned"]);
  for (const label of opts.speakerLabels.values()) allowedAssignees.add(label);
  for (const seg of opts.transcript) {
    if (seg.speaker_id) allowedAssignees.add(seg.speaker_id);
  }
  const allowedAssigneesList = Array.from(allowedAssignees)
    .map((a) => `"${a}"`)
    .join(", ");

  const hasTags = opts.availableTags.length > 0;
  const tagsBlock = hasTags
    ? `Available tags (use these EXACT values — same spelling, same case, no leading #):\n${opts.availableTags.map((t) => `- ${t}`).join("\n")}`
    : `No tags are defined for this user — return an empty array for "tags".`;

  const languageName: string | null =
    opts.aiLanguage === "auto" ? null : LANGUAGE_LABEL[opts.aiLanguage];
  const languageInstruction =
    languageName === null
      ? `Detect the transcript's language and write every string field in that language.`
      : `WRITE EVERY STRING FIELD IN ${languageName.toUpperCase()}, including "topic", "detail", "full_summary", every section "title" and "content", every "decisions" entry, every "key_points" entry, and every action item "text" — regardless of the transcript's language and regardless of the language used in the example in your system prompt. The only exception is "assignee", which must stay as the literal speaker label from the transcript.`;

  const languageReminder =
    languageName === null
      ? `Reminder: write every string field in the transcript's detected language.`
      : `Reminder: write every string field in ${languageName} — section titles, decisions, key points, summaries, and action item text must all be in ${languageName}. The English wording in the system-prompt example is structural only; do not echo its language.`;

  const meBlock = opts.meLabel
    ? `\nThe speaker labelled "${opts.meLabel}" is the user you are writing these notes for. Treat action items they own as the reader's own tasks, and you may address them directly as "you" in the prose fields.\n`
    : "";

  const user = `${opts.instructions.trim()}

${languageInstruction}

Allowed assignees for "assignee" in action_items (the ONLY legal values): ${allowedAssigneesList}. Use "Unassigned" if no one in the transcript clearly owns the action.
${meBlock}
${tagsBlock}

${languageReminder}

Transcript:
${transcriptText}
`;

  return { system: SYSTEM_PROMPT_FIXED, user };
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

// Pick a power-of-2 context size that fits the prompt + reserved output.
// We over-estimate at chars/3 because whisper transcripts in non-English
// languages tokenize denser than the usual chars/4 rule. Cap at 32k —
// Qwen 2.5's native max — which is plenty for ~2h meetings and fits in
// unified memory with a 12B Q4_K_M model loaded. Prompts that still
// exceed 32k surface node-llama-cpp's clearer "context shift" error.
const CTX_CANDIDATES = [8192, 16384, 32768] as const;
const CTX_HEADROOM_TOKENS = 512;

function pickContextSize(prompt: string, maxOutTokens: number): number {
  const promptTokens = Math.ceil(prompt.length / 3);
  const needed = promptTokens + maxOutTokens + CTX_HEADROOM_TOKENS;
  for (const c of CTX_CANDIDATES) if (c >= needed) return c;
  return CTX_CANDIDATES[CTX_CANDIDATES.length - 1];
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
    key_points: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: { type: "string" },
    },
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
  required: [
    "executive_summary",
    "full_summary",
    "sections",
    "key_points",
    "action_items",
  ],
} as const;

export async function generateNotes(opts: {
  meetingId: string;
  modelOverride?: string;
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

  const provider = await getActiveProvider();
  // The dispatcher branches on `agentMode`, not on `kind`:
  //   - "via-tool-host" (anthropic) needs an injected MCP filesystem client
  //     scoped to the KB folder. No KB folder → fall back to single-shot.
  //   - "built-in" (claude-code) drives its own agent loop and consumes the
  //     KB folder at provider creation time (via `--add-dir`); we just call
  //     `generate` and the loop happens inside the CLI subprocess.
  //   - "none" (bundled/ollama/openai) → single-shot only.
  const kbPath =
    provider.agentMode === "via-tool-host"
      ? await getKbFilesystemPath()
      : null;
  const willRunAgent =
    provider.agentMode === "built-in" || (provider.agentMode === "via-tool-host" && !!kbPath);
  const baseLabel = provider.labelFor(opts.modelOverride);
  const badge = willRunAgent ? `${baseLabel} · agent` : baseLabel;

  // Per-meeting template override wins; otherwise resolveTemplate falls back
  // to the user's global default, and ultimately to builtin:general.
  const template = await resolveTemplate(meeting.notes_template_id);

  const speakers = listSpeakers(opts.meetingId);
  const labels = new Map(speakers.map((s) => [s.speaker_id, s.display_name]));

  // If the user marked themselves ("me") in the People view and that person
  // speaks in this meeting, surface their label so the model can attribute
  // the reader's own action items and address them directly.
  const meLibId = getMeLibraryId();
  const meLabel = meLibId
    ? (speakers.find((s) => s.voice_library_id === meLibId)?.display_name ??
      null)
    : null;

  // Only consider user-created tags. The LLM must pick from this list and is
  // forbidden from inventing new ones — tag creation is a manual UI action.
  const allTags = listAllTags();
  const tagByNormalizedName = new Map(
    allTags.map((t) => [t.name.trim().toLowerCase(), t]),
  );
  const availableTagNames = allTags.map((t) => t.name);

  const aiLanguage = await getAiLanguage();
  const { system, user } = buildPrompt({
    transcript,
    speakerLabels: labels,
    availableTags: availableTagNames,
    aiLanguage,
    instructions: template.instructions,
    meLabel,
  });

  // Generous output budget. The schema is rich (executive summary +
  // sections + decisions + action items + tags) and long meetings need
  // room. Set to the max supported by Claude 4 (Opus/Haiku cap at 32K
  // output, Sonnet goes higher but 32K is plenty); the model stops when
  // done, so unused tokens cost nothing. Bundled (llama.cpp) models cap
  // themselves below this anyway via pickContextSize.
  const maxOutTokens = 32000;
  const baseGenOpts = {
    system,
    prompt: user,
    schema: NOTES_SCHEMA,
    maxTokens: maxOutTokens,
    temperature: 0.2,
    modelOverride: opts.modelOverride,
    // node-llama-cpp sizing — base on combined length, since the bundled
    // provider concatenates system+user into one prompt for the worker.
    contextSize: pickContextSize(`${system}\n\n${user}`, maxOutTokens),
    onProgress: (stage: string, pct: number, note?: string, model?: string) =>
      emit(opts.meetingId, stage, pct, note, model ?? badge),
  };

  let raw: string;
  let usage: NotesUsage | undefined;
  if (provider.agentMode === "via-tool-host" && kbPath && provider.agenticGenerate) {
    // Spawn the MCP filesystem server scoped to the KB folder, hand it to
    // the provider's agent loop, dispose unconditionally so the subprocess
    // doesn't leak across runs.
    const mcp = new FilesystemMcpClient();
    try {
      await mcp.connect(kbPath);
      const out = await provider.agenticGenerate({
        ...baseGenOpts,
        toolHost: mcp,
      });
      raw = out.raw;
      usage = out.usage;
    } finally {
      await mcp.dispose();
    }
  } else {
    const out = await provider.generate(baseGenOpts);
    raw = out.raw;
    usage = out.usage;
  }

  let parsed: NotesOutput;
  try {
    parsed = JSON.parse(raw) as NotesOutput;
  } catch (err) {
    throw new Error(
      `LLM produced invalid JSON: ${(err as Error).message}\n${raw.slice(0, 300)}`,
    );
  }

  emit(opts.meetingId, "writing", 90, undefined, badge);

  updatePipeline(opts.meetingId, {
    notes: badge,
    notes_template_id: template.id,
    notes_template_name: template.name,
    ...(usage ? { notes_usage: usage } : {}),
  });

  setSummary(opts.meetingId, JSON.stringify({
    executive_summary: parsed.executive_summary,
    full_summary: parsed.full_summary,
    sections: parsed.sections ?? [],
    decisions: parsed.decisions ?? [],
    generated_at_ms: Date.now(),
  }));

  // Condensed "key points" ride along in the same LLM pass (zero extra cost)
  // and land in their own column so the Bullet points tab and the MCP
  // `set_bullets` tool can read/write them independently of the summary blob.
  const keyPoints = Array.isArray(parsed.key_points)
    ? parsed.key_points.filter((s) => typeof s === "string" && s.trim() !== "")
    : [];
  setBullets(
    opts.meetingId,
    keyPoints.length > 0 ? JSON.stringify(keyPoints) : null,
  );

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
        // Strict match against the actual meeting speakers (display_name OR
        // raw pyannote id). We deliberately do NOT create phantom rows for
        // unmatched names anymore — the LLM occasionally lifts names from
        // its example block ("Sam", "Bob", "Maya") when ownership is
        // ambiguous, and inserting those into the speakers table polluted
        // the chip with people who never spoke. Dropping the assignee back
        // to null is much safer than inventing a speaker.
        const lower = item.assignee.toLowerCase();
        const match = speakers.find(
          (s) =>
            s.display_name.toLowerCase() === lower ||
            s.speaker_id.toLowerCase() === lower,
        );
        if (match) {
          assigneeSpeakerId = match.speaker_id;
        }
        // else: task created without assignee — user can re-assign in the
        // tasks view if the LLM got it wrong by name only.
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
