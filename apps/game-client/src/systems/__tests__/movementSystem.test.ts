import { describe, expect, it } from "vitest";
import { MovementSystem } from "../MovementSystem";

function makeWalkable(width: number, height: number, value = true): boolean[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => value));
}

describe("MovementSystem", () => {
  it("clamps blocked target to nearest walkable tile", () => {
    const movement = new MovementSystem();
    const walkable = makeWalkable(6, 6, true);
    walkable[3]![3] = false;

    const target = movement.clampToWalkable(
      walkable,
      { width: 6, height: 6 },
      { x: 0, y: 0 },
      { x: 3, y: 3 }
    );

    expect(walkable[target.y]?.[target.x]).toBe(true);
    expect(Math.hypot(target.x - 3, target.y - 3)).toBeLessThanOrEqual(1.5);
  });

  it("searches wider rings when local 2-tile neighborhood is fully blocked", () => {
    const movement = new MovementSystem();
    const walkable = makeWalkable(10, 10, false);
    walkable[9]![9] = true;
    const target = movement.clampToWalkable(
      walkable,
      { width: 10, height: 10 },
      { x: 0, y: 0 },
      { x: 4, y: 4 }
    );

    expect(target).toEqual({ x: 9, y: 9 });
  });

  it("falls back to nearest player-side walkable tile when target zone has none", () => {
    const movement = new MovementSystem();
    const walkable = makeWalkable(12, 12, false);
    walkable[1]![1] = true;
    const target = movement.clampToWalkable(
      walkable,
      { width: 12, height: 12 },
      { x: 1.2, y: 1.1 },
      { x: 11, y: 11 }
    );

    expect(target).toEqual({ x: 1, y: 1 });
  });

  it("uses cached path within ttl and recomputes after ttl expiry", () => {
    const movement = new MovementSystem();
    const walkable = makeWalkable(3, 3, true);

    const first = movement.computePathTo(
      walkable,
      { width: 3, height: 3 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { cacheScope: "test", nowMs: 100 }
    );

    walkable[0]![1] = false;
    walkable[1]![0] = false;
    walkable[1]![1] = false;

    const cached = movement.computePathTo(
      walkable,
      { width: 3, height: 3 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { cacheScope: "test", nowMs: 200 }
    );
    const recomputed = movement.computePathTo(
      walkable,
      { width: 3, height: 3 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { cacheScope: "test", nowMs: 900 }
    );

    expect(cached).toEqual(first);
    expect(recomputed).toEqual([]);
  });

  it("snaps to node and consumes the path when distance is tiny", () => {
    const movement = new MovementSystem();
    const result = movement.updatePlayerMovement(
      {
        id: "player",
        position: { x: 0, y: 0 },
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        health: 100,
        mana: 100,
        baseStats: {
          strength: 10,
          dexterity: 10,
          intelligence: 10,
          vitality: 10
        },
        derivedStats: {
          maxHealth: 100,
          maxMana: 100,
          attackPower: 10,
          armor: 5,
          critChance: 0,
          attackSpeed: 1,
          moveSpeed: 130
        },
        inventory: [],
        equipment: {},
        gold: 0,
        skills: {
          skillSlots: [],
          cooldowns: {}
        },
        activeBuffs: []
      },
      [{ x: 0.01, y: 0.01 }],
      1
    );

    expect(result.moved).toBe(true);
    expect(result.path).toEqual([]);
    expect(result.player.position).toEqual({ x: 0.01, y: 0.01 });
  });
});
