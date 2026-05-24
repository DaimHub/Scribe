import { ipcMain } from "electron";
import { generateNotes } from "../services/llm.js";
import { setStatus } from "../services/db.js";

export function registerLlmIpc(): void {
  ipcMain.handle("llm:generate", async (_e, meetingId: string) => {
    try {
      return await generateNotes({ meetingId });
    } catch (err) {
      setStatus(meetingId, "error");
      throw err;
    }
  });
}
