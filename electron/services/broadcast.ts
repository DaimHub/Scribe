import { BrowserWindow } from "electron";

/**
 * Send an event to every open renderer window. Used for invalidation pings
 * (the renderer refetches what it needs) — not for payloads, since multiple
 * windows would each re-serialize identical data.
 */
export function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(channel, payload);
  }
}

export const TREE_INVALIDATED = "tree:invalidated";

export function broadcastTreeInvalidated(): void {
  broadcast(TREE_INVALIDATED);
}
