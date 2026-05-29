"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMute02Icon,
} from "@hugeicons/core-free-icons";
import type { TranscriptRow } from "@/lib/scribe-global";
import {
  bindAudioElement,
  setActiveSegment,
  setIsPlaying,
} from "@/lib/audio-playback";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  meetingId: string;
  micWavPath: string | null;
  sysWavPath: string | null;
  transcript: TranscriptRow[];
}

/**
 * Renders custom shadcn-styled controls over up to two hidden `<audio>`
 * elements — one for mic, one for system audio — driven in lock-step so the
 * user hears the full conversation (own voice from mic + others' voices from
 * the system loopback). Either channel may be missing or silent and the other
 * still plays. Streams from the `scribe-media://` protocol so seeks don't
 * have to download the whole WAV.
 *
 * The mic element is the timekeeper when present (else system). Play/pause
 * and seek commands fan out to both; the secondary's `currentTime` is nudged
 * back into sync if it drifts more than 150ms during playback.
 */
export function AudioPlayer({
  meetingId,
  micWavPath,
  sysWavPath,
  transcript,
}: Props) {
  const micRef = useRef<HTMLAudioElement>(null);
  const sysRef = useRef<HTMLAudioElement>(null);
  const t = useT();
  const hasMic = !!micWavPath;
  const hasSys = !!sysWavPath;

  const [isPlaying, setLocalIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // While the user is dragging the seek thumb we want the slider to show the
  // pending value, not whatever the audio element happens to report mid-drag.
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Iterate over both elements where present. Order is mic first so it
  // remains the timekeeper / "primary" element wherever that matters.
  const forEachEl = (fn: (el: HTMLAudioElement) => void) => {
    if (micRef.current) fn(micRef.current);
    if (sysRef.current) fn(sysRef.current);
  };
  const primary = (): HTMLAudioElement | null =>
    micRef.current ?? sysRef.current;
  const secondary = (): HTMLAudioElement | null =>
    micRef.current ? sysRef.current : null;

  useEffect(() => {
    const el = primary();
    if (!el) return;
    bindAudioElement(meetingId, el);
    return () => bindAudioElement(meetingId, null);
  }, [meetingId, hasMic, hasSys]);

  useEffect(() => {
    const el = primary();
    if (!el) return;

    const onPlay = () => {
      setIsPlaying(true);
      setLocalIsPlaying(true);
      // Start the secondary too. If it errored or hasn't loaded yet, ignore.
      const sec = secondary();
      if (sec && sec.paused) void sec.play().catch(() => {});
    };
    const onPause = () => {
      setIsPlaying(false);
      setLocalIsPlaying(false);
      const sec = secondary();
      if (sec && !sec.paused) sec.pause();
    };
    const onTime = () => {
      setCurrentTime(el.currentTime);
      const tMs = el.currentTime * 1000;
      setActiveSegment(findActiveSegment(transcript, tMs));
      // Drift correction — keep both channels within ~150ms. Local files
      // streamed via custom protocol shouldn't drift much in practice, but
      // browser-internal buffering can introduce small offsets.
      const sec = secondary();
      if (sec && Math.abs(sec.currentTime - el.currentTime) > 0.15) {
        sec.currentTime = el.currentTime;
      }
    };
    const onMeta = () => {
      // Streamed WAVs sometimes report Infinity until the first seek; guard
      // so we don't poison the slider's max.
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onVolume = () => {
      setVolume(el.volume);
      setMuted(el.muted);
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("volumechange", onVolume);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("volumechange", onVolume);
    };
  }, [transcript, hasMic, hasSys]);

  if (!hasMic && !hasSys) return null;

  const togglePlay = () => {
    const el = primary();
    if (!el) return;
    if (el.paused) {
      // Resync the secondary BEFORE play() so they start aligned. The play
      // events on the primary will then trigger the secondary too via onPlay.
      const sec = secondary();
      if (sec) sec.currentTime = el.currentTime;
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const toggleMute = () => {
    const el = primary();
    if (!el) return;
    const next = !el.muted;
    forEachEl((a) => {
      a.muted = next;
    });
  };

  const onSeek = (value: number) => setSeekDraft(value);
  const onSeekCommit = (value: number) => {
    forEachEl((a) => {
      a.currentTime = value;
    });
    setSeekDraft(null);
  };

  const onVolumeChange = (value: number) => {
    forEachEl((a) => {
      a.volume = value;
      // Adjusting volume implicitly unmutes — matches how every other player
      // (YouTube, native HTML5) behaves.
      if (value > 0 && a.muted) a.muted = false;
    });
  };

  const sliderMax = duration > 0 ? duration : 0;
  const sliderValue = seekDraft ?? currentTime;
  const effectiveVolume = muted ? 0 : volume;
  const volumeIcon =
    muted || volume === 0
      ? VolumeMute02Icon
      : volume < 0.5
        ? VolumeLowIcon
        : VolumeHighIcon;

  return (
    <div className="sticky top-0 z-20 -mx-8 bg-background/95 px-8 py-4 backdrop-blur">
      {hasMic && (
        <audio
          ref={micRef}
          preload="metadata"
          src={`scribe-media://${meetingId}/mic`}
          className="sr-only"
        />
      )}
      {hasSys && (
        <audio
          ref={sysRef}
          preload="metadata"
          src={`scribe-media://${meetingId}/system`}
          className="sr-only"
        />
      )}
      <div className="flex h-9 items-center gap-3 rounded-full bg-muted/50 px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={togglePlay}
          aria-label={isPlaying ? t("player.pause") : t("player.play")}
          className="rounded-full"
        >
          <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} />
        </Button>

        <div className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(sliderValue)}
          <span className="mx-1 opacity-50">/</span>
          {formatTime(duration)}
        </div>

        <Slider
          aria-label={t("player.seek")}
          value={sliderValue}
          min={0}
          max={sliderMax || 1}
          step={0.1}
          disabled={sliderMax === 0}
          onValueChange={onSeek}
          onValueCommitted={onSeekCommit}
          className="flex-1"
        />

        <Popover>
          <PopoverTrigger
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                aria-label={t("player.volume")}
                className="rounded-full"
              >
                <HugeiconsIcon icon={volumeIcon} />
              </Button>
            )}
          />
          <PopoverContent
            side="top"
            sideOffset={8}
            align="center"
            className="flex w-auto flex-col items-center gap-3 p-3"
          >
            <Slider
              orientation="vertical"
              aria-label={t("player.volume")}
              value={effectiveVolume}
              min={0}
              max={1}
              step={0.01}
              onValueChange={onVolumeChange}
              className="h-28"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleMute}
              aria-label={muted ? t("player.unmute") : t("player.mute")}
              className={cn(
                "rounded-full",
                muted && "text-muted-foreground",
              )}
            >
              <HugeiconsIcon icon={volumeIcon} />
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function findActiveSegment(rows: TranscriptRow[], tMs: number): number {
  // Binary search for the segment whose start_ms <= tMs < next.start_ms.
  if (rows.length === 0) return -1;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = rows[mid].start_ms;
    if (s <= tMs) {
      if (mid === rows.length - 1 || rows[mid + 1].start_ms > tMs) return mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return -1;
}
