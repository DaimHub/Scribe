"use client";

import { useMemo } from "react";
import type { MeetingDetail } from "@/lib/scribe-global";
import { SpeakerChip } from "./speaker-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { useScribe } from "@/lib/store";
import { cn } from "@/lib/utils";

export function NotesView({ detail }: { detail: MeetingDetail }) {
  const labelFor = useMemo(() => {
    const map = new Map(detail.speakers.map((s) => [s.speaker_id, s.display_name]));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "Unassigned");
  }, [detail.speakers]);

  const grouped = useMemo(() => {
    const map = new Map<string | null, typeof detail.tasks>();
    for (const t of detail.tasks) {
      const key = t.assignee_speaker_id;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [detail.tasks]);

  if (detail.tasks.length === 0) {
    return <NotesEmptyOrLoading detail={detail} />;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-6">
      <h2 className="text-lg font-semibold tracking-tight">Action items</h2>
      {grouped.map(([speakerId, tasks]) => (
        <div key={speakerId ?? "unassigned"} className="flex flex-col gap-2.5">
          <SpeakerChip
            speakerId={speakerId}
            displayName={labelFor(speakerId)}
            className="self-start"
          />
          <ul className="flex flex-col gap-2 pl-1">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NotesEmptyOrLoading({ detail }: { detail: MeetingDetail }) {
  const meetingId = detail.meeting.id;
  const processing = useScribe((s) => s.processing);
  const generate = useScribe((s) => s.generate);
  const processMeeting = useScribe((s) => s.processMeeting);
  const isBusy =
    processing.kind === "processing" && processing.meetingId === meetingId;
  const isGenerating =
    isBusy &&
    processing.kind === "processing" &&
    (processing.phase === "generate" || processing.flow === "full");
  const hasTranscript = detail.transcript.length > 0;
  if (isGenerating) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-6">
        <Skeleton className="h-6 w-32 rounded" />
        {[0, 1].map((g) => (
          <div key={g} className="flex flex-col gap-2.5">
            <Skeleton className="h-5 w-24 rounded-full" />
            <ul className="flex flex-col gap-2 pl-1">
              {[0, 1, 2].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Skeleton className="size-4 shrink-0 rounded-md" />
                  <Skeleton className={cn("h-4 rounded", t === 1 ? "w-3/5" : "w-4/5")} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-sm font-medium text-muted-foreground">No tasks yet</div>
      <div className="max-w-sm text-xs text-muted-foreground">
        {hasTranscript
          ? "Generate notes to extract action items per speaker."
          : "Process the recording to transcribe and extract action items."}
      </div>
      <Button
        size="sm"
        className="mt-2 gap-1.5"
        onClick={() =>
          hasTranscript
            ? void generate(meetingId)
            : void processMeeting(meetingId)
        }
        disabled={isBusy}
      >
        <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
        {isBusy
          ? "Processing…"
          : hasTranscript
            ? "Generate notes"
            : "Process meeting"}
      </Button>
    </div>
  );
}

function TaskRow({ task }: { task: { id: number; text: string; done: 0 | 1 } }) {
  const setMeetingTaskDone = useScribe((s) => s.setMeetingTaskDone);
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed">
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded-md border p-0 text-[10px]",
          task.done
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
            : "border-border",
        )}
        onClick={() => void setMeetingTaskDone(task.id, !task.done)}
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
      >
        {task.done ? "✓" : ""}
      </Button>
      <span className={cn(task.done && "text-muted-foreground line-through")}>{task.text}</span>
    </li>
  );
}
