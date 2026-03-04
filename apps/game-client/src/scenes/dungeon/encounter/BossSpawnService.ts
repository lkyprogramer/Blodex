import {
  applyAffixesToMonsterState,
  findStaircasePosition,
  initBossState,
  rollMonsterAffixes,
  type MonsterState
} from "@blodex/core";
import { MONSTER_ARCHETYPES } from "@blodex/content";

type BossHost = Record<string, any>;

export interface BossSpawnServiceOptions {
  host: BossHost;
}

export class BossSpawnService {
  constructor(private readonly options: BossSpawnServiceOptions) {}

  spawnBoss(): void {
    const host = this.options.host;
    const roomCenter = findStaircasePosition(host.dungeon, host.dungeon.playerSpawn);
    host.bossState = initBossState(host.bossDef, roomCenter);
    host.entityLabelById.set(host.bossDef.id, host.bossDef.name);
    host.bossSprite = host.renderSystem.spawnBoss(roomCenter, host.origin, host.bossDef.spriteKey);
    host.entityManager.setBoss({
      state: host.bossState,
      sprite: host.bossSprite
    });
  }

  spawnSummonedMonsters(count: number): void {
    const host = this.options.host;
    const archetype = MONSTER_ARCHETYPES[0];
    if (archetype === undefined || host.bossState === null) {
      return;
    }

    const existing = host.entityManager.listMonsters().length;
    for (let i = 0; i < count; i += 1) {
      const idx = existing + i;
      const angle = (Math.PI * 2 * i) / Math.max(1, count);
      const position = {
        x: host.bossState.position.x + Math.cos(angle) * 2,
        y: host.bossState.position.y + Math.sin(angle) * 2
      };
      const rolledAffixes = rollMonsterAffixes({
        floor: host.run.currentFloor,
        isBoss: false,
        policy: host.run.difficultyModifier.affixPolicy,
        availableAffixes: host.unlockedAffixIds,
        rng: host.spawnRng
      });
      const state = applyAffixesToMonsterState({
        id: `summon-${idx}-${Math.floor(host.time.now)}`,
        archetypeId: archetype.id,
        level: host.run.currentFloor,
        health: Math.floor(65 * host.floorConfig.monsterHpMultiplier),
        maxHealth: Math.floor(65 * host.floorConfig.monsterHpMultiplier),
        damage: Math.floor(8 * host.floorConfig.monsterDmgMultiplier),
        attackRange: archetype.attackRange,
        moveSpeed: archetype.moveSpeed,
        xpValue: archetype.xpValue,
        dropTableId: archetype.dropTableId,
        position,
        aiState: "chase",
        aiBehavior: "chase",
        affixes: rolledAffixes
      } satisfies MonsterState);
      const runtime = host.renderSystem.spawnMonster(state, archetype, host.origin);
      host.entityLabelById.set(runtime.state.id, runtime.archetype.name);
      for (const affix of runtime.state.affixes ?? []) {
        host.eventBus.emit("monster:affixApplied", {
          monsterId: runtime.state.id,
          affixId: affix,
          timestampMs: host.time.now
        });
      }
      host.entityManager.listMonsters().push(runtime);
    }

    host.entityManager.rebuildMonsterSpatialIndex();
  }
}
