import type { LocaleCode } from "./types";

export const LOCALE_STORAGE_KEY = "blodex_locale_v1";

const LOCALE_CANDIDATE_REGEX = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export class LocalePreferenceStore {
  constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null =
      typeof window === "undefined" ? null : window.localStorage
  ) {}

  getLocale(): string | null {
    const raw = this.storage?.getItem(LOCALE_STORAGE_KEY);
    if (raw === undefined || raw === null) {
      return null;
    }
    if (!LOCALE_CANDIDATE_REGEX.test(raw)) {
      return null;
    }
    return raw;
  }

  setLocale(locale: LocaleCode): void {
    this.storage?.setItem(LOCALE_STORAGE_KEY, locale);
  }

  clear(): void {
    this.storage?.removeItem(LOCALE_STORAGE_KEY);
  }
}
