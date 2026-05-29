import { contextBridge, ipcRenderer } from "electron";

type AudioChannel = "mic" | "system";

type ScreenAccessStatus =
  | "not-determined"
  | "granted"
  | "denied"
  | "restricted"
  | "unknown";

type DisplayLanguage = "en" | "fr" | "es" | "de";
type AiLanguage = "auto" | "en" | "fr" | "es" | "de";

type MeetingStatus =
  | "recording"
  | "recorded"
  | "transcribing"
  | "transcribed"
  | "diarized"
  | "done"
  | "error";

interface MeetingRow {
  id: string;
  title: string;
  started_at_ms: number;
  ended_at_ms: number | null;
  mic_wav_path: string | null;
  sys_wav_path: string | null;
  status: MeetingStatus;
  duration_ms: number | null;
  summary_json: string | null;
  folder_id: string | null;
  position: number;
  pinned: 0 | 1;
  pipeline_json: string | null;
  notes_template_id: string | null;
  bullets_json: string | null;
  scratchpad: string | null;
}

interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  position: number;
  created_at_ms: number;
  auto_tag_id: string | null;
}

interface TreeSnapshot {
  folders: FolderRow[];
  meetings: MeetingRow[];
}

type TreeItemKind = "folder" | "meeting";

interface MoveTarget {
  itemId: string;
  kind: TreeItemKind;
  newParentId: string | null;
  newPosition?: number;
}

interface TranscriptRow {
  meeting_id: string;
  segment_idx: number;
  start_ms: number;
  end_ms: number;
  speaker_id: string | null;
  text: string;
}

interface SpeakerRow {
  meeting_id: string;
  speaker_id: string;
  display_name: string;
  sample_clip_path: string | null;
  voice_library_id: string | null;
  match_confidence: number | null;
  needs_review: 0 | 1;
}

interface VoiceLibraryRow {
  id: string;
  display_name: string;
  email: string | null;
  is_me: 0 | 1;
  dim: number;
  sample_clip_path: string | null;
  n_meetings: number;
  created_at_ms: number;
  updated_at_ms: number;
}

interface VoiceLibraryPerson extends VoiceLibraryRow {
  last_heard_ms: number | null;
  last_meeting_id: string | null;
  last_meeting_title: string | null;
}

interface VoicePostProcessSummary {
  meetingId: string;
  autoLinked: Array<{
    speakerId: string;
    displayName: string;
    confidence: number;
  }>;
  needsReviewCount: number;
  totalSpeakers: number;
}

interface PendingReviewSpeaker {
  meeting_id: string;
  speaker_id: string;
  display_name: string;
  sample_clip_path: string | null;
  match_confidence: number | null;
  voice_library_id: string | null;
  email: string | null;
  candidates: Array<{
    library_id: string;
    display_name: string;
    similarity: number;
  }>;
}

interface TaskRow {
  id: number;
  meeting_id: string;
  assignee_speaker_id: string | null;
  text: string;
  done: 0 | 1;
  created_at_ms: number;
}

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  auto: 0 | 1;
  created_at_ms: number;
}

interface PersonalTaskRow {
  id: number;
  text: string;
  done: 0 | 1;
  due_at_ms: number | null;
  created_at_ms: number;
}

interface AggregatedTaskRow extends TaskRow {
  meeting_title: string;
  meeting_started_at_ms: number;
  assignee_name: string | null;
}

interface MeetingSearchHit {
  meeting_id: string;
  title: string;
  matched_in: "title" | "transcript" | "tag" | "summary";
  snippet: string | null;
}

interface CalendarAccountPublic {
  id: string;
  email: string;
  provider: "google";
  connected_at_ms: number;
}

interface CalendarEventRow {
  id: string;
  account_id: string;
  source_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at_ms: number;
  end_at_ms: number;
  hangout_link: string | null;
  attendees_json: string | null;
  meeting_id: string | null;
  updated_at_ms: number;
}

interface MeetingAttendee {
  email: string;
  name: string;
  responseStatus: string | null;
  self: boolean;
  assignedTo: string | null;
  libraryId: string | null;
}

interface MeetingDetail {
  meeting: MeetingRow;
  transcript: TranscriptRow[];
  speakers: SpeakerRow[];
  tasks: TaskRow[];
}

interface MeetingResult {
  meetingId: string;
  micWavPath: string | null;
  sysWavPath: string | null;
  durationMs: number;
  startedAtMs: number;
  endedAtMs: number;
}

interface RecordingStateSnapshot {
  kind: "idle" | "starting" | "recording" | "stopping";
  meetingId?: string;
  startedAt?: number;
  title?: string;
  levels?: { mic: number; system: number };
}

interface NotificationPayload {
  event: CalendarEventRow;
  minutesUntilStart: number;
}

const scribe = {
  ping: (): Promise<{ ok: boolean; at: number }> =>
    ipcRenderer.invoke("scribe:ping"),

  audio: {
    startMeeting: (): Promise<{ meetingId: string; dir: string }> =>
      ipcRenderer.invoke("audio:startMeeting"),

    stopMeeting: (meetingId: string): Promise<MeetingResult> =>
      ipcRenderer.invoke("audio:stopMeeting", meetingId),

    sendFrames: (
      meetingId: string,
      channel: AudioChannel,
      sampleRate: number,
      samples: ArrayBuffer,
    ): void => {
      ipcRenderer.send("audio:frames", {
        meetingId,
        channel,
        sampleRate,
        samples,
      });
    },

    getScreenAccessStatus: (): Promise<ScreenAccessStatus> =>
      ipcRenderer.invoke("audio:getScreenAccessStatus"),

    openScreenSettings: (): Promise<void> =>
      ipcRenderer.invoke("audio:openScreenSettings"),
  },

  meetings: {
    list: (): Promise<MeetingRow[]> => ipcRenderer.invoke("meetings:list"),
    get: (id: string): Promise<MeetingDetail | null> =>
      ipcRenderer.invoke("meetings:get", id),
    setTitle: (id: string, title: string): Promise<MeetingRow | null> =>
      ipcRenderer.invoke("meetings:setTitle", id, title),
    setStatus: (id: string, status: MeetingStatus): Promise<MeetingRow | null> =>
      ipcRenderer.invoke("meetings:setStatus", id, status),
    setScratchpad: (id: string, text: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("meetings:setScratchpad", id, text),
    delete: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("meetings:delete", id),
    setPinned: (id: string, pinned: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("meetings:setPinned", id, pinned),
  },

  speakers: {
    rename: (
      meetingId: string,
      speakerId: string,
      displayName: string,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("speakers:rename", meetingId, speakerId, displayName),
  },

  voice: {
    listLibrary: (): Promise<VoiceLibraryRow[]> =>
      ipcRenderer.invoke("voice:listLibrary"),
    listPeople: (): Promise<VoiceLibraryPerson[]> =>
      ipcRenderer.invoke("voice:listPeople"),
    onPostProcess: (
      cb: (payload: VoicePostProcessSummary) => void,
    ): (() => void) => {
      const handler = (_: unknown, payload: VoicePostProcessSummary) =>
        cb(payload);
      ipcRenderer.on("voice:postProcess", handler);
      return () => ipcRenderer.removeListener("voice:postProcess", handler);
    },
    onLibraryChanged: (cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on("voice:libraryChanged", handler);
      return () => ipcRenderer.removeListener("voice:libraryChanged", handler);
    },
    renameLibraryEntry: (
      id: string,
      displayName: string,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("voice:renameLibraryEntry", id, displayName),
    deleteLibraryEntry: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("voice:deleteLibraryEntry", id),
    setLibraryEmail: (
      id: string,
      email: string | null,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("voice:setLibraryEmail", id, email),
    setMe: (id: string | null): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("voice:setMe", id),
    pendingReview: (
      meetingId: string,
      includeReviewed?: boolean,
    ): Promise<PendingReviewSpeaker[]> =>
      ipcRenderer.invoke("voice:pendingReview", meetingId, !!includeReviewed),
    assignToLibrary: (
      meetingId: string,
      speakerId: string,
      libraryId: string,
      displayName: string,
      email?: string | null,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke(
        "voice:assignToLibrary",
        meetingId,
        speakerId,
        libraryId,
        displayName,
        email ?? null,
      ),
    createFromSpeaker: (
      meetingId: string,
      speakerId: string,
      displayName: string,
      email?: string | null,
    ): Promise<{ ok: boolean; libraryId: string | null }> =>
      ipcRenderer.invoke(
        "voice:createFromSpeaker",
        meetingId,
        speakerId,
        displayName,
        email ?? null,
      ),
    dismissReview: (
      meetingId: string,
      speakerId: string,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("voice:dismissReview", meetingId, speakerId),
    readSampleClip: (filePath: string): Promise<Uint8Array> =>
      ipcRenderer.invoke("voice:readSampleClip", filePath),
  },

  tasks: {
    list: (meetingId: string): Promise<TaskRow[]> =>
      ipcRenderer.invoke("tasks:list", meetingId),
    setDone: (taskId: number, done: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tasks:setDone", taskId, done),
    listAll: (): Promise<AggregatedTaskRow[]> => ipcRenderer.invoke("tasks:listAll"),
    add: (
      meetingId: string,
      text: string,
      assigneeSpeakerId: string | null,
    ): Promise<TaskRow> =>
      ipcRenderer.invoke("tasks:add", meetingId, text, assigneeSpeakerId),
    duplicate: (taskId: number): Promise<TaskRow | null> =>
      ipcRenderer.invoke("tasks:duplicate", taskId),
    delete: (taskId: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tasks:delete", taskId),
    setPriority: (taskId: number, priority: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tasks:setPriority", taskId, priority),
    setDueDate: (
      taskId: number,
      dueAtMs: number | null,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tasks:setDueDate", taskId, dueAtMs),
    setAssignee: (
      taskId: number,
      speakerId: string | null,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tasks:setAssignee", taskId, speakerId),
    updateText: (taskId: number, text: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tasks:updateText", taskId, text),
  },

  personalTasks: {
    list: (): Promise<PersonalTaskRow[]> =>
      ipcRenderer.invoke("personalTasks:list"),
    create: (opts: { text: string; dueAtMs: number | null }): Promise<PersonalTaskRow> =>
      ipcRenderer.invoke("personalTasks:create", opts),
    setDone: (id: number, done: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("personalTasks:setDone", id, done),
    update: (
      id: number,
      text: string,
      dueAtMs: number | null,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("personalTasks:update", id, text, dueAtMs),
    delete: (id: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("personalTasks:delete", id),
  },

  tags: {
    listAll: (): Promise<TagRow[]> => ipcRenderer.invoke("tags:listAll"),
    listForMeeting: (meetingId: string): Promise<TagRow[]> =>
      ipcRenderer.invoke("tags:listForMeeting", meetingId),
    listMeetingPairs: (): Promise<Array<{ meeting_id: string; tag_id: string }>> =>
      ipcRenderer.invoke("tags:listMeetingPairs"),
    attach: (meetingId: string, name: string): Promise<TagRow> =>
      ipcRenderer.invoke("tags:attach", meetingId, name),
    create: (name: string): Promise<TagRow> =>
      ipcRenderer.invoke("tags:create", name),
    detach: (meetingId: string, tagId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tags:detach", meetingId, tagId),
    rename: (id: string, name: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tags:rename", id, name),
    delete: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tags:delete", id),
  },

  search: {
    meetings: (query: string): Promise<MeetingSearchHit[]> =>
      ipcRenderer.invoke("search:meetings", query),
  },

  calendar: {
    listAccounts: (): Promise<CalendarAccountPublic[]> =>
      ipcRenderer.invoke("calendar:listAccounts"),
    connectGoogle: (): Promise<CalendarAccountPublic> =>
      ipcRenderer.invoke("calendar:connectGoogle"),
    disconnect: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("calendar:disconnect", id),
    sync: (
      accountId: string,
      fromMs: number,
      toMs: number,
    ): Promise<{ count: number }> =>
      ipcRenderer.invoke("calendar:sync", accountId, fromMs, toMs),
    listEvents: (fromMs: number, toMs: number): Promise<CalendarEventRow[]> =>
      ipcRenderer.invoke("calendar:listEvents", fromMs, toMs),
    hasCredentials: (): Promise<boolean> =>
      ipcRenderer.invoke("calendar:hasCredentials"),
    setCredentials: (
      clientId: string,
      clientSecret: string,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("calendar:setCredentials", clientId, clientSecret),
    getCredentialsMasked: (): Promise<
      { clientIdMasked: string; hasSecret: boolean } | null
    > => ipcRenderer.invoke("calendar:getCredentialsMasked"),
    clearCredentials: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("calendar:clearCredentials"),

    autoLink: (
      meetingId: string,
      renameIfAuto: boolean,
    ): Promise<{
      linked: boolean;
      event: CalendarEventRow | null;
      confidence: number;
      reason: string | null;
      titleRenamed: boolean;
    }> => ipcRenderer.invoke("calendar:autoLink", meetingId, renameIfAuto),
    linkEvent: (eventId: string, meetingId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("calendar:linkEvent", eventId, meetingId),
    unlinkMeeting: (meetingId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("calendar:unlinkMeeting", meetingId),
    linkedEvent: (meetingId: string): Promise<CalendarEventRow | null> =>
      ipcRenderer.invoke("calendar:linkedEvent", meetingId),
    linkCandidates: (
      meetingId: string,
    ): Promise<
      Array<{
        event: CalendarEventRow;
        confidence: number;
        reason: string;
        overlapMs: number;
        titleScore: number;
      }>
    > => ipcRenderer.invoke("calendar:linkCandidates", meetingId),
    linkedMeetingIds: (): Promise<string[]> =>
      ipcRenderer.invoke("calendar:linkedMeetingIds"),
    activeNow: (): Promise<CalendarEventRow | null> =>
      ipcRenderer.invoke("calendar:activeNow"),
    listAttendees: (meetingId: string): Promise<MeetingAttendee[]> =>
      ipcRenderer.invoke("calendar:listAttendees", meetingId),
  },

  tree: {
    list: (): Promise<TreeSnapshot> => ipcRenderer.invoke("tree:list"),
    move: (target: MoveTarget): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("tree:move", target),
    onInvalidated: (cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on("tree:invalidated", handler);
      return () => ipcRenderer.removeListener("tree:invalidated", handler);
    },
  },

  folders: {
    create: (opts: { name: string; parentId: string | null }): Promise<FolderRow> =>
      ipcRenderer.invoke("folders:create", opts),
    rename: (id: string, name: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("folders:rename", id, name),
    delete: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("folders:delete", id),
    setAutoTag: (folderId: string, tagId: string | null): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("folders:setAutoTag", folderId, tagId),
  },

  whisperx: {
    isInstalled: (): Promise<boolean> => ipcRenderer.invoke("whisperx:isInstalled"),
    install: (): Promise<{ ok: true }> => ipcRenderer.invoke("whisperx:install"),
    selftest: (): Promise<
      { ok: true; versions: Record<string, string> } | { ok: false; error: string }
    > => ipcRenderer.invoke("whisperx:selftest"),
    onInstallProgress: (
      cb: (payload: { stage: string; line?: string }) => void,
    ): (() => void) => {
      const handler = (_: unknown, payload: { stage: string; line?: string }) =>
        cb(payload);
      ipcRenderer.on("whisperx:install-progress", handler);
      return () =>
        ipcRenderer.removeListener("whisperx:install-progress", handler);
    },
  },

  settings: {
    hasHfToken: (): Promise<boolean> => ipcRenderer.invoke("settings:hasHfToken"),
    setHfToken: (token: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("settings:setHfToken", token),
    getHfTokenMasked: (): Promise<string | null> =>
      ipcRenderer.invoke("settings:getHfTokenMasked"),
    clearHfToken: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("settings:clearHfToken"),
    getDisplayLanguage: (): Promise<DisplayLanguage> =>
      ipcRenderer.invoke("settings:getDisplayLanguage"),
    setDisplayLanguage: (lang: DisplayLanguage): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("settings:setDisplayLanguage", lang),
    getAiLanguage: (): Promise<AiLanguage> =>
      ipcRenderer.invoke("settings:getAiLanguage"),
    setAiLanguage: (lang: AiLanguage): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("settings:setAiLanguage", lang),
  },

  transcribe: {
    run: (
      meetingId: string,
      numSpeakers?: number,
    ): Promise<{ ok: boolean; segments: number }> =>
      ipcRenderer.invoke("transcribe:run", meetingId, numSpeakers),
    rediarize: (
      meetingId: string,
      numSpeakers?: number,
    ): Promise<{ ok: boolean; speakers: number; segmentsTagged: number }> =>
      ipcRenderer.invoke("transcribe:rediarize", meetingId, numSpeakers),
    onProgress: (
      cb: (payload: {
        meetingId: string;
        stage: string;
        pct: number;
        note?: string;
        model?: string;
      }) => void,
    ): (() => void) => {
      const handler = (
        _: unknown,
        payload: {
          meetingId: string;
          stage: string;
          pct: number;
          note?: string;
          model?: string;
        },
      ) => cb(payload);
      ipcRenderer.on("transcribe:progress", handler);
      return () => ipcRenderer.removeListener("transcribe:progress", handler);
    },
  },

  llm: {
    generate: (
      meetingId: string,
      opts?: { modelOverride?: string },
    ): Promise<{
      ok: true;
      fullSummary: string;
      bullets: number;
      decisions: number;
      actionItems: number;
    }> => ipcRenderer.invoke("llm:generate", meetingId, opts),
    onProgress: (
      cb: (payload: {
        meetingId: string;
        stage: string;
        pct: number;
        note?: string;
        model?: string;
      }) => void,
    ): (() => void) => {
      const handler = (
        _: unknown,
        payload: {
          meetingId: string;
          stage: string;
          pct: number;
          note?: string;
          model?: string;
        },
      ) => cb(payload);
      ipcRenderer.on("llm:progress", handler);
      return () => ipcRenderer.removeListener("llm:progress", handler);
    },

    // --- Provider configuration ------------------------------------------
    getProviderConfig: (): Promise<{
      provider: "bundled" | "ollama" | "openai" | "anthropic" | "claude-code";
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
    }> => ipcRenderer.invoke("llm:getProviderConfig"),
    setProvider: (
      provider:
        | "bundled"
        | "ollama"
        | "openai"
        | "anthropic"
        | "claude-code",
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setProvider", provider),
    setBundledModel: (model: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setBundledModel", model),
    setOllamaConfig: (opts: {
      endpoint?: string;
      model?: string | null;
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setOllamaConfig", opts),
    setOpenAiConfig: (opts: {
      endpoint?: string;
      model?: string | null;
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setOpenAiConfig", opts),
    setOpenAiKey: (key: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setOpenAiKey", key),
    clearOpenAiKey: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:clearOpenAiKey"),
    setAnthropicConfig: (opts: {
      endpoint?: string;
      model?: string | null;
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setAnthropicConfig", opts),
    setAnthropicKey: (key: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setAnthropicKey", key),
    clearAnthropicKey: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:clearAnthropicKey"),
    getKbFilesystemPath: (): Promise<string> =>
      ipcRenderer.invoke("llm:getKbFilesystemPath"),
    setKbFilesystemPath: (p: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setKbFilesystemPath", p),
    checkKbFilesystem: (
      override?: string,
    ): Promise<
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
        }
    > => ipcRenderer.invoke("llm:checkKbFilesystem", override),
    detectClaudeCode: (): Promise<{
      installed: boolean;
      authed: boolean;
      version?: string;
      error?: string;
    }> => ipcRenderer.invoke("llm:detectClaudeCode"),
    setClaudeCodeConfig: (opts: {
      model?: string;
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:setClaudeCodeConfig", opts),
    listClaudeCodeModels: (): Promise<string[]> =>
      ipcRenderer.invoke("llm:listClaudeCodeModels"),
    getUsageStats: (filter?: {
      billingKind?: "subscription" | "metered";
    }): Promise<{
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
    }> => ipcRenderer.invoke("llm:getUsageStats", filter),
    detectOllama: (
      endpoint?: string,
    ): Promise<{
      running: boolean;
      endpoint: string;
      error?: string;
      models?: Array<{ name: string; size: number; modified_at: string }>;
    }> => ipcRenderer.invoke("llm:detectOllama", endpoint),
    detectOpenAi: (override?: {
      endpoint?: string;
      apiKey?: string | null;
    }): Promise<{
      ok: boolean;
      endpoint: string;
      error?: string;
      models?: Array<{ id: string; owned_by?: string }>;
    }> => ipcRenderer.invoke("llm:detectOpenAi", override),
    detectAnthropic: (override?: {
      endpoint?: string;
      apiKey?: string | null;
    }): Promise<{
      ok: boolean;
      endpoint: string;
      error?: string;
      models?: Array<{ id: string; display_name?: string }>;
    }> => ipcRenderer.invoke("llm:detectAnthropic", override),

    listBundledModels: (): Promise<
      Array<{
        id: string;
        displayName: string;
        approxSizeMb: number;
        downloaded: boolean;
        downloading?: { downloadedBytes: number; totalBytes: number | null };
      }>
    > => ipcRenderer.invoke("llm:listBundledModels"),
    downloadBundledModel: (
      model: string,
    ): Promise<{ ok: boolean; alreadyRunning: boolean }> =>
      ipcRenderer.invoke("llm:downloadBundledModel", model),
    deleteBundledModel: (model: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("llm:deleteBundledModel", model),
    onBundledDownloadProgress: (
      cb: (payload: {
        model: string;
        downloadedBytes: number;
        totalBytes: number | null;
      }) => void,
    ): (() => void) => {
      const handler = (
        _: unknown,
        payload: {
          model: string;
          downloadedBytes: number;
          totalBytes: number | null;
        },
      ) => cb(payload);
      ipcRenderer.on("llm:bundled-download-progress", handler);
      return () =>
        ipcRenderer.removeListener("llm:bundled-download-progress", handler);
    },
    onBundledDownloadDone: (
      cb: (payload: { model: string; ok: boolean; error?: string }) => void,
    ): (() => void) => {
      const handler = (
        _: unknown,
        payload: { model: string; ok: boolean; error?: string },
      ) => cb(payload);
      ipcRenderer.on("llm:bundled-download-done", handler);
      return () =>
        ipcRenderer.removeListener("llm:bundled-download-done", handler);
    },
  },

  templates: {
    list: (): Promise<{
      templates: Array<{
        id: string;
        name: string;
        instructions: string;
        builtin: boolean;
      }>;
      defaultId: string;
    }> => ipcRenderer.invoke("templates:list"),
    create: (opts: {
      name: string;
      instructions: string;
    }): Promise<{
      id: string;
      name: string;
      instructions: string;
      builtin: boolean;
    }> => ipcRenderer.invoke("templates:create", opts),
    update: (
      id: string,
      patch: { name?: string; instructions?: string },
    ): Promise<{
      id: string;
      name: string;
      instructions: string;
      builtin: boolean;
    }> => ipcRenderer.invoke("templates:update", { id, patch }),
    delete: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("templates:delete", id),
    reset: (
      id: string,
    ): Promise<{
      id: string;
      name: string;
      instructions: string;
      builtin: boolean;
    }> => ipcRenderer.invoke("templates:reset", id),
    setDefault: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("templates:setDefault", id),
    setMeetingTemplate: (
      meetingId: string,
      templateId: string | null,
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("templates:setMeetingTemplate", {
        meetingId,
        templateId,
      }),
  },

  find: {
    start: (
      query: string,
      options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean },
    ): Promise<{ requestId: number }> =>
      ipcRenderer.invoke("find:start", query, options),
    stop: (
      action?: "clearSelection" | "keepSelection" | "activateSelection",
    ): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("find:stop", action ?? "clearSelection"),
    onResult: (
      cb: (payload: {
        requestId: number;
        activeMatchOrdinal: number;
        matches: number;
        finalUpdate: boolean;
      }) => void,
    ): (() => void) => {
      const handler = (
        _: unknown,
        payload: {
          requestId: number;
          activeMatchOrdinal: number;
          matches: number;
          finalUpdate: boolean;
        },
      ) => cb(payload);
      ipcRenderer.on("find:result", handler);
      return () => ipcRenderer.removeListener("find:result", handler);
    },
  },

  mcp: {
    getServerInfo: (): Promise<{
      scriptPath: string | null;
      claudeDesktopConfigPath: string;
      configSnippet: string;
      requiresNode: boolean;
      allowWrites: boolean;
    }> => ipcRenderer.invoke("mcp:getServerInfo"),
    setAllowWrites: (allow: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("mcp:setAllowWrites", allow),
    revealClaudeConfig: (): Promise<{
      ok: boolean;
      revealed: "file" | "directory" | "none";
      path?: string;
    }> => ipcRenderer.invoke("mcp:revealClaudeConfig"),
    getSkillInfo: (): Promise<{
      status: "not-installed" | "installed" | "outdated" | "missing";
      bundledPath: string | null;
      installedPath: string;
      bundledSize: number | null;
      installedMtimeMs: number | null;
      hasUserSection: boolean;
    }> => ipcRenderer.invoke("mcp:getSkillInfo"),
    installSkill: (): Promise<{
      ok: boolean;
      installedPath: string;
      error?: string;
      preservedUserSection?: boolean;
      backupPath?: string;
    }> => ipcRenderer.invoke("mcp:installSkill"),
    uninstallSkill: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke("mcp:uninstallSkill"),
    revealInstalledSkill: (): Promise<{
      ok: boolean;
      revealed: "file" | "parent" | "none";
    }> => ipcRenderer.invoke("mcp:revealInstalledSkill"),
  },

  // --- Floating windows (mini recorder + meeting notification) -------------
  //
  // Main window is the authority on recording state; the mini windows are
  // thin clients. They observe state and request actions through the main
  // process, which forwards to the main window.
  floating: {
    publishRecordingState: (snapshot: RecordingStateSnapshot): void => {
      ipcRenderer.send("floating:publishRecordingState", snapshot);
    },
    getRecordingState: (): Promise<RecordingStateSnapshot> =>
      ipcRenderer.invoke("floating:getRecordingState"),
    onRecordingState: (
      cb: (snapshot: RecordingStateSnapshot) => void,
    ): (() => void) => {
      const handler = (_: unknown, snapshot: RecordingStateSnapshot) =>
        cb(snapshot);
      ipcRenderer.on("floating:recordingState", handler);
      return () => ipcRenderer.removeListener("floating:recordingState", handler);
    },

    requestStop: (): void => {
      ipcRenderer.send("floating:requestStop");
    },
    onStopRequested: (cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on("floating:stopRequested", handler);
      return () => ipcRenderer.removeListener("floating:stopRequested", handler);
    },

    onNotification: (
      cb: (payload: NotificationPayload) => void,
    ): (() => void) => {
      const handler = (_: unknown, payload: NotificationPayload) => cb(payload);
      ipcRenderer.on("floating:notification", handler);
      return () => ipcRenderer.removeListener("floating:notification", handler);
    },
    getNotification: (): Promise<NotificationPayload | null> =>
      ipcRenderer.invoke("floating:getNotification"),
    dismissNotification: (): void => {
      ipcRenderer.send("floating:dismissNotification");
    },
    openMeetingUrl: (url: string): void => {
      ipcRenderer.send("floating:openMeetingUrl", url);
    },
    startScribeForEvent: (eventId: string): void => {
      ipcRenderer.send("floating:startScribeForEvent", { eventId });
    },
    onStartScribeForEvent: (
      cb: (payload: { eventId: string }) => void,
    ): (() => void) => {
      const handler = (_: unknown, payload: { eventId: string }) => cb(payload);
      ipcRenderer.on("floating:startScribeForEvent", handler);
      return () =>
        ipcRenderer.removeListener("floating:startScribeForEvent", handler);
    },

    debugShowNotification: (opts?: {
      title?: string;
      hangoutLink?: string;
      minutesUntilStart?: number;
      delaySeconds?: number;
    }): Promise<{ ok: boolean; scheduledInMs: number }> =>
      ipcRenderer.invoke("floating:debugShowNotification", opts),
  },
};

contextBridge.exposeInMainWorld("scribe", scribe);

export type ScribeAPI = typeof scribe;
