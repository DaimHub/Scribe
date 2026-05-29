"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { useScribe } from "@/lib/store";
import { useT, type TranslateFn } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { ACCENTS, useAccent, type AccentName } from "@/lib/accent";
import {
  MONO_FONTS,
  resolveMonoStack,
  resolveUiStack,
  UI_FONTS,
  useFonts,
  type MonoFontChoice,
  type UiFontChoice,
} from "@/lib/fonts";
import type {
  AiLanguage,
  CalendarAccountPublic,
  DisplayLanguage,
  NotesTemplate,
  VoiceLibraryRow,
} from "@/lib/scribe-global";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "./confirm-dialog";
import { useSampleClipUrl } from "@/lib/voice-clip";
import { BundledModelsList } from "./bundled-models-list";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiBrain03Icon,
  Bug01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  HelpCircleIcon,
  InformationCircleIcon,
  MagicWandIcon,
  Mic01Icon,
  PauseIcon,
  PlayIcon,
  PuzzleIcon,
  Refresh01Icon,
  Settings01Icon,
  UserMultipleIcon,
  VoiceIdIcon,
} from "@hugeicons/core-free-icons";

type SectionKey =
  | "general"
  | "transcription"
  | "ai"
  | "templates"
  | "speakers"
  | "voice-library"
  | "calendar"
  | "claude-mcp"
  | "about";

interface SectionDef {
  key: SectionKey;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: typeof Settings01Icon;
}

const SECTIONS: SectionDef[] = [
  {
    key: "general",
    labelKey: "settings.section.general",
    descriptionKey: "settings.section.general.desc",
    icon: Settings01Icon,
  },
  {
    key: "transcription",
    labelKey: "settings.section.transcription",
    descriptionKey: "settings.section.transcription.desc",
    icon: Mic01Icon,
  },
  {
    key: "ai",
    labelKey: "settings.section.ai",
    descriptionKey: "settings.section.ai.desc",
    icon: AiBrain03Icon,
  },
  {
    key: "templates",
    labelKey: "settings.section.templates",
    descriptionKey: "settings.section.templates.desc",
    icon: MagicWandIcon,
  },
  {
    key: "speakers",
    labelKey: "settings.section.speakers",
    descriptionKey: "settings.section.speakers.desc",
    icon: VoiceIdIcon,
  },
  {
    key: "voice-library",
    labelKey: "settings.section.voiceLibrary",
    descriptionKey: "settings.section.voiceLibrary.desc",
    icon: UserMultipleIcon,
  },
  {
    key: "calendar",
    labelKey: "settings.section.calendar",
    descriptionKey: "settings.section.calendar.desc",
    icon: Calendar03Icon,
  },
  {
    key: "claude-mcp",
    labelKey: "settings.section.claudeMcp",
    descriptionKey: "settings.section.claudeMcp.desc",
    icon: PuzzleIcon,
  },
  {
    key: "about",
    labelKey: "settings.section.about",
    descriptionKey: "settings.section.about.desc",
    icon: InformationCircleIcon,
  },
];

export function SettingsView() {
  const [active, setActive] = useState<SectionKey>("general");
  const activeDef = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0];
  const t = useT();
  const previousSection = useScribe((s) => s.previousSection);
  const setActiveSection = useScribe((s) => s.setActiveSection);

  function close() {
    setActiveSection(previousSection);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Don't fight Select / Dialog dismissals — they consume Escape and
      // call preventDefault(); only step in once nothing closer to the
      // event has handled it.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        target?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }
      e.preventDefault();
      close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousSection]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col gap-px border-r bg-sidebar/40 py-4">
        <div className="px-4 pb-3">
          <h1 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("settings.title")}
          </h1>
        </div>
        <nav
          role="tablist"
          aria-orientation="vertical"
          aria-label={t("settings.title")}
          className="flex flex-col gap-px px-2"
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const idx = SECTIONS.findIndex((s) => s.key === active);
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const next =
              SECTIONS[(idx + delta + SECTIONS.length) % SECTIONS.length];
            setActive(next.key);
            e.currentTarget
              .querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [SECTIONS.indexOf(next)]?.focus();
          }}
        >
          {SECTIONS.map((s) => {
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                id={`settings-tab-${s.key}`}
                aria-selected={isActive}
                aria-controls="settings-tabpanel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(s.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
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
                {t(s.labelKey)}
              </button>
            );
          })}
        </nav>
      </aside>

      <ScrollArea className="min-h-0 flex-1">
        <div
          role="tabpanel"
          id="settings-tabpanel"
          aria-labelledby={`settings-tab-${active}`}
          className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-10 pb-16 pt-8"
        >
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold tracking-tight">
                {t(activeDef.labelKey)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(activeDef.descriptionKey)}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t("common.close")}
              title={`${t("common.close")} (Esc)`}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          </header>

          {active === "general" && <GeneralSection />}
          {active === "transcription" && <TranscriptionSection />}
          {active === "ai" && <AiProviderSection />}
          {active === "templates" && <NotesTemplatesSection />}
          {active === "speakers" && <SpeakersSection />}
          {active === "voice-library" && <VoiceLibrarySection />}
          {active === "calendar" && <CalendarSection />}
          {active === "claude-mcp" && <ClaudeMcpSection />}
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

type ThemeChoice = "system" | "light" | "dark";

function ThemeRow() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // next-themes resolves the active theme on the client; until the effect
  // fires, `theme` reflects the server default and would flicker the Select.
  useEffect(() => {
    setMounted(true);
  }, []);

  const value: ThemeChoice =
    theme === "light" || theme === "dark" ? theme : "system";

  return (
    <FieldRow
      label={t("settings.appearance.theme")}
      description={t("settings.appearance.theme.desc")}
    >
      {mounted ? (
        <Select
          value={value}
          onValueChange={(v) => setTheme((v as ThemeChoice) ?? "system")}
        >
          <SelectTrigger size="sm" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">
              {t("settings.appearance.theme.system")}
            </SelectItem>
            <SelectItem value="light">
              {t("settings.appearance.theme.light")}
            </SelectItem>
            <SelectItem value="dark">
              {t("settings.appearance.theme.dark")}
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Skeleton className="h-8 w-40" />
      )}
    </FieldRow>
  );
}

function AccentRow() {
  const t = useT();
  const { accent, setAccent } = useAccent();
  return (
    <FieldRow
      label={t("settings.appearance.accent")}
      description={t("settings.appearance.accent.desc")}
    >
      <div role="radiogroup" className="flex items-center gap-2">
        {ACCENTS.map((opt) => {
          const selected = opt.name === accent;
          return (
            <button
              key={opt.name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(
                `settings.appearance.accent.${opt.name}` as TranslationKey,
              )}
              onClick={() => setAccent(opt.name as AccentName)}
              style={{ backgroundColor: opt.swatch }}
              className={cn(
                "size-6 rounded-full ring-offset-2 ring-offset-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "ring-2 ring-foreground"
                  : "ring-1 ring-border hover:scale-110",
              )}
            />
          );
        })}
      </div>
    </FieldRow>
  );
}

// One font dropdown: presets (each rendered in its own face) plus a
// "Custom…" item that reveals a free-text family input. Used twice below —
// once for the interface font, once for monospace.
function FontPicker({
  label,
  description,
  options,
  value,
  custom,
  customPreview,
  onSelect,
  onCustomChange,
}: {
  label: string;
  description: ReactNode;
  options: readonly {
    key: string;
    label: string;
    i18nKey?: TranslationKey;
    stack: string;
  }[];
  value: string;
  custom: string;
  customPreview: string;
  onSelect: (value: string) => void;
  onCustomChange: (value: string) => void;
}) {
  const t = useT();
  return (
    <FieldRow label={label} description={description}>
      <div className="flex flex-col items-end gap-2">
        <Select value={value} onValueChange={(v) => onSelect(v ?? value)}>
          <SelectTrigger size="sm" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem
                key={opt.key}
                value={opt.key}
                style={{ fontFamily: opt.stack }}
              >
                {opt.i18nKey ? t(opt.i18nKey) : opt.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">
              {t("settings.appearance.font.custom")}
            </SelectItem>
          </SelectContent>
        </Select>
        {value === "custom" && (
          <Input
            value={custom}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder={t("settings.appearance.font.customPlaceholder")}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="h-8 w-52 text-sm"
            style={{ fontFamily: customPreview }}
          />
        )}
      </div>
    </FieldRow>
  );
}

function FontRow() {
  const t = useT();
  const {
    uiFont,
    uiFontCustom,
    monoFont,
    monoFontCustom,
    setUiFont,
    setUiCustom,
    setMonoFont,
    setMonoCustom,
  } = useFonts();

  return (
    <>
      <FontPicker
        label={t("settings.appearance.fontUi")}
        description={t("settings.appearance.fontUi.desc")}
        options={UI_FONTS}
        value={uiFont}
        custom={uiFontCustom}
        customPreview={resolveUiStack("custom", uiFontCustom)}
        onSelect={(v) => setUiFont(v as UiFontChoice)}
        onCustomChange={setUiCustom}
      />
      <Separator />
      <FontPicker
        label={t("settings.appearance.fontMono")}
        description={t("settings.appearance.fontMono.desc")}
        options={MONO_FONTS}
        value={monoFont}
        custom={monoFontCustom}
        customPreview={resolveMonoStack("custom", monoFontCustom)}
        onSelect={(v) => setMonoFont(v as MonoFontChoice)}
        onCustomChange={setMonoCustom}
      />
    </>
  );
}

function GeneralSection() {
  const sidebarWidth = useScribe((s) => s.sidebarWidth);
  const setSidebarWidth = useScribe((s) => s.setSidebarWidth);
  const persistSidebarWidth = useScribe((s) => s.persistSidebarWidth);
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      <LanguageSection />
      <SettingCard
        title={t("settings.appearance.title")}
        description={t("settings.appearance.desc")}
      >
        <ThemeRow />
        <Separator />
        <AccentRow />
        <Separator />
        <FontRow />
        <Separator />
        <FieldRow
          label={t("settings.appearance.sidebarWidth")}
          description={t("settings.appearance.sidebarWidth.desc")}
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
            {t("common.reset")}
          </Button>
        </FieldRow>
      </SettingCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language preferences (display + AI)
// ---------------------------------------------------------------------------

const DISPLAY_LANGUAGE_OPTIONS: Array<{
  value: DisplayLanguage;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
];

function aiLanguageOptions(t: TranslateFn): Array<{
  value: AiLanguage;
  label: string;
}> {
  return [
    { value: "auto", label: t("settings.language.auto") },
    { value: "en", label: "English" },
    { value: "fr", label: "Français" },
    { value: "es", label: "Español" },
    { value: "de", label: "Deutsch" },
  ];
}

function LanguageSection() {
  const t = useT();
  const display = useScribe((s) => s.displayLanguage);
  const setDisplayLanguage = useScribe((s) => s.setDisplayLanguage);
  const [ai, setAi] = useState<AiLanguage | null>(null);

  useEffect(() => {
    let alive = true;
    void window.scribe.settings.getAiLanguage().then((a) => {
      if (alive) setAi(a);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function onDisplayChange(value: DisplayLanguage) {
    await setDisplayLanguage(value);
  }

  async function onAiChange(value: AiLanguage) {
    setAi(value);
    await window.scribe.settings.setAiLanguage(value);
  }

  const aiOpts = aiLanguageOptions(t);

  return (
    <SettingCard
      title={t("settings.language.title")}
      description={t("settings.language.desc")}
    >
      <FieldRow
        label={t("settings.language.display")}
        description={t("settings.language.display.desc")}
      >
        <Select
          value={display}
          onValueChange={(v) => void onDisplayChange(v as DisplayLanguage)}
        >
          <SelectTrigger size="sm" className="min-w-40">
            <SelectValue placeholder={t("settings.language.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {DISPLAY_LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <Separator />
      <FieldRow
        label={t("settings.language.ai")}
        description={t("settings.language.ai.desc")}
      >
        {ai === null ? (
          // Don't mount the Select until we have a real value — Base UI errors
          // if the value transitions from undefined (uncontrolled) to defined
          // (controlled) on the first fetch.
          <Skeleton className="h-8 w-40" />
        ) : (
          <Select
            value={ai}
            onValueChange={(v) => void onAiChange(v as AiLanguage)}
          >
            <SelectTrigger size="sm" className="min-w-40">
              <SelectValue placeholder={t("settings.language.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {aiOpts.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldRow>
    </SettingCard>
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
  const t = useT();
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
      title={t("settings.whisperx.title")}
      description={t("settings.whisperx.desc")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <StatusDot state={state} />
          <StatusLabel state={state} />
        </div>
        {state.kind === "not-installed" && (
          <Button size="sm" onClick={onInstall}>
            {t("settings.whisperx.install")}
          </Button>
        )}
        {state.kind === "installed" && (
          <Button size="sm" variant="outline" onClick={onInstall}>
            {t("settings.whisperx.reinstall")}
          </Button>
        )}
        {state.kind === "error" && (
          <Button size="sm" variant="outline" onClick={onInstall}>
            {t("settings.whisperx.retry")}
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
            <div className="text-muted-foreground">
              {t("settings.whisperx.preparing")}
            </div>
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
  const t = useT();
  switch (state.kind) {
    case "installed":
      return <span>{t("settings.whisperx.status.installed")}</span>;
    case "installing":
      return <span>{t("settings.whisperx.status.installing")}</span>;
    case "not-installed":
      return <span>{t("settings.whisperx.status.notInstalled")}</span>;
    case "error":
      return <span>{t("settings.whisperx.status.error")}</span>;
    default:
      return (
        <span className="text-muted-foreground">
          {t("settings.whisperx.status.checking")}
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// AI provider — pick where notes/summaries are generated
// ---------------------------------------------------------------------------

type LlmProviderKind =
  | "bundled"
  | "ollama"
  | "openai"
  | "anthropic"
  | "claude-code";

interface ProviderConfig {
  provider: LlmProviderKind;
  bundled_model: string;
  bundled_models: readonly string[];
  ollama_endpoint: string;
  ollama_model: string | null;
  openai_endpoint: string;
  openai_model: string | null;
  has_openai_key: boolean;
  anthropic_endpoint: string;
  anthropic_model: string | null;
  has_anthropic_key: boolean;
  claude_code_model: string;
}

interface ClaudeCodeStatus {
  installed: boolean;
  authed: boolean;
  version?: string;
  error?: string;
}

type TestState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; models: string[] }
  | { kind: "fail"; message: string };

function AiProviderSection() {
  const t = useT();
  const [cfg, setCfg] = useState<ProviderConfig | null>(null);

  // Drafts for fields where we don't want to fire IPC on every keystroke.
  const [ollamaEndpoint, setOllamaEndpoint] = useState("");
  const [openaiEndpoint, setOpenaiEndpoint] = useState("");
  const [openaiKeyDraft, setOpenaiKeyDraft] = useState("");
  const [keyJustSaved, setKeyJustSaved] = useState(false);
  const [anthropicEndpoint, setAnthropicEndpoint] = useState("");
  const [anthropicKeyDraft, setAnthropicKeyDraft] = useState("");
  const [anthropicKeyJustSaved, setAnthropicKeyJustSaved] = useState(false);
  const [kbPath, setKbPath] = useState("");
  const [claudeCodeStatus, setClaudeCodeStatus] =
    useState<ClaudeCodeStatus | null>(null);
  const [claudeCodeModels, setClaudeCodeModels] = useState<string[]>([]);

  const [ollamaTest, setOllamaTest] = useState<TestState>({ kind: "idle" });
  const [openaiTest, setOpenaiTest] = useState<TestState>({ kind: "idle" });
  const [anthropicTest, setAnthropicTest] = useState<TestState>({
    kind: "idle",
  });

  async function refresh() {
    const next = await window.scribe.llm.getProviderConfig();
    setCfg(next);
    setOllamaEndpoint(next.ollama_endpoint);
    setOpenaiEndpoint(next.openai_endpoint);
    setAnthropicEndpoint(next.anthropic_endpoint);
    setKbPath(await window.scribe.llm.getKbFilesystemPath());
  }

  async function saveKbPath() {
    await window.scribe.llm.setKbFilesystemPath(kbPath.trim());
  }

  async function detectClaudeCode() {
    const [status, models] = await Promise.all([
      window.scribe.llm.detectClaudeCode(),
      window.scribe.llm.listClaudeCodeModels(),
    ]);
    setClaudeCodeStatus(status);
    setClaudeCodeModels(models);
  }

  async function changeClaudeCodeModel(model: string) {
    await window.scribe.llm.setClaudeCodeConfig({ model });
    await refresh();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  // Auto-probe whichever provider is active so the model dropdown is
  // immediately populated when the user opens the panel. Cheap (single
  // GET /tags or /models call) and runs whenever the active provider
  // changes.
  useEffect(() => {
    if (!cfg) return;
    if (cfg.provider === "ollama" && ollamaTest.kind === "idle") {
      void testOllama();
    } else if (cfg.provider === "openai" && openaiTest.kind === "idle") {
      void testOpenAi();
    } else if (
      cfg.provider === "anthropic" &&
      anthropicTest.kind === "idle" &&
      cfg.has_anthropic_key
    ) {
      void testAnthropic();
    } else if (cfg.provider === "claude-code" && claudeCodeStatus === null) {
      void detectClaudeCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.provider]);

  async function changeProvider(provider: LlmProviderKind) {
    await window.scribe.llm.setProvider(provider);
    await refresh();
  }

  async function changeBundledModel(model: string) {
    await window.scribe.llm.setBundledModel(model);
    await refresh();
  }

  async function saveOllamaEndpoint() {
    if (!cfg || ollamaEndpoint === cfg.ollama_endpoint) return;
    await window.scribe.llm.setOllamaConfig({ endpoint: ollamaEndpoint });
    setOllamaTest({ kind: "idle" });
    await refresh();
  }

  async function changeOllamaModel(model: string) {
    await window.scribe.llm.setOllamaConfig({ model });
    await refresh();
  }

  async function testOllama() {
    setOllamaTest({ kind: "running" });
    const res = await window.scribe.llm.detectOllama(ollamaEndpoint);
    if (res.running) {
      setOllamaTest({
        kind: "ok",
        models: (res.models ?? []).map((m) => m.name),
      });
    } else {
      setOllamaTest({ kind: "fail", message: res.error ?? "unreachable" });
    }
  }

  async function saveOpenAiEndpoint() {
    if (!cfg || openaiEndpoint === cfg.openai_endpoint) return;
    await window.scribe.llm.setOpenAiConfig({ endpoint: openaiEndpoint });
    setOpenaiTest({ kind: "idle" });
    await refresh();
  }

  async function changeOpenAiModel(model: string) {
    await window.scribe.llm.setOpenAiConfig({ model });
    await refresh();
  }

  async function saveOpenAiKey() {
    if (!openaiKeyDraft) return;
    await window.scribe.llm.setOpenAiKey(openaiKeyDraft);
    setOpenaiKeyDraft("");
    setKeyJustSaved(true);
    setTimeout(() => setKeyJustSaved(false), 1800);
    setOpenaiTest({ kind: "idle" });
    await refresh();
  }

  async function clearOpenAiKey() {
    await window.scribe.llm.clearOpenAiKey();
    setOpenaiKeyDraft("");
    setOpenaiTest({ kind: "idle" });
    await refresh();
  }

  async function testOpenAi() {
    setOpenaiTest({ kind: "running" });
    const res = await window.scribe.llm.detectOpenAi({
      endpoint: openaiEndpoint,
      // Use the draft if the user is mid-typing a key, otherwise let the
      // backend fall back to the stored one.
      apiKey: openaiKeyDraft ? openaiKeyDraft : undefined,
    });
    if (res.ok) {
      setOpenaiTest({
        kind: "ok",
        models: (res.models ?? []).map((m) => m.id),
      });
    } else {
      setOpenaiTest({ kind: "fail", message: res.error ?? "unreachable" });
    }
  }

  async function saveAnthropicEndpoint() {
    if (!cfg || anthropicEndpoint === cfg.anthropic_endpoint) return;
    await window.scribe.llm.setAnthropicConfig({ endpoint: anthropicEndpoint });
    setAnthropicTest({ kind: "idle" });
    await refresh();
  }

  async function changeAnthropicModel(model: string) {
    await window.scribe.llm.setAnthropicConfig({ model });
    await refresh();
  }

  async function saveAnthropicKey() {
    if (!anthropicKeyDraft) return;
    await window.scribe.llm.setAnthropicKey(anthropicKeyDraft);
    setAnthropicKeyDraft("");
    setAnthropicKeyJustSaved(true);
    setTimeout(() => setAnthropicKeyJustSaved(false), 1800);
    setAnthropicTest({ kind: "idle" });
    await refresh();
  }

  async function clearAnthropicKey() {
    await window.scribe.llm.clearAnthropicKey();
    setAnthropicKeyDraft("");
    setAnthropicTest({ kind: "idle" });
    await refresh();
  }

  async function testAnthropic() {
    setAnthropicTest({ kind: "running" });
    const res = await window.scribe.llm.detectAnthropic({
      endpoint: anthropicEndpoint,
      apiKey: anthropicKeyDraft ? anthropicKeyDraft : undefined,
    });
    if (res.ok) {
      setAnthropicTest({
        kind: "ok",
        models: (res.models ?? []).map((m) => m.id),
      });
    } else {
      setAnthropicTest({ kind: "fail", message: res.error ?? "unreachable" });
    }
  }

  if (!cfg) {
    return (
      <SettingCard title={t("settings.ai.title")} description={t("settings.ai.desc")}>
        <Skeleton className="h-32 w-full" />
      </SettingCard>
    );
  }

  return (
    <SettingCard
      title={t("settings.ai.title")}
      description={t("settings.ai.desc")}
    >
      <FieldRow
        label={t("settings.ai.provider")}
        description={t("settings.ai.provider.desc")}
      >
        <Select
          value={cfg.provider}
          onValueChange={(v) => v && void changeProvider(v as LlmProviderKind)}
        >
          <SelectTrigger size="sm" className="min-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bundled">
              {t("settings.ai.provider.bundled")}
            </SelectItem>
            <SelectItem value="ollama">
              {t("settings.ai.provider.ollama")}
            </SelectItem>
            <SelectItem value="openai">
              {t("settings.ai.provider.openai")}
            </SelectItem>
            <SelectItem value="anthropic">
              {t("settings.ai.provider.anthropic")}
            </SelectItem>
            <SelectItem value="claude-code">
              {t("settings.ai.provider.claudeCode")}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      <Separator />

      {cfg.provider === "bundled" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <Label className="text-sm font-medium text-foreground">
              {t("settings.ai.bundled.model")}
            </Label>
            <p className="text-[12px] leading-snug text-muted-foreground">
              {t("settings.ai.bundled.model.desc")}
            </p>
          </div>
          <BundledModelsList
            selectedId={cfg.bundled_model}
            onSelect={changeBundledModel}
          />
        </div>
      )}

      {cfg.provider === "ollama" && (
        <>
          <FieldRow
            label={t("settings.ai.ollama.endpoint")}
            description={t("settings.ai.ollama.endpoint.desc")}
          >
            <Input
              className="w-72"
              value={ollamaEndpoint}
              onChange={(e) => setOllamaEndpoint(e.target.value)}
              onBlur={() => void saveOllamaEndpoint()}
              spellCheck={false}
              autoCapitalize="off"
            />
          </FieldRow>

          <FieldRow label={t("settings.ai.test")}>
            <TestStatusBadge state={ollamaTest} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void testOllama()}
              disabled={ollamaTest.kind === "running"}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
              {t("settings.ai.test")}
            </Button>
          </FieldRow>

          <FieldRow label={t("settings.ai.ollama.model")}>
            <Select
              value={cfg.ollama_model ?? ""}
              onValueChange={(v) => v && void changeOllamaModel(v)}
              disabled={ollamaTest.kind !== "ok" || ollamaTest.models.length === 0}
            >
              <SelectTrigger size="sm" className="min-w-56">
                <SelectValue
                  placeholder={t("settings.ai.ollama.model.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {ollamaTest.kind === "ok" &&
                  ollamaTest.models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {ollamaTest.kind === "ok" && ollamaTest.models.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("settings.ai.ollama.noModels")}
            </p>
          )}
        </>
      )}

      {cfg.provider === "openai" && (
        <>
          <FieldRow
            label={t("settings.ai.openai.endpoint")}
            description={t("settings.ai.openai.endpoint.desc")}
          >
            <Input
              className="w-72"
              value={openaiEndpoint}
              onChange={(e) => setOpenaiEndpoint(e.target.value)}
              onBlur={() => void saveOpenAiEndpoint()}
              spellCheck={false}
              autoCapitalize="off"
            />
          </FieldRow>

          <FieldRow
            label={t("settings.ai.openai.apiKey")}
            description={t("settings.ai.openai.apiKey.desc")}
          >
            {cfg.has_openai_key && !openaiKeyDraft ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {keyJustSaved
                    ? t("settings.ai.openai.apiKey.saved")
                    : "••••••••"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void clearOpenAiKey()}
                >
                  {t("settings.ai.clear")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  className="w-56"
                  value={openaiKeyDraft}
                  onChange={(e) => setOpenaiKeyDraft(e.target.value)}
                  placeholder={t("settings.ai.openai.apiKey.placeholder")}
                  spellCheck={false}
                  autoCapitalize="off"
                />
                <Button
                  size="sm"
                  onClick={() => void saveOpenAiKey()}
                  disabled={!openaiKeyDraft}
                >
                  {t("settings.ai.save")}
                </Button>
              </div>
            )}
          </FieldRow>

          <FieldRow label={t("settings.ai.test")}>
            <TestStatusBadge state={openaiTest} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void testOpenAi()}
              disabled={openaiTest.kind === "running"}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
              {t("settings.ai.test")}
            </Button>
          </FieldRow>

          <FieldRow label={t("settings.ai.openai.model")}>
            <Select
              value={cfg.openai_model ?? ""}
              onValueChange={(v) => v && void changeOpenAiModel(v)}
              disabled={openaiTest.kind !== "ok" || openaiTest.models.length === 0}
            >
              <SelectTrigger size="sm" className="min-w-56">
                <SelectValue
                  placeholder={t("settings.ai.openai.model.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {openaiTest.kind === "ok" &&
                  openaiTest.models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {openaiTest.kind === "ok" && openaiTest.models.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("settings.ai.openai.noModels")}
            </p>
          )}
        </>
      )}

      {cfg.provider === "anthropic" && (
        <>
          <FieldRow
            label={t("settings.ai.anthropic.endpoint")}
            description={t("settings.ai.anthropic.endpoint.desc")}
          >
            <Input
              className="w-72"
              value={anthropicEndpoint}
              onChange={(e) => setAnthropicEndpoint(e.target.value)}
              onBlur={() => void saveAnthropicEndpoint()}
              spellCheck={false}
              autoCapitalize="off"
            />
          </FieldRow>

          <FieldRow
            label={t("settings.ai.anthropic.apiKey")}
            description={t("settings.ai.anthropic.apiKey.desc")}
          >
            {cfg.has_anthropic_key && !anthropicKeyDraft ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {anthropicKeyJustSaved
                    ? t("settings.ai.anthropic.apiKey.saved")
                    : "••••••••"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void clearAnthropicKey()}
                >
                  {t("settings.ai.clear")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  className="w-56"
                  value={anthropicKeyDraft}
                  onChange={(e) => setAnthropicKeyDraft(e.target.value)}
                  placeholder={t("settings.ai.anthropic.apiKey.placeholder")}
                  spellCheck={false}
                  autoCapitalize="off"
                />
                <Button
                  size="sm"
                  onClick={() => void saveAnthropicKey()}
                  disabled={!anthropicKeyDraft}
                >
                  {t("settings.ai.save")}
                </Button>
              </div>
            )}
          </FieldRow>

          <FieldRow label={t("settings.ai.test")}>
            <TestStatusBadge state={anthropicTest} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void testAnthropic()}
              disabled={anthropicTest.kind === "running"}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
              {t("settings.ai.test")}
            </Button>
          </FieldRow>

          <FieldRow label={t("settings.ai.anthropic.model")}>
            <Select
              value={cfg.anthropic_model ?? ""}
              onValueChange={(v) => v && void changeAnthropicModel(v)}
              disabled={
                anthropicTest.kind !== "ok" || anthropicTest.models.length === 0
              }
            >
              <SelectTrigger size="sm" className="min-w-56">
                <SelectValue
                  placeholder={t("settings.ai.anthropic.model.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {anthropicTest.kind === "ok" &&
                  anthropicTest.models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {anthropicTest.kind === "ok" && anthropicTest.models.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("settings.ai.anthropic.noModels")}
            </p>
          )}

          <FieldRow
            label={t("settings.ai.kb.label")}
            description={t("settings.ai.kb.desc")}
          >
            <Input
              className="w-72"
              value={kbPath}
              onChange={(e) => setKbPath(e.target.value)}
              onBlur={() => void saveKbPath()}
              placeholder={t("settings.ai.kb.placeholder")}
              spellCheck={false}
              autoCapitalize="off"
            />
          </FieldRow>
          <KbCheckRow pathDraft={kbPath} />
        </>
      )}

      {cfg.provider === "claude-code" && (
        <>
          <FieldRow
            label={t("settings.ai.claudeCode.status")}
            description={t("settings.ai.claudeCode.statusDesc")}
          >
            <div className="flex items-center gap-2">
              <ClaudeCodeStatusBadge status={claudeCodeStatus} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void detectClaudeCode()}
              >
                <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
                {t("settings.ai.test")}
              </Button>
            </div>
          </FieldRow>

          <FieldRow
            label={t("settings.ai.claudeCode.model")}
            description={
              cfg.claude_code_model === "ask"
                ? t("settings.ai.claudeCode.askDesc")
                : undefined
            }
          >
            <Select
              value={cfg.claude_code_model}
              onValueChange={(v) => v && void changeClaudeCodeModel(v)}
            >
              <SelectTrigger size="sm" className="min-w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">
                  {t("settings.ai.claudeCode.askOption")}
                </SelectItem>
                {claudeCodeModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow
            label={t("settings.ai.kb.label")}
            description={t("settings.ai.claudeCode.kbDesc")}
          >
            <Input
              className="w-72"
              value={kbPath}
              onChange={(e) => setKbPath(e.target.value)}
              onBlur={() => void saveKbPath()}
              placeholder={t("settings.ai.kb.placeholder")}
              spellCheck={false}
              autoCapitalize="off"
            />
          </FieldRow>
          <KbCheckRow pathDraft={kbPath} />

          <ClaudeCodeUsageSection />
        </>
      )}
    </SettingCard>
  );
}

interface UsageTotals {
  meetings: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  duration_ms: number;
  num_turns: number;
  max_single_cost_usd: number;
  last_used_at_ms: number | null;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatDurationSeconds(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatRelative(ms: number, now: number, t: TranslateFn): string {
  const diff = now - ms;
  if (diff < 60_000) return t("time.justNow");
  if (diff < 3_600_000)
    return t("time.minAgo", { value: Math.floor(diff / 60_000) });
  if (diff < 86_400_000)
    return t("time.hoursAgo", { value: Math.floor(diff / 3_600_000) });
  return t("time.daysAgoShort", { value: Math.floor(diff / 86_400_000) });
}

function ClaudeCodeUsageSection() {
  const t = useT();
  const [stats, setStats] = useState<UsageTotals | null>(null);

  async function refresh() {
    const next = await window.scribe.llm.getUsageStats({
      billingKind: "subscription",
    });
    setStats(next);
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!stats) {
    return (
      <FieldRow label={t("settings.ai.claudeCode.usage.title")}>
        <span className="text-xs text-muted-foreground">…</span>
      </FieldRow>
    );
  }

  if (stats.meetings === 0) {
    return (
      <FieldRow
        label={t("settings.ai.claudeCode.usage.title")}
        description={t("settings.ai.claudeCode.usage.emptyDesc")}
      >
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
          {t("settings.ai.test")}
        </Button>
      </FieldRow>
    );
  }

  const avg = stats.cost_usd / stats.meetings;
  const now = Date.now();

  return (
    <FieldRow
      label={t("settings.ai.claudeCode.usage.title")}
      description={t("settings.ai.claudeCode.usage.desc")}
    >
      <div className="flex flex-col items-end gap-1.5">
        <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right font-mono text-[11px]">
          <span className="text-muted-foreground">{t("settings.ai.claudeCode.usage.meetings")}</span>
          <span>{stats.meetings}</span>
          <span className="text-muted-foreground">{t("settings.ai.claudeCode.usage.tokens")}</span>
          <span>
            {formatTokens(stats.input_tokens)} /{" "}
            {formatTokens(stats.output_tokens)}
          </span>
          {stats.cache_read_input_tokens > 0 && (
            <>
              <span className="text-muted-foreground">{t("settings.ai.claudeCode.usage.cacheRead")}</span>
              <span>{formatTokens(stats.cache_read_input_tokens)}</span>
            </>
          )}
          <span className="text-muted-foreground">{t("settings.ai.claudeCode.usage.cost")}</span>
          <span>
            ${stats.cost_usd.toFixed(stats.cost_usd < 1 ? 3 : 2)}
          </span>
          <span className="text-muted-foreground">{t("settings.ai.claudeCode.usage.avg")}</span>
          <span>${avg.toFixed(avg < 1 ? 3 : 2)}</span>
          <span className="text-muted-foreground">{t("settings.ai.claudeCode.usage.totalTime")}</span>
          <span>{formatDurationSeconds(stats.duration_ms)}</span>
          {stats.last_used_at_ms !== null && (
            <>
              <span className="text-muted-foreground">{t("settings.ai.claudeCode.usage.lastRun")}</span>
              <span>{formatRelative(stats.last_used_at_ms, now, t)}</span>
            </>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
          {t("settings.ai.test")}
        </Button>
      </div>
    </FieldRow>
  );
}

type KbCheckResult =
  | {
      ok: false;
      reason: "missing" | "not_dir" | "no_access" | "empty" | "error";
      message: string;
    }
  | {
      ok: true;
      path: string;
      files: number;
      truncated: boolean;
      size_bytes: number;
      extensions: Record<string, number>;
      sample: string[];
    };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * "Check folder" action — validates the KB path the user typed in by
 * doing a bounded fs walk on the main process side. Render-side state so
 * it can fire against the in-flight draft (not the persisted value), and
 * so each Settings open starts fresh.
 */
function KbCheckRow({ pathDraft }: { pathDraft: string }) {
  const t = useT();
  const [result, setResult] = useState<KbCheckResult | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const r = await window.scribe.llm.checkKbFilesystem(
        pathDraft.trim() || undefined,
      );
      setResult(r);
    } catch (err) {
      setResult({
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <FieldRow
      label={t("settings.ai.kb.check")}
      description={t("settings.ai.kb.check.desc")}
    >
      <div className="flex flex-col items-end gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void run()}
          disabled={running || !pathDraft.trim()}
        >
          <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
          {t("settings.ai.kb.check.button")}
        </Button>
        {result && <KbCheckBadge result={result} />}
      </div>
    </FieldRow>
  );
}

function KbCheckBadge({ result }: { result: KbCheckResult }) {
  const t = useT();
  if (!result.ok) {
    const label =
      result.reason === "missing"
        ? t("settings.ai.kb.check.missing")
        : result.reason === "not_dir"
          ? t("settings.ai.kb.check.notDir")
          : result.reason === "no_access"
            ? t("settings.ai.kb.check.noAccess")
            : result.reason === "empty"
              ? t("settings.ai.kb.check.empty")
              : t("settings.ai.kb.check.error");
    return (
      <div
        className="max-w-[18rem] text-right text-xs text-destructive"
        title={result.message}
      >
        {label}
        <div className="truncate font-mono text-[10px] opacity-70">
          {result.message}
        </div>
      </div>
    );
  }
  // Sort extensions by count desc, keep top 4.
  const topExts = Object.entries(result.extensions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([ext, n]) => `${ext || "(no ext)"} ${n}`)
    .join(" · ");
  return (
    <div
      className="flex max-w-[18rem] flex-col items-end gap-0.5 text-right text-[11px]"
      title={result.sample.join("\n")}
    >
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
        {t("settings.ai.kb.check.ok")}
      </span>
      <span className="font-mono text-muted-foreground">
        {result.files}
        {result.truncated ? "+" : ""} files · {formatBytes(result.size_bytes)}
      </span>
      {topExts && (
        <span className="font-mono text-muted-foreground">{topExts}</span>
      )}
      {result.sample.length > 0 && (
        <span className="truncate font-mono text-[10px] text-muted-foreground/70">
          {t("settings.ai.kb.check.sample")}: {result.sample.slice(0, 3).join(", ")}
        </span>
      )}
    </div>
  );
}

function ClaudeCodeStatusBadge({
  status,
}: {
  status: ClaudeCodeStatus | null;
}) {
  const t = useT();
  if (!status) {
    return <span className="text-xs text-muted-foreground">…</span>;
  }
  if (!status.installed) {
    return (
      <span
        className="max-w-[14rem] truncate text-xs text-destructive"
        title={status.error}
      >
        {t("settings.ai.claudeCode.notInstalled")}
      </span>
    );
  }
  if (!status.authed) {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        {t("settings.ai.claudeCode.notAuthed")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
      {t("settings.ai.claudeCode.ready")}
      {status.version && (
        <span className="text-muted-foreground">· {status.version}</span>
      )}
    </span>
  );
}

function TestStatusBadge({ state }: { state: TestState }) {
  const t = useT();
  if (state.kind === "idle") return null;
  if (state.kind === "running") {
    return (
      <span className="text-xs text-muted-foreground">…</span>
    );
  }
  if (state.kind === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
        {t("settings.ai.test.ok")}
        {state.models.length > 0 && (
          <span className="text-muted-foreground">· {state.models.length}</span>
        )}
      </span>
    );
  }
  return (
    <span
      className="max-w-[14rem] truncate text-xs text-destructive"
      title={state.message}
    >
      {t("settings.ai.test.fail")}: {state.message}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Notes templates — persona/focus presets for the LLM prompt
// ---------------------------------------------------------------------------

interface TemplatesState {
  templates: NotesTemplate[];
  defaultId: string;
}

function NotesTemplatesSection() {
  const t = useT();
  const [state, setState] = useState<TemplatesState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  async function refresh() {
    const next = await window.scribe.templates.list();
    setState(next);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  function startEdit(tpl: NotesTemplate) {
    setEditingId(tpl.id);
    setDraftInstructions(tpl.instructions);
    setDraftName(tpl.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftInstructions("");
    setDraftName("");
  }

  async function saveEdit(tpl: NotesTemplate) {
    const patch: { name?: string; instructions?: string } = {
      instructions: draftInstructions,
    };
    if (!tpl.builtin && draftName.trim() !== tpl.name) {
      patch.name = draftName;
    }
    await window.scribe.templates.update(tpl.id, patch);
    await refresh();
    cancelEdit();
  }

  async function resetBuiltin(tpl: NotesTemplate) {
    await window.scribe.templates.reset(tpl.id);
    await refresh();
    cancelEdit();
  }

  async function deleteCustom(tpl: NotesTemplate) {
    if (!window.confirm(t("settings.templates.confirmDelete"))) return;
    await window.scribe.templates.delete(tpl.id);
    await refresh();
    if (editingId === tpl.id) cancelEdit();
  }

  async function changeDefault(id: string) {
    await window.scribe.templates.setDefault(id);
    await refresh();
  }

  async function createTemplate() {
    if (!newName.trim() || !newInstructions.trim()) return;
    await window.scribe.templates.create({
      name: newName,
      instructions: newInstructions,
    });
    setNewName("");
    setNewInstructions("");
    setCreating(false);
    await refresh();
  }

  if (!state) {
    return (
      <SettingCard
        title={t("settings.templates.title")}
        description={t("settings.templates.desc")}
      >
        <Skeleton className="h-40 w-full" />
      </SettingCard>
    );
  }

  const customs = state.templates.filter((tpl) => !tpl.builtin);
  const builtins = state.templates.filter((tpl) => tpl.builtin);

  return (
    <SettingCard
      title={t("settings.templates.title")}
      description={t("settings.templates.desc")}
    >
      <FieldRow
        label={t("settings.templates.default")}
        description={t("settings.templates.default.desc")}
      >
        <Select
          value={state.defaultId}
          onValueChange={(v) => v && void changeDefault(v)}
        >
          <SelectTrigger size="sm" className="min-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {state.templates.map((tpl) => (
              <SelectItem key={tpl.id} value={tpl.id}>
                {tpl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <Separator />

      <div className="flex flex-col gap-2">
        {builtins.map((tpl) => (
          <TemplateRow
            key={tpl.id}
            template={tpl}
            isDefault={tpl.id === state.defaultId}
            isEditing={editingId === tpl.id}
            draftInstructions={draftInstructions}
            draftName={draftName}
            onStartEdit={() => startEdit(tpl)}
            onCancel={cancelEdit}
            onSave={() => void saveEdit(tpl)}
            onReset={() => void resetBuiltin(tpl)}
            onDelete={null}
            onDraftInstructionsChange={setDraftInstructions}
            onDraftNameChange={setDraftName}
          />
        ))}
      </div>

      {customs.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            {customs.map((tpl) => (
              <TemplateRow
                key={tpl.id}
                template={tpl}
                isDefault={tpl.id === state.defaultId}
                isEditing={editingId === tpl.id}
                draftInstructions={draftInstructions}
                draftName={draftName}
                onStartEdit={() => startEdit(tpl)}
                onCancel={cancelEdit}
                onSave={() => void saveEdit(tpl)}
                onReset={null}
                onDelete={() => void deleteCustom(tpl)}
                onDraftInstructionsChange={setDraftInstructions}
                onDraftNameChange={setDraftName}
              />
            ))}
          </div>
        </>
      )}

      <Separator />

      {creating ? (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
          <Label className="text-xs font-medium">
            {t("settings.templates.name")}
          </Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("settings.templates.name.placeholder")}
          />
          <Label className="mt-2 text-xs font-medium">
            {t("settings.templates.instructions")}
          </Label>
          <Textarea
            className="min-h-32"
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
            placeholder={t("settings.templates.instructions.placeholder")}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewInstructions("");
              }}
            >
              {t("settings.templates.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => void createTemplate()}
              disabled={!newName.trim() || !newInstructions.trim()}
            >
              {t("settings.templates.create")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreating(true)}
          >
            + {t("settings.templates.new")}
          </Button>
        </div>
      )}
    </SettingCard>
  );
}

function TemplateRow({
  template,
  isDefault,
  isEditing,
  draftInstructions,
  draftName,
  onStartEdit,
  onCancel,
  onSave,
  onReset,
  onDelete,
  onDraftInstructionsChange,
  onDraftNameChange,
}: {
  template: NotesTemplate;
  isDefault: boolean;
  isEditing: boolean;
  draftInstructions: string;
  draftName: string;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReset: (() => void) | null;
  onDelete: (() => void) | null;
  onDraftInstructionsChange: (v: string) => void;
  onDraftNameChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{template.name}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-wider",
                template.builtin
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary",
              )}
            >
              {template.builtin
                ? t("settings.templates.builtin")
                : t("settings.templates.custom")}
            </span>
            {isDefault && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {t("settings.templates.default")}
              </span>
            )}
          </div>
          {!isEditing && (
            <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
              {template.instructions}
            </p>
          )}
        </div>
        {!isEditing && (
          <Button size="sm" variant="outline" onClick={onStartEdit}>
            {t("settings.templates.edit")}
          </Button>
        )}
      </div>

      {isEditing && (
        <div className="mt-3 flex flex-col gap-2">
          {!template.builtin && (
            <>
              <Label className="text-xs font-medium">
                {t("settings.templates.name")}
              </Label>
              <Input
                value={draftName}
                onChange={(e) => onDraftNameChange(e.target.value)}
                placeholder={t("settings.templates.name.placeholder")}
              />
            </>
          )}
          <Label className="mt-1 text-xs font-medium">
            {t("settings.templates.instructions")}
          </Label>
          <Textarea
            className="min-h-32"
            value={draftInstructions}
            onChange={(e) => onDraftInstructionsChange(e.target.value)}
          />
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                {t("settings.templates.delete")}
              </Button>
            )}
            {onReset && (
              <Button size="sm" variant="outline" onClick={onReset}>
                {t("settings.templates.reset")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onCancel}>
              {t("settings.templates.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={!draftInstructions.trim()}
            >
              {t("settings.templates.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Speaker labels (HuggingFace token for pyannote diarization)
// ---------------------------------------------------------------------------

function SpeakersSection() {
  const t = useT();
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
      title={t("settings.hf.title")}
      description={
        <>
          {t("settings.hf.descPrefix")}{" "}
          <a
            href="https://huggingface.co/pyannote/speaker-diarization-3.1"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline hover:no-underline"
          >
            pyannote/speaker-diarization-3.1
          </a>{" "}
          {t("settings.hf.descSuffix")}
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
            {t("common.clear")}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder={t("settings.hf.placeholder")}
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="font-mono text-xs"
          />
          <Button
            size="sm"
            onClick={onSave}
            disabled={!tokenInput.trim() || saving}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      )}
      <a
        href="https://huggingface.co/settings/tokens"
        target="_blank"
        rel="noreferrer"
        className="self-start text-xs text-muted-foreground underline hover:text-foreground"
      >
        {t("settings.hf.getToken")}
      </a>
    </SettingCard>
  );
}

// ---------------------------------------------------------------------------
// Voice library
// ---------------------------------------------------------------------------

function VoiceLibrarySection() {
  const t = useT();
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
      title={t("settings.voice.title")}
      description={t("settings.voice.desc")}
    >
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {entries === null && !error && (
        <div className="text-xs text-muted-foreground">
          {t("common.loading")}
        </div>
      )}
      {entries && entries.length === 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("settings.voice.empty")}
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
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.display_name);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
            title={t("settings.voice.clickToRename")}
          >
            {entry.display_name}
          </button>
        )}
        <span className="font-mono text-[10px] text-muted-foreground">
          {entry.n_meetings === 1
            ? t("settings.voice.meetingOne", { count: entry.n_meetings })
            : t("settings.voice.meetingMany", { count: entry.n_meetings })}{" "}
          · {entry.dim}-dim
        </span>
      </div>
      <SampleClipPlayer filePath={entry.sample_clip_path} />
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => setConfirmDelete(true)}
        disabled={busy}
        title={t("settings.voice.deleteEntry")}
        aria-label={t("settings.voice.deleteEntry")}
      >
        <HugeiconsIcon icon={Delete02Icon} />
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("settings.voice.deleteTitle")}
        description={t("settings.voice.deleteDesc")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => void deleteEntry()}
      />
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
  const t = useT();
  const accounts = useScribe((s) => s.calendarAccounts);
  const loadAccounts = useScribe((s) => s.loadCalendarAccounts);
  const connect = useScribe((s) => s.connectGoogleCalendar);
  const disconnect = useScribe((s) => s.disconnectCalendar);
  const syncCalendar = useScribe((s) => s.syncCalendar);

  const [hasCreds, setHasCreds] = useState<boolean | null>(null);
  const [masked, setMasked] = useState<MaskedCreds | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Sync window: a generous range centered on now. Calendar view uses tighter
  // ranges for fast paint, but a manual settings-side sync should refresh a
  // wide enough window to be useful regardless of where the user lands next.
  const DAY = 24 * 60 * 60 * 1000;
  async function onSync(accountId: string) {
    setSyncingId(accountId);
    try {
      const now = Date.now();
      await syncCalendar(accountId, now - 30 * DAY, now + 90 * DAY);
    } finally {
      setSyncingId(null);
    }
  }

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
        title={t("settings.cal.creds.title")}
        description={t("settings.cal.creds.desc")}
      >
        {hasCreds === null && (
          <div className="text-xs text-muted-foreground">
            {t("settings.cal.creds.checking")}
          </div>
        )}

        {hasCreds === false && !showSetup && (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <HugeiconsIcon
                icon={HelpCircleIcon}
                className="size-4 text-muted-foreground"
              />
              <span>{t("settings.cal.creds.notConfigured")}</span>
            </div>
            <Button size="sm" onClick={() => setShowSetup(true)}>
              {t("settings.cal.creds.showMe")}
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
              title={t("settings.cal.creds.clear")}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
            </button>
          </div>
        )}
      </SettingCard>

      <SettingCard
        title={t("settings.cal.accounts.title")}
        description={t("settings.cal.accounts.desc")}
      >
        {!hasCreds && (
          <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {t("settings.cal.accounts.needCreds")}
          </div>
        )}

        {hasCreds && accounts.length === 0 && (
          <Button
            onClick={onConnect}
            disabled={connecting}
            className="self-start gap-1.5"
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-3.5" />
            {connecting
              ? t("settings.cal.accounts.waiting")
              : t("settings.cal.accounts.connect")}
          </Button>
        )}

        {hasCreds && accounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {accounts.map((a) => (
              <CalendarAccountRow
                key={a.id}
                account={a}
                syncing={syncingId === a.id}
                onSync={() => void onSync(a.id)}
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
              {connecting
                ? t("settings.cal.accounts.waiting")
                : t("settings.cal.accounts.addAnother")}
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
  syncing,
  onSync,
  onDisconnect,
}: {
  account: CalendarAccountPublic;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  const language = useScribe((s) => s.displayLanguage);
  const connectedLabel = useMemo(
    () =>
      new Date(account.connected_at_ms).toLocaleDateString(language, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [account.connected_at_ms, language],
  );
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-[13px]">
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        className="size-3.5 shrink-0 text-emerald-500"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{account.email}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {t("settings.cal.accounts.connectedOn", { date: connectedLabel })}
        </span>
      </div>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        title={t("settings.cal.accounts.syncNow")}
        aria-label={t("settings.cal.accounts.syncNow")}
        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <HugeiconsIcon
          icon={Refresh01Icon}
          className={cn("size-3.5", syncing && "animate-spin")}
        />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDisconnect(true)}
        title={t("settings.cal.accounts.disconnect")}
        aria-label={t("settings.cal.accounts.disconnect")}
        className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
      </button>
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t("settings.cal.accounts.disconnectTitle")}
        description={t("settings.cal.accounts.disconnectDesc")}
        confirmLabel={t("common.disconnect")}
        destructive
        onConfirm={onDisconnect}
      />
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
  const t = useT();
  // The step bodies reference Google Cloud Console screen labels, which are
  // localized by Google according to the user's Google account. Keeping them
  // in English keeps a stable, scannable reference.
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
        <h4 className="text-sm font-semibold">
          {t("settings.cal.wizard.title")}
        </h4>
        <button
          type="button"
          onClick={props.onCancel}
          className="text-[12px] text-muted-foreground hover:text-foreground"
        >
          {t("common.cancel")}
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
          {t("settings.cal.wizard.clientId")}
        </Label>
        <Input
          id="cal-client-id"
          value={props.clientIdInput}
          onChange={(e) => props.onChangeClientId(e.target.value)}
          placeholder="xxxxxx.apps.googleusercontent.com"
          className="font-mono text-xs"
        />
        <Label htmlFor="cal-client-secret" className="mt-2 text-[12px]">
          {t("settings.cal.wizard.clientSecret")}
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
            {props.saving
              ? t("common.saving")
              : t("settings.cal.wizard.save")}
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
// Claude integration (MCP server)
// ---------------------------------------------------------------------------

interface McpServerInfo {
  scriptPath: string | null;
  claudeDesktopConfigPath: string;
  configSnippet: string;
  requiresNode: boolean;
  allowWrites: boolean;
}

type SkillStatus = "not-installed" | "installed" | "outdated" | "missing";

interface SkillInfo {
  status: SkillStatus;
  bundledPath: string | null;
  installedPath: string;
  bundledSize: number | null;
  installedMtimeMs: number | null;
  hasUserSection: boolean;
}

function ClaudeMcpSection() {
  const t = useT();
  const [info, setInfo] = useState<McpServerInfo | null>(null);
  const [skill, setSkill] = useState<SkillInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [skillBusy, setSkillBusy] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillNote, setSkillNote] = useState<string | null>(null);

  async function refresh() {
    const [nextInfo, nextSkill] = await Promise.all([
      window.scribe.mcp.getServerInfo(),
      window.scribe.mcp.getSkillInfo(),
    ]);
    setInfo(nextInfo);
    setSkill(nextSkill);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  async function copySnippet() {
    if (!info?.configSnippet) return;
    try {
      await navigator.clipboard.writeText(info.configSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — user can select text manually */
    }
  }

  async function revealClaudeConfig() {
    await window.scribe.mcp.revealClaudeConfig();
  }

  async function toggleAllowWrites(next: boolean) {
    await window.scribe.mcp.setAllowWrites(next);
    await refresh();
  }

  async function installSkill() {
    setSkillBusy(true);
    setSkillError(null);
    setSkillNote(null);
    try {
      const res = await window.scribe.mcp.installSkill();
      if (!res.ok) {
        setSkillError(res.error ?? "install failed");
      } else if (res.backupPath) {
        setSkillNote(`${t("settings.mcp.skill.backedUp")} ${res.backupPath}`);
      } else if (res.preservedUserSection) {
        setSkillNote(t("settings.mcp.skill.preserved"));
      }
      await refresh();
    } finally {
      setSkillBusy(false);
    }
  }

  async function uninstallSkill() {
    setSkillBusy(true);
    setSkillError(null);
    setSkillNote(null);
    try {
      const res = await window.scribe.mcp.uninstallSkill();
      if (!res.ok) setSkillError(res.error ?? "uninstall failed");
      await refresh();
    } finally {
      setSkillBusy(false);
    }
  }

  async function revealSkill() {
    await window.scribe.mcp.revealInstalledSkill();
  }

  if (!info) {
    return (
      <SettingCard
        title={t("settings.mcp.title")}
        description={t("settings.mcp.desc")}
      >
        <Skeleton className="h-32 w-full" />
      </SettingCard>
    );
  }

  const isBuilt = info.scriptPath !== null;

  return (
    <div className="flex flex-col gap-6">
      <SettingCard
        title={t("settings.mcp.title")}
        description={t("settings.mcp.desc")}
      >
        <FieldRow
          label={t("settings.mcp.status")}
          description={t("settings.mcp.status.desc")}
        >
          <div className="flex items-center gap-2">
            {isBuilt ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-3.5"
                />
                {t("settings.mcp.status.ready")}
              </span>
            ) : (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {t("settings.mcp.status.notBuilt")}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              title={t("settings.mcp.recheck")}
            >
              <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
              {t("settings.mcp.recheck")}
            </Button>
          </div>
        </FieldRow>

        {isBuilt && (
          <>
            <Separator />
            <FieldRow
              label={t("settings.mcp.scriptPath")}
              description={t("settings.mcp.scriptPath.desc")}
            >
              <code className="block max-w-md break-all rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {info.scriptPath}
              </code>
            </FieldRow>

            <Separator />

            <FieldRow
              label={t("settings.mcp.snippet")}
              description={t("settings.mcp.snippet.desc")}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copySnippet()}
              >
                {copied
                  ? t("settings.mcp.snippet.copied")
                  : t("settings.mcp.snippet.copy")}
              </Button>
            </FieldRow>
            <Textarea
              readOnly
              value={info.configSnippet}
              spellCheck={false}
              className="font-mono text-[11px]"
              rows={8}
            />

            <Separator />

            <FieldRow
              label={t("settings.mcp.claudeConfig")}
              description={t("settings.mcp.claudeConfig.desc")}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => void revealClaudeConfig()}
              >
                {t("settings.mcp.claudeConfig.reveal")}
              </Button>
            </FieldRow>
            <code className="block max-w-md break-all rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {info.claudeDesktopConfigPath}
            </code>

            <Separator />

            <FieldRow
              label={t("settings.mcp.allowWrites")}
              description={t("settings.mcp.allowWrites.desc")}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={info.allowWrites}
                  onCheckedChange={(c) =>
                    void toggleAllowWrites(c === true)
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {info.allowWrites
                    ? t("settings.mcp.allowWrites.on")
                    : t("settings.mcp.allowWrites.off")}
                </span>
              </div>
            </FieldRow>
          </>
        )}

        <Separator />

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("settings.mcp.nodeRequirement")}
        </p>
      </SettingCard>

      <SettingCard
        title={t("settings.mcp.skill.title")}
        description={t("settings.mcp.skill.desc")}
      >
        {!skill ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <FieldRow
              label={t("settings.mcp.skill.status")}
              description={t("settings.mcp.skill.status.desc")}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <SkillStatusBadge status={skill.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refresh()}
                    title={t("settings.mcp.recheck")}
                    disabled={skillBusy}
                  >
                    <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
                    {t("settings.mcp.recheck")}
                  </Button>
                </div>
                {skill.hasUserSection && (
                  <span className="text-[11px] text-muted-foreground">
                    {t("settings.mcp.skill.userSection")}
                  </span>
                )}
              </div>
            </FieldRow>

            <Separator />

            <FieldRow
              label={t("settings.mcp.skill.path")}
              description={t("settings.mcp.skill.path.desc")}
            >
              <code className="block max-w-md break-all rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {skill.installedPath}
              </code>
            </FieldRow>

            <Separator />

            <FieldRow
              label={t("settings.mcp.skill.actions")}
              description={t("settings.mcp.skill.actions.desc")}
            >
              <div className="flex flex-wrap items-center gap-2">
                {skill.status === "missing" ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {t("settings.mcp.skill.bundledMissing")}
                  </span>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void installSkill()}
                      disabled={skillBusy || skill.status === "installed"}
                    >
                      {skill.status === "not-installed"
                        ? t("settings.mcp.skill.install")
                        : skill.status === "outdated"
                          ? t("settings.mcp.skill.update")
                          : t("settings.mcp.skill.upToDate")}
                    </Button>
                    {skill.status !== "not-installed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void revealSkill()}
                        disabled={skillBusy}
                      >
                        {t("settings.mcp.skill.reveal")}
                      </Button>
                    )}
                    {skill.status !== "not-installed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void uninstallSkill()}
                        disabled={skillBusy}
                      >
                        {t("settings.mcp.skill.uninstall")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </FieldRow>

            {skillError && (
              <p className="text-xs text-destructive">
                {skillError}
              </p>
            )}
            {skillNote && (
              <p className="text-xs text-muted-foreground">{skillNote}</p>
            )}
          </>
        )}
      </SettingCard>
    </div>
  );
}

function SkillStatusBadge({ status }: { status: SkillStatus }) {
  const t = useT();
  if (status === "installed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
        {t("settings.mcp.skill.status.installed")}
      </span>
    );
  }
  if (status === "outdated") {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        {t("settings.mcp.skill.status.outdated")}
      </span>
    );
  }
  if (status === "missing") {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        {t("settings.mcp.skill.status.missing")}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {t("settings.mcp.skill.status.notInstalled")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

const IS_DEV = process.env.NODE_ENV === "development";

function AboutSection() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <SettingCard
        title={t("settings.about.title")}
        description={t("settings.about.desc")}
      >
        <FieldRow
          label={t("settings.about.version")}
          description={t("settings.about.version.desc")}
        >
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            0.1.0
          </span>
        </FieldRow>
        <Separator />
        <FieldRow
          label={t("settings.about.storage")}
          description={t("settings.about.storage.desc")}
        >
          <span />
        </FieldRow>
        <Separator />
        <FieldRow
          label={t("settings.about.diar")}
          description={t("settings.about.diar.desc")}
        >
          <a
            href="https://huggingface.co/pyannote/speaker-diarization-3.1"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline hover:no-underline"
          >
            {t("settings.about.diar.link")}
          </a>
        </FieldRow>
        <Separator />
        <FieldRow
          label={t("settings.about.engine")}
          description={t("settings.about.engine.desc")}
        >
          <a
            href="https://github.com/m-bain/whisperX"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline hover:no-underline"
          >
            {t("settings.about.engine.link")}
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
    const now = Date.now();
    useScribe.setState({
      processing: {
        kind: "processing",
        meetingId,
        flow: phase === "transcribe" ? "transcribe-only" : "generate-only",
        phase,
        stage: stages[0],
        pct: 0,
        model: phase === "transcribe" ? "whisper-large-v3" : "llama-3.1-8b",
        startedAt: now,
        driftAnchorStage: stages[0],
        driftAnchorAt: now,
        driftAnchorPct: 0,
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

