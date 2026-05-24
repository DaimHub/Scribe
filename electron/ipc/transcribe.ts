import { ipcMain } from "electron";
import { transcribeMeeting } from "../services/whisper.js";
import { setStatus } from "../services/db.js";

export function registerTranscribeIpc(): void {
  ipcMain.handle("transcribe:run", async (_e, meetingId: string) => {
    try {
      const result = await transcribeMeeting({ meetingId });
      return result;
    } catch (err) {
      setStatus(meetingId, "error");
      throw err;
    }
  });
}
