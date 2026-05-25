"use client";

import { useEffect, useMemo, useState } from "react";
import { useScribe } from "@/lib/store";
import type { CalendarEventRow } from "@/lib/scribe-global";
import { EventPopover } from "./event-popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  Edit02Icon,
  GridViewIcon,
  Menu01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";

const DAY_MS = 24 * 60 * 60 * 1000;

type ViewMode = "list" | "month";

export function CalendarView() {
  const accounts = useScribe((s) => s.calendarAccounts);
  const events = useScribe((s) => s.calendarEvents);
  const loadAccounts = useScribe((s) => s.loadCalendarAccounts);
  const loadEvents = useScribe((s) => s.loadCalendarEvents);
  const setActiveSection = useScribe((s) => s.setActiveSection);
  const [view, setView] = useState<ViewMode>("list");

  // Month-view cursor: first day of the visible month.
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(new Date()));

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // Load window: 30 days before the visible range to 60 days after, so
  // navigating between months feels instant after the first load.
  const { fromMs, toMs } = useMemo(() => {
    if (view === "month") {
      const from = startOfMonth(monthCursor).getTime() - 30 * DAY_MS;
      const to = endOfMonth(monthCursor).getTime() + 30 * DAY_MS;
      return { fromMs: from, toMs: to };
    }
    const now = Date.now();
    return { fromMs: now - 7 * DAY_MS, toMs: now + 60 * DAY_MS };
  }, [view, monthCursor]);

  useEffect(() => {
    if (accounts.length === 0) return;
    void loadEvents(fromMs, toMs);
  }, [accounts.length, fromMs, toMs, loadEvents]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="mx-auto w-full max-w-5xl shrink-0 px-8 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <HugeiconsIcon
            icon={Calendar03Icon}
            className="size-6 text-foreground/80"
          />
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <div className="ml-auto">
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your Google Calendar events, linked to your Scribe recordings when they overlap.
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 pb-16">
          {accounts.length === 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm">
                <HugeiconsIcon
                  icon={Calendar03Icon}
                  className="size-4 text-muted-foreground"
                />
                <span>No calendar connected.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveSection("settings")}
                className="gap-1.5"
              >
                <HugeiconsIcon icon={Settings01Icon} className="size-3.5" />
                Open Settings
              </Button>
            </div>
          )}

          {view === "list" ? (
            <CalendarList events={events} />
          ) : (
            <CalendarMonth
              cursor={monthCursor}
              setCursor={setMonthCursor}
              events={events}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <ToggleGroup
      value={value}
      onValueChange={(vals) => {
        const next = vals[0] as ViewMode | undefined;
        if (next) onChange(next);
      }}
      size="xs"
      aria-label="Calendar view"
    >
      <ToggleGroupItem value="list" aria-label="List view">
        <HugeiconsIcon icon={Menu01Icon} className="size-3.5" />
        List
      </ToggleGroupItem>
      <ToggleGroupItem value="month" aria-label="Month view">
        <HugeiconsIcon icon={GridViewIcon} className="size-3.5" />
        Month
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

function CalendarList({
  events,
}: {
  events: CalendarEventLike[];
}) {
  // Split the day-grouped events into past (strictly before today) and
  // upcoming (today + future). Past gets reversed so the most recent day is
  // at the top of the section once expanded — matches how the user reads
  // history. Default-collapsed because the page is forward-looking.
  const { past, upcoming } = useMemo(() => {
    const grouped = groupByDay(events);
    const startOfToday = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    const past: typeof grouped = [];
    const upcoming: typeof grouped = [];
    for (const g of grouped) {
      const dayMs = new Date(g.key).getTime();
      if (dayMs < startOfToday) past.push(g);
      else upcoming.push(g);
    }
    past.reverse();
    return { past, upcoming };
  }, [events]);

  const [showPast, setShowPast] = useState(false);
  const pastCount = useMemo(
    () => past.reduce((n, g) => n + g.events.length, 0),
    [past],
  );

  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        No events in the next 60 days. Hit the refresh icon to sync.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="-mx-1 inline-flex items-center gap-2 self-start rounded px-1 py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={cn(
                "size-3.5 transition-transform",
                !showPast && "-rotate-90",
              )}
            />
            <span className="font-semibold uppercase tracking-wider">
              Past
            </span>
            <span className="text-[11px] normal-case tracking-normal">
              {pastCount} {pastCount === 1 ? "event" : "events"}
            </span>
          </button>
          {showPast && (
            <div className="flex flex-col gap-6 opacity-80">
              {past.map((g) => (
                <DayGroup key={g.key} group={g} />
              ))}
            </div>
          )}
        </section>
      )}

      {upcoming.map((g) => (
        <DayGroup key={g.key} group={g} />
      ))}

      {upcoming.length === 0 && !showPast && past.length > 0 && (
        // Nothing coming up — make sure the user sees that explicitly rather
        // than reading the past list as if it were the schedule.
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing coming up. Past events are above.
        </div>
      )}
    </div>
  );
}

function DayGroup({
  group,
}: {
  group: { key: string; label: string; events: CalendarEventLike[] };
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 -mx-1 flex items-baseline gap-3 bg-background/95 px-1 py-1 backdrop-blur">
        <h3 className="text-sm font-semibold tracking-tight">{group.label}</h3>
        <span className="text-[11px] text-muted-foreground">
          {group.events.length} {group.events.length === 1 ? "event" : "events"}
        </span>
      </div>
      <ul className="flex flex-col">
        {group.events.map((ev, i) => (
          <li
            key={ev.id}
            className={cn(
              "border-b last:border-b-0",
              i === group.events.length - 1 && "border-b-0",
            )}
          >
            <EventPopover event={ev as CalendarEventRow}>
              <div className="group flex w-full gap-4 px-1 py-2.5 transition-colors hover:bg-accent/40">
                <div className="flex w-24 shrink-0 flex-col font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span className="text-foreground/90">
                    {formatTime(ev.start_at_ms)}
                  </span>
                  <span>{formatTime(ev.end_at_ms)}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {ev.title}
                    </span>
                    {ev.meeting_id && <RecordedBadge />}
                  </div>
                  {ev.location && (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {ev.location}
                    </span>
                  )}
                </div>
              </div>
            </EventPopover>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Month grid view
// ---------------------------------------------------------------------------

function CalendarMonth({
  cursor,
  setCursor,
  events,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  events: CalendarEventLike[];
}) {
  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDay = useMemo(() => bucketEventsByDay(events), [events]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const todayKey = dayKey(new Date());
  const currentMonth = cursor.getMonth();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, -1))}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Previous month"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Next month"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </button>
        <h2 className="text-base font-semibold tracking-tight capitalize">
          {monthLabel}
        </h2>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setCursor(startOfMonth(new Date()))}
          className="ml-1"
        >
          Today
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="grid grid-cols-7 border-b">
          {weekdayHeaders().map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d, idx) => {
            const k = dayKey(d);
            const dayEvents = eventsByDay.get(k) ?? [];
            const isOtherMonth = d.getMonth() !== currentMonth;
            const isToday = k === todayKey;
            return (
              <div
                key={idx}
                className={cn(
                  "flex min-h-[110px] flex-col gap-1 border-b border-r p-1.5",
                  isOtherMonth && "bg-muted/20 text-muted-foreground",
                  idx % 7 === 6 && "border-r-0",
                  idx >= 35 && "border-b-0",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
                      isToday &&
                        "bg-primary text-primary-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[9px] text-muted-foreground">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <li key={ev.id}>
                      <EventPopover event={ev as CalendarEventRow}>
                        <span
                          className={cn(
                            "group flex w-full items-center gap-1 truncate rounded-sm px-1 py-0.5 text-left text-[10.5px] transition-colors",
                            ev.meeting_id
                              ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
                              : "bg-primary/10 text-primary hover:bg-primary/15",
                          )}
                        >
                          <span className="font-mono text-[9px] tabular-nums opacity-70">
                            {formatTime(ev.start_at_ms)}
                          </span>
                          <span className="flex-1 truncate font-medium">
                            {ev.title}
                          </span>
                          {ev.meeting_id && (
                            <HugeiconsIcon
                              icon={Edit02Icon}
                              className="size-2.5 shrink-0"
                            />
                          )}
                        </span>
                      </EventPopover>
                    </li>
                  ))}
                  {dayEvents.length > 3 && (
                    <li className="px-1 text-[9.5px] text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecordedBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      title="A Scribe recording is linked to this event"
    >
      <HugeiconsIcon icon={Edit02Icon} className="size-2.5" />
      Recorded
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Date / event helpers
// ---------------------------------------------------------------------------

interface CalendarEventLike {
  id: string;
  start_at_ms: number;
  end_at_ms: number;
  title: string;
  location: string | null;
  hangout_link: string | null;
  meeting_id: string | null;
}

function groupByDay(
  events: CalendarEventLike[],
): Array<{ key: string; label: string; events: CalendarEventLike[] }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfToday = today.getTime();
  const map = new Map<string, CalendarEventLike[]>();
  for (const ev of events) {
    const d = new Date(ev.start_at_ms);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    const arr = map.get(key) ?? [];
    arr.push(ev);
    map.set(key, arr);
  }
  const groups: Array<{ key: string; label: string; events: CalendarEventLike[] }> = [];
  for (const [key, arr] of map.entries()) {
    arr.sort((a, b) => a.start_at_ms - b.start_at_ms);
    const dayMs = new Date(key).getTime();
    const diffDays = Math.round((dayMs - startOfToday) / DAY_MS);
    let label: string;
    if (diffDays === 0) label = "Today";
    else if (diffDays === 1) label = "Tomorrow";
    else if (diffDays === -1) label = "Yesterday";
    else
      label = new Date(dayMs).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    groups.push({ key, label, events: arr });
  }
  groups.sort((a, b) => new Date(a.key).getTime() - new Date(b.key).getTime());
  return groups;
}

function bucketEventsByDay(
  events: CalendarEventLike[],
): Map<string, CalendarEventLike[]> {
  const m = new Map<string, CalendarEventLike[]>();
  for (const ev of events) {
    const k = dayKey(new Date(ev.start_at_ms));
    const arr = m.get(k) ?? [];
    arr.push(ev);
    m.set(k, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.start_at_ms - b.start_at_ms);
  }
  return m;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfMonth(d: Date): Date {
  const out = new Date(d);
  out.setDate(1);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfMonth(d: Date): Date {
  const out = startOfMonth(d);
  out.setMonth(out.getMonth() + 1);
  out.setMilliseconds(-1);
  return out;
}

function addMonths(d: Date, n: number): Date {
  const out = startOfMonth(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

/**
 * Returns a 42-cell array (6 rows × 7 cols) starting Monday-of-the-week
 * containing the 1st of the month, so the grid always fills neatly.
 */
function buildMonthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  // Monday = 0 ... Sunday = 6 (ISO-ish).
  const dayIdx = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - dayIdx);
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

function weekdayHeaders(): string[] {
  // Monday-first abbreviations, respecting the user's locale.
  const ref = new Date(2024, 0, 1); // a Monday
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ref);
    d.setDate(ref.getDate() + i);
    out.push(
      d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
    );
  }
  return out;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
