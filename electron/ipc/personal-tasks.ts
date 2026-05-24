import { ipcMain } from "electron";
import {
  createPersonalTask,
  deletePersonalTask,
  listAllMeetingTasks,
  listPersonalTasks,
  setPersonalTaskDone,
  updatePersonalTask,
} from "../services/db.js";

export function registerPersonalTasksIpc(): void {
  ipcMain.handle("personalTasks:list", () => listPersonalTasks());

  ipcMain.handle(
    "personalTasks:create",
    (_e, opts: { text: string; dueAtMs: number | null }) =>
      createPersonalTask({ text: opts.text, dueAtMs: opts.dueAtMs }),
  );

  ipcMain.handle(
    "personalTasks:setDone",
    (_e, id: number, done: boolean) => {
      setPersonalTaskDone(id, done);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "personalTasks:update",
    (_e, id: number, text: string, dueAtMs: number | null) => {
      updatePersonalTask(id, text, dueAtMs);
      return { ok: true };
    },
  );

  ipcMain.handle("personalTasks:delete", (_e, id: number) => {
    deletePersonalTask(id);
    return { ok: true };
  });

  ipcMain.handle("tasks:listAll", () => listAllMeetingTasks());
}
