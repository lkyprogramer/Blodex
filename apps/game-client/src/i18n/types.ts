export const SUPPORTED_LOCALES = ["en-US", "zh-CN"] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export type MessagePrimitive = string | number | boolean | null | undefined;

export type MessageParams = Readonly<Record<string, MessagePrimitive>>;

export interface MessageCatalog {
  locale: LocaleCode;
  messages: Readonly<Record<string, string>>;
}

export interface I18nDiagnosticsSnapshot {
  missingKeys: Array<{
    key: string;
    locale: LocaleCode;
    fallbackLocale: LocaleCode;
    timestampMs: number;
  }>;
  missingParams: Array<{
    key: string;
    placeholder: string;
    locale: LocaleCode;
    timestampMs: number;
  }>;
}

export interface I18nService {
  getLocale(): LocaleCode;
  setLocale(locale: LocaleCode): void;
  getFallbackLocale(): LocaleCode;
  t(key: string, params?: MessageParams): string;
  hasKey(key: string, locale?: LocaleCode): boolean;
  getAvailableLocales(): LocaleCode[];
  getDiagnostics(): I18nDiagnosticsSnapshot;
  resetDiagnostics(): void;
}
