import { listCalendarAccounts, listCalendarEventsOverlapping } from "./db.js";
import { showNotification } from "./floating-windows.js";

/**
 * How far ahead of an event's start we surface the notification.
 *
 * Why 2 minutes: leaves enough lead to launch a Meet tab and hit Start, but
 * not so early that users dismiss it and forget by the time the call begins.
 */
const NOTIFY_LEAD_MS = 2 * 60 * 1000;

/**
 * Once an event's start is more than `NOTIFY_EXPIRE_MS` in the past, we
 * forget that we notified it — frees the dedupe set for the (uncommon) case
 * of an event being rescheduled across the same key.
 */
const NOTIFY_EXPIRE_MS = 10 * 60 * 1000;

const POLL_INTERVAL_MS = 30 * 1000;

interface NotifiedEntry {
  startAtMs: number;
}

const notified = new Map<string, NotifiedEntry>();
let timer: NodeJS.Timeout | null = null;

function tick(): void {
  try {
    // Don't spin up the notification window if no calendars are connected —
    // saves a wasted poll for users that never enabled Calendar.
    if (listCalendarAccounts().length === 0) return;

    const now = Date.now();
    const events = listCalendarEventsOverlapping(now, now + NOTIFY_LEAD_MS);

    // GC the dedupe set.
    for (const [id, entry] of notified) {
      if (entry.startAtMs + NOTIFY_EXPIRE_MS < now) notified.delete(id);
    }

    for (const ev of events) {
      // Only events that haven't started yet — once they're live the
      // notification carries less value than the inline Start Scribe button.
      if (ev.start_at_ms <= now) continue;
      // Already linked → user has clearly recorded this; don't nag.
      if (ev.meeting_id) continue;
      if (notified.has(ev.id)) continue;

      const minutesUntilStart = Math.max(
        1,
        Math.round((ev.start_at_ms - now) / 60_000),
      );
      notified.set(ev.id, { startAtMs: ev.start_at_ms });
      showNotification({ event: ev, minutesUntilStart });
      // Only one notification at a time — the next tick will surface the
      // next event if it's still within the lead window.
      return;
    }
  } catch (err) {
    console.warn("event-notifier tick failed:", err);
  }
}

export function startEventNotifier(): void {
  if (timer != null) return;
  // First tick after a short delay so the DB/IPC are warm.
  setTimeout(tick, 2000);
  timer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopEventNotifier(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Test hook — let the user re-trigger a dismissed notification. */
export function forgetNotifiedEvent(eventId: string): void {
  notified.delete(eventId);
}
