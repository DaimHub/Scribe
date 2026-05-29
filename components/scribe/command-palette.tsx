"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useScribe, type SidebarSection, type MeetingTab } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type {
  CalendarEventRow,
  MeetingRow,
  TagRow,
  VoiceLibraryPerson,
} from "@/lib/scribe-global";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  FolderAddIcon,
  Note01Icon,
  RecordIcon,
  Search01Icon,
  Settings01Icon,
  SparklesIcon,
  StopCircleIcon,
  Tag01Icon,
  TaskDone01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";

type IconType = typeof Search01Icon;

const SECTION_ICON: Record<Exclude<SidebarSection, "meetings">, IconType> = {
  tasks: TaskDone01Icon,
  calendar: Calendar03Icon,
  people: UserMultipleIcon,
  settings: Settings01Icon,
};

const SECTION_LABEL_KEY: Record<
  Exclude<SidebarSection, "meetings">,
  | "nav.tasks"
  | "nav.calendar"
  | "nav.people"
  | "nav.settings"
> = {
  tasks: "nav.tasks",
  calendar: "nav.calendar",
  people: "nav.people",
  settings: "nav.settings",
};

const MEETING_TAB_LABEL_KEY: Record<
  MeetingTab,
  | "meeting.tab.summary"
  | "meeting.tab.bullets"
  | "meeting.tab.transcript"
  | "meeting.tab.tasks"
  | "meeting.tab.scratchpad"
> = {
  summary: "meeting.tab.summary",
  bullets: "meeting.tab.bullets",
  transcript: "meeting.tab.transcript",
  tasks: "meeting.tab.tasks",
  scratchpad: "meeting.tab.scratchpad",
};

const MOD_KEY =
  typeof navigator !== "undefined" && /Mac|iP/i.test(navigator.platform)
    ? "⌘"
    : "Ctrl";

export function CommandPalette() {
  const open = useScribe((s) => s.paletteOpen);
  const closePalette = useScribe((s) => s.closePalette);

  // Mount the heavy contents only while open — keeps the people/calendar fetches
  // off the initial render and lets us reset the cmdk Input state between opens.
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closePalette();
      }}
    >
      {open && <CommandPaletteContents onClose={closePalette} />}
    </CommandDialog>
  );
}

function CommandPaletteContents({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [input, setInput] = useState("");

  const meetings = useScribe((s) => s.meetings);
  const folders = useScribe((s) => s.folders);
  const allTags = useScribe((s) => s.allTags);
  const activeTagId = useScribe((s) => s.activeTagId);
  const activeSection = useScribe((s) => s.activeSection);
  const selectedId = useScribe((s) => s.selectedId);
  const recording = useScribe((s) => s.recording);

  const selectMeeting = useScribe((s) => s.selectMeeting);
  const setActiveSection = useScribe((s) => s.setActiveSection);
  const setMeetingTab = useScribe((s) => s.setMeetingTab);
  const startRecording = useScribe((s) => s.startRecording);
  const stopRecording = useScribe((s) => s.stopRecording);
  const startRecordingForEvent = useScribe((s) => s.startRecordingForEvent);
  const processMeeting = useScribe((s) => s.processMeeting);
  const createFolder = useScribe((s) => s.createFolder);
  const setActiveTag = useScribe((s) => s.setActiveTag);
  const setDisplayLanguage = useScribe((s) => s.setDisplayLanguage);
  const openFind = useScribe((s) => s.openFind);
  const setExpanded = useScribe((s) => s.setExpanded);

  // Server-side meeting search — debounced into the same store action the
  // pre-existing top-bar omnibox used.
  const runSearch = useScribe((s) => s.runSearch);
  const searchResults = useScribe((s) => s.searchResults);
  const searching = useScribe((s) => s.searching);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      void runSearch("");
      return;
    }
    const handle = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 160);
    return () => window.clearTimeout(handle);
  }, [input, runSearch]);

  const { setTheme, theme } = useTheme();

  // People + active calendar event — fetched lazily on first open.
  const [people, setPeople] = useState<VoiceLibraryPerson[]>([]);
  const [activeEvent, setActiveEvent] = useState<CalendarEventRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, ev] = await Promise.all([
          window.scribe.voice.listPeople(),
          window.scribe.calendar.activeNow(),
        ]);
        if (cancelled) return;
        setPeople(p);
        setActiveEvent(ev);
      } catch {
        /* ignore — palette still works without these */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentMeetings = useMemo(() => meetings.slice(0, 8), [meetings]);
  const topLevelFolders = useMemo(
    () => folders.filter((f) => f.parent_id === null).slice(0, 10),
    [folders],
  );

  function run(fn: () => void | Promise<void>) {
    return () => {
      void Promise.resolve(fn());
      onClose();
    };
  }

  const filter = input.trim().toLowerCase();
  const matches = (label: string, ...keywords: string[]): boolean => {
    if (!filter) return true;
    if (label.toLowerCase().includes(filter)) return true;
    for (const k of keywords) if (k.toLowerCase().includes(filter)) return true;
    return false;
  };

  // Navigation items — always shown when their label matches. `kind`
  // distinguishes section navigation from in-meeting tab switching so the
  // React keys + cmdk values stay unique even when both groups have an
  // entry with id "tasks".
  type NavItem = {
    kind: "section" | "tab";
    id: string;
    label: string;
    icon: IconType;
    perform: () => void;
    keywords: string[];
  };
  const navItems: NavItem[] = (
    ["tasks", "calendar", "people", "settings"] as const
  )
    .filter((id) => id !== activeSection)
    .map((id) => ({
      kind: "section" as const,
      id,
      label: t("palette.nav.goTo", { target: t(SECTION_LABEL_KEY[id]) }),
      icon: SECTION_ICON[id],
      perform: () => setActiveSection(id),
      keywords: ["go to", "open", "navigate", t(SECTION_LABEL_KEY[id])],
    }));

  // Going back to the Meetings list is only meaningful when somewhere else.
  if (activeSection !== "meetings") {
    navItems.unshift({
      kind: "section",
      id: "meetings",
      label: t("palette.nav.goTo", { target: t("nav.meetings") }),
      icon: Note01Icon,
      perform: () => setActiveSection("meetings"),
      keywords: ["go to", "open", "navigate", t("nav.meetings")],
    });
  }

  // Tabs only matter while looking at a meeting.
  const tabItems: NavItem[] =
    activeSection === "meetings" && selectedId
      ? (["summary", "transcript", "tasks", "bullets", "scratchpad"] as const).map((tab) => ({
          kind: "tab" as const,
          id: tab,
          label: t("palette.tab.switch", {
            tab: t(MEETING_TAB_LABEL_KEY[tab]),
          }),
          icon: tab === "tasks" ? TaskDone01Icon : Note01Icon,
          perform: () => setMeetingTab(tab),
          keywords: ["tab", "switch", t(MEETING_TAB_LABEL_KEY[tab])],
        }))
      : [];

  return (
    <>
      <CommandInput
        value={input}
        onValueChange={setInput}
        placeholder={t("palette.placeholder")}
      />
      <CommandList>
        <CommandEmpty>
          {searching
            ? t("palette.searching")
            : t("palette.noResults")}
        </CommandEmpty>

        {/* ─── Actions ──────────────────────────────────────────────────────── */}
        {(() => {
          type ActionItem = {
            key: string;
            label: string;
            icon: IconType;
            shortcut?: string;
            keywords?: string[];
            perform: () => void | Promise<void>;
            visible?: boolean;
          };
          const actions: ActionItem[] = [];

          if (recording.kind === "idle") {
            actions.push({
              key: "rec:start",
              label: t("recording.start"),
              icon: RecordIcon,
              shortcut: `${MOD_KEY} ⇧ R`,
              keywords: ["record", "scribe", "begin"],
              perform: () => startRecording(),
            });
            if (activeEvent) {
              actions.push({
                key: "rec:startForEvent",
                label: t("recording.startEvent", { title: activeEvent.title }),
                icon: RecordIcon,
                keywords: ["record", "event", "calendar", activeEvent.title],
                perform: () => startRecordingForEvent(activeEvent.id),
              });
            }
          } else if (recording.kind === "recording") {
            actions.push({
              key: "rec:stop",
              label: t("recording.stop"),
              icon: StopCircleIcon,
              shortcut: `${MOD_KEY} ⇧ R`,
              keywords: ["stop", "end", "recording"],
              perform: () => stopRecording(),
            });
          }

          if (activeSection === "meetings" && selectedId) {
            actions.push({
              key: "meeting:process",
              label: t("palette.action.processMeeting"),
              icon: SparklesIcon,
              keywords: ["transcribe", "diarize", "generate", "notes"],
              perform: () => processMeeting(selectedId),
            });
          }

          actions.push({
            key: "folder:new",
            label: t("nav.newFolder"),
            icon: FolderAddIcon,
            keywords: ["create", "folder"],
            perform: () => {
              void createFolder(null);
            },
          });

          if (activeTagId) {
            actions.push({
              key: "tag:clear",
              label: t("palette.action.clearTagFilter"),
              icon: Tag01Icon,
              keywords: ["filter", "clear", "tag"],
              perform: () => setActiveTag(null),
            });
          }

          actions.push({
            key: "find",
            label: t("palette.action.find"),
            icon: Search01Icon,
            shortcut: `${MOD_KEY} F`,
            keywords: ["find", "search", "page"],
            perform: () => openFind(),
          });

          const filtered = actions.filter(
            (a) =>
              a.visible !== false &&
              matches(a.label, ...(a.keywords ?? [])),
          );
          if (filtered.length === 0) return null;
          return (
            <CommandGroup heading={t("palette.group.actions")}>
              {filtered.map((a) => (
                <CommandItem
                  key={a.key}
                  value={`action:${a.key} ${a.label} ${a.keywords?.join(" ") ?? ""}`}
                  onSelect={run(a.perform)}
                >
                  <HugeiconsIcon icon={a.icon} className="size-4" />
                  <span className="truncate">{a.label}</span>
                  {a.shortcut && (
                    <CommandShortcut>{a.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })()}

        {/* ─── Navigation ──────────────────────────────────────────────────── */}
        {(() => {
          const visible = [...navItems, ...tabItems].filter((n) =>
            matches(n.label, ...(n.keywords ?? [])),
          );
          if (visible.length === 0) return null;
          return (
            <CommandGroup heading={t("palette.group.navigation")}>
              {visible.map((n) => (
                <CommandItem
                  key={`${n.kind}:${n.id}`}
                  value={`${n.kind}:${n.id} ${n.label} ${n.keywords.join(" ")}`}
                  onSelect={run(n.perform)}
                >
                  <HugeiconsIcon icon={n.icon} className="size-4" />
                  <span className="truncate">{n.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })()}

        {/* ─── Meeting search results ─────────────────────────────────────── */}
        {filter && searchResults.length > 0 && (
          <CommandGroup heading={t("palette.group.meetings")}>
            {searchResults.map((hit) => (
              <CommandItem
                key={`hit:${hit.meeting_id}:${hit.matched_in}`}
                value={`hit:${hit.meeting_id}:${hit.matched_in} ${hit.title} ${hit.snippet ?? ""}`}
                onSelect={run(() => {
                  void selectMeeting(hit.meeting_id);
                  setActiveSection("meetings");
                })}
              >
                <HugeiconsIcon icon={Note01Icon} className="size-4" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{hit.title}</span>
                  {hit.snippet && (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {hit.snippet}
                    </span>
                  )}
                </div>
                <CommandShortcut>
                  {t(`palette.matchedIn.${hit.matched_in}`)}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* ─── Recent meetings (only when input is empty) ─────────────────── */}
        {!filter && recentMeetings.length > 0 && (
          <CommandGroup heading={t("palette.group.recent")}>
            {recentMeetings.map((m: MeetingRow) => (
              <CommandItem
                key={`recent:${m.id}`}
                value={`recent:${m.id} ${m.title}`}
                onSelect={run(() => {
                  void selectMeeting(m.id);
                  setActiveSection("meetings");
                })}
              >
                <HugeiconsIcon icon={Note01Icon} className="size-4" />
                <span className="truncate">{m.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* ─── People ─────────────────────────────────────────────────────── */}
        {(() => {
          const visible = people.filter((p) => matches(p.display_name));
          if (visible.length === 0) return null;
          return (
            <CommandGroup heading={t("palette.group.people")}>
              {visible.slice(0, 8).map((p) => (
                <CommandItem
                  key={`person:${p.id}`}
                  value={`person:${p.id} ${p.display_name}`}
                  onSelect={run(() => {
                    setActiveSection("people");
                  })}
                >
                  <HugeiconsIcon icon={UserMultipleIcon} className="size-4" />
                  <span className="truncate">{p.display_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })()}

        {/* ─── Tags ───────────────────────────────────────────────────────── */}
        {(() => {
          const visible = allTags.filter((tag: TagRow) => matches(tag.name));
          if (visible.length === 0) return null;
          return (
            <CommandGroup heading={t("palette.group.tags")}>
              {visible.slice(0, 12).map((tag) => (
                <CommandItem
                  key={`tag:${tag.id}`}
                  value={`tag:${tag.id} ${tag.name}`}
                  onSelect={run(() => {
                    setActiveTag(tag.id);
                    setActiveSection("meetings");
                  })}
                >
                  <HugeiconsIcon icon={Tag01Icon} className="size-4" />
                  <span className="truncate">{tag.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })()}

        {/* ─── Folders ────────────────────────────────────────────────────── */}
        {(() => {
          const visible = topLevelFolders.filter((f) => matches(f.name));
          if (visible.length === 0) return null;
          return (
            <CommandGroup heading={t("palette.group.folders")}>
              {visible.slice(0, 8).map((f) => (
                <CommandItem
                  key={`folder:${f.id}`}
                  value={`folder:${f.id} ${f.name}`}
                  onSelect={run(() => {
                    setExpanded(f.id, true);
                    setActiveSection("meetings");
                  })}
                >
                  <HugeiconsIcon icon={FolderAddIcon} className="size-4" />
                  <span className="truncate">{f.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })()}

        {/* ─── Preferences ────────────────────────────────────────────────── */}
        {(() => {
          type PrefItem = {
            key: string;
            label: string;
            icon: IconType;
            keywords: string[];
            perform: () => void | Promise<void>;
          };
          const prefs: PrefItem[] = [
            {
              key: "theme:light",
              label: t("palette.theme.light"),
              icon: Settings01Icon,
              keywords: ["theme", "light"],
              perform: () => setTheme("light"),
            },
            {
              key: "theme:dark",
              label: t("palette.theme.dark"),
              icon: Settings01Icon,
              keywords: ["theme", "dark"],
              perform: () => setTheme("dark"),
            },
            {
              key: "theme:system",
              label: t("palette.theme.system"),
              icon: Settings01Icon,
              keywords: ["theme", "system", "auto"],
              perform: () => setTheme("system"),
            },
          ].filter((p) => p.key !== `theme:${theme}`);

          for (const lang of ["en", "fr", "es", "de"] as const) {
            prefs.push({
              key: `lang:${lang}`,
              label: t(`palette.lang.${lang}`),
              icon: Settings01Icon,
              keywords: ["language", "display", lang],
              perform: () => setDisplayLanguage(lang),
            });
          }

          const visible = prefs.filter((p) => matches(p.label, ...p.keywords));
          if (visible.length === 0) return null;
          return (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("palette.group.preferences")}>
                {visible.map((p) => (
                  <CommandItem
                    key={p.key}
                    value={`pref:${p.key} ${p.label} ${p.keywords.join(" ")}`}
                    onSelect={run(p.perform)}
                  >
                    <HugeiconsIcon icon={p.icon} className="size-4" />
                    <span className="truncate">{p.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          );
        })()}
      </CommandList>
    </>
  );
}
