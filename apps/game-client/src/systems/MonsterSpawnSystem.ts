import type { DungeonLayout, MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";
import type { RngLike } from "@blodex/core";

export interface MonsterSpawnCandidate {
  state: MonsterState;
  archetype: MonsterArchetypeDef;
}

export interface MonsterSpawnOptions {
  dungeon: DungeonLayout;
  playerPosition: { x: number; y: number };
  floor: number;
  count: number;
  enemyBaseHealth: number;
  enemyBaseDamage: number;
  archetypes: MonsterArchetypeDef[];
  rng: RngLike;
}

export class MonsterSpawnSystem {
  private generateSpawnPoints(
    dungeon: DungeonLayout,
    playerPosition: { x: number; y: number },
    count: number,
    rng: RngLike
  ): Array<{ x: number; y: number }> {
    const candidates: Array<{ x: number; y: number }> = [];
    const points: Array<{ x: number; y: number }> = [];

    for (let y = 1; y < dungeon.height - 1; y += 1) {
      for (let x = 1; x < dungeon.width - 1; x += 1) {
        if (!dungeon.walkable[y]?.[x]) {
          continue;
        }

        const distToPlayer = Math.hypot(x - playerPosition.x, y - playerPosition.y);
        if (distToPlayer < 6 || distToPlayer > 20) {
          continue;
        }
        candidates.push({ x, y });
      }
    }

    while (points.length < count && candidates.length > 0) {
      const idx = rng.nextInt(0, candidates.length - 1);
      const picked = candidates.splice(idx, 1)[0];
      if (picked === undefined) {
        break;
      }

      const tooClose = points.some((point) => Math.hypot(point.x - picked.x, point.y - picked.y) < 2.8);
      if (!tooClose) {
        points.push(picked);
      }
    }

    if (points.length < count) {
      for (const fallback of dungeon.spawnPoints) {
        points.push({ x: fallback.x, y: fallback.y });
        if (points.length >= count) {
          break;
        }
      }
    }

    return points;
  }

  createMonsters(options: MonsterSpawnOptions): MonsterSpawnCandidate[] {
    const points = this.generateSpawnPoints(options.dungeon, options.playerPosition, options.count, options.rng);
    const monsters: MonsterSpawnCandidate[] = [];

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]!;
      const archetype = options.archetypes[i % options.archetypes.length]!;
      const levelScale = 1 + options.floor * 0.12;

      monsters.push({
        archetype,
        state: {
          id: `monster-${i}`,
          archetypeId: archetype.id,
          level: options.floor,
          health: Math.floor(options.enemyBaseHealth * archetype.healthMultiplier * levelScale),
          maxHealth: Math.floor(options.enemyBaseHealth * archetype.healthMultiplier * levelScale),
          damage: Math.floor(options.enemyBaseDamage * archetype.damageMultiplier * levelScale),
          attackRange: archetype.attackRange,
          moveSpeed: archetype.moveSpeed,
          xpValue: archetype.xpValue,
          dropTableId: archetype.dropTableId,
          position: { x: point.x, y: point.y },
          aiState: "idle"
        }
      });
    }

    return monsters;
  }
}
