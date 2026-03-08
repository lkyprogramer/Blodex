import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_TRADEOFF_CALIBRATION_ASSET,
  calculateItemPowerScore,
  getItemTradeoffCalibrationAsset
} from "../index";

describe("itemTradeoffCalibration", () => {
  it("exposes an explicit calibration asset with artifact path and sample scenarios", () => {
    const asset = getItemTradeoffCalibrationAsset();

    expect(asset.id).toBe("phase7-7.2-item-tradeoff-v1");
    expect(asset.baselineArtifactPath).toContain("phase7-7.2-item-tradeoff-calibration.md");
    expect(asset.sampleScenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "weapon-major-upgrade", expectedDecision: "prompt" }),
        expect.objectContaining({ id: "low-value-merchant-sidegrade", expectedDecision: "skip" })
      ])
    );
    expect(asset.merchantCompareThresholds).toEqual({
      minPowerDelta: 10,
      minPositiveSummaryCount: 2
    });
  });

  it("keeps scoring stable when callers use the default asset explicitly", () => {
    const item = {
      id: "legacy-ring",
      defId: "legacy-ring",
      name: "Legacy Ring",
      slot: "ring",
      rarity: "rare",
      requiredLevel: 1,
      iconId: "item_ring_01",
      seed: "legacy",
      rolledAffixes: {
        critChance: 2
      },
      rolledSpecialAffixes: {}
    } as const;

    expect(calculateItemPowerScore(item)).toBeCloseTo(3.2);
    expect(calculateItemPowerScore(item, DEFAULT_ITEM_TRADEOFF_CALIBRATION_ASSET)).toBeCloseTo(3.2);
  });
});
