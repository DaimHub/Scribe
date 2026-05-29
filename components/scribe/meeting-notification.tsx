"use client";

import { useEffect, useMemo, useState } from "react";
import type { NotificationPayload } from "@/lib/scribe-global";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Floating notification that appears a few minutes before a calendar event
 * starts. Two primary actions: join the meeting URL (Meet/Zoom/…) and start
 * the Scribe recording. The dismiss action also fires when either primary
 * action runs.
 */
export function MeetingNotification() {
  const t = useT();
  const [payload, setPayload] = useState<NotificationPayload | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const prevBody = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = prevBody;
      document.documentElement.style.background = prevHtml;
    };
  }, []);

  useEffect(() => {
    // Pull anything already buffered in the main process (the IPC push may
    // have fired before this effect attached), then subscribe to future
    // updates.
    void window.scribe.floating.getNotification().then((p) => {
      if (p) setPayload(p);
    });
    return window.scribe.floating.onNotification(setPayload);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const subline = useMemo(() => {
    if (!payload) return "";
    const diffMin = Math.round((payload.event.start_at_ms - now) / 60_000);
    if (diffMin > 1) return t("notification.startsInMin", { count: diffMin });
    if (diffMin === 1) return t("notification.startsInOne");
    if (diffMin === 0) return t("notification.startingNow");
    return t("notification.startedAgo", { count: Math.abs(diffMin) });
  }, [payload, now, t]);

  if (!payload) {
    // Window opens with payload pushed via floating:notification — show
    // nothing until it arrives.
    return <div className="h-screen w-screen bg-transparent" />;
  }

  const { event } = payload;
  const hasMeetingUrl = Boolean(event.hangout_link);

  return (
    <div
      className={cn(
        "flex h-screen w-screen flex-col gap-2 rounded-2xl border border-border",
        "bg-background/95 p-3 shadow-2xl backdrop-blur [-webkit-app-region:drag]",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {event.title}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{subline}</div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("common.dismiss")}
          onClick={() => window.scribe.floating.dismissNotification()}
          className="-mr-1 -mt-1 [-webkit-app-region:no-drag]"
        >
          <span className="text-base leading-none">×</span>
        </Button>
      </div>

      <div className="mt-auto flex items-center gap-2 [-webkit-app-region:no-drag]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (event.hangout_link) {
              window.scribe.floating.openMeetingUrl(event.hangout_link);
            }
          }}
          disabled={!hasMeetingUrl}
          className="flex-1 rounded-full text-xs"
        >
          {t("notification.join")}
        </Button>
        <Button
          size="sm"
          onClick={() => window.scribe.floating.startScribeForEvent(event.id)}
          className="flex-1 rounded-full text-xs"
        >
          {t("recording.start")}
        </Button>
      </div>
    </div>
  );
}
