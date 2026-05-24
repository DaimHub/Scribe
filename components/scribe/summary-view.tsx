"use client";

import { useMemo, useState } from "react";
import type { MeetingDetail, MeetingSummary } from "@/lib/scribe-global";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useScribe } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SummaryView({ detail }: { detail: MeetingDetail }) {
  const generate = useScribe((s) => s.generate);
  const processMeeting = useScribe((s) => s.processMeeting);
  const processing = useScribe((s) => s.processing);
  const [copied, setCopied] = useState(false);

  const summary = useMemo<MeetingSummary | null>(() => {
    if (!detail.meeting.summary_json) return null;
    try {
      return JSON.parse(detail.meeting.summary_json) as MeetingSummary;
    } catch {
      return null;
    }
  }, [detail.meeting.summary_json]);

  const isBusy =
    processing.kind === "processing" && processing.meetingId === detail.meeting.id;
  const hasTranscript = detail.transcript.length > 0;

  if (!summary) {
    const isGenerating =
      isBusy &&
      processing.kind === "processing" &&
      (processing.phase === "generate" || processing.flow === "full");
    if (isGenerating) {
      return (
        <div className="mx-auto flex max-w-3xl flex-col gap-10 px-8 py-6">
          <section className="flex flex-col gap-3">
            <Skeleton className="h-6 w-40 rounded" />
            <ul className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex gap-2.5">
                  <Skeleton className="mt-2 size-1.5 shrink-0 rounded-full" />
                  <Skeleton className={cn("h-4 rounded", i % 2 === 0 ? "w-5/6" : "w-2/3")} />
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-3">
            <Skeleton className="h-6 w-24 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </section>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="text-sm font-medium text-muted-foreground">
          No summary yet
        </div>
        <div className="max-w-sm text-xs text-muted-foreground">
          {hasTranscript
            ? "Generate notes to produce an in-depth, multi-section summary."
            : "Process the recording to transcribe and produce notes in one go."}
        </div>
        <Button
          size="sm"
          className="mt-2 gap-1.5"
          onClick={() =>
            hasTranscript
              ? void generate(detail.meeting.id)
              : void processMeeting(detail.meeting.id)
          }
          disabled={isBusy}
        >
          <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
          {isBusy
            ? "Processing…"
            : hasTranscript
              ? "Generate notes"
              : "Process meeting"}
        </Button>
      </div>
    );
  }

  const sections = summary.sections ?? [];

  async function onCopy() {
    if (!summary) return;
    const lines: string[] = ["# Executive Summary"];
    for (const b of summary.executive_summary) {
      lines.push(`• ${b.topic}: ${b.detail}`);
    }
    lines.push("", "# Overview", summary.full_summary);
    if (sections.length > 0) {
      lines.push("", "# Details");
      for (const s of sections) {
        lines.push("", `## ${s.title}`, s.content);
      }
    }
    if (summary.decisions.length > 0) {
      lines.push("", "# Decisions");
      for (const d of summary.decisions) lines.push(`• ${d}`);
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-8 py-6 pb-16">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="-ml-2 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
          {copied ? "Copied!" : "Copy full summary"}
        </Button>

        {summary.executive_summary.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeading title="Executive summary" />
            <ul className="flex flex-col gap-3">
              {summary.executive_summary.map((b, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2 inline-block size-1 shrink-0 rounded-full bg-foreground/60" />
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold">{b.topic}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span>{b.detail}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeading title="Overview" />
          <p className="text-[15px] leading-relaxed text-foreground/95">
            {summary.full_summary}
          </p>
        </section>

        {sections.length > 0 && (
          <section className="flex flex-col gap-5">
            <SectionHeading
              title="In depth"
              hint={`${sections.length} ${sections.length === 1 ? "topic" : "topics"}`}
            />
            <div className="flex flex-col gap-6">
              {sections.map((s, i) => (
                <article
                  key={i}
                  className="flex flex-col gap-2 border-l-2 border-primary/30 pl-4"
                >
                  <h3 className="text-base font-semibold tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-line">
                    {s.content}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {summary.decisions.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeading title="Decisions" />
            <ul className="flex flex-col gap-1.5">
              {summary.decisions.map((d, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-snug">
                  <span className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-foreground/60" />
                  {d}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
}
