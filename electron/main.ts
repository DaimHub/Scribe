import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
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
import { registerMcpIpc } from "./ipc/mcp.js";
import { registerFindIpc } from "./ipc/find.js";
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
import {
  startMcpWriteWatcher,
  stopMcpWriteWatcher,
} from "./services/mcp-watch.js";
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
let splashWindow: BrowserWindow | null = null;
let revealTimer: ReturnType<typeof setTimeout> | null = null;

// Themed loading splash shown while the renderer (~2s of bundle load + first
// paint) comes up, so launch shows a branded spinner instead of a black
// window. Inline data-URL HTML keeps it dependency-free and out of the build.
function splashMarkup(dark: boolean): string {
  const bg = dark ? "#171717" : "#ffffff";
  const fg = dark ? "#fafafa" : "#0a0a0a";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const track = dark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.10)";
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:transparent;overflow:hidden}
    body{display:flex;align-items:center;justify-content:center;cursor:default;
      -webkit-user-select:none;user-select:none;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
    .card{display:flex;flex-direction:column;align-items:center;gap:18px;
      width:300px;height:180px;justify-content:center;background:${bg};
      color:${fg};border:1px solid ${border};border-radius:22px;
      box-shadow:0 18px 50px rgba(0,0,0,.30)}
    .spinner{width:34px;height:34px;border-radius:50%;
      border:3px solid ${track};border-top-color:#8b5cf6;
      animation:spin .7s linear infinite}
    .word{font-size:17px;font-weight:600;letter-spacing:-.01em}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style><div class="card"><div class="spinner"></div><div class="word">Scribe</div></div>`;
}

function showSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) return;
  splashWindow = new BrowserWindow({
    width: 320,
    height: 200,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    hasShadow: true,
    show: false,
    center: true,
    title: "Scribe",
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  splashWindow.once("ready-to-show", () => splashWindow?.show());
  void splashWindow.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(splashMarkup(nativeTheme.shouldUseDarkColors)),
  );
}

// Reveal the main window and tear down the splash. Invoked from ready-to-show
// (the happy path), did-fail-load, and a timeout fallback — so a renderer that
// never paints can't strand the user on the splash forever.
function revealMain() {
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

async function createMainWindow() {
  showSplash();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "Scribe",
    titleBarStyle: "hiddenInset",
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#ffffff",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", revealMain);
  mainWindow.webContents.on(
    "did-fail-load",
    (_e, _code, _desc, _url, isMainFrame) => {
      if (isMainFrame) revealMain();
    },
  );
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(revealMain, 12000);

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
  registerMcpIpc();
  registerFindIpc();
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
    // The MCP server writes to the DB out-of-process; watch its audit log so
    // open renderers refresh when Claude edits a meeting.
    startMcpWriteWatcher();
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
  stopMcpWriteWatcher();
  destroyFloatingWindows();
});
