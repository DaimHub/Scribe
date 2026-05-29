export type AudioChannel = "mic" | "system";

export type ScreenAccessStatus =
  | "not-determined"
  | "granted"
  | "denied"
  | "restricted"
  | "unknown";

export type DisplayLanguage = "en" | "fr" | "es" | "de";
export type AiLanguage = "auto" | "en" | "fr" | "es" | "de";

export type MeetingStatus =
  | "recording"
  | "recorded"
  | "transcribing"
  | "transcribed"
  | "diarized"
  | "done"
  | "error";

export interface MeetingRow {
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
  /** Condensed "key points": JSON array of bullet strings (inline markdown
   *  allowed). Produced by the notes LLM pass; null = not generated. */
  bullets_json: string | null;
  /** Free-form user scratch pad (markdown text). User-owned. */
  scratchpad: string | null;
}

export interface Pipeline {
  transcribe?: string;
  align?: string;
  diarize?: string;
  notes?: string;
  notes_template_id?: string;
  notes_template_name?: string;
  notes_usage?: {
    cost_usd?: number;
    model?: string;
    session_id?: string;
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    duration_ms?: number;
    num_turns?: number;
    billing_kind?: "subscription" | "metered";
    tools_used?: Array<{ name: string; target?: string }>;
    calls?: Array<{
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      tools_used?: Array<{ name: string; target?: string }>;
    }>;
  };
}

export interface NotesTemplate {
  id: string;
  name: string;
  instructions: string;
  /** True for the shipped templates (builtin:*). Builtins cannot be
   *  deleted but their instructions can be overridden and reset. */
  builtin: boolean;
}

export interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  position: number;
  created_at_ms: number;
  auto_tag_id: string | null;
}

export interface TreeSnapshot {
  folders: FolderRow[];
  meetings: MeetingRow[];
}

export type TreeItemKind = "folder" | "meeting";

export interface MoveTarget {
  itemId: string;
  kind: TreeItemKind;
  newParentId: string | null;
  newPosition?: number;
}

export interface ExecutiveBullet {
  topic: string;
  detail: string;
}

export interface SummarySection {
  title: string;
  content: string;
}

export interface MeetingSummary {
  executive_summary: ExecutiveBullet[];
  full_summary: string;
  sections?: SummarySection[];
  decisions: string[];
  generated_at_ms: number;
}

export interface TranscriptRow {
  meeting_id: string;
  segment_idx: number;
  start_ms: number;
  end_ms: number;
  speaker_id: string | null;
  text: string;
}

export interface SpeakerRow {
  meeting_id: string;
  speaker_id: string;
  display_name: string;
  sample_clip_path: string | null;
  voice_library_id: string | null;
  match_confidence: number | null;
  needs_review: 0 | 1;
}

export interface VoiceLibraryRow {
  id: string;
  display_name: string;
  email: string | null;
  /** 1 for the single person representing the app user ("you"), else 0. */
  is_me: 0 | 1;
  dim: number;
  sample_clip_path: string | null;
  n_meetings: number;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface VoiceLibraryPerson extends VoiceLibraryRow {
  last_heard_ms: number | null;
  last_meeting_id: string | null;
  last_meeting_title: string | null;
}

export interface VoicePostProcessSummary {
  meetingId: string;
  autoLinked: Array<{
    speakerId: string;
    displayName: string;
    confidence: number;
  }>;
  needsReviewCount: number;
  totalSpeakers: number;
}

export interface PendingReviewSpeaker {
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

export interface TaskRow {
  id: number;
  meeting_id: string;
  assignee_speaker_id: string | null;
  text: string;
  done: 0 | 1;
  /** 0 = none, 1 = low, 2 = medium, 3 = high. */
  priority: number;
  due_at_ms: number | null;
  created_at_ms: number;
}

export interface AggregatedTaskRow extends TaskRow {
  meeting_title: string;
  meeting_started_at_ms: number;
  assignee_name: string | null;
  assignee_library_id: string | null;
}

export interface PersonalTaskRow {
  id: number;
  text: string;
  done: 0 | 1;
  due_at_ms: number | null;
  created_at_ms: number;
}

export interface TagRow {
  id: string;
  name: string;
  color: string | null;
  auto: 0 | 1;
  created_at_ms: number;
}

export interface MeetingSearchHit {
  meeting_id: string;
  title: string;
  matched_in: "title" | "transcript" | "tag" | "summary";
  snippet: string | null;
}

export interface CalendarAccountPublic {
  id: string;
  email: string;
  provider: "google";
  connected_at_ms: number;
}

export interface CalendarEventRow {
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

export interface MeetingAttendee {
  email: string;
  name: string;
  responseStatus: string | null;
  self: boolean;
  /** speaker_id in this meeting already tagged with this attendee's name. */
  assignedTo: string | null;
  /** voice_library entry id that matches this attendee's name. */
  libraryId: string | null;
}

export interface MeetingDetail {
  meeting: MeetingRow;
  transcript: TranscriptRow[];
  speakers: SpeakerRow[];
  tasks: TaskRow[];
  linkedEvent?: CalendarEventRow | null;
}

export interface MeetingResult {
  meetingId: string;
  micWavPath: string | null;
  sysWavPath: string | null;
  durationMs: number;
  startedAtMs: number;
  endedAtMs: number;
}

export interface RecordingStateSnapshot {
  kind: "idle" | "starting" | "recording" | "stopping";
  meetingId?: string;
  startedAt?: number;
  title?: string;
  levels?: { mic: number; system: number };
}

export interface NotificationPayload {
  event: CalendarEventRow;
  minutesUntilStart: number;
}

export interface ScribeAPI {
  ping(): Promise<{ ok: boolean; at: number }>;
  audio: {
    startMeeting(): Promise<{ meetingId: string; dir: string }>;
    stopMeeting(meetingId: string): Promise<MeetingResult>;
    sendFrames(
      meetingId: string,
      channel: AudioChannel,
      sampleRate: number,
      samples: ArrayBuffer,
    ): void;
    getScreenAccessStatus(): Promise<ScreenAccessStatus>;
    openScreenSettings(): Promise<void>;
  };
  meetings: {
    list(): Promise<MeetingRow[]>;
    get(id: string): Promise<MeetingDetail | null>;
    setTitle(id: string, title: string): Promise<MeetingRow | null>;
    setStatus(id: string, status: MeetingStatus): Promise<MeetingRow | null>;
    setScratchpad(id: string, text: string): Promise<{ ok: boolean }>;
    delete(id: string): Promise<{ ok: boolean }>;
    setPinned(id: string, pinned: boolean): Promise<{ ok: boolean }>;
  };
  tree: {
    list(): Promise<TreeSnapshot>;
    move(target: MoveTarget): Promise<{ ok: boolean }>;
    onInvalidated(cb: () => void): () => void;
  };
  folders: {
    create(opts: { name: string; parentId: string | null }): Promise<FolderRow>;
    rename(id: string, name: string): Promise<{ ok: boolean }>;
    delete(id: string): Promise<{ ok: boolean }>;
    setAutoTag(folderId: string, tagId: string | null): Promise<{ ok: boolean }>;
  };
  whisperx: {
    isInstalled(): Promise<boolean>;
    install(): Promise<{ ok: true }>;
    selftest(): Promise<
      { ok: true; versions: Record<string, string> } | { ok: false; error: string }
    >;
    onInstallProgress(
      cb: (payload: { stage: string; line?: string }) => void,
    ): () => void;
  };
  settings: {
    hasHfToken(): Promise<boolean>;
    setHfToken(token: string): Promise<{ ok: boolean }>;
    getHfTokenMasked(): Promise<string | null>;
    clearHfToken(): Promise<{ ok: boolean }>;
    getDisplayLanguage(): Promise<DisplayLanguage>;
    setDisplayLanguage(lang: DisplayLanguage): Promise<{ ok: boolean }>;
    getAiLanguage(): Promise<AiLanguage>;
    setAiLanguage(lang: AiLanguage): Promise<{ ok: boolean }>;
  };
  speakers: {
    rename(
      meetingId: string,
      speakerId: string,
      displayName: string,
    ): Promise<{ ok: boolean }>;
  };
  voice: {
    listLibrary(): Promise<VoiceLibraryRow[]>;
    listPeople(): Promise<VoiceLibraryPerson[]>;
    onPostProcess(
      cb: (payload: VoicePostProcessSummary) => void,
    ): () => void;
    onLibraryChanged(cb: () => void): () => void;
    renameLibraryEntry(
      id: string,
      displayName: string,
    ): Promise<{ ok: boolean }>;
    deleteLibraryEntry(id: string): Promise<{ ok: boolean }>;
    setLibraryEmail(
      id: string,
      email: string | null,
    ): Promise<{ ok: boolean }>;
    /** Mark a person as "you" (null clears). One person max. */
    setMe(id: string | null): Promise<{ ok: boolean }>;
    pendingReview(
      meetingId: string,
      includeReviewed?: boolean,
    ): Promise<PendingReviewSpeaker[]>;
    assignToLibrary(
      meetingId: string,
      speakerId: string,
      libraryId: string,
      displayName: string,
      email?: string | null,
    ): Promise<{ ok: boolean }>;
    createFromSpeaker(
      meetingId: string,
      speakerId: string,
      displayName: string,
      email?: string | null,
    ): Promise<{ ok: boolean; libraryId: string | null }>;
    dismissReview(
      meetingId: string,
      speakerId: string,
    ): Promise<{ ok: boolean }>;
    readSampleClip(filePath: string): Promise<Uint8Array>;
  };
  tasks: {
    list(meetingId: string): Promise<TaskRow[]>;
    setDone(taskId: number, done: boolean): Promise<{ ok: boolean }>;
    listAll(): Promise<AggregatedTaskRow[]>;
    add(
      meetingId: string,
      text: string,
      assigneeSpeakerId: string | null,
    ): Promise<TaskRow>;
    duplicate(taskId: number): Promise<TaskRow | null>;
    delete(taskId: number): Promise<{ ok: boolean }>;
    setPriority(taskId: number, priority: number): Promise<{ ok: boolean }>;
    setDueDate(
      taskId: number,
      dueAtMs: number | null,
    ): Promise<{ ok: boolean }>;
    setAssignee(
      taskId: number,
      speakerId: string | null,
    ): Promise<{ ok: boolean }>;
    updateText(taskId: number, text: string): Promise<{ ok: boolean }>;
  };
  personalTasks: {
    list(): Promise<PersonalTaskRow[]>;
    create(opts: { text: string; dueAtMs: number | null }): Promise<PersonalTaskRow>;
    setDone(id: number, done: boolean): Promise<{ ok: boolean }>;
    update(
      id: number,
      text: string,
      dueAtMs: number | null,
    ): Promise<{ ok: boolean }>;
    delete(id: number): Promise<{ ok: boolean }>;
  };
  tags: {
    listAll(): Promise<TagRow[]>;
    listForMeeting(meetingId: string): Promise<TagRow[]>;
    listMeetingPairs(): Promise<Array<{ meeting_id: string; tag_id: string }>>;
    attach(meetingId: string, name: string): Promise<TagRow>;
    create(name: string): Promise<TagRow>;
    detach(meetingId: string, tagId: string): Promise<{ ok: boolean }>;
    rename(id: string, name: string): Promise<{ ok: boolean }>;
    delete(id: string): Promise<{ ok: boolean }>;
  };
  search: {
    meetings(query: string): Promise<MeetingSearchHit[]>;
  };
  calendar: {
    listAccounts(): Promise<CalendarAccountPublic[]>;
    connectGoogle(): Promise<CalendarAccountPublic>;
    disconnect(id: string): Promise<{ ok: boolean }>;
    sync(
      accountId: string,
      fromMs: number,
      toMs: number,
    ): Promise<{ count: number }>;
    listEvents(fromMs: number, toMs: number): Promise<CalendarEventRow[]>;
    hasCredentials(): Promise<boolean>;
    setCredentials(
      clientId: string,
      clientSecret: string,
    ): Promise<{ ok: boolean }>;
    getCredentialsMasked(): Promise<
      { clientIdMasked: string; hasSecret: boolean } | null
    >;
    clearCredentials(): Promise<{ ok: boolean }>;
    autoLink(
      meetingId: string,
      renameIfAuto: boolean,
    ): Promise<{
      linked: boolean;
      event: CalendarEventRow | null;
      confidence: number;
      reason: string | null;
      titleRenamed: boolean;
    }>;
    linkEvent(eventId: string, meetingId: string): Promise<{ ok: boolean }>;
    unlinkMeeting(meetingId: string): Promise<{ ok: boolean }>;
    linkedEvent(meetingId: string): Promise<CalendarEventRow | null>;
    linkCandidates(
      meetingId: string,
    ): Promise<
      Array<{
        event: CalendarEventRow;
        confidence: number;
        reason: string;
        overlapMs: number;
        titleScore: number;
      }>
    >;
    linkedMeetingIds(): Promise<string[]>;
    activeNow(): Promise<CalendarEventRow | null>;
    listAttendees(meetingId: string): Promise<MeetingAttendee[]>;
  };
  transcribe: {
    run(
      meetingId: string,
      numSpeakers?: number,
    ): Promise<{ ok: boolean; segments: number }>;
    rediarize(
      meetingId: string,
      numSpeakers?: number,
    ): Promise<{ ok: boolean; speakers: number; segmentsTagged: number }>;
    onProgress(
      cb: (payload: {
        meetingId: string;
        stage: string;
        pct: number;
        note?: string;
        model?: string;
      }) => void,
    ): () => void;
  };
  llm: {
    generate(
      meetingId: string,
      opts?: { modelOverride?: string },
    ): Promise<{
      ok: true;
      fullSummary: string;
      bullets: number;
      decisions: number;
      actionItems: number;
    }>;
    onProgress(
      cb: (payload: {
        meetingId: string;
        stage: string;
        pct: number;
        note?: string;
        model?: string;
      }) => void,
    ): () => void;
    getProviderConfig(): Promise<{
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
    }>;
    setProvider(
      provider:
        | "bundled"
        | "ollama"
        | "openai"
        | "anthropic"
        | "claude-code",
    ): Promise<{ ok: boolean }>;
    setBundledModel(model: string): Promise<{ ok: boolean }>;
    setOllamaConfig(opts: {
      endpoint?: string;
      model?: string | null;
    }): Promise<{ ok: boolean }>;
    setOpenAiConfig(opts: {
      endpoint?: string;
      model?: string | null;
    }): Promise<{ ok: boolean }>;
    setOpenAiKey(key: string): Promise<{ ok: boolean }>;
    clearOpenAiKey(): Promise<{ ok: boolean }>;
    setAnthropicConfig(opts: {
      endpoint?: string;
      model?: string | null;
    }): Promise<{ ok: boolean }>;
    setAnthropicKey(key: string): Promise<{ ok: boolean }>;
    clearAnthropicKey(): Promise<{ ok: boolean }>;
    getKbFilesystemPath(): Promise<string>;
    setKbFilesystemPath(p: string): Promise<{ ok: boolean }>;
    checkKbFilesystem(override?: string): Promise<
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
    >;
    detectClaudeCode(): Promise<{
      installed: boolean;
      authed: boolean;
      version?: string;
      error?: string;
    }>;
    setClaudeCodeConfig(opts: {
      model?: string;
    }): Promise<{ ok: boolean }>;
    listClaudeCodeModels(): Promise<string[]>;
    getUsageStats(filter?: {
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
    }>;
    detectOllama(endpoint?: string): Promise<{
      running: boolean;
      endpoint: string;
      error?: string;
      models?: Array<{ name: string; size: number; modified_at: string }>;
    }>;
    detectOpenAi(override?: {
      endpoint?: string;
      apiKey?: string | null;
    }): Promise<{
      ok: boolean;
      endpoint: string;
      error?: string;
      models?: Array<{ id: string; owned_by?: string }>;
    }>;
    detectAnthropic(override?: {
      endpoint?: string;
      apiKey?: string | null;
    }): Promise<{
      ok: boolean;
      endpoint: string;
      error?: string;
      models?: Array<{ id: string; display_name?: string }>;
    }>;
    listBundledModels(): Promise<
      Array<{
        id: string;
        displayName: string;
        approxSizeMb: number;
        downloaded: boolean;
        downloading?: { downloadedBytes: number; totalBytes: number | null };
      }>
    >;
    downloadBundledModel(
      model: string,
    ): Promise<{ ok: boolean; alreadyRunning: boolean }>;
    deleteBundledModel(model: string): Promise<{ ok: boolean }>;
    onBundledDownloadProgress(
      cb: (payload: {
        model: string;
        downloadedBytes: number;
        totalBytes: number | null;
      }) => void,
    ): () => void;
    onBundledDownloadDone(
      cb: (payload: { model: string; ok: boolean; error?: string }) => void,
    ): () => void;
  };
  templates: {
    list(): Promise<{
      templates: NotesTemplate[];
      defaultId: string;
    }>;
    create(opts: {
      name: string;
      instructions: string;
    }): Promise<NotesTemplate>;
    update(
      id: string,
      patch: { name?: string; instructions?: string },
    ): Promise<NotesTemplate>;
    delete(id: string): Promise<{ ok: boolean }>;
    reset(id: string): Promise<NotesTemplate>;
    setDefault(id: string): Promise<{ ok: boolean }>;
    setMeetingTemplate(
      meetingId: string,
      templateId: string | null,
    ): Promise<{ ok: boolean }>;
  };
  mcp: {
    getServerInfo(): Promise<{
      scriptPath: string | null;
      claudeDesktopConfigPath: string;
      configSnippet: string;
      requiresNode: boolean;
      allowWrites: boolean;
    }>;
    setAllowWrites(allow: boolean): Promise<{ ok: boolean }>;
    revealClaudeConfig(): Promise<{
      ok: boolean;
      revealed: "file" | "directory" | "none";
      path?: string;
    }>;
    getSkillInfo(): Promise<{
      status: "not-installed" | "installed" | "outdated" | "missing";
      bundledPath: string | null;
      installedPath: string;
      bundledSize: number | null;
      installedMtimeMs: number | null;
      hasUserSection: boolean;
    }>;
    installSkill(): Promise<{
      ok: boolean;
      installedPath: string;
      error?: string;
      preservedUserSection?: boolean;
      backupPath?: string;
    }>;
    uninstallSkill(): Promise<{ ok: boolean; error?: string }>;
    revealInstalledSkill(): Promise<{
      ok: boolean;
      revealed: "file" | "parent" | "none";
    }>;
  };
  floating: {
    publishRecordingState(snapshot: RecordingStateSnapshot): void;
    getRecordingState(): Promise<RecordingStateSnapshot>;
    onRecordingState(cb: (snapshot: RecordingStateSnapshot) => void): () => void;

    requestStop(): void;
    onStopRequested(cb: () => void): () => void;

    onNotification(cb: (payload: NotificationPayload) => void): () => void;
    getNotification(): Promise<NotificationPayload | null>;
    dismissNotification(): void;
    openMeetingUrl(url: string): void;
    startScribeForEvent(eventId: string): void;
    onStartScribeForEvent(
      cb: (payload: { eventId: string }) => void,
    ): () => void;

    debugShowNotification(opts?: {
      title?: string;
      hangoutLink?: string;
      minutesUntilStart?: number;
      delaySeconds?: number;
    }): Promise<{ ok: boolean; scheduledInMs: number }>;
  };
  find: {
    start(
      query: string,
      options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean },
    ): Promise<{ requestId: number }>;
    stop(
      action?: "clearSelection" | "keepSelection" | "activateSelection",
    ): Promise<{ ok: boolean }>;
    onResult(
      cb: (payload: {
        requestId: number;
        activeMatchOrdinal: number;
        matches: number;
        finalUpdate: boolean;
      }) => void,
    ): () => void;
  };
}

declare global {
  interface Window {
    scribe: ScribeAPI;
  }
}
