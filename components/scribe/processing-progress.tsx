"use client";

import { useEffect, useState } from "react";
import { useScribe, type ProcessingState } from "@/lib/store";
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
  label: string;
  icon: typeof Mic01Icon;
  /** Approx share of overall pipeline progress. */
  weight: number;
}

const TRANSCRIBE_STEPS: StepDef[] = [
  { key: "mix", label: "Mix audio", icon: AudioWave02Icon, weight: 5 },
  { key: "transcribe", label: "Transcribe", icon: Mic01Icon, weight: 40 },
  { key: "align", label: "Align words", icon: VoiceIdIcon, weight: 10 },
  { key: "diarize", label: "Identify speakers", icon: UserMultiple02Icon, weight: 15 },
];

const NOTES_STEP: StepDef = {
  key: "notes",
  label: "Generate notes",
  icon: MagicWand01Icon,
  weight: 30,
};

const STAGE_LABELS: Record<string, string> = {
  starting: "Preparing",
  mixing: "Mixing audio tracks",
  "loading-runtime": "Loading runtime",
  "loading-audio": "Reading audio",
  "loading-model": "Loading Whisper model",
  transcribing: "Transcribing speech",
  transcribed: "Transcription ready",
  "loading-align": "Loading aligner",
  aligning: "Aligning word timestamps",
  "align-failed": "Alignment unavailable",
  "loading-diarize": "Loading diarizer",
  "diarize-loaded": "Diarizer ready",
  diarizing: "Listening for speakers",
  "diarize-segments": "Mapping segments",
  "diarize-assigned": "Assigning speakers",
  "diarize-failed": "Diarization unavailable",
  "diarize-skipped": "Diarization skipped",
  serializing: "Finalizing transcript",
  done: "Done",
  model: "Preparing language model",
  loading: "Loading language model",
  generating: "Writing summary & action items",
  writing: "Saving notes",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function stageToStep(stage: string): StepKey {
  if (stage === "mixing") return "mix";
  if (
    stage === "loading-runtime" ||
    stage === "loading-audio" ||
    stage === "loading-model" ||
    stage === "transcribing" ||
    stage === "transcribed" ||
    stage === "serializing" ||
    stage === "done"
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
    stage === "diarize-skipped"
  )
    return "diarize";
  // LLM stages
  if (
    stage === "model" ||
    stage === "loading" ||
    stage === "generating" ||
    stage === "writing"
  )
    return "notes";
  return "mix";
}

function activeSteps(p: Extract<ProcessingState, { kind: "processing" }>): StepDef[] {
  if (p.flow === "transcribe-only") return TRANSCRIBE_STEPS;
  if (p.flow === "generate-only") return [NOTES_STEP];
  return [...TRANSCRIBE_STEPS, NOTES_STEP];
}

function computeStatus(
  steps: StepDef[],
  currentStepKey: StepKey,
  pct: number,
  stage: string,
): { statuses: Map<StepKey, StepStatus>; overallPct: number } {
  const statuses = new Map<StepKey, StepStatus>();
  let reachedCurrent = false;
  let overallPct = 0;
  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);

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

  if (stage === "done" && currentStepKey === steps[steps.length - 1].key) {
    statuses.set(steps[steps.length - 1].key, "complete");
    overallPct = totalWeight;
  }

  return {
    statuses,
    overallPct: Math.max(0, Math.min(100, (overallPct / totalWeight) * 100)),
  };
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
  // Mounted only while processing this meeting — startedAt is fixed at mount.
  const [startedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = now - startedAt;
  const steps = activeSteps(state);
  const currentStep = stageToStep(state.stage);
  const { statuses, overallPct } = computeStatus(
    steps,
    currentStep,
    state.pct,
    state.stage,
  );

  const headline =
    state.flow === "generate-only"
      ? "Generating notes"
      : state.flow === "transcribe-only"
        ? "Processing transcript"
        : "Processing meeting";

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
                  {stageLabel(state.stage)}
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
          {step.label}
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
