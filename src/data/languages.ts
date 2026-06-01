import type { LanguageEntry } from "../types";

export const LANGUAGES: LanguageEntry[] = [
  { code: "en", label: "English", name: "English" },
  { code: "es", label: "Español", name: "Spanish" },
  { code: "fr", label: "Français", name: "French" },
  { code: "de", label: "Deutsch", name: "German" },
  { code: "it", label: "Italiano", name: "Italian" },
  { code: "pt", label: "Português", name: "Portuguese" },
  { code: "nl", label: "Nederlands", name: "Dutch" },
  { code: "pl", label: "Polski", name: "Polish" },
  { code: "ru", label: "Русский", name: "Russian" },
  { code: "ja", label: "日本語", name: "Japanese" },
  { code: "zh", label: "中文", name: "Simplified Chinese" },
  { code: "ko", label: "한국어", name: "Korean" }
];

export const DEFAULT_LANGUAGE = "en";

export const languageNameFor = (code: string): string =>
  (LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]).name;
