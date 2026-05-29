"use client";

import { useEffect, useRef, useState } from "react";
import type { MeetingDetail } from "@/lib/scribe-global";
import { Textarea } from "@/components/ui/textarea";
import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";

/**
 * Free-form per-meeting scratch pad. The editor is keyed by meeting id so
 * switching meetings remounts it (fresh initial value, and the unmount flush
 * persists any pending edits). Saves are debounced; the column is also
 * writable via the MCP `set_scratchpad` tool.
 */
export function ScratchpadView({ detail }: { detail: MeetingDetail }) {
  return (
    <ScratchpadEditor
      key={detail.meeting.id}
      meetingId={detail.meeting.id}
      initial={detail.meeting.scratchpad ?? ""}
    />
  );
}

function ScratchpadEditor({
  meetingId,
  initial,
}: {
  meetingId: string;
  initial: string;
}) {
  const t = useT();
  const setScratchpad = useScribe((s) => s.setScratchpad);
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "dirty" | "saved">(
    initial ? "saved" : "idle",
  );

  const valueRef = useRef(value);
  const savedRef = useRef(initial);

  // Mirror the latest value into a ref (outside render) so the unmount-flush
  // effect below can read it without re-subscribing on every keystroke.
  useEffect(() => {
    valueRef.current = value;
  });

  // Debounced autosave. The guard skips the initial render and any render
  // where the editor already matches what we last persisted.
  useEffect(() => {
    if (value === savedRef.current) return;
    const id = window.setTimeout(() => {
      void setScratchpad(meetingId, value);
      savedRef.current = value;
      setStatus("saved");
    }, 600);
    return () => window.clearTimeout(id);
  }, [value, meetingId, setScratchpad]);

  // Flush on unmount (meeting switch or leaving the meeting) so a pending
  // debounce doesn't drop the user's last keystrokes.
  useEffect(() => {
    return () => {
      if (valueRef.current !== savedRef.current) {
        void setScratchpad(meetingId, valueRef.current);
      }
    };
  }, [meetingId, setScratchpad]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2 px-8 py-6 pb-16">
      <div className="flex h-4 items-center justify-end">
        <span className="text-[11px] text-muted-foreground">
          {status === "dirty"
            ? t("scratchpad.saving")
            : status === "saved"
              ? t("scratchpad.saved")
              : ""}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("dirty");
        }}
        placeholder={t("scratchpad.placeholder")}
        className="min-h-[60vh] resize-none rounded-2xl border-border/50 bg-transparent text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
