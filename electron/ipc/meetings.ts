import { ipcMain } from "electron";
import { rm } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import {
  deleteMeeting,
  getCalendarEventForMeeting,
  getMeeting,
  listMeetings,
  listSpeakers,
  listTasks,
  listTranscript,
  setStatus,
  setTaskDone,
  setTitle,
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
}
