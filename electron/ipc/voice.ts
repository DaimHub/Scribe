import { ipcMain } from "electron";
import { readFile } from "node:fs/promises";
import {
  deleteVoiceLibraryEntry,
  getSpeakerEmbedding,
  listSpeakers,
  listVoiceLibrary,
  listVoiceLibraryWithStats,
  markLibraryEntryAsMe,
  renameVoiceLibraryEntry,
  setPersonEmail,
  setSpeakerMatch,
  updatePersonEmail,
  type SpeakerRow,
} from "../services/db.js";
import {
  addToLibrary,
  findBestMatch,
  mergeIntoLibrary,
} from "../services/voice-match.js";
import { broadcastVoiceLibraryChanged } from "../services/broadcast.js";

export interface PendingReviewSpeaker {
  meeting_id: string;
  speaker_id: string;
  display_name: string;
  sample_clip_path: string | null;
  match_confidence: number | null;
  /** Library person this speaker is linked to, or null. Lets the renderer
   *  seed the avatar color by stable identity (so it matches the People page)
   *  and show the "you" badge. */
  voice_library_id: string | null;
  /** Email of the library person this speaker is linked to (set in People),
   *  or null when the speaker isn't linked or that person has no email. */
  email: string | null;
  candidates: Array<{
    library_id: string;
    display_name: string;
    similarity: number;
  }>;
}

export function registerVoiceIpc(): void {
  // ---- Voice library ----

  ipcMain.handle("voice:listLibrary", () => listVoiceLibrary());

  ipcMain.handle("voice:listPeople", () => listVoiceLibraryWithStats());

  ipcMain.handle(
    "voice:renameLibraryEntry",
    (_e, id: string, displayName: string) => {
      renameVoiceLibraryEntry(id, displayName);
      broadcastVoiceLibraryChanged();
      return { ok: true };
    },
  );

  ipcMain.handle("voice:deleteLibraryEntry", (_e, id: string) => {
    deleteVoiceLibraryEntry(id);
    broadcastVoiceLibraryChanged();
    return { ok: true };
  });

  // Manual email edit from the People view — overwrites (or clears when empty),
  // unlike the backfill-only setPersonEmail used by the auto-tag path.
  ipcMain.handle(
    "voice:setLibraryEmail",
    (_e, id: string, email: string | null) => {
      updatePersonEmail(id, email);
      broadcastVoiceLibraryChanged();
      return { ok: true };
    },
  );

  // Mark a person as "you" (or pass null to clear). Manual override from the
  // People view; always wins over the calendar-email auto-detection.
  ipcMain.handle("voice:setMe", (_e, id: string | null) => {
    markLibraryEntryAsMe(id);
    broadcastVoiceLibraryChanged();
    return { ok: true };
  });

  // ---- Per-meeting review queue ----

  ipcMain.handle(
    "voice:pendingReview",
    (
      _e,
      meetingId: string,
      includeReviewed = false,
    ): PendingReviewSpeaker[] => {
      const speakers = listSpeakers(meetingId);
      // Resolve each linked speaker's person email once up front.
      const emailByLib = new Map<string, string>();
      for (const l of listVoiceLibrary()) {
        if (l.email) emailByLib.set(l.id, l.email);
      }
      return speakers
        .filter((s) => includeReviewed || s.needs_review === 1)
        .map((s) => toPendingReview(s, emailByLib));
    },
  );

  // ---- Assignment actions ----

  /**
   * The user confirmed this meeting's speaker is an existing library entry.
   * Updates the meeting row + merges the new embedding into the library.
   */
  ipcMain.handle(
    "voice:assignToLibrary",
    (
      _e,
      meetingId: string,
      speakerId: string,
      libraryId: string,
      displayName: string,
      email?: string | null,
    ) => {
      const sp = getSpeakerEmbedding(meetingId, speakerId);
      setSpeakerMatch({
        meetingId,
        speakerId,
        voiceLibraryId: libraryId,
        matchConfidence: 1.0,
        needsReview: false,
        displayName,
      });
      if (sp?.embedding) {
        mergeIntoLibrary({ libraryId, newEmbedding: sp.embedding });
      }
      // When assigning from a calendar invitee, stamp their email onto the
      // person so future invitees match by email (no-op if already set).
      if (email) setPersonEmail(libraryId, email);
      // Library stats (n_meetings, last_heard_ms) change even when no row
      // is created — the People view needs to refresh either way.
      broadcastVoiceLibraryChanged();
      return { ok: true };
    },
  );

  /**
   * The user confirmed this is a brand-new person. Creates a library entry
   * (always — even when no embedding is available) so the manual assignment
   * persists across re-diarize runs and shows up in the People tab. Without
   * an embedding the entry can't auto-match against future speakers, but
   * the next diarize pass that DOES produce an embedding can merge it via
   * voice:assignToLibrary when the user picks this entry again.
   */
  ipcMain.handle(
    "voice:createFromSpeaker",
    (
      _e,
      meetingId: string,
      speakerId: string,
      displayName: string,
      email?: string | null,
    ) => {
      const sp = getSpeakerEmbedding(meetingId, speakerId);
      // No embedding (short interjection, or tagged from the invitee list
      // before the voice was heard) → the person is created name-only and
      // becomes voice-matchable once a real recording is folded in later.
      const entry = addToLibrary({
        displayName,
        embedding: sp?.embedding ?? null,
        sampleClipPath: sp?.sampleClipPath ?? null,
        email: email ?? null,
      });
      setSpeakerMatch({
        meetingId,
        speakerId,
        voiceLibraryId: entry.id,
        matchConfidence: 1.0,
        needsReview: false,
        displayName,
      });
      broadcastVoiceLibraryChanged();
      return { ok: true, libraryId: entry.id };
    },
  );

  /** Mark a speaker as reviewed without naming (e.g. background noise). */
  ipcMain.handle(
    "voice:dismissReview",
    (_e, meetingId: string, speakerId: string) => {
      setSpeakerMatch({
        meetingId,
        speakerId,
        voiceLibraryId: null,
        matchConfidence: null,
        needsReview: false,
        displayName: "Unknown",
      });
      return { ok: true };
    },
  );

  /** Read a sample clip wav from disk so the renderer can play it. */
  ipcMain.handle(
    "voice:readSampleClip",
    async (_e, filePath: string): Promise<Uint8Array> => {
      const buf = await readFile(filePath);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },
  );
}

function toPendingReview(
  s: SpeakerRow,
  emailByLib: Map<string, string>,
): PendingReviewSpeaker {
  let candidates: PendingReviewSpeaker["candidates"] = [];
  const embRow = getSpeakerEmbedding(s.meeting_id, s.speaker_id);
  if (embRow?.embedding) {
    const verdict = findBestMatch(embRow.embedding, 3);
    candidates = verdict.candidates.map((c) => ({
      library_id: c.entry.id,
      display_name: c.entry.display_name,
      similarity: c.similarity,
    }));
  }
  return {
    meeting_id: s.meeting_id,
    speaker_id: s.speaker_id,
    display_name: s.display_name,
    sample_clip_path: s.sample_clip_path,
    match_confidence: s.match_confidence,
    voice_library_id: s.voice_library_id,
    email: s.voice_library_id
      ? (emailByLib.get(s.voice_library_id) ?? null)
      : null,
    candidates,
  };
}
