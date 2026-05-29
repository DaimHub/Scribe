"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import { useScribe, formatDuration } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { MeetingRow, MeetingStatus } from "@/lib/scribe-global";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, PinIcon } from "@hugeicons/core-free-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_DOT: Record<MeetingStatus, string> = {
  recording: "bg-red-500 animate-pulse",
  recorded: "bg-amber-500",
  transcribing: "bg-blue-500 animate-pulse",
  transcribed: "bg-blue-500",
  diarized: "bg-blue-500",
  done: "bg-emerald-500",
  error: "bg-destructive",
};

const PIN_ORDER_KEY = "scribe:pinnedOrder";

function loadOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIN_ORDER_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

function saveOrder(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIN_ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function PinnedSection() {
  const meetings = useScribe((s) => s.meetings);
  const t = useT();
  const [order, setOrder] = useState<string[]>(() => loadOrder());

  const pinned = useMemo(() => {
    const list = meetings.filter((m) => m.pinned);
    // Stable order: respect user-set order from localStorage, append any new pins
    const byId = new Map(list.map((m) => [m.id, m]));
    const ordered: MeetingRow[] = [];
    for (const id of order) {
      const m = byId.get(id);
      if (m) {
        ordered.push(m);
        byId.delete(id);
      }
    }
    // Newly pinned items go to the top
    return [...Array.from(byId.values()), ...ordered];
  }, [meetings, order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  if (pinned.length === 0) return null;

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = pinned.map((m) => m.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(ids, from, to);
    setOrder(next);
    saveOrder(next);
  }

  return (
    <>
      <div className="flex items-center gap-1.5 px-4 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <HugeiconsIcon icon={PinIcon} className="size-3" />
        {t("pinned.heading")}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        autoScroll={false}
      >
        <SortableContext
          items={pinned.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-px px-2 pb-3">
            {pinned.map((m) => (
              <PinnedItem key={m.id} meeting={m} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </>
  );
}

function PinnedItem({ meeting }: { meeting: MeetingRow }) {
  const selectedId = useScribe((s) => s.selectedId);
  const select = useScribe((s) => s.selectMeeting);
  const setPinned = useScribe((s) => s.setPinned);
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: meeting.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const isSelected = selectedId === meeting.id;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => void select(meeting.id)}
      className={cn(
        "group flex cursor-default items-center gap-1.5 rounded-md px-2.5 py-1 text-left text-sm select-none",
        "transition-colors",
        isSelected ? "bg-card" : "hover:bg-card/60",
        isDragging && "opacity-40",
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 shrink-0 rounded-full",
          STATUS_DOT[meeting.status],
        )}
      />
      <span className="flex-1 truncate font-medium">{meeting.title}</span>
      {meeting.duration_ms != null && (
        <span className="hidden font-mono text-[10px] tabular-nums text-muted-foreground group-hover:inline">
          {formatDuration(meeting.duration_ms)}
        </span>
      )}
      <Tooltip>
        <TooltipTrigger
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void setPinned(meeting.id, false);
          }}
          aria-label={t("tree.unpin")}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
        </TooltipTrigger>
        <TooltipContent>{t("tree.unpin")}</TooltipContent>
      </Tooltip>
    </li>
  );
}
