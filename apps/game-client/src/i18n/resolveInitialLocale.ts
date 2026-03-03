import { LocalePreferenceStore } from "./LocalePreferenceStore";
import { SUPPORTED_LOCALES, type LocaleCode } from "./types";

const SUPPORTED_LOCALE_SET = new Set<LocaleCode>(SUPPORTED_LOCALES);

function normalizeLocaleCandidate(candidate: string): LocaleCode | null {
  if (SUPPORTED_LOCALE_SET.has(candidate as LocaleCode)) {
    return candidate as LocaleCode;
  }

  const lowered = candidate.toLowerCase();
  if (lowered.startsWith("zh")) {
    return "zh-CN";
  }
  if (lowered.startsWith("en")) {
    return "en-US";
  }

  return null;
}

export function resolveInitialLocale(input?: {
  preferenceStore?: LocalePreferenceStore;
  browserLocales?: readonly string[];
  defaultLocale?: LocaleCode;
}): LocaleCode {
  const defaultLocale = input?.defaultLocale ?? "en-US";
  const preferenceStore = input?.preferenceStore ?? new LocalePreferenceStore();

  const preferred = preferenceStore.getLocale();
  if (preferred !== null) {
    const normalizedPreferred = normalizeLocaleCandidate(preferred);
    if (normalizedPreferred !== null) {
      return normalizedPreferred;
    }
  }

  const browserLocales =
    input?.browserLocales ??
    (typeof navigator === "undefined"
      ? []
      : navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language]);

  for (const candidate of browserLocales) {
    const normalized = normalizeLocaleCandidate(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return defaultLocale;
}
