"use client";

import { useEffect, useState } from "react";

// Accent colours map to a single OKLCH hue. The lightness/chroma for the
// `--primary` swatches live in app/globals.css (separate light + dark values)
// and reference `--scribe-accent-hue`; we only flip the hue here.
export type AccentName =
  | "indigo"
  | "violet"
  | "blue"
  | "teal"
  | "emerald"
  | "amber"
  | "rose"
  | "pink";

export interface AccentDef {
  name: AccentName;
  hue: number;
  /** Swatch shown in the picker — matches the dark-mode --primary lightness. */
  swatch: string;
}

export const ACCENTS: readonly AccentDef[] = [
  { name: "indigo", hue: 277.023, swatch: "oklch(0.55 0.22 277.023)" },
  { name: "violet", hue: 305, swatch: "oklch(0.55 0.22 305)" },
  { name: "pink", hue: 350, swatch: "oklch(0.6 0.22 350)" },
  { name: "rose", hue: 20, swatch: "oklch(0.6 0.22 20)" },
  { name: "amber", hue: 65, swatch: "oklch(0.7 0.18 65)" },
  { name: "emerald", hue: 155, swatch: "oklch(0.6 0.18 155)" },
  { name: "teal", hue: 195, swatch: "oklch(0.6 0.18 195)" },
  { name: "blue", hue: 245, swatch: "oklch(0.55 0.22 245)" },
];

export const DEFAULT_ACCENT: AccentName = "indigo";
export const ACCENT_STORAGE_KEY = "scribe:accent";

export function isAccentName(value: unknown): value is AccentName {
  return (
    typeof value === "string" && ACCENTS.some((a) => a.name === value)
  );
}

export function hueFor(name: AccentName): number {
  return ACCENTS.find((a) => a.name === name)?.hue ?? ACCENTS[0].hue;
}

export function applyAccent(name: AccentName): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--scribe-accent-hue",
    String(hueFor(name)),
  );
}

export function loadAccent(): AccentName {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const raw = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentName(raw) ? raw : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function saveAccent(name: AccentName): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
}

/** Inline script that applies the saved hue before first paint — avoids a
 *  flash of the default indigo when the user picked a different colour. */
export const ACCENT_BOOTSTRAP_SCRIPT = `
(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});
    var map = ${JSON.stringify(
      Object.fromEntries(ACCENTS.map((a) => [a.name, a.hue])),
    )};
    var hue = (raw && map[raw]) || ${JSON.stringify(hueFor(DEFAULT_ACCENT))};
    document.documentElement.style.setProperty('--scribe-accent-hue', String(hue));
  } catch (e) {}
})();
`;

export function useAccent(): {
  accent: AccentName;
  setAccent: (name: AccentName) => void;
} {
  const [accent, setAccentState] = useState<AccentName>(DEFAULT_ACCENT);

  // Hydrate from localStorage on mount. The bootstrap script already pushed
  // the saved hue onto the document root before paint, so we only need to
  // sync React state here.
  useEffect(() => {
    setAccentState(loadAccent());
  }, []);

  function setAccent(name: AccentName) {
    setAccentState(name);
    saveAccent(name);
    applyAccent(name);
  }

  return { accent, setAccent };
}
