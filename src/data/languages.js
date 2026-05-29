// @ts-check

/** @type {LanguageEntry[]} */
export var LANGUAGES = [
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

export var DEFAULT_LANGUAGE = "en";

/**
 * @param {string} code
 * @returns {string}
 */
export var languageNameFor = (code) => (LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]).name;
