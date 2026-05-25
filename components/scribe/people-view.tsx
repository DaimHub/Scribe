"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceLibraryPerson } from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SpeakerAvatar } from "./speaker-avatar";
import { useSampleClipUrl } from "@/lib/voice-clip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  PauseIcon,
  PencilEdit01Icon,
  PlayIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";

export function PeopleView() {
  const [people, setPeople] = useState<VoiceLibraryPerson[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial `loading` defaults to true via useState — only flip it once the
  // first fetch resolves. Subsequent refreshes (after rename / delete) update
  // silently. Keeps the lint rule against synchronous setState-in-effect
  // happy without losing the "Loading…" label on first paint.
  const refresh = useCallback(async () => {
    try {
      const next = await window.scribe.voice.listPeople();
      setPeople(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-12">
          <header className="mb-6 flex items-baseline justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">People</h1>
            <span className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${people.length} voice${people.length === 1 ? "" : "s"}`}
            </span>
          </header>

          <p className="mb-6 max-w-prose text-sm text-muted-foreground">
            Voices Scribe has learned across your meetings. After each
            transcription, new speakers above the auto-link threshold are
            silently linked to entries here; borderline matches surface a
            review banner on the meeting itself.
          </p>

          {!loading && people.length === 0 && <EmptyState />}

          {people.length > 0 && (
            <ul className="flex flex-col gap-2">
              {people.map((p) => (
                <PersonRow key={p.id} person={p} onChanged={refresh} />
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card/40 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <HugeiconsIcon icon={UserMultipleIcon} className="size-5" />
      </div>
      <div className="text-sm font-medium">No voices yet</div>
      <div className="max-w-sm text-xs text-muted-foreground">
        Run a meeting through transcription with diarization enabled. Each new
        speaker you tag will appear here and be recognized automatically next
        time.
      </div>
    </div>
  );
}

function PersonRow({
  person,
  onChanged,
}: {
  person: VoiceLibraryPerson;
  onChanged: () => Promise<void> | void;
}) {
  const selectMeeting = useScribe((s) => s.selectMeeting);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(person.display_name);
  const [lastSyncedName, setLastSyncedName] = useState(person.display_name);
  const [acting, setActing] = useState(false);

  // Sync the draft back to the canonical name when the upstream row changes
  // underneath us (e.g. a transcription run merges an embedding and refreshes
  // the list). Render-phase reconciliation mirrors the React docs pattern —
  // avoids the cascading-render hit of a useEffect.
  if (!editing && lastSyncedName !== person.display_name) {
    setLastSyncedName(person.display_name);
    setDraftName(person.display_name);
  }

  async function commitRename() {
    const next = draftName.trim();
    if (!next || next === person.display_name) {
      setEditing(false);
      setDraftName(person.display_name);
      return;
    }
    setActing(true);
    try {
      await window.scribe.voice.renameLibraryEntry(person.id, next);
      await onChanged();
    } finally {
      setActing(false);
      setEditing(false);
    }
  }

  async function remove() {
    // Skipping a confirm dialog here — voice-library entries can be rebuilt
    // by re-tagging in the next meeting, so the destruction cost is low.
    // Add one if usage shows accidental deletes happen often.
    setActing(true);
    try {
      await window.scribe.voice.deleteLibraryEntry(person.id);
      await onChanged();
    } finally {
      setActing(false);
    }
  }

  const subtitle = subtitleFor(person);

  return (
    <li className="group flex items-center gap-3 rounded-md border bg-card/40 px-3 py-2.5 transition-colors hover:bg-card">
      <SpeakerAvatar
        speakerId={person.id}
        displayName={person.display_name}
        size="md"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraftName(person.display_name);
                setEditing(false);
              }
            }}
            disabled={acting}
            autoFocus
            className="h-7 text-sm"
          />
        ) : (
          <div className="truncate text-sm font-medium">
            {person.display_name}
          </div>
        )}
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>

      <SamplePlayButton filePath={person.sample_clip_path} />

      {person.last_meeting_id && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            void selectMeeting(person.last_meeting_id!);
          }}
          className="hidden text-xs group-hover:inline-flex"
          title={
            person.last_meeting_title
              ? `Open "${person.last_meeting_title}"`
              : "Open last meeting"
          }
        >
          Open
        </Button>
      )}

      <IconBtn
        icon={PencilEdit01Icon}
        label="Rename"
        onClick={() => setEditing(true)}
        disabled={acting || editing}
      />
      <IconBtn
        icon={Delete02Icon}
        label="Delete"
        onClick={() => void remove()}
        disabled={acting}
        destructive
      />
    </li>
  );
}

function subtitleFor(p: VoiceLibraryPerson): string {
  const heardBits: string[] = [];
  heardBits.push(`Heard in ${p.n_meetings} meeting${p.n_meetings === 1 ? "" : "s"}`);
  if (p.last_heard_ms != null) {
    heardBits.push(`last on ${formatRelative(p.last_heard_ms)}`);
  }
  return heardBits.join(" · ");
}

function formatRelative(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(ms).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
}

function IconBtn({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: typeof PencilEdit01Icon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:opacity-50",
        destructive
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-accent hover:text-foreground",
      )}
    >
      <HugeiconsIcon icon={icon} className="size-3.5" />
    </button>
  );
}

function SamplePlayButton({ filePath }: { filePath: string | null }) {
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

  if (!filePath || error) return null;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={loading || !url}
        title={playing ? "Pause sample" : "Play voice sample"}
        aria-label={playing ? "Pause voice sample" : "Play voice sample"}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <HugeiconsIcon
          icon={playing ? PauseIcon : PlayIcon}
          className="size-3.5"
        />
      </button>
      {url && <audio ref={audioRef} src={url} preload="auto" />}
    </>
  );
}
