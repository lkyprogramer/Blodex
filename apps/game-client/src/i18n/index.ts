import { CatalogRegistry } from "./CatalogRegistry";
import { DefaultI18nService } from "./I18nService";
import { LocalePreferenceStore } from "./LocalePreferenceStore";
import { EN_US_CATALOG } from "./catalog/en-US";
import { ZH_CN_CATALOG } from "./catalog/zh-CN";
import { ContentLocalizer } from "./content/ContentLocalizer";
import { resolveInitialLocale } from "./resolveInitialLocale";
import type { I18nService, LocaleCode, MessageParams } from "./types";

const catalogRegistry = new CatalogRegistry([EN_US_CATALOG, ZH_CN_CATALOG]);
const i18nService = new DefaultI18nService(catalogRegistry, {
  defaultLocale: "en-US",
  fallbackLocale: "en-US"
});
const localePreferenceStore = new LocalePreferenceStore();
const contentLocalizer = new ContentLocalizer(i18nService);

let initialized = false;

export function initializeI18n(): void {
  if (initialized) {
    return;
  }
  const locale = resolveInitialLocale({
    preferenceStore: localePreferenceStore,
    defaultLocale: "en-US"
  });
  i18nService.setLocale(locale);
  initialized = true;
}

export function t(key: string, params?: MessageParams): string {
  return i18nService.t(key, params);
}

export function setLocale(locale: LocaleCode): void {
  i18nService.setLocale(locale);
  localePreferenceStore.setLocale(locale);
}

export function getLocale(): LocaleCode {
  return i18nService.getLocale();
}

export function getI18nService(): I18nService {
  return i18nService;
}

export function getContentLocalizer(): ContentLocalizer {
  return contentLocalizer;
}

export function resetI18nDiagnostics(): void {
  i18nService.resetDiagnostics();
}
