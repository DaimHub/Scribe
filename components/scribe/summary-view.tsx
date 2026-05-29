"use client";

import { useMemo, useState } from "react";
import type { MeetingDetail, MeetingSummary } from "@/lib/scribe-global";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Copy01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useScribe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TemplateMenuItems } from "./template-menu-items";
import { useTemplatesList } from "@/lib/use-templates-list";
import { Markdown } from "./markdown";
import { AnthropicModelPicker, useAskMode } from "./anthropic-model-picker";

export function SummaryView({ detail }: { detail: MeetingDetail }) {
  const generate = useScribe((s) => s.generate);
  const openSpeakerPrompt = useScribe((s) => s.openSpeakerPrompt);
  const reportError = useScribe((s) => s.reportError);
  const processing = useScribe((s) => s.processing);
  const [copied, setCopied] = useState(false);
  const [chosenModel, setChosenModel] = useState<string | null>(null);
  const askMode = useAskMode();
  const t = useT();

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
          {t("summary.empty.title")}
        </div>
        <div className="max-w-sm text-xs text-muted-foreground">
          {hasTranscript
            ? t("summary.empty.generate")
            : t("summary.empty.process")}
        </div>
        {hasTranscript && (
          <AnthropicModelPicker
            value={chosenModel}
            onChange={setChosenModel}
            className="w-56 items-start text-left"
          />
        )}
        <SummaryGenerateButton
          currentTemplateId={detail.meeting.notes_template_id}
          hasTranscript={hasTranscript}
          isBusy={isBusy || (hasTranscript && askMode && chosenModel === null)}
          onPick={(templateId) => {
            // Mirror notes-view: only the no-transcript path triggers diarize
            // and therefore the speaker prompt; regenerating notes is purely
            // a re-run of the LLM step.
            if (hasTranscript) {
              void (async () => {
                await window.scribe.templates.setMeetingTemplate(
                  detail.meeting.id,
                  templateId,
                );
                await generate(detail.meeting.id, chosenModel ?? undefined);
              })();
            } else {
              openSpeakerPrompt(detail.meeting.id, {
                kind: "process",
                templateId,
              });
            }
          }}
        />
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
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      reportError(t("common.copyFailed"));
    }
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
          {copied ? t("summary.copied") : t("summary.copy")}
        </Button>

        {summary.executive_summary.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeading title={t("summary.exec")} />
            <ul className="flex flex-col gap-3">
              {summary.executive_summary.map((b, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2 inline-block size-1 shrink-0 rounded-full bg-foreground/60" />
                  <div className="text-sm leading-relaxed">
                    <span className="font-semibold">{b.topic}</span>
                    <span className="text-muted-foreground"> · </span>
                    <Markdown inline className="inline">
                      {b.detail}
                    </Markdown>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeading title={t("summary.overview")} />
          <Markdown className="text-[15px] leading-relaxed text-foreground/95">
            {summary.full_summary}
          </Markdown>
        </section>

        {sections.length > 0 && (
          <section className="flex flex-col gap-5">
            <SectionHeading
              title={t("summary.inDepth")}
              hint={
                sections.length === 1
                  ? t("summary.topicOne", { count: sections.length })
                  : t("summary.topicMany", { count: sections.length })
              }
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
                  <Markdown className="text-[14px] leading-relaxed text-foreground/90">
                    {s.content}
                  </Markdown>
                </article>
              ))}
            </div>
          </section>
        )}

        {summary.decisions.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeading title={t("summary.decisions")} />
            <ul className="flex flex-col gap-1.5">
              {summary.decisions.map((d, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-snug">
                  <span className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-foreground/60" />
                  <Markdown inline>{d}</Markdown>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
  );
}

function SummaryGenerateButton({
  currentTemplateId,
  hasTranscript,
  isBusy,
  onPick,
}: {
  currentTemplateId: string | null;
  hasTranscript: boolean;
  isBusy: boolean;
  onPick: (templateId: string) => void;
}) {
  const t = useT();
  const { templates, defaultId } = useTemplatesList();
  const selectedId = currentTemplateId ?? defaultId;
  const label = isBusy
    ? t("summary.processing")
    : hasTranscript
      ? t("summary.generateNotes")
      : t("summary.processMeeting");

  if (!templates) {
    return (
      <Button size="sm" className="mt-2 gap-1.5" disabled={isBusy}>
        <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button {...props} size="sm" className="mt-2 gap-1.5" disabled={isBusy}>
            <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
            {label}
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
          </Button>
        )}
      />
      <DropdownMenuContent align="center">
        <TemplateMenuItems
          templates={templates}
          selectedId={selectedId}
          onPick={onPick}
        />
      </DropdownMenuContent>
    </DropdownMenu>
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
