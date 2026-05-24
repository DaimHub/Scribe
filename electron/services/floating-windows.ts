import { BrowserWindow, app, screen } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { CalendarEventRow } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// preload sits in dist-electron/preload.cjs; this file ends up under
// dist-electron/services/floating-windows.js, so step up one level.
const preloadPath = path.join(here, "..", "preload.cjs");
const rendererRoot = path.join(here, "..", "..", "out");

const isDev = !app.isPackaged;
const DEV_URL = process.env.SCRIBE_DEV_URL ?? "http://localhost:3000";

const MINI_RECORDER_SIZE = { width: 280, height: 56 };
const NOTIFICATION_SIZE = { width: 360, height: 152 };

let miniRecorder: BrowserWindow | null = null;
let notification: BrowserWindow | null = null;

type FloatingKind = "recorder" | "notification";

interface CreateOpts {
  kind: FloatingKind;
  size: { width: number; height: number };
  positionAtTopRight: boolean;
}

function createFloatingWindow(opts: CreateOpts): BrowserWindow {
  const { width, height } = opts.size;
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: true,
    alwaysOnTop: true,
    // Focusable so the OS lets the renderer accept mouse events (a
    // non-focusable window on macOS can't run -webkit-app-region drags and
    // swallows the first click). We use showInactive() below to avoid
    // stealing keyboard focus when the widget pops in.
    focusable: true,
    // First click registers as a click instead of being eaten by the OS to
    // activate the window — required so Stop works on the first try.
    acceptFirstMouse: true,
    backgroundColor: "#00000000",
    title: opts.kind === "recorder" ? "Scribe — Recording" : "Scribe",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // Hover above every workspace, even over fullscreen apps on macOS.
  win.setAlwaysOnTop(true, "screen-saver");
  if (process.platform === "darwin") {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  if (opts.positionAtTopRight) {
    const display = screen.getPrimaryDisplay().workArea;
    const x = display.x + display.width - width - 16;
    const y = display.y + 16;
    win.setPosition(x, y);
  }

  const routePath = opts.kind === "recorder" ? "mini/recorder" : "mini/notification";
  if (isDev) {
    void win.loadURL(`${DEV_URL}/${routePath}/`);
  } else {
    const file = path.join(rendererRoot, routePath, "index.html");
    void win.loadFile(file);
  }

  return win;
}

function ensureMiniRecorder(): BrowserWindow {
  if (miniRecorder && !miniRecorder.isDestroyed()) return miniRecorder;
  miniRecorder = createFloatingWindow({
    kind: "recorder",
    size: MINI_RECORDER_SIZE,
    positionAtTopRight: true,
  });
  miniRecorder.on("closed", () => {
    miniRecorder = null;
  });
  return miniRecorder;
}

function ensureNotification(): BrowserWindow {
  if (notification && !notification.isDestroyed()) return notification;
  notification = createFloatingWindow({
    kind: "notification",
    size: NOTIFICATION_SIZE,
    positionAtTopRight: true,
  });
  notification.on("closed", () => {
    notification = null;
  });
  return notification;
}

export function getMiniRecorder(): BrowserWindow | null {
  return miniRecorder && !miniRecorder.isDestroyed() ? miniRecorder : null;
}

export function getNotification(): BrowserWindow | null {
  return notification && !notification.isDestroyed() ? notification : null;
}

export function showMiniRecorder(): void {
  const win = ensureMiniRecorder();
  if (!win.isVisible()) win.showInactive();
}

export function hideMiniRecorder(): void {
  if (miniRecorder && !miniRecorder.isDestroyed() && miniRecorder.isVisible()) {
    miniRecorder.hide();
  }
}

export interface NotificationPayload {
  event: CalendarEventRow;
  minutesUntilStart: number;
}

let lastNotificationPayload: NotificationPayload | null = null;

export function getLastNotificationPayload(): NotificationPayload | null {
  return lastNotificationPayload;
}

export function showNotification(payload: NotificationPayload): void {
  lastNotificationPayload = payload;
  const win = ensureNotification();
  // Push payload into the window as soon as it has loaded. The renderer also
  // calls floating:getNotification on mount in case the React effect hadn't
  // attached yet when this send fired.
  const send = () => {
    if (!win.isDestroyed()) win.webContents.send("floating:notification", payload);
  };
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", send);
  } else {
    send();
  }
  if (!win.isVisible()) win.show();
  win.focus();
}

export function hideNotification(): void {
  lastNotificationPayload = null;
  if (notification && !notification.isDestroyed() && notification.isVisible()) {
    notification.hide();
  }
}

export function destroyFloatingWindows(): void {
  if (miniRecorder && !miniRecorder.isDestroyed()) miniRecorder.destroy();
  if (notification && !notification.isDestroyed()) notification.destroy();
  miniRecorder = null;
  notification = null;
}

export function sendToMiniRecorder(channel: string, payload?: unknown): void {
  const win = getMiniRecorder();
  if (!win) return;
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", () =>
      win.webContents.send(channel, payload),
    );
  } else {
    win.webContents.send(channel, payload);
  }
}
