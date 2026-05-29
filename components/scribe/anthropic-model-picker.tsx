"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Returns true when the active provider is claude-code with model set to
 * "ask" (the sentinel meaning "prompt me each time"). Action buttons use
 * this to gate themselves: disable until the user has explicitly picked a
 * model in the inline picker.
 *
 * Lazy fetch, no live updates — Settings changes during a session are
 * picked up the next time a component mounts.
 */
export function useAskMode(): boolean {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await window.scribe.llm.getProviderConfig();
        if (!cancelled) {
          setAsk(
            cfg.provider === "claude-code" && cfg.claude_code_model === "ask",
          );
        }
      } catch {
        /* default false — caller proceeds as if ask mode is off */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return ask;
}

type Status =
  | { kind: "loading" }
  | { kind: "off" }
  | {
      kind: "ready";
      models: string[];
      defaultModel: string | null;
      /** True when the user explicitly set "Ask each time" in Settings;
       *  the picker then refuses to fall back to a default and demands a
       *  conscious pick. */
      askMode: boolean;
    };

/**
 * Compact "Model" selector that renders only when the active LLM provider
 * is one of the Claude-backed ones (anthropic API or claude-code CLI).
 * Lets the user pin a per-call model override without leaving the Process /
 * Generate flow.
 *
 * Models source depends on the provider:
 *  - anthropic: live `detectAnthropic` probe (uses the user's key).
 *  - claude-code: hardcoded list from the main process (the CLI has no
 *    discovery endpoint and the IDs are stable).
 * In both cases the user's configured default is highlighted in the list.
 *
 * Kept named `AnthropicModelPicker` for stable import paths; the component
 * itself is generic across both Claude provider kinds.
 */
export function AnthropicModelPicker({
  value,
  onChange,
  className,
}: {
  /** Override the user has explicitly picked, or `null` to mean "use the
   *  default configured in Settings". */
  value: string | null;
  onChange: (model: string | null) => void;
  className?: string;
}) {
  const t = useT();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await window.scribe.llm.getProviderConfig();
        if (cancelled) return;
        if (cfg.provider === "anthropic") {
          if (!cfg.has_anthropic_key) {
            setStatus({ kind: "off" });
            return;
          }
          const res = await window.scribe.llm.detectAnthropic();
          if (cancelled) return;
          if (!res.ok || !res.models) {
            setStatus({ kind: "off" });
            return;
          }
          setStatus({
            kind: "ready",
            models: res.models.map((m) => m.id),
            defaultModel: cfg.anthropic_model,
            askMode: false,
          });
        } else if (cfg.provider === "claude-code") {
          const models = await window.scribe.llm.listClaudeCodeModels();
          if (cancelled) return;
          const askMode = cfg.claude_code_model === "ask";
          setStatus({
            kind: "ready",
            models,
            // In ask mode, there's no "default" model — Settings stored the
            // sentinel, not a real id. Force the user to pick consciously.
            defaultModel: askMode ? null : cfg.claude_code_model,
            askMode,
          });
        } else {
          setStatus({ kind: "off" });
        }
      } catch {
        if (!cancelled) setStatus({ kind: "off" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.kind === "off" || status.kind === "loading") return null;

  const selected = value ?? status.defaultModel ?? "";

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label
        htmlFor="anthropic-model-picker"
        className="text-xs font-medium text-muted-foreground"
      >
        {t("settings.ai.anthropic.model")}{" "}
        {status.askMode && !value && (
          <span className="text-destructive">{t("modelPicker.required")}</span>
        )}
      </label>
      <Select
        value={selected || undefined}
        onValueChange={(v) => onChange((v as string) || null)}
      >
        <SelectTrigger
          id="anthropic-model-picker"
          size="sm"
          className="w-full"
        >
          <SelectValue placeholder={t("modelPicker.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {status.defaultModel &&
            !status.models.includes(status.defaultModel) && (
              <SelectItem value={status.defaultModel}>
                {t("modelPicker.default", { model: status.defaultModel })}
              </SelectItem>
            )}
          {status.models.map((m) => (
            <SelectItem key={m} value={m}>
              {m === status.defaultModel
                ? t("modelPicker.default", { model: m })
                : m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
