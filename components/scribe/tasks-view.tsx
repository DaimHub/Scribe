"use client";

import { useEffect, useMemo, useState } from "react";
import { useScribe } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Calendar03Icon,
  PlusSignIcon,
  TaskDone01Icon,
} from "@hugeicons/core-free-icons";

type Filter = "open" | "done" | "all";

export function TasksView() {
  const personal = useScribe((s) => s.personalTasks);
  const meetingTasks = useScribe((s) => s.allMeetingTasks);
  const loadPersonal = useScribe((s) => s.loadPersonalTasks);
  const loadMeetingTasks = useScribe((s) => s.loadAllMeetingTasks);
  const createPersonal = useScribe((s) => s.createPersonalTask);
  const setPersonalDone = useScribe((s) => s.setPersonalTaskDone);
  const deletePersonal = useScribe((s) => s.deletePersonalTask);
  const setMeetingDone = useScribe((s) => s.setMeetingTaskDone);
  const selectMeeting = useScribe((s) => s.selectMeeting);
  const setActiveSection = useScribe((s) => s.setActiveSection);

  const [filter, setFilter] = useState<Filter>("open");
  const [newText, setNewText] = useState("");

  useEffect(() => {
    void loadPersonal();
    void loadMeetingTasks();
  }, [loadPersonal, loadMeetingTasks]);

  const counts = useMemo(() => {
    const openPersonal = personal.filter((p) => !p.done).length;
    const openMeeting = meetingTasks.filter((t) => !t.done).length;
    return {
      open: openPersonal + openMeeting,
      done:
        personal.length - openPersonal + (meetingTasks.length - openMeeting),
      all: personal.length + meetingTasks.length,
    };
  }, [personal, meetingTasks]);

  const filteredPersonal = useMemo(() => {
    if (filter === "all") return personal;
    return personal.filter((p) => (filter === "done" ? p.done : !p.done));
  }, [personal, filter]);

  const filteredMeeting = useMemo(() => {
    if (filter === "all") return meetingTasks;
    return meetingTasks.filter((t) => (filter === "done" ? t.done : !t.done));
  }, [meetingTasks, filter]);

  // When showing open tasks, bucket them by date (Overdue/Today/This week/
  // Later/No date) so the user sees what needs attention now. Skip bucketing
  // for the done/all views — chronological list reads cleaner there.
  const groupedPersonal = useMemo(
    () => (filter === "open" ? bucketPersonalByDate(filteredPersonal) : null),
    [filteredPersonal, filter],
  );
  const groupedMeeting = useMemo(
    () => (filter === "open" ? bucketMeetingByDate(filteredMeeting) : null),
    [filteredMeeting, filter],
  );

  async function onAdd() {
    if (!newText.trim()) return;
    await createPersonal(newText, null);
    setNewText("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="mx-auto w-full max-w-3xl shrink-0 px-8 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <HugeiconsIcon
            icon={TaskDone01Icon}
            className="size-6 text-foreground/80"
          />
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your personal todos plus action items extracted from your meetings.
        </p>

        <div className="mt-5">
          <ToggleGroup
            value={filter}
            onValueChange={(vals) => {
              const next = vals[0] as Filter | undefined;
              if (next) setFilter(next);
            }}
            size="sm"
          >
            <ToggleGroupItem value="open" aria-label="Open tasks">
              Open
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {counts.open}
              </Badge>
            </ToggleGroupItem>
            <ToggleGroupItem value="done" aria-label="Done tasks">
              Done
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {counts.done}
              </Badge>
            </ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label="All tasks">
              All
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {counts.all}
              </Badge>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onAdd();
            }}
            placeholder="Add a personal task and press Enter…"
            className="h-9 text-sm"
          />
          <Button onClick={() => void onAdd()} disabled={!newText.trim()}>
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            Add
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pb-16">
          <Section
            title="Personal"
            count={filteredPersonal.length}
            empty="No personal tasks. Add one above."
          >
            {groupedPersonal ? (
              <div className="flex flex-col gap-4">
                {groupedPersonal.map(({ label, items, tone }) =>
                  items.length === 0 ? null : (
                    <DateBucket key={label} label={label} count={items.length} tone={tone}>
                      <ul className="flex flex-col">
                        {items.map((t, i) => (
                          <PersonalTaskItem
                            key={t.id}
                            task={t}
                            isLast={i === items.length - 1}
                            onToggle={(v) => void setPersonalDone(t.id, v)}
                            onDelete={() => void deletePersonal(t.id)}
                          />
                        ))}
                      </ul>
                    </DateBucket>
                  ),
                )}
              </div>
            ) : (
              <ul className="flex flex-col">
                {filteredPersonal.map((t, i) => (
                  <PersonalTaskItem
                    key={t.id}
                    task={t}
                    isLast={i === filteredPersonal.length - 1}
                    onToggle={(v) => void setPersonalDone(t.id, v)}
                    onDelete={() => void deletePersonal(t.id)}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="From meetings"
            count={filteredMeeting.length}
            empty="No action items from meetings yet."
          >
            {groupedMeeting ? (
              <div className="flex flex-col gap-4">
                {groupedMeeting.map(({ label, items, tone }) =>
                  items.length === 0 ? null : (
                    <DateBucket key={label} label={label} count={items.length} tone={tone}>
                      <ul className="flex flex-col">
                        {items.map((t, i) => (
                          <MeetingTaskItem
                            key={t.id}
                            task={t}
                            isLast={i === items.length - 1}
                            onToggle={(v) => void setMeetingDone(t.id, v)}
                            onOpenMeeting={() => {
                              setActiveSection("meetings");
                              void selectMeeting(t.meeting_id);
                            }}
                          />
                        ))}
                      </ul>
                    </DateBucket>
                  ),
                )}
              </div>
            ) : (
              <ul className="flex flex-col">
                {filteredMeeting.map((t, i) => (
                  <MeetingTaskItem
                    key={t.id}
                    task={t}
                    isLast={i === filteredMeeting.length - 1}
                    onToggle={(v) => void setMeetingDone(t.id, v)}
                    onOpenMeeting={() => {
                      setActiveSection("meetings");
                      void selectMeeting(t.meeting_id);
                    }}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {count} {count === 1 ? "task" : "tasks"}
        </span>
      </div>
      {count === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-[12px] text-muted-foreground">
          {empty}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

type BucketTone = "overdue" | "today" | "soon" | "later" | "none";

function DateBucket({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count: number;
  tone: BucketTone;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wider",
            tone === "overdue" && "text-destructive",
            tone === "today" && "text-foreground",
            tone === "soon" && "text-foreground/80",
            (tone === "later" || tone === "none") && "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

interface PersonalTask {
  id: number;
  text: string;
  done: 0 | 1;
  due_at_ms: number | null;
  created_at_ms: number;
}

function PersonalTaskItem({
  task,
  isLast,
  onToggle,
  onDelete,
}: {
  task: PersonalTask;
  isLast: boolean;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        "group flex items-start gap-3 px-1 py-2.5",
        !isLast && "border-b",
      )}
    >
      <Checkbox
        checked={!!task.done}
        onCheckedChange={(v) => onToggle(!!v)}
        className="mt-0.5"
      />
      <div className="flex flex-1 flex-col">
        <span
          className={cn(
            "text-[14px] leading-snug",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.text}
        </span>
        {task.due_at_ms != null && (
          <span className="text-[11px] text-muted-foreground">
            due {new Date(task.due_at_ms).toLocaleDateString()}
          </span>
        )}
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={onDelete}
        aria-label="Delete task"
        className="opacity-0 group-hover:opacity-100"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
      </Button>
    </li>
  );
}

interface MeetingTask {
  id: number;
  text: string;
  done: 0 | 1;
  meeting_id: string;
  meeting_title: string;
  meeting_started_at_ms: number;
  assignee_name: string | null;
}

function MeetingTaskItem({
  task,
  isLast,
  onToggle,
  onOpenMeeting,
}: {
  task: MeetingTask;
  isLast: boolean;
  onToggle: (v: boolean) => void;
  onOpenMeeting: () => void;
}) {
  return (
    <li
      className={cn(
        "group flex items-start gap-3 px-1 py-2.5",
        !isLast && "border-b",
      )}
    >
      <Checkbox
        checked={!!task.done}
        onCheckedChange={(v) => onToggle(!!v)}
        className="mt-0.5"
      />
      <div className="flex flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-[14px] leading-snug",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.text}
        </span>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {task.assignee_name && (
            <Badge variant="secondary" className="font-medium">
              {task.assignee_name}
            </Badge>
          )}
          <button
            type="button"
            onClick={onOpenMeeting}
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            title="Open meeting"
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-3" />
            {task.meeting_title}
          </button>
          <span>·</span>
          <span>
            {new Date(task.meeting_started_at_ms).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </li>
  );
}

interface Bucket<T> {
  label: string;
  tone: BucketTone;
  items: T[];
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function bucketPersonalByDate(tasks: PersonalTask[]): Bucket<PersonalTask>[] {
  const today = startOfDay(Date.now());
  const tomorrow = today + 24 * 60 * 60 * 1000;
  const weekEnd = today + 7 * 24 * 60 * 60 * 1000;

  const overdue: PersonalTask[] = [];
  const todayB: PersonalTask[] = [];
  const soon: PersonalTask[] = [];
  const later: PersonalTask[] = [];
  const none: PersonalTask[] = [];

  for (const t of tasks) {
    if (t.due_at_ms == null) {
      none.push(t);
      continue;
    }
    const due = startOfDay(t.due_at_ms);
    if (due < today) overdue.push(t);
    else if (due < tomorrow) todayB.push(t);
    else if (due < weekEnd) soon.push(t);
    else later.push(t);
  }
  return [
    { label: "Overdue", tone: "overdue", items: overdue },
    { label: "Today", tone: "today", items: todayB },
    { label: "This week", tone: "soon", items: soon },
    { label: "Later", tone: "later", items: later },
    { label: "No date", tone: "none", items: none },
  ];
}

function bucketMeetingByDate(tasks: MeetingTask[]): Bucket<MeetingTask>[] {
  const today = startOfDay(Date.now());
  const weekStart = today - 6 * 24 * 60 * 60 * 1000;

  const todayB: MeetingTask[] = [];
  const week: MeetingTask[] = [];
  const older: MeetingTask[] = [];

  for (const t of tasks) {
    const d = startOfDay(t.meeting_started_at_ms);
    if (d >= today) todayB.push(t);
    else if (d >= weekStart) week.push(t);
    else older.push(t);
  }
  return [
    { label: "Today's meetings", tone: "today", items: todayB },
    { label: "This week", tone: "soon", items: week },
    { label: "Older", tone: "later", items: older },
  ];
}

