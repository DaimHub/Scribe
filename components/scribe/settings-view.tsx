"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useScribe } from "@/lib/store";
import type {
  CalendarAccountPublic,
  VoiceLibraryRow,
} from "@/lib/scribe-global";
import { useSampleClipUrl } from "@/lib/voice-clip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Bug01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  HelpCircleIcon,
  InformationCircleIcon,
  Mic01Icon,
  PauseIcon,
  PlayIcon,
  Settings01Icon,
  UserMultipleIcon,
  VoiceIdIcon,
} from "@hugeicons/core-free-icons";

type SectionKey =
  | "general"
  | "transcription"
  | "speakers"
  | "voice-library"
  | "calendar"
  | "about";

interface SectionDef {
  key: SectionKey;
  label: string;
  description: string;
  icon: typeof Settings01Icon;
}

const SECTIONS: SectionDef[] = [
  {
    key: "general",
    label: "General",
    description: "App preferences",
    icon: Settings01Icon,
  },
  {
    key: "transcription",
    label: "Transcription",
    description: "WhisperX engine",
    icon: Mic01Icon,
  },
  {
    key: "speakers",
    label: "Speaker labels",
    description: "Diarization access",
    icon: VoiceIdIcon,
  },
  {
    key: "voice-library",
    label: "Voice library",
    description: "Known voices",
    icon: UserMultipleIcon,
  },
  {
    key: "calendar",
    label: "Calendar",
    description: "Google Calendar",
    icon: Calendar03Icon,
  },
  {
    key: "about",
    label: "About",
    description: "Version & links",
    icon: InformationCircleIcon,
  },
];

export function SettingsView() {
  const [active, setActive] = useState<SectionKey>("general");
  const activeDef = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col gap-px border-r bg-sidebar/40 py-4">
        <div className="px-4 pb-3">
          <h1 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </h1>
        </div>
        <nav className="flex flex-col gap-px px-2">
          {SECTIONS.map((s) => {
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActive(s.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
                aria-pressed={isActive}
              >
                <HugeiconsIcon
                  icon={s.icon}
                  className={cn(
                    "size-4 shrink-0",
                    isActive
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/65",
                  )}
                />
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-10 pb-16 pt-8">
          <header className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-tight">
              {activeDef.label}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeDef.description}
            </p>
          </header>

          {active === "general" && <GeneralSection />}
          {active === "transcription" && <TranscriptionSection />}
          {active === "speakers" && <SpeakersSection />}
          {active === "voice-library" && <VoiceLibrarySection />}
          {active === "calendar" && <CalendarSection />}
          {active === "about" && <AboutSection />}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper — a titled, bordered card.
// ---------------------------------------------------------------------------

function SettingCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && (
          <p className="text-[12px] leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

function GeneralSection() {
  const sidebarWidth = useScribe((s) => s.sidebarWidth);
  const setSidebarWidth = useScribe((s) => s.setSidebarWidth);
  const persistSidebarWidth = useScribe((s) => s.persistSidebarWidth);

  return (
    <div className="flex flex-col gap-6">
      <SettingCard
        title="Appearance"
        description="Scribe follows your system light/dark mode preference."
      >
        <FieldRow
          label="Sidebar width"
          description="Drag the sidebar edge for finer control, or reset to default."
        >
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {sidebarWidth}px
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSidebarWidth(288);
              persistSidebarWidth();
            }}
          >
            Reset
          </Button>
        </FieldRow>
      </SettingCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcription engine (WhisperX)
// ---------------------------------------------------------------------------

type InstallState =
  | { kind: "unknown" }
  | { kind: "not-installed" }
  | { kind: "installing"; lines: string[] }
  | { kind: "installed"; versions?: Record<string, string> }
  | { kind: "error"; message: string };

function TranscriptionSection() {
  const [state, setState] = useState<InstallState>({ kind: "unknown" });
  const tailRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    let installed = false;
    try {
      installed = await window.scribe.whisperx.isInstalled();
    } catch (err) {
      setState({
        kind: "error",
        message: `isInstalled failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
    if (!installed) {
      setState({ kind: "not-installed" });
      return;
    }
    try {
      const st = await window.scribe.whisperx.selftest();
      if (st.ok) setState({ kind: "installed", versions: st.versions });
      else setState({ kind: "error", message: st.error });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  useEffect(() => {
    return window.scribe.whisperx.onInstallProgress((p) => {
      setState((cur) => {
        if (cur.kind !== "installing") return cur;
        const next = [...cur.lines, `[${p.stage}] ${p.line ?? ""}`].slice(-200);
        return { kind: "installing", lines: next };
      });
      requestAnimationFrame(() => {
        tailRef.current?.scrollTo({
          top: tailRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    });
  }, []);

  async function onInstall() {
    setState({ kind: "installing", lines: [] });
    try {
      await window.scribe.whisperx.install();
      await refresh();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <SettingCard
      title="WhisperX engine"
      description={
        <>
          WhisperX delivers much better quality than the built-in transcriber
          and identifies speakers. About 2&nbsp;GB of Python dependencies are
          installed locally on first setup.
        </>
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <StatusDot state={state} />
          <StatusLabel state={state} />
        </div>
        {state.kind === "not-installed" && (
          <Button size="sm" onClick={onInstall}>
            Install
          </Button>
        )}
        {state.kind === "installed" && (
          <Button size="sm" variant="outline" onClick={onInstall}>
            Re-install
          </Button>
        )}
        {state.kind === "error" && (
          <Button size="sm" variant="outline" onClick={onInstall}>
            Retry install
          </Button>
        )}
      </div>

      {state.kind === "installing" && (
        <div
          ref={tailRef}
          className="h-44 overflow-y-auto rounded-md border bg-muted/50 p-2 font-mono text-[11px] leading-relaxed"
        >
          {state.lines.map((l, i) => (
            <div key={i} className="truncate text-muted-foreground">
              {l}
            </div>
          ))}
          {state.lines.length === 0 && (
            <div className="text-muted-foreground">Preparing…</div>
          )}
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {state.message}
        </div>
      )}

      {state.kind === "installed" && state.versions && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border bg-muted/30 p-3 font-mono text-[11px]">
          {Object.entries(state.versions).map(([k, v]) => (
            <div key={k} className="flex justify-between truncate gap-3">
              <span className="text-muted-foreground">{k}</span>
              <span className="truncate text-right">{v}</span>
            </div>
          ))}
        </div>
      )}
    </SettingCard>
  );
}

function StatusDot({ state }: { state: InstallState }) {
  const cls = (() => {
    switch (state.kind) {
      case "installed":
        return "bg-emerald-500";
      case "installing":
        return "bg-blue-500 animate-pulse";
      case "error":
        return "bg-destructive";
      case "not-installed":
        return "bg-amber-500";
      default:
        return "bg-muted-foreground";
    }
  })();
  return <span className={cn("size-1.5 rounded-full", cls)} />;
}

function StatusLabel({ state }: { state: InstallState }) {
  switch (state.kind) {
    case "installed":
      return <span>Installed and ready</span>;
    case "installing":
      return <span>Installing… this can take 3–5 minutes</span>;
    case "not-installed":
      return (
        <span>Not installed — Scribe is using the built-in transcriber</span>
      );
    case "error":
      return <span>Error</span>;
    default:
      return <span className="text-muted-foreground">Checking…</span>;
  }
}

// ---------------------------------------------------------------------------
// Speaker labels (HuggingFace token for pyannote diarization)
// ---------------------------------------------------------------------------

function SpeakersSection() {
  const [tokenMasked, setTokenMasked] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const masked = await window.scribe.settings.getHfTokenMasked();
      setTokenMasked(masked);
    } catch {
      setTokenMasked(null);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  async function onSave() {
    const t = tokenInput.trim();
    if (!t) return;
    setSaving(true);
    try {
      await window.scribe.settings.setHfToken(t);
      setTokenInput("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onClear() {
    await window.scribe.settings.clearHfToken();
    await refresh();
  }

  return (
    <SettingCard
      title="HuggingFace access token"
      description={
        <>
          Paste a free HuggingFace token to enable automatic speaker labelling.
          You need to accept the{" "}
          <a
            href="https://huggingface.co/pyannote/speaker-diarization-community-1"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline hover:no-underline"
          >
            pyannote/speaker-diarization-community-1
          </a>{" "}
          terms first. Stored encrypted in macOS Keychain.
        </>
      }
    >
      {tokenMasked ? (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-3.5 text-emerald-500"
            />
            <span className="font-mono">{tokenMasked}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxx"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="font-mono text-xs"
          />
          <Button
            size="sm"
            onClick={onSave}
            disabled={!tokenInput.trim() || saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
      <a
        href="https://huggingface.co/settings/tokens"
        target="_blank"
        rel="noreferrer"
        className="self-start text-xs text-muted-foreground underline hover:text-foreground"
      >
        Get a token →
      </a>
    </SettingCard>
  );
}

// ---------------------------------------------------------------------------
// Voice library
// ---------------------------------------------------------------------------

function VoiceLibrarySection() {
  const [entries, setEntries] = useState<VoiceLibraryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const rows = await window.scribe.voice.listLibrary();
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  return (
    <SettingCard
      title="Known voices"
      description="Voices Scribe has learned so far. New meetings auto-match speakers against this list — rename or remove an entry to reset it."
    >
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {entries === null && !error && (
        <div className="text-xs text-muted-foreground">Loading…</div>
      )}
      {entries && entries.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No voices learned yet. Tag speakers in a processed meeting and they
          appear here.
        </div>
      )}
      {entries && entries.length > 0 && (
        <div className="flex flex-col rounded-md border">
          {entries.map((e, i) => (
            <VoiceLibraryRowItem
              key={e.id}
              entry={e}
              isLast={i === entries.length - 1}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </SettingCard>
  );
}

function VoiceLibraryRowItem({
  entry,
  isLast,
  onChanged,
}: {
  entry: VoiceLibraryRow;
  isLast: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.display_name);
  const [busy, setBusy] = useState(false);

  async function commitRename() {
    const next = draft.trim();
    if (!next || next === entry.display_name) {
      setDraft(entry.display_name);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await window.scribe.voice.renameLibraryEntry(entry.id, next);
      onChanged();
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  async function deleteEntry() {
    setBusy(true);
    try {
      await window.scribe.voice.deleteLibraryEntry(entry.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        !isLast && "border-b",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRename();
              if (e.key === "Escape") {
                setDraft(entry.display_name);
                setEditing(false);
              }
            }}
            disabled={busy}
            className="h-7 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start truncate text-sm font-medium hover:underline"
            title="Click to rename"
          >
            {entry.display_name}
          </button>
        )}
        <span className="font-mono text-[10px] text-muted-foreground">
          {entry.n_meetings} {entry.n_meetings === 1 ? "meeting" : "meetings"} ·
          {" "}
          {entry.dim}-dim
        </span>
      </div>
      <SampleClipPlayer filePath={entry.sample_clip_path} />
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={deleteEntry}
        disabled={busy}
        title="Delete from library"
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </Button>
    </div>
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

  if (!filePath || error) {
    return (
      <span
        className="text-[10px] text-muted-foreground"
        title={error ?? undefined}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
      </span>
    );
  }

  return (
    <>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={toggle}
        disabled={loading || !url}
      >
        <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} />
      </Button>
      {url && <audio ref={audioRef} src={url} preload="auto" />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

interface MaskedCreds {
  clientIdMasked: string;
  hasSecret: boolean;
}

function CalendarSection() {
  const accounts = useScribe((s) => s.calendarAccounts);
  const loadAccounts = useScribe((s) => s.loadCalendarAccounts);
  const connect = useScribe((s) => s.connectGoogleCalendar);
  const disconnect = useScribe((s) => s.disconnectCalendar);

  const [hasCreds, setHasCreds] = useState<boolean | null>(null);
  const [masked, setMasked] = useState<MaskedCreds | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [connecting, setConnecting] = useState(false);

  async function refreshCreds() {
    try {
      const [present, m] = await Promise.all([
        window.scribe.calendar.hasCredentials(),
        window.scribe.calendar.getCredentialsMasked(),
      ]);
      setHasCreds(present);
      setMasked(m);
      if (present) setShowSetup(false);
    } catch {
      setHasCreds(false);
      setMasked(null);
    }
  }

  useEffect(() => {
    void loadAccounts();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCreds();
  }, [loadAccounts]);

  async function onSaveCreds() {
    if (!clientIdInput.trim() || !clientSecretInput.trim()) return;
    setSavingCreds(true);
    try {
      await window.scribe.calendar.setCredentials(
        clientIdInput.trim(),
        clientSecretInput.trim(),
      );
      setClientIdInput("");
      setClientSecretInput("");
      await refreshCreds();
    } finally {
      setSavingCreds(false);
    }
  }

  async function onClearCreds() {
    await window.scribe.calendar.clearCredentials();
    await refreshCreds();
  }

  async function onConnect() {
    setConnecting(true);
    try {
      await connect();
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingCard
        title="OAuth credentials"
        description="Scribe needs a personal Google OAuth client to access your calendar. One-time setup."
      >
        {hasCreds === null && (
          <div className="text-xs text-muted-foreground">Checking…</div>
        )}

        {hasCreds === false && !showSetup && (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <HugeiconsIcon
                icon={HelpCircleIcon}
                className="size-4 text-muted-foreground"
              />
              <span>Not configured yet.</span>
            </div>
            <Button size="sm" onClick={() => setShowSetup(true)}>
              Show me how
            </Button>
          </div>
        )}

        {showSetup && hasCreds === false && (
          <CalendarSetupWizard
            clientIdInput={clientIdInput}
            clientSecretInput={clientSecretInput}
            onChangeClientId={setClientIdInput}
            onChangeClientSecret={setClientSecretInput}
            saving={savingCreds}
            onSave={onSaveCreds}
            onCancel={() => setShowSetup(false)}
          />
        )}

        {hasCreds && masked && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-[12px]">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-3.5 text-emerald-500"
            />
            <span className="flex-1 truncate font-mono text-muted-foreground">
              {masked.clientIdMasked}
            </span>
            <button
              type="button"
              onClick={onClearCreds}
              className="text-muted-foreground hover:text-destructive"
              title="Clear credentials"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
            </button>
          </div>
        )}
      </SettingCard>

      <SettingCard
        title="Connected accounts"
        description="Sign into one or more Google accounts to import their calendars."
      >
        {!hasCreds && (
          <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            Add OAuth credentials above before connecting an account.
          </div>
        )}

        {hasCreds && accounts.length === 0 && (
          <Button
            onClick={onConnect}
            disabled={connecting}
            className="self-start gap-1.5"
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-3.5" />
            {connecting ? "Waiting for browser…" : "Connect Google Calendar"}
          </Button>
        )}

        {hasCreds && accounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {accounts.map((a) => (
              <CalendarAccountRow
                key={a.id}
                account={a}
                onDisconnect={() => disconnect(a.id)}
              />
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={onConnect}
              disabled={connecting}
              className="mt-2 self-start gap-1.5"
            >
              <HugeiconsIcon icon={Calendar03Icon} className="size-3.5" />
              {connecting ? "Waiting for browser…" : "Add another account"}
            </Button>
          </div>
        )}
      </SettingCard>

      <DebugNotificationCard />
    </div>
  );
}

function DebugNotificationCard() {
  const [title, setTitle] = useState("Debug — fake meeting");
  const [hangoutLink, setHangoutLink] = useState("https://meet.google.com/abc-defg-hij");
  const [minutes, setMinutes] = useState("2");
  const [busy, setBusy] = useState(false);
  // Local-only countdown so the user can see the scheduled trigger is live.
  const [firesAtMs, setFiresAtMs] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (firesAtMs == null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= firesAtMs) {
        setFiresAtMs(null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [firesAtMs]);

  async function trigger(delaySeconds: number) {
    setBusy(true);
    try {
      const opts = {
        title: title.trim() || undefined,
        hangoutLink: hangoutLink.trim() || undefined,
        minutesUntilStart: Math.max(1, Number(minutes) || 2),
        delaySeconds,
      };
      await window.scribe.floating.debugShowNotification(opts);
      if (delaySeconds > 0) {
        setFiresAtMs(Date.now() + delaySeconds * 1000);
      }
    } finally {
      setBusy(false);
    }
  }

  const remainingSec =
    firesAtMs != null ? Math.max(0, Math.ceil((firesAtMs - now) / 1000)) : 0;

  return (
    <SettingCard
      title="Debug"
      description="Trigger a synthetic meeting notification to preview the floating widget."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="debug-notif-title" className="text-xs">
            Title
          </Label>
          <Input
            id="debug-notif-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="debug-notif-minutes" className="text-xs">
            Minutes until start
          </Label>
          <Input
            id="debug-notif-minutes"
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="debug-notif-link" className="text-xs">
            Hangout/Meet link (optional)
          </Label>
          <Input
            id="debug-notif-link"
            value={hangoutLink}
            onChange={(e) => setHangoutLink(e.target.value)}
            placeholder="https://meet.google.com/…"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => trigger(0)}
          disabled={busy}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={Bug01Icon} className="size-3.5" />
          Show now
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => trigger(300)}
          disabled={busy}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={Bug01Icon} className="size-3.5" />
          Show in 5 min
        </Button>
        {firesAtMs != null && (
          <span className="text-xs text-muted-foreground">
            Firing in{" "}
            <span className="font-mono tabular-nums">
              {formatRemaining(remainingSec)}
            </span>{" "}
            — switch to another app to test.
          </span>
        )}
      </div>
    </SettingCard>
  );
}

function formatRemaining(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CalendarAccountRow({
  account,
  onDisconnect,
}: {
  account: CalendarAccountPublic;
  onDisconnect: () => void;
}) {
  const connectedLabel = useMemo(
    () =>
      new Date(account.connected_at_ms).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [account.connected_at_ms],
  );

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-[13px]">
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        className="size-3.5 shrink-0 text-emerald-500"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{account.email}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          connected {connectedLabel}
        </span>
      </div>
      <button
        type="button"
        onClick={onDisconnect}
        title="Disconnect"
        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
      </button>
    </div>
  );
}

function CalendarSetupWizard(props: {
  clientIdInput: string;
  clientSecretInput: string;
  onChangeClientId: (v: string) => void;
  onChangeClientSecret: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const steps: Array<{ title: string; body: ReactNode }> = [
    {
      title: "Open Google Cloud Console",
      body: (
        <>
          Go to{" "}
          <ExternalLink href="https://console.cloud.google.com/projectcreate">
            console.cloud.google.com/projectcreate
          </ExternalLink>{" "}
          and create a new project (e.g. <Mono>Scribe</Mono>).
        </>
      ),
    },
    {
      title: "Enable the Google Calendar API",
      body: (
        <>
          Open{" "}
          <ExternalLink href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com">
            APIs & Services → Library → Google Calendar API
          </ExternalLink>{" "}
          and click <Mono>Enable</Mono>.
        </>
      ),
    },
    {
      title: "Configure the OAuth consent screen",
      body: (
        <>
          In{" "}
          <ExternalLink href="https://console.cloud.google.com/apis/credentials/consent">
            APIs & Services → OAuth consent screen
          </ExternalLink>
          : pick <Mono>External</Mono>, add your email, add the scopes{" "}
          <Mono>calendar.readonly</Mono>, <Mono>userinfo.email</Mono>,{" "}
          <Mono>openid</Mono>. Add yourself as a Test user.
        </>
      ),
    },
    {
      title: "Create the OAuth credentials",
      body: (
        <>
          In{" "}
          <ExternalLink href="https://console.cloud.google.com/apis/credentials">
            APIs & Services → Credentials
          </ExternalLink>{" "}
          click <Mono>+ Create credentials → OAuth client ID</Mono>, pick{" "}
          <Mono>Desktop app</Mono>. Copy the <Mono>Client ID</Mono> and{" "}
          <Mono>Client secret</Mono> shown in the popup.
        </>
      ),
    },
    {
      title: "Paste them below",
      body: <>Stored encrypted on this Mac (macOS Keychain).</>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Set up Google Calendar</h4>
        <button
          type="button"
          onClick={props.onCancel}
          className="text-[12px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <ol className="flex flex-col gap-3 text-[13px] text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 leading-snug">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/85 text-[11px] font-bold text-background">
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="font-medium text-foreground">{s.title}</div>
              <div className="mt-0.5">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <Separator />

      <div className="flex flex-col gap-2">
        <Label htmlFor="cal-client-id" className="text-[12px]">
          Client ID
        </Label>
        <Input
          id="cal-client-id"
          value={props.clientIdInput}
          onChange={(e) => props.onChangeClientId(e.target.value)}
          placeholder="xxxxxx.apps.googleusercontent.com"
          className="font-mono text-xs"
        />
        <Label htmlFor="cal-client-secret" className="mt-2 text-[12px]">
          Client secret
        </Label>
        <Input
          id="cal-client-secret"
          value={props.clientSecretInput}
          onChange={(e) => props.onChangeClientSecret(e.target.value)}
          placeholder="GOCSPX-..."
          type="password"
          className="font-mono text-xs"
        />
        <div className="mt-3">
          <Button
            onClick={props.onSave}
            disabled={
              !props.clientIdInput.trim() ||
              !props.clientSecretInput.trim() ||
              props.saving
            }
          >
            {props.saving ? "Saving…" : "Save credentials"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline hover:no-underline"
    >
      {children}
    </a>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground">
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

const IS_DEV = process.env.NODE_ENV === "development";

function AboutSection() {
  return (
    <div className="flex flex-col gap-6">
      <SettingCard title="Scribe" description="Local-first meeting capture.">
        <FieldRow
          label="Version"
          description="Current release on this machine."
        >
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            0.1.0
          </span>
        </FieldRow>
        <Separator />
        <FieldRow
          label="Storage"
          description="Recordings, transcripts, and the voice library are stored locally under ~/Library/Application Support/Scribe."
        >
          <span />
        </FieldRow>
        <Separator />
        <FieldRow
          label="Diarization model"
          description="pyannote/speaker-diarization-community-1 via HuggingFace."
        >
          <a
            href="https://huggingface.co/pyannote/speaker-diarization-community-1"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline hover:no-underline"
          >
            Model page →
          </a>
        </FieldRow>
        <Separator />
        <FieldRow
          label="Transcription engine"
          description="WhisperX — m-bain/whisperX."
        >
          <a
            href="https://github.com/m-bain/whisperX"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline hover:no-underline"
          >
            GitHub →
          </a>
        </FieldRow>
      </SettingCard>

      {IS_DEV && <DevDebugCard />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dev-only debug toolkit (only rendered when NODE_ENV=development)
// ---------------------------------------------------------------------------

function DevDebugCard() {
  const selectedId = useScribe((s) => s.selectedId);
  const [log, setLog] = useState<string[]>([]);
  const [mockRunning, setMockRunning] = useState<null | "transcribe" | "generate">(
    null,
  );
  const mockTimerRef = useRef<number | null>(null);

  function pushLog(line: string) {
    setLog((cur) => [...cur, `${new Date().toLocaleTimeString()}  ${line}`].slice(-50));
  }

  // -------- Renderer-only actions --------

  function reloadWindow() {
    window.location.reload();
  }

  function dumpStore() {
    const state = useScribe.getState();
    console.log("[Scribe debug] store snapshot", state);
    pushLog("store snapshot logged to console");
  }

  function emitError(long = false) {
    const msg = long
      ? "Synthetic dev error — this is a long message used to verify how the error toast wraps a multi-line payload, including stack-trace-shaped content like at Object.<anonymous> (foo.ts:42)"
      : "Synthetic dev error";
    useScribe.setState({ error: msg });
    pushLog(`error toast triggered (${long ? "long" : "short"})`);
  }

  function clearStorageAndReload() {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
    pushLog("renderer storage cleared, reloading…");
    setTimeout(() => window.location.reload(), 150);
  }

  async function pingIpc() {
    const t0 = performance.now();
    try {
      const res = await window.scribe.ping();
      const dt = (performance.now() - t0).toFixed(1);
      pushLog(`ping ok at=${res.at} (${dt}ms)`);
    } catch (err) {
      pushLog(`ping failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function listIpcSurface() {
    const api = window.scribe as unknown as Record<string, unknown>;
    const methods: string[] = [];
    for (const [ns, val] of Object.entries(api)) {
      if (typeof val === "function") methods.push(ns + "()");
      else if (val && typeof val === "object") {
        for (const fn of Object.keys(val as object)) {
          methods.push(`${ns}.${fn}()`);
        }
      }
    }
    console.log("[Scribe debug] IPC surface", methods);
    pushLog(`IPC surface logged (${methods.length} methods)`);
  }

  // -------- Mock processing animator --------

  function stopMock() {
    if (mockTimerRef.current != null) {
      window.clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }
    useScribe.setState({ processing: { kind: "idle" } });
    setMockRunning(null);
  }

  function startMock(phase: "transcribe" | "generate") {
    if (mockRunning) stopMock();
    const meetingId = selectedId ?? "dev-mock-meeting";
    setMockRunning(phase);
    pushLog(`mock processing started: ${phase} (meeting ${meetingId})`);
    let pct = 0;
    const stages =
      phase === "transcribe"
        ? [
            "starting",
            "mixing",
            "loading-model",
            "transcribing",
            "transcribed",
            "diarizing",
          ]
        : ["starting", "loading-runtime", "drafting", "polishing"];
    useScribe.setState({
      processing: {
        kind: "processing",
        meetingId,
        flow: phase === "transcribe" ? "transcribe-only" : "generate-only",
        phase,
        stage: stages[0],
        pct: 0,
        model: phase === "transcribe" ? "whisper-large-v3" : "llama-3.1-8b",
      },
    });
    mockTimerRef.current = window.setInterval(() => {
      pct = Math.min(100, pct + 5 + Math.random() * 7);
      const stage = stages[Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length))];
      useScribe.setState((s) => {
        if (s.processing.kind !== "processing") return s;
        return {
          processing: { ...s.processing, pct: Math.round(pct), stage },
        };
      });
      if (pct >= 100) {
        if (mockTimerRef.current != null) {
          window.clearInterval(mockTimerRef.current);
          mockTimerRef.current = null;
        }
        window.setTimeout(() => {
          useScribe.setState({ processing: { kind: "idle" } });
          setMockRunning(null);
          pushLog("mock processing finished");
        }, 600);
      }
    }, 250);
  }

  function mockActiveCalendarEvent() {
    const now = Date.now();
    useScribe.setState({
      activeCalendarEvent: {
        id: "dev-mock-event",
        account_id: "dev",
        source_event_id: "dev",
        title: "Mock meeting (dev)",
        description: null,
        location: "Dev null",
        start_at_ms: now - 5 * 60 * 1000,
        end_at_ms: now + 25 * 60 * 1000,
        hangout_link: null,
        attendees_json: null,
        meeting_id: null,
        updated_at_ms: now,
      },
    });
    pushLog("activeCalendarEvent set — Start Scribe should now show event subtitle");
  }

  function clearActiveCalendarEvent() {
    useScribe.setState({ activeCalendarEvent: null });
    pushLog("activeCalendarEvent cleared");
  }

  useEffect(() => {
    return () => {
      if (mockTimerRef.current != null) {
        window.clearInterval(mockTimerRef.current);
      }
    };
  }, []);

  return (
    <SettingCard
      title={
        <span className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Bug01Icon}
            className="size-4 text-amber-500"
          />
          Developer tools
          <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
            dev only
          </span>
        </span>
      }
      description="These actions only appear in development builds. They drive the UI directly — no backend mutation."
    >
      <DebugGroup label="Window">
        <DebugBtn onClick={reloadWindow}>Reload window</DebugBtn>
        <DebugBtn onClick={clearStorageAndReload} destructive>
          Clear renderer storage + reload
        </DebugBtn>
      </DebugGroup>

      <DebugGroup label="State inspection">
        <DebugBtn onClick={dumpStore}>Dump store to console</DebugBtn>
        <DebugBtn onClick={listIpcSurface}>Log IPC surface</DebugBtn>
        <DebugBtn onClick={pingIpc}>Ping IPC bridge</DebugBtn>
      </DebugGroup>

      <DebugGroup label="UI mocks">
        <DebugBtn onClick={() => emitError(false)}>Trigger error toast</DebugBtn>
        <DebugBtn onClick={() => emitError(true)}>
          Trigger long error toast
        </DebugBtn>
        <DebugBtn
          onClick={() =>
            mockRunning === "transcribe" ? stopMock() : startMock("transcribe")
          }
          active={mockRunning === "transcribe"}
        >
          {mockRunning === "transcribe"
            ? "Stop mock transcribe"
            : "Mock processing — transcribe"}
        </DebugBtn>
        <DebugBtn
          onClick={() =>
            mockRunning === "generate" ? stopMock() : startMock("generate")
          }
          active={mockRunning === "generate"}
        >
          {mockRunning === "generate"
            ? "Stop mock generate"
            : "Mock processing — generate"}
        </DebugBtn>
        <DebugBtn onClick={mockActiveCalendarEvent}>
          Mock “happening now” event
        </DebugBtn>
        <DebugBtn onClick={clearActiveCalendarEvent}>
          Clear active event
        </DebugBtn>
      </DebugGroup>

      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Activity log
        </div>
        <div className="h-32 overflow-y-auto rounded-md border bg-muted/40 p-2 font-mono text-[10.5px] leading-relaxed">
          {log.length === 0 ? (
            <span className="text-muted-foreground">
              Output from debug actions will appear here.
            </span>
          ) : (
            log.map((line, i) => (
              <div key={i} className="truncate text-muted-foreground">
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Selected meeting:{" "}
        <code className="rounded bg-muted px-1 py-px font-mono">
          {selectedId ?? "—"}
        </code>{" "}
        — mock processing attaches to this meeting so the progress UI lights up
        in place.
      </div>
    </SettingCard>
  );
}

function DebugGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function DebugBtn({
  onClick,
  children,
  destructive,
  active,
}: {
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
  active?: boolean;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={destructive ? "outline" : active ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        destructive &&
          "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </Button>
  );
}

