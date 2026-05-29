"use client";

import { useMemo, useState } from "react";
import type { MeetingDetail } from "@/lib/scribe-global";
import { useScribe } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { useT } from "@/lib/i18n";
import { Markdown } from "./markdown";

/**
 * "Key points" — the condensed bullet TL;DR produced by the notes LLM pass
 * and stored in meeting.bullets_json (a JSON array of strings). Read-only,
 * mirroring the Summary tab: it regenerates with the notes and can be
 * rewritten externally via the MCP `set_bullets` tool.
 */
export function BulletsView({ detail }: { detail: MeetingDetail }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const reportError = useScribe((s) => s.reportError);

  const bullets = useMemo<string[]>(() => {
    const raw = detail.meeting.bullets_json;
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr)
        ? arr.filter((b): b is string => typeof b === "string" && b.trim() !== "")
        : [];
    } catch {
      return [];
    }
  }, [detail.meeting.bullets_json]);

  if (bullets.length === 0) {
    const hasSummary = !!detail.meeting.summary_json;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="text-sm font-medium text-muted-foreground">
          {t("bullets.empty.title")}
        </div>
        <div className="max-w-sm text-xs text-muted-foreground">
          {hasSummary
            ? t("bullets.empty.regenerate")
            : t("bullets.empty.generate")}
        </div>
      </div>
    );
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(
        bullets.map((b) => `• ${b}`).join("\n"),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      reportError(t("common.copyFailed"));
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-8 py-6 pb-16">
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="-ml-2 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
        {copied ? t("bullets.copied") : t("bullets.copy")}
      </Button>
      <ul className="flex flex-col gap-2.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
            <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-foreground/60" />
            <Markdown inline className="inline">
              {b}
            </Markdown>
          </li>
        ))}
      </ul>
    </div>
  );
}
