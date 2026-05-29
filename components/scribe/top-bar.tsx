"use client";

import { SearchBar } from "./search-bar";
import { StartScribeButton } from "./start-scribe-button";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon } from "@hugeicons/core-free-icons";
import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function TopBar() {
  const t = useT();
  const refresh = useScribe((s) => s.refreshActiveView);
  const refreshing = useScribe((s) => s.refreshing);

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-3 border-b px-3 [-webkit-app-region:drag]">
      <div className="flex flex-1 justify-center [-webkit-app-region:no-drag]">
        <div className="w-full max-w-xl">
          <SearchBar />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label={t("topbar.refresh")}
          title={t("topbar.refresh")}
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            className={cn("size-4", refreshing && "animate-spin")}
          />
        </Button>
        <StartScribeButton />
      </div>
    </div>
  );
}
