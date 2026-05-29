"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useScribe } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useT, type TranslateFn } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Calendar03Icon,
  PlusSignIcon,
  TaskDone01Icon,
  Search01Icon,
  UserCircleIcon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons";
import {
  FilterPill,
  PriorityBars,
  dueFilterLabel,
  formatDueShort,
  isOverdue,
  matchesDueFilter,
  priorityLabel,
  type DueFilter,
} from "./task-controls";

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
  const refreshTick = useScribe((s) => s.refreshTick);

  const t = useT();
  const [filter, setFilter] = useState<Filter>("open");
  const [newText, setNewText] = useState("");

  // Filter state. `assignee` is "all", "me", or a voice_library_id.
  const [assignee, setAssignee] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all"); // all | "0".."3"
  const [due, setDue] = useState<DueFilter>("all");
  const [query, setQuery] = useState("");

  // The "me" identity = the single is_me person in the voice library.
  const [meId, setMeId] = useState<string | null>(null);
  const [meName, setMeName] = useState<string | null>(null);

  useEffect(() => {
    void loadPersonal();
    void loadMeetingTasks();
  }, [loadPersonal, loadMeetingTasks]);

  const loadMe = useCallback(async () => {
    const people = await window.scribe.voice.listPeople();
    const me = people.find((p) => p.is_me === 1) ?? null;
    setMeId(me?.id ?? null);
    setMeName(me?.display_name ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMe();
  }, [loadMe, refreshTick]);

  // Re-pull "me" when the voice library changes (mark/unmark me, renames).
  useEffect(() => {
    const unsub = window.scribe.voice.onLibraryChanged(() => {
      void loadMe();
    });
    return unsub;
  }, [loadMe]);

  // Selectable assignees: people (other than me) who own at least one meeting
  // action item. Derived from the unfiltered list so the active selection stays
  // listed regardless of the other filters.
  const assigneeOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const task of meetingTasks) {
      if (task.assignee_library_id && task.assignee_library_id !== meId) {
        byId.set(
          task.assignee_library_id,
          task.assignee_name ?? task.assignee_library_id,
        );
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [meetingTasks, meId]);

  const q = query.trim().toLowerCase();

  // Personal tasks are inherently the user's own and carry no priority: they
  // show under "Anyone"/"Me" with no priority filter, and are hidden when
  // filtering by a specific other person or by priority.
  const personalInScope =
    (assignee === "all" || assignee === "me") && priority === "all";

  const scopedPersonal = useMemo(() => {
    if (!personalInScope) return [];
    return personal.filter((p) => {
      if (q && !p.text.toLowerCase().includes(q)) return false;
      if (!matchesDueFilter(p.due_at_ms, due)) return false;
      return true;
    });
  }, [personal, personalInScope, q, due]);

  const scopedMeeting = useMemo(() => {
    return meetingTasks.filter((task) => {
      if (assignee === "me") {
        if (!meetingTaskIsMine(task, meId, meName)) return false;
      } else if (assignee !== "all") {
        if (task.assignee_library_id !== assignee) return false;
      }
      if (priority !== "all" && task.priority !== Number(priority)) return false;
      if (
        q &&
        !task.text.toLowerCase().includes(q) &&
        !task.meeting_title.toLowerCase().includes(q)
      )
        return false;
      if (!matchesDueFilter(task.due_at_ms, due)) return false;
      return true;
    });
  }, [meetingTasks, assignee, priority, q, due, meId, meName]);

  // Counts reflect the active filter scope, so the open/done/all badges show
  // how many fall in each state within the current filters.
  const counts = useMemo(() => {
    const all = [...scopedPersonal, ...scopedMeeting];
    const open = all.filter((x) => !x.done).length;
    return { open, done: all.length - open, all: all.length };
  }, [scopedPersonal, scopedMeeting]);

  const filteredPersonal = useMemo(
    () =>
      filter === "all"
        ? scopedPersonal
        : scopedPersonal.filter((p) => (filter === "done" ? p.done : !p.done)),
    [scopedPersonal, filter],
  );
  const filteredMeeting = useMemo(
    () =>
      filter === "all"
        ? scopedMeeting
        : scopedMeeting.filter((task) =>
            filter === "done" ? task.done : !task.done,
          ),
    [scopedMeeting, filter],
  );

  // When showing open tasks, bucket them by date so the user sees what needs
  // attention now. Skip bucketing for the done/all views.
  const groupedPersonal = useMemo(
    () => (filter === "open" ? bucketPersonalByDate(filteredPersonal, t) : null),
    [filteredPersonal, filter, t],
  );
  const groupedMeeting = useMemo(
    () => (filter === "open" ? bucketMeetingByDate(filteredMeeting, t) : null),
    [filteredMeeting, filter, t],
  );

  const filtersActive =
    assignee !== "all" || priority !== "all" || due !== "all" || q !== "";
  const noResults =
    filteredPersonal.length === 0 && filteredMeeting.length === 0;

  function resetFilters() {
    setAssignee("all");
    setPriority("all");
    setDue("all");
    setQuery("");
  }

  async function onAdd() {
    if (!newText.trim()) return;
    await createPersonal(newText, null);
    setNewText("");
  }

  const assigneeLabel =
    assignee === "me"
      ? t("tasks.filter.me")
      : (assigneeOptions.find((o) => o.id === assignee)?.name ?? assignee);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="mx-auto w-full max-w-3xl shrink-0 px-8 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <HugeiconsIcon
            icon={TaskDone01Icon}
            className="size-6 text-foreground/80"
          />
          <h1 className="text-2xl font-bold tracking-tight">
            {t("tasks.title")}
          </h1>
        </div>

        <div className="mt-5">
          <ToggleGroup
            value={filter}
            onValueChange={(vals) => {
              const next = vals[0] as Filter | undefined;
              if (next) setFilter(next);
            }}
            size="sm"
          >
            <ToggleGroupItem value="open" aria-label={t("tasks.toggle.open")}>
              {t("tasks.toggle.open")}
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {counts.open}
              </Badge>
            </ToggleGroupItem>
            <ToggleGroupItem value="done" aria-label={t("tasks.toggle.done")}>
              {t("tasks.toggle.done")}
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {counts.done}
              </Badge>
            </ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label={t("tasks.toggle.all")}>
              {t("tasks.toggle.all")}
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {counts.all}
              </Badge>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterPill
            icon={UserCircleIcon}
            active={assignee !== "all"}
            label={
              assignee !== "all" ? assigneeLabel : t("tasks.filter.assignee")
            }
            onClear={() => setAssignee("all")}
          >
            <DropdownMenuRadioGroup
              value={assignee}
              onValueChange={(v) => setAssignee(v as string)}
            >
              <DropdownMenuRadioItem value="all">
                {t("tasks.filter.anyone")}
              </DropdownMenuRadioItem>
              {meId && (
                <DropdownMenuRadioItem value="me">
                  {t("tasks.filter.me")}
                </DropdownMenuRadioItem>
              )}
              {assigneeOptions.length > 0 && <DropdownMenuSeparator />}
              {assigneeOptions.map((o) => (
                <DropdownMenuRadioItem key={o.id} value={o.id}>
                  {o.name}
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

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 text-muted-foreground"
            >
              {t("tasks.filter.reset")}
            </Button>
          )}

          <div className="relative ml-auto">
            <HugeiconsIcon
              icon={Search01Icon}
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("tasks.filter.search")}
              className="h-8 w-44 pl-8 text-[13px]"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onAdd();
            }}
            placeholder={t("tasks.personal.placeholder")}
            className="h-9 text-sm"
          />
          <Button onClick={() => void onAdd()} disabled={!newText.trim()}>
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            {t("common.add")}
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pb-16">
          {filtersActive && noResults ? (
            <NoResults onReset={resetFilters} />
          ) : (
            <>
              {personalInScope && (
                <Section
                  title={t("tasks.personal.title")}
                  count={filteredPersonal.length}
                  empty={t("tasks.personal.empty")}
                >
                  {groupedPersonal ? (
                    <div className="flex flex-col gap-4">
                      {groupedPersonal.map(({ label, items, tone }) =>
                        items.length === 0 ? null : (
                          <DateBucket
                            key={label}
                            label={label}
                            count={items.length}
                            tone={tone}
                          >
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
              )}

              <Section
                title={t("tasks.meetings.title")}
                count={filteredMeeting.length}
                empty={t("tasks.meetings.empty")}
              >
                {groupedMeeting ? (
                  <div className="flex flex-col gap-4">
                    {groupedMeeting.map(({ label, items, tone }) =>
                      items.length === 0 ? null : (
                        <DateBucket
                          key={label}
                          label={label}
                          count={items.length}
                          tone={tone}
                        >
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
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function NoResults({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl border text-muted-foreground">
        <HugeiconsIcon icon={Search01Icon} className="size-5" />
      </div>
      <div className="text-sm font-semibold">{t("tasks.empty.title")}</div>
      <div className="max-w-xs text-[12px] text-muted-foreground">
        {t("tasks.empty.desc")}
      </div>
      <Button variant="outline" size="sm" onClick={onReset} className="mt-1">
        {t("tasks.filter.reset")}
      </Button>
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
  const t = useT();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {count === 1
            ? t("tasks.countOne", { count })
            : t("tasks.countMany", { count })}
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
  const t = useT();
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
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
              isOverdue(task.due_at_ms, !!task.done) && "text-destructive",
            )}
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-3" />
            {formatDueShort(task.due_at_ms)}
          </span>
        )}
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={onDelete}
        aria-label={t("tasks.delete")}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
  assignee_library_id: string | null;
  priority: number;
  due_at_ms: number | null;
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
  const t = useT();
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
        <div className="flex items-start gap-2">
          {task.priority > 0 && (
            <PriorityBars
              level={task.priority}
              className="mt-1 shrink-0"
              label={priorityLabel(task.priority, t)}
            />
          )}
          <span
            className={cn(
              "text-[14px] leading-snug",
              task.done && "text-muted-foreground line-through",
            )}
          >
            {task.text}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {task.assignee_name && (
            <Badge variant="secondary" className="font-medium">
              {task.assignee_name}
            </Badge>
          )}
          <button
            type="button"
            onClick={onOpenMeeting}
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            title={t("tasks.openMeeting")}
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
          {task.due_at_ms != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                isOverdue(task.due_at_ms, !!task.done)
                  ? "text-destructive"
                  : "text-foreground/70",
              )}
            >
              <span>·</span>
              <HugeiconsIcon icon={Calendar03Icon} className="size-3" />
              {formatDueShort(task.due_at_ms)}
            </span>
          )}
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

// A meeting action item is "mine" when its assignee speaker is linked to the
// is_me person, with a display-name fallback for speakers labelled with my name
// but not yet linked to the voice library.
function meetingTaskIsMine(
  task: MeetingTask,
  meId: string | null,
  meName: string | null,
): boolean {
  if (meId && task.assignee_library_id === meId) return true;
  if (
    meName &&
    task.assignee_name &&
    task.assignee_name.toLowerCase() === meName.toLowerCase()
  )
    return true;
  return false;
}

function bucketPersonalByDate(
  tasks: PersonalTask[],
  t: TranslateFn,
): Bucket<PersonalTask>[] {
  const today = startOfDay(Date.now());
  const tomorrow = today + 24 * 60 * 60 * 1000;
  const weekEnd = today + 7 * 24 * 60 * 60 * 1000;

  const overdue: PersonalTask[] = [];
  const todayB: PersonalTask[] = [];
  const soon: PersonalTask[] = [];
  const later: PersonalTask[] = [];
  const none: PersonalTask[] = [];

  for (const task of tasks) {
    if (task.due_at_ms == null) {
      none.push(task);
      continue;
    }
    const due = startOfDay(task.due_at_ms);
    if (due < today) overdue.push(task);
    else if (due < tomorrow) todayB.push(task);
    else if (due < weekEnd) soon.push(task);
    else later.push(task);
  }
  return [
    { label: t("tasks.group.overdue"), tone: "overdue", items: overdue },
    { label: t("tasks.group.today"), tone: "today", items: todayB },
    { label: t("tasks.group.thisWeek"), tone: "soon", items: soon },
    { label: t("tasks.group.later"), tone: "later", items: later },
    { label: t("tasks.group.noDate"), tone: "none", items: none },
  ];
}

function bucketMeetingByDate(
  tasks: MeetingTask[],
  t: TranslateFn,
): Bucket<MeetingTask>[] {
  const today = startOfDay(Date.now());
  const weekStart = today - 6 * 24 * 60 * 60 * 1000;

  const todayB: MeetingTask[] = [];
  const week: MeetingTask[] = [];
  const older: MeetingTask[] = [];

  for (const task of tasks) {
    const d = startOfDay(task.meeting_started_at_ms);
    if (d >= today) todayB.push(task);
    else if (d >= weekStart) week.push(task);
    else older.push(task);
  }
  return [
    { label: t("tasks.group.todayMeetings"), tone: "today", items: todayB },
    { label: t("tasks.group.thisWeek"), tone: "soon", items: week },
    { label: t("tasks.group.older"), tone: "later", items: older },
  ];
}
