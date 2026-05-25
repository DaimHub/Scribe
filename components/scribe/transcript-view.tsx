"use client";

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { MeetingDetail } from "@/lib/scribe-global";
import { SpeakerChip } from "./speaker-chip";
import { formatDuration, useScribe } from "@/lib/store";
import {
  getPlayback,
  seekTo,
  subscribePlayback,
} from "@/lib/audio-playback";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";

export function TranscriptView({ detail }: { detail: MeetingDetail }) {
  const labelFor = useMemo(() => {
    const map = new Map(detail.speakers.map((s) => [s.speaker_id, s.display_name]));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "Speaker");
  }, [detail.speakers]);

  const playback = useSyncExternalStore(subscribePlayback, getPlayback, getPlayback);
  const activeIdx =
    playback.meetingId === detail.meeting.id ? playback.activeSegmentIdx : -1;
  const hasAudio = !!(detail.meeting.mic_wav_path || detail.meeting.sys_wav_path);
  const meetingId = detail.meeting.id;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // The transcript shares the meeting view's outer scroll container with the
  // header + tabs row. Resolve the viewport element once mounted, then keep
  // the offset between viewport top and our container top in sync so the
  // virtualizer can place items correctly.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const viewport = containerRef.current.closest(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;
    setScrollEl(viewport);
  }, []);

  useLayoutEffect(() => {
    if (!scrollEl || !containerRef.current) return;
    const measure = () => {
      if (!containerRef.current || !scrollEl) return;
      const container = containerRef.current.getBoundingClientRect();
      const viewport = scrollEl.getBoundingClientRect();
      setScrollMargin(container.top - viewport.top + scrollEl.scrollTop);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scrollEl);
    if (containerRef.current.parentElement) {
      ro.observe(containerRef.current.parentElement);
    }
    return () => ro.disconnect();
  }, [scrollEl]);

  const virtualizer = useVirtualizer({
    count: detail.transcript.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 96,
    overscan: 8,
    scrollMargin,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (detail.transcript.length === 0) {
    return <TranscriptEmptyOrLoading meetingId={detail.meeting.id} />;
  }

  const items = scrollEl ? virtualizer.getVirtualItems() : [];

  return (
    <div ref={containerRef} className="mx-auto max-w-3xl px-8 py-6">
      <div
        className="relative w-full"
        style={{ height: scrollEl ? virtualizer.getTotalSize() : undefined }}
      >
        {items.map((virtual) => {
          const seg = detail.transcript[virtual.index];
          const isActive = virtual.index === activeIdx;
          return (
            <div
              key={seg.segment_idx}
              data-index={virtual.index}
              ref={virtualizer.measureElement}
              className={cn(
                "flex gap-3 rounded-md py-1 pb-4 -mx-2 px-2 transition-colors",
                isActive && "bg-primary/5",
              )}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtual.start - scrollMargin}px)`,
              }}
            >
              {hasAudio ? (
                <Button
                  variant="link"
                  onClick={() => seekTo(meetingId, seg.start_ms / 1000)}
                  className="h-auto w-12 shrink-0 justify-end p-0 pt-0.5 font-mono text-[11px] font-normal tabular-nums text-muted-foreground hover:text-primary hover:no-underline"
                  title="Jump to this moment"
                >
                  {formatDuration(seg.start_ms)}
                </Button>
              ) : (
                <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatDuration(seg.start_ms)}
                </span>
              )}
              <div className="flex flex-1 flex-col gap-1.5">
                <SpeakerChip
                  speakerId={seg.speaker_id}
                  displayName={labelFor(seg.speaker_id)}
                  className="self-start"
                  editable={!!seg.speaker_id}
                />
                <div className="text-sm leading-relaxed">{seg.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TranscriptEmptyOrLoading({ meetingId }: { meetingId: string }) {
  const processing = useScribe((s) => s.processing);
  const processMeeting = useScribe((s) => s.processMeeting);
  const isBusy =
    processing.kind === "processing" && processing.meetingId === meetingId;
  const isTranscribing =
    isBusy &&
    processing.kind === "processing" &&
    (processing.phase === "transcribe" || processing.flow === "transcribe-only" ||
      processing.flow === "full");
  if (isTranscribing) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-8 py-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-3 w-12 shrink-0 rounded" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className={cn("h-4 rounded", i % 3 === 0 ? "w-3/4" : "w-full")} />
              {i % 2 === 0 && <Skeleton className="h-4 w-1/2 rounded" />}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-sm font-medium text-muted-foreground">
        No transcript yet
      </div>
      <div className="max-w-sm text-xs text-muted-foreground">
        Process the recording to transcribe and generate notes.
      </div>
      <Button
        size="sm"
        className="mt-2 gap-1.5"
        onClick={() => void processMeeting(meetingId)}
        disabled={isBusy}
      >
        <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
        {isBusy ? "Processing…" : "Process meeting"}
      </Button>
    </div>
  );
}
