"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScribe, formatDuration } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mic01Icon } from "@hugeicons/core-free-icons";

const DEFAULT_MIC = "__default__";

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

function MicSourcePicker() {
  const micDeviceId = useScribe((s) => s.micDeviceId);
  const setMicDevice = useScribe((s) => s.setMicDevice);
  const t = useT();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((all) => {
          if (cancelled) return;
          // Drop the synthetic "default"/"communications" aliases — we expose
          // our own "system default" option so they'd only be confusing dupes.
          setDevices(
            all.filter(
              (d) =>
                d.kind === "audioinput" &&
                d.deviceId !== "default" &&
                d.deviceId !== "communications",
            ),
          );
        })
        .catch(() => {
          /* enumeration can reject before mic permission is granted */
        });
    };
    refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener("devicechange", refresh);
    };
  }, []);

  const labelFor = (value: string) => {
    if (value === DEFAULT_MIC) return t("recording.micDefault");
    return (
      devices.find((d) => d.deviceId === value)?.label ||
      t("recording.micUnknown")
    );
  };

  return (
    <Select
      value={micDeviceId ?? DEFAULT_MIC}
      onValueChange={(v) =>
        setMicDevice(v === DEFAULT_MIC ? null : (v as string))
      }
    >
      <SelectTrigger
        size="sm"
        className="h-7 max-w-52 gap-1.5 rounded-full"
        aria-label={t("recording.micSource")}
      >
        <HugeiconsIcon
          icon={Mic01Icon}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <SelectValue>
          {(value) => labelFor((value as string | null) ?? DEFAULT_MIC)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        className="w-auto min-w-52 max-w-80"
      >
        <SelectItem value={DEFAULT_MIC}>{t("recording.micDefault")}</SelectItem>
        {devices.map((d) => (
          <SelectItem key={d.deviceId} value={d.deviceId}>
            {d.label || t("recording.micUnknown")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RecordingBar() {
  const recording = useScribe((s) => s.recording);
  const levels = useScribe((s) => s.levels);
  const stop = useScribe((s) => s.stopRecording);
  const t = useT();
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
        <div
          className="flex items-center gap-2 pl-2"
          role="status"
          aria-live="polite"
        >
          <span
            aria-hidden
            className="size-2 animate-pulse rounded-full bg-red-500"
          />
          <span className="text-xs font-medium text-foreground">
            {recording.kind === "stopping"
              ? t("recording.stoppingEllipsis")
              : t("recording.status")}
          </span>
          <span
            aria-hidden
            className="font-mono text-xs tabular-nums text-muted-foreground"
          >
            {formatDuration(elapsed)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <VuBar level={levels.mic} label={t("recording.levelMic")} />
          <VuBar level={levels.system} label={t("recording.levelSys")} />
        </div>
        <MicSourcePicker />
        <Button
          size="sm"
          variant="destructive"
          className="rounded-full"
          onClick={() => void stop()}
          disabled={recording.kind !== "recording"}
        >
          {recording.kind === "stopping"
            ? t("recording.stoppingEllipsis")
            : t("recording.stop")}
        </Button>
      </Card>
    </div>
  );
}
