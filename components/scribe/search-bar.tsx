"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useScribe } from "@/lib/store";
import type { MeetingSearchHit } from "@/lib/scribe-global";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";

type MatchKind = MeetingSearchHit["matched_in"];

const GROUP_ORDER: MatchKind[] = ["title", "tag", "summary", "transcript"];

const GROUP_LABEL: Record<MatchKind, string> = {
  title: "Meetings",
  transcript: "Transcripts",
  tag: "Tags",
  summary: "Summaries",
};

/**
 * Top-bar search omnibox. A pill input that shows an anchored, grouped
 * dropdown of matches while the user types.
 *
 * Behaviour:
 *  - Cmd/Ctrl+K from anywhere focuses the input
 *  - Type to search (debounced 180 ms)
 *  - ↑ / ↓ / Home / End / Enter on the highlighted match
 *  - Esc clears the input (first press) and closes the dropdown
 *
 * Focus stays in the input the whole time — virtual highlight via
 * `aria-activedescendant`.
 */
export function SearchBar() {
  const query = useScribe((s) => s.searchQuery);
  const setQuery = useScribe((s) => s.setSearchQuery);
  const runSearch = useScribe((s) => s.runSearch);
  const clear = useScribe((s) => s.clearSearch);
  const searching = useScribe((s) => s.searching);
  const results = useScribe((s) => s.searchResults);
  const select = useScribe((s) => s.selectMeeting);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // Group + flatten the results so the dropdown can render section headers
  // while keyboard nav still operates on a single ordered list of selectable
  // items. `orderedResults` is the canonical ordering used for highlight indices.
  const { grouped, orderedResults } = useMemo(() => {
    const byKind = new Map<MatchKind, MeetingSearchHit[]>();
    for (const r of results) {
      const arr = byKind.get(r.matched_in) ?? [];
      arr.push(r);
      byKind.set(r.matched_in, arr);
    }
    const ordered: MeetingSearchHit[] = [];
    const groups: Array<{ kind: MatchKind; items: MeetingSearchHit[]; startIndex: number }> = [];
    for (const kind of GROUP_ORDER) {
      const items = byKind.get(kind);
      if (!items || items.length === 0) continue;
      groups.push({ kind, items, startIndex: ordered.length });
      ordered.push(...items);
    }
    return { grouped: groups, orderedResults: ordered };
  }, [results]);

  const resultsKey = useMemo(
    () => orderedResults.map((r) => `${r.meeting_id}:${r.matched_in}`).join("|"),
    [orderedResults],
  );

  // Debounced search-on-type.
  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      void runSearch("");
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(q);
    }, 180);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Open while there's a query; close when emptied.
  useEffect(() => {
    setOpen(query.trim().length > 0);
  }, [query]);

  // Reset highlight whenever the result set changes.
  useEffect(() => {
    setHighlight(0);
  }, [resultsKey]);

  // Outside-click closes the dropdown without disturbing the input.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Global Cmd/Ctrl+K focuses the search input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      if (cmdOrCtrl && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.select();
        if (query.trim().length > 0) setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);

  // Scroll the highlighted row into view when navigating by keyboard.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const showDropdown = open && query.trim().length > 0;

  function pick(index: number) {
    const r = orderedResults[index];
    if (!r) return;
    void select(r.meeting_id);
    setOpen(false);
    clear();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (query) clear();
      setOpen(false);
      return;
    }
    if (!showDropdown || orderedResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((i) => Math.min(i + 1, orderedResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(orderedResults.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        pick(highlight);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-full border bg-background pl-3 pr-2 text-sm",
          "focus-within:border-ring/40",
          "[-webkit-app-region:no-drag]",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <HugeiconsIcon
          icon={Search01Icon}
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground",
            searching && "animate-pulse",
          )}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length > 0) setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Search meetings, transcript, tags…"
          className="h-full w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={
            showDropdown && orderedResults[highlight]
              ? `search-result-${highlight}`
              : undefined
          }
        />
        {!query && (
          <kbd
            className="ml-1 hidden shrink-0 items-center rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex"
            aria-hidden
          >
            ⌘K
          </kbd>
        )}
        {query && (
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              clear();
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-2 flex max-h-[60vh] flex-col rounded-lg border bg-popover text-popover-foreground",
            "[-webkit-app-region:no-drag]",
          )}
          onPointerDown={(e) => {
            if (
              e.target instanceof HTMLElement &&
              e.target.closest("[data-result-item]")
            ) {
              return;
            }
            e.preventDefault();
          }}
        >
          <div className="flex-1 overflow-y-auto p-1">
            <SearchResultsList
              listRef={listRef}
              query={query}
              grouped={grouped}
              orderedCount={orderedResults.length}
              searching={searching}
              highlight={highlight}
              onHover={setHighlight}
              onPick={pick}
            />
          </div>
          {orderedResults.length > 0 && (
            <div className="flex shrink-0 items-center justify-between border-t px-3 py-1.5 text-[10px] text-muted-foreground">
              <span>
                {orderedResults.length}{" "}
                {orderedResults.length === 1 ? "result" : "results"}
              </span>
              <span className="flex items-center gap-2">
                <kbd className="rounded border bg-muted/60 px-1 py-px font-mono">
                  ↑↓
                </kbd>
                <span>navigate</span>
                <kbd className="rounded border bg-muted/60 px-1 py-px font-mono">
                  ↵
                </kbd>
                <span>open</span>
                <kbd className="rounded border bg-muted/60 px-1 py-px font-mono">
                  esc
                </kbd>
                <span>close</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultsList({
  listRef,
  query,
  grouped,
  orderedCount,
  searching,
  highlight,
  onHover,
  onPick,
}: {
  listRef: React.RefObject<HTMLUListElement | null>;
  query: string;
  grouped: Array<{ kind: MatchKind; items: MeetingSearchHit[]; startIndex: number }>;
  orderedCount: number;
  searching: boolean;
  highlight: number;
  onHover: (i: number) => void;
  onPick: (i: number) => void;
}) {
  if (searching && orderedCount === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground">Searching…</div>
    );
  }
  if (!searching && orderedCount === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground">
        No matches for{" "}
        <span className="font-medium text-foreground">“{query}”</span>.
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      id="search-results"
      role="listbox"
      className="flex flex-col"
    >
      {grouped.map((g) => (
        <li key={g.kind} className="flex flex-col">
          <div className="flex items-center gap-2 px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground first:pt-1">
            <span>{GROUP_LABEL[g.kind]}</span>
            <span className="font-mono tabular-nums">{g.items.length}</span>
          </div>
          <ul className="flex flex-col gap-px">
            {g.items.map((r, j) => {
              const flatIndex = g.startIndex + j;
              const isHighlighted = flatIndex === highlight;
              return (
                <li key={`${r.meeting_id}-${r.matched_in}-${j}`}>
                  <button
                    type="button"
                    id={`search-result-${flatIndex}`}
                    data-result-item
                    data-index={flatIndex}
                    role="option"
                    aria-selected={isHighlighted}
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseEnter={() => onHover(flatIndex)}
                    onClick={() => onPick(flatIndex)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
                      isHighlighted
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-[13px] font-medium">
                        <Highlighted text={r.title} query={query} />
                      </span>
                    </div>
                    {r.snippet && (
                      <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        <Highlighted text={r.snippet} query={query} />
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const at = lower.indexOf(ql, i);
    if (at === -1) {
      out.push(text.slice(i));
      break;
    }
    if (at > i) out.push(text.slice(i, at));
    out.push(
      <mark
        key={key++}
        className="rounded-sm bg-primary/15 px-0.5 text-foreground"
      >
        {text.slice(at, at + q.length)}
      </mark>,
    );
    i = at + q.length;
  }
  return <>{out}</>;
}
