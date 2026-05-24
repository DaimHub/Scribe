"use client";

import { useEffect, useRef } from "react";
import type { TranscriptRow } from "@/lib/scribe-global";
import {
  bindAudioElement,
  setActiveSegment,
  setIsPlaying,
} from "@/lib/audio-playback";

interface Props {
  meetingId: string;
  micWavPath: string | null;
  sysWavPath: string | null;
  transcript: TranscriptRow[];
}

/**
 * Picks the first available channel (mic preferred) and renders the native
 * HTML5 audio controls. Streams from the custom `scribe-media://` protocol
 * so seeks don't have to download the full WAV. While playing, runs a binary
 * search over `transcript` on each `timeupdate` to keep `activeSegmentIdx`
 * up to date for the transcript view.
 */
export function AudioPlayer({
  meetingId,
  micWavPath,
  sysWavPath,
  transcript,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const channel = micWavPath ? "mic" : sysWavPath ? "system" : null;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !channel) return;
    bindAudioElement(meetingId, el);
    return () => bindAudioElement(meetingId, null);
  }, [meetingId, channel]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !channel) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      const t = el.currentTime * 1000;
      setActiveSegment(findActiveSegment(transcript, t));
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
    };
  }, [transcript, channel]);

  if (!channel) return null;

  return (
    <div className="sticky top-0 z-20 -mx-8 border-b bg-background/95 px-8 py-2 backdrop-blur">
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={`scribe-media://${meetingId}/${channel}`}
        className="h-9 w-full"
      />
    </div>
  );
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
      // Could be this one or a later one; tighten lower bound.
      if (mid === rows.length - 1 || rows[mid + 1].start_ms > tMs) return mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return -1;
}
