import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "../CatalogRegistry";
import { DefaultI18nService } from "../I18nService";
import { EN_US_CATALOG } from "../catalog/en-US";
import { ZH_CN_CATALOG } from "../catalog/zh-CN";
import type { MessageCatalog } from "../types";

describe("i18n fallback behavior", () => {
  it("falls back to en-US when target locale key is missing", () => {
    const partialZhCatalog: MessageCatalog = {
      locale: "zh-CN",
      messages: {
        "ui.summary.title.victory": "通关结算"
      }
    };
    const service = new DefaultI18nService(new CatalogRegistry([EN_US_CATALOG, partialZhCatalog]), {
      defaultLocale: "en-US",
      fallbackLocale: "en-US"
    });

    service.setLocale("zh-CN");

    expect(service.t("ui.summary.continue")).toBe(EN_US_CATALOG.messages["ui.summary.continue"]);
  });

  it("uses zh-CN translation when key exists in target locale", () => {
    const service = new DefaultI18nService(new CatalogRegistry([EN_US_CATALOG, ZH_CN_CATALOG]), {
      defaultLocale: "en-US",
      fallbackLocale: "en-US"
    });

    service.setLocale("zh-CN");

    expect(service.t("ui.summary.continue")).toBe("返回菜单");
  });

  it("returns key literal and records diagnostics when key is absent", () => {
    const service = new DefaultI18nService(new CatalogRegistry([EN_US_CATALOG, ZH_CN_CATALOG]), {
      defaultLocale: "en-US",
      fallbackLocale: "en-US"
    });

    const resolved = service.t("ui.missing.sample");
    const diagnostics = service.getDiagnostics();

    expect(resolved).toBe("ui.missing.sample");
    expect(diagnostics.missingKeys).toHaveLength(1);
    expect(diagnostics.missingKeys[0]?.key).toBe("ui.missing.sample");
  });
});
