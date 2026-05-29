import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  addActionItem,
  appendAudit,
  attachTagToMeeting,
  deleteActionItem,
  detachTagFromMeeting,
  findOrCreateTag,
  getLinkedEvent,
  getMeeting,
  getPerson,
  getTask,
  listMeetings,
  listMeetingsForPerson,
  listSpeakers,
  listTagsForMeeting,
  listTasksAggregated,
  listTranscript,
  listVoiceLibrary,
  McpWritesDisabledError,
  readMcpAllowWrites,
  renameSpeaker,
  resolveDbPath,
  searchMeetings,
  setActionItemDone,
  setBullets,
  setMeetingTitle,
  setScratchpad,
  setStatus,
  setSummary,
  transaction,
  updatePipeline,
  type MeetingRow,
  type SpeakerRow,
} from "./db.js";

const VERSION = "0.1.0";

// Badge stamped into pipeline.notes for summaries written by Claude through
// this MCP server, distinguishing them from the in-app "Process meeting"
// pass. Rendered verbatim as a chip in the meeting header (see
// components/scribe/meeting-header.tsx); mirrors the `· agent` suffix
// convention from electron/services/llm.ts.
const NOTES_BADGE = "Claude · MCP";

// --- Shaping helpers ------------------------------------------------------
//
// The DB rows include columns the LLM doesn't need (embeddings, internal
// paths, position fields). These helpers trim each shape to what's actually
// useful for note-generation conversations.

function trimMeeting(m: MeetingRow): Record<string, unknown> {
  const pipeline = m.pipeline_json ? safeJson(m.pipeline_json) : null;
  return {
    id: m.id,
    title: m.title,
    started_at_ms: m.started_at_ms,
    ended_at_ms: m.ended_at_ms,
    duration_ms: m.duration_ms,
    status: m.status,
    pinned: m.pinned === 1,
    has_summary: m.summary_json !== null,
    bullets: m.bullets_json ? safeJson(m.bullets_json) : null,
    scratchpad: m.scratchpad,
    notes_template_id: m.notes_template_id,
    pipeline,
  };
}

function trimSpeaker(s: SpeakerRow): Record<string, unknown> {
  return {
    speaker_id: s.speaker_id,
    display_name: s.display_name,
    voice_library_id: s.voice_library_id,
    match_confidence: s.match_confidence,
    needs_review: s.needs_review === 1,
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function ok(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function err(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

// --- Server ---------------------------------------------------------------

const server = new McpServer({ name: "scribe", version: VERSION });

server.registerTool(
  "list_meetings",
  {
    description:
      "List Scribe meetings, most recent first. Optionally filter by date range (epoch ms). Use this to find meetings before asking for transcripts or summaries.",
    inputSchema: {
      from_ms: z
        .number()
        .int()
        .optional()
        .describe("Inclusive lower bound on started_at_ms (epoch milliseconds)."),
      to_ms: z
        .number()
        .int()
        .optional()
        .describe("Exclusive upper bound on started_at_ms (epoch milliseconds)."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Max rows to return (default 100, max 500)."),
    },
  },
  async ({ from_ms, to_ms, limit }) => {
    const rows = listMeetings({
      fromMs: from_ms,
      toMs: to_ms,
      limit,
    });
    return ok(rows.map(trimMeeting));
  },
);

server.registerTool(
  "get_meeting",
  {
    description:
      "Get full metadata for one meeting: title, status, speakers, tags, the linked calendar event (if any), plus the meeting's key points (meeting.bullets — the condensed TL;DR) and free-form scratch pad (meeting.scratchpad). Does NOT include the transcript — call get_transcript separately when you need the words; the full summary lives in get_summary.",
    inputSchema: {
      id: z.string().describe("Meeting id (UUID)."),
    },
  },
  async ({ id }) => {
    const m = getMeeting(id);
    if (!m) return err(`No meeting with id ${id}`);
    const speakers = listSpeakers(id).map(trimSpeaker);
    const tags = listTagsForMeeting(id).map((t) => ({
      id: t.id,
      name: t.name,
      auto: t.auto === 1,
    }));
    const linkedEvent = getLinkedEvent(id);
    return ok({
      meeting: trimMeeting(m),
      speakers,
      tags,
      linked_event: linkedEvent
        ? {
            id: linkedEvent.id,
            title: linkedEvent.title,
            description: linkedEvent.description,
            location: linkedEvent.location,
            start_at_ms: linkedEvent.start_at_ms,
            end_at_ms: linkedEvent.end_at_ms,
            hangout_link: linkedEvent.hangout_link,
            attendees: safeJson(linkedEvent.attendees_json ?? "[]"),
          }
        : null,
    });
  },
);

server.registerTool(
  "get_transcript",
  {
    description:
      "Get the transcript of a meeting as time-stamped, speaker-labeled segments. Each segment has start_ms, end_ms, speaker (resolved display name), and text. Large meetings can be many segments — consider date range filtering on list_meetings first.",
    inputSchema: {
      id: z.string().describe("Meeting id."),
      format: z
        .enum(["segments", "plain"])
        .optional()
        .describe(
          "segments (default): array of {start_ms, end_ms, speaker, text}. plain: a single string with [mm:ss] Speaker: text lines.",
        ),
    },
  },
  async ({ id, format }) => {
    const m = getMeeting(id);
    if (!m) return err(`No meeting with id ${id}`);
    const segments = listTranscript(id);
    const speakers = new Map(
      listSpeakers(id).map((s) => [s.speaker_id, s.display_name]),
    );
    if (format === "plain") {
      const lines = segments.map((seg) => {
        const sec = Math.floor(seg.start_ms / 1000);
        const mm = String(Math.floor(sec / 60)).padStart(2, "0");
        const ss = String(sec % 60).padStart(2, "0");
        const label = seg.speaker_id
          ? (speakers.get(seg.speaker_id) ?? seg.speaker_id)
          : "Speaker";
        return `[${mm}:${ss}] ${label}: ${seg.text}`;
      });
      return ok({ meeting_id: id, plain: lines.join("\n") });
    }
    return ok({
      meeting_id: id,
      segments: segments.map((seg) => ({
        start_ms: seg.start_ms,
        end_ms: seg.end_ms,
        speaker: seg.speaker_id
          ? (speakers.get(seg.speaker_id) ?? seg.speaker_id)
          : null,
        speaker_id: seg.speaker_id,
        text: seg.text,
      })),
    });
  },
);

server.registerTool(
  "get_summary",
  {
    description:
      "Get the AI-generated summary of a meeting: executive_summary (bullet topics), full_summary (prose), sections (in-depth per-topic), and decisions. Returns null if the meeting hasn't been processed. PROSE FIELDS ARE MARKDOWN — full_summary, sections[].content, decisions[], and each executive_summary[].detail may contain GFM markdown (bold, italics, lists, links, inline code, tables). The fields executive_summary[].topic and sections[].title are plain text.",
    inputSchema: {
      id: z.string().describe("Meeting id."),
    },
  },
  async ({ id }) => {
    const m = getMeeting(id);
    if (!m) return err(`No meeting with id ${id}`);
    if (!m.summary_json) {
      return ok({ meeting_id: id, summary: null });
    }
    return ok({ meeting_id: id, summary: safeJson(m.summary_json) });
  },
);

server.registerTool(
  "get_meetings",
  {
    description:
      "Bulk fetch full metadata + summary for multiple meetings by id in a single call. Use this when you need to compare or report on several meetings — e.g. after search_meetings returns 5 hits and you want metadata for each. Each entry includes the same shape as get_meeting plus the parsed summary (when present). Missing ids are returned with found=false rather than throwing. Same markdown semantics as get_summary: each entry's summary.full_summary, summary.sections[].content, summary.decisions[], and summary.executive_summary[].detail are GFM markdown; topic and section title are plain text.",
    inputSchema: {
      ids: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe(
          "Meeting ids to fetch. Use one call instead of N round-trips of get_meeting.",
        ),
    },
  },
  async ({ ids }) => {
    const results = ids.map((id) => {
      const m = getMeeting(id);
      if (!m) return { id, found: false };
      const linked = getLinkedEvent(id);
      return {
        id,
        found: true,
        meeting: trimMeeting(m),
        speakers: listSpeakers(id).map(trimSpeaker),
        tags: listTagsForMeeting(id).map((t) => ({
          id: t.id,
          name: t.name,
          auto: t.auto === 1,
        })),
        summary: m.summary_json ? safeJson(m.summary_json) : null,
        linked_event: linked
          ? {
              id: linked.id,
              title: linked.title,
              start_at_ms: linked.start_at_ms,
              end_at_ms: linked.end_at_ms,
              hangout_link: linked.hangout_link,
            }
          : null,
      };
    });
    return ok(results);
  },
);

server.registerTool(
  "get_action_items",
  {
    description:
      "Get action items (tasks) extracted from meetings. Defaults to all meetings; narrow with meeting_id, since_ms, or open_only. Each item includes its source meeting + the assignee's display name when known.",
    inputSchema: {
      meeting_id: z
        .string()
        .optional()
        .describe("Restrict to one meeting."),
      open_only: z
        .boolean()
        .optional()
        .describe("Only return items not marked done."),
      since_ms: z
        .number()
        .int()
        .optional()
        .describe(
          "Only items from meetings that started after this epoch-ms timestamp.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Max rows (default 200, max 500)."),
    },
  },
  async ({ meeting_id, open_only, since_ms, limit }) => {
    const rows = listTasksAggregated({
      meetingId: meeting_id,
      openOnly: open_only,
      sinceMs: since_ms,
      limit,
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        meeting_id: r.meeting_id,
        meeting_title: r.meeting_title,
        meeting_started_at_ms: r.meeting_started_at_ms,
        assignee_speaker_id: r.assignee_speaker_id,
        assignee_name: r.assignee_name,
        text: r.text,
        done: r.done === 1,
      })),
    );
  },
);

server.registerTool(
  "search_meetings",
  {
    description:
      "Full-text search across meeting transcripts. Returns meetings with a snippet showing where the query matched. Use this when the user references a meeting by topic rather than date/title.",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe(
          "FTS5 query string. Supports phrase matching with double quotes, AND/OR/NOT, prefix with *.",
        ),
      from_ms: z.number().int().optional(),
      to_ms: z.number().int().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  async ({ query, from_ms, to_ms, limit }) => {
    const hits = searchMeetings({
      query,
      fromMs: from_ms,
      toMs: to_ms,
      limit,
    });
    return ok(hits);
  },
);

server.registerTool(
  "list_people",
  {
    description:
      "List known people in Scribe's voice library — speakers that have been linked across meetings. Returns id, display name, and meeting count. Use this to discover who is in the user's regular orbit.",
    inputSchema: {},
  },
  async () => {
    const rows = listVoiceLibrary();
    return ok(
      rows.map((r) => ({
        id: r.id,
        display_name: r.display_name,
        n_meetings: r.n_meetings,
        updated_at_ms: r.updated_at_ms,
      })),
    );
  },
);

server.registerTool(
  "get_person",
  {
    description:
      "Get details about one person from the voice library — name, total meetings, when they were last heard, and a list of recent meetings they appeared in.",
    inputSchema: {
      id: z.string().describe("voice_library row id."),
      meetings_limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("How many recent meetings to include (default 20)."),
    },
  },
  async ({ id, meetings_limit }) => {
    const person = getPerson(id);
    if (!person) return err(`No person with id ${id}`);
    const meetings = listMeetingsForPerson(id, meetings_limit ?? 20);
    return ok({
      person: {
        id: person.id,
        display_name: person.display_name,
        n_meetings: person.n_meetings,
        last_heard_ms: person.last_heard_ms,
        last_meeting: person.last_meeting_id
          ? {
              id: person.last_meeting_id,
              title: person.last_meeting_title,
            }
          : null,
      },
      meetings: meetings.map(trimMeeting),
    });
  },
);

// =========================================================================
// WRITE TOOLS (Phase 2)
// =========================================================================
//
// All write tools share the same pattern: check the gate, run the work,
// audit the call. The gate is re-read on every call so the user can flip
// `mcp_allow_writes` in Settings without restarting Claude Desktop.

type ToolResult = ReturnType<typeof ok>;

async function runWrite(
  tool: string,
  args: Record<string, unknown>,
  body: () => Record<string, unknown> | void,
): Promise<ToolResult> {
  if (!readMcpAllowWrites()) {
    appendAudit({ tool, args, status: "denied" });
    return err(new McpWritesDisabledError().message);
  }
  const t0 = Date.now();
  try {
    const result = body() ?? {};
    appendAudit({
      tool,
      args,
      status: "ok",
      durationMs: Date.now() - t0,
      result,
    });
    return ok({ tool, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    appendAudit({
      tool,
      args,
      status: "error",
      durationMs: Date.now() - t0,
      error: message,
    });
    return err(message);
  }
}

server.registerTool(
  "set_summary",
  {
    description:
      "Replace a meeting's AI-generated summary. Use this after rewriting notes with extra context (e.g. Symphonics vocabulary). This is the terminal step of processing a meeting over MCP: it flips the meeting's status to `done` and stamps a \"Claude · MCP\" notes badge — the same end state the in-app Process meeting pass produces — so a meeting summarized this way no longer looks unprocessed (stuck at `diarized`). PROSE FIELDS ACCEPT MARKDOWN — full_summary, sections[].content, decisions[], and each executive_summary[].detail are rendered as GFM markdown in the Scribe UI (bold, italics, lists, links, inline code, tables). Keep executive_summary[].topic and sections[].title as plain text — they render as headings already. Do not wrap whole sections in code fences and do not invent your own h1/h2 headings (titles render as headings). The Scribe app will see the new summary on next reload — open meetings won't refresh live.",
    inputSchema: {
      meeting_id: z.string().describe("Meeting id."),
      executive_summary: z
        .array(
          z.object({
            topic: z.string().describe("3-8 word headline. PLAIN TEXT — no markdown."),
            detail: z
              .string()
              .describe(
                "One sentence with names/dates/numbers. May use inline markdown (bold for owners, italics, inline code).",
              ),
          }),
        )
        .min(1)
        .max(8),
      full_summary: z
        .string()
        .describe(
          "4-8 sentence prose overview of the meeting's arc. GFM markdown allowed — bold/italics/lists/links/inline code.",
        ),
      sections: z
        .array(
          z.object({
            title: z.string().describe("PLAIN TEXT — renders as a heading."),
            content: z
              .string()
              .describe(
                "2-6 sentences. GFM markdown allowed — bold/italics/lists/links/inline code/tables.",
              ),
          }),
        )
        .optional()
        .describe("Per-topic deep-dives. Recommended 3-8 entries."),
      decisions: z
        .array(
          z
            .string()
            .describe("One decision. May use inline markdown."),
        )
        .optional()
        .describe("Concrete decisions taken. Empty array if none."),
    },
  },
  async (args) => {
    const { meeting_id, executive_summary, full_summary, sections, decisions } =
      args;
    return runWrite(
      "set_summary",
      {
        meeting_id,
        n_exec: executive_summary.length,
        n_sections: sections?.length ?? 0,
        n_decisions: decisions?.length ?? 0,
      },
      () => {
        const m = getMeeting(meeting_id);
        if (!m) throw new Error(`No meeting with id ${meeting_id}`);
        // Mirror the in-app notes pipeline's finalization
        // (electron/services/llm.ts): write the summary, stamp the notes
        // badge, and flip to the terminal `done` state — atomically, so the
        // meeting never lands half-processed. notes_usage from any prior
        // in-app generation is cleared: the MCP path emits no token report,
        // and stale counts under a "Claude · MCP" badge would mislead.
        transaction(() => {
          setSummary(meeting_id, {
            executive_summary,
            full_summary,
            sections,
            decisions,
          });
          updatePipeline(meeting_id, {
            notes: NOTES_BADGE,
            notes_usage: undefined,
          });
          setStatus(meeting_id, "done");
        });
        return {
          meeting_id,
          updated: true,
          status: "done",
          notes: NOTES_BADGE,
        };
      },
    );
  },
);

server.registerTool(
  "set_bullets",
  {
    description:
      'Replace a meeting\'s "key points" — the condensed bullet TL;DR shown in Scribe\'s Key points tab. Pass an array of short one-line bullets (4-8 is typical). Inline GFM markdown is allowed (bold, italics, inline code, links) but keep each entry to a single line with NO leading bullet character. An empty array clears the list. Key points are stored separately from the summary, so this does NOT touch executive_summary, full_summary, sections, or decisions — use set_summary for those. The Scribe app sees the change on next reload.',
    inputSchema: {
      meeting_id: z.string().describe("Meeting id."),
      bullets: z
        .array(z.string())
        .max(20)
        .describe(
          "Key-point bullets, each one short line, no leading '•'. Empty array clears the list.",
        ),
    },
  },
  async ({ meeting_id, bullets }) => {
    return runWrite("set_bullets", { meeting_id, n: bullets.length }, () => {
      const m = getMeeting(meeting_id);
      if (!m) throw new Error(`No meeting with id ${meeting_id}`);
      setBullets(meeting_id, bullets);
      return { meeting_id, count: bullets.length };
    });
  },
);

server.registerTool(
  "set_scratchpad",
  {
    description:
      "Replace a meeting's free-form scratch pad — a user-owned canvas shown in Scribe's Scratch pad tab. Plain markdown text, NOT generated by the notes pipeline. Pass the full new contents; an empty string clears it. This overwrites the whole pad, so if you mean to append, call get_meeting first to read the current scratchpad and send the combined text. The Scribe app sees the change on next reload.",
    inputSchema: {
      meeting_id: z.string().describe("Meeting id."),
      text: z
        .string()
        .describe(
          "Full new scratch pad contents (markdown). Empty string clears it.",
        ),
    },
  },
  async ({ meeting_id, text }) => {
    return runWrite("set_scratchpad", { meeting_id, length: text.length }, () => {
      const m = getMeeting(meeting_id);
      if (!m) throw new Error(`No meeting with id ${meeting_id}`);
      setScratchpad(meeting_id, text);
      return { meeting_id, length: text.length };
    });
  },
);

server.registerTool(
  "set_meeting_title",
  {
    description:
      "Rename a meeting. Useful for replacing auto-generated titles like \"Untitled meeting\" with something meaningful derived from the transcript.",
    inputSchema: {
      meeting_id: z.string(),
      title: z.string().min(1).max(200),
    },
  },
  async ({ meeting_id, title }) => {
    return runWrite("set_meeting_title", { meeting_id, title }, () => {
      const m = getMeeting(meeting_id);
      if (!m) throw new Error(`No meeting with id ${meeting_id}`);
      setMeetingTitle(meeting_id, title);
      return { meeting_id, title };
    });
  },
);

server.registerTool(
  "add_action_items",
  {
    description:
      "Add one or many tasks to a meeting in a single atomic call. Each item's assignee_speaker_id (if set) must match a speaker of the meeting; null = unassigned. The whole batch rolls back on any error — no partial inserts.",
    inputSchema: {
      meeting_id: z.string(),
      items: z
        .array(
          z.object({
            text: z.string().min(1).max(500),
            assignee_speaker_id: z
              .string()
              .nullable()
              .optional()
              .describe(
                "speaker_id from this meeting (get it via get_meeting). Null/omit = unassigned.",
              ),
          }),
        )
        .min(1)
        .max(100)
        .describe(
          "Pass an array even for a single item: [{text: '...'}]. Use one call for everything — do not loop.",
        ),
    },
  },
  async ({ meeting_id, items }) => {
    return runWrite(
      "add_action_items",
      { meeting_id, count: items.length },
      () => {
        const m = getMeeting(meeting_id);
        if (!m) throw new Error(`No meeting with id ${meeting_id}`);
        const tasks = transaction(() =>
          items.map((it) =>
            addActionItem({
              meetingId: meeting_id,
              text: it.text,
              assigneeSpeakerId: it.assignee_speaker_id ?? null,
            }),
          ),
        );
        return { meeting_id, count: tasks.length, tasks };
      },
    );
  },
);

server.registerTool(
  "set_action_items_done",
  {
    description:
      "Mark one or many tasks done / not done in a single atomic call. Each update has a task_id and a boolean done. Rolls back on any error.",
    inputSchema: {
      updates: z
        .array(
          z.object({
            task_id: z.number().int(),
            done: z.boolean(),
          }),
        )
        .min(1)
        .max(200),
    },
  },
  async ({ updates }) => {
    return runWrite(
      "set_action_items_done",
      { count: updates.length },
      () => {
        transaction(() => {
          for (const u of updates) {
            const existing = getTask(u.task_id);
            if (!existing) {
              throw new Error(`No task with id ${u.task_id}`);
            }
            setActionItemDone(u.task_id, u.done);
          }
        });
        return { count: updates.length, updates };
      },
    );
  },
);

server.registerTool(
  "delete_action_items",
  {
    description:
      "Permanently delete one or many tasks in a single atomic call. No undo — prefer set_action_items_done with done=true when in doubt. Rolls back on any error.",
    inputSchema: {
      task_ids: z.array(z.number().int()).min(1).max(200),
    },
  },
  async ({ task_ids }) => {
    return runWrite("delete_action_items", { count: task_ids.length }, () => {
      transaction(() => {
        for (const id of task_ids) {
          const existing = getTask(id);
          if (!existing) throw new Error(`No task with id ${id}`);
          deleteActionItem(id);
        }
      });
      return { count: task_ids.length, deleted: task_ids };
    });
  },
);

server.registerTool(
  "tag_meeting",
  {
    description:
      "Attach one or many tags to a meeting in a single atomic call. Tags that don't exist are created (color = null, user recolors in the app). Tag names are matched case-insensitively. Idempotent: re-tagging is a no-op.",
    inputSchema: {
      meeting_id: z.string(),
      tag_names: z
        .array(z.string().min(1).max(60))
        .min(1)
        .max(20)
        .describe(
          "Tag names without leading #. Pass an array even for a single tag: ['foo']. Use one call for everything.",
        ),
    },
  },
  async ({ meeting_id, tag_names }) => {
    return runWrite(
      "tag_meeting",
      { meeting_id, count: tag_names.length },
      () => {
        const m = getMeeting(meeting_id);
        if (!m) throw new Error(`No meeting with id ${meeting_id}`);
        const tags = transaction(() =>
          tag_names.map((name) => {
            const tag = findOrCreateTag(name);
            attachTagToMeeting(meeting_id, tag.id);
            return { id: tag.id, name: tag.name };
          }),
        );
        return { meeting_id, tags };
      },
    );
  },
);

server.registerTool(
  "untag_meeting",
  {
    description:
      "Detach one or many tags from a meeting in a single atomic call. The tags themselves are kept (other meetings keep their reference).",
    inputSchema: {
      meeting_id: z.string(),
      tag_ids: z.array(z.string()).min(1).max(20),
    },
  },
  async ({ meeting_id, tag_ids }) => {
    return runWrite(
      "untag_meeting",
      { meeting_id, count: tag_ids.length },
      () => {
        transaction(() => {
          for (const tid of tag_ids) {
            detachTagFromMeeting(meeting_id, tid);
          }
        });
        return { meeting_id, tag_ids, detached: true };
      },
    );
  },
);

server.registerTool(
  "rename_speakers",
  {
    description:
      "Rename one or many speakers across meetings in a single atomic call. Each rename is scoped to a single meeting (use the voice library in the app to propagate cross-meeting).",
    inputSchema: {
      renames: z
        .array(
          z.object({
            meeting_id: z.string(),
            speaker_id: z
              .string()
              .describe("Raw speaker_id, e.g. SPEAKER_00."),
            display_name: z.string().min(1).max(80),
          }),
        )
        .min(1)
        .max(50),
    },
  },
  async ({ renames }) => {
    return runWrite("rename_speakers", { count: renames.length }, () => {
      transaction(() => {
        for (const r of renames) {
          const m = getMeeting(r.meeting_id);
          if (!m) throw new Error(`No meeting with id ${r.meeting_id}`);
          renameSpeaker({
            meetingId: r.meeting_id,
            speakerId: r.speaker_id,
            displayName: r.display_name,
          });
        }
      });
      return { count: renames.length, renames };
    });
  },
);

// --- Connect --------------------------------------------------------------

async function main() {
  // Surface the resolved DB path on stderr — Claude Desktop displays this
  // in its MCP debug log if the user opens it. Stdout is reserved for JSON-RPC.
  process.stderr.write(
    `[scribe-mcp] version ${VERSION}, db: ${resolveDbPath()}\n`,
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(
    `[scribe-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
