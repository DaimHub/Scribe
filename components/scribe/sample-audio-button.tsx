"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useSampleClipUrl } from "@/lib/voice-clip";
import { cn } from "@/lib/utils";

type Variant = "icon" | "labeled";

interface Props {
  filePath: string | null;
  variant?: Variant;
  /**
   * "hide" (default) renders nothing when no sample is available.
   * "text" renders muted "No sample available" / "Sample failed to load"
   * placeholders — used in the voice-tagging panel where the row should
   * always show *something* in the sample slot.
   */
  emptyFallback?: "hide" | "text";
  className?: string;
}

export function SampleAudioButton({
  filePath,
  variant = "icon",
  emptyFallback = "hide",
  className,
}: Props) {
  const { url, loading, error } = useSampleClipUrl(filePath);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setPlaying(false);
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    el.addEventListener("ended", onEnded);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);
    return () => {
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
    };
  }, [url]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  }

  if (!filePath || error) {
    if (emptyFallback === "hide") return null;
    return (
      <span
        className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        title={error ?? undefined}
      >
        {error ? "Sample failed to load" : "No sample available"}
      </span>
    );
  }

  const label = playing ? "Pause" : loading ? "Loading…" : "Play sample";
  const icon = playing ? PauseIcon : PlayIcon;

  return (
    <>
      <Button
        type="button"
        size={variant === "icon" ? "icon-xs" : "xs"}
        variant={variant === "icon" ? "ghost" : "outline"}
        onClick={toggle}
        disabled={loading || !url}
        title={variant === "icon" ? label : undefined}
        aria-label={variant === "icon" ? label : undefined}
        className={cn(variant === "labeled" && playing && "bg-muted", className)}
      >
        <HugeiconsIcon icon={icon} />
        {variant === "labeled" && <span>{label}</span>}
      </Button>
      {url && <audio ref={audioRef} src={url} preload="auto" />}
    </>
  );
}
