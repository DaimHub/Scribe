import { ipcMain } from "electron";
import { rediarizeMeeting, transcribeMeeting } from "../services/whisper.js";
import { setStatus } from "../services/db.js";

export function registerTranscribeIpc(): void {
  ipcMain.handle(
    "transcribe:run",
    async (_e, meetingId: string, numSpeakers?: number) => {
      try {
        const result = await transcribeMeeting({ meetingId, numSpeakers });
        return result;
      } catch (err) {
        setStatus(meetingId, "error");
        throw err;
      }
    },
  );

  ipcMain.handle(
    "transcribe:rediarize",
    async (_e, meetingId: string, numSpeakers?: number) => {
      try {
        const result = await rediarizeMeeting({ meetingId, numSpeakers });
        return result;
      } catch (err) {
        setStatus(meetingId, "error");
        throw err;
      }
    },
  );
}
