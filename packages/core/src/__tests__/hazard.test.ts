import { describe, expect, it } from "vitest";
import {
  applyHazardDamage,
  createHazardRuntimeState,
  isInsideHazard,
  multiplyMovementModifiers,
  nextHazardTickAt,
  shouldRunHazardTick
} from "../hazard";
import type { HazardDef } from "../contracts/types";

describe("hazard", () => {
  const lava: HazardDef = {
    id: "lava_pool",
    type: "damage_zone",
    damagePerTick: 10,
    tickIntervalMs: 700,
    radiusTiles: 1.1,
    spriteKey: "telegraph_circle_red"
  };

  it("creates deterministic runtime timing state", () => {
    const runtime = createHazardRuntimeState(lava, "hz-1", { x: 5, y: 6 }, 1000);
    expect(runtime.nextTickAtMs).toBe(1700);
    expect(runtime.radiusTiles).toBe(1.1);
  });

  it("ticks only when interval reached", () => {
    expect(shouldRunHazardTick(1200, 1500)).toBe(false);
    expect(shouldRunHazardTick(1500, 1500)).toBe(true);
    expect(nextHazardTickAt(1500, 700)).toBe(2200);
  });

  it("resolves zone checks and movement modifiers", () => {
    expect(isInsideHazard({ x: 3, y: 3 }, { position: { x: 3.5, y: 3.2 }, radiusTiles: 1 })).toBe(true);
    expect(isInsideHazard({ x: 0, y: 0 }, { position: { x: 3.5, y: 3.2 }, radiusTiles: 1 })).toBe(false);
    expect(multiplyMovementModifiers([0.8, 0.7])).toBeCloseTo(0.56);
  });

  it("never drops health below zero", () => {
    expect(applyHazardDamage(25, 5)).toBe(20);
    expect(applyHazardDamage(4, 20)).toBe(0);
  });
});

