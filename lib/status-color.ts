/**
 * Shared color fragments for "review" (amber) and "linked / success" (emerald)
 * status indicators. Used by voice-library badges, calendar event states, and
 * the review banner on a meeting. Keep these in sync so the same semantic
 * intent reads the same way wherever it appears.
 *
 * Use as a className fragment — combine with layout / sizing classes at the
 * call site (e.g. `cn(REVIEW_BADGE, "rounded-full border px-1.5 py-0.5 …")`).
 */
export const REVIEW_BADGE =
  "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";

export const LINKED_BADGE =
  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

/** Hover variant for buttons styled like REVIEW_BADGE — slightly stronger fill. */
export const REVIEW_BADGE_HOVER = "hover:bg-amber-500/15";
