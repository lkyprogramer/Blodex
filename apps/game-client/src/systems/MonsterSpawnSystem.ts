import {
  MONSTER_AFFIX_IDS,
  applyAffixesToMonsterState,
  rollMonsterAffixes,
  type DungeonLayout,
  type MonsterAffixId,
  type MonsterState
} from "@blodex/core";
import type { FloorConfig, MonsterArchetypeDef } from "@blodex/content";
import type { RngLike } from "@blodex/core";

export interface MonsterSpawnCandidate {
  state: MonsterState;
  archetype: MonsterArchetypeDef;
}

export interface MonsterSpawnOptions {
  dungeon: DungeonLayout;
  playerPosition: { x: number; y: number };
  floor: number;
  floorConfig?: FloorConfig;
  affixPolicy?: "default" | "forceOne";
  count?: number;
  enemyBaseHealth: number;
  enemyBaseDamage: number;
  archetypes: MonsterArchetypeDef[];
  biomeMonsterPool?: string[];
  blockedPositions?: Array<{ x: number; y: number }>;
  unlockedAffixes?: MonsterAffixId[];
  extraAffixCount?: number;
  rng: RngLike;
}

export class MonsterSpawnSystem {
  private generateSpawnPoints(
    dungeon: DungeonLayout,
    playerPosition: { x: number; y: number },
    count: number,
    rng: RngLike,
    blockedPositions: Array<{ x: number; y: number }>
  ): Array<{ x: number; y: number }> {
    const candidates: Array<{ x: number; y: number }> = [];
    const points: Array<{ x: number; y: number }> = [];
    const blocked = new Set(blockedPositions.map((entry) => `${entry.x}:${entry.y}`));

    for (let y = 1; y < dungeon.height - 1; y += 1) {
      for (let x = 1; x < dungeon.width - 1; x += 1) {
        if (!dungeon.walkable[y]?.[x]) {
          continue;
        }
        if (blocked.has(`${x}:${y}`)) {
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
    const count = options.count ?? options.floorConfig?.monsterCount ?? 0;
    if (options.floorConfig?.isBossFloor === true && count <= 1) {
      return [];
    }

    const points = this.generateSpawnPoints(
      options.dungeon,
      options.playerPosition,
      count,
      options.rng,
      options.blockedPositions ?? []
    );
    const monsters: MonsterSpawnCandidate[] = [];
    const hpMultiplier = options.floorConfig?.monsterHpMultiplier ?? 1;
    const dmgMultiplier = options.floorConfig?.monsterDmgMultiplier ?? 1;
    const archetypeById = new Map(options.archetypes.map((archetype) => [archetype.id, archetype]));
    const pooled =
      options.biomeMonsterPool === undefined
        ? options.archetypes
        : options.biomeMonsterPool
            .map((id) => archetypeById.get(id))
            .filter((archetype): archetype is MonsterArchetypeDef => archetype !== undefined);
    const spawnPool = pooled.length > 0 ? pooled : options.archetypes;

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]!;
      const archetype = options.rng.pick(spawnPool);
      const baseAffixes = rollMonsterAffixes({
        floor: options.floor,
        isBoss: options.floorConfig?.isBossFloor ?? false,
        ...(options.affixPolicy === undefined ? {} : { policy: options.affixPolicy }),
        ...(options.unlockedAffixes === undefined ? {} : { availableAffixes: options.unlockedAffixes }),
        rng: options.rng
      });
      const affixes = [...baseAffixes];
      const extraAffixCount = Math.max(0, Math.floor(options.extraAffixCount ?? 0));
      if (extraAffixCount > 0) {
        const availableAffixPool =
          options.unlockedAffixes === undefined || options.unlockedAffixes.length === 0
            ? [...MONSTER_AFFIX_IDS]
            : [...options.unlockedAffixes];
        const extraPool = availableAffixPool.filter((affixId) => !affixes.includes(affixId));
        while (extraPool.length > 0 && affixes.length < baseAffixes.length + extraAffixCount) {
          const pickedIndex = options.rng.nextInt(0, extraPool.length - 1);
          const [pickedAffix] = extraPool.splice(pickedIndex, 1);
          if (pickedAffix !== undefined) {
            affixes.push(pickedAffix);
          }
        }
      }
      const nextState = applyAffixesToMonsterState({
        id: `monster-${i}`,
        archetypeId: archetype.id,
        level: options.floor,
        health: Math.floor(options.enemyBaseHealth * archetype.healthMultiplier * hpMultiplier),
        maxHealth: Math.floor(options.enemyBaseHealth * archetype.healthMultiplier * hpMultiplier),
        damage: Math.floor(options.enemyBaseDamage * archetype.damageMultiplier * dmgMultiplier),
        attackRange: archetype.attackRange,
        moveSpeed: archetype.moveSpeed,
        xpValue: archetype.xpValue,
        dropTableId: archetype.dropTableId,
        position: { x: point.x, y: point.y },
        aiState: archetype.aiConfig.behavior === "ambush" ? "ambush" : "idle",
        aiBehavior: archetype.aiConfig.behavior,
        ...(affixes.length === 0 ? {} : { affixes })
      });

      monsters.push({
        archetype,
        state: nextState
      });
    }

    return monsters;
  }
}
