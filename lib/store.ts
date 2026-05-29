"use client";

import { create } from "zustand";
import type {
  AggregatedTaskRow,
  CalendarAccountPublic,
  CalendarEventRow,
  DisplayLanguage,
  FolderRow,
  MeetingDetail,
  MeetingResult,
  MeetingRow,
  MeetingSearchHit,
  MoveTarget,
  PersonalTaskRow,
  RecordingStateSnapshot,
  TagRow,
  TaskRow,
  VoicePostProcessSummary,
} from "@/lib/scribe-global";
import { startCapture, type CaptureHandle } from "@/lib/audio-capture";

export type RecordingState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; meetingId: string; startedAt: number }
  | { kind: "stopping" };

export type ProcessingFlow =
  | "transcribe-only"
  | "generate-only"
  | "full"
  | "diarize-only";
export type ProcessingPhase = "transcribe" | "generate";

export type ProcessingState =
  | { kind: "idle" }
  | {
      kind: "processing";
      meetingId: string;
      flow: ProcessingFlow;
      phase: ProcessingPhase;
      stage: string;
      pct: number;
      note?: string;
      model?: string;
      /** Wall-clock ms when the user kicked off this run. Lives here so the
       *  elapsed timer in the ProcessingPanel survives remounts (the panel
       *  unmounts when the user navigates away from the active meeting). */
      startedAt: number;
      /** Anchor for the per-stage smoothing drift. The drift hook tweens
       *  from `driftAnchorPct` toward the stage's ceiling starting at
       *  `driftAnchorAt`; re-anchored on stage change or when a backend
       *  emit raises pct. Stored here (not in component state) so a remount
       *  doesn't snap the smoothed value back to the raw emitted pct. */
      driftAnchorStage: string;
      driftAnchorAt: number;
      driftAnchorPct: number;
    };

export type SidebarSection =
  | "meetings"
  | "tasks"
  | "calendar"
  | "people"
  | "settings";
export type MeetingTab =
  | "summary"
  | "transcript"
  | "tasks"
  | "bullets"
  | "scratchpad";

/**
 * Latest post-transcription auto-link summary, used by the InfoToast in
 * AppShell. Null when there's nothing fresh to surface (toast was dismissed,
 * the meeting had no auto-links, or no transcription has run this session).
 */
export interface AutoLinkToastState {
  meetingId: string;
  autoLinked: VoicePostProcessSummary["autoLinked"];
  needsReviewCount: number;
}

/**
 * Speaker-count prompt opened before any flow that runs pyannote. Lifted to
 * the store so all triggers (empty-state buttons in transcript/notes/summary
 * views, the meeting-header menu, deep-link actions) open the SAME dialog —
 * no chance to slip past the prompt by clicking a particular button.
 *
 * `templateId` only applies to "process" flow. When undefined, the dialog
 * shows a template picker; when set (e.g. user already picked from the
 * dropdown submenu), the dialog just confirms speaker count.
 */
export type SpeakerPromptFlow =
  | { kind: "process"; templateId?: string }
  | { kind: "transcribe" }
  | { kind: "rediarize" };

export interface SpeakerPromptState {
  open: boolean;
  meetingId: string | null;
  flow: SpeakerPromptFlow | null;
  count: string;
}

/**
 * Pending action that needs a model pick before it can run. Raised by every
 * generation entry point when the active provider is claude-code with model
 * set to "ask". The dialog confirms with a real model id and re-dispatches
 * the action with `modelOverride` set.
 */
export type ModelPromptIntent =
  | { kind: "generate"; templateId?: string }
  | { kind: "process"; numSpeakers?: number; templateId?: string };

export interface ModelPromptState {
  open: boolean;
  meetingId: string | null;
  intent: ModelPromptIntent | null;
}

interface ScribeState {
  folders: FolderRow[];
  meetings: MeetingRow[];
  selectedId: string | null;
  detail: MeetingDetail | null;
  recording: RecordingState;
  processing: ProcessingState;
  levels: { mic: number; system: number };
  // Preferred microphone deviceId (null = system default). Persisted in
  // localStorage; passed to startCapture and live-swapped via setMicDevice.
  micDeviceId: string | null;
  error: string | null;
  // True when system (other-participant) audio couldn't be captured — almost
  // always missing Screen Recording permission. The mic keeps recording, so
  // this surfaces as a soft notice with an "open settings" action, not an error.
  systemAudioNotice: boolean;
  expandedFolderIds: Set<string>;
  speakerPrompt: SpeakerPromptState;
  modelPrompt: ModelPromptState;

  sidebarWidth: number;
  sidebarHydrated: boolean;

  displayLanguage: DisplayLanguage;

  // New: section nav (meetings tree / tasks / calendar)
  activeSection: SidebarSection;
  // Last non-"settings" section, so closing settings returns the user where
  // they were before they opened it.
  previousSection: SidebarSection;
  meetingTab: MeetingTab;

  // New: search
  searchQuery: string;
  searchResults: MeetingSearchHit[];
  searching: boolean;

  // Command palette (Cmd+K). Owns its own query so the inline search-bar
  // pill (which just opens the palette) doesn't share input state.
  paletteOpen: boolean;

  // Cmd+F find-in-page bar. The find bar component holds the query +
  // match-count state locally — the store only tracks whether it's open
  // and a tick that lets a repeated Cmd+F refocus the existing input.
  findOpen: boolean;
  findFocusTick: number;

  // Manual-refresh tick. Incremented by refreshActiveView() so views that
  // own their own fetch state (people-view, calendar-view) can re-pull from
  // disk after an external write (MCP, another tool) that the renderer
  // didn't observe through the usual push channels.
  refreshTick: number;
  // True while refreshActiveView is in flight, so the button can show a
  // spinning indicator and disable itself to debounce double-clicks.
  refreshing: boolean;
  // Separate flag for calendar resync (Google API hit, slower) so the
  // calendar-page button can spin without blocking the generic refresh.
  calendarSyncing: boolean;

  // New: tags
  meetingTagsById: Record<string, TagRow[]>;
  meetingTagPairs: Array<{ meeting_id: string; tag_id: string }>;
  allTags: TagRow[];
  activeTagId: string | null;
  tagsCollapsed: boolean;

  // New: personal + aggregated tasks
  personalTasks: PersonalTaskRow[];
  allMeetingTasks: AggregatedTaskRow[];

  // New: calendar
  calendarAccounts: CalendarAccountPublic[];
  calendarEvents: CalendarEventRow[];
  activeCalendarEvent: CalendarEventRow | null;
  linkedMeetingIds: Set<string>;

  // Auto-link toast — populated when voice:postProcess fires with any
  // autoLinked entries. Null while there's nothing to show.
  autoLinkToast: AutoLinkToastState | null;
  // Whether the VoiceTaggingPanel is open for the selected meeting. Kept
  // collapsed by default — the meeting-header banner is the entry point.
  voiceTaggingPanelOpen: boolean;
  // "pending" auto-shows just speakers flagged for review (banner path).
  // "all" surfaces every speaker so the user can rename/match even when
  // diarization didn't flag anything — entered via the header button.
  voiceTaggingPanelMode: "pending" | "all";

  init: () => Promise<void>;
  loadTree: () => Promise<void>;
  selectMeeting: (id: string | null) => Promise<void>;
  startRecording: (opts?: { folderId?: string | null }) => Promise<void>;
  stopRecording: () => Promise<void>;
  startRecordingForEvent: (eventId: string) => Promise<void>;
  transcribe: (meetingId: string, numSpeakers?: number) => Promise<void>;
  generate: (meetingId: string, modelOverride?: string) => Promise<void>;
  rediarize: (meetingId: string, numSpeakers?: number) => Promise<void>;
  processMeeting: (
    meetingId: string,
    numSpeakers?: number,
    modelOverride?: string,
  ) => Promise<void>;
  openSpeakerPrompt: (
    meetingId: string,
    flow: SpeakerPromptFlow,
    initialCount?: number,
  ) => void;
  setSpeakerPromptCount: (count: string) => void;
  closeSpeakerPrompt: () => void;
  /** Open the model picker dialog. Caller specifies what action it wants
   *  to run once the user confirms. The dialog dispatches the action
   *  itself with `modelOverride` set to the picked model. */
  openModelPrompt: (meetingId: string, intent: ModelPromptIntent) => void;
  /** Pick the model and run the pending intent. */
  confirmModelPrompt: (model: string) => void;
  closeModelPrompt: () => void;
  /** Resolve "should we prompt for model?" against the current provider
   *  config. Returns true if a prompt was opened (caller should NOT
   *  proceed); false if the caller should run the action immediately.
   *  Centralizes the policy so every entry point branches the same way. */
  requestGeneration: (
    meetingId: string,
    intent: ModelPromptIntent,
  ) => Promise<boolean>;
  renameSpeaker: (speakerId: string, displayName: string) => Promise<void>;
  renameMeeting: (id: string, title: string) => Promise<void>;
  setScratchpad: (id: string, text: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  setPinned: (id: string, pinned: boolean) => Promise<void>;
  createFolder: (parentId: string | null, name?: string) => Promise<FolderRow | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  setFolderAutoTag: (folderId: string, tagId: string | null) => Promise<void>;
  moveItem: (target: MoveTarget) => Promise<void>;
  toggleExpand: (folderId: string) => void;
  setExpanded: (folderId: string, expanded: boolean) => void;
  setSidebarWidth: (px: number) => void;
  persistSidebarWidth: () => void;
  hydrateSidebar: () => void;
  setDisplayLanguage: (lang: DisplayLanguage) => Promise<void>;
  setMicDevice: (deviceId: string | null) => void;
  clearError: () => void;
  reportError: (message: string) => void;

  // New actions
  setActiveSection: (s: SidebarSection) => void;
  setMeetingTab: (t: MeetingTab) => void;
  setSearchQuery: (q: string) => void;
  runSearch: (q: string) => Promise<void>;
  clearSearch: () => void;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  openFind: () => void;
  closeFind: () => void;

  refreshActiveView: () => Promise<void>;

  loadTags: () => Promise<void>;
  loadTagsForSelected: () => Promise<void>;
  attachTag: (meetingId: string, name: string) => Promise<void>;
  detachTag: (meetingId: string, tagId: string) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  setActiveTag: (tagId: string | null) => void;
  setTagsCollapsed: (collapsed: boolean) => void;

  loadPersonalTasks: () => Promise<void>;
  createPersonalTask: (text: string, dueAtMs: number | null) => Promise<void>;
  setPersonalTaskDone: (id: number, done: boolean) => Promise<void>;
  deletePersonalTask: (id: number) => Promise<void>;
  loadAllMeetingTasks: () => Promise<void>;
  setMeetingTaskDone: (taskId: number, done: boolean) => Promise<void>;
  addMeetingTask: (meetingId: string, text: string) => Promise<TaskRow | null>;
  duplicateMeetingTask: (taskId: number) => Promise<void>;
  deleteMeetingTask: (taskId: number) => Promise<void>;
  setMeetingTaskPriority: (taskId: number, priority: number) => Promise<void>;
  setMeetingTaskDueDate: (
    taskId: number,
    dueAtMs: number | null,
  ) => Promise<void>;
  setMeetingTaskAssignee: (
    taskId: number,
    speakerId: string | null,
  ) => Promise<void>;
  updateMeetingTaskText: (taskId: number, text: string) => Promise<void>;

  loadCalendarAccounts: () => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  disconnectCalendar: (id: string) => Promise<void>;
  loadCalendarEvents: (fromMs: number, toMs: number) => Promise<void>;
  syncCalendar: (
    accountId: string,
    fromMs: number,
    toMs: number,
  ) => Promise<void>;
  // Fan out a calendar sync to every connected account over the given
  // window. Used by the calendar page's Resync button.
  resyncCalendars: (fromMs: number, toMs: number) => Promise<void>;

  refreshActiveCalendarEvent: () => Promise<void>;
  loadLinkedMeetingIds: () => Promise<void>;
  linkMeetingToEvent: (meetingId: string, eventId: string) => Promise<void>;
  unlinkMeetingFromEvent: (meetingId: string) => Promise<void>;
  autoLinkMeeting: (meetingId: string, renameIfAuto?: boolean) => Promise<void>;

  dismissAutoLinkToast: () => void;
  dismissSystemAudioNotice: () => void;
  openScreenRecordingSettings: () => void;
  setVoiceTaggingPanelOpen: (open: boolean) => void;
  setVoiceTaggingPanelMode: (mode: "pending" | "all") => void;
}

let captureHandle: CaptureHandle | null = null;
let levelTimer: number | null = null;
let progressUnsubs: Array<() => void> = [];
let treeReloadTimer: number | null = null;

/**
 * Convert the renderer-side RecordingState union into the snapshot the
 * floating windows consume. Kept narrow on purpose — we don't ship `levels`
 * here because they update at 10Hz and would saturate the IPC channel; the
 * mini widget renders without a VU meter.
 */
function recordingSnapshotFor(
  state: ScribeState,
): RecordingStateSnapshot {
  const rec = state.recording;
  if (rec.kind === "idle") return { kind: "idle" };
  if (rec.kind === "starting" || rec.kind === "stopping") return { kind: rec.kind };
  const title =
    state.meetings.find((m) => m.id === rec.meetingId)?.title ?? undefined;
  return {
    kind: "recording",
    meetingId: rec.meetingId,
    startedAt: rec.startedAt,
    title,
  };
}

let lastPublishedRecording: RecordingStateSnapshot = { kind: "idle" };

function publishRecordingIfChanged(state: ScribeState): void {
  if (typeof window === "undefined" || !window.scribe?.floating) return;
  const next = recordingSnapshotFor(state);
  if (
    next.kind === lastPublishedRecording.kind &&
    next.meetingId === lastPublishedRecording.meetingId &&
    next.startedAt === lastPublishedRecording.startedAt &&
    next.title === lastPublishedRecording.title
  ) {
    return;
  }
  lastPublishedRecording = next;
  window.scribe.floating.publishRecordingState(next);
}

// Coalesce bursts of `tree:invalidated` events (e.g., a transcription run
// flips status several times in quick succession) into a single refetch.
function scheduleTreeReload(fn: () => void) {
  if (treeReloadTimer != null) return;
  treeReloadTimer = window.setTimeout(() => {
    treeReloadTimer = null;
    fn();
  }, 80);
}

const EXPAND_STORAGE_KEY = "scribe:expandedFolders";
const SIDEBAR_STORAGE_KEY = "scribe:sidebar";
const TAGS_COLLAPSED_STORAGE_KEY = "scribe:tagsCollapsed";
const DISPLAY_LANGUAGE_STORAGE_KEY = "scribe:displayLanguage";
const MIC_DEVICE_STORAGE_KEY = "scribe:micDevice";

const VALID_DISPLAY_LANGUAGES: ReadonlySet<DisplayLanguage> = new Set([
  "en",
  "fr",
  "es",
  "de",
]);

function loadDisplayLanguage(): DisplayLanguage {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(DISPLAY_LANGUAGE_STORAGE_KEY);
    if (raw && VALID_DISPLAY_LANGUAGES.has(raw as DisplayLanguage)) {
      return raw as DisplayLanguage;
    }
  } catch {
    /* ignore */
  }
  // Best-effort default from the browser locale.
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  const short = nav.slice(0, 2).toLowerCase();
  return VALID_DISPLAY_LANGUAGES.has(short as DisplayLanguage)
    ? (short as DisplayLanguage)
    : "en";
}

function saveDisplayLanguage(lang: DisplayLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISPLAY_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

function loadMicDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MIC_DEVICE_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function saveMicDeviceId(deviceId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (deviceId) {
      window.localStorage.setItem(MIC_DEVICE_STORAGE_KEY, deviceId);
    } else {
      window.localStorage.removeItem(MIC_DEVICE_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 288;

function loadExpanded(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(EXPAND_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) return new Set(arr as string[]);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveExpanded(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      EXPAND_STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    /* ignore */
  }
}

function loadSidebarWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return SIDEBAR_DEFAULT_WIDTH;
    const data = JSON.parse(raw) as { width?: number };
    return clampWidth(data.width ?? SIDEBAR_DEFAULT_WIDTH);
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function saveSidebarWidth(width: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ width }));
  } catch {
    /* ignore */
  }
}

function loadTagsCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TAGS_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveTagsCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TAGS_COLLAPSED_STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  } catch {
    /* ignore */
  }
}

/** Fresh processing state to seed a new run. Lives in the store (not the
 *  ProcessingPanel component) so the bar's elapsed timer and smoothing
 *  drift anchor survive view changes that unmount the panel. */
function freshProcessing<
  F extends ProcessingFlow,
  P extends ProcessingPhase,
>(
  meetingId: string,
  flow: F,
  phase: P,
): Extract<ProcessingState, { kind: "processing" }> {
  const now = Date.now();
  return {
    kind: "processing",
    meetingId,
    flow,
    phase,
    stage: "starting",
    pct: 0,
    startedAt: now,
    driftAnchorStage: "starting",
    driftAnchorAt: now,
    driftAnchorPct: 0,
  };
}

function clampWidth(px: number): number {
  if (!Number.isFinite(px)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.round(px)));
}

let searchSeq = 0;

export const useScribe = create<ScribeState>((set, get) => ({
  folders: [],
  meetings: [],
  selectedId: null,
  detail: null,
  recording: { kind: "idle" },
  processing: { kind: "idle" },
  levels: { mic: 0, system: 0 },
  // SSR-safe default; replaced by hydrateSidebar() once localStorage is reachable.
  micDeviceId: null,
  error: null,
  systemAudioNotice: false,
  expandedFolderIds: loadExpanded(),
  // SSR-safe default; replaced post-mount by `hydrateSidebar()` to avoid a
  // hydration mismatch when the persisted width differs from this default.
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  sidebarHydrated: false,

  // SSR-safe default; replaced by hydrateSidebar() (runs on init) once we can
  // touch localStorage and the main-process settings file.
  displayLanguage: "en" as DisplayLanguage,

  activeSection: "meetings",
  previousSection: "meetings",
  meetingTab: "transcript",
  searchQuery: "",
  searchResults: [],
  searching: false,
  paletteOpen: false,
  findOpen: false,
  findFocusTick: 0,
  refreshTick: 0,
  refreshing: false,
  calendarSyncing: false,
  meetingTagsById: {},
  meetingTagPairs: [],
  allTags: [],
  activeTagId: null,
  // SSR-safe default; the persisted value is loaded in hydrateSidebar() so
  // the first render matches the server-rendered HTML.
  tagsCollapsed: false,
  personalTasks: [],
  allMeetingTasks: [],
  calendarAccounts: [],
  calendarEvents: [],
  activeCalendarEvent: null,
  linkedMeetingIds: new Set(),
  autoLinkToast: null,
  voiceTaggingPanelOpen: false,
  voiceTaggingPanelMode: "pending",
  speakerPrompt: {
    open: false,
    meetingId: null,
    flow: null,
    count: "",
  },
  modelPrompt: {
    open: false,
    meetingId: null,
    intent: null,
  },

  async init() {
    get().hydrateSidebar();
    progressUnsubs.forEach((u) => u());
    progressUnsubs = [
      // Mirror recording state to the mini window. Fires on every store
      // mutation; the helper diffs and only forwards meaningful transitions.
      useScribe.subscribe((state) => {
        publishRecordingIfChanged(state);
      }),
      // Mini "Stop" → forwarded by the main process. Same effect as the user
      // hitting the in-app RecordingBar stop.
      window.scribe.floating.onStopRequested(() => {
        const cur = get().recording;
        if (cur.kind === "recording") void get().stopRecording();
      }),
      // Notification "Start Scribe" → start a recording and link it to the
      // event in one shot.
      window.scribe.floating.onStartScribeForEvent(({ eventId }) => {
        void get().startRecordingForEvent(eventId);
      }),
      window.scribe.transcribe.onProgress((p) => {
        set((s) => {
          if (
            s.processing.kind !== "processing" ||
            s.processing.meetingId !== p.meetingId ||
            s.processing.phase !== "transcribe"
          )
            return s;
          const cur = s.processing;
          const reAnchor =
            cur.driftAnchorStage !== p.stage || p.pct > cur.driftAnchorPct;
          return {
            processing: {
              ...cur,
              stage: p.stage,
              pct: p.pct,
              note: p.note,
              model: p.model ?? cur.model,
              driftAnchorStage: reAnchor ? p.stage : cur.driftAnchorStage,
              driftAnchorAt: reAnchor ? Date.now() : cur.driftAnchorAt,
              driftAnchorPct: reAnchor ? p.pct : cur.driftAnchorPct,
            },
          };
        });
      }),
      // Post-transcription voice-library summary. Fires once per transcribe
      // run after diarization + library matching complete. We only surface a
      // toast when at least one speaker was auto-linked — needs-review on its
      // own surfaces via the in-header banner derived from speakers[].
      window.scribe.voice.onPostProcess((p) => {
        if (p.autoLinked.length === 0) {
          // Still update the state so a renderer that's interested in
          // needs-review count can observe transitions, but skip the toast.
          set({
            autoLinkToast:
              p.needsReviewCount > 0
                ? {
                    meetingId: p.meetingId,
                    autoLinked: [],
                    needsReviewCount: p.needsReviewCount,
                  }
                : null,
          });
          return;
        }
        set({
          autoLinkToast: {
            meetingId: p.meetingId,
            autoLinked: p.autoLinked,
            needsReviewCount: p.needsReviewCount,
          },
        });
      }),
      window.scribe.llm.onProgress((p) => {
        set((s) => {
          if (
            s.processing.kind !== "processing" ||
            s.processing.meetingId !== p.meetingId ||
            s.processing.phase !== "generate"
          )
            return s;
          const cur = s.processing;
          const reAnchor =
            cur.driftAnchorStage !== p.stage || p.pct > cur.driftAnchorPct;
          return {
            processing: {
              ...cur,
              stage: p.stage,
              pct: p.pct,
              note: p.note,
              model: p.model ?? cur.model,
              driftAnchorStage: reAnchor ? p.stage : cur.driftAnchorStage,
              driftAnchorAt: reAnchor ? Date.now() : cur.driftAnchorAt,
              driftAnchorPct: reAnchor ? p.pct : cur.driftAnchorPct,
            },
          };
        });
      }),
      // Main-process invalidates the tree whenever a meeting/folder changes,
      // including from background work like whisper/llm status updates.
      // Replaces a 5s polling loop in the sidebar.
      window.scribe.tree.onInvalidated(() => {
        scheduleTreeReload(() => {
          void get().loadTree();
          // Out-of-process writes (the Scribe MCP server) invalidate the tree
          // without going through the local write paths that normally keep
          // these caches fresh. Refetch everything an MCP edit can touch so an
          // open app reflects Claude's changes live: tags (sidebar list +
          // open-meeting chips) and the aggregated meeting-tasks list. The
          // selected meeting's detail (summary, action items, speakers) is
          // refetched just below. People view self-refreshes via
          // voice:libraryChanged, and MCP writes don't touch the voice library.
          void get().loadTags();
          void get().loadTagsForSelected();
          void get().loadAllMeetingTasks();
          // Also refetch the open meeting's detail — same broadcast fires when
          // transcription/summary writes complete, and most failure paths in
          // processMeeting/transcribe don't refresh detail on the catch side.
          // Without this, segments land in SQLite but the open view stays
          // empty until the user reloads.
          const sel = get().selectedId;
          if (sel) {
            void window.scribe.meetings
              .get(sel)
              .then((detail) => {
                if (detail && get().selectedId === sel) set({ detail });
              })
              .catch(() => {
                /* non-fatal; next user action will refetch */
              });
          }
        });
      }),
    ];
    await get().loadTree();
    // Best-effort: refresh tags + pairs so the sidebar / search can color-tag instantly.
    void get().loadTags();
    void get().loadLinkedMeetingIds();
    void get().refreshActiveCalendarEvent();
    // Re-check "is a calendar event happening right now" every 30s — drives
    // the Smart Start Scribe button subtitle.
    window.setInterval(() => {
      void get().refreshActiveCalendarEvent();
    }, 30_000);
  },

  async loadTree() {
    try {
      const snapshot = await window.scribe.tree.list();
      set({ folders: snapshot.folders, meetings: snapshot.meetings });
      const selectedId = get().selectedId;
      if (!selectedId && snapshot.meetings.length > 0) {
        await get().selectMeeting(snapshot.meetings[0].id);
      }
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async selectMeeting(id) {
    if (id === null) {
      set({
        selectedId: null,
        detail: null,
        voiceTaggingPanelOpen: false,
        voiceTaggingPanelMode: "pending",
      });
      return;
    }
    // Picking a meeting always swaps the main view back to the meeting
    // detail — replaces the dropped "Meetings" sidebar nav button. Only
    // reset the voice-tagging panel when actually switching meetings; the
    // tagging panel calls selectMeeting(currentId) after every assignment
    // to refresh detail in place, and that path must NOT collapse the modal
    // (otherwise users can't chain assignments).
    const isSwitching = get().selectedId !== id;
    set({
      selectedId: id,
      activeSection: "meetings",
      ...(isSwitching && {
        voiceTaggingPanelOpen: false,
        voiceTaggingPanelMode: "pending",
      }),
    });
    try {
      const detail = await window.scribe.meetings.get(id);
      set({ detail });
      void get().loadTagsForSelected();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async startRecording(opts) {
    set({ recording: { kind: "starting" }, error: null, systemAudioNotice: false });
    try {
      const { meetingId } = await window.scribe.audio.startMeeting();
      if (opts?.folderId) {
        await window.scribe.tree.move({
          itemId: meetingId,
          kind: "meeting",
          newParentId: opts.folderId,
        });
      }
      // Warn up front if Screen Recording isn't granted — otherwise system
      // audio fails mid-capture with an opaque error. Don't block: the mic
      // still records, and the notice tells the user how to enable it.
      void window.scribe.audio.getScreenAccessStatus().then((status) => {
        if (status !== "granted") set({ systemAudioNotice: true });
      });
      const handle = await startCapture({
        meetingId,
        micDeviceId: get().micDeviceId ?? undefined,
        onError: (e) => set({ error: e.message }),
        onSystemAudioUnavailable: () => set({ systemAudioNotice: true }),
      });
      captureHandle = handle;
      set({
        recording: { kind: "recording", meetingId, startedAt: Date.now() },
      });
      if (levelTimer != null) window.clearInterval(levelTimer);
      levelTimer = window.setInterval(() => {
        const h = captureHandle;
        if (!h) return;
        set({ levels: { mic: h.getLevel("mic"), system: h.getLevel("system") } });
      }, 100);

      // Note: we deliberately skip the pre-link autoLink call here — it ran a
      // full overlap query + matcher before the recording even produced any
      // data, only to be redone in stopRecording() with the actual time range.
      // The post-stop call below is authoritative.

      await Promise.all([get().loadTree(), get().selectMeeting(meetingId)]);
    } catch (err) {
      set({
        recording: { kind: "idle" },
        error: errMsg(err),
      });
    }
  },

  async startRecordingForEvent(eventId) {
    if (get().recording.kind !== "idle") return;
    await get().startRecording();
    const rec = get().recording;
    if (rec.kind !== "recording") return;
    try {
      await window.scribe.calendar.linkEvent(eventId, rec.meetingId);
      await get().loadLinkedMeetingIds();
      if (get().selectedId === rec.meetingId) {
        const detail = await window.scribe.meetings.get(rec.meetingId);
        set({ detail });
      }
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async stopRecording() {
    const rec = get().recording;
    if (rec.kind !== "recording") return;
    set({ recording: { kind: "stopping" } });
    try {
      await captureHandle?.stop();
      captureHandle = null;
      if (levelTimer != null) {
        window.clearInterval(levelTimer);
        levelTimer = null;
      }
      const result: MeetingResult = await window.scribe.audio.stopMeeting(rec.meetingId);
      set({
        recording: { kind: "idle" },
        levels: { mic: 0, system: 0 },
      });

      // Single authoritative auto-link pass, now that we know the full time
      // range. (The pre-link call at startRecording was redundant.)
      try {
        await window.scribe.calendar.autoLink(result.meetingId, true);
        await get().loadLinkedMeetingIds();
      } catch {
        /* ignore */
      }

      await Promise.all([
        get().loadTree(),
        get().selectMeeting(result.meetingId),
      ]);
    } catch (err) {
      set({ recording: { kind: "idle" }, error: errMsg(err) });
    }
  },

  async transcribe(meetingId, numSpeakers) {
    set({
      processing: freshProcessing(meetingId, "transcribe-only", "transcribe"),
      error: null,
    });
    try {
      await window.scribe.transcribe.run(meetingId, numSpeakers);
      await get().loadTree();
      const detail = await window.scribe.meetings.get(meetingId);
      set({ detail, processing: { kind: "idle" } });
    } catch (err) {
      set({ processing: { kind: "idle" }, error: errMsg(err) });
    }
  },

  async generate(meetingId, modelOverride) {
    set({
      processing: freshProcessing(meetingId, "generate-only", "generate"),
      error: null,
    });
    try {
      await window.scribe.llm.generate(
        meetingId,
        modelOverride ? { modelOverride } : undefined,
      );
      await get().loadTree();
      const detail = await window.scribe.meetings.get(meetingId);
      set({ detail, processing: { kind: "idle" } });
    } catch (err) {
      set({ processing: { kind: "idle" }, error: errMsg(err) });
    }
  },

  async rediarize(meetingId, numSpeakers) {
    set({
      processing: freshProcessing(meetingId, "diarize-only", "transcribe"),
      error: null,
    });
    try {
      await window.scribe.transcribe.rediarize(meetingId, numSpeakers);
      await get().loadTree();
      const detail = await window.scribe.meetings.get(meetingId);
      set({ detail, processing: { kind: "idle" } });
    } catch (err) {
      set({ processing: { kind: "idle" }, error: errMsg(err) });
    }
  },

  async processMeeting(meetingId, numSpeakers, modelOverride) {
    set({
      processing: freshProcessing(meetingId, "full", "transcribe"),
      error: null,
    });
    try {
      await window.scribe.transcribe.run(meetingId, numSpeakers);
      // Refresh detail to surface the transcript before LLM kicks in.
      let interim: MeetingDetail | null = null;
      try {
        interim = await window.scribe.meetings.get(meetingId);
        if (interim && get().selectedId === meetingId) set({ detail: interim });
      } catch {
        /* ignore */
      }

      // Hold the LLM step when any speaker still needs review. The notes
      // generation pulls assignee names from the transcript, and if the
      // diarization left speakers unmatched, the LLM tends to invent
      // plausible-but-wrong names — polluting both the tasks and the
      // chip with phantoms. Stop here so the user can tag the unknown
      // voices in the popover first; they then trigger "Generate notes"
      // manually from the notes view's empty state or the menu.
      const speakers = interim?.speakers ?? get().detail?.speakers ?? [];
      const needsReview = speakers.some((s) => s.needs_review === 1);
      if (needsReview) {
        set({ processing: { kind: "idle" } });
        await get().loadTree();
        return;
      }

      set((s) => {
        if (s.processing.kind !== "processing" || s.processing.meetingId !== meetingId)
          return s;
        const now = Date.now();
        return {
          processing: {
            ...s.processing,
            // Preserve startedAt — the elapsed timer should keep counting
            // across the transcribe → generate handoff. Just re-anchor the
            // drift so notes' first stage doesn't inherit a stale ceiling.
            phase: "generate",
            stage: "starting",
            pct: 0,
            note: undefined,
            model: undefined,
            driftAnchorStage: "starting",
            driftAnchorAt: now,
            driftAnchorPct: 0,
          },
        };
      });
      await window.scribe.llm.generate(
        meetingId,
        modelOverride ? { modelOverride } : undefined,
      );
      await get().loadTree();
      const detail = await window.scribe.meetings.get(meetingId);
      set({ detail, processing: { kind: "idle" } });
      void get().loadTags();
      void get().loadTagsForSelected();
    } catch (err) {
      set({ processing: { kind: "idle" }, error: errMsg(err) });
    }
  },

  async renameSpeaker(speakerId, displayName) {
    const sel = get().selectedId;
    if (!sel) return;
    try {
      await window.scribe.speakers.rename(sel, speakerId, displayName);
      const detail = await window.scribe.meetings.get(sel);
      set({ detail });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async renameMeeting(id, title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const prevMeetings = get().meetings;
    const prevDetail = get().detail;
    // Optimistic local title flip — broadcast will reconcile.
    set((s) => ({
      meetings: s.meetings.map((m) =>
        m.id === id ? { ...m, title: trimmed } : m,
      ),
      detail:
        s.detail && s.detail.meeting.id === id
          ? { ...s.detail, meeting: { ...s.detail.meeting, title: trimmed } }
          : s.detail,
    }));
    try {
      await window.scribe.meetings.setTitle(id, trimmed);
    } catch (err) {
      set({ meetings: prevMeetings, detail: prevDetail, error: errMsg(err) });
    }
  },

  async setScratchpad(id, text) {
    const prevDetail = get().detail;
    // Optimistic local update. The scratch pad isn't part of the tree, so
    // only the open meeting's detail needs patching; the main side skips the
    // broadcast since saves fire on every (debounced) keystroke.
    set((s) => ({
      detail:
        s.detail && s.detail.meeting.id === id
          ? { ...s.detail, meeting: { ...s.detail.meeting, scratchpad: text } }
          : s.detail,
    }));
    try {
      await window.scribe.meetings.setScratchpad(id, text);
    } catch (err) {
      set({ detail: prevDetail, error: errMsg(err) });
    }
  },

  async deleteMeeting(id) {
    // Optimistic: drop the row locally so the tree updates instantly. The
    // tree-invalidated broadcast from main will reconcile if the delete
    // succeeds; on failure we restore and surface the error.
    const prevMeetings = get().meetings;
    const wasSelected = get().selectedId === id;
    set({ meetings: prevMeetings.filter((m) => m.id !== id) });
    if (wasSelected) {
      const nextId = get().meetings[0]?.id ?? null;
      void get().selectMeeting(nextId);
    }
    try {
      await window.scribe.meetings.delete(id);
    } catch (err) {
      set({ meetings: prevMeetings, error: errMsg(err) });
    }
  },

  async setPinned(id, pinned) {
    // Optimistic: flip the bit locally. Tree-invalidated broadcast will
    // confirm with the canonical order.
    const prev = get().meetings;
    set({
      meetings: prev.map((m) =>
        m.id === id ? { ...m, pinned: pinned ? 1 : 0 } : m,
      ),
    });
    try {
      await window.scribe.meetings.setPinned(id, pinned);
    } catch (err) {
      set({ meetings: prev, error: errMsg(err) });
    }
  },

  async createFolder(parentId, name = "New folder") {
    try {
      const folder = await window.scribe.folders.create({ parentId, name });
      const next = new Set(get().expandedFolderIds);
      if (parentId) next.add(parentId);
      next.add(folder.id);
      saveExpanded(next);
      set({ expandedFolderIds: next });
      await get().loadTree();
      return folder;
    } catch (err) {
      set({ error: errMsg(err) });
      return null;
    }
  },

  async renameFolder(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const prev = get().folders;
    set({
      folders: prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)),
    });
    try {
      await window.scribe.folders.rename(id, trimmed);
    } catch (err) {
      set({ folders: prev, error: errMsg(err) });
    }
  },

  async setFolderAutoTag(folderId, tagId) {
    // Optimistic: flip the folder's auto_tag_id locally so the indicator
    // updates immediately. Broadcast reconciles when the IPC returns.
    const prev = get().folders;
    set({
      folders: prev.map((f) =>
        f.id === folderId ? { ...f, auto_tag_id: tagId } : f,
      ),
    });
    try {
      await window.scribe.folders.setAutoTag(folderId, tagId);
    } catch (err) {
      set({ folders: prev, error: errMsg(err) });
    }
  },

  async deleteFolder(id) {
    const prevFolders = get().folders;
    const prevExpanded = get().expandedFolderIds;
    const next = new Set(prevExpanded);
    next.delete(id);
    saveExpanded(next);
    // Optimistic: drop the folder + any children whose parent_id === id.
    // The main process actually promotes children up to grandparent — the
    // broadcast will reconcile shortly after.
    const idsToHide = new Set<string>([id]);
    for (const f of prevFolders) {
      if (f.parent_id && idsToHide.has(f.parent_id)) idsToHide.add(f.id);
    }
    set({
      expandedFolderIds: next,
      folders: prevFolders.filter((f) => !idsToHide.has(f.id)),
    });
    try {
      await window.scribe.folders.delete(id);
    } catch (err) {
      saveExpanded(prevExpanded);
      set({
        folders: prevFolders,
        expandedFolderIds: prevExpanded,
        error: errMsg(err),
      });
    }
  },

  async moveItem(target) {
    try {
      await window.scribe.tree.move(target);
      await get().loadTree();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  toggleExpand(folderId) {
    const next = new Set(get().expandedFolderIds);
    if (next.has(folderId)) next.delete(folderId);
    else next.add(folderId);
    saveExpanded(next);
    set({ expandedFolderIds: next });
  },

  setExpanded(folderId, expanded) {
    const next = new Set(get().expandedFolderIds);
    if (expanded) next.add(folderId);
    else next.delete(folderId);
    saveExpanded(next);
    set({ expandedFolderIds: next });
  },

  // Live width update — NO localStorage write. Called many times per frame
  // during a resize drag; persisting on every move would block the main
  // thread (~5-10ms per write) and make the drag feel laggy. Pair with
  // persistSidebarWidth() on mouseup.
  setSidebarWidth(px) {
    const width = clampWidth(px);
    if (width === get().sidebarWidth) return;
    set({ sidebarWidth: width });
  },

  persistSidebarWidth() {
    saveSidebarWidth(get().sidebarWidth);
  },

  hydrateSidebar() {
    if (get().sidebarHydrated) return;
    set({
      sidebarWidth: loadSidebarWidth(),
      sidebarHydrated: true,
      displayLanguage: loadDisplayLanguage(),
      tagsCollapsed: loadTagsCollapsed(),
      micDeviceId: loadMicDeviceId(),
    });
    // Best-effort: reconcile with the main process. If it has a different
    // value (e.g. user switched between dev and prod profiles), prefer that
    // so the two stay in sync.
    if (typeof window !== "undefined" && window.scribe?.settings) {
      void window.scribe.settings
        .getDisplayLanguage()
        .then((lang) => {
          if (
            VALID_DISPLAY_LANGUAGES.has(lang) &&
            lang !== get().displayLanguage
          ) {
            set({ displayLanguage: lang });
            saveDisplayLanguage(lang);
          }
        })
        .catch(() => {
          /* ignore */
        });
    }
  },

  async setDisplayLanguage(lang) {
    if (!VALID_DISPLAY_LANGUAGES.has(lang)) return;
    if (get().displayLanguage === lang) return;
    set({ displayLanguage: lang });
    saveDisplayLanguage(lang);
    try {
      await window.scribe.settings.setDisplayLanguage(lang);
    } catch {
      /* main process persistence is best-effort; localStorage is authoritative */
    }
  },

  setMicDevice(deviceId) {
    if (get().micDeviceId === deviceId) return;
    set({ micDeviceId: deviceId });
    saveMicDeviceId(deviceId);
    // Live-swap if a recording is in flight; otherwise the value is picked up
    // by the next startCapture call.
    captureHandle?.setMicDevice(deviceId ?? undefined).catch((err) => {
      set({ error: errMsg(err) });
    });
  },

  clearError() {
    set({ error: null });
  },

  reportError(message: string) {
    set({ error: message });
  },

  // --- Section nav ----------------------------------------------------------

  setActiveSection(section) {
    const cur = get().activeSection;
    if (cur === section) return;
    // Remember the previous section when opening Settings, so the close
    // button (and Esc) can return there.
    if (section === "settings" && cur !== "settings") {
      set({ activeSection: section, previousSection: cur });
    } else {
      set({ activeSection: section });
    }
    if (section === "tasks") {
      void get().loadAllMeetingTasks();
      void get().loadPersonalTasks();
    } else if (section === "calendar") {
      void get().loadCalendarAccounts();
    }
  },

  setMeetingTab(t) {
    if (get().meetingTab === t) return;
    set({ meetingTab: t });
  },

  // --- Search ---------------------------------------------------------------

  setSearchQuery(q) {
    set({ searchQuery: q });
  },

  async runSearch(q) {
    const trimmed = q.trim();
    if (!trimmed) {
      set({ searchResults: [], searching: false });
      return;
    }
    const seq = ++searchSeq;
    set({ searching: true });
    try {
      const results = await window.scribe.search.meetings(trimmed);
      if (seq !== searchSeq) return; // stale
      set({ searchResults: results, searching: false });
    } catch (err) {
      if (seq !== searchSeq) return;
      set({ searching: false, error: errMsg(err) });
    }
  },

  clearSearch() {
    searchSeq++;
    set({ searchQuery: "", searchResults: [], searching: false });
  },

  openPalette() {
    if (get().paletteOpen) return;
    set({ paletteOpen: true });
  },

  closePalette() {
    if (!get().paletteOpen) return;
    // Wipe any in-flight search so the next open starts clean.
    searchSeq++;
    set({
      paletteOpen: false,
      searchQuery: "",
      searchResults: [],
      searching: false,
    });
  },

  togglePalette() {
    if (get().paletteOpen) get().closePalette();
    else get().openPalette();
  },

  openFind() {
    // Always bump the tick so a Cmd+F while the bar is already open refocuses
    // its input (handy when the user's focus wandered to a transcript line).
    set((s) => ({ findOpen: true, findFocusTick: s.findFocusTick + 1 }));
  },

  closeFind() {
    if (!get().findOpen) return;
    set({ findOpen: false });
    // Clear native highlights when the user dismisses the bar. The renderer
    // can no-op safely if the IPC isn't reachable (mini windows, SSR).
    try {
      void window.scribe.find?.stop("clearSelection");
    } catch {
      /* ignore */
    }
  },

  async refreshActiveView() {
    if (get().refreshing) return;
    set({ refreshing: true });
    const section = get().activeSection;
    const selectedId = get().selectedId;
    try {
      // Tree + tags are cheap and underpin every section's chrome (sidebar,
      // tag filters, breadcrumbs), so refresh them on every call.
      const jobs: Array<Promise<unknown>> = [get().loadTree(), get().loadTags()];
      if (section === "meetings" && selectedId) {
        jobs.push(get().selectMeeting(selectedId));
      }
      if (section === "tasks") {
        jobs.push(get().loadPersonalTasks(), get().loadAllMeetingTasks());
      }
      if (section === "calendar") {
        jobs.push(
          get().loadCalendarAccounts(),
          get().refreshActiveCalendarEvent(),
        );
      }
      // people-view, calendar-view's date-range loader, and any other
      // self-fetching child observe refreshTick to re-pull their own state.
      await Promise.allSettled(jobs);
    } finally {
      // Bump tick + clear flag together so subscribers see one transition.
      set((s) => ({ refreshTick: s.refreshTick + 1, refreshing: false }));
    }
  },

  // --- Tags -----------------------------------------------------------------

  async loadTags() {
    try {
      const [all, pairs] = await Promise.all([
        window.scribe.tags.listAll(),
        window.scribe.tags.listMeetingPairs(),
      ]);
      set({ allTags: all, meetingTagPairs: pairs });
    } catch {
      /* non-fatal */
    }
  },

  async loadTagsForSelected() {
    const id = get().selectedId;
    if (!id) return;
    try {
      const tags = await window.scribe.tags.listForMeeting(id);
      set((s) => ({
        meetingTagsById: { ...s.meetingTagsById, [id]: tags },
      }));
    } catch {
      /* non-fatal */
    }
  },

  async attachTag(meetingId, name) {
    // attach() returns the canonical row; one round-trip then reconcile local
    // caches with the returned tag (instead of two extra IPCs).
    try {
      const tag = await window.scribe.tags.attach(meetingId, name);
      set((s) => {
        const exists = s.allTags.some((t) => t.id === tag.id);
        const allTags = exists
          ? s.allTags.map((t) => (t.id === tag.id ? tag : t))
          : [...s.allTags, tag];
        const alreadyPaired = s.meetingTagPairs.some(
          (p) => p.meeting_id === meetingId && p.tag_id === tag.id,
        );
        const meetingTagPairs = alreadyPaired
          ? s.meetingTagPairs
          : [...s.meetingTagPairs, { meeting_id: meetingId, tag_id: tag.id }];
        const prevList = s.meetingTagsById[meetingId] ?? [];
        const nextList = prevList.some((t) => t.id === tag.id)
          ? prevList.map((t) => (t.id === tag.id ? tag : t))
          : [...prevList, tag];
        return {
          allTags,
          meetingTagPairs,
          meetingTagsById: { ...s.meetingTagsById, [meetingId]: nextList },
        };
      });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async detachTag(meetingId, tagId) {
    const prev = {
      pairs: get().meetingTagPairs,
      byId: get().meetingTagsById,
    };
    set((s) => ({
      meetingTagPairs: s.meetingTagPairs.filter(
        (p) => !(p.meeting_id === meetingId && p.tag_id === tagId),
      ),
      meetingTagsById: {
        ...s.meetingTagsById,
        [meetingId]: (s.meetingTagsById[meetingId] ?? []).filter(
          (t) => t.id !== tagId,
        ),
      },
    }));
    try {
      await window.scribe.tags.detach(meetingId, tagId);
    } catch (err) {
      set({
        meetingTagPairs: prev.pairs,
        meetingTagsById: prev.byId,
        error: errMsg(err),
      });
    }
  },

  async deleteTag(tagId) {
    try {
      await window.scribe.tags.delete(tagId);
      set((s) => {
        const nextById: typeof s.meetingTagsById = {};
        for (const [mid, tags] of Object.entries(s.meetingTagsById)) {
          nextById[mid] = tags.filter((t) => t.id !== tagId);
        }
        return {
          allTags: s.allTags.filter((t) => t.id !== tagId),
          meetingTagPairs: s.meetingTagPairs.filter((p) => p.tag_id !== tagId),
          meetingTagsById: nextById,
          activeTagId: s.activeTagId === tagId ? null : s.activeTagId,
        };
      });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  setActiveTag(tagId) {
    set({ activeTagId: tagId });
  },

  setTagsCollapsed(collapsed) {
    if (get().tagsCollapsed === collapsed) return;
    set({ tagsCollapsed: collapsed });
    saveTagsCollapsed(collapsed);
  },

  // --- Personal + aggregated tasks ----------------------------------------

  async loadPersonalTasks() {
    try {
      const rows = await window.scribe.personalTasks.list();
      set({ personalTasks: rows });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async createPersonalTask(text, dueAtMs) {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await window.scribe.personalTasks.create({ text: trimmed, dueAtMs });
      await get().loadPersonalTasks();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async setPersonalTaskDone(id, done) {
    const prev = get().personalTasks;
    set({
      personalTasks: prev.map((t) =>
        t.id === id ? { ...t, done: done ? 1 : 0 } : t,
      ),
    });
    try {
      await window.scribe.personalTasks.setDone(id, done);
    } catch (err) {
      set({ personalTasks: prev, error: errMsg(err) });
    }
  },

  async deletePersonalTask(id) {
    try {
      await window.scribe.personalTasks.delete(id);
      await get().loadPersonalTasks();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async loadAllMeetingTasks() {
    try {
      const rows = await window.scribe.tasks.listAll();
      set({ allMeetingTasks: rows });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async setMeetingTaskDone(taskId, done) {
    const prevDetail = get().detail;
    const prevAggregate = get().allMeetingTasks;
    // Optimistic: flip done in both the open meeting detail and the global
    // aggregated tasks list. Avoids the prior two-IPC refetch waterfall.
    set((s) => ({
      detail: s.detail
        ? {
            ...s.detail,
            tasks: s.detail.tasks.map((t) =>
              t.id === taskId ? { ...t, done: done ? 1 : 0 } : t,
            ),
          }
        : s.detail,
      allMeetingTasks: s.allMeetingTasks.map((t) =>
        t.id === taskId ? { ...t, done: done ? 1 : 0 } : t,
      ),
    }));
    try {
      await window.scribe.tasks.setDone(taskId, done);
    } catch (err) {
      set({
        detail: prevDetail,
        allMeetingTasks: prevAggregate,
        error: errMsg(err),
      });
    }
  },

  async addMeetingTask(meetingId, text) {
    try {
      const row = await window.scribe.tasks.add(meetingId, text, null);
      set((s) => ({
        detail:
          s.detail && s.detail.meeting.id === meetingId
            ? { ...s.detail, tasks: [...s.detail.tasks, row] }
            : s.detail,
      }));
      // Aggregated fields (meeting title, resolved assignee) are derived
      // server-side, so refetch the global list rather than reconstruct it.
      void get().loadAllMeetingTasks();
      return row;
    } catch (err) {
      set({ error: errMsg(err) });
      return null;
    }
  },

  async duplicateMeetingTask(taskId) {
    try {
      const row = await window.scribe.tasks.duplicate(taskId);
      if (row) {
        set((s) => ({
          detail: s.detail
            ? { ...s.detail, tasks: [...s.detail.tasks, row] }
            : s.detail,
        }));
        void get().loadAllMeetingTasks();
      }
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async deleteMeetingTask(taskId) {
    const prevDetail = get().detail;
    const prevAggregate = get().allMeetingTasks;
    set((s) => ({
      detail: s.detail
        ? { ...s.detail, tasks: s.detail.tasks.filter((t) => t.id !== taskId) }
        : s.detail,
      allMeetingTasks: s.allMeetingTasks.filter((t) => t.id !== taskId),
    }));
    try {
      await window.scribe.tasks.delete(taskId);
    } catch (err) {
      set({
        detail: prevDetail,
        allMeetingTasks: prevAggregate,
        error: errMsg(err),
      });
    }
  },

  async setMeetingTaskPriority(taskId, priority) {
    const prevDetail = get().detail;
    const prevAggregate = get().allMeetingTasks;
    set((s) => ({
      detail: s.detail
        ? {
            ...s.detail,
            tasks: s.detail.tasks.map((t) =>
              t.id === taskId ? { ...t, priority } : t,
            ),
          }
        : s.detail,
      allMeetingTasks: s.allMeetingTasks.map((t) =>
        t.id === taskId ? { ...t, priority } : t,
      ),
    }));
    try {
      await window.scribe.tasks.setPriority(taskId, priority);
    } catch (err) {
      set({
        detail: prevDetail,
        allMeetingTasks: prevAggregate,
        error: errMsg(err),
      });
    }
  },

  async setMeetingTaskDueDate(taskId, dueAtMs) {
    const prevDetail = get().detail;
    const prevAggregate = get().allMeetingTasks;
    set((s) => ({
      detail: s.detail
        ? {
            ...s.detail,
            tasks: s.detail.tasks.map((t) =>
              t.id === taskId ? { ...t, due_at_ms: dueAtMs } : t,
            ),
          }
        : s.detail,
      allMeetingTasks: s.allMeetingTasks.map((t) =>
        t.id === taskId ? { ...t, due_at_ms: dueAtMs } : t,
      ),
    }));
    try {
      await window.scribe.tasks.setDueDate(taskId, dueAtMs);
    } catch (err) {
      set({
        detail: prevDetail,
        allMeetingTasks: prevAggregate,
        error: errMsg(err),
      });
    }
  },

  async setMeetingTaskAssignee(taskId, speakerId) {
    const prevDetail = get().detail;
    set((s) => ({
      detail: s.detail
        ? {
            ...s.detail,
            tasks: s.detail.tasks.map((t) =>
              t.id === taskId ? { ...t, assignee_speaker_id: speakerId } : t,
            ),
          }
        : s.detail,
    }));
    try {
      await window.scribe.tasks.setAssignee(taskId, speakerId);
      // Resolved assignee name/library_id live server-side; refetch the global
      // list so its rows stay accurate.
      void get().loadAllMeetingTasks();
    } catch (err) {
      set({ detail: prevDetail, error: errMsg(err) });
    }
  },

  async updateMeetingTaskText(taskId, text) {
    const prevDetail = get().detail;
    const prevAggregate = get().allMeetingTasks;
    set((s) => ({
      detail: s.detail
        ? {
            ...s.detail,
            tasks: s.detail.tasks.map((t) =>
              t.id === taskId ? { ...t, text } : t,
            ),
          }
        : s.detail,
      allMeetingTasks: s.allMeetingTasks.map((t) =>
        t.id === taskId ? { ...t, text } : t,
      ),
    }));
    try {
      await window.scribe.tasks.updateText(taskId, text);
    } catch (err) {
      set({
        detail: prevDetail,
        allMeetingTasks: prevAggregate,
        error: errMsg(err),
      });
    }
  },

  // --- Calendar -------------------------------------------------------------

  async loadCalendarAccounts() {
    try {
      const accounts = await window.scribe.calendar.listAccounts();
      set({ calendarAccounts: accounts });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async connectGoogleCalendar() {
    try {
      await window.scribe.calendar.connectGoogle();
      await get().loadCalendarAccounts();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async disconnectCalendar(id) {
    try {
      await window.scribe.calendar.disconnect(id);
      await get().loadCalendarAccounts();
      set({ calendarEvents: [] });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async loadCalendarEvents(fromMs, toMs) {
    try {
      const events = await window.scribe.calendar.listEvents(fromMs, toMs);
      set({ calendarEvents: events });
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async syncCalendar(accountId, fromMs, toMs) {
    try {
      await window.scribe.calendar.sync(accountId, fromMs, toMs);
      await get().loadCalendarEvents(fromMs, toMs);
      // New events may unlock auto-links for older recordings.
      await get().loadLinkedMeetingIds();
      await get().refreshActiveCalendarEvent();
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async resyncCalendars(fromMs, toMs) {
    if (get().calendarSyncing) return;
    const accounts = get().calendarAccounts;
    if (accounts.length === 0) return;
    set({ calendarSyncing: true });
    try {
      // allSettled — one account failing (e.g. revoked token) shouldn't
      // block the others. Per-account errors surface through the per-call
      // error path (window.scribe.calendar.sync throws → caught by syncCalendar).
      await Promise.allSettled(
        accounts.map((a) => window.scribe.calendar.sync(a.id, fromMs, toMs)),
      );
      await get().loadCalendarEvents(fromMs, toMs);
      await get().loadLinkedMeetingIds();
      await get().refreshActiveCalendarEvent();
    } catch (err) {
      set({ error: errMsg(err) });
    } finally {
      set({ calendarSyncing: false });
    }
  },

  async refreshActiveCalendarEvent() {
    try {
      const ev = await window.scribe.calendar.activeNow();
      set({ activeCalendarEvent: ev });
    } catch {
      set({ activeCalendarEvent: null });
    }
  },

  async loadLinkedMeetingIds() {
    try {
      const ids = await window.scribe.calendar.linkedMeetingIds();
      set({ linkedMeetingIds: new Set(ids) });
    } catch {
      /* ignore */
    }
  },

  async linkMeetingToEvent(meetingId, eventId) {
    try {
      await window.scribe.calendar.linkEvent(eventId, meetingId);
      await get().loadLinkedMeetingIds();
      if (get().selectedId === meetingId) {
        const detail = await window.scribe.meetings.get(meetingId);
        set({ detail });
      }
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async unlinkMeetingFromEvent(meetingId) {
    try {
      await window.scribe.calendar.unlinkMeeting(meetingId);
      await get().loadLinkedMeetingIds();
      if (get().selectedId === meetingId) {
        const detail = await window.scribe.meetings.get(meetingId);
        set({ detail });
      }
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  async autoLinkMeeting(meetingId, renameIfAuto = true) {
    try {
      await window.scribe.calendar.autoLink(meetingId, renameIfAuto);
      await get().loadLinkedMeetingIds();
      if (get().selectedId === meetingId) {
        const detail = await window.scribe.meetings.get(meetingId);
        set({ detail });
      }
    } catch (err) {
      set({ error: errMsg(err) });
    }
  },

  dismissAutoLinkToast() {
    set({ autoLinkToast: null });
  },

  dismissSystemAudioNotice() {
    set({ systemAudioNotice: false });
  },

  openScreenRecordingSettings() {
    void window.scribe.audio.openScreenSettings();
  },

  setVoiceTaggingPanelOpen(open) {
    set({ voiceTaggingPanelOpen: open });
  },

  setVoiceTaggingPanelMode(mode) {
    set({ voiceTaggingPanelMode: mode });
  },

  openSpeakerPrompt(meetingId, flow, initialCount) {
    set({
      speakerPrompt: {
        open: true,
        meetingId,
        flow,
        // Prefill with the caller-provided hint (typically detail.speakers.length
        // for re-runs); blank string when 0 / undefined so the input renders empty.
        count: initialCount && initialCount > 0 ? String(initialCount) : "",
      },
    });
  },

  setSpeakerPromptCount(count) {
    set((s) => ({ speakerPrompt: { ...s.speakerPrompt, count } }));
  },

  closeSpeakerPrompt() {
    set({
      speakerPrompt: {
        open: false,
        meetingId: null,
        flow: null,
        count: "",
      },
    });
  },

  openModelPrompt(meetingId, intent) {
    set({ modelPrompt: { open: true, meetingId, intent } });
  },

  closeModelPrompt() {
    set({ modelPrompt: { open: false, meetingId: null, intent: null } });
  },

  confirmModelPrompt(model) {
    const { modelPrompt } = get();
    if (!modelPrompt.open || !modelPrompt.meetingId || !modelPrompt.intent) {
      return;
    }
    const meetingId = modelPrompt.meetingId;
    const intent = modelPrompt.intent;
    // Close first so the dialog dismisses immediately — the underlying
    // action then dispatches into the processing state (which has its own
    // UI). Avoids the dialog hanging open while the agent loop runs.
    set({ modelPrompt: { open: false, meetingId: null, intent: null } });
    if (intent.kind === "generate") {
      // Persist the template choice when the caller pre-picked one (matches
      // the existing persistAndRun flow). No-op when templateId is absent.
      void (async () => {
        if (intent.templateId) {
          await window.scribe.templates.setMeetingTemplate(
            meetingId,
            intent.templateId,
          );
        }
        await get().generate(meetingId, model);
      })();
    } else {
      void (async () => {
        if (intent.templateId) {
          await window.scribe.templates.setMeetingTemplate(
            meetingId,
            intent.templateId,
          );
        }
        await get().processMeeting(meetingId, intent.numSpeakers, model);
      })();
    }
  },

  async requestGeneration(meetingId, intent) {
    // Only the claude-code provider has the "ask each time" sentinel;
    // every other provider runs immediately with whatever model the user
    // configured.
    try {
      const cfg = await window.scribe.llm.getProviderConfig();
      if (
        cfg.provider === "claude-code" &&
        cfg.claude_code_model === "ask"
      ) {
        get().openModelPrompt(meetingId, intent);
        return true;
      }
    } catch {
      // Fall through — better to attempt the action than to silently block
      // generation when the config fetch fails.
    }
    return false;
  },
}));

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function speakerHue(speakerId: string): number {
  let hash = 0;
  for (let i = 0; i < speakerId.length; i++) {
    hash = (hash * 31 + speakerId.charCodeAt(i)) | 0;
  }
  // Avalanche the bits. Without this, seeds that differ by a single character
  // — e.g. the raw diarization labels "SPEAKER_00", "SPEAKER_01", … — hash to
  // near-consecutive values and all map to roughly the same hue (the
  // "everyone's avatar is green" bug). Mixing scatters adjacent seeds across
  // the whole wheel while keeping a given seed's color stable.
  hash = Math.imul(hash ^ (hash >>> 15), 0x45d9f3b);
  hash = hash ^ (hash >>> 13);
  return Math.abs(hash) % 360;
}
