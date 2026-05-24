import { ipcMain } from "electron";
import {
  attachTagToMeeting,
  deleteTag,
  detachTagFromMeeting,
  findOrCreateTag,
  listAllMeetingTagPairs,
  listAllTags,
  listTagsForMeeting,
  renameTag,
} from "../services/db.js";

export function registerTagsIpc(): void {
  ipcMain.handle("tags:listAll", () => listAllTags());

  ipcMain.handle("tags:listForMeeting", (_e, meetingId: string) =>
    listTagsForMeeting(meetingId),
  );

  ipcMain.handle("tags:listMeetingPairs", () => listAllMeetingTagPairs());

  ipcMain.handle(
    "tags:attach",
    (_e, meetingId: string, name: string) => {
      const tag = findOrCreateTag(name, false);
      attachTagToMeeting(meetingId, tag.id, false);
      return tag;
    },
  );

  ipcMain.handle("tags:create", (_e, name: string) => {
    return findOrCreateTag(name, false);
  });

  ipcMain.handle(
    "tags:detach",
    (_e, meetingId: string, tagId: string) => {
      detachTagFromMeeting(meetingId, tagId);
      return { ok: true };
    },
  );

  ipcMain.handle("tags:rename", (_e, id: string, name: string) => {
    renameTag(id, name);
    return { ok: true };
  });

  ipcMain.handle("tags:delete", (_e, id: string) => {
    deleteTag(id);
    return { ok: true };
  });
}
