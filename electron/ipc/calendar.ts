import { ipcMain } from "electron";
import {
  autoLinkMeeting,
  connectGoogleAccount,
  disconnectAccount,
  findActiveEventNow,
  getLinkedEventForMeeting,
  linkEventToMeeting,
  listAccounts,
  listEvents,
  listLinkCandidates,
  listLinkedMeetingIdsPublic,
  syncAccountEvents,
  unlinkMeeting,
} from "../services/calendar.js";
import {
  clearGoogleCredentials,
  getGoogleCredentials,
  hasGoogleCredentials,
  setGoogleCredentials,
} from "../services/calendar-settings.js";

export function registerCalendarIpc(): void {
  ipcMain.handle("calendar:listAccounts", () => listAccounts());

  ipcMain.handle("calendar:connectGoogle", async () => {
    return connectGoogleAccount();
  });

  ipcMain.handle("calendar:disconnect", (_e, id: string) => {
    disconnectAccount(id);
    return { ok: true };
  });

  ipcMain.handle("calendar:sync", async (_e, accountId: string, fromMs: number, toMs: number) => {
    return syncAccountEvents({ accountId, fromMs, toMs });
  });

  ipcMain.handle("calendar:listEvents", (_e, fromMs: number, toMs: number) =>
    listEvents(fromMs, toMs),
  );

  ipcMain.handle("calendar:hasCredentials", () => hasGoogleCredentials());

  ipcMain.handle(
    "calendar:setCredentials",
    async (_e, clientId: string, clientSecret: string) => {
      await setGoogleCredentials({ clientId, clientSecret });
      return { ok: true };
    },
  );

  ipcMain.handle("calendar:getCredentialsMasked", async () => {
    const creds = await getGoogleCredentials();
    if (!creds) return null;
    const id = creds.clientId;
    return {
      clientIdMasked:
        id.length <= 16 ? id : `${id.slice(0, 10)}…${id.slice(-12)}`,
      hasSecret: creds.clientSecret.length > 0,
    };
  });

  ipcMain.handle("calendar:clearCredentials", async () => {
    await clearGoogleCredentials();
    return { ok: true };
  });

  // --- Linking ---

  ipcMain.handle(
    "calendar:autoLink",
    (_e, meetingId: string, renameIfAuto: boolean) =>
      autoLinkMeeting({ meetingId, renameIfAuto }),
  );

  ipcMain.handle("calendar:linkEvent", (_e, eventId: string, meetingId: string) => {
    linkEventToMeeting(eventId, meetingId);
    return { ok: true };
  });

  ipcMain.handle("calendar:unlinkMeeting", (_e, meetingId: string) => {
    unlinkMeeting(meetingId);
    return { ok: true };
  });

  ipcMain.handle("calendar:linkedEvent", (_e, meetingId: string) =>
    getLinkedEventForMeeting(meetingId),
  );

  ipcMain.handle("calendar:linkCandidates", (_e, meetingId: string) =>
    listLinkCandidates(meetingId),
  );

  ipcMain.handle("calendar:linkedMeetingIds", () => listLinkedMeetingIdsPublic());

  ipcMain.handle("calendar:activeNow", () => findActiveEventNow());
}
