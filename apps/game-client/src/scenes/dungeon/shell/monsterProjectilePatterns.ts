import type { MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";

export interface MonsterProjectileSpawn {
  targetPosition: { x: number; y: number };
  speedTilesPerSecond: number;
  hitRadiusTiles: number;
  width?: number;
  height?: number;
}

function normalizeDirection(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const length = Math.max(0.001, Math.hypot(to.x - from.x, to.y - from.y));
  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length
  };
}

function rotate(direction: { x: number; y: number }, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: direction.x * cos - direction.y * sin,
    y: direction.x * sin + direction.y * cos
  };
}

export function buildMonsterProjectileSpawns(args: {
  monster: Pick<MonsterState, "position">;
  archetype: Pick<MonsterArchetypeDef, "projectilePattern">;
  playerPosition: { x: number; y: number };
  defaultSpeedTilesPerSecond: number;
  defaultHitRadiusTiles: number;
}): MonsterProjectileSpawn[] {
  const pattern = args.archetype.projectilePattern;
  const direction = normalizeDirection(args.monster.position, args.playerPosition);
  const distance = Math.max(1, Math.hypot(args.playerPosition.x - args.monster.position.x, args.playerPosition.y - args.monster.position.y));
  const family = pattern?.family ?? "straight";
  const baseSpeed = pattern?.speedTilesPerSecond ?? args.defaultSpeedTilesPerSecond;
  const baseHitRadius = pattern?.hitRadiusTiles ?? args.defaultHitRadiusTiles;

  if (family === "spread") {
    const spreadCount = Math.max(3, pattern?.spreadCount ?? 3);
    const angleStep = ((pattern?.spreadAngleDeg ?? 18) * Math.PI) / 180;
    const middleIndex = (spreadCount - 1) / 2;
    return Array.from({ length: spreadCount }, (_, index) => {
      const angleOffset = (index - middleIndex) * angleStep;
      const rotated = rotate(direction, angleOffset);
      return {
        targetPosition: {
          x: args.monster.position.x + rotated.x * distance,
          y: args.monster.position.y + rotated.y * distance
        },
        speedTilesPerSecond: baseSpeed,
        hitRadiusTiles: baseHitRadius,
        width: pattern?.width ?? 9,
        height: pattern?.height ?? 7
      };
    });
  }

  if (family === "lob") {
    const offset = pattern?.targetOffsetTiles ?? 0.75;
    return [
      {
        targetPosition: {
          x: args.playerPosition.x + direction.x * offset,
          y: args.playerPosition.y + direction.y * offset
        },
        speedTilesPerSecond: baseSpeed,
        hitRadiusTiles: baseHitRadius,
        width: pattern?.width ?? 16,
        height: pattern?.height ?? 12
      }
    ];
  }

  return [
    {
      targetPosition: { ...args.playerPosition },
      speedTilesPerSecond: baseSpeed,
      hitRadiusTiles: baseHitRadius,
      ...(pattern?.width === undefined ? {} : { width: pattern.width }),
      ...(pattern?.height === undefined ? {} : { height: pattern.height })
    }
  ];
}
