"use client";

import type { NotesTemplate } from "@/lib/scribe-global";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface Props {
  templates: NotesTemplate[];
  /** Currently active template for the meeting, after fallback to global
   *  default. Renders a check mark next to this entry. */
  selectedId: string;
  /** Fired when the user picks a template. Caller is responsible for
   *  persisting the choice on the meeting AND triggering the action that
   *  should follow (generate / regenerate / process).
   *
   *  Note: we use plain DropdownMenuItems instead of RadioGroup because
   *  selecting the already-active item is a meaningful action here ("run
   *  again with the current template"), and RadioGroup suppresses that. */
  onPick: (templateId: string) => void;
}

export function TemplateMenuItems({ templates, selectedId, onPick }: Props) {
  return (
    <>
      {templates.map((tpl) => {
        const active = tpl.id === selectedId;
        return (
          <DropdownMenuItem key={tpl.id} onClick={() => onPick(tpl.id)}>
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center",
                active ? "text-foreground" : "text-transparent",
              )}
              aria-hidden
            >
              <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
            </span>
            <span className="truncate">{tpl.name}</span>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
