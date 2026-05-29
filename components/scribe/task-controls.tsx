"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useT, type TranslateFn } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Calendar03Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { SpeakerAvatar } from "./speaker-avatar";

export type DueFilter = "all" | "overdue" | "today" | "week" | "none";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function matchesDueFilter(
  dueAtMs: number | null,
  filter: DueFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "none") return dueAtMs == null;
  if (dueAtMs == null) return false;
  const today = startOfDayMs(Date.now());
  const due = startOfDayMs(dueAtMs);
  if (filter === "overdue") return due < today;
  if (filter === "today") return due === today;
  return due >= today && due < today + 7 * DAY_MS; // "week"
}

export function priorityLabel(level: number, t: TranslateFn): string {
  switch (level) {
    case 3:
      return t("tasks.priority.high");
    case 2:
      return t("tasks.priority.medium");
    case 1:
      return t("tasks.priority.low");
    default:
      return t("tasks.priority.none");
  }
}

export function dueFilterLabel(due: DueFilter, t: TranslateFn): string {
  switch (due) {
    case "overdue":
      return t("tasks.group.overdue");
    case "today":
      return t("tasks.group.today");
    case "week":
      return t("tasks.group.thisWeek");
    case "none":
      return t("tasks.group.noDate");
    default:
      return t("tasks.filter.dueAny");
  }
}

export function formatDueShort(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(
  dueAtMs: number | null,
  done: boolean | number,
): boolean {
  if (dueAtMs == null || done) return false;
  return startOfDayMs(dueAtMs) < startOfDayMs(Date.now());
}

export function FilterPill({
  icon,
  active,
  label,
  onClear,
  children,
}: {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  active: boolean;
  label: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <DropdownMenu>
      <div
        className={cn(
          "inline-flex items-center rounded-full border text-[13px] transition-colors",
          active
            ? "border-foreground/20 bg-accent text-foreground"
            : "border-dashed border-input text-muted-foreground hover:text-foreground",
        )}
      >
        <DropdownMenuTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 outline-none",
                active && "pr-1.5",
              )}
            >
              <HugeiconsIcon icon={icon} className="size-3.5" />
              <span className={cn(active && "font-medium")}>{label}</span>
              {!active && (
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className="size-3 opacity-60"
                />
              )}
            </button>
          )}
        />
        {active && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t("tasks.filter.clear")}
            className="flex h-8 items-center rounded-r-full pr-2.5 pl-1 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        )}
      </div>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityBars({
  level,
  className,
  label,
}: {
  level: number;
  className?: string;
  // When set, the bars become an accessible image (announced to screen
  // readers). Omit inside an already-labelled control (e.g. PriorityPicker)
  // so the bars stay decorative and don't double-announce.
  label?: string;
}) {
  const color =
    level >= 3
      ? "bg-red-500"
      : level === 2
        ? "bg-amber-500"
        : level === 1
          ? "bg-sky-500"
          : "";
  const heights = ["h-1.5", "h-2", "h-2.5"];
  return (
    <span
      className={cn("inline-flex items-end gap-px", className)}
      {...(label
        ? { role: "img", "aria-label": label, title: label }
        : { "aria-hidden": true })}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-[1px]",
            heights[i],
            i < level ? color : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

export function PriorityPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            aria-label={t("tasks.priority.set")}
            title={priorityLabel(value, t)}
            className="flex size-6 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent"
          >
            <PriorityBars level={value} />
          </button>
        )}
      />
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuRadioGroup
          value={String(value)}
          onValueChange={(v) => onChange(Number(v))}
        >
          {[3, 2, 1, 0].map((lvl) => (
            <DropdownMenuRadioItem key={lvl} value={String(lvl)}>
              <PriorityBars level={lvl} className="mr-1" />
              {priorityLabel(lvl, t)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssigneePicker({
  speakers,
  value,
  onChange,
}: {
  speakers: Array<{ speaker_id: string; display_name: string }>;
  value: string | null;
  onChange: (speakerId: string | null) => void;
}) {
  const t = useT();
  const NONE = "__none__";
  const current = value ? speakers.find((s) => s.speaker_id === value) : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] outline-none hover:bg-accent"
          >
            {current ? (
              <>
                <SpeakerAvatar
                  speakerId={current.speaker_id}
                  displayName={current.display_name}
                  className="size-4 text-[8px] ring-0"
                />
                <span className="max-w-[120px] truncate">
                  {current.display_name}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {t("notes.unassigned")}
              </span>
            )}
          </button>
        )}
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup
          value={value ?? NONE}
          onValueChange={(v) => onChange(v === NONE ? null : v)}
        >
          <DropdownMenuRadioItem value={NONE}>
            {t("notes.unassigned")}
          </DropdownMenuRadioItem>
          {speakers.length > 0 && <DropdownMenuSeparator />}
          {speakers.map((s) => (
            <DropdownMenuRadioItem key={s.speaker_id} value={s.speaker_id}>
              <SpeakerAvatar
                speakerId={s.speaker_id}
                displayName={s.display_name}
                className="mr-1 size-4 text-[8px] ring-0"
              />
              {s.display_name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function toDateInput(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromDateInput(s: string): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

export function DueDatePicker({
  value,
  onChange,
  done,
}: {
  value: number | null;
  onChange: (ms: number | null) => void;
  done?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const overdue = isOverdue(value, !!done);
  function pick(ms: number | null) {
    onChange(ms);
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] outline-none hover:bg-accent",
              value == null && "border-dashed text-muted-foreground",
              overdue && "border-destructive/40 text-destructive",
            )}
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-3" />
            {value != null ? formatDueShort(value) : t("tasks.due.set")}
          </button>
        )}
      />
      <PopoverContent align="end" className="w-52 p-1.5">
        <div className="flex flex-col">
          <PresetRow
            label={t("tasks.group.today")}
            onClick={() => pick(startOfDayMs(Date.now()))}
          />
          <PresetRow
            label={t("tasks.due.tomorrow")}
            onClick={() => pick(startOfDayMs(Date.now()) + DAY_MS)}
          />
          <PresetRow
            label={t("tasks.due.nextWeek")}
            onClick={() => pick(startOfDayMs(Date.now()) + 7 * DAY_MS)}
          />
          <div className="my-1 border-t" />
          <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
            {t("tasks.due.custom")}
          </div>
          <input
            type="date"
            className="mx-1 mb-1 rounded-md border bg-transparent px-2 py-1 text-[12px] outline-none focus-visible:border-ring"
            value={value != null ? toDateInput(value) : ""}
            onChange={(e) => {
              const ms = fromDateInput(e.target.value);
              if (ms != null) pick(ms);
            }}
          />
          {value != null && (
            <>
              <div className="my-1 border-t" />
              <PresetRow
                label={t("tasks.due.clear")}
                onClick={() => pick(null)}
                tone="muted"
              />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetRow({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone?: "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1.5 text-left text-[13px] outline-none hover:bg-accent",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
