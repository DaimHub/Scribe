"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useSampleClipUrl } from "@/lib/voice-clip";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const { url, loading, error } = useSampleClipUrl(filePath);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // True when the user clicked play before the clip URL finished loading.
  // We auto-trigger play() as soon as the audio element mounts with src,
  // so the first click feels responsive instead of requiring a second click
  // once data arrives.
  const [pendingPlay, setPendingPlay] = useState(false);

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

  // Flush a pending play request once the audio source is available.
  useEffect(() => {
    if (!pendingPlay) return;
    const el = audioRef.current;
    if (!url || !el) return;
    setPendingPlay(false);
    void el.play();
  }, [pendingPlay, url]);

  function toggle() {
    const el = audioRef.current;
    if (playing && el) {
      el.pause();
      setPendingPlay(false);
      return;
    }
    if (el && url) {
      void el.play();
      return;
    }
    // Clip hasn't loaded yet — queue the play for when it arrives.
    setPendingPlay(true);
  }

  if (!filePath || error) {
    if (emptyFallback === "hide") return null;
    return (
      <span
        className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        title={error ?? undefined}
      >
        {error ? t("sample.failed") : t("sample.unavailable")}
      </span>
    );
  }

  // While the clip is fetching, surface that visually but still accept the
  // click — `pendingPlay` queues it for when the audio mounts. Avoids the
  // "have to click twice" feel right after the panel opens.
  const isBuffering = (loading || pendingPlay) && !playing;
  const label = playing
    ? t("player.pause")
    : isBuffering
      ? t("common.loading")
      : t("sample.play");
  const icon = playing ? PauseIcon : PlayIcon;

  return (
    <>
      <Button
        type="button"
        size={variant === "icon" ? "icon-xs" : "xs"}
        variant={variant === "icon" ? "ghost" : "outline"}
        onClick={toggle}
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
