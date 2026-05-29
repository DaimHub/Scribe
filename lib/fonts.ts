"use client";

import { useEffect, useState } from "react";

import type { TranslationKey } from "@/lib/i18n/dictionaries";

// User-selectable fonts. Mirrors lib/accent.ts: a renderer-only visual
// preference persisted to localStorage and applied as a CSS variable, with a
// pre-paint bootstrap script (FONTS_BOOTSTRAP_SCRIPT) to avoid a flash of the
// default face. Two independent knobs:
//   --font-ui        → drives the `font-sans` / `font-heading` Tailwind tokens
//   --font-mono-user → drives the `font-mono` token (transcript timestamps)
// The brand wordmark (--font-brand / "Cause") is intentionally NOT switchable.
//
// "Real" faces are bundled at build time via next/font/google (app/layout.tsx)
// and referenced by their private `var(--font-*)` so they work offline; the
// "system" presets are pure CSS stacks that cost nothing.

export type UiFontKey = "inter" | "geist" | "system" | "serif" | "hyperlegible";
export type MonoFontKey = "geist-mono" | "jetbrains" | "system-mono";

// `"custom"` is stored in place of a preset key when the user typed their own
// family name; the name itself lives in the matching `*Custom` storage key.
export type UiFontChoice = UiFontKey | "custom";
export type MonoFontChoice = MonoFontKey | "custom";

export interface FontDef<K extends string> {
  key: K;
  /** Literal display name — used for brand faces (Inter, Geist, …). */
  label: string;
  /** Translation key for generic labels (System / Serif); preferred over `label`. */
  i18nKey?: TranslationKey;
  /** CSS font-family value applied to the override variable when chosen. */
  stack: string;
}

// Fallback tails appended after the chosen face so text always renders.
const UI_SANS_FALLBACK =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO_FALLBACK =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const UI_FONTS: readonly FontDef<UiFontKey>[] = [
  { key: "inter", label: "Inter", stack: `var(--font-inter), ${UI_SANS_FALLBACK}` },
  { key: "geist", label: "Geist", stack: `var(--font-geist), ${UI_SANS_FALLBACK}` },
  {
    key: "system",
    label: "System",
    i18nKey: "settings.appearance.font.system",
    stack: UI_SANS_FALLBACK,
  },
  {
    key: "serif",
    label: "Serif",
    i18nKey: "settings.appearance.font.serif",
    stack: "var(--font-serif-face), ui-serif, Georgia, 'Times New Roman', serif",
  },
  {
    key: "hyperlegible",
    label: "Atkinson Hyperlegible",
    stack: `var(--font-hyperlegible), ${UI_SANS_FALLBACK}`,
  },
];

export const MONO_FONTS: readonly FontDef<MonoFontKey>[] = [
  {
    key: "geist-mono",
    label: "Geist Mono",
    stack: `var(--font-geist-mono), ${MONO_FALLBACK}`,
  },
  {
    key: "jetbrains",
    label: "JetBrains Mono",
    stack: `var(--font-jetbrains-mono), ${MONO_FALLBACK}`,
  },
  {
    key: "system-mono",
    label: "System",
    i18nKey: "settings.appearance.font.system",
    stack: MONO_FALLBACK,
  },
];

export const DEFAULT_UI_FONT: UiFontKey = "inter";
export const DEFAULT_MONO_FONT: MonoFontKey = "geist-mono";

export const UI_FONT_STORAGE_KEY = "scribe:uiFont";
export const UI_FONT_CUSTOM_STORAGE_KEY = "scribe:uiFontCustom";
export const MONO_FONT_STORAGE_KEY = "scribe:monoFont";
export const MONO_FONT_CUSTOM_STORAGE_KEY = "scribe:monoFontCustom";

const UI_FONT_VAR = "--font-ui";
const MONO_FONT_VAR = "--font-mono-user";

export function isUiFontChoice(value: unknown): value is UiFontChoice {
  return (
    value === "custom" ||
    (typeof value === "string" && UI_FONTS.some((f) => f.key === value))
  );
}

export function isMonoFontChoice(value: unknown): value is MonoFontChoice {
  return (
    value === "custom" ||
    (typeof value === "string" && MONO_FONTS.some((f) => f.key === value))
  );
}

// Strip characters that could break out of a CSS `font-family` value, then the
// caller wraps the result in quotes. Keeps a user-typed name safe to inject.
function cleanFamily(name: string): string {
  return name.replace(/["';{}<>]/g, "").trim();
}

function customStack(name: string, fallback: string): string {
  const t = cleanFamily(name);
  return t ? `"${t}", ${fallback}` : fallback;
}

export function resolveUiStack(choice: UiFontChoice, custom: string): string {
  if (choice === "custom") return customStack(custom, UI_SANS_FALLBACK);
  return UI_FONTS.find((f) => f.key === choice)?.stack ?? UI_FONTS[0].stack;
}

export function resolveMonoStack(
  choice: MonoFontChoice,
  custom: string,
): string {
  if (choice === "custom") return customStack(custom, MONO_FALLBACK);
  return MONO_FONTS.find((f) => f.key === choice)?.stack ?? MONO_FONTS[0].stack;
}

export function applyUiFont(choice: UiFontChoice, custom: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    UI_FONT_VAR,
    resolveUiStack(choice, custom),
  );
}

export function applyMonoFont(choice: MonoFontChoice, custom: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    MONO_FONT_VAR,
    resolveMonoStack(choice, custom),
  );
}

function readLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLs(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function loadUiFont(): UiFontChoice {
  const raw = readLs(UI_FONT_STORAGE_KEY);
  return isUiFontChoice(raw) ? raw : DEFAULT_UI_FONT;
}

export function loadMonoFont(): MonoFontChoice {
  const raw = readLs(MONO_FONT_STORAGE_KEY);
  return isMonoFontChoice(raw) ? raw : DEFAULT_MONO_FONT;
}

export function loadUiFontCustom(): string {
  return readLs(UI_FONT_CUSTOM_STORAGE_KEY) ?? "";
}

export function loadMonoFontCustom(): string {
  return readLs(MONO_FONT_CUSTOM_STORAGE_KEY) ?? "";
}

/** Inline script that applies the saved fonts before first paint — avoids a
 *  flash of Inter/Geist Mono when the user picked something else. Mirrors
 *  ACCENT_BOOTSTRAP_SCRIPT in lib/accent.ts. */
export const FONTS_BOOTSTRAP_SCRIPT = `
(function(){
  try {
    var d = document.documentElement;
    var uiMap = ${JSON.stringify(
      Object.fromEntries(UI_FONTS.map((f) => [f.key, f.stack])),
    )};
    var monoMap = ${JSON.stringify(
      Object.fromEntries(MONO_FONTS.map((f) => [f.key, f.stack])),
    )};
    var uiFb = ${JSON.stringify(UI_SANS_FALLBACK)};
    var monoFb = ${JSON.stringify(MONO_FALLBACK)};
    function clean(s){ return (s || "").replace(/["';{}<>]/g, "").trim(); }
    function custom(name, fb){ var t = clean(name); return t ? '"' + t + '", ' + fb : fb; }
    var uk = localStorage.getItem(${JSON.stringify(UI_FONT_STORAGE_KEY)});
    var uc = localStorage.getItem(${JSON.stringify(UI_FONT_CUSTOM_STORAGE_KEY)});
    d.style.setProperty('--font-ui', uk === 'custom' ? custom(uc, uiFb) : (uiMap[uk] || uiMap[${JSON.stringify(
      DEFAULT_UI_FONT,
    )}]));
    var mk = localStorage.getItem(${JSON.stringify(MONO_FONT_STORAGE_KEY)});
    var mc = localStorage.getItem(${JSON.stringify(MONO_FONT_CUSTOM_STORAGE_KEY)});
    d.style.setProperty('--font-mono-user', mk === 'custom' ? custom(mc, monoFb) : (monoMap[mk] || monoMap[${JSON.stringify(
      DEFAULT_MONO_FONT,
    )}]));
  } catch (e) {}
})();
`;

export function useFonts(): {
  uiFont: UiFontChoice;
  uiFontCustom: string;
  monoFont: MonoFontChoice;
  monoFontCustom: string;
  setUiFont: (choice: UiFontChoice) => void;
  setUiCustom: (name: string) => void;
  setMonoFont: (choice: MonoFontChoice) => void;
  setMonoCustom: (name: string) => void;
} {
  const [uiFont, setUiFontState] = useState<UiFontChoice>(DEFAULT_UI_FONT);
  const [uiFontCustom, setUiCustomState] = useState("");
  const [monoFont, setMonoFontState] = useState<MonoFontChoice>(
    DEFAULT_MONO_FONT,
  );
  const [monoFontCustom, setMonoCustomState] = useState("");

  // Hydrate React state from localStorage on mount. The bootstrap script
  // already pushed the saved stacks onto the document root before paint, so we
  // only sync state here (no re-apply needed) — same as useAccent.
  useEffect(() => {
    setUiFontState(loadUiFont());
    setUiCustomState(loadUiFontCustom());
    setMonoFontState(loadMonoFont());
    setMonoCustomState(loadMonoFontCustom());
  }, []);

  function setUiFont(choice: UiFontChoice) {
    setUiFontState(choice);
    writeLs(UI_FONT_STORAGE_KEY, choice);
    applyUiFont(choice, uiFontCustom);
  }

  function setUiCustom(name: string) {
    setUiCustomState(name);
    writeLs(UI_FONT_CUSTOM_STORAGE_KEY, name);
    if (uiFont === "custom") applyUiFont("custom", name);
  }

  function setMonoFont(choice: MonoFontChoice) {
    setMonoFontState(choice);
    writeLs(MONO_FONT_STORAGE_KEY, choice);
    applyMonoFont(choice, monoFontCustom);
  }

  function setMonoCustom(name: string) {
    setMonoCustomState(name);
    writeLs(MONO_FONT_CUSTOM_STORAGE_KEY, name);
    if (monoFont === "custom") applyMonoFont("custom", name);
  }

  return {
    uiFont,
    uiFontCustom,
    monoFont,
    monoFontCustom,
    setUiFont,
    setUiCustom,
    setMonoFont,
    setMonoCustom,
  };
}
