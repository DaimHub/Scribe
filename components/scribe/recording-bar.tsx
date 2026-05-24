"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useScribe, formatDuration } from "@/lib/store";
import { cn } from "@/lib/utils";

function VuBar({ level, label }: { level: number; label: string }) {
  const pct = Math.min(100, Math.round(level * 140));
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-[width] duration-75",
            pct > 80 ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RecordingBar() {
  const recording = useScribe((s) => s.recording);
  const levels = useScribe((s) => s.levels);
  const stop = useScribe((s) => s.stopRecording);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (recording.kind !== "recording") return;
    const i = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(i);
  }, [recording.kind]);

  if (recording.kind === "idle") return null;

  const elapsed =
    recording.kind === "recording" ? now - recording.startedAt : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-5">
      <Card className="pointer-events-auto flex flex-row items-center gap-4 rounded-full border bg-background/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2 pl-2">
          <span className="size-2 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-xs tabular-nums">
            {formatDuration(elapsed)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <VuBar level={levels.mic} label="Mic" />
          <VuBar level={levels.system} label="Sys" />
        </div>
        <Button
          size="sm"
          variant="destructive"
          className="rounded-full"
          onClick={() => void stop()}
          disabled={recording.kind !== "recording"}
        >
          {recording.kind === "stopping" ? "Stopping…" : "Stop"}
        </Button>
      </Card>
    </div>
  );
}
