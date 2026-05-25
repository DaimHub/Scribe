import { randomUUID } from "node:crypto";
import { initDb, type FolderRow, type MeetingRow } from "./db.js";
import { broadcastTreeInvalidated } from "./broadcast.js";

export type TreeItemKind = "folder" | "meeting";

export interface MoveTarget {
  itemId: string;
  kind: TreeItemKind;
  newParentId: string | null; // null = root
  // 0-based index within the new parent. -1 / undefined means "append to end".
  newPosition?: number;
}

export interface TreeSnapshot {
  folders: FolderRow[];
  meetings: MeetingRow[];
}

function siblingsForFolder(
  parentId: string | null,
): Array<{ id: string; kind: TreeItemKind; position: number }> {
  const db = initDb();
  const folders = db
    .prepare(
      `SELECT id, position FROM folders WHERE parent_id IS ? ORDER BY position ASC, name ASC`,
    )
    .all(parentId) as Array<{ id: string; position: number }>;
  const meetings = db
    .prepare(
      `SELECT id, position FROM meetings WHERE folder_id IS ? AND pinned = 0 ORDER BY position ASC, started_at_ms DESC`,
    )
    .all(parentId) as Array<{ id: string; position: number }>;
  // Unified position across folders + meetings within a parent.
  return [
    ...folders.map((f) => ({ id: f.id, kind: "folder" as const, position: f.position })),
    ...meetings.map((m) => ({ id: m.id, kind: "meeting" as const, position: m.position })),
  ].sort((a, b) => a.position - b.position);
}

function renumberSiblings(
  parentId: string | null,
  ordered: Array<{ id: string; kind: TreeItemKind }>,
): void {
  const db = initDb();
  const updFolder = db.prepare(
    `UPDATE folders SET position = ?, parent_id = ? WHERE id = ?`,
  );
  const updMeeting = db.prepare(
    `UPDATE meetings SET position = ?, folder_id = ? WHERE id = ?`,
  );
  ordered.forEach((item, i) => {
    if (item.kind === "folder") {
      updFolder.run(i, parentId, item.id);
    } else {
      updMeeting.run(i, parentId, item.id);
    }
  });
}

export function listTree(): TreeSnapshot {
  const db = initDb();
  const folders = db
    .prepare(
      `SELECT id, parent_id, name, position, created_at_ms, auto_tag_id FROM folders ORDER BY parent_id, position ASC, name ASC`,
    )
    .all() as unknown as FolderRow[];
  const meetings = db
    .prepare(`SELECT * FROM meetings ORDER BY started_at_ms DESC`)
    .all() as unknown as MeetingRow[];
  return { folders, meetings };
}

export function createFolder(opts: {
  name: string;
  parentId: string | null;
}): FolderRow {
  const db = initDb();
  const id = randomUUID();
  const peers = siblingsForFolder(opts.parentId);
  const position = peers.filter((p) => p.kind === "folder").length;
  db.prepare(
    `INSERT INTO folders (id, parent_id, name, position, created_at_ms) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, opts.parentId, opts.name.trim() || "Untitled folder", position, Date.now());
  broadcastTreeInvalidated();
  return {
    id,
    parent_id: opts.parentId,
    name: opts.name.trim() || "Untitled folder",
    position,
    created_at_ms: Date.now(),
    auto_tag_id: null,
  };
}

export function renameFolder(id: string, name: string): void {
  const next = name.trim();
  if (!next) return;
  initDb().prepare(`UPDATE folders SET name = ? WHERE id = ?`).run(next, id);
  broadcastTreeInvalidated();
}

/**
 * Associate a tag with a folder so future meeting↔tag attachments auto-move
 * the meeting into this folder. Pass null to clear. Unique by tag — assigning
 * a tag to a new folder removes it from any previous folder. Doesn't move
 * already-tagged meetings (would be surprising mass relocation).
 */
export function setFolderAutoTag(folderId: string, tagId: string | null): void {
  const db = initDb();
  if (tagId) {
    db.prepare(`UPDATE folders SET auto_tag_id = NULL WHERE auto_tag_id = ?`).run(tagId);
  }
  db.prepare(`UPDATE folders SET auto_tag_id = ? WHERE id = ?`).run(tagId, folderId);
  broadcastTreeInvalidated();
}

/** Returns the folder_id associated with this tag, or null. */
export function getFolderIdForAutoTag(tagId: string): string | null {
  const row = initDb()
    .prepare(`SELECT id FROM folders WHERE auto_tag_id = ? LIMIT 1`)
    .get(tagId) as { id: string } | undefined;
  return row?.id ?? null;
}

/**
 * Delete a folder, promoting its children (subfolders + meetings) up to the deleted folder's parent.
 * Children are appended to the end of the parent's existing list.
 */
export function deleteFolder(id: string): void {
  const db = initDb();
  const folder = db
    .prepare(`SELECT parent_id FROM folders WHERE id = ?`)
    .get(id) as { parent_id: string | null } | undefined;
  if (!folder) return;

  const newParentId = folder.parent_id;
  const tx = db.exec.bind(db);
  void tx; // not using exec for transactions; using prepared statements below.

  // Determine starting positions in the new parent
  const peers = siblingsForFolder(newParentId);
  const startFolderPos = peers.filter((p) => p.kind === "folder").length;
  const startMeetingPos = peers.filter((p) => p.kind === "meeting").length;

  const childFolders = db
    .prepare(`SELECT id FROM folders WHERE parent_id IS ? ORDER BY position ASC`)
    .all(id) as Array<{ id: string }>;
  const childMeetings = db
    .prepare(`SELECT id FROM meetings WHERE folder_id IS ? ORDER BY position ASC`)
    .all(id) as Array<{ id: string }>;

  const updFolder = db.prepare(
    `UPDATE folders SET parent_id = ?, position = ? WHERE id = ?`,
  );
  const updMeeting = db.prepare(
    `UPDATE meetings SET folder_id = ?, position = ? WHERE id = ?`,
  );

  db.exec("BEGIN");
  try {
    for (let i = 0; i < childFolders.length; i++) {
      updFolder.run(newParentId, startFolderPos + i, childFolders[i].id);
    }
    for (let i = 0; i < childMeetings.length; i++) {
      updMeeting.run(newParentId, startMeetingPos + i, childMeetings[i].id);
    }
    db.prepare(`DELETE FROM folders WHERE id = ?`).run(id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  broadcastTreeInvalidated();
}

function isAncestor(maybeAncestorId: string, descendantId: string): boolean {
  if (maybeAncestorId === descendantId) return true;
  const db = initDb();
  let current: string | null = descendantId;
  let depth = 0;
  while (current && depth < 128) {
    const row = db
      .prepare(`SELECT parent_id FROM folders WHERE id = ?`)
      .get(current) as { parent_id: string | null } | undefined;
    if (!row) return false;
    if (row.parent_id === maybeAncestorId) return true;
    current = row.parent_id;
    depth++;
  }
  return false;
}

export function moveItem(target: MoveTarget): void {
  const db = initDb();

  // Guard: don't allow moving a folder inside itself or its descendants
  if (target.kind === "folder" && target.newParentId) {
    if (isAncestor(target.itemId, target.newParentId)) {
      throw new Error("Cannot move a folder into one of its descendants.");
    }
  }

  // Build the new ordered list for the destination parent, with this item inserted.
  const currentSiblings: Array<{ id: string; kind: TreeItemKind }> = siblingsForFolder(
    target.newParentId,
  )
    .filter((s) => !(s.kind === target.kind && s.id === target.itemId))
    .map(({ id, kind }) => ({ id, kind }));

  const insertItem: { id: string; kind: TreeItemKind } = {
    id: target.itemId,
    kind: target.kind,
  };
  const ordered = [...currentSiblings];
  if (target.newPosition == null || target.newPosition < 0 || target.newPosition >= ordered.length) {
    ordered.push(insertItem);
  } else {
    ordered.splice(target.newPosition, 0, insertItem);
  }

  db.exec("BEGIN");
  try {
    // First, if cross-parent, set the new parent on the item itself
    if (target.kind === "folder") {
      db.prepare(`UPDATE folders SET parent_id = ? WHERE id = ?`).run(
        target.newParentId,
        target.itemId,
      );
    } else {
      db.prepare(`UPDATE meetings SET folder_id = ? WHERE id = ?`).run(
        target.newParentId,
        target.itemId,
      );
    }
    // Then renumber all siblings (including the moved item) in the new parent
    renumberSiblings(target.newParentId, ordered);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  broadcastTreeInvalidated();
}

export function setMeetingPinned(meetingId: string, pinned: boolean): void {
  initDb().prepare(`UPDATE meetings SET pinned = ? WHERE id = ?`).run(pinned ? 1 : 0, meetingId);
  broadcastTreeInvalidated();
}
