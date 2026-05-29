import { BrowserWindow, ipcMain, type WebContents } from "electron";

/**
 * Cmd+F find-in-page. Delegates to Electron's native `findInPage` on the
 * calling window's webContents so matches highlight throughout the visible
 * DOM (same UX as Chromium's built-in find). The renderer owns the find-bar
 * UI; this layer just bridges to the native search.
 *
 * One in-flight request per webContents — we don't try to multiplex multiple
 * search sessions per window. `found-in-page` events from the webContents
 * are forwarded back to the renderer that owns the same webContents.
 */

interface FindOptions {
  forward?: boolean;
  findNext?: boolean;
  matchCase?: boolean;
}

const wired = new WeakSet<WebContents>();

function ensureForwarding(wc: WebContents): void {
  if (wired.has(wc)) return;
  wired.add(wc);
  wc.on("found-in-page", (_e, result) => {
    if (wc.isDestroyed()) return;
    wc.send("find:result", {
      requestId: result.requestId,
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
      finalUpdate: result.finalUpdate,
    });
  });
}

export function registerFindIpc(): void {
  ipcMain.handle(
    "find:start",
    (e, query: string, options: FindOptions | undefined) => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win || win.isDestroyed()) return { requestId: -1 };
      ensureForwarding(win.webContents);
      if (!query) {
        win.webContents.stopFindInPage("clearSelection");
        return { requestId: -1 };
      }
      const requestId = win.webContents.findInPage(query, {
        forward: options?.forward ?? true,
        findNext: options?.findNext ?? false,
        matchCase: options?.matchCase ?? false,
      });
      return { requestId };
    },
  );

  ipcMain.handle(
    "find:stop",
    (e, action: "clearSelection" | "keepSelection" | "activateSelection") => {
      const win = BrowserWindow.fromWebContents(e.sender);
      if (!win || win.isDestroyed()) return { ok: false };
      win.webContents.stopFindInPage(action ?? "clearSelection");
      return { ok: true };
    },
  );
}
