import type { DisplayLanguage } from "@/lib/scribe-global";

import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { es } from "./dictionaries/es";
import { de } from "./dictionaries/de";

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

export const DICTIONARIES: Record<DisplayLanguage, Dictionary> = {
  en,
  fr,
  es,
  de,
};
