"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  PauseIcon,
  PlayIcon,
  Tick02Icon,
  UserAdd01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import type { PendingReviewSpeaker } from "@/lib/scribe-global";
import { useScribe, speakerHue } from "@/lib/store";
import { useSampleClipUrl } from "@/lib/voice-clip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function VoiceTaggingPanel({ meetingId }: { meetingId: string }) {
  const [pending, setPending] = useState<PendingReviewSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await window.scribe.voice.pendingReview(meetingId);
      setPending(next);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  if (loading || pending.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-8 pb-4">
      <div className="rounded-lg border bg-card/50">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-card"
        >
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={UserCheck01Icon}
              className="size-4 text-muted-foreground"
            />
            <span className="font-medium">
              Tag {pending.length} unknown {pending.length === 1 ? "voice" : "voices"}
            </span>
            <span className="text-xs text-muted-foreground">
              Help Scribe recognize who&apos;s speaking across meetings
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {collapsed ? "Show" : "Hide"}
          </span>
        </button>
        {!collapsed && (
          <div className="flex flex-col gap-3 border-t px-4 py-3">
            {pending.map((sp) => (
              <PendingRow
                key={`${sp.meeting_id}:${sp.speaker_id}`}
                speaker={sp}
                onResolved={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PendingRow({
  speaker,
  onResolved,
}: {
  speaker: PendingReviewSpeaker;
  onResolved: () => void;
}) {
  const reloadDetail = useScribe((s) => s.selectMeeting);
  const meetingId = speaker.meeting_id;
  const [newName, setNewName] = useState("");
  const [acting, setActing] = useState(false);

  const hue = speakerHue(speaker.speaker_id);
  const color = `oklch(0.72 0.13 ${hue})`;
  const tint = `color-mix(in oklab, oklch(0.72 0.13 ${hue}) 14%, transparent)`;

  const refreshAll = async () => {
    onResolved();
    await reloadDetail(meetingId);
  };

  async function assign(libId: string, name: string) {
    setActing(true);
    try {
      await window.scribe.voice.assignToLibrary(
        meetingId,
        speaker.speaker_id,
        libId,
        name,
      );
      await refreshAll();
    } finally {
      setActing(false);
    }
  }

  async function createNew() {
    const name = newName.trim();
    if (!name) return;
    setActing(true);
    try {
      await window.scribe.voice.createFromSpeaker(
        meetingId,
        speaker.speaker_id,
        name,
      );
      await refreshAll();
    } finally {
      setActing(false);
    }
  }

  async function dismiss() {
    setActing(true);
    try {
      await window.scribe.voice.dismissReview(meetingId, speaker.speaker_id);
      await refreshAll();
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background/60 p-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
          style={{ borderColor: color, background: tint, color }}
        >
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full"
            style={{ background: color }}
          />
          {speaker.display_name}
        </span>
        <SampleClipPlayer filePath={speaker.sample_clip_path} />
        <div className="ml-auto">
          <Button
            size="xs"
            variant="ghost"
            onClick={dismiss}
            disabled={acting}
            title="Not a real speaker — dismiss"
          >
            <HugeiconsIcon icon={Cancel01Icon} />
            Skip
          </Button>
        </div>
      </div>

      {speaker.candidates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sounds like
          </div>
          <div className="flex flex-wrap gap-1.5">
            {speaker.candidates.map((c) => (
              <CandidateButton
                key={c.library_id}
                name={c.display_name}
                similarity={c.similarity}
                disabled={acting}
                onClick={() => assign(c.library_id, c.display_name)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Or add as new person
        </div>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createNew();
            }}
            placeholder="Name (e.g. Sarah)"
            className="h-8 text-sm"
            disabled={acting}
          />
          <Button
            size="sm"
            onClick={createNew}
            disabled={acting || !newName.trim()}
          >
            <HugeiconsIcon icon={UserAdd01Icon} />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function CandidateButton({
  name,
  similarity,
  disabled,
  onClick,
}: {
  name: string;
  similarity: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const pct = Math.round(similarity * 100);
  return (
    <Button
      size="xs"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="gap-1.5"
    >
      <HugeiconsIcon icon={Tick02Icon} />
      <span>{name}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {pct}%
      </span>
    </Button>
  );
}

function SampleClipPlayer({ filePath }: { filePath: string | null }) {
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

  if (!filePath) {
    return (
      <span className="text-xs text-muted-foreground">No sample available</span>
    );
  }
  if (error) {
    return (
      <span className="text-xs text-destructive" title={error}>
        Sample failed to load
      </span>
    );
  }

  return (
    <>
      <Button
        size="xs"
        variant="outline"
        onClick={toggle}
        disabled={loading || !url}
        className={cn("gap-1.5", playing && "bg-muted")}
      >
        <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} />
        {playing ? "Pause" : loading ? "Loading…" : "Play sample"}
      </Button>
      {url && <audio ref={audioRef} src={url} preload="auto" />}
    </>
  );
}
