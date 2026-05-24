"use client";

import { useMemo } from "react";
import { speakerHue } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  speakerId: string;
  displayName: string;
  size?: "sm" | "md";
  className?: string;
}

export function SpeakerAvatar({ speakerId, displayName, size = "sm", className }: Props) {
  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }, [displayName]);

  const hue = speakerHue(speakerId);

  return (
    <div
      title={displayName}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background",
        size === "sm" ? "size-6" : "size-8 text-xs",
        className,
      )}
      style={{ background: `oklch(0.65 0.13 ${hue})` }}
    >
      {initials}
    </div>
  );
}

export function SpeakerAvatarStack({
  speakers,
  max = 3,
  size = "sm",
}: {
  speakers: Array<{ speaker_id: string; display_name: string }>;
  max?: number;
  size?: "sm" | "md";
}) {
  const shown = speakers.slice(0, max);
  const extra = speakers.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((s) => (
        <SpeakerAvatar
          key={s.speaker_id}
          speakerId={s.speaker_id}
          displayName={s.display_name}
          size={size}
        />
      ))}
      {extra > 0 && (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background",
            size === "sm" ? "size-6" : "size-8 text-xs",
          )}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
