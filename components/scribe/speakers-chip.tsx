"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SpeakerAvatar, SpeakerAvatarStack } from "./speaker-avatar";
import { SampleAudioButton } from "./sample-audio-button";
import type {
  MeetingAttendee,
  SpeakerRow,
  VoiceLibraryRow,
} from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LINKED_BADGE, REVIEW_BADGE } from "@/lib/status-color";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  Calendar01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  PencilEdit01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";

interface Props {
  meetingId: string;
  speakers: SpeakerRow[];
  /** Number of avatars + names to show in the collapsed trigger. */
  max?: number;
}

export function SpeakersChip({ meetingId, speakers, max = 3 }: Props) {
  const [open, setOpen] = useState(false);
  if (speakers.length === 0) {
    return (
      <span className="text-muted-foreground">No speakers identified</span>
    );
  }

  const shown = speakers.slice(0, max);
  const extra = speakers.length - shown.length;
  const reviewCount = speakers.filter((s) => s.needs_review === 1).length;
  const linkedCount = speakers.filter(
    (s) => s.voice_library_id != null && s.needs_review === 0,
  ).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "group inline-flex items-center gap-2 rounded-md py-0.5 text-sm transition-colors",
          "hover:bg-accent/60",
        )}
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
            title={`${reviewCount} speaker${reviewCount === 1 ? "" : "s"} need review`}
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
            title={`${linkedCount} of ${speakers.length} linked to your voice library`}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
            {linkedCount}
          </span>
        ) : null}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
        />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 p-0">
        <SpeakersListPanel meetingId={meetingId} speakers={speakers} />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Panel body — loads attendees + library on first open, renders per-row UI.
// ---------------------------------------------------------------------------

function SpeakersListPanel({
  meetingId,
  speakers,
}: {
  meetingId: string;
  speakers: SpeakerRow[];
}) {
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [library, setLibrary] = useState<VoiceLibraryRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Lazy load both sources in parallel. Best-effort: failures (e.g. no
  // linked event for attendees) just yield an empty list — the input still
  // works for free-text rename.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [a, l] = await Promise.all([
          window.scribe.calendar.listAttendees(meetingId).catch(() => []),
          window.scribe.voice.listLibrary().catch(() => []),
        ]);
        if (cancelled) return;
        setAttendees(a);
        setLibrary(l);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  return (
    <>
      <div className="px-3 py-2 text-sm font-semibold">Speakers</div>
      <ul className="max-h-96 overflow-y-auto pb-1">
        {speakers.map((s) => (
          <li key={s.speaker_id}>
            {editingId === s.speaker_id ? (
              <SpeakerRowEdit
                speaker={s}
                attendees={attendees}
                library={library}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <SpeakerRowDisplay
                speaker={s}
                onEdit={() => setEditingId(s.speaker_id)}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// Display row — avatar + name + subtitle + hover-revealed actions.
// ---------------------------------------------------------------------------

function SpeakerRowDisplay({
  speaker,
  onEdit,
}: {
  speaker: SpeakerRow;
  onEdit: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 px-3 py-1.5 hover:bg-accent/40">
      <SpeakerAvatar
        speakerId={speaker.speaker_id}
        displayName={speaker.display_name}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {speaker.display_name}
          </span>
          <StatusBadge speaker={speaker} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <SampleAudioButton filePath={speaker.sample_clip_path} />
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onEdit}
          title="Rename speaker"
          aria-label="Rename speaker"
        >
          <HugeiconsIcon icon={PencilEdit01Icon} />
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ speaker }: { speaker: SpeakerRow }) {
  const badgeBase =
    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium";
  if (speaker.needs_review === 1) {
    const pct = speaker.match_confidence
      ? ` ${Math.round(speaker.match_confidence * 100)}%`
      : "";
    return (
      <span className={cn(badgeBase, REVIEW_BADGE)}>Review{pct}</span>
    );
  }
  if (speaker.voice_library_id) {
    const pct = speaker.match_confidence
      ? ` · ${Math.round(speaker.match_confidence * 100)}%`
      : "";
    return (
      <span className={cn(badgeBase, LINKED_BADGE)}>Linked{pct}</span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Edit row — input + suggestions (Invitees / Recent Contacts) + commit logic.
// ---------------------------------------------------------------------------

interface Suggestion {
  key: string;
  name: string;
  email: string | null;
  /** Voice-library entry id if this suggestion already maps to one. */
  libraryId: string | null;
}

function SpeakerRowEdit({
  speaker,
  attendees,
  library,
  onDone,
}: {
  speaker: SpeakerRow;
  attendees: MeetingAttendee[];
  library: VoiceLibraryRow[];
  onDone: () => void;
}) {
  const reloadDetail = useScribe((s) => s.selectMeeting);
  const [acting, setActing] = useState(false);

  const { invitees, contacts } = useMemo(() => {
    const inviteeSuggestions: Suggestion[] = attendees.map((a) => ({
      key: `invitee:${a.email}`,
      name: a.name,
      email: a.email,
      libraryId: a.libraryId,
    }));

    const librarySuggestions: Suggestion[] = library.map((l) => ({
      key: `lib:${l.id}`,
      name: l.display_name,
      email: null,
      libraryId: l.id,
    }));

    // De-dupe: if an invitee already maps to a library entry, drop the
    // library duplicate (the invitee row already routes to that libraryId).
    const inviteeLibIds = new Set(
      inviteeSuggestions.map((s) => s.libraryId).filter(Boolean) as string[],
    );
    const dedupedLib = librarySuggestions.filter(
      (s) => !inviteeLibIds.has(s.libraryId!),
    );

    return { invitees: inviteeSuggestions, contacts: dedupedLib };
  }, [attendees, library]);

  const pick = useCallback(
    async (picked: Suggestion) => {
      setActing(true);
      try {
        if (picked.libraryId) {
          // Existing voice-library identity — link this meeting's speaker to
          // it and merge embeddings so future meetings recognize them faster.
          await window.scribe.voice.assignToLibrary(
            speaker.meeting_id,
            speaker.speaker_id,
            picked.libraryId,
            picked.name,
          );
        } else {
          // Invitee we haven't heard before — register them in the library so
          // the next meeting can auto-match. Sidecar handles the no-embedding
          // case gracefully (just renames without seeding a library entry).
          await window.scribe.voice.createFromSpeaker(
            speaker.meeting_id,
            speaker.speaker_id,
            picked.name,
          );
        }
        await reloadDetail(speaker.meeting_id);
        onDone();
      } finally {
        setActing(false);
      }
    },
    [onDone, reloadDetail, speaker.meeting_id, speaker.speaker_id],
  );

  return (
    <div className="flex flex-col gap-2 border-y bg-accent/30 px-3 py-2">
      <div className="flex items-center gap-3">
        <SpeakerAvatar
          speakerId={speaker.speaker_id}
          displayName={speaker.display_name}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {speaker.display_name}
          </div>
          <div className="text-xs text-muted-foreground">Pick a replacement</div>
        </div>
        <SampleAudioButton filePath={speaker.sample_clip_path} />
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onDone}
          title="Cancel"
          aria-label="Cancel"
        >
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      </div>

      {invitees.length === 0 && contacts.length === 0 ? (
        <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          No invitees on the linked event and no saved contacts yet.
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 rounded-md border bg-background py-1">
          {invitees.length > 0 && (
            <SuggestionSection
              icon={Calendar01Icon}
              label="Invitees"
              items={invitees}
              disabled={acting}
              onPick={(s) => void pick(s)}
            />
          )}
          {contacts.length > 0 && (
            <SuggestionSection
              icon={UserCheck01Icon}
              label="Recent contacts"
              items={contacts}
              disabled={acting}
              onPick={(s) => void pick(s)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionSection({
  icon,
  label,
  items,
  disabled,
  onPick,
}: {
  icon: typeof Calendar01Icon;
  label: string;
  items: Suggestion[];
  disabled: boolean;
  onPick: (s: Suggestion) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 px-2 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-3" />
        {label}
      </div>
      {items.map((s) => (
        <button
          key={s.key}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1 text-left text-sm transition-colors hover:bg-accent/60 disabled:opacity-50",
          )}
        >
          <SpeakerAvatar
            speakerId={s.libraryId ?? s.name}
            displayName={s.name}
            size="sm"
          />
          <span className="truncate">{s.name}</span>
          {s.email && (
            <span className="ml-auto truncate text-xs text-muted-foreground">
              {s.email}
            </span>
          )}
        </button>
      ))}
    </>
  );
}

