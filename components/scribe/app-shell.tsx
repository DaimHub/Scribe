"use client";

import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ScribeSidebar } from "./sidebar";
import { MeetingView } from "./meeting-view";
import { TasksView } from "./tasks-view";
import { RecordingBar } from "./recording-bar";
import { TopBar } from "./top-bar";
import { useScribe } from "@/lib/store";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import type { AutoLinkToastState } from "@/lib/store";

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
  return (
    <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
      Loading…
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
  );
}

function AppShellInner() {
  const error = useScribe((s) => s.error);
  const clearError = useScribe((s) => s.clearError);
  const activeSection = useScribe((s) => s.activeSection);

  useGlobalShortcuts();

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
      {error && <ErrorToast message={error} onDismiss={clearError} />}
      <AutoLinkToast />
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
    names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  const headline =
    toast.autoLinked.length === 1
      ? "Auto-linked 1 speaker"
      : `Auto-linked ${toast.autoLinked.length} speakers`;
  const reviewSuffix =
    toast.needsReviewCount > 0
      ? ` · ${toast.needsReviewCount} need${
          toast.needsReviewCount === 1 ? "s" : ""
        } review`
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
            {namesText} from your voice library.
          </div>
          <button
            type="button"
            onClick={onReview}
            className="mt-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Review in People
          </button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  );
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
            Something went wrong
          </div>
          <div className="mt-1 break-words text-xs leading-snug text-muted-foreground">
            {message}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
