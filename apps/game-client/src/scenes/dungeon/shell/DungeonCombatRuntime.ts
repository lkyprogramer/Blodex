import {
  addRunObols,
  collectLoot,
  resolveMonsterAffixOnDealDamage,
  resolveMonsterAffixOnKilled,
  type RollItemDropOptions,
  type CombatEvent,
  type ItemDef,
  type ItemInstance,
  type MonsterState,
  type PlayerState
} from "@blodex/core";
import { ITEM_DEF_MAP, LOOT_TABLE_MAP, MONSTER_ARCHETYPES, WEAPON_TYPE_DEF_MAP } from "@blodex/content";
import type { MonsterAiUpdateResult } from "../../../systems/AISystem";
import type { CombatSystem } from "../../../systems/CombatSystem";
import type { EntityManager, MonsterRuntime } from "../../../systems/EntityManager";
import type { RunLogService } from "../logging/RunLogService";
import type { DungeonScene } from "../../DungeonScene";

const AI_ACTIVE_RADIUS_TILES = 10;
const AI_FAR_UPDATE_INTERVAL_FRAMES = 3;
const ELITE_DROP_TABLE_ID = "catacomb_elite";
const NEAR_DEATH_ARM_THRESHOLD = 0.2;
const NEAR_DEATH_RECOVERY_THRESHOLD = 0.45;
const NEAR_DEATH_RECOVERY_WINDOW_MS = 8_000;
const NEAR_DEATH_FEEDBACK_COOLDOWN_MS = 10_000;
const MONSTER_COMBAT_RADIUS_TILES = 12;
const LOOT_PICKUP_RADIUS_TILES = 1.15;

export interface DungeonCombatSource {
  floorConfig: { isBossFloor: boolean };
  combatSystem: Pick<CombatSystem, "updatePlayerAttack" | "updateMonsterAttacks">;
  aiSystem: {
    updateMonsters(
      monsters: MonsterRuntime[],
      player: PlayerState,
      dt: number,
      nowMs: number,
      options?: { canMoveTo?: (position: { x: number; y: number }) => boolean }
    ): MonsterAiUpdateResult;
  };
  entityManager: EntityManager;
  renderSystem: {
    spawnMonster(
      monster: MonsterState,
      archetype: (typeof MONSTER_ARCHETYPES)[number],
      origin: { x: number; y: number }
    ): MonsterRuntime;
  };
  powerSpikeRuntimeModule: {
    spawnLootDrop(
      item: ItemInstance,
      position: { x: number; y: number },
      source: string,
      nowMs: number
    ): void;
  };
  progressionRuntimeModule: {
    onMonsterDefeated(state: MonsterState, nowMs: number): void;
  };
  heartbeatFeedbackRuntime: {
    maybeQueueEquipmentCompare(item: ItemInstance, source: string): void;
  };
  phase6Telemetry: {
    recordCombatEvents(playerId: string, events: CombatEvent[], source: "auto" | "other"): void;
  };
  tasteRuntime: {
    recordKeyKill(kind: string, floor: number, source: string, nowMs: number): void;
    recordPickup(item: ItemInstance, floor: number, source: string, nowMs: number): void;
  };
  contentLocalizer: {
    monsterName(id: string, fallback: string): string;
  };
  eventBus: {
    emit(event: string, payload: unknown): void;
  };
  runLog: Pick<RunLogService, "appendKey">;
  currentBiome: {
    lootBias?: RollItemDropOptions["slotWeightMultiplier"];
  };
  player: PlayerState;
  run: DungeonScene["run"];
  attackTargetId: string | null;
  nextPlayerAttackAt: number;
  combatRng: DungeonScene["combatRng"];
  lootRng: DungeonScene["lootRng"];
  path: DungeonScene["path"];
  manualMoveTarget: DungeonScene["manualMoveTarget"];
  manualMoveTargetFailures: number;
  hudDirty: boolean;
  mutationRuntime: DungeonScene["mutationRuntime"];
  nearDeathWindowArmedAtMs: number | null;
  nearDeathFeedbackCooldownUntilMs: number;
  lastAiNearCount: number;
  lastAiFarCount: number;
  aiFrameCounter: number;
  entityLabelById: Map<string, string>;
  origin: { x: number; y: number };
  dungeon: {
    width: number;
    height: number;
    walkable: boolean[][];
  };
  resolveMutationAttackSpeedMultiplier(nowMs: number): number;
  resolveMutationDropBonus(): { obolMultiplier: number; soulShardMultiplier: number };
  isItemDefUnlocked(itemDef: ItemDef): boolean;
  computePathTo(target: { x: number; y: number }): DungeonScene["path"];
  emitCombatEvents(events: CombatEvent[]): void;
  handleLevelUpGain(levelsGained: number, nowMs: number, source: string): void;
  tryDiscoverBlueprints(
    sourceType:
      | "monster_affix"
      | "boss_kill"
      | "boss_first_kill"
      | "challenge_room"
      | "hidden_room"
      | "random_event"
      | "floor_clear",
    nowMs: number,
    sourceId?: string
  ): void;
  applyOnKillMutationEffects(nowMs: number): void;
  collectMutationEffects<T extends DungeonScene["mutationRuntime"]["activeEffects"][number]["type"]>(
    type: T
  ): Array<Extract<DungeonScene["mutationRuntime"]["activeEffects"][number], { type: T }>>;
  refreshMonsterBuffRuntime(monster: MonsterRuntime): void;
  recordAcquiredItemTelemetry(
    item: ItemInstance,
    source: string,
    nowMs: number,
    baselinePlayer?: PlayerState
  ): void;
}

export class DungeonCombatRuntime {
  constructor(private readonly resolveSource: () => DungeonCombatSource) {}

  private get source(): DungeonCombatSource {
    return this.resolveSource();
  }

  updateCombat(nowMs: number): void {
    const source = this.source;
    if (source.floorConfig.isBossFloor) {
      return;
    }

    const playerCombat = source.combatSystem.updatePlayerAttack({
      player: source.player,
      run: source.run,
      monsters: source.entityManager.listMonsters(),
      attackTargetId: source.attackTargetId,
      nextPlayerAttackAt: source.nextPlayerAttackAt,
      nowMs,
      combatRng: source.combatRng,
      lootRng: source.lootRng,
      itemDefs: ITEM_DEF_MAP,
      lootTables: LOOT_TABLE_MAP,
      attackSpeedMultiplier: source.resolveMutationAttackSpeedMultiplier(nowMs),
      weaponTypeDefs: WEAPON_TYPE_DEF_MAP,
      canDropItemDef: (itemDef) => source.isItemDefUnlocked(itemDef),
      ...(source.currentBiome.lootBias === undefined ? {} : { slotWeightMultiplier: source.currentBiome.lootBias })
    });

    source.player = playerCombat.player;
    source.run = playerCombat.run;
    source.attackTargetId = playerCombat.attackTargetId;
    source.nextPlayerAttackAt = playerCombat.nextPlayerAttackAt;

    if (playerCombat.requestPathTarget !== undefined) {
      source.manualMoveTarget = null;
      source.manualMoveTargetFailures = 0;
      source.path = source.computePathTo(playerCombat.requestPathTarget);
    }

    source.emitCombatEvents(playerCombat.combatEvents);
    source.phase6Telemetry.recordCombatEvents(source.player.id, playerCombat.combatEvents, "auto");
    if (playerCombat.combatEvents.length > 0) {
      source.hudDirty = true;
    }

    if (playerCombat.leveledUp) {
      source.handleLevelUpGain(playerCombat.levelsGained, nowMs, "combat_kill");
    }

    if (playerCombat.killedMonsterId !== undefined) {
      const { obolMultiplier } = source.resolveMutationDropBonus();
      const bonusObol = Math.max(0, Math.floor(obolMultiplier) - 1);
      if (bonusObol > 0) {
        source.run = addRunObols(source.run, bonusObol);
      }
      const dead = source.entityManager.removeMonsterById(playerCombat.killedMonsterId);
      if (dead !== null) {
        this.handleMonsterDefeat(dead, nowMs);
      }
    }

    if (playerCombat.droppedItem !== undefined) {
      source.powerSpikeRuntimeModule.spawnLootDrop(
        playerCombat.droppedItem.item,
        playerCombat.droppedItem.position,
        "drop_spawn",
        nowMs
      );
      source.eventBus.emit("loot:drop", {
        sourceId: playerCombat.droppedItem.sourceId,
        item: playerCombat.droppedItem.item,
        position: playerCombat.droppedItem.position,
        timestampMs: nowMs
      });
    }
  }

  updatePressurePeakRuntime(nowMs: number): void {
    const source = this.source;
    if (source.player.health <= 0) {
      source.nearDeathWindowArmedAtMs = null;
      return;
    }

    const healthRatio = source.player.health / Math.max(1, source.player.derivedStats.maxHealth);
    if (healthRatio <= NEAR_DEATH_ARM_THRESHOLD) {
      source.nearDeathWindowArmedAtMs ??= nowMs;
      return;
    }

    if (source.nearDeathWindowArmedAtMs === null) {
      return;
    }
    if (nowMs - source.nearDeathWindowArmedAtMs > NEAR_DEATH_RECOVERY_WINDOW_MS) {
      source.nearDeathWindowArmedAtMs = null;
      return;
    }
    if (healthRatio < NEAR_DEATH_RECOVERY_THRESHOLD || nowMs < source.nearDeathFeedbackCooldownUntilMs) {
      return;
    }

    source.nearDeathWindowArmedAtMs = null;
    source.nearDeathFeedbackCooldownUntilMs = nowMs + NEAR_DEATH_FEEDBACK_COOLDOWN_MS;
    source.eventBus.emit("pressure_peak", {
      floor: source.run.currentFloor,
      kind: "near_death_reversal",
      timestampMs: nowMs
    });
  }

  updateMonsters(dt: number, nowMs: number): void {
    const source = this.source;
    const livingMonsters = source.entityManager.listLivingMonsters();
    if (livingMonsters.length === 0) {
      return;
    }

    const nearMonsters = source.entityManager.queryMonstersInRadius(source.player.position, AI_ACTIVE_RADIUS_TILES, true);
    source.lastAiNearCount = nearMonsters.length;
    const nearIds = new Set(nearMonsters.map((monster) => monster.state.id));
    const farMonsters = livingMonsters.filter((monster) => !nearIds.has(monster.state.id));
    source.lastAiFarCount = farMonsters.length;
    const nearResult = source.aiSystem.updateMonsters(nearMonsters, source.player, dt, nowMs, {
      canMoveTo: (position) => this.isMonsterWalkable(position)
    });
    source.aiFrameCounter = (source.aiFrameCounter + 1) % AI_FAR_UPDATE_INTERVAL_FRAMES;
    const farResult =
      farMonsters.length > 0 && source.aiFrameCounter === 0
        ? source.aiSystem.updateMonsters(farMonsters, source.player, dt * AI_FAR_UPDATE_INTERVAL_FRAMES, nowMs, {
            canMoveTo: (position) => this.isMonsterWalkable(position)
          })
        : { transitions: [], supportActions: [] };
    const aiResult = this.mergeAiResults(nearResult, farResult);
    source.entityManager.rebuildMonsterSpatialIndex();

    for (const transition of aiResult.transitions) {
      source.eventBus.emit("monster:stateChange", transition);
    }

    for (const action of aiResult.supportActions) {
      const target = source.entityManager.findMonsterById(action.targetMonsterId);
      const sourceMonster = source.entityManager.findMonsterById(action.sourceMonsterId);
      if (target === undefined || sourceMonster === undefined || target.state.health <= 0) {
        continue;
      }
      const before = target.state.health;
      target.state.health = Math.min(target.state.maxHealth, target.state.health + action.amount);
      if (target.state.health > before) {
        source.runLog.appendKey(
          "log.monster.support_heal",
          {
            sourceName: sourceMonster.archetype.name,
            targetName: target.archetype.name,
            amount: target.state.health - before
          },
          "info",
          action.timestampMs
        );
        source.hudDirty = true;
      }
    }
  }

  updateMonsterCombat(nowMs: number): void {
    const source = this.source;
    const healthBeforeHits = source.player.health;
    const monsterCombat = source.combatSystem.updateMonsterAttacks(
      source.entityManager.queryMonstersInRadius(source.player.position, MONSTER_COMBAT_RADIUS_TILES, true),
      source.player,
      nowMs,
      source.combatRng
    );

    source.player = monsterCombat.player;
    const playerTookDamage = source.player.health < healthBeforeHits;
    if (playerTookDamage && nowMs <= source.mutationRuntime.onHitInvulnUntilMs) {
      source.player = {
        ...source.player,
        health: healthBeforeHits
      };
    } else if (playerTookDamage && nowMs > source.mutationRuntime.onHitInvulnCooldownUntilMs) {
      const invulnEffects = source.collectMutationEffects("on_hit_invuln");
      for (const effect of invulnEffects) {
        if (source.combatRng.next() >= effect.chance) {
          continue;
        }
        source.mutationRuntime.onHitInvulnUntilMs = nowMs + effect.durationMs;
        source.mutationRuntime.onHitInvulnCooldownUntilMs = nowMs + effect.cooldownMs;
        source.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:on_hit_invuln",
          effectType: "on_hit_invuln",
          timestampMs: nowMs,
          value: effect.durationMs
        });
        break;
      }
    }

    if (source.player.health <= 0) {
      const lethalGuard = source
        .collectMutationEffects("once_per_floor_lethal_guard")
        .map((effect) => effect.invulnMs)
        .sort((left, right) => right - left)[0];
      if (lethalGuard !== undefined && !source.mutationRuntime.lethalGuardUsedFloors.has(source.run.currentFloor)) {
        source.mutationRuntime.lethalGuardUsedFloors.add(source.run.currentFloor);
        source.mutationRuntime.onHitInvulnUntilMs = nowMs + lethalGuard;
        source.player = {
          ...source.player,
          health: 1
        };
        source.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:lethal_guard",
          effectType: "once_per_floor_lethal_guard",
          timestampMs: nowMs,
          value: lethalGuard
        });
      }
    }

    const reflectPercent = source.collectMutationEffects("on_hit_reflect_percent").reduce((sum, effect) => {
      return sum + effect.value;
    }, 0);
    if (reflectPercent > 0) {
      for (const event of monsterCombat.combatEvents) {
        if (event.targetId !== source.player.id || (event.kind !== "damage" && event.kind !== "crit") || event.amount <= 0) {
          continue;
        }
        const sourceMonster = source.entityManager.findMonsterById(event.sourceId);
        if (sourceMonster === undefined || sourceMonster.state.health <= 0) {
          continue;
        }
        const reflectedDamage = Math.max(1, Math.floor(event.amount * reflectPercent));
        sourceMonster.state.health = Math.max(0, sourceMonster.state.health - reflectedDamage);
        source.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:on_hit_reflect",
          effectType: "on_hit_reflect_percent",
          timestampMs: nowMs,
          value: reflectedDamage,
          detail: sourceMonster.state.id
        });
        if (sourceMonster.state.health > 0) {
          continue;
        }
        const dead = source.entityManager.removeMonsterById(sourceMonster.state.id);
        if (dead === null) {
          continue;
        }
        this.handleMonsterDefeat(dead, nowMs);
        const { obolMultiplier } = source.resolveMutationDropBonus();
        source.run = addRunObols(
          {
            ...source.run,
            kills: source.run.kills + 1,
            totalKills: source.run.totalKills + 1,
            endlessKills: (source.run.endlessKills ?? 0) + (source.run.inEndless ? 1 : 0)
          },
          Math.max(1, Math.floor(obolMultiplier))
        );
      }
    }

    source.emitCombatEvents(monsterCombat.combatEvents);
    source.phase6Telemetry.recordCombatEvents(source.player.id, monsterCombat.combatEvents, "other");
    for (const event of monsterCombat.combatEvents) {
      if (event.kind === "dodge" || event.amount <= 0) {
        continue;
      }
      const sourceMonster = source.entityManager.findMonsterById(event.sourceId);
      if (sourceMonster === undefined) {
        continue;
      }
      const affixResult = resolveMonsterAffixOnDealDamage(sourceMonster.state, event.targetId, event.amount, nowMs);
      sourceMonster.state = affixResult.monster;
      if (affixResult.leechEvent === undefined) {
        continue;
      }
      source.eventBus.emit("monster:leech", affixResult.leechEvent);
    }
    if (monsterCombat.combatEvents.length > 0) {
      source.hudDirty = true;
    }
  }

  collectNearbyLoot(nowMs: number): void {
    const source = this.source;
    const picked = source.entityManager.consumeLootNear(source.player.position, LOOT_PICKUP_RADIUS_TILES);
    if (picked.length === 0) {
      return;
    }

    for (const drop of picked) {
      const baselinePlayer = source.player;
      source.player = collectLoot(source.player, drop.item);
      source.run = {
        ...source.run,
        lootCollected: source.run.lootCollected + 1
      };
      source.tasteRuntime.recordPickup(drop.item, source.run.currentFloor, "auto_pickup", nowMs);
      source.recordAcquiredItemTelemetry(drop.item, "auto_pickup", nowMs, baselinePlayer);
      source.heartbeatFeedbackRuntime.maybeQueueEquipmentCompare(drop.item, "auto_pickup");
      drop.sprite.destroy();
      source.eventBus.emit("loot:pickup", {
        playerId: source.player.id,
        item: drop.item,
        position: drop.position,
        timestampMs: nowMs
      });
    }
  }

  private handleMonsterDefeat(dead: MonsterRuntime, nowMs: number): void {
    const source = this.source;
    if (dead.archetype.dropTableId === ELITE_DROP_TABLE_ID) {
      source.tasteRuntime.recordKeyKill("elite", source.run.currentFloor, "elite_kill", nowMs);
      source.eventBus.emit("pressure_peak", {
        floor: source.run.currentFloor,
        kind: "elite_kill",
        timestampMs: nowMs,
        label: source.contentLocalizer.monsterName(dead.archetype.id, dead.archetype.name)
      });
    }
    source.progressionRuntimeModule.onMonsterDefeated(dead.state, nowMs);
    for (const affixId of dead.state.affixes ?? []) {
      source.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
    }
    source.applyOnKillMutationEffects(nowMs);
    dead.sprite.destroy();
    dead.healthBarBg.destroy();
    dead.healthBarFg.destroy();
    dead.affixMarker?.destroy();
    this.spawnSplitChildren(dead.state, dead.archetype, nowMs);
  }

  spawnSplitChildren(
    sourceState: MonsterState,
    archetype: (typeof MONSTER_ARCHETYPES)[number],
    nowMs: number
  ): void {
    const source = this.source;
    const splitResult = resolveMonsterAffixOnKilled(sourceState, nowMs);
    if (splitResult.children.length === 0) {
      return;
    }

    for (const childState of splitResult.children) {
      const runtime = source.renderSystem.spawnMonster(childState, archetype, source.origin);
      source.entityManager.listMonsters().push(runtime);
      source.entityLabelById.set(childState.id, `${archetype.name} Fragment`);
      for (const affix of childState.affixes ?? []) {
        source.eventBus.emit("monster:affixApplied", {
          monsterId: childState.id,
          affixId: affix,
          timestampMs: nowMs
        });
      }
    }

    source.entityManager.rebuildMonsterSpatialIndex();
    if (splitResult.splitEvent !== undefined) {
      source.eventBus.emit("monster:split", splitResult.splitEvent);
    }
  }

  private mergeAiResults(
    first: MonsterAiUpdateResult,
    second: MonsterAiUpdateResult
  ): MonsterAiUpdateResult {
    return {
      transitions: [...first.transitions, ...second.transitions],
      supportActions: [...first.supportActions, ...second.supportActions]
    };
  }

  private isMonsterWalkable(position: { x: number; y: number }): boolean {
    const source = this.source;
    const tileX = Math.round(position.x);
    const tileY = Math.round(position.y);
    if (tileX < 0 || tileY < 0 || tileX >= source.dungeon.width || tileY >= source.dungeon.height) {
      return false;
    }
    return source.dungeon.walkable[tileY]?.[tileX] === true;
  }
}
