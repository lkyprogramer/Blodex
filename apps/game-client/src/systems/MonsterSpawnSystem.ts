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
  private isCandidateBlocked(
    blocked: Set<string>,
    point: { x: number; y: number }
  ): boolean {
    return blocked.has(`${point.x}:${point.y}`);
  }

  private canPlacePoint(
    points: Array<{ x: number; y: number }>,
    picked: { x: number; y: number },
    minSpacing: number
  ): boolean {
    return !points.some((point) => Math.hypot(point.x - picked.x, point.y - picked.y) < minSpacing);
  }

  private generateSpawnPoints(
    dungeon: DungeonLayout,
    playerPosition: { x: number; y: number },
    count: number,
    rng: RngLike,
    blockedPositions: Array<{ x: number; y: number }>,
    options?: {
      minDistance?: number;
      maxDistance?: number;
      minSpacing?: number;
      packChance?: number;
      packRadius?: number;
    }
  ): Array<{ x: number; y: number }> {
    const candidates: Array<{ x: number; y: number }> = [];
    const anchors: Array<{ x: number; y: number }> = [];
    const points: Array<{ x: number; y: number }> = [];
    const blocked = new Set(blockedPositions.map((entry) => `${entry.x}:${entry.y}`));
    const minDistance = Math.max(0, options?.minDistance ?? 4);
    const maxDistance = Math.max(minDistance, options?.maxDistance ?? 30);
    const minSpacing = Math.max(0.5, options?.minSpacing ?? 2);
    const packChance = Math.max(0, Math.min(1, options?.packChance ?? 0.42));
    const packRadius = Math.max(minSpacing, options?.packRadius ?? 4.5);

    for (let y = 1; y < dungeon.height - 1; y += 1) {
      for (let x = 1; x < dungeon.width - 1; x += 1) {
        if (!dungeon.walkable[y]?.[x]) {
          continue;
        }
        if (blocked.has(`${x}:${y}`)) {
          continue;
        }

        const distToPlayer = Math.hypot(x - playerPosition.x, y - playerPosition.y);
        if (distToPlayer < minDistance || distToPlayer > maxDistance) {
          continue;
        }
        candidates.push({ x, y });
      }
    }

    for (const spawnPoint of dungeon.spawnPoints) {
      if (this.isCandidateBlocked(blocked, spawnPoint)) {
        continue;
      }
      const distToPlayer = Math.hypot(spawnPoint.x - playerPosition.x, spawnPoint.y - playerPosition.y);
      if (distToPlayer < minDistance || distToPlayer > maxDistance) {
        continue;
      }
      anchors.push({ x: spawnPoint.x, y: spawnPoint.y });
    }

    const removeCandidate = (pool: Array<{ x: number; y: number }>, picked: { x: number; y: number }): void => {
      const index = pool.findIndex((entry) => entry.x === picked.x && entry.y === picked.y);
      if (index >= 0) {
        pool.splice(index, 1);
      }
    };

    while (points.length < count && (anchors.length > 0 || candidates.length > 0)) {
      let picked: { x: number; y: number } | undefined;

      if (points.length > 0 && candidates.length > 0 && rng.next() < packChance) {
        const packPool = candidates.filter((candidate) => {
          if (!this.canPlacePoint(points, candidate, minSpacing)) {
            return false;
          }
          return points.some((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) <= packRadius);
        });
        if (packPool.length > 0) {
          picked = rng.pick(packPool);
        }
      }

      if (picked === undefined && anchors.length > 0) {
        const validAnchors = anchors.filter((anchor) => this.canPlacePoint(points, anchor, minSpacing));
        if (validAnchors.length > 0) {
          picked = rng.pick(validAnchors);
        }
      }

      if (picked === undefined && candidates.length > 0) {
        const validCandidates = candidates.filter((candidate) => this.canPlacePoint(points, candidate, minSpacing));
        if (validCandidates.length > 0) {
          picked = rng.pick(validCandidates);
        }
      }

      if (picked === undefined) {
        break;
      }

      points.push(picked);
      removeCandidate(anchors, picked);
      removeCandidate(candidates, picked);
    }

    if (points.length < count) {
      for (const fallback of dungeon.spawnPoints) {
        if (this.isCandidateBlocked(blocked, fallback)) {
          continue;
        }
        if (!this.canPlacePoint(points, fallback, minSpacing)) {
          continue;
        }
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
    if (count <= 0) {
      return [];
    }
    if (options.floorConfig?.isBossFloor === true && count <= 1) {
      return [];
    }

    const spawnTuning = {
      ...(options.floorConfig?.spawnMinDistance === undefined
        ? {}
        : { minDistance: options.floorConfig.spawnMinDistance }),
      ...(options.floorConfig?.spawnMaxDistance === undefined
        ? {}
        : { maxDistance: options.floorConfig.spawnMaxDistance }),
      ...(options.floorConfig?.spawnMinSpacing === undefined
        ? {}
        : { minSpacing: options.floorConfig.spawnMinSpacing }),
      ...(options.floorConfig?.spawnPackChance === undefined
        ? {}
        : { packChance: options.floorConfig.spawnPackChance }),
      ...(options.floorConfig?.spawnPackRadius === undefined
        ? {}
        : { packRadius: options.floorConfig.spawnPackRadius })
    };
    const points = this.generateSpawnPoints(
      options.dungeon,
      options.playerPosition,
      count,
      options.rng,
      options.blockedPositions ?? [],
      spawnTuning
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
        ...(archetype.enemyProfileId === undefined ? {} : { enemyProfileId: archetype.enemyProfileId }),
        ...(archetype.damageProfile === undefined ? {} : { damageProfile: archetype.damageProfile }),
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
