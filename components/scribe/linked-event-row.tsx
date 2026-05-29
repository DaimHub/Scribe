"use client";

import { useState } from "react";
import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { CalendarEventRow, MeetingDetail } from "@/lib/scribe-global";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Cancel01Icon,
  LinkSquare01Icon,
  Search01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export function LinkedEventRow({ detail }: { detail: MeetingDetail }) {
  const linked = detail.linkedEvent ?? null;
  const meetingId = detail.meeting.id;
  const unlink = useScribe((s) => s.unlinkMeetingFromEvent);
  const autoLink = useScribe((s) => s.autoLinkMeeting);
  const t = useT();
  const [autoBusy, setAutoBusy] = useState(false);

  if (linked) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        {/* Primary row: event identity + actions. Title can truncate; the
            time and action buttons stay full-width via shrink-0 so they
            never wrap to a second line on their own. */}
        <div className="flex min-w-0 items-center gap-2.5">
          <HugeiconsIcon
            icon={Calendar03Icon}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 truncate font-medium">{linked.title}</span>
          <span className="shrink-0 text-muted-foreground">
            {formatEventTime(linked)}
          </span>
          {linked.hangout_link && (
            <a
              href={linked.hangout_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10"
            >
              <HugeiconsIcon icon={LinkSquare01Icon} className="size-2.5" />
              {t("event.join")}
            </a>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <LinkPicker meetingId={meetingId} />
            <Button
              size="xs"
              variant="ghost"
              onClick={() => void unlink(meetingId)}
              className="text-muted-foreground hover:text-destructive"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              {t("linkedEvent.unlink")}
            </Button>
          </div>
        </div>
        {/* Attendees on their own row, indented under the calendar icon so
            it's visually clear they belong to the event above. */}
        <AttendeeChips
          attendeesJson={linked.attendees_json}
          className="pl-6"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 shrink-0" />
      <span>{t("linkedEvent.notLinked")}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          size="xs"
          variant="ghost"
          disabled={autoBusy}
          onClick={async () => {
            setAutoBusy(true);
            try {
              await autoLink(meetingId, false);
            } finally {
              setAutoBusy(false);
            }
          }}
        >
          <HugeiconsIcon icon={SparklesIcon} className="size-3" />
          {autoBusy ? t("palette.searching") : t("linkedEvent.autoLink")}
        </Button>
        <LinkPicker meetingId={meetingId} />
      </div>
    </div>
  );
}

function LinkPicker({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<
    Awaited<ReturnType<typeof window.scribe.calendar.linkCandidates>>
  >([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const link = useScribe((s) => s.linkMeetingToEvent);
  const t = useT();

  async function refresh() {
    setLoading(true);
    try {
      const rows = await window.scribe.calendar.linkCandidates(meetingId);
      setCandidates(rows);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter.trim()
    ? candidates.filter((c) =>
        c.event.title.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : candidates;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void refresh();
      }}
    >
      <DialogTrigger className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        {t("header.chooseEvent")}
      </DialogTrigger>
      <DialogContent className="w-[560px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>{t("linkedEvent.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("linkedEvent.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("linkedEvent.filterPlaceholder")}
            className="pl-8 text-sm"
          />
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("linkedEvent.loadingCandidates")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("linkedEvent.noCandidates")}
          </div>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.event.id}>
                <button
                  type="button"
                  onClick={async () => {
                    await link(meetingId, c.event.id);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col gap-1 rounded-md border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium">
                      {c.event.title}
                    </span>
                    <ConfidenceBadge value={c.confidence} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatEventTime(c.event)}</span>
                    {c.event.location && (
                      <>
                        <span>·</span>
                        <span className="truncate">{c.event.location}</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    pct >= 80
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      : pct >= 50
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
        : "";
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[10px] tabular-nums", tone)}
    >
      {pct}%
    </Badge>
  );
}

function AttendeeChips({
  attendeesJson,
  className,
}: {
  attendeesJson: string | null;
  className?: string;
}) {
  const t = useT();
  if (!attendeesJson) return null;
  let arr: Array<{ email: string; displayName?: string }>;
  try {
    arr = JSON.parse(attendeesJson) as Array<{
      email: string;
      displayName?: string;
    }>;
  } catch {
    return null;
  }
  if (arr.length === 0) return null;
  const visible = arr.slice(0, 3);
  const extra = arr.length - visible.length;
  return (
    <span
      className={cn(
        "flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {visible.map((a, i) => (
        <span
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/70"
          title={a.email}
        >
          {a.displayName ?? a.email.split("@")[0]}
        </span>
      ))}
      {extra > 0 && <span>{t("common.plusMore", { count: extra })}</span>}
    </span>
  );
}

function formatEventTime(ev: CalendarEventRow): string {
  const start = new Date(ev.start_at_ms);
  const end = new Date(ev.end_at_ms);
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${fmt(start)}–${fmt(end)}`;
}
