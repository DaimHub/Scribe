"use client";

import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

/**
 * Top-bar pill that opens the command palette. The palette itself
 * (CommandPalette) owns the input, search, and result list — this is just an
 * affordance. Cmd+K from anywhere also opens the palette via the global
 * shortcut handler in app-shell.
 */
export function SearchBar() {
  const openPalette = useScribe((s) => s.openPalette);
  const t = useT();

  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-full border bg-background pl-3 pr-2 text-left text-sm",
        "text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
        "[-webkit-app-region:no-drag]",
      )}
      aria-label={t("palette.openHint")}
    >
      <HugeiconsIcon
        icon={Search01Icon}
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="flex-1 truncate text-[13px] text-muted-foreground/80">
        {t("palette.openHint")}
      </span>
      <kbd
        className="ml-1 hidden shrink-0 items-center rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex"
        aria-hidden
      >
        ⌘K
      </kbd>
    </button>
  );
}
