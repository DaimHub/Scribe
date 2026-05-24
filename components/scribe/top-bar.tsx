"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { SearchBar } from "./search-bar";
import { StartScribeButton } from "./start-scribe-button";
import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarLeft01Icon } from "@hugeicons/core-free-icons";

// macOS traffic-light cluster occupies roughly x=8..68; sit clear of it.
const MAC_TRAFFIC_LIGHTS_OFFSET = 78;

export function TopBar() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state !== "expanded";

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-3 border-b px-3 [-webkit-app-region:drag]">
      <div
        className="flex shrink-0 items-center"
        style={{ marginLeft: isCollapsed ? MAC_TRAFFIC_LIGHTS_OFFSET : 0 }}
      >
        {isCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Show sidebar (⌘B)"
            aria-label="Show sidebar"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [-webkit-app-region:no-drag]"
          >
            <HugeiconsIcon icon={SidebarLeft01Icon} className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 justify-center [-webkit-app-region:no-drag]">
        <div className="w-full max-w-xl">
          <SearchBar />
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <StartScribeButton />
      </div>
    </div>
  );
}
