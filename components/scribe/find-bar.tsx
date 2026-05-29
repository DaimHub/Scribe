"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/**
 * Cmd+F find-in-page bar. Renders a small overlay in the top-right of the
 * app shell; delegates the actual text search to Electron's
 * `webContents.findInPage` so matches highlight in-place anywhere in the
 * current renderer DOM, exactly like Chromium's built-in find.
 *
 * The match count is rendered via `::after { content: attr(data-c) ... }`
 * (see `scribe-find-counter` in globals.css) so it never appears in the
 * searchable DOM text — otherwise a search for "1" or "/" would feed back
 * into its own counter and keep incrementing.
 */
export function FindBar() {
  const open = useScribe((s) => s.findOpen);
  const focusTick = useScribe((s) => s.findFocusTick);
  const close = useScribe((s) => s.closeFind);
  // Re-trigger the search whenever the user swaps the visible view — section
  // change, meeting tab change, or different meeting selected — so the
  // counter never lies about a DOM the user just navigated away from.
  const viewKey = useScribe(
    (s) => `${s.activeSection}:${s.meetingTab}:${s.selectedId ?? ""}`,
  );

  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matches, setMatches] = useState<{
    current: number;
    total: number;
    final: boolean;
  } | null>(null);
  // Last requestId we kicked off — used to ignore stale `found-in-page`
  // events when the user typed multiple characters in quick succession.
  const lastRequestId = useRef<number>(-1);

  // Native event subscription: filter on requestId so a slow search doesn't
  // overwrite the count from a newer one.
  useEffect(() => {
    if (typeof window === "undefined" || !window.scribe?.find) return;
    return window.scribe.find.onResult((payload) => {
      if (payload.requestId !== lastRequestId.current) return;
      setMatches({
        current: payload.activeMatchOrdinal,
        total: payload.matches,
        final: payload.finalUpdate,
      });
    });
  }, []);

  // Autofocus on open and re-focus when Cmd+F is pressed while already open.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, focusTick]);

  // When the bar closes (or unmounts), clear any active highlight so the
  // selection doesn't linger over the page contents.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setMatches(null);
    lastRequestId.current = -1;
  }, [open]);

  const runSearch = useCallback(
    async (
      text: string,
      opts: { forward?: boolean; findNext?: boolean } = {},
    ) => {
      if (!window.scribe?.find) return;
      if (!text) {
        setMatches(null);
        lastRequestId.current = -1;
        await window.scribe.find.stop("clearSelection");
        return;
      }
      const res = await window.scribe.find.start(text, {
        forward: opts.forward ?? true,
        findNext: opts.findNext ?? false,
        matchCase,
      });
      lastRequestId.current = res.requestId;
    },
    [matchCase],
  );

  // Re-run the search when the query (or match-case toggle) changes. A
  // distinct `findNext: false` request resets the cursor to the first match
  // for the new query — matches "type to filter" behavior in Chrome's bar.
  // viewKey is in the dep array so a section/tab switch re-runs against the
  // freshly mounted DOM instead of leaving a stale count on screen.
  useEffect(() => {
    if (!open) return;
    void runSearch(query, { findNext: false });
  }, [open, query, matchCase, viewKey, runSearch]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const forward = !e.shiftKey;
      void runSearch(query, { forward, findNext: true });
      return;
    }
    if (
      (e.metaKey || e.ctrlKey) &&
      !e.altKey &&
      (e.key === "g" || e.key === "G")
    ) {
      e.preventDefault();
      const forward = !e.shiftKey;
      void runSearch(query, { forward, findNext: true });
      return;
    }
  }

  if (!open) return null;

  const counterLabel =
    matches === null
      ? ""
      : matches.total === 0
        ? t("find.noMatches")
        : t("find.matches", { current: matches.current, total: matches.total });

  return (
    <div
      role="search"
      // Sits below the 48px topbar so it doesn't fight the Start Scribe
      // button and the traffic lights. Same right margin as the toasts.
      className="pointer-events-auto absolute right-4 top-16 z-50 flex w-[min(22rem,calc(100vw-2rem))] items-center gap-1 rounded-2xl border bg-card/95 p-1.5 pl-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-md animate-in fade-in-0 slide-in-from-top-2 duration-150"
    >
      <HugeiconsIcon
        icon={Search01Icon}
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("find.placeholder")}
        aria-label={t("find.placeholder")}
        className="h-8 flex-1 rounded-md border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
      />

      {/* Counter: visible via CSS-generated content so the digits never become
       *  searchable DOM text. `aria-label` keeps it accessible to screen
       *  readers without polluting the searched content. */}
      {matches !== null && (
        <span
          className={cn(
            "scribe-find-counter shrink-0 select-none text-xs tabular-nums",
            matches.total === 0
              ? "text-muted-foreground"
              : "text-muted-foreground",
          )}
          aria-label={counterLabel}
          data-current={matches.current}
          data-total={matches.total}
          data-empty={matches.total === 0 ? "true" : "false"}
          data-empty-label={t("find.noMatches")}
        />
      )}

      <button
        type="button"
        aria-pressed={matchCase}
        aria-label={t("find.matchCase")}
        title={t("find.matchCase")}
        onClick={() => setMatchCase((v) => !v)}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold transition-colors",
          matchCase
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        Aa
      </button>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          aria-label={t("find.previous")}
          title={t("find.previous")}
          disabled={!matches || matches.total === 0}
          onClick={() =>
            void runSearch(query, { forward: false, findNext: true })
          }
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={t("find.next")}
          title={t("find.next")}
          disabled={!matches || matches.total === 0}
          onClick={() =>
            void runSearch(query, { forward: true, findNext: true })
          }
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={t("find.close")}
          title={t("find.close")}
          onClick={close}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
