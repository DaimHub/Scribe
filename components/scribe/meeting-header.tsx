"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  MoreHorizontalIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import type { FolderRow, MeetingDetail, Pipeline } from "@/lib/scribe-global";
import {
  useScribe,
  formatDuration,
  type SpeakerPromptFlow,
} from "@/lib/store";
import { SpeakersChip } from "./speakers-chip";
import { TagChips } from "./tag-chips";
import { LinkedEventRow } from "./linked-event-row";
import { TemplateMenuItems } from "./template-menu-items";
import { AnthropicModelPicker, useAskMode } from "./anthropic-model-picker";
import { ModelPromptDialog } from "./model-prompt-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { useTemplatesList } from "@/lib/use-templates-list";
import { useT, type TranslateFn } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

function parsePipeline(json: string | null): Pipeline | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Pipeline;
  } catch {
    return null;
  }
}

// Step-only labels — the model name fields. The template metadata on
// Pipeline (notes_template_id / notes_template_name) is intentionally
// excluded; it surfaces in the dedicated template picker row instead.
const PIPELINE_LABELS: Partial<Record<keyof Pipeline, TranslationKey>> = {
  transcribe: "pipeline.transcribe",
  align: "pipeline.align",
  diarize: "pipeline.diarize",
  notes: "pipeline.notes",
};

function PipelineBadges({ pipeline }: { pipeline: Pipeline }) {
  const t = useT();
  const entries = (
    Object.entries(pipeline) as Array<[keyof Pipeline, string | undefined]>
  ).filter(
    (e): e is [keyof Pipeline, string] => !!e[1] && !!PIPELINE_LABELS[e[0]],
  );
  if (entries.length === 0 && !pipeline.notes_usage) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entries.map(([step, model]) => (
        <span
          key={step}
          className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
          title={`${t(PIPELINE_LABELS[step]!)}: ${model}`}
        >
          <span className="uppercase tracking-wider text-muted-foreground">
            {t(PIPELINE_LABELS[step]!)}
          </span>
          <span className="text-foreground/80">{model}</span>
        </span>
      ))}
      {pipeline.notes_usage && <UsageBadge usage={pipeline.notes_usage} />}
      {pipeline.notes_usage?.tools_used &&
        pipeline.notes_usage.tools_used.length > 0 && (
          <KbUsageBadge tools={pipeline.notes_usage.tools_used} />
        )}
    </div>
  );
}

function KbUsageBadge({
  tools,
}: {
  tools: NonNullable<NonNullable<Pipeline["notes_usage"]>["tools_used"]>;
}) {
  const t = useT();
  // Group by name to make the chip readable: "Read 5 · Grep 2 · Glob 1"
  // rather than dumping every individual call.
  const byName = new Map<string, number>();
  for (const tc of tools) {
    byName.set(tc.name, (byName.get(tc.name) ?? 0) + 1);
  }
  const summary = Array.from(byName.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name, n]) => (n > 1 ? `${name} ${n}` : name))
    .join(" · ");
  // Tooltip lists each individual call with its target (truncated).
  const tooltip = tools
    .map((tc) => {
      if (!tc.target) return tc.name;
      const short =
        tc.target.length > 80 ? "…" + tc.target.slice(-80) : tc.target;
      return `${tc.name} ${short}`;
    })
    .join("\n");
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
      title={tooltip}
    >
      <span className="uppercase tracking-wider text-muted-foreground">{t("usage.kb")}</span>
      <span className="text-foreground/80">{t("usage.calls", { count: tools.length })}</span>
      <span className="text-muted-foreground">· {summary}</span>
    </span>
  );
}

function formatTokens(n: number | undefined): string | null {
  if (n === undefined || n === null) return null;
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function UsageBadge({
  usage,
}: {
  usage: NonNullable<Pipeline["notes_usage"]>;
}) {
  const t = useT();
  const subscription = usage.billing_kind === "subscription";
  const inT = formatTokens(usage.input_tokens);
  const outT = formatTokens(usage.output_tokens);
  const cacheRead = formatTokens(usage.cache_read_input_tokens);
  const cacheWrite = formatTokens(usage.cache_creation_input_tokens);

  // Headline: cost for metered, "sub" for subscription. Always followed by
  // in/out tokens when available — that's the bit users actually want to
  // see at a glance.
  const headline = subscription
    ? t("usage.sub")
    : usage.cost_usd !== undefined
      ? usage.cost_usd < 0.01
        ? "<$0.01"
        : `$${usage.cost_usd.toFixed(usage.cost_usd < 1 ? 3 : 2)}`
      : "—";

  const tokenLine = inT && outT ? `${inT} / ${outT}` : (inT ?? outT);

  const tooltipLines = [
    usage.model ? t("usage.tip.model", { value: usage.model }) : null,
    usage.input_tokens !== undefined
      ? t("usage.tip.input", { value: usage.input_tokens.toLocaleString() })
      : null,
    usage.output_tokens !== undefined
      ? t("usage.tip.output", { value: usage.output_tokens.toLocaleString() })
      : null,
    cacheRead ? t("usage.tip.cacheRead", { value: cacheRead }) : null,
    cacheWrite ? t("usage.tip.cacheWrite", { value: cacheWrite }) : null,
    usage.cost_usd !== undefined
      ? t("usage.tip.cost", { value: `$${usage.cost_usd.toFixed(4)}` }) +
        (subscription ? t("usage.tip.costSub") : "")
      : null,
    usage.num_turns ? t("usage.tip.turns", { value: usage.num_turns }) : null,
    usage.duration_ms
      ? t("usage.tip.duration", { value: (usage.duration_ms / 1000).toFixed(1) })
      : null,
    usage.session_id ? t("usage.tip.session", { value: usage.session_id }) : null,
  ].filter((l): l is string => l !== null);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]"
      title={tooltipLines.join("\n")}
    >
      <span className="uppercase tracking-wider text-muted-foreground">
        {t("settings.ai.claudeCode.usage.title")}
      </span>
      <span className="text-foreground/80">{headline}</span>
      {tokenLine && (
        <span className="text-muted-foreground">· {tokenLine}</span>
      )}
    </span>
  );
}

// Persisted per-user toggle for the Pipeline metadata row. Defaults to shown.
const PIPELINE_VISIBILITY_KEY = "scribe:showPipeline";

function usePipelineVisibility(): [boolean, (next: boolean) => void] {
  // SSR-safe initial — flip after mount to whatever the user stored.
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PIPELINE_VISIBILITY_KEY);
      if (stored === "false") setShow(false);
    } catch {
      /* localStorage blocked — keep default */
    }
  }, []);
  const update = (next: boolean) => {
    setShow(next);
    try {
      window.localStorage.setItem(PIPELINE_VISIBILITY_KEY, next ? "true" : "false");
    } catch {
      /* ignore */
    }
  };
  return [show, update];
}

export function MeetingHeader({ detail }: { detail: MeetingDetail }) {
  const t = useT();
  const language = useScribe((s) => s.displayLanguage);
  const rename = useScribe((s) => s.renameMeeting);
  const generate = useScribe((s) => s.generate);
  const requestGeneration = useScribe((s) => s.requestGeneration);
  const remove = useScribe((s) => s.deleteMeeting);
  const processing = useScribe((s) => s.processing);
  const folders = useScribe((s) => s.folders);
  const setExpanded = useScribe((s) => s.setExpanded);
  const selectMeeting = useScribe((s) => s.selectMeeting);
  const [showPipeline, setShowPipeline] = usePipelineVisibility();

  const [title, setTitle] = useState(detail.meeting.title);
  const [lastSyncedId, setLastSyncedId] = useState(detail.meeting.id);
  const [lastSyncedTitle, setLastSyncedTitle] = useState(detail.meeting.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Speaker prompt is now store-owned (see SpeakerPromptState) so the empty
  // -state buttons in transcript/notes/summary views can also raise it. We
  // just read the local handlers we need for the menu items.
  const openSpeakerPrompt = useScribe((s) => s.openSpeakerPrompt);

  // Reset local title when meeting changes OR when the upstream title is updated
  // externally (e.g. through a rename in the sidebar). Mirrors React docs pattern.
  if (
    lastSyncedId !== detail.meeting.id ||
    lastSyncedTitle !== detail.meeting.title
  ) {
    setLastSyncedId(detail.meeting.id);
    setLastSyncedTitle(detail.meeting.title);
    setTitle(detail.meeting.title);
  }

  const folderPath = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const path: FolderRow[] = [];
    let cursor: string | null = detail.meeting.folder_id;
    let depth = 0;
    while (cursor && depth < 64) {
      const f: FolderRow | undefined = byId.get(cursor);
      if (!f) break;
      path.unshift(f);
      cursor = f.parent_id;
      depth++;
    }
    return path;
  }, [folders, detail.meeting.folder_id]);

  function focusFolder(folderId: string) {
    // Expand from root down to the clicked folder so it's visible in the sidebar.
    const byId = new Map(folders.map((f) => [f.id, f]));
    const chain: string[] = [];
    let cursor: string | null = folderId;
    let depth = 0;
    while (cursor && depth < 64) {
      chain.unshift(cursor);
      const f: FolderRow | undefined = byId.get(cursor);
      if (!f) break;
      cursor = f.parent_id;
      depth++;
    }
    for (const id of chain) setExpanded(id, true);
    // Deselect any current meeting so the highlight follows the folder context.
    void selectMeeting(detail.meeting.id);
  }

  const busy =
    processing.kind !== "idle" && processing.meetingId === detail.meeting.id;
  const canProcess =
    !busy &&
    (detail.meeting.status === "recorded" ||
      detail.meeting.status === "transcribed" ||
      detail.meeting.status === "diarized" ||
      detail.meeting.status === "done" ||
      detail.meeting.status === "error");
  const hasTranscript = detail.transcript.length > 0;
  const hasNotes = detail.tasks.length > 0 || !!detail.meeting.summary_json;

  async function commitTitle() {
    const next = title.trim();
    if (!next || next === detail.meeting.title) {
      setTitle(detail.meeting.title);
      return;
    }
    await rename(detail.meeting.id, next);
  }

  function promptFor(flow: SpeakerPromptFlow) {
    openSpeakerPrompt(detail.meeting.id, flow, detail.speakers.length);
  }

  return (
    <header className="flex flex-col">
      <SpeakerPromptDialog />
      <ModelPromptDialog />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("header.deleteConfirmTitle")}
        description={t("header.deleteConfirmDesc")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => void remove(detail.meeting.id)}
      />
      <div className="flex items-center justify-between gap-3 px-8">
        <Breadcrumb
          title={detail.meeting.title}
          folderPath={folderPath}
          onFolderClick={focusFolder}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                size="icon-sm"
                aria-label={t("header.meetingActions")}
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            <ProcessSubmenu
              currentTemplateId={detail.meeting.notes_template_id}
              label={
                (hasNotes ? t("header.reprocess") : t("header.process")) + "…"
              }
              disabled={!canProcess}
              onPick={(templateId) => {
                // Prompt first — diarization is part of this flow, so we
                // ALSO want to let the user pin the speaker count up front.
                promptFor({ kind: "process", templateId });
              }}
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => promptFor({ kind: "transcribe" })}
              disabled={!canProcess}
            >
              {(hasTranscript
                ? t("header.retranscribe")
                : t("header.transcribeOnly")) + "…"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => promptFor({ kind: "rediarize" })}
              disabled={busy || !hasTranscript}
            >
              {t("header.rediarizeOnly")}…
            </DropdownMenuItem>
            <ProcessSubmenu
              currentTemplateId={detail.meeting.notes_template_id}
              label={hasNotes ? t("header.regenerate") : t("header.generateOnly")}
              disabled={busy || !hasTranscript}
              onPick={(templateId) => {
                // Header menu has no inline model picker, so route through
                // requestGeneration — it opens the ModelPromptDialog when
                // claude-code is in ask-mode, otherwise generates straight
                // away with the configured default.
                void (async () => {
                  const opened = await requestGeneration(detail.meeting.id, {
                    kind: "generate",
                    templateId,
                  });
                  if (opened) return;
                  await persistAndRun(
                    detail.meeting.id,
                    templateId,
                    () => generate(detail.meeting.id),
                  );
                })();
              }}
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-auto w-full max-w-3xl px-8 pt-6 pb-4">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitle(detail.meeting.title);
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={t("header.titleLabel")}
          className="w-full truncate rounded-md border-none bg-transparent text-2xl font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          spellCheck={false}
        />

        <dl className="mt-5 grid grid-cols-[6rem_1fr] gap-y-3 text-sm">
          <dt className="text-muted-foreground">{t("header.time")}</dt>
          <dd className="flex items-center gap-2">
            <span>
              {formatTime(
                detail.meeting.started_at_ms,
                detail.meeting.duration_ms,
                language,
              )}
            </span>
          </dd>

          <dt className="self-center text-muted-foreground">
            {t("header.speakers")}
          </dt>
          <dd>
            <SpeakersChip
              meetingId={detail.meeting.id}
              speakers={detail.speakers}
              max={3}
            />
          </dd>

          <dt className="self-center text-muted-foreground">
            {t("header.status")}
          </dt>
          <dd className="flex items-center gap-2 text-sm">
            <StatusPill status={detail.meeting.status} />
          </dd>

          <dt className="self-center text-muted-foreground">
            {t("header.event")}
          </dt>
          <dd>
            <LinkedEventRow detail={detail} />
          </dd>

          <dt className="self-center text-muted-foreground">
            {t("header.tags")}
          </dt>
          <dd>
            <TagChips meetingId={detail.meeting.id} />
          </dd>

          {(() => {
            const pipeline = parsePipeline(detail.meeting.pipeline_json);
            if (!pipeline || Object.keys(pipeline).length === 0) return null;
            if (!showPipeline) {
              // Compact one-liner when hidden — keeps an obvious way back in
              // without occupying real estate.
              return (
                <>
                  <dt className="self-center text-muted-foreground">
                    {t("header.pipeline")}
                  </dt>
                  <dd>
                    <Button
                      variant="link"
                      onClick={() => setShowPipeline(true)}
                      className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("header.show")}
                    </Button>
                  </dd>
                </>
              );
            }
            return (
              <>
                <dt className="self-center text-muted-foreground">
                  {t("header.pipeline")}
                </dt>
                <dd className="flex items-center gap-2">
                  <PipelineBadges pipeline={pipeline} />
                  <Button
                    variant="link"
                    onClick={() => setShowPipeline(false)}
                    className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground"
                    title={t("header.hidePipeline")}
                  >
                    {t("header.hide")}
                  </Button>
                </dd>
              </>
            );
          })()}
        </dl>
      </div>
    </header>
  );
}

/**
 * Prompt the user for an exact speaker count before re-running pyannote.
 * Opens from the meeting header "..." menu → "Re-diarize only…". Pyannote
 * clusters far more accurately when constrained to a known count than when
 * estimating from its similarity threshold (especially with multiple
 * voices on a shared room mic). Leaving the field blank falls back to the
 * calendar-derived min/max hint instead of an exact constraint.
 */
function flowLabels(
  flow: SpeakerPromptFlow | null,
  t: TranslateFn,
): {
  title: string;
  description: string;
  confirm: string;
} {
  // All three flows share the same input — only the framing changes. Process
  // and Transcribe land users here BEFORE any transcript exists so the copy
  // gently explains what's about to run; Re-diarize lands AFTER a pass and
  // points at correcting a wrong count.
  switch (flow?.kind) {
    case "transcribe":
      return {
        title: t("header.flow.transcribe.title"),
        description: t("header.flow.transcribe.desc"),
        confirm: t("pipeline.transcribe"),
      };
    case "rediarize":
      return {
        title: t("header.flow.rediarize.title"),
        description: t("header.flow.rediarize.desc"),
        confirm: t("header.flow.rediarize.confirm"),
      };
    case "process":
    default:
      return {
        title: t("header.process"),
        description: t("header.flow.process.desc"),
        confirm: t("header.flow.process.confirm"),
      };
  }
}

/**
 * Self-contained speaker prompt — reads state and dispatches actions from
 * the store directly so any view (transcript empty state, notes view, etc.)
 * can raise it via openSpeakerPrompt(...). Lives in the meeting-header so
 * the templates list is colocated, but the dialog itself doesn't depend on
 * header-local state.
 */
function SpeakerPromptDialog() {
  const speakerPrompt = useScribe((s) => s.speakerPrompt);
  const t = useT();
  const setSpeakerPromptCount = useScribe((s) => s.setSpeakerPromptCount);
  const closeSpeakerPrompt = useScribe((s) => s.closeSpeakerPrompt);
  const detail = useScribe((s) => s.detail);
  const processMeeting = useScribe((s) => s.processMeeting);
  const transcribe = useScribe((s) => s.transcribe);
  const rediarize = useScribe((s) => s.rediarize);
  const { templates } = useTemplatesList();
  const askMode = useAskMode();

  // Process flow needs a template — prefill from the meeting's current
  // template if the trigger didn't supply one (empty-state buttons in
  // transcript/notes/summary views don't pre-pick).
  const initialTemplateId =
    speakerPrompt.flow?.kind === "process"
      ? speakerPrompt.flow.templateId
      : undefined;
  const [chosenTemplate, setChosenTemplate] = useState<string | undefined>(
    initialTemplateId,
  );
  // null = use the user's default Anthropic model from Settings; a string
  // means override for this call only.
  const [chosenModel, setChosenModel] = useState<string | null>(null);
  // Reset chosenTemplate whenever the dialog opens against a fresh flow.
  const [lastFlowKey, setLastFlowKey] = useState<string>("");
  const flowKey =
    speakerPrompt.flow?.kind === "process"
      ? `process:${speakerPrompt.flow.templateId ?? ""}:${speakerPrompt.meetingId ?? ""}`
      : `${speakerPrompt.flow?.kind ?? "none"}:${speakerPrompt.meetingId ?? ""}`;
  if (lastFlowKey !== flowKey) {
    setLastFlowKey(flowKey);
    setChosenTemplate(initialTemplateId ?? detail?.meeting.notes_template_id ?? undefined);
    setChosenModel(null);
  }

  if (!speakerPrompt.open || !speakerPrompt.flow || !speakerPrompt.meetingId) {
    return (
      <Dialog open={false} onOpenChange={() => undefined}>
        <DialogContent />
      </Dialog>
    );
  }

  const flow = speakerPrompt.flow;
  const meetingId = speakerPrompt.meetingId;
  const sanitize = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 2);
  const labels = flowLabels(flow, t);
  const showTemplatePicker =
    flow.kind === "process" && flow.templateId === undefined;
  // In ask mode the user MUST pick a model before the run starts —
  // confirming with no pick would either silently use a wrong model or
  // throw at the provider layer.
  const needsModelPick =
    flow.kind === "process" && askMode && chosenModel === null;

  const handleConfirm = async () => {
    const n = parseInt(speakerPrompt.count, 10);
    const numSpeakers = Number.isFinite(n) && n > 0 ? n : undefined;
    const modelOverride = chosenModel ?? undefined;
    closeSpeakerPrompt();
    if (flow.kind === "process") {
      const templateId = flow.templateId ?? chosenTemplate;
      if (templateId) {
        await persistAndRun(meetingId, templateId, () =>
          processMeeting(meetingId, numSpeakers, modelOverride),
        );
      } else {
        await processMeeting(meetingId, numSpeakers, modelOverride);
      }
    } else if (flow.kind === "transcribe") {
      await transcribe(meetingId, numSpeakers);
    } else {
      await rediarize(meetingId, numSpeakers);
    }
  };

  return (
    <Dialog
      open={speakerPrompt.open}
      onOpenChange={(v) => {
        if (!v) closeSpeakerPrompt();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        {showTemplatePicker && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="speaker-prompt-template"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("header.dialog.template")}
            </label>
            <select
              id="speaker-prompt-template"
              value={chosenTemplate ?? ""}
              onChange={(e) =>
                setChosenTemplate(e.target.value || undefined)
              }
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">{t("header.dialog.templateDefault")}</option>
              {(templates ?? []).map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {flow.kind === "process" && (
          <AnthropicModelPicker
            value={chosenModel}
            onChange={setChosenModel}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="speaker-count"
            className="text-xs font-medium text-muted-foreground"
          >
            {t("header.dialog.speakerCount")}
            {detail && detail.speakers.length > 0 && (
              <span className="ml-1 opacity-70">
                {t("header.dialog.detected", { count: detail.speakers.length })}
              </span>
            )}
          </label>
          <Input
            id="speaker-count"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={t("header.dialog.speakerCountPlaceholder")}
            value={speakerPrompt.count}
            onChange={(e) => setSpeakerPromptCount(sanitize(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConfirm();
            }}
            autoFocus
            aria-label={t("header.dialog.speakerCount")}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => closeSpeakerPrompt()}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            className="gap-1.5"
            disabled={needsModelPick}
          >
            <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Persists the picked template on the meeting and then triggers the
 *  caller-supplied action (generate / process). Centralizing this keeps
 *  the picker → action sequence atomic from the UI's perspective. */
async function persistAndRun(
  meetingId: string,
  templateId: string,
  run: () => Promise<void> | void,
): Promise<void> {
  await window.scribe.templates.setMeetingTemplate(meetingId, templateId);
  await run();
}

/** Submenu item: shows the templates list with the currently-active
 *  template ticked. Click on a template = save + invoke the supplied
 *  callback (which runs generate/process). Used inside the meeting
 *  header's actions dropdown. Falls back to a plain item if the
 *  templates list hasn't loaded yet, so the menu stays responsive. */
function ProcessSubmenu({
  currentTemplateId,
  label,
  disabled,
  onPick,
}: {
  currentTemplateId: string | null;
  label: string;
  disabled: boolean;
  onPick: (templateId: string) => void;
}) {
  const { templates, defaultId } = useTemplatesList();
  if (!templates) {
    return (
      <DropdownMenuItem
        disabled={disabled}
        onClick={() => onPick(currentTemplateId ?? defaultId)}
      >
        {label}
      </DropdownMenuItem>
    );
  }
  const selectedId = currentTemplateId ?? defaultId;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <TemplateMenuItems
          templates={templates}
          selectedId={selectedId}
          onPick={onPick}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function Breadcrumb({
  title,
  folderPath,
  onFolderClick,
}: {
  title: string;
  folderPath: FolderRow[];
  onFolderClick: (folderId: string) => void;
}) {
  const t = useT();
  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      <span className="shrink-0 font-medium">{t("nav.meetings")}</span>
      {folderPath.map((f) => (
        <Fragment key={f.id}>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 shrink-0" />
          <button
            type="button"
            onClick={() => onFolderClick(f.id)}
            className="max-w-[10rem] truncate hover:text-foreground"
            title={f.name}
          >
            {f.name}
          </button>
        </Fragment>
      ))}
      <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 shrink-0" />
      <span className="truncate text-foreground" title={title}>
        {title}
      </span>
    </nav>
  );
}

function StatusPill({ status }: { status: MeetingDetail["meeting"]["status"] }) {
  const t = useT();
  const map: Record<typeof status, { label: string; dot: string }> = {
    recording: { label: t("status.recording"), dot: "bg-red-500 animate-pulse" },
    recorded: { label: t("status.recorded"), dot: "bg-amber-500" },
    transcribing: {
      label: t("status.transcribing"),
      dot: "bg-blue-500 animate-pulse",
    },
    transcribed: { label: t("status.transcribed"), dot: "bg-blue-500" },
    diarized: { label: t("status.diarized"), dot: "bg-blue-500" },
    done: { label: t("status.done"), dot: "bg-emerald-500" },
    error: { label: t("status.error"), dot: "bg-destructive" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium">
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function formatTime(
  startMs: number,
  durationMs: number | null,
  locale: string,
): string {
  const d = new Date(startMs);
  const dateStr = d.toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (durationMs) {
    const end = new Date(startMs + durationMs).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr}, ${timeStr} – ${end}  ·  ${formatDuration(durationMs)}`;
  }
  return `${dateStr}, ${timeStr}`;
}
