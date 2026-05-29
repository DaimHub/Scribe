import { BrowserWindow, ipcMain } from "electron";
import {
  ensureVenv,
  isInstalled,
  selftest,
  type InstallProgress,
} from "../services/python-sidecar.js";
import {
  clearHfToken,
  getAiLanguage,
  getDisplayLanguage,
  getHfToken,
  hasHfToken,
  setAiLanguage,
  setDisplayLanguage,
  setHfToken,
  type AiLanguage,
  type DisplayLanguage,
} from "../services/settings.js";

function emitInstall(p: InstallProgress) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("whisperx:install-progress", p);
  }
}

export function registerSidecarIpc(): void {
  ipcMain.handle("whisperx:isInstalled", () => isInstalled());
  ipcMain.handle("whisperx:install", async () => {
    await ensureVenv(emitInstall);
    return { ok: true };
  });
  ipcMain.handle("whisperx:selftest", async () => {
    try {
      const r = await selftest();
      return { ok: true as const, versions: r.versions };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("settings:hasHfToken", () => hasHfToken());
  ipcMain.handle("settings:setHfToken", async (_e, token: string) => {
    await setHfToken(token);
    return { ok: true };
  });
  ipcMain.handle("settings:getHfTokenMasked", async () => {
    const t = await getHfToken();
    if (!t) return null;
    return t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-4)}` : "set";
  });
  ipcMain.handle("settings:clearHfToken", async () => {
    await clearHfToken();
    return { ok: true };
  });

  ipcMain.handle("settings:getDisplayLanguage", () => getDisplayLanguage());
  ipcMain.handle(
    "settings:setDisplayLanguage",
    async (_e, lang: DisplayLanguage) => {
      await setDisplayLanguage(lang);
      return { ok: true };
    },
  );
  ipcMain.handle("settings:getAiLanguage", () => getAiLanguage());
  ipcMain.handle("settings:setAiLanguage", async (_e, lang: AiLanguage) => {
    await setAiLanguage(lang);
    return { ok: true };
  });
}
