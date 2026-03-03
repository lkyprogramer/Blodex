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

export function normalizeLocale(input: string | null | undefined): LocaleCode | null {
  if (input === null || input === undefined) {
    return null;
  }
  return normalizeLocaleCandidate(input);
}

export function resolveInitialLocale(input?: {
  preferredLocale?: string | null;
  preferenceStore?: LocalePreferenceStore;
  browserLocales?: readonly string[];
  defaultLocale?: LocaleCode;
}): LocaleCode {
  const defaultLocale = input?.defaultLocale ?? "en-US";
  const preferenceStore = input?.preferenceStore ?? new LocalePreferenceStore();

  const preferredLocale = normalizeLocale(input?.preferredLocale);
  if (preferredLocale !== null) {
    return preferredLocale;
  }

  const storedLocale = normalizeLocale(preferenceStore.getLocale());
  if (storedLocale !== null) {
    return storedLocale;
  }

  const browserLocales =
    input?.browserLocales ??
    (typeof navigator === "undefined"
      ? []
      : navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language]);

  for (const candidate of browserLocales) {
    const normalized = normalizeLocale(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return normalizeLocale(defaultLocale) ?? "en-US";
}
