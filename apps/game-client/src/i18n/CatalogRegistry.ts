import type { LocaleCode, MessageCatalog } from "./types";

export class CatalogRegistry {
  private readonly catalogs = new Map<LocaleCode, Readonly<Record<string, string>>>();

  constructor(catalogs: readonly MessageCatalog[] = []) {
    for (const catalog of catalogs) {
      this.register(catalog);
    }
  }

  register(catalog: MessageCatalog): void {
    this.catalogs.set(catalog.locale, Object.freeze({ ...catalog.messages }));
  }

  getMessage(locale: LocaleCode, key: string): string | undefined {
    return this.catalogs.get(locale)?.[key];
  }

  hasMessage(locale: LocaleCode, key: string): boolean {
    return this.catalogs.get(locale)?.[key] !== undefined;
  }

  hasLocale(locale: LocaleCode): boolean {
    return this.catalogs.has(locale);
  }

  listLocales(): LocaleCode[] {
    return [...this.catalogs.keys()];
  }

  getCatalog(locale: LocaleCode): Readonly<Record<string, string>> {
    return this.catalogs.get(locale) ?? {};
  }
}
