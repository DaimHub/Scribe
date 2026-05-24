export type AudioChannel = "mic" | "system";

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
}

export interface Pipeline {
  transcribe?: string;
  align?: string;
  diarize?: string;
  notes?: string;
}

export interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  position: number;
  created_at_ms: number;
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
  dim: number;
  sample_clip_path: string | null;
  n_meetings: number;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface PendingReviewSpeaker {
  meeting_id: string;
  speaker_id: string;
  display_name: string;
  sample_clip_path: string | null;
  match_confidence: number | null;
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
  created_at_ms: number;
}

export interface AggregatedTaskRow extends TaskRow {
  meeting_title: string;
  meeting_started_at_ms: number;
  assignee_name: string | null;
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
  };
  meetings: {
    list(): Promise<MeetingRow[]>;
    get(id: string): Promise<MeetingDetail | null>;
    setTitle(id: string, title: string): Promise<MeetingRow | null>;
    setStatus(id: string, status: MeetingStatus): Promise<MeetingRow | null>;
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
    renameLibraryEntry(
      id: string,
      displayName: string,
    ): Promise<{ ok: boolean }>;
    deleteLibraryEntry(id: string): Promise<{ ok: boolean }>;
    pendingReview(meetingId: string): Promise<PendingReviewSpeaker[]>;
    assignToLibrary(
      meetingId: string,
      speakerId: string,
      libraryId: string,
      displayName: string,
    ): Promise<{ ok: boolean }>;
    createFromSpeaker(
      meetingId: string,
      speakerId: string,
      displayName: string,
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
  };
  transcribe: {
    run(meetingId: string): Promise<{ ok: boolean; segments: number }>;
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
}

declare global {
  interface Window {
    scribe: ScribeAPI;
  }
}
