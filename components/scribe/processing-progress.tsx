"use client";

import { useEffect, useState } from "react";
import { useScribe, type ProcessingState } from "@/lib/store";
import { useT, type TranslateFn } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AudioWave02Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  MagicWand01Icon,
  Mic01Icon,
  SparklesIcon,
  UserMultiple02Icon,
  VoiceIdIcon,
} from "@hugeicons/core-free-icons";

type StepKey = "mix" | "transcribe" | "align" | "diarize" | "notes";
type StepStatus = "pending" | "active" | "complete" | "skipped";

interface StepDef {
  key: StepKey;
  labelKey: TranslationKey;
  icon: typeof Mic01Icon;
  /** Approx share of overall pipeline progress. */
  weight: number;
}

/**
 * Per-stage drift: while a slow stage is active, the displayed pct creeps
 * from the last emitted value toward `driftTo` over `durationMs`. Caps at
 * `driftTo` so we never overshoot the next checkpoint. All pct values are
 * LOCAL within the active step (matching what the python sidecar and LLM
 * providers emit), since computeStatus multiplies by step weight.
 *
 * Tuning rule: pick driftTo just below the next stage's emit pct, and
 * durationMs as a generous estimate of the operation's wall time. The cap
 * is what keeps us from looking dishonest on slow hardware.
 */
const STAGE_DRIFT: Record<string, { driftTo: number; durationMs: number }> = {
  mixing: { driftTo: 95, durationMs: 4000 },
  transcribing: { driftTo: 88, durationMs: 90000 },
  aligning: { driftTo: 85, durationMs: 15000 },
  diarizing: { driftTo: 65, durationMs: 45000 },
  "loading-embed": { driftTo: 98, durationMs: 12000 },
  loading: { driftTo: 50, durationMs: 15000 },
  generating: { driftTo: 85, durationMs: 30000 },
  // Agent runs are bursty: each turn = one model call + N tool calls. We
  // emit deterministic pct steps in the provider (20→85 across maxTurns),
  // so the local drift band is narrow — just enough to keep the bar
  // breathing while the network round-trips happen.
  agent: { driftTo: 88, durationMs: 25000 },
};

const TRANSCRIBE_STEPS: StepDef[] = [
  { key: "mix", labelKey: "processing.step.mixAudio", icon: AudioWave02Icon, weight: 5 },
  { key: "transcribe", labelKey: "pipeline.transcribe", icon: Mic01Icon, weight: 40 },
  { key: "align", labelKey: "processing.step.alignWords", icon: VoiceIdIcon, weight: 10 },
  { key: "diarize", labelKey: "processing.step.identifySpeakers", icon: UserMultiple02Icon, weight: 15 },
];

// Re-diarize re-uses the same mix step (always rebuilt) plus the diarize
// step — no transcription or alignment. Weights chosen so mix doesn't
// visually dominate; diarize is the slow part.
const DIARIZE_ONLY_STEPS: StepDef[] = [
  { key: "mix", labelKey: "processing.step.mixAudio", icon: AudioWave02Icon, weight: 10 },
  { key: "diarize", labelKey: "processing.step.identifySpeakers", icon: UserMultiple02Icon, weight: 90 },
];

const NOTES_STEP: StepDef = {
  key: "notes",
  labelKey: "summary.generateNotes",
  icon: MagicWand01Icon,
  weight: 30,
};

const STAGE_KEYS: Record<string, TranslationKey> = {
  starting: "processing.stage.starting",
  mixing: "processing.stage.mixing",
  "loading-runtime": "processing.stage.loadingRuntime",
  "loading-audio": "processing.stage.loadingAudio",
  "loading-model": "processing.stage.loadingModel",
  transcribing: "processing.stage.transcribing",
  transcribed: "processing.stage.transcribed",
  "loading-align": "processing.stage.loadingAlign",
  aligning: "processing.stage.aligning",
  "align-failed": "processing.stage.alignFailed",
  "loading-diarize": "processing.stage.loadingDiarize",
  "diarize-loaded": "processing.stage.diarizeLoaded",
  diarizing: "processing.stage.diarizing",
  "diarize-segments": "processing.stage.diarizeSegments",
  "diarize-assigned": "processing.stage.diarizeAssigned",
  "diarize-failed": "processing.stage.diarizeFailed",
  "diarize-skipped": "processing.stage.diarizeSkipped",
  serializing: "processing.stage.serializing",
  done: "status.done",
  model: "processing.stage.model",
  loading: "processing.stage.loading",
  generating: "processing.stage.generating",
  agent: "processing.stage.agent",
  writing: "processing.stage.writing",
};

function stageLabel(stage: string, t: TranslateFn): string {
  const key = STAGE_KEYS[stage];
  return key ? t(key) : stage;
}

/** Natural stage→step mapping. The flow-aware wrapper below falls back to a
 *  flow-appropriate step when the natural target isn't in the active flow
 *  (e.g. `loading-runtime` belongs to "transcribe" naturally, but in the
 *  diarize-only flow there IS no transcribe step — it should land on
 *  "diarize" instead). */
function stageToStepNatural(stage: string): StepKey {
  if (stage === "mixing") return "mix";
  if (
    stage === "loading-runtime" ||
    stage === "loading-audio" ||
    stage === "loading-model" ||
    stage === "transcribing" ||
    stage === "transcribed"
  )
    return "transcribe";
  if (stage === "loading-align" || stage === "aligning" || stage === "align-failed")
    return "align";
  if (
    stage === "loading-diarize" ||
    stage === "diarize-loaded" ||
    stage === "diarizing" ||
    stage === "diarize-segments" ||
    stage === "diarize-assigned" ||
    stage === "diarize-failed" ||
    stage === "diarize-skipped" ||
    stage === "loading-embed" ||
    stage === "embed-done" ||
    stage === "embed-failed"
  )
    return "diarize";
  if (
    stage === "model" ||
    stage === "loading" ||
    stage === "generating" ||
    stage === "agent" ||
    stage === "writing"
  )
    return "notes";
  return "mix";
}

function stageToStep(
  stage: string,
  steps: StepDef[],
  phase: "transcribe" | "generate",
): StepKey {
  // "starting" is the sentinel set by the store at flow kickoff and at every
  // phase transition — before any backend event has arrived. Land on the
  // first not-yet-done step of the current phase so the bar doesn't snap
  // backward when phase changes (transcribe → generate in the full flow).
  if (stage === "starting") {
    if (phase === "generate") return "notes";
    return steps[0]?.key ?? "mix";
  }
  const natural = stageToStepNatural(stage);
  if (steps.some((s) => s.key === natural)) return natural;
  // The naturally-mapped step doesn't exist in this flow. Fall back to the
  // first non-mix step (the diarize-only flow hits this for early-loading
  // stages that would normally map to "transcribe").
  return steps.find((s) => s.key !== "mix")?.key ?? steps[0]?.key ?? "mix";
}

function activeSteps(p: Extract<ProcessingState, { kind: "processing" }>): StepDef[] {
  if (p.flow === "transcribe-only") return TRANSCRIBE_STEPS;
  if (p.flow === "generate-only") return [NOTES_STEP];
  if (p.flow === "diarize-only") return DIARIZE_ONLY_STEPS;
  return [...TRANSCRIBE_STEPS, NOTES_STEP];
}

function computeStatus(
  steps: StepDef[],
  currentStepKey: StepKey,
  pct: number,
  stage: string,
): { statuses: Map<StepKey, StepStatus>; overallPct: number } {
  const statuses = new Map<StepKey, StepStatus>();
  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0) || 1;

  // The "done" stage means the pipeline finished successfully — force every
  // step complete and the bar to 100% regardless of where the natural stage
  // mapping would land. Previously the completion guard only fired when
  // currentStepKey matched the last step, which it rarely did (the natural
  // map sent "done" to "transcribe" but the last step is usually "notes" or
  // "diarize"), leaving the bar stuck mid-way at the end.
  if (stage === "done") {
    for (const step of steps) statuses.set(step.key, "complete");
    return { statuses, overallPct: 100 };
  }

  let reachedCurrent = false;
  let overallPct = 0;
  for (const step of steps) {
    if (step.key === currentStepKey) {
      reachedCurrent = true;
      const isSkip = stage.endsWith("-skipped") || stage.endsWith("-failed");
      statuses.set(step.key, isSkip ? "skipped" : "active");
      const clamped = Math.max(0, Math.min(100, pct));
      overallPct += step.weight * (clamped / 100);
    } else if (!reachedCurrent) {
      statuses.set(step.key, "complete");
      overallPct += step.weight;
    } else {
      statuses.set(step.key, "pending");
    }
  }

  return {
    statuses,
    overallPct: Math.max(0, Math.min(100, (overallPct / totalWeight) * 100)),
  };
}

/**
 * Smooth the raw `pct` by per-stage drift. While a slow stage is active the
 * value creeps from the anchor pct toward the stage's drift ceiling so the
 * bar moves continuously between widely-spaced backend events.
 *
 * The anchor (`anchorStage`, `anchorAt`, `anchorPct`) lives in the Zustand
 * store — not component state — so a remount (e.g. the user navigates away
 * from the active meeting and back) doesn't snap the smoothed value back
 * to the raw emitted pct.
 */
function driftedPct(
  rawPct: number,
  stage: string,
  anchorAt: number,
  anchorPct: number,
  now: number,
): number {
  const hint = STAGE_DRIFT[stage];
  if (!hint) return rawPct;
  const ceiling = Math.max(hint.driftTo, anchorPct);
  const elapsed = now - anchorAt;
  const t = Math.min(1, Math.max(0, elapsed / hint.durationMs));
  // Ease-out: fast at the start (when the operation is most-likely making
  // visible progress) and slow as we approach the ceiling.
  const eased = 1 - Math.pow(1 - t, 2);
  const drifted = anchorPct + (ceiling - anchorPct) * eased;
  return Math.max(rawPct, Math.min(drifted, ceiling));
}

export function ProcessingProgress({ meetingId }: { meetingId: string }) {
  const processing = useScribe((s) => s.processing);
  if (processing.kind !== "processing" || processing.meetingId !== meetingId) {
    return null;
  }
  return <ProcessingPanel state={processing} />;
}

function ProcessingPanel({
  state,
}: {
  state: Extract<ProcessingState, { kind: "processing" }>;
}) {
  const t = useT();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    // 200 ms keeps drift smooth without burning frames — the bar itself has
    // a 500 ms CSS transition that further interpolates between ticks.
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  // `startedAt` and the drift anchor come from the store, so navigating away
  // from this meeting and back doesn't reset the timer or snap the bar to
  // the raw emitted pct (both would happen with component-local useState).
  const elapsed = now - state.startedAt;
  const steps = activeSteps(state);
  const currentStep = stageToStep(state.stage, steps, state.phase);
  const smoothedPct = driftedPct(
    state.pct,
    state.stage,
    state.driftAnchorAt,
    state.driftAnchorPct,
    now,
  );
  const { statuses, overallPct } = computeStatus(
    steps,
    currentStep,
    smoothedPct,
    state.stage,
  );

  const headline =
    state.flow === "generate-only"
      ? t("processing.headline.generate")
      : state.flow === "transcribe-only"
        ? t("processing.headline.transcribe")
        : state.flow === "diarize-only"
          ? t("processing.headline.diarize")
          : t("processing.headline.default");

  return (
    <div className="border-y bg-gradient-to-b from-accent/40 via-accent/20 to-transparent">
      <div className="mx-auto w-full max-w-3xl px-8 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <ShimmerDot />
            <div className="flex min-w-0 flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold tracking-tight">{headline}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {stageLabel(state.stage, t)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-baseline gap-2">
            {state.model && (
              <span className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground/70">
                {state.model}
              </span>
            )}
            {state.note && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {state.note}
              </span>
            )}
            <span className="font-mono text-xs font-semibold tabular-nums">
              {Math.round(overallPct)}%
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatElapsed(elapsed)}
            </span>
          </div>
        </div>

        <ProgressTrack pct={overallPct} />

        <div className="mt-3 flex items-center justify-between">
          {steps.map((step, i) => (
            <Step
              key={step.key}
              step={step}
              status={statuses.get(step.key) ?? "pending"}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgressTrack({ pct }: { pct: number }) {
  return (
    <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/80 via-primary to-primary/80 transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-white/20 mix-blend-overlay transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute inset-y-0 w-12 -translate-x-full animate-[shimmer_2s_infinite] rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function Step({
  step,
  status,
  isLast,
}: {
  step: StepDef;
  status: StepStatus;
  isLast: boolean;
}) {
  const t = useT();
  const isActive = status === "active";
  const isComplete = status === "complete";
  const isSkipped = status === "skipped";

  return (
    <div className="flex flex-1 items-center gap-1.5">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "relative flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
            isComplete && "border-emerald-500/60 bg-emerald-500/10 text-emerald-600",
            isActive && "border-primary bg-primary/10 text-primary",
            isSkipped && "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground/60",
            !isActive && !isComplete && !isSkipped && "border-border bg-muted/40 text-muted-foreground/60",
          )}
        >
          {isActive && (
            <>
              <HugeiconsIcon
                icon={Loading03Icon}
                className="absolute size-7 animate-spin text-primary/40"
              />
              <HugeiconsIcon icon={step.icon} className="size-3.5" />
            </>
          )}
          {isComplete && (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
          )}
          {isSkipped && <span className="text-[10px]">—</span>}
          {!isActive && !isComplete && !isSkipped && (
            <HugeiconsIcon icon={step.icon} className="size-3.5" />
          )}
        </div>
        <span
          className={cn(
            "whitespace-nowrap text-[11px] font-medium transition-colors",
            isActive && "text-foreground",
            isComplete && "text-foreground/70",
            (status === "pending" || isSkipped) && "text-muted-foreground/70",
          )}
        >
          {t(step.labelKey)}
        </span>
      </div>
      {!isLast && (
        <div
          className={cn(
            "h-px flex-1 transition-colors",
            isComplete ? "bg-emerald-500/40" : "bg-border",
          )}
        />
      )}
    </div>
  );
}

function ShimmerDot() {
  return (
    <span className="relative inline-flex size-2 shrink-0 items-center justify-center">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-75" />
      <HugeiconsIcon
        icon={SparklesIcon}
        className="relative size-3.5 -m-0.5 text-primary"
      />
    </span>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
