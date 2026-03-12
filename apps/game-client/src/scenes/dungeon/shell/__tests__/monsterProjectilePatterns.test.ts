import { describe, expect, it } from "vitest";
import { buildMonsterProjectileSpawns } from "../monsterProjectilePatterns";

describe("buildMonsterProjectileSpawns", () => {
  it("builds a single straight projectile by default", () => {
    const spawns = buildMonsterProjectileSpawns({
      monster: { position: { x: 0, y: 0 } },
      archetype: {},
      playerPosition: { x: 4, y: 0 },
      defaultSpeedTilesPerSecond: 7.2,
      defaultHitRadiusTiles: 0.65
    });

    expect(spawns).toEqual([
      {
        targetPosition: { x: 4, y: 0 },
        speedTilesPerSecond: 7.2,
        hitRadiusTiles: 0.65,
        width: undefined,
        height: undefined
      }
    ]);
  });

  it("fans out spread projectiles around the aimed direction", () => {
    const spawns = buildMonsterProjectileSpawns({
      monster: { position: { x: 0, y: 0 } },
      archetype: {
        projectilePattern: {
          family: "spread",
          spreadCount: 3,
          spreadAngleDeg: 12
        }
      },
      playerPosition: { x: 4, y: 0 },
      defaultSpeedTilesPerSecond: 7.2,
      defaultHitRadiusTiles: 0.65
    });

    expect(spawns).toHaveLength(3);
    expect(spawns[1]?.targetPosition.x).toBeCloseTo(4, 3);
    expect(spawns[0]!.targetPosition.y).toBeLessThan(0);
    expect(spawns[2]!.targetPosition.y).toBeGreaterThan(0);
  });

  it("pushes lob impacts slightly beyond the player's current position", () => {
    const spawns = buildMonsterProjectileSpawns({
      monster: { position: { x: 0, y: 0 } },
      archetype: {
        projectilePattern: {
          family: "lob",
          targetOffsetTiles: 1,
          hitRadiusTiles: 1.1
        }
      },
      playerPosition: { x: 3, y: 4 },
      defaultSpeedTilesPerSecond: 7.2,
      defaultHitRadiusTiles: 0.65
    });

    expect(spawns).toHaveLength(1);
    expect(spawns[0]?.targetPosition.x).toBeGreaterThan(3);
    expect(spawns[0]?.targetPosition.y).toBeGreaterThan(4);
    expect(spawns[0]?.hitRadiusTiles).toBe(1.1);
  });
});
