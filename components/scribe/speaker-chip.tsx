"use client";

import { useMemo, useState } from "react";
import { speakerHue, useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  speakerId: string | null;
  displayName: string;
  className?: string;
  editable?: boolean;
}

export function SpeakerChip({ speakerId, displayName, className, editable = true }: Props) {
  const rename = useScribe((s) => s.renameSpeaker);
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);

  // Memoize derived colors so the inline style object identity is stable —
  // otherwise React.memo on a parent component can't bail out, and the chip
  // re-renders unnecessarily inside virtualized transcripts.
  const { dotStyle, chipStyle, inputStyle } = useMemo(() => {
    const hue = speakerId ? speakerHue(speakerId) : 0;
    const c = speakerId
      ? `oklch(0.72 0.13 ${hue})`
      : "var(--muted-foreground)";
    const tint = speakerId
      ? `color-mix(in oklab, oklch(0.72 0.13 ${hue}) 12%, transparent)`
      : "var(--muted)";
    return {
      dotStyle: { background: c },
      chipStyle: { borderColor: c, background: tint, color: c },
      inputStyle: { borderColor: c },
    };
  }, [speakerId]);

  async function commit() {
    setEditing(false);
    if (!speakerId) return;
    const next = draft.trim();
    if (!next || next === displayName) return;
    await rename(speakerId, next);
  }

  if (editing && editable && speakerId) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(displayName);
            setEditing(false);
          }
        }}
        className={cn(
          "inline-flex h-6 max-w-[12rem] rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium outline-none ring-2 ring-ring",
          className,
        )}
        style={inputStyle}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => editable && speakerId && setEditing(true)}
      disabled={!editable || !speakerId}
      title={editable && speakerId ? t("settings.voice.clickToRename") : undefined}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        editable && speakerId ? "cursor-pointer hover:brightness-95" : "cursor-default",
        className,
      )}
      style={chipStyle}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={dotStyle}
      />
      {displayName}
    </button>
  );
}
