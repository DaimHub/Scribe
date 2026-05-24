import { app } from "electron";
import path from "node:path";
import { initDb, finalizeMeeting, setStatus, type MeetingRow } from "./db.js";
import { recoverWavFile } from "./wav-writer.js";

/**
 * Find meetings left in `status='recording'` from a prior session (app crash
 * or hard quit mid-record), patch their WAV headers from disk so the files
 * are playable, and finalize the meeting row with computed duration.
 *
 * Idempotent: safe to call repeatedly.
 */
export async function recoverInterruptedMeetings(): Promise<{
  recovered: number;
  abandoned: number;
}> {
  const db = initDb();
  const rows = db
    .prepare(`SELECT * FROM meetings WHERE status = 'recording'`)
    .all() as unknown as MeetingRow[];

  if (rows.length === 0) return { recovered: 0, abandoned: 0 };

  const meetingsRoot = path.join(app.getPath("userData"), "meetings");
  let recovered = 0;
  let abandoned = 0;

  for (const row of rows) {
    const dir = path.join(meetingsRoot, row.id);
    const micPath = path.join(dir, "mic.wav");
    const sysPath = path.join(dir, "system.wav");

    const [mic, sys] = await Promise.all([
      recoverWavFile(micPath),
      recoverWavFile(sysPath),
    ]);

    if (!mic && !sys) {
      // No salvageable audio — mark as error so the row is visible but doesn't
      // confuse the recording-state machine.
      setStatus(row.id, "error");
      abandoned++;
      continue;
    }

    const durationMs = Math.max(mic?.durationMs ?? 0, sys?.durationMs ?? 0);
    finalizeMeeting({
      id: row.id,
      endedAtMs: row.started_at_ms + durationMs,
      durationMs,
      micWavPath: mic ? micPath : null,
      sysWavPath: sys ? sysPath : null,
    });
    recovered++;
  }

  return { recovered, abandoned };
}
