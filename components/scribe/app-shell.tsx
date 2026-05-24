"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ScribeSidebar } from "./sidebar";
import { MeetingView } from "./meeting-view";
import { TasksView } from "./tasks-view";
import { RecordingBar } from "./recording-bar";
import { TopBar } from "./top-bar";
import { useScribe } from "@/lib/store";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

// CalendarView and SettingsView are large (calendar grid + ~1400 LoC of
// settings) and not on the meeting hot path. Lazy them out of the initial
// renderer bundle.
const CalendarView = lazy(() =>
  import("./calendar-view").then((m) => ({ default: m.CalendarView })),
);
const SettingsView = lazy(() =>
  import("./settings-view").then((m) => ({ default: m.SettingsView })),
);

function LazyViewFallback() {
  return (
    <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
      Loading…
    </div>
  );
}

const PEEK_HOVER_OPEN_MS = 120;
const PEEK_HOVER_CLOSE_MS = 320;
// Reveal strip generous enough that a casual mouse approach catches it.
const REVEAL_STRIP_PX = 20;
// Buffer past the visible sidebar where the cursor is still "in" the peek
// area — beyond this, we schedule a close.
const PEEK_BUFFER_PX = 32;

export function AppShell() {
  const init = useScribe((s) => s.init);
  const sidebarOpen = useScribe((s) => s.sidebarOpen);
  const sidebarWidth = useScribe((s) => s.sidebarWidth);
  const setSidebarOpen = useScribe((s) => s.setSidebarOpen);

  // Peek state lives here (above SidebarProvider) so we can fold it into the
  // effective `open` we hand the provider — peek = ephemeral open.
  const [peekRequested, setPeekRequested] = useState(false);
  const peeking = !sidebarOpen && peekRequested;
  const effectiveOpen = sidebarOpen || peeking;

  useEffect(() => {
    void init();
  }, [init]);

  // When the user explicitly toggles (button, Cmd+B), persist their preference
  // and clear any active peek so the next state reflects their choice.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setPeekRequested(false);
      setSidebarOpen(next);
    },
    [setSidebarOpen],
  );

  return (
    <SidebarProvider
      open={effectiveOpen}
      onOpenChange={handleOpenChange}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
      className="h-screen w-screen overflow-hidden"
    >
      <AppShellInner
        peeking={peeking}
        sidebarPersistedOpen={sidebarOpen}
        sidebarWidth={sidebarWidth}
        setPeekRequested={setPeekRequested}
      />
    </SidebarProvider>
  );
}

interface AppShellInnerProps {
  peeking: boolean;
  sidebarPersistedOpen: boolean;
  sidebarWidth: number;
  setPeekRequested: (v: boolean) => void;
}

function AppShellInner({
  peeking,
  sidebarPersistedOpen,
  sidebarWidth,
  setPeekRequested,
}: AppShellInnerProps) {
  const error = useScribe((s) => s.error);
  const clearError = useScribe((s) => s.clearError);
  const activeSection = useScribe((s) => s.activeSection);

  useGlobalShortcuts();

  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelOpen = useCallback(() => {
    if (openTimer.current != null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const cancelTimers = useCallback(() => {
    cancelOpen();
    cancelClose();
  }, [cancelOpen, cancelClose]);

  const scheduleOpen = useCallback(() => {
    if (openTimer.current != null) return; // already pending
    cancelClose();
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      setPeekRequested(true);
    }, PEEK_HOVER_OPEN_MS);
  }, [cancelClose, setPeekRequested]);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current != null) return; // already pending
    cancelOpen();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setPeekRequested(false);
    }, PEEK_HOVER_CLOSE_MS);
  }, [cancelOpen, setPeekRequested]);

  useEffect(() => cancelTimers, [cancelTimers]);

  const isCollapsed = !sidebarPersistedOpen;

  // While peeking, watch the cursor globally. The hover zone unmounts once peek
  // opens (so it can never receive a spurious mouseleave from the sidebar
  // sliding over it). Close is decided purely from cursor X vs the visible
  // sidebar bounds — robust against layout shifts and z-index races.
  useEffect(() => {
    if (sidebarPersistedOpen) return; // pinned open — nothing to manage
    if (!peeking) return; // hover zone handles the open case

    const closeBoundary = sidebarWidth + PEEK_BUFFER_PX;

    function onMove(e: MouseEvent) {
      if (e.clientX > closeBoundary) scheduleClose();
      else cancelClose();
    }
    function onLeave() {
      // Cursor left the window entirely — schedule close.
      scheduleClose();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [peeking, sidebarPersistedOpen, sidebarWidth, scheduleClose, cancelClose]);

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
        {activeSection === "settings" && (
          <Suspense fallback={<LazyViewFallback />}>
            <SettingsView />
          </Suspense>
        )}
      </SidebarInset>

      {/* Reveal strip — only when collapsed AND not yet peeking. Once peek
          opens, this unmounts and global mousemove takes over so we never get
          a spurious mouseleave from the sidebar sliding over us. */}
      {isCollapsed && !peeking && (
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: `${REVEAL_STRIP_PX}px`, zIndex: 5 }}
          onMouseEnter={scheduleOpen}
          onMouseLeave={cancelOpen}
          aria-hidden
        />
      )}

      <RecordingBar />
      {error && <ErrorToast message={error} onDismiss={clearError} />}
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
