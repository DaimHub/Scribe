"use client";

import { useScribe } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon, RecordIcon } from "@hugeicons/core-free-icons";
import { useT } from "@/lib/i18n";

/**
 * Compact Start/Stop Scribe button used in the top bar.
 *
 * When a calendar event is happening right now, the label switches to
 * "Start for <event>" (truncated). A tooltip shows the full context.
 */
export function StartScribeButton() {
  const startRecording = useScribe((s) => s.startRecording);
  const stopRecording = useScribe((s) => s.stopRecording);
  const recording = useScribe((s) => s.recording);
  const activeEvent = useScribe((s) => s.activeCalendarEvent);
  const t = useT();

  const isRecording = recording.kind === "recording";
  const isStarting = recording.kind === "starting";
  const isStopping = recording.kind === "stopping";
  const isBusy = isStarting || isStopping;

  const label = isRecording
    ? t("recording.stop")
    : isStarting
      ? t("recording.startingEllipsis")
      : isStopping
        ? t("recording.stoppingEllipsis")
        : activeEvent
          ? t("recording.startEvent", {
              title: truncate(activeEvent.title, 16),
            })
          : t("recording.start");

  const button = (
    <Button
      size="sm"
      variant={isRecording ? "destructive" : "default"}
      className={cn("h-8 gap-1.5 [-webkit-app-region:no-drag]")}
      onClick={() =>
        isRecording ? void stopRecording() : void startRecording()
      }
      disabled={isBusy}
    >
      <HugeiconsIcon
        icon={isRecording ? RecordIcon : FlashIcon}
        className={cn("size-3.5", isRecording && "animate-pulse")}
      />
      {label}
    </Button>
  );

  if (!activeEvent || isRecording) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={(props) => <span {...props}>{button}</span>} />
      <TooltipContent side="bottom">
        {t("recording.linkedTooltip", {
          title: activeEvent.title,
          minutes: minutesAgo(activeEvent.start_at_ms),
        })}
      </TooltipContent>
    </Tooltip>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function minutesAgo(ms: number): number {
  return Math.max(0, Math.round((Date.now() - ms) / 60_000));
}
