"use client";

import { useEffect, useState } from "react";
import type { RecordingStateSnapshot } from "@/lib/scribe-global";
import { formatDuration } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Mini recording widget rendered in a floating, always-on-top BrowserWindow.
 *
 * Owns no audio capture — the main window holds the MediaStream. This widget
 * only mirrors the recording snapshot the main window publishes and forwards
 * a stop request through the main process.
 */
export function MiniRecorder() {
  const [state, setState] = useState<RecordingStateSnapshot>({ kind: "idle" });
  const [now, setNow] = useState<number>(Date.now());

  // Strip the inherited app background so the floating window stays
  // round-cornered and transparent at its edges.
  useEffect(() => {
    const prevBody = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = prevBody;
      document.documentElement.style.background = prevHtml;
    };
  }, []);

  useEffect(() => {
    // Pull the last known state on mount in case we missed the broadcast.
    void window.scribe.floating.getRecordingState().then(setState);
    return window.scribe.floating.onRecordingState(setState);
  }, []);

  useEffect(() => {
    if (state.kind !== "recording") return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.kind]);

  const elapsed =
    state.kind === "recording" && state.startedAt
      ? now - state.startedAt
      : 0;

  const isStopping = state.kind === "stopping";
  const isStarting = state.kind === "starting";
  const label =
    isStopping ? "Stopping…" : isStarting ? "Starting…" : formatDuration(elapsed);

  return (
    <div
      className="flex h-screen w-screen items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 px-3 py-2 shadow-xl backdrop-blur [-webkit-app-region:drag]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full bg-red-500",
            state.kind === "recording" && "animate-pulse",
          )}
        />
        <span className="font-mono text-xs tabular-nums text-foreground">
          {label}
        </span>
        {state.title && (
          <span className="ml-1 truncate text-xs text-muted-foreground">
            {state.title}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => window.scribe.floating.requestStop()}
        disabled={state.kind !== "recording"}
        className={cn(
          "shrink-0 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive",
          "hover:bg-destructive/25 disabled:opacity-50",
          "[-webkit-app-region:no-drag]",
        )}
      >
        Stop
      </button>
    </div>
  );
}
