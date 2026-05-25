"use client";

import { create } from "zustand";
import type {
  AggregatedTaskRow,
  CalendarAccountPublic,
  CalendarEventRow,
  FolderRow,
  MeetingDetail,
  MeetingResult,
  MeetingRow,
  MeetingSearchHit,
  MoveTarget,
  PersonalTaskRow,
  RecordingStateSnapshot,
  TagRow,
  VoicePostProcessSummary,
} from "@/lib/scribe-global";
import { startCapture, type CaptureHandle } from "@/lib/audio-capture";

export type RecordingState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; meetingId: string; startedAt: number }
  | { kind: "stopping" };

export type ProcessingFlow = "transcribe-only" | "generate-only" | "full";
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
    };

export type SidebarSection =
  | "meetings"
  | "tasks"
  | "calendar"
  | "people"
  | "settings";
export type MeetingTab = "summary" | "transcript" | "tasks";

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

interface ScribeState {
  folders: FolderRow[];
  meetings: MeetingRow[];
  selectedId: string | null;
  detail: MeetingDetail | null;
  recording: RecordingState;
  processing: ProcessingState;
  levels: { mic: number; system: number };
  error: string | null;
  expandedFolderIds: Set<string>;

  sidebarWidth: number;
  sidebarHydrated: boolean;

  // New: section nav (meetings tree / tasks / calendar)
  activeSection: SidebarSection;
  meetingTab: MeetingTab;

  // New: search
  searchQuery: string;
  searchResults: MeetingSearchHit[];
  searching: boolean;

  // New: tags
  meetingTagsById: Record<string, TagRow[]>;
  meetingTagPairs: Array<{ meeting_id: string; tag_id: string }>;
  allTags: TagRow[];
  activeTagId: string | null;

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

  init: () => Promise<void>;
  loadTree: () => Promise<void>;
  selectMeeting: (id: string | null) => Promise<void>;
  startRecording: (opts?: { folderId?: string | null }) => Promise<void>;
  stopRecording: () => Promise<void>;
  startRecordingForEvent: (eventId: string) => Promise<void>;
  transcribe: (meetingId: string) => Promise<void>;
  generate: (meetingId: string) => Promise<void>;
  processMeeting: (meetingId: string) => Promise<void>;
  renameSpeaker: (speakerId: string, displayName: string) => Promise<void>;
  renameMeeting: (id: string, title: string) => Promise<void>;
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
  clearError: () => void;

  // New actions
  setActiveSection: (s: SidebarSection) => void;
  setMeetingTab: (t: MeetingTab) => void;
  setSearchQuery: (q: string) => void;
  runSearch: (q: string) => Promise<void>;
  clearSearch: () => void;

  loadTags: () => Promise<void>;
  loadTagsForSelected: () => Promise<void>;
  attachTag: (meetingId: string, name: string) => Promise<void>;
  detachTag: (meetingId: string, tagId: string) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
  setActiveTag: (tagId: string | null) => void;

  loadPersonalTasks: () => Promise<void>;
  createPersonalTask: (text: string, dueAtMs: number | null) => Promise<void>;
  setPersonalTaskDone: (id: number, done: boolean) => Promise<void>;
  deletePersonalTask: (id: number) => Promise<void>;
  loadAllMeetingTasks: () => Promise<void>;
  setMeetingTaskDone: (taskId: number, done: boolean) => Promise<void>;

  loadCalendarAccounts: () => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  disconnectCalendar: (id: string) => Promise<void>;
  loadCalendarEvents: (fromMs: number, toMs: number) => Promise<void>;
  syncCalendar: (
    accountId: string,
    fromMs: number,
    toMs: number,
  ) => Promise<void>;

  refreshActiveCalendarEvent: () => Promise<void>;
  loadLinkedMeetingIds: () => Promise<void>;
  linkMeetingToEvent: (meetingId: string, eventId: string) => Promise<void>;
  unlinkMeetingFromEvent: (meetingId: string) => Promise<void>;
  autoLinkMeeting: (meetingId: string, renameIfAuto?: boolean) => Promise<void>;

  dismissAutoLinkToast: () => void;
  setVoiceTaggingPanelOpen: (open: boolean) => void;
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
  error: null,
  expandedFolderIds: loadExpanded(),
  // SSR-safe default; replaced post-mount by `hydrateSidebar()` to avoid a
  // hydration mismatch when the persisted width differs from this default.
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  sidebarHydrated: false,

  activeSection: "meetings",
  meetingTab: "transcript",
  searchQuery: "",
  searchResults: [],
  searching: false,
  meetingTagsById: {},
  meetingTagPairs: [],
  allTags: [],
  activeTagId: null,
  personalTasks: [],
  allMeetingTasks: [],
  calendarAccounts: [],
  calendarEvents: [],
  activeCalendarEvent: null,
  linkedMeetingIds: new Set(),
  autoLinkToast: null,
  voiceTaggingPanelOpen: false,

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
          return {
            processing: {
              ...s.processing,
              stage: p.stage,
              pct: p.pct,
              note: p.note,
              model: p.model ?? s.processing.model,
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
          return {
            processing: {
              ...s.processing,
              stage: p.stage,
              pct: p.pct,
              note: p.note,
              model: p.model ?? s.processing.model,
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
      set({ selectedId: null, detail: null, voiceTaggingPanelOpen: false });
      return;
    }
    // Picking a meeting always swaps the main view back to the meeting
    // detail — replaces the dropped "Meetings" sidebar nav button. Reset the
    // voice-tagging panel so switching meetings doesn't leave a stale open
    // state pointing at the previous meeting.
    set({
      selectedId: id,
      activeSection: "meetings",
      voiceTaggingPanelOpen: false,
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
    set({ recording: { kind: "starting" }, error: null });
    try {
      const { meetingId } = await window.scribe.audio.startMeeting();
      if (opts?.folderId) {
        await window.scribe.tree.move({
          itemId: meetingId,
          kind: "meeting",
          newParentId: opts.folderId,
        });
      }
      const handle = await startCapture({
        meetingId,
        onError: (e) => set({ error: e.message }),
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

  async transcribe(meetingId) {
    set({
      processing: {
        kind: "processing",
        meetingId,
        flow: "transcribe-only",
        phase: "transcribe",
        stage: "starting",
        pct: 0,
      },
      error: null,
    });
    try {
      await window.scribe.transcribe.run(meetingId);
      await get().loadTree();
      const detail = await window.scribe.meetings.get(meetingId);
      set({ detail, processing: { kind: "idle" } });
    } catch (err) {
      set({ processing: { kind: "idle" }, error: errMsg(err) });
    }
  },

  async generate(meetingId) {
    set({
      processing: {
        kind: "processing",
        meetingId,
        flow: "generate-only",
        phase: "generate",
        stage: "starting",
        pct: 0,
      },
      error: null,
    });
    try {
      await window.scribe.llm.generate(meetingId);
      await get().loadTree();
      const detail = await window.scribe.meetings.get(meetingId);
      set({ detail, processing: { kind: "idle" } });
    } catch (err) {
      set({ processing: { kind: "idle" }, error: errMsg(err) });
    }
  },

  async processMeeting(meetingId) {
    set({
      processing: {
        kind: "processing",
        meetingId,
        flow: "full",
        phase: "transcribe",
        stage: "starting",
        pct: 0,
      },
      error: null,
    });
    try {
      await window.scribe.transcribe.run(meetingId);
      // Refresh detail to surface the transcript before LLM kicks in.
      try {
        const interim = await window.scribe.meetings.get(meetingId);
        if (interim && get().selectedId === meetingId) set({ detail: interim });
      } catch {
        /* ignore */
      }
      set((s) => {
        if (s.processing.kind !== "processing" || s.processing.meetingId !== meetingId)
          return s;
        return {
          processing: {
            ...s.processing,
            phase: "generate",
            stage: "starting",
            pct: 0,
            note: undefined,
            model: undefined,
          },
        };
      });
      await window.scribe.llm.generate(meetingId);
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
    set({ sidebarWidth: loadSidebarWidth(), sidebarHydrated: true });
  },

  clearError() {
    set({ error: null });
  },

  // --- Section nav ----------------------------------------------------------

  setActiveSection(section) {
    if (get().activeSection === section) return;
    set({ activeSection: section });
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

  setVoiceTaggingPanelOpen(open) {
    set({ voiceTaggingPanelOpen: open });
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
  return Math.abs(hash) % 360;
}
