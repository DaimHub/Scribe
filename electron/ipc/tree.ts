import { ipcMain } from "electron";
import {
  createFolder,
  deleteFolder,
  listTree,
  moveItem,
  renameFolder,
  setFolderAutoTag,
  setMeetingPinned,
  type MoveTarget,
} from "../services/tree.js";

export function registerTreeIpc(): void {
  ipcMain.handle("tree:list", () => listTree());

  ipcMain.handle(
    "folders:create",
    (_e, opts: { name: string; parentId: string | null }) => createFolder(opts),
  );

  ipcMain.handle("folders:rename", (_e, id: string, name: string) => {
    renameFolder(id, name);
    return { ok: true };
  });

  ipcMain.handle("folders:delete", (_e, id: string) => {
    deleteFolder(id);
    return { ok: true };
  });

  ipcMain.handle(
    "folders:setAutoTag",
    (_e, folderId: string, tagId: string | null) => {
      setFolderAutoTag(folderId, tagId);
      return { ok: true };
    },
  );

  ipcMain.handle("tree:move", (_e, target: MoveTarget) => {
    moveItem(target);
    return { ok: true };
  });

  ipcMain.handle("meetings:setPinned", (_e, meetingId: string, pinned: boolean) => {
    setMeetingPinned(meetingId, pinned);
    return { ok: true };
  });
}
