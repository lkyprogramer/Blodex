import { describe, expect, it } from "vitest";
import {
  resolveBiomeForFloor,
  resolveBiomeForFloorBySeed,
  resolveMidBiomeOrderByRoll,
  resolveMidBiomeOrderBySeed
} from "../biome";

describe("biome resolution", () => {
  it("resolves fixed floors for catacombs and bone throne", () => {
    expect(resolveBiomeForFloorBySeed(1, "seed-a")).toBe("forgotten_catacombs");
    expect(resolveBiomeForFloorBySeed(2, "seed-a")).toBe("forgotten_catacombs");
    expect(resolveBiomeForFloorBySeed(5, "seed-a")).toBe("bone_throne");
  });

  it("keeps floor 3/4 order stable for same seed", () => {
    const seed = "stable-seed";
    const floor3 = resolveBiomeForFloorBySeed(3, seed);
    const floor4 = resolveBiomeForFloorBySeed(4, seed);
    expect([floor3, floor4]).toEqual([resolveBiomeForFloorBySeed(3, seed), resolveBiomeForFloorBySeed(4, seed)]);
    expect(floor3).not.toBe(floor4);
  });

  it("produces at least two different mid-floor orders across seeds", () => {
    const orders = new Set(
      ["alpha", "beta", "gamma", "delta", "epsilon", "theta"]
        .map((seed) => resolveMidBiomeOrderBySeed(seed).join(">"))
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("maps floors with explicit mid order", () => {
    const order = resolveMidBiomeOrderByRoll(0.1);
    expect(resolveBiomeForFloor(3, order)).toBe(order[0]);
    expect(resolveBiomeForFloor(4, order)).toBe(order[1]);
  });
});

