"use client";

import { useEffect, useState } from "react";
import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";

/**
 * Small dialog raised by the store whenever the user is on Claude (CLI)
 * with `claude_code_model = "ask"` and triggers a generation. The user
 * picks a model here; the store then dispatches the original intent
 * (generate or processMeeting) with `modelOverride` set.
 *
 * Lives separately from SpeakerPromptDialog so it can be raised from paths
 * that have no speaker count to ask about (regenerate-only menu items).
 */
export function ModelPromptDialog() {
  const modelPrompt = useScribe((s) => s.modelPrompt);
  const confirmModelPrompt = useScribe((s) => s.confirmModelPrompt);
  const closeModelPrompt = useScribe((s) => s.closeModelPrompt);
  const t = useT();

  const [models, setModels] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (!modelPrompt.open) return;
    let cancelled = false;
    setChosen(null);
    void (async () => {
      try {
        const list = await window.scribe.llm.listClaudeCodeModels();
        if (!cancelled) {
          setModels(list);
          // Default to the first model in the list (typically the most
          // capable) so Enter immediately commits a reasonable choice.
          setChosen((prev) => prev ?? list[0] ?? null);
        }
      } catch {
        /* picker shows empty — user must Cancel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelPrompt.open]);

  if (!modelPrompt.open || !modelPrompt.intent) {
    return (
      <Dialog open={false} onOpenChange={() => undefined}>
        <DialogContent />
      </Dialog>
    );
  }

  const intentLabel =
    modelPrompt.intent.kind === "generate"
      ? t("summary.generateNotes")
      : t("header.process");

  return (
    <Dialog
      open={modelPrompt.open}
      onOpenChange={(v) => {
        if (!v) closeModelPrompt();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("modelPrompt.title")}</DialogTitle>
          <DialogDescription>
            {t("modelPrompt.desc", { intent: intentLabel })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {models.map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              <input
                type="radio"
                name="model-prompt"
                value={m}
                checked={chosen === m}
                onChange={() => setChosen(m)}
                className="size-3.5"
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => closeModelPrompt()}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => chosen && confirmModelPrompt(chosen)}
            disabled={!chosen}
            className="gap-1.5"
          >
            <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
            {intentLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
