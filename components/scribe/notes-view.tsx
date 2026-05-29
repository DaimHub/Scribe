"use client";

import { useMemo, useState } from "react";
import type { MeetingDetail } from "@/lib/scribe-global";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  Copy01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PlusSignIcon,
  SparklesIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { useScribe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TemplateMenuItems } from "./template-menu-items";
import { useTemplatesList } from "@/lib/use-templates-list";
import { AnthropicModelPicker, useAskMode } from "./anthropic-model-picker";
import {
  AssigneePicker,
  DueDatePicker,
  FilterPill,
  PriorityBars,
  PriorityPicker,
  dueFilterLabel,
  matchesDueFilter,
  priorityLabel,
  type DueFilter,
} from "./task-controls";

type Task = MeetingDetail["tasks"][number];

export function NotesView({ detail }: { detail: MeetingDetail }) {
  if (detail.tasks.length === 0) {
    return <NotesEmptyOrLoading detail={detail} />;
  }
  return <TaskManager detail={detail} />;
}

function TaskManager({ detail }: { detail: MeetingDetail }) {
  const t = useT();
  const tasks = detail.tasks;
  const speakers = detail.speakers;
  const meetingId = detail.meeting.id;
  const addMeetingTask = useScribe((s) => s.addMeetingTask);
  const reportError = useScribe((s) => s.reportError);

  const [assignee, setAssignee] = useState("all"); // all | __none__ | <speaker_id>
  const [priority, setPriority] = useState("all"); // all | "0".."3"
  const [due, setDue] = useState<DueFilter>("all");
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");

  const filtered = useMemo(
    () =>
      tasks.filter((task) => {
        if (assignee !== "all") {
          if (assignee === "__none__") {
            if (task.assignee_speaker_id != null) return false;
          } else if (task.assignee_speaker_id !== assignee) return false;
        }
        if (priority !== "all" && task.priority !== Number(priority))
          return false;
        if (!matchesDueFilter(task.due_at_ms, due)) return false;
        return true;
      }),
    [tasks, assignee, priority, due],
  );

  const filtersActive =
    assignee !== "all" || priority !== "all" || due !== "all";

  async function onAdd() {
    const text = newText.trim();
    if (!text) {
      setAdding(false);
      return;
    }
    await addMeetingTask(meetingId, text);
    setNewText("");
  }

  function onCopyAll() {
    const text = filtered
      .map((tk) => `- [${tk.done ? "x" : " "}] ${tk.text}`)
      .join("\n");
    void navigator.clipboard
      .writeText(text)
      .catch(() => reportError(t("common.copyFailed")));
  }

  const assigneeLabel =
    assignee === "all"
      ? t("tasks.filter.assignee")
      : assignee === "__none__"
        ? t("notes.unassigned")
        : (speakers.find((s) => s.speaker_id === assignee)?.display_name ??
          t("tasks.filter.assignee"));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-8 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          icon={UserCircleIcon}
          active={assignee !== "all"}
          label={assigneeLabel}
          onClear={() => setAssignee("all")}
        >
          <DropdownMenuRadioGroup value={assignee} onValueChange={setAssignee}>
            <DropdownMenuRadioItem value="all">
              {t("tasks.filter.anyone")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="__none__">
              {t("notes.unassigned")}
            </DropdownMenuRadioItem>
            {speakers.length > 0 && <DropdownMenuSeparator />}
            {speakers.map((s) => (
              <DropdownMenuRadioItem key={s.speaker_id} value={s.speaker_id}>
                {s.display_name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </FilterPill>

        <FilterPill
          icon={Analytics01Icon}
          active={priority !== "all"}
          label={
            priority === "all"
              ? t("tasks.filter.priority")
              : priorityLabel(Number(priority), t)
          }
          onClear={() => setPriority("all")}
        >
          <DropdownMenuRadioGroup value={priority} onValueChange={setPriority}>
            <DropdownMenuRadioItem value="all">
              {t("tasks.filter.priorityAny")}
            </DropdownMenuRadioItem>
            {[3, 2, 1, 0].map((lvl) => (
              <DropdownMenuRadioItem key={lvl} value={String(lvl)}>
                <PriorityBars level={lvl} className="mr-1" />
                {priorityLabel(lvl, t)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </FilterPill>

        <FilterPill
          icon={Calendar03Icon}
          active={due !== "all"}
          label={due === "all" ? t("tasks.filter.due") : dueFilterLabel(due, t)}
          onClear={() => setDue("all")}
        >
          <DropdownMenuRadioGroup
            value={due}
            onValueChange={(v) => setDue(v as DueFilter)}
          >
            <DropdownMenuRadioItem value="all">
              {t("tasks.filter.dueAny")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="overdue">
              {t("tasks.group.overdue")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="today">
              {t("tasks.group.today")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="week">
              {t("tasks.group.thisWeek")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="none">
              {t("tasks.group.noDate")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </FilterPill>

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setAdding(true)}
            aria-label={t("tasks.add")}
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onCopyAll}
            aria-label={t("tasks.copyAll")}
          >
            <HugeiconsIcon icon={Copy01Icon} className="size-4" />
          </Button>
        </div>
      </div>

      {adding && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onAdd();
              if (e.key === "Escape") {
                setNewText("");
                setAdding(false);
              }
            }}
            onBlur={() => {
              if (!newText.trim()) setAdding(false);
            }}
            placeholder={t("tasks.addPlaceholder")}
            className="h-9 text-sm"
          />
          <Button onClick={() => void onAdd()} disabled={!newText.trim()}>
            {t("common.add")}
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-10 text-center text-[12px] text-muted-foreground">
          {filtersActive ? t("tasks.empty.title") : t("notes.empty.title")}
        </div>
      ) : (
        <ul className="flex flex-col">
          {filtered.map((task, i) => (
            <TaskItem
              key={task.id}
              task={task}
              speakers={speakers}
              isLast={i === filtered.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskItem({
  task,
  speakers,
  isLast,
}: {
  task: Task;
  speakers: MeetingDetail["speakers"];
  isLast: boolean;
}) {
  const t = useT();
  const setDone = useScribe((s) => s.setMeetingTaskDone);
  const setPriority = useScribe((s) => s.setMeetingTaskPriority);
  const setDue = useScribe((s) => s.setMeetingTaskDueDate);
  const setAssignee = useScribe((s) => s.setMeetingTaskAssignee);
  const updateText = useScribe((s) => s.updateMeetingTaskText);
  const duplicate = useScribe((s) => s.duplicateMeetingTask);
  const remove = useScribe((s) => s.deleteMeetingTask);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== task.text) void updateText(task.id, next);
    else setDraft(task.text);
  }

  return (
    <li
      className={cn(
        "group flex items-start gap-2.5 py-2.5",
        !isLast && "border-b",
      )}
    >
      <div className="mt-0.5">
        <PriorityPicker
          value={task.priority}
          onChange={(v) => void setPriority(task.id, v)}
        />
      </div>
      <Checkbox
        checked={!!task.done}
        onCheckedChange={(v) => void setDone(task.id, !!v)}
        className="mt-1 shrink-0"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(task.text);
                setEditing(false);
              }
            }}
            onBlur={commit}
            className="h-7 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(task.text);
              setEditing(true);
            }}
            className={cn(
              "block w-full text-left text-[14px] leading-snug break-words",
              task.done && "text-muted-foreground line-through",
            )}
          >
            {task.text}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <DueDatePicker
          value={task.due_at_ms}
          onChange={(ms) => void setDue(task.id, ms)}
          done={!!task.done}
        />
        <AssigneePicker
          speakers={speakers}
          value={task.assignee_speaker_id}
          onChange={(sp) => void setAssignee(task.id, sp)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <button
                {...props}
                type="button"
                aria-label={t("tasks.more")}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 hover:bg-accent aria-expanded:opacity-100"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              </button>
            )}
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void duplicate(task.id)}>
              <HugeiconsIcon icon={Copy01Icon} className="size-4" />
              {t("tasks.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void remove(task.id)}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              {t("tasks.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function NotesEmptyOrLoading({ detail }: { detail: MeetingDetail }) {
  const t = useT();
  const meetingId = detail.meeting.id;
  const processing = useScribe((s) => s.processing);
  const generate = useScribe((s) => s.generate);
  const openSpeakerPrompt = useScribe((s) => s.openSpeakerPrompt);
  const [chosenModel, setChosenModel] = useState<string | null>(null);
  const askMode = useAskMode();
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
      <div className="text-sm font-medium text-muted-foreground">
        {t("notes.empty.title")}
      </div>
      <div className="max-w-sm text-xs text-muted-foreground">
        {hasTranscript
          ? t("notes.empty.generate")
          : t("notes.empty.process")}
      </div>
      {hasTranscript && (
        <AnthropicModelPicker
          value={chosenModel}
          onChange={setChosenModel}
          className="w-56 items-start text-left"
        />
      )}
      <GenerateButton
        currentTemplateId={detail.meeting.notes_template_id}
        hasTranscript={hasTranscript}
        isBusy={isBusy || (hasTranscript && askMode && chosenModel === null)}
        onPick={(templateId) => {
          // With a transcript already on hand we just regenerate notes —
          // no diarization runs, no need for the speaker prompt. Without
          // a transcript yet, processMeeting hits diarize, so funnel it
          // through the prompt (templateId pre-picked → only num_speakers
          // gets surfaced in the dialog; the model picker lives there too).
          if (hasTranscript) {
            void (async () => {
              await window.scribe.templates.setMeetingTemplate(
                meetingId,
                templateId,
              );
              await generate(meetingId, chosenModel ?? undefined);
            })();
          } else {
            openSpeakerPrompt(meetingId, { kind: "process", templateId });
          }
        }}
      />
    </div>
  );
}

/** Generate / Process button that, when clicked, opens a template picker
 *  popup. Clicking a template = persist on the meeting + invoke the
 *  parent's onPick (which kicks off generate/process). Uses the dropdown
 *  pattern instead of a separate inline picker so the template choice is
 *  bound to the action — no orphan state once notes exist. */
function GenerateButton({
  currentTemplateId,
  hasTranscript,
  isBusy,
  onPick,
}: {
  currentTemplateId: string | null;
  hasTranscript: boolean;
  isBusy: boolean;
  onPick: (templateId: string) => void;
}) {
  const t = useT();
  const { templates, defaultId } = useTemplatesList();
  const selectedId = currentTemplateId ?? defaultId;
  const label = isBusy
    ? t("summary.processing")
    : hasTranscript
      ? t("summary.generateNotes")
      : t("summary.processMeeting");

  // Fallback when templates haven't loaded yet — plain button with the
  // backend's default template applied implicitly.
  if (!templates) {
    return (
      <Button size="sm" className="mt-2 gap-1.5" disabled={isBusy}>
        <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button {...props} size="sm" className="mt-2 gap-1.5" disabled={isBusy}>
            <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
            {label}
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
          </Button>
        )}
      />
      <DropdownMenuContent align="center">
        <TemplateMenuItems
          templates={templates}
          selectedId={selectedId}
          onPick={onPick}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
