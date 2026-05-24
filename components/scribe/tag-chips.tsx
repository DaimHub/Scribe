"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TagRow } from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  PlusSignIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";

export function TagChips({ meetingId }: { meetingId: string }) {
  const tagsById = useScribe((s) => s.meetingTagsById);
  const allTags = useScribe((s) => s.allTags);
  const attach = useScribe((s) => s.attachTag);
  const detach = useScribe((s) => s.detachTag);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const tags = tagsById[meetingId] ?? [];

  async function commit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      setOpen(false);
      return;
    }
    await attach(meetingId, trimmed);
    setDraft("");
    setOpen(false);
  }

  const suggestions = allTags
    .filter(
      (t) =>
        draft.trim().length > 0 &&
        t.name.toLowerCase().includes(draft.trim().toLowerCase()) &&
        !tags.some((u) => u.id === t.id),
    )
    .slice(0, 6);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagPill
          key={t.id}
          tag={t}
          onRemove={() => void detach(meetingId, t.id)}
        />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={(props) => (
            <button
              type="button"
              {...props}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed px-2 text-[11px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <HugeiconsIcon icon={PlusSignIcon} className="size-2.5" />
              Add tag
            </button>
          )}
        />
        <PopoverContent side="bottom" align="start" className="w-52 p-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit(draft);
              if (e.key === "Escape") {
                setDraft("");
                setOpen(false);
              }
            }}
            placeholder="tag name…"
            className="h-7 w-full rounded-md bg-transparent px-2 text-[12px] outline-none focus:bg-accent/40"
          />
          {suggestions.length > 0 && (
            <ul className="mt-1 flex max-h-48 flex-col gap-px overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void commit(s.name)}
                    className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[12px] hover:bg-accent"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: s.color ?? "#888" }}
                    />
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function TagPill({
  tag,
  onRemove,
  size = "md",
}: {
  tag: TagRow;
  onRemove?: () => void;
  size?: "sm" | "md";
}) {
  const { pillStyle, dotStyle } = useMemo(() => {
    const c = tag.color ?? "#888";
    return {
      pillStyle: {
        borderColor: `${c}55`,
        backgroundColor: `${c}10`,
        color: c,
      },
      dotStyle: { background: c },
    };
  }, [tag.color]);
  return (
    <Badge
      variant="outline"
      className={cn(
        "group gap-1 px-2 font-medium",
        size === "sm" ? "h-5 text-[10px]" : "h-6 text-[11px]",
      )}
      style={pillStyle}
      title={tag.auto ? "Auto-tag from notes" : undefined}
    >
      {tag.auto ? (
        <HugeiconsIcon icon={SparklesIcon} className="size-2.5 opacity-80" />
      ) : (
        <span
          className="size-1.5 rounded-full"
          style={dotStyle}
        />
      )}
      <span>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag.name}`}
          className="inline-flex size-3.5 items-center justify-center rounded-full text-current opacity-0 transition-opacity hover:bg-current/15 group-hover:opacity-100"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-2.5" />
        </button>
      )}
    </Badge>
  );
}
