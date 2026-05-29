"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  UserAdd01Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons";
import type {
  MeetingAttendee,
  PendingReviewSpeaker,
  VoiceLibraryRow,
} from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { SampleAudioButton } from "./sample-audio-button";
import { SpeakerAvatar } from "./speaker-avatar";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "./linked-event-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Body of the voice-tagging panel — meant to be rendered inside a Popover
 * anchored on the SpeakersChip (see speakers-chip.tsx). All open/close
 * lifecycle still flows through `voiceTaggingPanelOpen` in the store, so
 * other surfaces (the auto-show-on-needs-review behavior, header actions)
 * can still pop it open without knowing about its host.
 */
export function VoiceTaggingPanelContent({
  meetingId,
}: {
  meetingId: string;
}) {
  const open = useScribe((s) => s.voiceTaggingPanelOpen);
  const setOpen = useScribe((s) => s.setVoiceTaggingPanelOpen);
  const mode = useScribe((s) => s.voiceTaggingPanelMode);
  const setActiveSection = useScribe((s) => s.setActiveSection);
  const transcript = useScribe((s) => s.detail?.transcript);
  const [pending, setPending] = useState<PendingReviewSpeaker[]>([]);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [library, setLibrary] = useState<VoiceLibraryRow[]>([]);
  const [hfTokenSet, setHfTokenSet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();
  const refresh = useCallback(async () => {
    try {
      const [nextPending, nextAttendees, nextLibrary, hasToken] =
        await Promise.all([
          window.scribe.voice.pendingReview(meetingId, mode === "all"),
          window.scribe.calendar.listAttendees(meetingId),
          window.scribe.voice.listLibrary(),
          window.scribe.settings.hasHfToken(),
        ]);
      setPending(nextPending);
      setAttendees(nextAttendees);
      setLibrary(nextLibrary);
      setHfTokenSet(hasToken);
    } finally {
      setLoading(false);
    }
  }, [meetingId, mode]);

  // Compute one "what they said" snippet per speaker — picks their longest
  // transcript segment (same heuristic as the audio sample picker, so text
  // and clip align). Memoized so it stays stable across renders unless the
  // transcript itself changes.
  const snippetBySpeaker = useMemo(() => {
    const map = new Map<string, string>();
    if (!transcript) return map;
    const longest = new Map<string, { dur: number; text: string }>();
    for (const seg of transcript) {
      if (!seg.speaker_id || !seg.text) continue;
      const dur = seg.end_ms - seg.start_ms;
      const prev = longest.get(seg.speaker_id);
      if (!prev || dur > prev.dur) {
        longest.set(seg.speaker_id, { dur, text: seg.text });
      }
    }
    for (const [id, { text }] of longest) map.set(id, text);
    return map;
  }, [transcript]);

  // Refetch whenever the popover gets opened or the mode changes. We
  // deliberately do NOT auto-close — the user opened it explicitly, so even
  // a pending list that drains to zero should keep the panel visible (and
  // switch to the all-clean state) until the user dismisses it.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // Three-state row model:
  //   • collapsed     → row is just `[Avatar] Name · email`
  //   • hovered/focus → reveals snippet card with edit + play actions
  //   • editing       → snippet stays, search picker + side panel appear
  // Hover is local to each row (CSS-driven); editing is parent state so the
  // side panel knows which speaker it's for and only one row can be in edit
  // mode at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Shared search query for the row being edited — drives both the input
  // in the row header and the filter applied to the side panel. Reset on
  // every edit transition so jumping between rows starts fresh.
  const [query, setQuery] = useState("");
  const setEditingFor = (id: string, on: boolean) => {
    setQuery("");
    setEditingId(on ? id : editingId === id ? null : editingId);
  };

  const editingSpeaker = useMemo(
    () => (editingId ? (pending.find((s) => s.speaker_id === editingId) ?? null) : null),
    [editingId, pending],
  );

  const isEmpty = pending.length === 0;
  const titleText = isEmpty
    ? t("header.speakers")
    : mode === "all"
      ? t("header.speakers")
      : pending.length === 1
        ? t("voicePanel.unknownOne", { count: pending.length })
        : t("voicePanel.unknownMany", { count: pending.length });

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
        <span className="text-sm font-semibold">{titleText}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t("voicePanel.close")}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
        </button>
      </div>
      {loading ? (
        <div className="px-3 pb-3 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          {isEmpty ? (
            <EmptyState
              hfTokenSet={hfTokenSet === true}
              onOpenSettings={() => {
                setOpen(false);
                setActiveSection("settings");
              }}
            />
          ) : (
            <ul className="flex max-h-[28rem] flex-col overflow-y-auto">
              {pending.map((sp) => (
                <li key={`${sp.meeting_id}:${sp.speaker_id}`}>
                  <PendingRow
                    speaker={sp}
                    attendees={attendees}
                    library={library}
                    snippet={snippetBySpeaker.get(sp.speaker_id) ?? null}
                    editing={editingId === sp.speaker_id}
                    query={editingId === sp.speaker_id ? query : ""}
                    onQueryChange={setQuery}
                    onEditingChange={(on) => setEditingFor(sp.speaker_id, on)}
                    onResolved={() => {
                      // After assigning, drop edit state so the next pending
                      // speaker becomes the obvious next target. Hover-driven
                      // preview returns naturally on the next mouseenter.
                      setEditingId(null);
                      setQuery("");
                      void refresh();
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Side panel showing all invitees + recent contacts, rendered only
          when a row is in edit mode. Positioned absolutely outside the
          popover's natural width — the parent PopoverContent must set
          overflow-visible. Matches state 3 from the design. */}
      {editingSpeaker && (
        <ContactsSidePanel
          attendees={attendees}
          library={library}
          query={query}
          candidateSimilarity={
            new Map(
              editingSpeaker.candidates.flatMap((c) =>
                typeof c.similarity === "number"
                  ? [[c.library_id, c.similarity] as [string, number]]
                  : [],
              ),
            )
          }
          onPick={async (s) => {
            if (!editingSpeaker) return;
            if (s.libraryId) {
              await window.scribe.voice.assignToLibrary(
                editingSpeaker.meeting_id,
                editingSpeaker.speaker_id,
                s.libraryId,
                s.name,
                s.email,
              );
            } else {
              await window.scribe.voice.createFromSpeaker(
                editingSpeaker.meeting_id,
                editingSpeaker.speaker_id,
                s.name,
                s.email,
              );
            }
            setEditingId(null);
            setQuery("");
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({
  hfTokenSet,
  onOpenSettings,
}: {
  hfTokenSet: boolean;
  onOpenSettings: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 border-t px-5 py-4 text-sm">
      {hfTokenSet ? (
        <p className="text-muted-foreground">{t("voicePanel.empty.noSpeakers")}</p>
      ) : (
        <>
          <p className="text-muted-foreground">{t("voicePanel.empty.noToken")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenSettings}
            className="self-start"
          >
            {t("nav.openSettings")}
          </Button>
        </>
      )}
    </div>
  );
}

interface Suggestion {
  key: string;
  name: string;
  /** What kind of suggestion this is — controls the badge/icon shown. */
  source: "candidate" | "invitee" | "library";
  /** Library entry id when this maps to one; null for free-text invitees. */
  libraryId: string | null;
  /** Email when from a calendar invitee. */
  email: string | null;
  /** Voice-match similarity (0..1) when source === "candidate". */
  similarity?: number;
  /** True if this attendee is the user themselves (calendar `self` flag). */
  self?: boolean;
}

function PendingRow({
  speaker,
  attendees,
  library,
  snippet,
  editing,
  query,
  onQueryChange,
  onEditingChange,
  onResolved,
}: {
  speaker: PendingReviewSpeaker;
  attendees: MeetingAttendee[];
  library: VoiceLibraryRow[];
  snippet: string | null;
  editing: boolean;
  /** Search query controlled from the parent so the side panel can filter. */
  query: string;
  onQueryChange: (v: string) => void;
  onEditingChange: (on: boolean) => void;
  onResolved: () => void;
}) {
  // Local hover/focus reveals the snippet card + actions for the row the
  // user is looking at. Combined with `editing` (controlled from parent),
  // the snippet stays visible while the picker is open even if the cursor
  // moves into the search input or side panel.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = hovered || focused || editing;
  const reloadDetail = useScribe((s) => s.selectMeeting);
  const meetingId = speaker.meeting_id;
  const [acting, setActing] = useState(false);
  const t = useT();
  // The linked library person being flagged "you" → show the same badge as
  // the People page on this speaker row.
  const isMe =
    !!speaker.voice_library_id &&
    library.some((l) => l.id === speaker.voice_library_id && l.is_me === 1);

  // Build a single ranked suggestion list across all sources, then filter
  // by the search query. Ranking: voice candidates first (strongest signal),
  // then calendar invitees (event-specific), then the rest of the library
  // (cross-meeting fallback). Dedupe on libraryId so the same person never
  // appears twice when they show up in multiple sources.
  const suggestions = useMemo<Suggestion[]>(() => {
    const seenLibIds = new Set<string>();
    const out: Suggestion[] = [];

    for (const c of speaker.candidates) {
      seenLibIds.add(c.library_id);
      out.push({
        key: `cand:${c.library_id}`,
        name: c.display_name,
        source: "candidate",
        libraryId: c.library_id,
        email: null,
        similarity: c.similarity,
      });
    }

    for (const a of attendees) {
      if (a.assignedTo) continue;
      if (a.libraryId && seenLibIds.has(a.libraryId)) continue;
      if (a.libraryId) seenLibIds.add(a.libraryId);
      out.push({
        key: `inv:${a.email}`,
        name: a.name,
        source: "invitee",
        libraryId: a.libraryId,
        email: a.email,
        self: a.self,
      });
    }

    for (const l of library) {
      if (seenLibIds.has(l.id)) continue;
      seenLibIds.add(l.id);
      out.push({
        key: `lib:${l.id}`,
        name: l.display_name,
        source: "library",
        libraryId: l.id,
        email: null,
      });
    }

    return out;
  }, [attendees, library, speaker.candidates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)),
    );
  }, [query, suggestions]);

  // Inline preview of the longest segment text — truncate so each row in the
  // scrollable list keeps a predictable height even with rambling speakers.
  const truncatedSnippet = useMemo(() => {
    if (!snippet) return null;
    const trimmed = snippet.trim();
    if (trimmed.length <= 140) return trimmed;
    return trimmed.slice(0, 140).trimEnd() + "…";
  }, [snippet]);

  const refreshAll = async () => {
    onResolved();
    await reloadDetail(meetingId);
  };

  async function assignToLibrary(
    libId: string,
    name: string,
    email?: string | null,
  ) {
    setActing(true);
    try {
      await window.scribe.voice.assignToLibrary(
        meetingId,
        speaker.speaker_id,
        libId,
        name,
        email ?? null,
      );
      await refreshAll();
      onQueryChange("");
    } finally {
      setActing(false);
    }
  }

  async function createFromName(name: string, email?: string | null) {
    setActing(true);
    try {
      await window.scribe.voice.createFromSpeaker(
        meetingId,
        speaker.speaker_id,
        name,
        email ?? null,
      );
      await refreshAll();
      onQueryChange("");
    } finally {
      setActing(false);
    }
  }

  async function pickSuggestion(s: Suggestion) {
    // Library entries (and invitees who already map to one) → assignToLibrary
    // so we merge embeddings instead of creating a duplicate identity row.
    // Either way we carry the invitee's email so the person gains a stable
    // identity that future invitees match on.
    if (s.libraryId) {
      await assignToLibrary(s.libraryId, s.name, s.email);
    } else {
      await createFromName(s.name, s.email);
    }
  }

  async function createFromQuery() {
    const name = query.trim();
    if (!name) return;
    await createFromName(name);
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

  // Pressing Enter when no suggestion matches creates a new contact named
  // after whatever's in the input. Mirrors how the contact-picker shortcut
  // worked in the old popover.
  const canCreateNew =
    query.trim().length > 0 &&
    !filtered.some(
      (s) => s.name.toLowerCase() === query.trim().toLowerCase(),
    );

  // Show the speaker's email next to their name. The address set on the
  // linked library person (in the People tab) wins; otherwise fall back to a
  // calendar invitee that matches by name, then a library person with the
  // same name (covers speakers tagged before email existed, or meetings with
  // no calendar link). Null hides the dot separator entirely.
  const email = useMemo(() => {
    if (speaker.email) return speaker.email;
    const att = attendees.find(
      (a) =>
        a.name.toLowerCase() === speaker.display_name.toLowerCase() ||
        (a.libraryId &&
          a.name.toLowerCase().split(" ")[0] ===
            speaker.display_name.toLowerCase().split(" ")[0]),
    );
    if (att?.email) return att.email;
    const lib = library.find(
      (l) => l.display_name.toLowerCase() === speaker.display_name.toLowerCase(),
    );
    return lib?.email ?? null;
  }, [attendees, library, speaker.email, speaker.display_name]);

  // Row-level mouse + focus handlers so the snippet card stays revealed
  // while the user is anywhere inside the row (including the buttons, the
  // search input, or the side panel suggestions).
  const onRowEnter = () => setHovered(true);
  const onRowLeave = () => setHovered(false);
  const onRowFocus = () => setFocused(true);
  const onRowBlur = (e: FocusEvent<HTMLDivElement>) => {
    // Only flip focused off when focus actually leaves the row subtree.
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setFocused(false);
    }
  };
  // Keyboard / mouse trigger to enter edit mode from the collapsed header.
  // `<div role="button">` so we can still nest the play/edit buttons inside
  // the expanded area without violating the no-nested-button HTML rule.
  const headerKeydown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onEditingChange(true);
    }
  };

  return (
    <div
      className={cn(
        // Row container becomes a single rounded card when hovered/focused
        // or in edit mode — header + snippet share the same darker surface
        // instead of looking like separate elements stacked.
        "flex flex-col rounded-lg transition-colors duration-200 ease-out",
        expanded && "bg-muted/50",
      )}
      onMouseEnter={onRowEnter}
      onMouseLeave={onRowLeave}
      onFocus={onRowFocus}
      onBlur={onRowBlur}
    >
      {/* Always-visible row header: state 1 collapsed shows just this. State 2
          / 3 expand below. In edit mode we swap the header for an avatar-
          prefixed search input — matches screenshot 3. */}
      {editing ? (
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <SpeakerAvatar
            speakerId={speaker.voice_library_id ?? speaker.speaker_id}
            displayName={speaker.display_name}
            size="sm"
          />
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (filtered.length > 0) {
                  void pickSuggestion(filtered[0]);
                } else if (canCreateNew) {
                  void createFromQuery();
                }
              }}
              placeholder={t("voicePanel.searchPlaceholder")}
              className="h-8 text-sm"
              disabled={acting}
              aria-label={t("voicePanel.assign", { name: speaker.display_name })}
              autoFocus
            />
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onEditingChange(true)}
          onKeyDown={headerKeydown}
          className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left outline-none"
        >
          <SpeakerAvatar
            speakerId={speaker.voice_library_id ?? speaker.speaker_id}
            displayName={speaker.display_name}
            size="sm"
          />
          <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="truncate text-sm font-medium">
              {speaker.display_name}
            </span>
            {isMe && (
              <Badge
                variant="secondary"
                className="shrink-0 px-1.5 py-0 text-[10px] font-medium"
              >
                {t("people.you")}
              </Badge>
            )}
            {email && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Expanded section animates open via the grid-template-rows trick:
          collapsed = 0fr (height 0), expanded = 1fr (auto). The inner div
          has overflow:hidden so content clips while the row resizes. Same
          ease-out as the bg fade so the two feel like one motion. `inert`
          when collapsed so keyboard tab order skips the hidden controls. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2.5 px-3 pb-3 pt-0.5">
            {(truncatedSnippet || speaker.sample_clip_path) && (
              <div className="flex items-start gap-2 text-sm">
                <p className="flex-1 italic leading-snug text-muted-foreground">
                  {truncatedSnippet ? truncatedSnippet : t("voicePanel.audioOnly")}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => onEditingChange(!editing)}
                    title={editing ? t("voicePanel.hidePicker") : t("voicePanel.reassign")}
                    aria-label={
                      editing ? t("voicePanel.hidePicker") : t("voicePanel.reassign")
                    }
                    className={cn(editing && "bg-accent")}
                  >
                    <HugeiconsIcon icon={UserEdit01Icon} />
                  </Button>
                  <SampleAudioButton
                    filePath={speaker.sample_clip_path}
                    variant="icon"
                    className="rounded-md border bg-background"
                  />
                </div>
              </div>
            )}

          {editing && (
            <div className="flex items-center justify-between gap-2 px-1">
              {canCreateNew ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void createFromQuery()}
                  disabled={acting}
                  className="gap-1.5"
                >
                  <HugeiconsIcon icon={UserAdd01Icon} className="size-3.5" />
                  {t("voicePanel.createContact", { query: query.trim() })}
                </Button>
              ) : (
                <span />
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                disabled={acting}
                className="text-xs text-muted-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                {t("voicePanel.notSpeaker")}
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SidePanelPick {
  libraryId: string | null;
  name: string;
  email: string | null;
}

/**
 * Side panel floating to the right of the popover when a row is in edit
 * mode. Holds the static "Invitees" + "Recent Contacts" sections from the
 * design — same data the search list filters over, but always visible as
 * an at-a-glance browse surface. Click any item to assign immediately.
 *
 * Positioned with absolute + left:100% so the popover's natural width is
 * unchanged; PopoverContent has overflow-visible to let it render outside.
 */
function ContactsSidePanel({
  attendees,
  library,
  query,
  candidateSimilarity,
  onPick,
}: {
  attendees: MeetingAttendee[];
  library: VoiceLibraryRow[];
  /** Live-filtered: typing in the row's search input narrows both sections. */
  query: string;
  /** Voice-match similarity (0..1) keyed by library id, for matched contacts. */
  candidateSimilarity: Map<string, number>;
  onPick: (s: SidePanelPick) => void | Promise<void>;
}) {
  const t = useT();
  const inviteeIdsInLibrary = useMemo(
    () =>
      new Set(
        attendees.map((a) => a.libraryId).filter((id): id is string => !!id),
      ),
    [attendees],
  );
  // Library entries that aren't already shown via the invitee list — keeps
  // each contact from appearing twice in the side panel.
  const allRecent = useMemo(
    () => library.filter((l) => !inviteeIdsInLibrary.has(l.id)),
    [library, inviteeIdsInLibrary],
  );

  const q = query.trim().toLowerCase();
  const filteredAttendees = useMemo(() => {
    if (!q) return attendees;
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)),
    );
  }, [attendees, q]);
  const filteredRecent = useMemo(() => {
    if (!q) return allRecent;
    return allRecent.filter((l) => l.display_name.toLowerCase().includes(q));
  }, [allRecent, q]);

  if (filteredAttendees.length === 0 && filteredRecent.length === 0) {
    return (
      <div className="pointer-events-auto absolute left-full top-0 ml-2 w-[16rem] rounded-lg border bg-popover px-3 py-4 text-xs text-muted-foreground shadow-md">
        {t("voicePanel.noMatch", { query })}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute left-full top-0 ml-2 w-[16rem] rounded-lg border bg-popover text-popover-foreground shadow-md">
      {filteredAttendees.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
            {t("voicePanel.invitees")}
          </div>
          <ul>
            {filteredAttendees.map((a) => (
              <li key={a.email}>
                <SidePanelItem
                  name={a.name}
                  avatarSeed={a.libraryId ?? a.email}
                  badge={a.self ? t("people.you") : undefined}
                  confidence={
                    a.libraryId
                      ? candidateSimilarity.get(a.libraryId)
                      : undefined
                  }
                  onClick={() =>
                    void onPick({
                      libraryId: a.libraryId,
                      name: a.name,
                      email: a.email,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {filteredRecent.length > 0 && (
        <div>
          <div className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
            {t("voicePanel.recentContacts")}
          </div>
          <ul className="pb-2">
            {filteredRecent.map((l) => (
              <li key={l.id}>
                <SidePanelItem
                  name={l.display_name}
                  avatarSeed={l.id}
                  confidence={candidateSimilarity.get(l.id)}
                  onClick={() =>
                    void onPick({
                      libraryId: l.id,
                      name: l.display_name,
                      email: l.email,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SidePanelItem({
  name,
  avatarSeed,
  badge,
  confidence,
  onClick,
}: {
  name: string;
  avatarSeed: string;
  /** Optional trailing chip, e.g. "You" for the calendar's self invitee. */
  badge?: string;
  /** Voice-match similarity (0..1) when this contact is a voice candidate. */
  confidence?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent/40"
    >
      <SpeakerAvatar speakerId={avatarSeed} displayName={name} size="sm" />
      <span className="truncate font-medium">{name}</span>
      {(confidence != null || badge) && (
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {confidence != null && <ConfidenceBadge value={confidence} />}
          {badge && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-medium"
            >
              {badge}
            </Badge>
          )}
        </span>
      )}
    </button>
  );
}
