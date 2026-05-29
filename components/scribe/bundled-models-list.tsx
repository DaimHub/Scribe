"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Delete02Icon,
  Download04Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

interface BundledModelInfo {
  id: string;
  displayName: string;
  approxSizeMb: number;
  downloaded: boolean;
  downloading?: { downloadedBytes: number; totalBytes: number | null };
}

interface DownloadState {
  downloadedBytes: number;
  totalBytes: number | null;
}

interface Props {
  /** Currently selected bundled model id (from llm settings). */
  selectedId: string;
  /** Make this model the active bundled model for note generation. */
  onSelect: (id: string) => Promise<void> | void;
}

/** Replaces the old single-Select with a per-model card list so the user
 *  can see size, download status, and trigger a download explicitly.
 *  Generation in `bundled.ts` no longer auto-downloads — picking a
 *  not-downloaded model and clicking Generate will throw a typed error,
 *  so the user is funneled back here. */
export function BundledModelsList({ selectedId, onSelect }: Props) {
  const t = useT();
  const [models, setModels] = useState<BundledModelInfo[] | null>(null);
  // Track in-flight downloads in a map so progress events can update only
  // the matching row. We seed from the server's snapshot on refresh so
  // re-opening Settings during a download immediately shows the bar.
  const [downloads, setDownloads] = useState<Map<string, DownloadState>>(
    () => new Map(),
  );
  // Surface the latest download failure inline (server resets this to ok
  // on the next successful run).
  const [errors, setErrors] = useState<Map<string, string>>(() => new Map());
  // Inline two-step confirmation for delete — the first click flips this
  // to the model id, the second click actually unlinks. Switching rows or
  // re-rendering clears it (so accidental long-tap doesn't strand state).
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function refresh() {
    const list = await window.scribe.llm.listBundledModels();
    setModels(list);
    // Seed the downloads map from any in-flight downloads the backend
    // reports, so a tab switch doesn't lose the progress bar.
    setDownloads((prev) => {
      const next = new Map(prev);
      for (const m of list) {
        if (m.downloading) next.set(m.id, m.downloading);
        else next.delete(m.id);
      }
      return next;
    });
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Subscribe once to progress + done events. The backend broadcasts to
  // every renderer; we filter per row inside setDownloads.
  useEffect(() => {
    const offProgress = window.scribe.llm.onBundledDownloadProgress((p) => {
      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(p.model, {
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
        });
        return next;
      });
    });
    const offDone = window.scribe.llm.onBundledDownloadDone((p) => {
      setDownloads((prev) => {
        const next = new Map(prev);
        next.delete(p.model);
        return next;
      });
      if (!p.ok && p.error) {
        setErrors((prev) => {
          const next = new Map(prev);
          next.set(p.model, p.error!);
          return next;
        });
      } else {
        setErrors((prev) => {
          const next = new Map(prev);
          next.delete(p.model);
          return next;
        });
      }
      // Re-read the downloaded flag for the just-finished model.
      void refresh();
    });
    return () => {
      offProgress();
      offDone();
    };
  }, []);

  async function startDelete(id: string) {
    setDeleting(id);
    try {
      await window.scribe.llm.deleteBundledModel(id);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      setErrors((prev) => {
        const next = new Map(prev);
        next.set(id, err instanceof Error ? err.message : String(err));
        return next;
      });
    } finally {
      setDeleting(null);
    }
  }

  async function startDownload(id: string) {
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    // Optimistically set a 0% state so the bar shows immediately, even if
    // the first server-side progress event takes a beat.
    setDownloads((prev) => {
      const next = new Map(prev);
      if (!next.has(id)) {
        next.set(id, { downloadedBytes: 0, totalBytes: null });
      }
      return next;
    });
    try {
      await window.scribe.llm.downloadBundledModel(id);
    } catch (err) {
      // Server-side errors come through `onBundledDownloadDone` as well,
      // but await rejects too — keep the local fallback for symmetry.
      setErrors((prev) => {
        const next = new Map(prev);
        next.set(id, err instanceof Error ? err.message : String(err));
        return next;
      });
      setDownloads((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (!models) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {models.map((m) => {
        const active = m.id === selectedId;
        const downloading = downloads.get(m.id);
        const error = errors.get(m.id);
        const totalMb = downloading?.totalBytes
          ? downloading.totalBytes / 1024 / 1024
          : m.approxSizeMb;
        const downloadedMb = downloading
          ? downloading.downloadedBytes / 1024 / 1024
          : 0;
        const pct =
          downloading?.totalBytes && downloading.totalBytes > 0
            ? Math.round(
                (downloading.downloadedBytes / downloading.totalBytes) * 100,
              )
            : null;

        return (
          <div
            key={m.id}
            className={cn(
              "flex flex-col gap-2 rounded-md border bg-card/50 p-3 transition-colors",
              active && "border-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {m.displayName}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    ~{formatSizeMb(m.approxSizeMb)}
                  </span>
                  {m.downloaded && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        className="size-3"
                      />
                      {t("settings.ai.bundled.downloaded")}
                    </span>
                  )}
                  {active && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-primary">
                      {t("settings.ai.bundled.selected")}
                    </span>
                  )}
                </div>
                {active && !m.downloaded && !downloading && (
                  <p className="text-[12px] leading-snug text-amber-600 dark:text-amber-400">
                    {t("settings.ai.bundled.notDownloadedHint")}
                  </p>
                )}
                {error && (
                  <p className="text-[12px] leading-snug text-destructive">
                    {t("settings.ai.bundled.downloadFailed")}: {error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!m.downloaded && !downloading && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void startDownload(m.id)}
                  >
                    <HugeiconsIcon icon={Download04Icon} className="size-3.5" />
                    {t("settings.ai.bundled.download")}
                  </Button>
                )}
                {!active && m.downloaded && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onSelect(m.id)}
                  >
                    {t("settings.ai.bundled.select")}
                  </Button>
                )}
                {m.downloaded && !downloading && (
                  <Button
                    size="sm"
                    variant={
                      confirmDelete === m.id ? "destructive" : "ghost"
                    }
                    disabled={deleting === m.id}
                    onClick={() => {
                      if (confirmDelete === m.id) {
                        void startDelete(m.id);
                      } else {
                        setConfirmDelete(m.id);
                      }
                    }}
                    onBlur={() => {
                      // Cancel pending confirmation if focus moves away —
                      // otherwise the confirm state lingers across rows.
                      if (confirmDelete === m.id && deleting !== m.id) {
                        setConfirmDelete(null);
                      }
                    }}
                    aria-label={t("settings.ai.bundled.delete")}
                    title={t("settings.ai.bundled.delete")}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                    {confirmDelete === m.id &&
                      t("settings.ai.bundled.deleteConfirm")}
                  </Button>
                )}
              </div>
            </div>

            {downloading && (
              <div className="flex flex-col gap-1">
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-150"
                    style={{
                      width:
                        pct !== null
                          ? `${pct}%`
                          // Indeterminate fallback when the server didn't send
                          // Content-Length yet — narrow strip pulsing.
                          : "30%",
                    }}
                  />
                </div>
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{t("settings.ai.bundled.downloading")}</span>
                  <span>
                    {pct !== null
                      ? `${pct}% · ${formatSizeMb(downloadedMb)} / ${formatSizeMb(totalMb)}`
                      : formatSizeMb(downloadedMb)}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatSizeMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
