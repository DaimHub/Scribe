"use client";

import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ScribeSidebar } from "./sidebar";
import { MeetingView } from "./meeting-view";
import { TasksView } from "./tasks-view";
import { RecordingBar } from "./recording-bar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { FindBar } from "./find-bar";
import { useScribe } from "@/lib/store";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import type { AutoLinkToastState } from "@/lib/store";
import { I18nProvider, useT } from "@/lib/i18n";

// CalendarView and SettingsView are large (calendar grid + ~1400 LoC of
// settings) and not on the meeting hot path. Lazy them out of the initial
// renderer bundle.
const CalendarView = lazy(() =>
  import("./calendar-view").then((m) => ({ default: m.CalendarView })),
);
const SettingsView = lazy(() =>
  import("./settings-view").then((m) => ({ default: m.SettingsView })),
);
const PeopleView = lazy(() =>
  import("./people-view").then((m) => ({ default: m.PeopleView })),
);

function LazyViewFallback() {
  const t = useT();
  return (
    <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
      {t("view.loading")}
    </div>
  );
}

export function AppShell() {
  const init = useScribe((s) => s.init);
  const sidebarWidth = useScribe((s) => s.sidebarWidth);

  useEffect(() => {
    void init();
  }, [init]);

  // Sidebar is permanently open — user can resize but not hide. We control
  // `open` so nothing (Cmd+B in the shadcn primitive, mobile sheet, etc.) can
  // flip it. onOpenChange is a no-op for the same reason.
  const noop = useCallback(() => {}, []);

  return (
    <I18nProvider>
      <SidebarProvider
        open
        onOpenChange={noop}
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
        className="h-screen w-screen overflow-hidden"
      >
        <AppShellInner />
      </SidebarProvider>
    </I18nProvider>
  );
}

function AppShellInner() {
  const error = useScribe((s) => s.error);
  const clearError = useScribe((s) => s.clearError);
  const activeSection = useScribe((s) => s.activeSection);

  useGlobalShortcuts();
  useSmartAutoRefresh();

  return (
    <div className="relative flex h-full w-full">
      <ScribeSidebar />

      <SidebarInset className="relative flex h-full min-w-0 flex-1 flex-col bg-background">
        <TopBar />
        {activeSection === "meetings" && <MeetingView />}
        {activeSection === "tasks" && <TasksView />}
        {activeSection === "calendar" && (
          <Suspense fallback={<LazyViewFallback />}>
            <CalendarView />
          </Suspense>
        )}
        {activeSection === "people" && (
          <Suspense fallback={<LazyViewFallback />}>
            <PeopleView />
          </Suspense>
        )}
        {activeSection === "settings" && (
          <Suspense fallback={<LazyViewFallback />}>
            <SettingsView />
          </Suspense>
        )}
      </SidebarInset>

      <RecordingBar />
      <CommandPalette />
      <FindBar />
      {error && <ErrorToast message={error} onDismiss={clearError} />}
      <AutoLinkToast />
      <SystemAudioNotice />
    </div>
  );
}

function SystemAudioNotice() {
  const t = useT();
  const show = useScribe((s) => s.systemAudioNotice);
  const dismiss = useScribe((s) => s.dismissSystemAudioNotice);
  const openSettings = useScribe((s) => s.openScreenRecordingSettings);
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      // top-32 sits below the error/auto-link toasts so it doesn't overlap when
      // more than one is visible during a recording.
      className="pointer-events-auto absolute right-4 top-32 z-50 w-[min(28rem,calc(100vw-2rem))] animate-in fade-in-0 slide-in-from-top-2 duration-150"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-card/95 p-3 pr-2 shadow-2xl ring-1 ring-black/5 backdrop-blur-md">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400"
          aria-hidden
        >
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-sm font-semibold leading-tight text-foreground">
            {t("toast.systemAudioTitle")}
          </div>
          <div className="mt-1 break-words text-xs leading-snug text-muted-foreground">
            {t("toast.systemAudioBody")}
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="mt-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("toast.openScreenSettings")}
          </button>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.dismiss")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function AutoLinkToast() {
  const toast = useScribe((s) => s.autoLinkToast);
  const dismiss = useScribe((s) => s.dismissAutoLinkToast);
  const selectMeeting = useScribe((s) => s.selectMeeting);
  const setActiveSection = useScribe((s) => s.setActiveSection);
  if (!toast || toast.autoLinked.length === 0) return null;
  function onReview() {
    if (!toast) return;
    // Jump to the meeting and open the People view alongside, so the user can
    // confirm or correct the auto-link in either context.
    void selectMeeting(toast.meetingId);
    setActiveSection("people");
    dismiss();
  }
  return <AutoLinkToastView toast={toast} onDismiss={dismiss} onReview={onReview} />;
}

const AUTO_LINK_TOAST_TIMEOUT_MS = 8000;

function AutoLinkToastView({
  toast,
  onDismiss,
  onReview,
}: {
  toast: AutoLinkToastState;
  onDismiss: () => void;
  onReview: () => void;
}) {
  const t = useT();
  const timerRef = useRef<number | null>(null);
  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const arm = useCallback(() => {
    clear();
    timerRef.current = window.setTimeout(onDismiss, AUTO_LINK_TOAST_TIMEOUT_MS);
  }, [clear, onDismiss]);
  useEffect(() => {
    arm();
    return clear;
  }, [arm, clear, toast]);

  const names = toast.autoLinked.map((a) => a.displayName);
  const namesText =
    names.length <= 2
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  const headline =
    toast.autoLinked.length === 1
      ? t("toast.autoLinkedOne")
      : t("toast.autoLinkedMany", { count: toast.autoLinked.length });
  const reviewSuffix =
    toast.needsReviewCount > 0
      ? toast.needsReviewCount === 1
        ? t("toast.needsReviewSuffixOne")
        : t("toast.needsReviewSuffix", { count: toast.needsReviewCount })
      : "";
  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={clear}
      onMouseLeave={arm}
      onFocus={clear}
      onBlur={arm}
      className="pointer-events-auto absolute right-4 top-16 z-50 w-[min(28rem,calc(100vw-2rem))] animate-in fade-in-0 slide-in-from-top-2 duration-150"
    >
      <div className="flex items-start gap-3 rounded-2xl border bg-card/95 p-3 pr-2 shadow-2xl ring-1 ring-black/5 backdrop-blur-md">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        >
          <HugeiconsIcon icon={UserCheck01Icon} className="size-4" />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-sm font-semibold leading-tight text-foreground">
            {headline}
            {reviewSuffix}
          </div>
          <div className="mt-1 break-words text-xs leading-snug text-muted-foreground">
            {t("toast.autoLinkedDetail", { names: namesText })}
          </div>
          <button
            type="button"
            onClick={onReview}
            className="mt-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("toast.reviewInPeople")}
          </button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.dismiss")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * "Smart resync" — refresh the active view whenever the Scribe window regains
 * focus or the document becomes visible again. Covers the common case where
 * the user switched to another app (Cursor, Claude Code, the MCP tool) to
 * mutate Scribe's data and then comes back expecting to see the change,
 * without having to hit the refresh button by hand.
 *
 * Guards:
 *   - Throttled to once per 10s so focus storms (alt-tab dance) don't pile
 *     up redundant DB reads.
 *   - Skipped while a recording is in progress (selectMeeting would clobber
 *     the live `detail` mid-capture).
 *   - Skipped if a refresh is already in flight (refreshActiveView early-
 *     returns anyway; checked here too to avoid mutating the throttle clock
 *     for a call we know is a no-op).
 *   - Skipped while the document is hidden — visibilitychange fires once
 *     when the user comes back, which is the moment we actually want.
 */
const SMART_REFRESH_THROTTLE_MS = 10_000;

function useSmartAutoRefresh() {
  const refresh = useScribe((s) => s.refreshActiveView);
  useEffect(() => {
    let lastAt = 0;
    const maybeRefresh = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const st = useScribe.getState();
      if (st.recording.kind === "recording" || st.refreshing) return;
      const now = Date.now();
      if (now - lastAt < SMART_REFRESH_THROTTLE_MS) return;
      lastAt = now;
      void refresh();
    };
    const onFocus = () => maybeRefresh();
    const onVisibility = () => {
      if (!document.hidden) maybeRefresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);
}

function useGlobalShortcuts() {
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const s = useScribe.getState();

      // Esc dismisses an error toast even if focus is in an input.
      if (e.key === "Escape" && s.error) {
        e.preventDefault();
        s.clearError();
        return;
      }

      // Cmd/Ctrl+K toggles the command palette — even when an input has
      // focus, so it works while typing in the meeting title, tag chip, etc.
      if (mod && !e.shiftKey && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        s.togglePalette();
        return;
      }

      // Cmd/Ctrl+F opens (or refocuses) the find-in-page bar. Like Cmd+K it
      // bypasses isTypingTarget so the user can trigger it while the title
      // input or a transcript edit field has focus.
      if (mod && !e.shiftKey && !e.altKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        s.openFind();
        return;
      }

      if (isTypingTarget(e.target)) return;

      // Cmd+Shift+R toggles recording (Cmd+R is reserved for reload).
      if (mod && e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        if (s.recording.kind === "recording") void s.stopRecording();
        else if (s.recording.kind === "idle") void s.startRecording();
        return;
      }

      // Cmd+1/2/3 cycles the meeting tabs (only meaningful while viewing one).
      if (mod && !e.shiftKey && !e.altKey && s.activeSection === "meetings") {
        if (e.key === "1") {
          e.preventDefault();
          s.setMeetingTab("summary");
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          s.setMeetingTab("transcript");
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          s.setMeetingTab("tasks");
          return;
        }
      }
    }

    // capture: true runs before bubble-phase handlers (including Chromium's
    // built-in Cmd+1..9 tab-switch interceptor and any focused element that
    // might preventDefault on the bubble phase, e.g. the <audio> control).
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
}

const ERROR_TOAST_TIMEOUT_MS = 6000;

function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const t = useT();
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    clear();
    timerRef.current = window.setTimeout(onDismiss, ERROR_TOAST_TIMEOUT_MS);
  }, [clear, onDismiss]);

  useEffect(() => {
    arm();
    return clear;
  }, [arm, clear, message]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={clear}
      onMouseLeave={arm}
      onFocus={clear}
      onBlur={arm}
      // top-16 clears the 48px topbar so the Start Scribe button stays
      // clickable and the toast text isn't clipped behind it.
      className="pointer-events-auto absolute right-4 top-16 z-50 w-[min(28rem,calc(100vw-2rem))] animate-in fade-in-0 slide-in-from-top-2 duration-150"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-card/95 p-3 pr-2 shadow-2xl ring-1 ring-black/5 backdrop-blur-md">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          aria-hidden
        >
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-sm font-semibold leading-tight text-foreground">
            {t("toast.errorTitle")}
          </div>
          <div className="mt-1 break-words text-xs leading-snug text-muted-foreground">
            {message}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("toast.dismissError")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
