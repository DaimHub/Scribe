"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import type { VoiceLibraryPerson } from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SpeakerAvatar } from "./speaker-avatar";
import { SampleAudioButton } from "./sample-audio-button";
import { useT, type TranslateFn } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  PencilEdit01Icon,
  UserCheck01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";

export function PeopleView() {
  const t = useT();
  const refreshTick = useScribe((s) => s.refreshTick);
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

  // refreshTick is in the dep array so the global top-bar refresh button
  // re-pulls the voice library even though this view owns its own fetch.
  useEffect(() => {
    void refresh();
  }, [refresh, refreshTick]);

  // Refetch whenever the main process tells us the voice library changed —
  // new entries from speaker assignments, renames, deletes, or post-process
  // matching after a transcription run. Without this, opening the People
  // tab once and assigning speakers from a meeting later would leave the
  // list stale until the user navigated away and back.
  useEffect(() => {
    const unsub = window.scribe.voice.onLibraryChanged(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-8 pt-10 pb-12">
          <header className="mb-6 flex items-baseline justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("people.title")}
            </h1>
            <span className="text-sm text-muted-foreground">
              {loading
                ? t("common.loading")
                : people.length === 1
                  ? t("people.countOne")
                  : t("people.countMany", { count: people.length })}
            </span>
          </header>

          <p className="mb-6 max-w-prose text-sm text-muted-foreground">
            {t("settings.voice.desc")}
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
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card/40 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <HugeiconsIcon icon={UserMultipleIcon} className="size-5" />
      </div>
      <div className="text-sm font-medium">{t("people.empty.title")}</div>
      <div className="max-w-sm text-xs text-muted-foreground">
        {t("settings.voice.empty")}
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
  const t = useT();
  const selectMeeting = useScribe((s) => s.selectMeeting);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(person.display_name);
  const [draftEmail, setDraftEmail] = useState(person.email ?? "");
  const [lastSyncedName, setLastSyncedName] = useState(person.display_name);
  const [lastSyncedEmail, setLastSyncedEmail] = useState(person.email ?? "");
  const [acting, setActing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Sync the drafts back to the canonical values when the upstream row changes
  // underneath us (e.g. a transcription run merges an embedding and refreshes
  // the list). Render-phase reconciliation mirrors the React docs pattern —
  // avoids the cascading-render hit of a useEffect.
  if (!editing && lastSyncedName !== person.display_name) {
    setLastSyncedName(person.display_name);
    setDraftName(person.display_name);
  }
  if (!editing && lastSyncedEmail !== (person.email ?? "")) {
    setLastSyncedEmail(person.email ?? "");
    setDraftEmail(person.email ?? "");
  }

  function resetDrafts() {
    setDraftName(person.display_name);
    setDraftEmail(person.email ?? "");
  }

  // Save name and/or email in one go — only the fields that actually changed.
  // An emptied email clears it (setLibraryEmail(null)); a blank name is ignored.
  async function commitEdit() {
    const nextName = draftName.trim();
    const nextEmail = draftEmail.trim().toLowerCase();
    const curEmail = (person.email ?? "").toLowerCase();
    const nameChanged = !!nextName && nextName !== person.display_name;
    const emailChanged = nextEmail !== curEmail;
    if (!nameChanged && !emailChanged) {
      resetDrafts();
      setEditing(false);
      return;
    }
    setActing(true);
    try {
      if (nameChanged) {
        await window.scribe.voice.renameLibraryEntry(person.id, nextName);
      }
      if (emailChanged) {
        await window.scribe.voice.setLibraryEmail(person.id, nextEmail || null);
      }
      await onChanged();
    } finally {
      setActing(false);
      setEditing(false);
    }
  }

  // Commit when focus leaves the whole edit cluster (so tabbing name→email
  // doesn't save prematurely); cancel on Escape; Enter commits by blurring out.
  function onEditBlur(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) void commitEdit();
  }
  function onEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      resetDrafts();
      setEditing(false);
    }
  }

  async function remove() {
    setActing(true);
    try {
      await window.scribe.voice.deleteLibraryEntry(person.id);
      await onChanged();
    } finally {
      setActing(false);
      setConfirmOpen(false);
    }
  }

  // Toggle this person as "you". Setting clears any previous one (enforced in
  // the main process); clicking again on the current "you" unsets it.
  async function toggleMe() {
    setActing(true);
    try {
      await window.scribe.voice.setMe(person.is_me ? null : person.id);
      await onChanged();
    } finally {
      setActing(false);
    }
  }

  const subtitle = subtitleFor(person, t);

  return (
    <li className="group flex items-center gap-3 rounded-md border bg-card/40 px-3 py-2.5 transition-colors hover:bg-card">
      <SpeakerAvatar
        speakerId={person.id}
        displayName={person.display_name}
        size="md"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-1" onBlur={onEditBlur}>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={onEditKeyDown}
              disabled={acting}
              autoFocus
              aria-label={t("common.rename")}
              className="h-7 text-sm"
            />
            <Input
              type="email"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
              onKeyDown={onEditKeyDown}
              disabled={acting}
              placeholder="email@example.com"
              aria-label={t("common.email")}
              className="h-7 text-xs"
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">
                {person.display_name}
              </span>
              {person.is_me === 1 && (
                <Badge
                  variant="secondary"
                  className="shrink-0 px-1.5 py-0 text-[10px] font-medium"
                >
                  {t("people.you")}
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          </>
        )}
      </div>

      <SampleAudioButton filePath={person.sample_clip_path} />

      {person.last_meeting_id && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            void selectMeeting(person.last_meeting_id!);
          }}
          className="hidden text-xs group-hover:inline-flex group-focus-within:inline-flex"
          title={
            person.last_meeting_title
              ? `${t("tasks.openMeeting")} — ${person.last_meeting_title}`
              : t("people.openLastMeeting")
          }
        >
          {t("tasks.openMeeting")}
        </Button>
      )}

      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => void toggleMe()}
        disabled={acting}
        title={person.is_me ? t("people.unmarkMe") : t("people.markAsMe")}
        aria-label={person.is_me ? t("people.unmarkMe") : t("people.markAsMe")}
        aria-pressed={person.is_me === 1}
        className={cn(
          "hidden group-hover:inline-flex group-focus-within:inline-flex",
          person.is_me === 1 &&
            "inline-flex bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        )}
      >
        <HugeiconsIcon icon={UserCheck01Icon} />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => setEditing(true)}
        disabled={acting || editing}
        title={t("common.rename")}
        aria-label={t("common.rename")}
      >
        <HugeiconsIcon icon={PencilEdit01Icon} />
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger
          render={(props) => (
            <Button
              {...props}
              size="icon-xs"
              variant="ghost"
              disabled={acting}
              title={t("common.delete")}
              aria-label={t("common.delete")}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          )}
        />
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("people.delete.title")}</DialogTitle>
            <DialogDescription>
              {t("people.delete.body", { name: person.display_name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={acting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={acting}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function subtitleFor(p: VoiceLibraryPerson, t: TranslateFn): string {
  const heardBits: string[] = [];
  if (p.email) heardBits.push(p.email);
  heardBits.push(
    p.n_meetings === 1
      ? t("people.heardInOne")
      : t("people.heardInMany", { count: p.n_meetings }),
  );
  if (p.last_heard_ms != null) {
    heardBits.push(t("people.lastOn", { date: formatRelative(p.last_heard_ms, t) }));
  }
  return heardBits.join(" · ");
}

function formatRelative(ms: number, t: TranslateFn): string {
  const now = Date.now();
  const diff = now - ms;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return t("calendar.today");
  if (diff < 2 * day) return t("calendar.yesterday");
  if (diff < 7 * day) return t("time.daysAgo", { count: Math.floor(diff / day) });
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(ms).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
}


