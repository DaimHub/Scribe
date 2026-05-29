"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useScribe } from "@/lib/store";
import type { DisplayLanguage } from "@/lib/scribe-global";
import {
  DICTIONARIES,
  type Dictionary,
  type TranslationKey,
} from "@/lib/i18n/dictionaries";

export type TranslateFn = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

interface I18nContextValue {
  language: DisplayLanguage;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name];
    return v == null ? `{${name}}` : String(v);
  });
}

function makeTranslator(dict: Dictionary, fallback: Dictionary): TranslateFn {
  return (key, vars) => {
    const raw = dict[key] ?? fallback[key] ?? key;
    return interpolate(raw, vars);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useScribe((s) => s.displayLanguage);
  // Keep the document language in sync so the static <html lang="en"> from the
  // exported layout follows the user's chosen display language at runtime.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[language];
    return { language, t: makeTranslator(dict, DICTIONARIES.en) };
  }, [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): TranslateFn {
  const ctx = useContext(I18nContext);
  // Fallback for use outside the provider (e.g. unit tests, mini windows
  // before the provider mounts) — returns the English string for the key.
  // Built unconditionally so the hook order stays stable across renders.
  const fallback = useCallback<TranslateFn>(
    (key, vars) => interpolate(DICTIONARIES.en[key] ?? key, vars),
    [],
  );
  return ctx?.t ?? fallback;
}

export function useLanguage(): DisplayLanguage {
  const ctx = useContext(I18nContext);
  return ctx?.language ?? "en";
}
