"use client";

import { useEffect } from "react";
import type { NodeRendererProps } from "react-arborist";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Delete02Icon,
  Folder01Icon,
  FolderAddIcon,
  FolderOpenIcon,
  Mic01Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useScribe, formatDuration } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FolderRow, MeetingRow, MeetingStatus } from "@/lib/scribe-global";

const STATUS_DOT: Record<MeetingStatus, string> = {
  recording: "bg-red-500 animate-pulse",
  recorded: "bg-amber-500",
  transcribing: "bg-blue-500 animate-pulse",
  transcribed: "bg-blue-500",
  diarized: "bg-blue-500",
  done: "bg-emerald-500",
  error: "bg-destructive",
};

export type TreeNodeData =
  | {
      id: string;
      name: string;
      kind: "folder";
      folder: FolderRow;
      children: TreeNodeData[];
    }
  | {
      id: string;
      name: string;
      kind: "meeting";
      meeting: MeetingRow;
    };

interface IconBtnProps {
  icon: typeof PencilEdit01Icon;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
}

function IconBtn({ icon, label, onClick, variant = "default" }: IconBtnProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          variant === "destructive" && "hover:bg-destructive/10 hover:text-destructive",
        )}
        aria-label={label}
      >
        <HugeiconsIcon icon={icon} className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TreeNode({
  node,
  style,
  dragHandle,
}: NodeRendererProps<TreeNodeData>) {
  const data = node.data;
  const isFolder = data.kind === "folder";
  const selectedId = useScribe((s) => s.selectedId);
  const selectMeeting = useScribe((s) => s.selectMeeting);
  const startRecording = useScribe((s) => s.startRecording);
  const deleteMeeting = useScribe((s) => s.deleteMeeting);
  const deleteFolder = useScribe((s) => s.deleteFolder);
  const setPinned = useScribe((s) => s.setPinned);
  const createFolder = useScribe((s) => s.createFolder);
  const setFolderAutoTag = useScribe((s) => s.setFolderAutoTag);
  const t = useT();

  const isSelected = data.kind === "meeting" && selectedId === data.id;
  const tagPairs = useScribe((s) => s.meetingTagPairs);
  const allTags = useScribe((s) => s.allTags);
  const meetingTagDots = useMemo(() => {
    if (data.kind !== "meeting") return [] as string[];
    const ids = tagPairs
      .filter((p) => p.meeting_id === data.id)
      .map((p) => p.tag_id);
    const byId = new Map(allTags.map((tag) => [tag.id, tag]));
    return ids
      .map((id) => byId.get(id)?.color ?? null)
      .filter((c): c is string => !!c)
      .slice(0, 3);
  }, [data, tagPairs, allTags]);

  useEffect(() => {
    if (data.kind === "meeting" && isSelected && !node.isSelected) {
      node.select();
    }
  }, [data, isSelected, node]);

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "group flex h-full items-center gap-1.5 rounded-md pr-1 text-sm select-none",
        "transition-colors duration-150",
        node.willReceiveDrop && isFolder && "bg-accent",
        isSelected && "bg-card",
        !isSelected && !node.willReceiveDrop && "hover:bg-card/60",
      )}
      onClick={(e) => {
        if (isFolder) {
          if (e.detail === 2) {
            node.edit();
          } else {
            node.toggle();
          }
        } else {
          void selectMeeting(data.id);
        }
      }}
      onDoubleClick={() => {
        if (!isFolder) node.edit();
      }}
    >
      {isFolder ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground"
        >
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className={cn(
              "size-3 transition-transform",
              node.isOpen && "rotate-90",
            )}
          />
        </button>
      ) : (
        <div className="size-5 shrink-0" />
      )}

      {isFolder ? (
        <HugeiconsIcon
          icon={node.isOpen ? FolderOpenIcon : Folder01Icon}
          className="size-4 shrink-0 text-muted-foreground"
        />
      ) : (
        <>
          <span
            className={cn(
              "inline-block size-1.5 shrink-0 rounded-full",
              STATUS_DOT[data.meeting.status],
            )}
          />
          {meetingTagDots.map((c, i) => (
            <span
              key={i}
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{ background: c }}
            />
          ))}
        </>
      )}

      {isFolder && data.kind === "folder" && data.folder.auto_tag_id && (() => {
        const tag = allTags.find((at) => at.id === data.folder.auto_tag_id);
        if (!tag) return null;
        return (
          <span
            className="inline-block size-1.5 shrink-0 rounded-full"
            style={{ background: tag.color ?? "var(--muted-foreground)" }}
            title={t("tree.autoTagTooltip", { name: tag.name })}
            aria-label={t("tree.autoTagAria", { name: tag.name })}
          />
        );
      })()}

      {node.isEditing ? (
        <input
          autoFocus
          defaultValue={data.name}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const next = e.currentTarget.value.trim();
            if (!next || next === data.name) {
              node.reset();
              return;
            }
            node.submit(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") node.reset();
            e.stopPropagation();
          }}
          className="flex-1 min-w-0 rounded bg-background px-1 py-0 text-sm outline-none ring-1 ring-border focus:ring-foreground/40"
        />
      ) : (
        <span className="flex-1 truncate font-medium">{data.name}</span>
      )}

      {isFolder ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconBtn
            icon={PencilEdit01Icon}
            label={t("common.rename")}
            onClick={() => node.edit()}
          />
          <IconBtn
            icon={FolderAddIcon}
            label={t("tree.newFolderInside")}
            onClick={() => void createFolder(data.id)}
          />
          <IconBtn
            icon={Mic01Icon}
            label={t("tree.startMeetingInFolder")}
            onClick={() => void startRecording({ folderId: data.id })}
          />
          {data.kind === "folder" && (
            <FolderAutoTagMenu
              folderId={data.id}
              currentTagId={data.folder.auto_tag_id}
              onChange={(tagId) => void setFolderAutoTag(data.id, tagId)}
            />
          )}
          <IconBtn
            icon={Delete02Icon}
            label={t("tree.deleteFolder")}
            variant="destructive"
            onClick={() => {
              if (
                window.confirm(
                  t("tree.deleteFolderConfirm", { name: data.name }),
                )
              ) {
                void deleteFolder(data.id);
              }
            }}
          />
        </div>
      ) : (
        <>
          {data.kind === "meeting" && data.meeting.duration_ms != null && (
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">
              {formatDuration(data.meeting.duration_ms)}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  data.kind === "meeting" &&
                  void setPinned(data.id, !data.meeting.pinned)
                }
              >
                {data.kind === "meeting" && data.meeting.pinned
                  ? t("tree.unpin")
                  : t("tree.pinToTop")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => node.edit()}>
                {t("common.rename")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  if (
                    window.confirm(
                      t("tree.deleteMeetingConfirm", { name: data.name }),
                    )
                  ) {
                    void deleteMeeting(data.id);
                  }
                }}
              >
                {t("tree.deleteMeeting")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

function FolderAutoTagMenu({
  currentTagId,
  onChange,
}: {
  folderId: string;
  currentTagId: string | null;
  onChange: (tagId: string | null) => void;
}) {
  const allTags = useScribe((s) => s.allTags);
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        title={currentTagId ? t("tree.changeAutoTag") : t("tree.setAutoTag")}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-accent hover:text-foreground",
          currentTagId ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={t("tree.autoTag")}
      >
        <HugeiconsIcon icon={Tag01Icon} className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-64 w-56 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("tree.autoMoveHeading")}
        </div>
        <DropdownMenuItem onClick={() => onChange(null)}>
          <span className="text-muted-foreground">
            {currentTagId ? `✓ ${t("common.clear")}` : t("tasks.priority.none")}
          </span>
        </DropdownMenuItem>
        {allTags.length > 0 && <DropdownMenuSeparator />}
        {allTags.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t("tree.noTagsYet")}
          </div>
        ) : (
          allTags.map((tag) => (
            <DropdownMenuItem
              key={tag.id}
              onClick={() => onChange(tag.id === currentTagId ? null : tag.id)}
            >
              <span
                className="inline-block size-1.5 shrink-0 rounded-full"
                style={{ background: tag.color ?? "var(--muted-foreground)" }}
              />
              <span className="flex-1 truncate">{tag.name}</span>
              {tag.id === currentTagId && (
                <span className="text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
