import { BrowserWindow, ipcMain, shell } from "electron";
import {
  getLastNotificationPayload,
  hideMiniRecorder,
  hideNotification,
  sendToMiniRecorder,
  showMiniRecorder,
  showNotification,
} from "../services/floating-windows.js";
import type { CalendarEventRow } from "../services/db.js";

/**
 * Snapshot of the renderer-side recording machine. Mirrors RecordingState in
 * lib/store.ts so the mini recorder can render the same view without owning
 * its own audio capture (the main window has the only MediaStream).
 */
export interface RecordingStateSnapshot {
  kind: "idle" | "starting" | "recording" | "stopping";
  meetingId?: string;
  startedAt?: number;
  title?: string;
  levels?: { mic: number; system: number };
}

let lastState: RecordingStateSnapshot = { kind: "idle" };
let mainWindowGetter: (() => BrowserWindow | null) | null = null;

export function setMainWindowGetter(
  getter: () => BrowserWindow | null,
): void {
  mainWindowGetter = getter;
}

function mainWindow(): BrowserWindow | null {
  return mainWindowGetter ? mainWindowGetter() : null;
}

/**
 * Show or hide the mini recorder based on whether (a) the recording machine
 * is non-idle and (b) the main window isn't currently focused. The mini
 * widget exists to surface controls while the user is in some other app —
 * when they're back in the main window the inline RecordingBar handles it.
 * "Stopping" is kept visible briefly so the user sees their click registered.
 */
function reconcileMiniVisibility(): void {
  const inFlight = lastState.kind !== "idle";
  const main = mainWindow();
  const mainIsFocused = main ? main.isFocused() : false;
  if (inFlight && !mainIsFocused) {
    showMiniRecorder();
  } else {
    hideMiniRecorder();
  }
}

export function notifyMainFocusChanged(): void {
  reconcileMiniVisibility();
}

export function registerFloatingIpc(): void {
  // Main renderer publishes whenever its recording machine transitions.
  ipcMain.on(
    "floating:publishRecordingState",
    (_e, snapshot: RecordingStateSnapshot) => {
      lastState = snapshot;
      // Mirror to the mini window so it can render.
      sendToMiniRecorder("floating:recordingState", snapshot);
      reconcileMiniVisibility();
    },
  );

  // Mini window catching up after load — return last known state.
  ipcMain.handle("floating:getRecordingState", () => lastState);

  // Mini "Stop" button → ask the main window to stop. Main window owns the
  // capture pipeline; only it can tear it down cleanly.
  ipcMain.on("floating:requestStop", () => {
    const main = mainWindow();
    if (main && !main.isDestroyed()) {
      main.webContents.send("floating:stopRequested");
    }
  });

  // Notification widget hand-offs.
  ipcMain.on("floating:dismissNotification", () => {
    hideNotification();
  });

  ipcMain.on("floating:openMeetingUrl", (_e, url: string) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
  });

  ipcMain.on(
    "floating:startScribeForEvent",
    (_e, payload: { eventId: string }) => {
      const main = mainWindow();
      if (main && !main.isDestroyed()) {
        if (main.isMinimized()) main.restore();
        main.show();
        main.focus();
        main.webContents.send("floating:startScribeForEvent", payload);
      }
      hideNotification();
    },
  );

  // Notification window catching up after load — React effects may attach
  // after the main process already pushed the payload, so let the renderer
  // pull it on mount.
  ipcMain.handle("floating:getNotification", () => getLastNotificationPayload());

  // Debug-only: surface the notification widget with a synthetic event so
  // you can iterate on the UI without waiting for a real calendar event to
  // fall inside the lead window. The fake event lacks a hangout_link so the
  // Join button stays disabled; pass one in if you want to test that path.
  // Pass delaySeconds to schedule the popup — handy for verifying it shows
  // on top of whatever app you switch to.
  ipcMain.handle(
    "floating:debugShowNotification",
    (
      _e,
      opts?: {
        hangoutLink?: string;
        title?: string;
        minutesUntilStart?: number;
        delaySeconds?: number;
      },
    ) => {
      const fire = () => {
        const minutesUntilStart = Math.max(1, opts?.minutesUntilStart ?? 2);
        const startAtMs = Date.now() + minutesUntilStart * 60_000;
        const fake: CalendarEventRow = {
          id: `debug:${Date.now()}`,
          account_id: "debug",
          source_event_id: `debug-${Date.now()}`,
          title: opts?.title ?? "Debug — fake meeting",
          description: null,
          location: null,
          start_at_ms: startAtMs,
          end_at_ms: startAtMs + 30 * 60_000,
          hangout_link: opts?.hangoutLink ?? null,
          attendees_json: null,
          meeting_id: null,
          updated_at_ms: Date.now(),
        };
        showNotification({ event: fake, minutesUntilStart });
      };
      const delayMs = Math.max(0, Math.round((opts?.delaySeconds ?? 0) * 1000));
      if (delayMs > 0) {
        // Refs are kept by the closure; the window/notifier teardown path
        // doesn't track this timer, but firing into a destroyed window is a
        // no-op so we accept that for a debug-only entry point.
        setTimeout(fire, delayMs);
      } else {
        fire();
      }
      return { ok: true, scheduledInMs: delayMs };
    },
  );
}

export function getLastRecordingState(): RecordingStateSnapshot {
  return lastState;
}
