import { describe, expect, it } from "vitest";
import { createStaircaseState, findStaircasePosition, shouldRevealStaircase } from "../floor";
import type { DungeonLayout, FloorConfig } from "../contracts/types";

const floorConfig: FloorConfig = {
  floorNumber: 2,
  monsterHpMultiplier: 1.25,
  monsterDmgMultiplier: 1.15,
  monsterCount: 14,
  clearThreshold: 0.7,
  isBossFloor: false
};

function makeLayout(): DungeonLayout {
  return {
    width: 20,
    height: 20,
    walkable: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true)),
    rooms: [
      { id: "r1", x: 2, y: 2, width: 4, height: 4 },
      { id: "r2", x: 10, y: 10, width: 6, height: 6 },
      { id: "r3", x: 14, y: 3, width: 4, height: 4 }
    ],
    corridors: [],
    spawnPoints: [{ x: 12, y: 12 }],
    playerSpawn: { x: 3, y: 3 },
    layoutHash: "layout-1"
  };
}

describe("floor", () => {
  it("reveals staircase at 70% threshold", () => {
    expect(shouldRevealStaircase(9, floorConfig)).toBe(false);
    expect(shouldRevealStaircase(10, floorConfig)).toBe(true);
  });

  it("chooses farthest room center for staircase", () => {
    const layout = makeLayout();
    const point = findStaircasePosition(layout, layout.playerSpawn);
    expect(point).toEqual({ x: 13, y: 13 });
  });

  it("creates hidden staircase state by default", () => {
    const state = createStaircaseState(makeLayout());
    expect(state.visible).toBe(false);
  });
});
