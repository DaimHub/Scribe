"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import type { FolderRow, MeetingDetail, Pipeline } from "@/lib/scribe-global";
import { useScribe, formatDuration } from "@/lib/store";
import { SpeakerAvatarStack } from "./speaker-avatar";
import { TagChips } from "./tag-chips";
import { LinkedEventRow } from "./linked-event-row";

function parsePipeline(json: string | null): Pipeline | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Pipeline;
  } catch {
    return null;
  }
}

const PIPELINE_LABELS: Record<keyof Pipeline, string> = {
  transcribe: "Transcribe",
  align: "Align",
  diarize: "Diarize",
  notes: "Notes",
};

function PipelineBadges({ pipeline }: { pipeline: Pipeline }) {
  const entries = (Object.entries(pipeline) as Array<[keyof Pipeline, string | undefined]>).filter(
    (e): e is [keyof Pipeline, string] => !!e[1],
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entries.map(([step, model]) => (
        <span
          key={step}
          className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
          title={`${PIPELINE_LABELS[step]}: ${model}`}
        >
          <span className="uppercase tracking-wider text-muted-foreground">
            {PIPELINE_LABELS[step]}
          </span>
          <span className="text-foreground/80">{model}</span>
        </span>
      ))}
    </div>
  );
}

export function MeetingHeader({ detail }: { detail: MeetingDetail }) {
  const rename = useScribe((s) => s.renameMeeting);
  const transcribe = useScribe((s) => s.transcribe);
  const generate = useScribe((s) => s.generate);
  const processMeeting = useScribe((s) => s.processMeeting);
  const remove = useScribe((s) => s.deleteMeeting);
  const processing = useScribe((s) => s.processing);
  const folders = useScribe((s) => s.folders);
  const setExpanded = useScribe((s) => s.setExpanded);
  const selectMeeting = useScribe((s) => s.selectMeeting);

  const [title, setTitle] = useState(detail.meeting.title);
  const [lastSyncedId, setLastSyncedId] = useState(detail.meeting.id);
  const [lastSyncedTitle, setLastSyncedTitle] = useState(detail.meeting.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset local title when meeting changes OR when the upstream title is updated
  // externally (e.g. through a rename in the sidebar). Mirrors React docs pattern.
  if (
    lastSyncedId !== detail.meeting.id ||
    lastSyncedTitle !== detail.meeting.title
  ) {
    setLastSyncedId(detail.meeting.id);
    setLastSyncedTitle(detail.meeting.title);
    setTitle(detail.meeting.title);
  }

  const folderPath = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const path: FolderRow[] = [];
    let cursor: string | null = detail.meeting.folder_id;
    let depth = 0;
    while (cursor && depth < 64) {
      const f: FolderRow | undefined = byId.get(cursor);
      if (!f) break;
      path.unshift(f);
      cursor = f.parent_id;
      depth++;
    }
    return path;
  }, [folders, detail.meeting.folder_id]);

  function focusFolder(folderId: string) {
    // Expand from root down to the clicked folder so it's visible in the sidebar.
    const byId = new Map(folders.map((f) => [f.id, f]));
    const chain: string[] = [];
    let cursor: string | null = folderId;
    let depth = 0;
    while (cursor && depth < 64) {
      chain.unshift(cursor);
      const f: FolderRow | undefined = byId.get(cursor);
      if (!f) break;
      cursor = f.parent_id;
      depth++;
    }
    for (const id of chain) setExpanded(id, true);
    // Deselect any current meeting so the highlight follows the folder context.
    void selectMeeting(detail.meeting.id);
  }

  const busy =
    processing.kind !== "idle" && processing.meetingId === detail.meeting.id;
  const canProcess =
    !busy &&
    (detail.meeting.status === "recorded" ||
      detail.meeting.status === "transcribed" ||
      detail.meeting.status === "diarized" ||
      detail.meeting.status === "done" ||
      detail.meeting.status === "error");
  const hasTranscript = detail.transcript.length > 0;
  const hasNotes = detail.tasks.length > 0 || !!detail.meeting.summary_json;

  async function commitTitle() {
    const next = title.trim();
    if (!next || next === detail.meeting.title) {
      setTitle(detail.meeting.title);
      return;
    }
    await rename(detail.meeting.id, next);
  }

  return (
    <header className="flex flex-col">
      <div className="flex items-center justify-between gap-3 px-8">
        <Breadcrumb
          title={detail.meeting.title}
          folderPath={folderPath}
          onFolderClick={focusFolder}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => void processMeeting(detail.meeting.id)}
              disabled={!canProcess}
            >
              {hasNotes ? "Re-process meeting" : "Process meeting"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void transcribe(detail.meeting.id)}
              disabled={!canProcess}
            >
              {hasTranscript ? "Re-transcribe only" : "Transcribe only"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void generate(detail.meeting.id)}
              disabled={busy || !hasTranscript}
            >
              {hasNotes ? "Re-generate notes only" : "Generate notes only"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void remove(detail.meeting.id)}
            >
              Delete meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-auto w-full max-w-3xl px-8 pt-6 pb-4">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitle(detail.meeting.title);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full truncate border-none bg-transparent text-2xl font-bold tracking-tight outline-none focus:ring-0"
          spellCheck={false}
        />

        <dl className="mt-5 grid grid-cols-[6rem_1fr] gap-y-3 text-sm">
          <dt className="text-muted-foreground">Time</dt>
          <dd className="flex items-center gap-2">
            <span>{formatTime(detail.meeting.started_at_ms, detail.meeting.duration_ms)}</span>
          </dd>

          <dt className="self-center text-muted-foreground">Speakers</dt>
          <dd className="flex items-center gap-2.5">
            {detail.speakers.length > 0 ? (
              <>
                <SpeakerAvatarStack speakers={detail.speakers} max={3} />
                <span className="text-muted-foreground">·</span>
                <span>
                  {detail.speakers.map((s) => s.display_name).join(", ")}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No speakers identified</span>
            )}
          </dd>

          <dt className="self-center text-muted-foreground">Status</dt>
          <dd className="flex items-center gap-2 text-sm">
            <StatusPill status={detail.meeting.status} />
          </dd>

          <dt className="self-center text-muted-foreground">Event</dt>
          <dd>
            <LinkedEventRow detail={detail} />
          </dd>

          <dt className="self-center text-muted-foreground">Tags</dt>
          <dd>
            <TagChips meetingId={detail.meeting.id} />
          </dd>

          {(() => {
            const pipeline = parsePipeline(detail.meeting.pipeline_json);
            if (!pipeline || Object.keys(pipeline).length === 0) return null;
            return (
              <>
                <dt className="self-center text-muted-foreground">Pipeline</dt>
                <dd>
                  <PipelineBadges pipeline={pipeline} />
                </dd>
              </>
            );
          })()}
        </dl>
      </div>
    </header>
  );
}

function Breadcrumb({
  title,
  folderPath,
  onFolderClick,
}: {
  title: string;
  folderPath: FolderRow[];
  onFolderClick: (folderId: string) => void;
}) {
  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      <span className="shrink-0 font-medium">Meetings</span>
      {folderPath.map((f) => (
        <Fragment key={f.id}>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 shrink-0" />
          <button
            type="button"
            onClick={() => onFolderClick(f.id)}
            className="max-w-[10rem] truncate hover:text-foreground"
            title={f.name}
          >
            {f.name}
          </button>
        </Fragment>
      ))}
      <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 shrink-0" />
      <span className="truncate text-foreground" title={title}>
        {title}
      </span>
    </nav>
  );
}

function StatusPill({ status }: { status: MeetingDetail["meeting"]["status"] }) {
  const map: Record<typeof status, { label: string; dot: string }> = {
    recording: { label: "Recording", dot: "bg-red-500 animate-pulse" },
    recorded: { label: "Recorded", dot: "bg-amber-500" },
    transcribing: { label: "Transcribing", dot: "bg-blue-500 animate-pulse" },
    transcribed: { label: "Transcribed", dot: "bg-blue-500" },
    diarized: { label: "Diarized", dot: "bg-blue-500" },
    done: { label: "Done", dot: "bg-emerald-500" },
    error: { label: "Error", dot: "bg-destructive" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium">
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function formatTime(startMs: number, durationMs: number | null): string {
  const d = new Date(startMs);
  const dateStr = d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (durationMs) {
    const end = new Date(startMs + durationMs).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr}, ${timeStr} – ${end}  ·  ${formatDuration(durationMs)}`;
  }
  return `${dateStr}, ${timeStr}`;
}
