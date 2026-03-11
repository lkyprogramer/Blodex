import { describe, expect, it } from "vitest";
import { ProjectileRuntime } from "../ProjectileRuntime";

function createRuntime() {
  type TestSprite = {
    active: boolean;
    x: number;
    y: number;
    depth: number;
    setPosition(x: number, y: number): TestSprite;
    setDepth(value: number): TestSprite;
    destroy(): void;
  };
  const sprites: TestSprite[] = [];

  const runtime = new ProjectileRuntime(() => ({
    origin: { x: 0, y: 0 },
    renderSystem: {
      spawnProjectile: () => {
        const sprite = {
          active: true,
          x: 0,
          y: 0,
          depth: 0,
          setPosition(x: number, y: number) {
            this.x = x;
            this.y = y;
            return this;
          },
          setDepth(value: number) {
            this.depth = value;
            return this;
          },
          destroy() {
            this.active = false;
          }
        };
        sprites.push(sprite);
        return sprite;
      },
      syncProjectileSprite: (sprite, position) => {
        sprite.setPosition(position.x, position.y);
        sprite.setDepth(position.y);
      }
    }
  }));

  return {
    runtime,
    sprites
  };
}

describe("ProjectileRuntime", () => {
  it("keeps projectile in flight until travel time completes", () => {
    const { runtime } = createRuntime();
    runtime.spawn({
      floor: 2,
      sourceId: "monster-a",
      targetId: "player",
      sourcePosition: { x: 0, y: 0 },
      targetPosition: { x: 5, y: 0 },
      speedTilesPerSecond: 5,
      hitRadiusTiles: 0.6
    });

    const misses = runtime.update({
      deltaSeconds: 0.5,
      nowMs: 500,
      floor: 2,
      playerPosition: { x: 5, y: 0 }
    });

    expect(misses).toEqual([]);
    expect(runtime.getActiveCount()).toBe(1);
    expect(runtime.drainCompletedImpacts()).toEqual([]);
  });

  it("records a hit candidate when the player remains near the fired target position", () => {
    const { runtime } = createRuntime();
    runtime.spawn({
      floor: 2,
      sourceId: "monster-a",
      targetId: "player",
      sourcePosition: { x: 0, y: 0 },
      targetPosition: { x: 4, y: 0 },
      speedTilesPerSecond: 8,
      hitRadiusTiles: 0.65
    });

    runtime.update({
      deltaSeconds: 0.6,
      nowMs: 600,
      floor: 2,
      playerPosition: { x: 4.2, y: 0.1 }
    });

    expect(runtime.getActiveCount()).toBe(0);
    expect(runtime.drainCompletedImpacts()).toEqual([
      expect.objectContaining({
        sourceId: "monster-a",
        targetId: "player",
        withinHitRadius: true
      })
    ]);
  });

  it("records a miss candidate when the player has moved out of the impact radius", () => {
    const { runtime } = createRuntime();
    runtime.spawn({
      floor: 3,
      sourceId: "monster-b",
      targetId: "player",
      sourcePosition: { x: 1, y: 1 },
      targetPosition: { x: 4, y: 1 },
      speedTilesPerSecond: 6,
      hitRadiusTiles: 0.5
    });

    runtime.update({
      deltaSeconds: 0.6,
      nowMs: 600,
      floor: 3,
      playerPosition: { x: 5.2, y: 1.8 }
    });

    expect(runtime.drainCompletedImpacts()).toEqual([
      expect.objectContaining({
        sourceId: "monster-b",
        withinHitRadius: false
      })
    ]);
  });

  it("clears in-flight projectiles when the floor changes", () => {
    const { runtime } = createRuntime();
    const projectileId = runtime.spawn({
      floor: 4,
      sourceId: "monster-c",
      targetId: "player",
      sourcePosition: { x: 0, y: 0 },
      targetPosition: { x: 6, y: 0 },
      speedTilesPerSecond: 4,
      hitRadiusTiles: 0.5
    });

    const misses = runtime.update({
      deltaSeconds: 0.1,
      nowMs: 100,
      floor: 5,
      playerPosition: { x: 0, y: 0 }
    });

    expect(runtime.getActiveCount()).toBe(0);
    expect(runtime.drainCompletedImpacts()).toEqual([]);
    expect(misses).toEqual([
      expect.objectContaining({
        projectileId,
        reason: "floor_reset"
      })
    ]);
  });
});
