"use client";

import { SearchBar } from "./search-bar";
import { StartScribeButton } from "./start-scribe-button";

export function TopBar() {
  return (
    <div className="relative flex h-12 shrink-0 items-center gap-3 border-b px-3 [-webkit-app-region:drag]">
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
