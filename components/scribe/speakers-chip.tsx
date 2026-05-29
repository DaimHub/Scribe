"use client";

import { useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpeakerAvatarStack } from "./speaker-avatar";
import { VoiceTaggingPanelContent } from "./voice-tagging-panel";
import type { SpeakerRow } from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LINKED_BADGE, REVIEW_BADGE } from "@/lib/status-color";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";

interface Props {
  meetingId: string;
  speakers: SpeakerRow[];
  /** Number of avatars + names to show in the collapsed trigger. */
  max?: number;
}

export function SpeakersChip({ meetingId, speakers, max = 3 }: Props) {
  // The chip is both the visible summary AND the popover trigger for the
  // voice-tagging surface. Store ownership of open/mode means the panel can
  // still be opened programmatically (e.g. the auto-show on needs_review)
  // even though the trigger lives here.
  const t = useT();
  const open = useScribe((s) => s.voiceTaggingPanelOpen);
  const setOpen = useScribe((s) => s.setVoiceTaggingPanelOpen);
  const setMode = useScribe((s) => s.setVoiceTaggingPanelMode);

  const reviewCount = speakers.filter((s) => s.needs_review === 1).length;
  const linkedCount = speakers.filter(
    (s) => s.voice_library_id != null && s.needs_review === 0,
  ).length;

  const openPopover = useCallback(() => {
    setMode(reviewCount > 0 ? "pending" : "all");
    setOpen(true);
  }, [reviewCount, setMode, setOpen]);

  // No speakers identified yet — still surface a clickable affordance so the
  // user can open the panel (which shows the re-diarize CTA / no-token empty
  // state). Previously this was a flat text label with no entry point.
  if (speakers.length === 0) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          onClick={openPopover}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <HugeiconsIcon icon={UserAdd01Icon} className="size-3.5" />
          {t("header.tagVoices")}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="relative w-[22rem] overflow-visible p-0"
        >
          <VoiceTaggingPanelContent meetingId={meetingId} />
        </PopoverContent>
      </Popover>
    );
  }

  const shown = speakers.slice(0, max);
  const extra = speakers.length - shown.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={openPopover}
        className={cn(
          "group inline-flex items-center gap-2 rounded-md py-0.5 text-sm transition-colors",
          "hover:bg-accent/60",
        )}
        title={t("speakersChip.manage")}
      >
        <SpeakerAvatarStack speakers={speakers} max={max} />
        <span className="text-muted-foreground">·</span>
        <span className="truncate">
          {shown.map((s) => s.display_name).join(", ")}
        </span>
        {extra > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            +{extra}
          </span>
        )}
        {reviewCount > 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
              REVIEW_BADGE,
            )}
            title={
              reviewCount === 1
                ? t("speakersChip.needReviewOne")
                : t("speakersChip.needReviewMany", { count: reviewCount })
            }
          >
            <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
            {reviewCount}
          </span>
        ) : linkedCount > 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
              LINKED_BADGE,
            )}
            title={t("speakersChip.linked", {
              linked: linkedCount,
              total: speakers.length,
            })}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
            {linkedCount}
          </span>
        ) : null}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-3.5 text-muted-foreground transition-transform group-data-[popup-open]:rotate-180"
        />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="relative w-[22rem] overflow-visible p-0">
        <VoiceTaggingPanelContent meetingId={meetingId} />
      </PopoverContent>
    </Popover>
  );
}
