import { ipcMain } from "electron";
import { readFile } from "node:fs/promises";
import {
  deleteVoiceLibraryEntry,
  getSpeakerEmbedding,
  listSpeakers,
  listVoiceLibrary,
  listVoiceLibraryWithStats,
  renameVoiceLibraryEntry,
  setSpeakerMatch,
  type SpeakerRow,
} from "../services/db.js";
import {
  addToLibrary,
  findBestMatch,
  mergeIntoLibrary,
} from "../services/voice-match.js";

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

export function registerVoiceIpc(): void {
  // ---- Voice library ----

  ipcMain.handle("voice:listLibrary", () => listVoiceLibrary());

  ipcMain.handle("voice:listPeople", () => listVoiceLibraryWithStats());

  ipcMain.handle(
    "voice:renameLibraryEntry",
    (_e, id: string, displayName: string) => {
      renameVoiceLibraryEntry(id, displayName);
      return { ok: true };
    },
  );

  ipcMain.handle("voice:deleteLibraryEntry", (_e, id: string) => {
    deleteVoiceLibraryEntry(id);
    return { ok: true };
  });

  // ---- Per-meeting review queue ----

  ipcMain.handle(
    "voice:pendingReview",
    (_e, meetingId: string): PendingReviewSpeaker[] => {
      const speakers = listSpeakers(meetingId);
      return speakers
        .filter((s) => s.needs_review === 1)
        .map((s) => toPendingReview(s));
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
      return { ok: true };
    },
  );

  /**
   * The user confirmed this is a brand-new person. Creates a library entry
   * seeded with this speaker's embedding and links the meeting row to it.
   */
  ipcMain.handle(
    "voice:createFromSpeaker",
    (_e, meetingId: string, speakerId: string, displayName: string) => {
      const sp = getSpeakerEmbedding(meetingId, speakerId);
      if (!sp || !sp.embedding) {
        // No embedding to seed with — still update the displayed name and
        // clear the review flag so the UI stops nagging.
        setSpeakerMatch({
          meetingId,
          speakerId,
          voiceLibraryId: null,
          matchConfidence: null,
          needsReview: false,
          displayName,
        });
        return { ok: true, libraryId: null };
      }
      const entry = addToLibrary({
        displayName,
        embedding: sp.embedding,
        sampleClipPath: sp.sampleClipPath,
      });
      setSpeakerMatch({
        meetingId,
        speakerId,
        voiceLibraryId: entry.id,
        matchConfidence: 1.0,
        needsReview: false,
        displayName,
      });
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

function toPendingReview(s: SpeakerRow): PendingReviewSpeaker {
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
    candidates,
  };
}
