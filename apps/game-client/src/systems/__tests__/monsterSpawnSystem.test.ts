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

  it("honors floor-configured spawn distance and spacing tuning", () => {
    const spawnSystem = new MonsterSpawnSystem();
    const monsters = spawnSystem.createMonsters({
      dungeon: makeDungeon(),
      playerPosition: { x: 10, y: 10 },
      floor: 4,
      floorConfig: {
        floorNumber: 4,
        monsterHpMultiplier: 1,
        monsterDmgMultiplier: 1,
        monsterCount: 2,
        clearThreshold: 0.7,
        isBossFloor: false,
        spawnMinDistance: 4,
        spawnMaxDistance: 12,
        spawnMinSpacing: 4,
        spawnPackChance: 0,
        spawnPackRadius: 4
      },
      enemyBaseHealth: 100,
      enemyBaseDamage: 20,
      archetypes: MONSTER_ARCHETYPES,
      rng: new DeterministicRng()
    });

    expect(monsters).toHaveLength(2);
    for (const monster of monsters) {
      const distance = Math.hypot(monster.state.position.x - 10, monster.state.position.y - 10);
      expect(distance).toBeGreaterThanOrEqual(4);
      expect(distance).toBeLessThanOrEqual(12);
    }
    expect(
      Math.hypot(
        monsters[0]!.state.position.x - monsters[1]!.state.position.x,
        monsters[0]!.state.position.y - monsters[1]!.state.position.y
      )
    ).toBeGreaterThanOrEqual(4);
  });

  it("keeps fallback spawn points inside the configured distance band", () => {
    const spawnSystem = new MonsterSpawnSystem();
    const width = 12;
    const height = 12;
    const dungeon: DungeonLayout = {
      width,
      height,
      walkable: Array.from({ length: height }, () => Array.from({ length: width }, () => false)),
      rooms: [],
      corridors: [],
      spawnPoints: [
        { x: 5, y: 5 },
        { x: 1, y: 1 },
        { x: 10, y: 10 }
      ],
      playerSpawn: { x: 5, y: 6 },
      layoutHash: "fallback-distance"
    };
    dungeon.walkable[1]![1] = true;
    dungeon.walkable[10]![10] = true;

    const monsters = spawnSystem.createMonsters({
      dungeon,
      playerPosition: { x: 5, y: 6 },
      floor: 4,
      floorConfig: {
        floorNumber: 4,
        monsterHpMultiplier: 1,
        monsterDmgMultiplier: 1,
        monsterCount: 2,
        clearThreshold: 0.7,
        isBossFloor: false,
        spawnMinDistance: 4,
        spawnMaxDistance: 8,
        spawnMinSpacing: 1,
        spawnPackChance: 0,
        spawnPackRadius: 2
      },
      enemyBaseHealth: 100,
      enemyBaseDamage: 20,
      archetypes: MONSTER_ARCHETYPES,
      rng: new DeterministicRng()
    });

    expect(monsters).toHaveLength(2);
    expect(monsters.map((monster) => monster.state.position)).toEqual(
      expect.arrayContaining([
        { x: 1, y: 1 },
        { x: 10, y: 10 }
      ])
    );
    expect(monsters.map((monster) => monster.state.position)).not.toEqual(
      expect.arrayContaining([{ x: 5, y: 5 }])
    );
  });

  it("biases spawn selection toward ranged archetypes in crossfire template rooms", () => {
    const spawnSystem = new MonsterSpawnSystem();
    const dungeon: DungeonLayout = {
      ...makeDungeon(),
      rooms: [
        {
          id: "room-crossfire",
          x: 15,
          y: 15,
          width: 4,
          height: 4,
          templateId: "grand_hall",
          encounterTag: "crossfire",
          authoredSpawnPoints: [{ x: 17, y: 17 }]
        }
      ],
      spawnPoints: [{ x: 17, y: 17 }]
    };

    const monsters = spawnSystem.createMonsters({
      dungeon,
      playerPosition: { x: 10, y: 10 },
      floor: 4,
      count: 1,
      enemyBaseHealth: 100,
      enemyBaseDamage: 20,
      archetypes: MONSTER_ARCHETYPES,
      rng: new DeterministicRng()
    });

    expect(monsters).toHaveLength(1);
    expect(monsters[0]?.archetype.attackType).toBe("ranged");
  });
});
