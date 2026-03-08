import { describe, expect, it } from "vitest";
import { getItemTradeoffCalibrationAsset } from "@blodex/core";
import { ITEM_DEF_MAP } from "@blodex/content";

describe("item tradeoff calibration integrity", () => {
  it("uses representative sample items that exist in the content registry", () => {
    const asset = getItemTradeoffCalibrationAsset();

    for (const sample of asset.sampleScenarios) {
      expect(ITEM_DEF_MAP[sample.candidateDefId]).toBeDefined();
      if (sample.compareDefId !== undefined) {
        expect(ITEM_DEF_MAP[sample.compareDefId]).toBeDefined();
      }
    }
  });
});
