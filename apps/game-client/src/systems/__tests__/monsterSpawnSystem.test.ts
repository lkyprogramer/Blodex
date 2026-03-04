import type { DungeonLayout, RngLike } from "@blodex/core";
import { describe, expect, it } from "vitest";
import { MONSTER_ARCHETYPES } from "@blodex/content";
import { MonsterSpawnSystem } from "../MonsterSpawnSystem";

class DeterministicRng implements RngLike {
  next(): number {
    return 0;
  }

  nextInt(min: number, _max: number): number {
    return min;
  }

  pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return items[0]!;
  }
}

function makeDungeon(): DungeonLayout {
  const width = 20;
  const height = 20;
  return {
    width,
    height,
    walkable: Array.from({ length: height }, () => Array.from({ length: width }, () => true)),
    rooms: [],
    corridors: [],
    spawnPoints: [
      { x: 2, y: 2 },
      { x: 17, y: 17 }
    ],
    playerSpawn: { x: 10, y: 10 },
    layoutHash: "test-layout"
  };
}

describe("MonsterSpawnSystem", () => {
  it("skips blocked positions when generating monster points", () => {
    const spawnSystem = new MonsterSpawnSystem();
    const monsters = spawnSystem.createMonsters({
      dungeon: makeDungeon(),
      playerPosition: { x: 10, y: 10 },
      floor: 3,
      count: 1,
      enemyBaseHealth: 100,
      enemyBaseDamage: 20,
      archetypes: MONSTER_ARCHETYPES,
      blockedPositions: [{ x: 1, y: 1 }],
      rng: new DeterministicRng()
    });

    expect(monsters).toHaveLength(1);
    expect(monsters[0]?.state.position).not.toEqual({ x: 1, y: 1 });
  });

  it("falls back to full archetype list when biome pool is empty or invalid", () => {
    const spawnSystem = new MonsterSpawnSystem();
    const monsters = spawnSystem.createMonsters({
      dungeon: makeDungeon(),
      playerPosition: { x: 10, y: 10 },
      floor: 4,
      count: 1,
      enemyBaseHealth: 100,
      enemyBaseDamage: 20,
      archetypes: MONSTER_ARCHETYPES,
      biomeMonsterPool: ["missing_archetype"],
      rng: new DeterministicRng()
    });

    expect(monsters).toHaveLength(1);
    expect(monsters[0]?.archetype.id).toBe(MONSTER_ARCHETYPES[0]?.id);
  });

  it("does not spawn standard monsters on boss floor when count is one", () => {
    const spawnSystem = new MonsterSpawnSystem();
    const monsters = spawnSystem.createMonsters({
      dungeon: makeDungeon(),
      playerPosition: { x: 10, y: 10 },
      floor: 5,
      floorConfig: {
        floorNumber: 5,
        monsterHpMultiplier: 1,
        monsterDmgMultiplier: 1,
        monsterCount: 1,
        clearThreshold: 1,
        isBossFloor: true
      },
      enemyBaseHealth: 100,
      enemyBaseDamage: 20,
      archetypes: MONSTER_ARCHETYPES,
      rng: new DeterministicRng()
    });

    expect(monsters).toEqual([]);
  });
});
