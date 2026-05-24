import { app, BrowserWindow, ipcMain, shell } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { installDisplayMediaHandler, registerAudioIpc } from "./ipc/audio.js";
import { registerMeetingsIpc } from "./ipc/meetings.js";
import { registerTranscribeIpc } from "./ipc/transcribe.js";
import { registerLlmIpc } from "./ipc/llm.js";
import { registerTreeIpc } from "./ipc/tree.js";
import { registerSidecarIpc } from "./ipc/sidecar.js";
import { registerVoiceIpc } from "./ipc/voice.js";
import { registerTagsIpc } from "./ipc/tags.js";
import { registerSearchIpc } from "./ipc/search.js";
import { registerPersonalTasksIpc } from "./ipc/personal-tasks.js";
import { registerCalendarIpc } from "./ipc/calendar.js";
import {
  notifyMainFocusChanged,
  registerFloatingIpc,
  setMainWindowGetter,
} from "./ipc/floating.js";
import { destroyFloatingWindows } from "./services/floating-windows.js";
import {
  startEventNotifier,
  stopEventNotifier,
} from "./services/event-notifier.js";
import { initDb } from "./services/db.js";
import { disposeCachedLlmModel } from "./services/llm.js";
import { recoverInterruptedMeetings } from "./services/recovery.js";
import { shutdownSidecar } from "./services/python-sidecar.js";
import {
  installMediaProtocolHandler,
  registerMediaProtocolScheme,
} from "./services/media-protocol.js";

// Privileged schemes must be registered before app `ready`.
registerMediaProtocolScheme();

const isDev = !app.isPackaged;
const DEV_URL = process.env.SCRIBE_DEV_URL ?? "http://localhost:3000";

const here = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(here, "preload.cjs");
const rendererIndex = path.join(here, "..", "out", "index.html");

let mainWindow: BrowserWindow | null = null;

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "Scribe",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#000000",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    await mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(rendererIndex);
  }

  mainWindow.on("focus", notifyMainFocusChanged);
  mainWindow.on("blur", notifyMainFocusChanged);
  mainWindow.on("show", notifyMainFocusChanged);
  mainWindow.on("hide", notifyMainFocusChanged);

  mainWindow.on("closed", () => {
    mainWindow = null;
    // Tear down floating helpers so they don't keep the app alive on Win/Linux
    // and don't fight the dock-click reopen flow on macOS.
    destroyFloatingWindows();
    notifyMainFocusChanged();
  });
}

ipcMain.handle("scribe:ping", () => ({ ok: true, at: Date.now() }));

app.whenReady().then(() => {
  // Register IPC handlers + protocols FIRST — they're synchronous and any
  // renderer-side fetch needs them ready. Then create the window (which
  // starts loading the renderer). The DB is initialized lazily by the first
  // IPC handler that needs it, so a slow disk no longer delays first paint.
  installMediaProtocolHandler();
  installDisplayMediaHandler();
  registerAudioIpc();
  registerMeetingsIpc();
  registerTranscribeIpc();
  registerLlmIpc();
  registerTreeIpc();
  registerSidecarIpc();
  registerVoiceIpc();
  registerTagsIpc();
  registerSearchIpc();
  registerPersonalTasksIpc();
  registerCalendarIpc();
  setMainWindowGetter(() => mainWindow);
  registerFloatingIpc();
  void createMainWindow();
  // Warm DB + recover interrupted recordings in parallel with window load.
  // Recovery calls initDb() internally and broadcasts tree invalidation when
  // it finalizes orphans, so the UI updates without an explicit wait.
  setImmediate(() => {
    try {
      initDb();
    } catch (err) {
      console.warn("DB init failed:", err);
    }
    void recoverInterruptedMeetings().catch((err) => {
      console.warn("Recovery scan failed:", err);
    });
    startEventNotifier();
  });
  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) void createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void disposeCachedLlmModel();
  void shutdownSidecar();
  stopEventNotifier();
  destroyFloatingWindows();
});
