import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EN_US_CATALOG } from "../catalog/en-US";
import { checkCatalogCompleteness, collectSourceI18nKeys } from "../catalogDiagnostics";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("i18n catalog completeness", () => {
  it("covers all referenced i18n keys and keeps catalog lean", () => {
    const sourceKeys = collectSourceI18nKeys(SRC_ROOT);
    const { missingKeys, unusedKeys } = checkCatalogCompleteness(sourceKeys, EN_US_CATALOG.messages, {
      ignoredUnusedPrefixes: ["content.", "ui.common."]
    });

    expect(missingKeys).toEqual([]);
    expect(unusedKeys).toEqual([]);
  });
});
