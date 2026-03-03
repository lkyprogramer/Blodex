import { CatalogRegistry } from "./CatalogRegistry";
import type {
  I18nDiagnosticsSnapshot,
  I18nService,
  LocaleCode,
  MessageParams
} from "./types";

const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;
const MAX_DIAGNOSTICS = 200;

function compactDiagnostics<T>(entries: T[]): T[] {
  if (entries.length <= MAX_DIAGNOSTICS) {
    return entries;
  }
  return entries.slice(entries.length - MAX_DIAGNOSTICS);
}

export class DefaultI18nService implements I18nService {
  private locale: LocaleCode;
  private readonly fallbackLocale: LocaleCode;
  private diagnostics: I18nDiagnosticsSnapshot = {
    missingKeys: [],
    missingParams: []
  };

  constructor(
    private readonly registry: CatalogRegistry,
    options?: {
      defaultLocale?: LocaleCode;
      fallbackLocale?: LocaleCode;
    }
  ) {
    this.fallbackLocale = options?.fallbackLocale ?? "en-US";
    const requestedDefault = options?.defaultLocale ?? this.fallbackLocale;
    this.locale = this.registry.hasLocale(requestedDefault)
      ? requestedDefault
      : this.fallbackLocale;
  }

  getLocale(): LocaleCode {
    return this.locale;
  }

  setLocale(locale: LocaleCode): void {
    this.locale = this.registry.hasLocale(locale) ? locale : this.fallbackLocale;
  }

  getFallbackLocale(): LocaleCode {
    return this.fallbackLocale;
  }

  t(key: string, params?: MessageParams): string {
    const messageTemplate = this.resolveTemplate(key);
    if (messageTemplate === undefined) {
      this.diagnostics = {
        ...this.diagnostics,
        missingKeys: compactDiagnostics([
          ...this.diagnostics.missingKeys,
          {
            key,
            locale: this.locale,
            fallbackLocale: this.fallbackLocale,
            timestampMs: Date.now()
          }
        ])
      };
      return key;
    }

    return messageTemplate.replace(PLACEHOLDER_PATTERN, (_match, placeholderRaw: string) => {
      const placeholder = placeholderRaw.trim();
      const value = params?.[placeholder];
      if (value === undefined || value === null) {
        this.diagnostics = {
          ...this.diagnostics,
          missingParams: compactDiagnostics([
            ...this.diagnostics.missingParams,
            {
              key,
              placeholder,
              locale: this.locale,
              timestampMs: Date.now()
            }
          ])
        };
        return `{${placeholder}}`;
      }
      return String(value);
    });
  }

  hasKey(key: string, locale = this.locale): boolean {
    if (this.registry.hasMessage(locale, key)) {
      return true;
    }
    return this.registry.hasMessage(this.fallbackLocale, key);
  }

  getAvailableLocales(): LocaleCode[] {
    return this.registry.listLocales();
  }

  getDiagnostics(): I18nDiagnosticsSnapshot {
    return {
      missingKeys: [...this.diagnostics.missingKeys],
      missingParams: [...this.diagnostics.missingParams]
    };
  }

  resetDiagnostics(): void {
    this.diagnostics = {
      missingKeys: [],
      missingParams: []
    };
  }

  private resolveTemplate(key: string): string | undefined {
    const currentLocaleMessage = this.registry.getMessage(this.locale, key);
    if (currentLocaleMessage !== undefined) {
      return currentLocaleMessage;
    }
    return this.registry.getMessage(this.fallbackLocale, key);
  }
}
