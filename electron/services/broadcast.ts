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

/**
 * Fire when the global voice_library table changes — new entries created
 * from a speaker assignment, renames, deletes, or embeddings merged after
 * a transcription run. Any open renderer that depends on the library list
 * (People tab, tagging popover) should refetch.
 */
export const VOICE_LIBRARY_CHANGED = "voice:libraryChanged";

export function broadcastVoiceLibraryChanged(): void {
  broadcast(VOICE_LIBRARY_CHANGED);
}
