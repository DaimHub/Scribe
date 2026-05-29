import { ipcMain } from "electron";
import { rm } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import {
  addTask,
  deleteMeeting,
  deleteTask,
  duplicateTask,
  getCalendarEventForMeeting,
  getMeeting,
  listMeetings,
  listSpeakers,
  listTasks,
  listTranscript,
  setScratchpad,
  setStatus,
  setTaskAssignee,
  setTaskDone,
  setTaskDueDate,
  setTaskPriority,
  setTitle,
  updateTaskText,
  upsertSpeaker,
  type MeetingRow,
} from "../services/db.js";

export function registerMeetingsIpc(): void {
  ipcMain.handle("meetings:list", () => listMeetings());

  ipcMain.handle("meetings:get", (_e, id: string) => {
    const meeting = getMeeting(id);
    if (!meeting) return null;
    return {
      meeting,
      transcript: listTranscript(id),
      speakers: listSpeakers(id),
      tasks: listTasks(id),
      linkedEvent: getCalendarEventForMeeting(id),
    };
  });

  ipcMain.handle(
    "meetings:setTitle",
    (_e, id: string, title: string): MeetingRow | null => {
      setTitle(id, title);
      return getMeeting(id);
    },
  );

  ipcMain.handle(
    "meetings:setStatus",
    (_e, id: string, status: MeetingRow["status"]): MeetingRow | null => {
      setStatus(id, status);
      return getMeeting(id);
    },
  );

  ipcMain.handle(
    "meetings:setScratchpad",
    (_e, id: string, text: string): { ok: boolean } => {
      setScratchpad(id, text);
      return { ok: true };
    },
  );

  ipcMain.handle("meetings:delete", async (_e, id: string) => {
    const meeting = getMeeting(id);
    deleteMeeting(id);
    if (meeting) {
      const dir = path.join(app.getPath("userData"), "meetings", id);
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    return { ok: true };
  });

  ipcMain.handle(
    "speakers:rename",
    (_e, meetingId: string, speakerId: string, displayName: string) => {
      upsertSpeaker(meetingId, speakerId, displayName);
      return { ok: true };
    },
  );

  ipcMain.handle("tasks:list", (_e, meetingId: string) => listTasks(meetingId));

  ipcMain.handle(
    "tasks:setDone",
    (_e, taskId: number, done: boolean) => {
      setTaskDone(taskId, done);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "tasks:add",
    (_e, meetingId: string, text: string, assigneeSpeakerId: string | null) =>
      addTask(meetingId, text, assigneeSpeakerId ?? null),
  );

  ipcMain.handle("tasks:duplicate", (_e, taskId: number) =>
    duplicateTask(taskId),
  );

  ipcMain.handle("tasks:delete", (_e, taskId: number) => {
    deleteTask(taskId);
    return { ok: true };
  });

  ipcMain.handle(
    "tasks:setPriority",
    (_e, taskId: number, priority: number) => {
      setTaskPriority(taskId, priority);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "tasks:setDueDate",
    (_e, taskId: number, dueAtMs: number | null) => {
      setTaskDueDate(taskId, dueAtMs ?? null);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "tasks:setAssignee",
    (_e, taskId: number, speakerId: string | null) => {
      setTaskAssignee(taskId, speakerId ?? null);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "tasks:updateText",
    (_e, taskId: number, text: string) => {
      updateTaskText(taskId, text);
      return { ok: true };
    },
  );
}
