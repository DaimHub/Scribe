import { ipcMain } from "electron";
import { searchMeetings } from "../services/db.js";

export function registerSearchIpc(): void {
  ipcMain.handle("search:meetings", (_e, query: string) => searchMeetings(query));
}
