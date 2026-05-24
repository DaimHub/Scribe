"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CalendarEventRow } from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  Edit02Icon,
  Link04Icon,
  LinkSquare01Icon,
  Location01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

interface EventPopoverProps {
  event: CalendarEventRow;
  /** The element that opens the popover when clicked. */
  children: React.ReactNode;
  /** Side relative to the trigger. */
  side?: "top" | "bottom" | "left" | "right";
}

export function EventPopover({
  event,
  children,
  side = "bottom",
}: EventPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => <button type="button" {...props} />}
        className="block w-full text-left"
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        sideOffset={6}
        className="w-[360px] max-w-[92vw] p-0"
      >
        <EventDetail event={event} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function EventDetail({
  event,
  onClose,
}: {
  event: CalendarEventRow;
  onClose: () => void;
}) {
  const selectMeeting = useScribe((s) => s.selectMeeting);
  const setActiveSection = useScribe((s) => s.setActiveSection);

  const attendees = parseAttendees(event.attendees_json);
  const isLinked = !!event.meeting_id;

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-1.5 border-b px-4 py-3">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-[14px] font-semibold leading-tight">
            {event.title}
          </h3>
          {isLinked && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                "dark:text-emerald-400",
              )}
            >
              <HugeiconsIcon icon={Edit02Icon} className="size-2.5" />
              Recorded
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <HugeiconsIcon icon={Calendar03Icon} className="size-3" />
          {formatEventWhen(event)}
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 py-3 text-[12.5px]">
        {event.location && (
          <Row icon={Location01Icon}>
            <span className="leading-snug">{event.location}</span>
          </Row>
        )}
        {event.hangout_link && (
          <Row icon={Link04Icon}>
            <a
              href={event.hangout_link}
              target="_blank"
              rel="noreferrer"
              className="truncate text-primary hover:underline"
            >
              {prettyMeetUrl(event.hangout_link)}
            </a>
          </Row>
        )}
        {attendees.length > 0 && (
          <Row icon={UserGroupIcon}>
            <div className="flex flex-wrap gap-1">
              {attendees.slice(0, 6).map((a, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="font-medium"
                  title={a.email}
                >
                  {a.displayName ?? a.email.split("@")[0]}
                </Badge>
              ))}
              {attendees.length > 6 && (
                <span className="self-center text-[11px] text-muted-foreground">
                  +{attendees.length - 6} more
                </span>
              )}
            </div>
          </Row>
        )}
        {event.description && (
          <Row>
            <p className="line-clamp-4 whitespace-pre-line leading-snug text-foreground/80">
              {event.description}
            </p>
          </Row>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t bg-muted/30 px-4 py-2.5">
        {isLinked ? (
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => {
              setActiveSection("meetings");
              void selectMeeting(event.meeting_id!);
              onClose();
            }}
          >
            <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
            Open notes
          </Button>
        ) : (
          <span className="flex-1 text-[11px] text-muted-foreground">
            No Scribe recording linked yet.
          </span>
        )}
        {event.hangout_link && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            nativeButton={false}
            render={
              <a
                href={event.hangout_link}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <HugeiconsIcon icon={LinkSquare01Icon} className="size-3" />
            Join
          </Button>
        )}
      </footer>
    </div>
  );
}

function Row({
  icon,
  children,
}: {
  icon?: typeof Calendar03Icon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <div className="mt-0.5 w-3.5 shrink-0">
        {icon && (
          <HugeiconsIcon
            icon={icon}
            className="size-3.5 text-muted-foreground"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function parseAttendees(
  json: string | null,
): Array<{ email: string; displayName?: string; responseStatus?: string }> {
  if (!json) return [];
  try {
    return JSON.parse(json) as Array<{
      email: string;
      displayName?: string;
      responseStatus?: string;
    }>;
  } catch {
    return [];
  }
}

function formatEventWhen(ev: CalendarEventRow): string {
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

function prettyMeetUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/^www\./, "");
  } catch {
    return url;
  }
}
