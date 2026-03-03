import { describe, expect, it } from "vitest";
import { EN_US_CATALOG } from "../catalog/en-US";
import { ZH_CN_CATALOG } from "../catalog/zh-CN";
import { checkPlaceholderConsistency } from "../catalogDiagnostics";

describe("i18n placeholder consistency", () => {
  it("keeps placeholder sets aligned for translated keys", () => {
    const issues = checkPlaceholderConsistency(
      EN_US_CATALOG.messages,
      ZH_CN_CATALOG.messages,
      ZH_CN_CATALOG.locale
    );

    expect(issues).toEqual([]);
  });
});
