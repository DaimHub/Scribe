"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Tree,
  type TreeApi,
  type MoveHandler,
  type RenameHandler,
} from "react-arborist";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { useScribe } from "@/lib/store";
import type { FolderRow, MeetingRow } from "@/lib/scribe-global";
import { TreeNode, type TreeNodeData } from "./tree-node";

function buildTreeData(
  folders: FolderRow[],
  meetings: MeetingRow[],
): TreeNodeData[] {
  const foldersByParent = new Map<string | null, FolderRow[]>();
  for (const f of folders) {
    const arr = foldersByParent.get(f.parent_id) ?? [];
    arr.push(f);
    foldersByParent.set(f.parent_id, arr);
  }
  for (const arr of foldersByParent.values()) {
    arr.sort((a, b) => a.position - b.position);
  }

  // Pinned meetings remain in their folder; the Pinned section above the tree
  // is a shortcut/bookmark, not a destination, so the meeting shows in both places.
  const meetingsByFolder = new Map<string | null, MeetingRow[]>();
  for (const m of meetings) {
    const arr = meetingsByFolder.get(m.folder_id) ?? [];
    arr.push(m);
    meetingsByFolder.set(m.folder_id, arr);
  }
  for (const arr of meetingsByFolder.values()) {
    arr.sort((a, b) => a.position - b.position);
  }

  function build(parentId: string | null): TreeNodeData[] {
    const out: TreeNodeData[] = [];
    const fs = foldersByParent.get(parentId) ?? [];
    const ms = meetingsByFolder.get(parentId) ?? [];

    // Merge by position so user can interleave folders and meetings.
    type Mixed = { position: number; node: TreeNodeData };
    const mixed: Mixed[] = [];
    for (const f of fs) {
      mixed.push({
        position: f.position,
        node: {
          id: f.id,
          name: f.name,
          kind: "folder",
          folder: f,
          children: build(f.id),
        },
      });
    }
    for (const m of ms) {
      mixed.push({
        position: m.position,
        node: { id: m.id, name: m.title, kind: "meeting", meeting: m },
      });
    }
    mixed.sort((a, b) => a.position - b.position);
    for (const x of mixed) out.push(x.node);
    return out;
  }

  return build(null);
}

export function TreeView() {
  const folders = useScribe((s) => s.folders);
  const meetings = useScribe((s) => s.meetings);
  const expandedIds = useScribe((s) => s.expandedFolderIds);
  const setExpanded = useScribe((s) => s.setExpanded);
  const selectedId = useScribe((s) => s.selectedId);
  const move = useScribe((s) => s.moveItem);
  const renameFolder = useScribe((s) => s.renameFolder);
  const renameMeeting = useScribe((s) => s.renameMeeting);
  const activeTagId = useScribe((s) => s.activeTagId);
  const tagPairs = useScribe((s) => s.meetingTagPairs);

  const filteredMeetings = useMemo(() => {
    if (!activeTagId) return meetings;
    const matching = new Set(
      tagPairs.filter((p) => p.tag_id === activeTagId).map((p) => p.meeting_id),
    );
    return meetings.filter((m) => matching.has(m.id));
  }, [meetings, tagPairs, activeTagId]);

  const data = useMemo(
    () => buildTreeData(folders, filteredMeetings),
    [folders, filteredMeetings],
  );

  const treeRef = useRef<TreeApi<TreeNodeData> | null>(null);

  // Sync expansion state from our store into react-arborist's open state on first render
  // and whenever data identity changes.
  useEffect(() => {
    const t = treeRef.current;
    if (!t) return;
    for (const id of expandedIds) {
      try {
        t.open(id);
      } catch {
        /* node may not exist yet */
      }
    }
  }, [data, expandedIds]);

  const onRename: RenameHandler<TreeNodeData> = async ({ id, name, node }) => {
    if (node.data.kind === "folder") {
      await renameFolder(id, name);
    } else {
      await renameMeeting(id, name);
    }
  };

  const onMove: MoveHandler<TreeNodeData> = async ({ dragIds, parentId, index }) => {
    // We process one at a time; react-arborist supports multi-select but our IPC moves singly.
    const map = new Map<string, TreeNodeData>();
    function walk(nodes: TreeNodeData[]) {
      for (const n of nodes) {
        map.set(n.id, n);
        if (n.kind === "folder") walk(n.children);
      }
    }
    walk(data);

    for (const id of dragIds) {
      const node = map.get(id);
      if (!node) continue;
      await move({
        itemId: id,
        kind: node.kind,
        newParentId: parentId,
        newPosition: index,
      });
    }
  };

  return (
    <div className="flex-1 overflow-hidden">
      <AutoSizer
        renderProp={({ width, height }) => {
          if (width == null || height == null) return null;
          return (
            <Tree<TreeNodeData>
              ref={treeRef}
              data={data}
              width={width}
              height={height}
              indent={14}
              rowHeight={28}
              paddingTop={4}
              paddingBottom={12}
              openByDefault={false}
              disableMultiSelection
              selection={selectedId ?? undefined}
              onMove={onMove}
              onRename={onRename}
              onToggle={(id) => {
                const isOpen = treeRef.current?.get(id)?.isOpen ?? false;
                setExpanded(id, isOpen);
              }}
              className="px-2"
            >
              {TreeNode}
            </Tree>
          );
        }}
      />
    </div>
  );
}
