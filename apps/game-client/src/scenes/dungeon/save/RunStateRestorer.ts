import {
  aggregateBuffEffects,
  buildMutationDefMap,
  canStartDailyScoredAttempt,
  collectUnlockedMutationIds,
  normalizeDifficultyMode,
  resolveMonsterBaseMoveSpeedWithAffixes,
  validateMutationSelection,
  type BuffInstance,
  type PersistedBuffState,
  type RunSaveDataV3
} from "@blodex/core";
import Phaser from "phaser";
import {
  BIOME_MAP,
  BUFF_DEF_MAP,
  MUTATION_DEFS,
  MONSTER_ARCHETYPES,
  RANDOM_EVENT_DEFS,
  getFloorConfig
} from "@blodex/content";
import { resolveBiomeVisualTheme } from "../presentation/BiomeVisualThemeRegistry";
import type { RunStateRestoreHost } from "./savePorts";
import { createInitialDodgeRuntimeState } from "../shell/dodgeTypes";

const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);

function rebuildPersistedBuffs(
  buffs: PersistedBuffState[] | undefined,
  runtimeNowMs: number
): BuffInstance[] | undefined {
  if (buffs === undefined) {
    return undefined;
  }
  return buffs.flatMap((buff) => {
    const remainingMs = Math.max(0, Math.floor(buff.remainingMs));
    if (remainingMs <= 0) {
      return [];
    }
    return [
      {
        defId: buff.defId,
        sourceId: buff.sourceId,
        targetId: buff.targetId,
        appliedAtMs: runtimeNowMs,
        expiresAtMs: runtimeNowMs + remainingMs
      }
    ];
  });
}

function resolveSavedMonsterBaseMoveSpeed(
  archetypeMoveSpeed: number,
  monster: RunSaveDataV3["runtime"]["monsters"][number]
): number {
  if (monster.baseMoveSpeed !== undefined) {
    return monster.baseMoveSpeed;
  }
  return resolveMonsterBaseMoveSpeedWithAffixes(archetypeMoveSpeed, monster.state.affixes ?? []);
}

function resolveSavedMonsterMoveSpeed(
  baseMoveSpeed: number,
  activeBuffs: BuffInstance[] | undefined
): number {
  const buffEffects = aggregateBuffEffects(activeBuffs ?? [], BUFF_DEF_MAP);
  return Number((baseMoveSpeed * (buffEffects.slowMultiplier ?? 1)).toFixed(2));
}

export interface RunStateRestorerOptions {
  host: RunStateRestoreHost;
}

export class RunStateRestorer {
  constructor(private readonly options: RunStateRestorerOptions) {}

  restore(save: RunSaveDataV3): boolean {
    const host = this.options.host;
    try {
      this.loadPersistentState(host, save);
      this.rebuildDerivedState(host, save);
      this.bootstrapSessionState(host, save);
      return true;
    } catch (error) {
      console.warn("[Save] Failed to restore run snapshot.", error);
      return false;
    }
  }

  private loadPersistentState(host: RunStateRestoreHost, save: RunSaveDataV3): void {
    const { domain, runtime } = save;

    host.pendingResumeSave = null;
    host.runSeed = save.runSeed;
    host.run = {
      ...domain.run,
      runSeed: save.runSeed,
      endlessKills: Math.max(0, Math.floor(domain.run.endlessKills ?? 0))
    };
    host.syncEndlessMutators(host.time.now);
    host.dailyPracticeMode =
      host.run.runMode === "daily" && host.run.dailyDate !== undefined
        ? !canStartDailyScoredAttempt(host.meta, host.run.dailyDate)
        : false;
    host.dailyFixedWeaponType = host.run.runMode === "daily" ? host.resolveDailyWeaponType(save.runSeed) : null;
    host.selectedDifficulty = normalizeDifficultyMode(domain.run.difficulty, "normal");
    host.runEnded = false;
    host.lastDeathReason = "Unknown cause.";
    host.manualMoveTarget = null;
    host.manualMoveTargetFailures = 0;
    host.nextManualPathReplanAt = 0;
    host.nextKeyboardMoveInputAt = 0;
    host.dodgeRuntimeState = createInitialDodgeRuntimeState();
    host.entityLabelById.clear();
    host.newlyAcquiredItemUntilMs.clear();
    host.previousSkillCooldownLeftById.clear();
    host.skillReadyFlashUntilMsById.clear();
    host.statHighlightEntries = [];
    host.levelUpPulseUntilMs = 0;
    host.levelUpPulseLevel = null;
    host.nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
    host.lastAiNearCount = 0;
    host.lastAiFarCount = 0;
    host.path = [];
    host.blueprintFoundIdsInRun = [...domain.blueprintFoundIdsInRun];
    host.attackTargetId = null;
    host.nextPlayerAttackAt = 0;
    host.nextBossAttackAt = 0;
    host.uiManager.clearLogs();
    host.uiManager.hideDeathOverlay();
    host.uiManager.hideEventPanel();
    host.eventPanelOpen = false;

    host.refreshUnlockSnapshots();
    host.consumables = {
      charges: { ...domain.consumables.charges },
      cooldowns: { ...domain.consumables.cooldowns }
    };
    host.mapRevealActive = runtime.mapRevealActive;
    if (runtime.dodge !== undefined) {
      host.dodgeRuntimeState = {
        ...host.dodgeRuntimeState,
        readyAtMs: host.time.now + Math.max(0, Math.floor(runtime.dodge.cooldownRemainingMs)),
        iframeUntilMs: 0,
        autoTargetSuppressed: runtime.dodge.autoTargetSuppressed,
        lastSuccessfulDodgeAtMs: null,
        lastMoveIntentDirection: null,
        lastFacingDirection:
          runtime.dodge.lastDirection === undefined ? host.dodgeRuntimeState.lastFacingDirection : { ...runtime.dodge.lastDirection },
        lastDodgeDirection:
          runtime.dodge.lastDirection === undefined ? null : { ...runtime.dodge.lastDirection },
        lastDodgeDirectionSource: runtime.dodge.lastDirectionSource ?? null,
        lastResult: runtime.dodge.lastResult ?? null
      };
    }
    host.deferredOutcomes = runtime.deferredOutcomes.map((outcome) => ({
      outcomeId: outcome.outcomeId,
      source: outcome.source,
      trigger:
        outcome.trigger.type === "floor_reached"
          ? {
              type: "floor_reached",
              value: outcome.trigger.value
            }
          : {
              type: outcome.trigger.type
            },
      reward: {
        ...(outcome.reward.obol === undefined ? {} : { obol: outcome.reward.obol }),
        ...(outcome.reward.shard === undefined ? {} : { shard: outcome.reward.shard }),
        ...(outcome.reward.itemDefId === undefined ? {} : { itemDefId: outcome.reward.itemDefId })
      },
      status: outcome.status
    }));
    host.merchantOffers = [];

    host.children.removeAll(true);
    host.entityManager.clear();
    host.hazardRuntimeModule.clearHazards();
    host.progressionRuntimeModule.clearChallengeState();
    host.movementSystem.clearPathCache();

    host.floorConfig = getFloorConfig(host.run.currentFloor, host.run.difficultyModifier);
    host.configureRngStreams(host.run.currentFloor, runtime.rngCursor);
    const currentBiomeId = host.run.currentBiomeId as keyof typeof BIOME_MAP;
    host.currentBiome = BIOME_MAP[currentBiomeId] ?? BIOME_MAP.forgotten_catacombs;
    host.dungeon = {
      ...runtime.dungeon,
      walkable: runtime.dungeon.walkable.map((row) => [...row]),
      rooms: runtime.dungeon.rooms.map((room) => ({ ...room })),
      corridors: runtime.dungeon.corridors.map((corridor) => ({
        ...corridor,
        path: corridor.path.map((point) => ({ ...point }))
      })),
      spawnPoints: runtime.dungeon.spawnPoints.map((point) => ({ ...point })),
      playerSpawn: { ...runtime.dungeon.playerSpawn },
      hiddenRooms: (runtime.dungeon.hiddenRooms ?? []).map((room) => ({
        roomId: room.roomId,
        entrance: { ...room.entrance },
        revealed: room.revealed,
        rewardsClaimed: room.rewardsClaimed
      }))
    };
    const restoredPlayerActiveBuffs = rebuildPersistedBuffs(domain.player.activeBuffs, host.time.now);
    const { activeBuffs: _playerBuffs, ...stablePlayer } = domain.player;
    host.player = host.refreshPlayerStatsFromEquipment({
      ...stablePlayer,
      position: { ...domain.player.position },
      inventory: [...domain.player.inventory],
      equipment: { ...domain.player.equipment },
      ...(restoredPlayerActiveBuffs === undefined ? {} : { activeBuffs: restoredPlayerActiveBuffs })
    });
    host.staircaseState = {
      position: { ...runtime.staircase.position },
      visible: runtime.staircase.visible,
      ...(runtime.staircase.kind === undefined ? {} : { kind: runtime.staircase.kind }),
      ...(runtime.staircase.options === undefined
        ? {}
        : {
            options: [
              {
                ...runtime.staircase.options[0],
                position: { ...runtime.staircase.options[0].position }
              },
              {
                ...runtime.staircase.options[1],
                position: { ...runtime.staircase.options[1].position }
              }
            ]
          }),
      ...(runtime.staircase.selected === undefined ? {} : { selected: runtime.staircase.selected })
    };
  }

  private rebuildDerivedState(host: RunStateRestoreHost, save: RunSaveDataV3): void {
    const { runtime } = save;
    const world = host.renderSystem.computeWorldBounds(host.dungeon);
    host.origin = world.origin;
    host.worldBounds = world.worldBounds;
    host.cameras.main.setBackgroundColor(
      Phaser.Display.Color.IntegerToColor(host.currentBiome.ambientColor).rgba
    );
    const biomeVisualTheme = resolveBiomeVisualTheme(host.currentBiome);
    host.renderSystem.drawDungeon(
      host.dungeon,
      host.origin,
      {
        tileKey: biomeVisualTheme.floorTileKey,
        ...(biomeVisualTheme.tileTint === undefined ? {} : { tintColor: biomeVisualTheme.tileTint }),
        ...(biomeVisualTheme.wallTileKey === undefined ? {} : { wallKey: biomeVisualTheme.wallTileKey }),
        accentColor: biomeVisualTheme.accentColor,
        variantSeed: host.dungeon.layoutHash,
        ...(host.floorConfig.pacingKind === undefined ? {} : { pacingKind: host.floorConfig.pacingKind })
      }
    );
    host.progressionRuntimeModule.renderHiddenRoomMarkers();

    const playerRender = host.renderSystem.spawnPlayer(host.player.position, host.origin);
    host.playerSprite = playerRender.sprite;
    host.playerYOffset = playerRender.yOffset;

    host.hazardRuntimeModule.restoreHazards(runtime.hazards);

    const runtimes = runtime.monsters
      .map((monster) => {
        const archetype = MONSTER_ARCHETYPES.find((entry) => entry.id === monster.state.archetypeId);
        if (archetype === undefined) {
          return null;
        }
        const restoredMonsterActiveBuffs = rebuildPersistedBuffs(monster.state.activeBuffs, host.time.now);
        const { activeBuffs: _monsterBuffs, ...stableMonster } = monster.state;
        const runtimeMonster = host.renderSystem.spawnMonster(
          {
            ...stableMonster,
            position: { ...monster.state.position },
            ...(monster.state.affixes === undefined ? {} : { affixes: [...monster.state.affixes] }),
            ...(restoredMonsterActiveBuffs === undefined ? {} : { activeBuffs: restoredMonsterActiveBuffs })
          },
          archetype,
          host.origin
        );
        runtimeMonster.baseMoveSpeed = resolveSavedMonsterBaseMoveSpeed(archetype.moveSpeed, monster);
        runtimeMonster.state = {
          ...runtimeMonster.state,
          moveSpeed: resolveSavedMonsterMoveSpeed(runtimeMonster.baseMoveSpeed, runtimeMonster.state.activeBuffs)
        };
        runtimeMonster.nextAttackAt = monster.nextAttackAt;
        runtimeMonster.nextSupportAt = monster.nextSupportAt;
        host.entityLabelById.set(runtimeMonster.state.id, archetype.name);
        return runtimeMonster;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    host.entityManager.setMonsters(runtimes);

    for (const drop of runtime.lootOnGround) {
      host.entityManager.addLoot({
        item: {
          ...drop.item,
          rolledAffixes: { ...drop.item.rolledAffixes },
          ...(drop.item.rolledSpecialAffixes === undefined
            ? {}
            : { rolledSpecialAffixes: { ...drop.item.rolledSpecialAffixes } })
        },
        position: { ...drop.position },
        sprite: host.renderSystem.spawnLootSprite(drop.item, drop.position, host.origin)
      });
    }

    if (runtime.boss !== null) {
      const resolvedEncounter =
        runtime.bossEncounterId !== undefined
          ? host.resolveBossEncounterById(runtime.bossEncounterId)
          : host.resolveBossEncounterByBossId(runtime.boss.bossId);
      host.currentBossEncounterId = resolvedEncounter.encounter.id;
      host.replaceBossDef(resolvedEncounter.bossDef);
      const bossState = {
        ...runtime.boss,
        position: { ...runtime.boss.position },
        attackCooldowns: { ...runtime.boss.attackCooldowns }
      };
      host.bossState = bossState;
      host.entityLabelById.set(resolvedEncounter.bossDef.id, resolvedEncounter.bossDef.name);
      host.bossSprite = host.renderSystem.spawnBoss(
        bossState.position,
        host.origin,
        resolvedEncounter.bossDef.spriteKey
      );
      host.entityManager.setBoss({
        state: bossState,
        sprite: host.bossSprite
      });
    } else {
      host.currentBossEncounterId = null;
      host.bossState = null;
      host.bossSprite = null;
      host.entityManager.setBoss(null);
    }

    host.progressionRuntimeModule.renderStaircases();

    host.eventRuntimeModule.destroyEventNode();
    const eventNodeSnapshot = runtime.eventNode;
    if (eventNodeSnapshot !== null) {
      const eventDef = RANDOM_EVENT_DEFS.find((entry) => entry.id === eventNodeSnapshot.eventId);
      if (eventDef !== undefined) {
        host.eventRuntimeModule.createEventNode(eventDef, eventNodeSnapshot.position, host.time.now, {
          emitSpawnEvent: false
        });
        if (host.eventNode !== null) {
          host.eventNode.resolved = eventNodeSnapshot.resolved;
        }
        host.merchantOffers = eventNodeSnapshot.merchantOffers?.map((offer) => ({ ...offer })) ?? [];
        if (eventNodeSnapshot.resolved) {
          host.eventRuntimeModule.consumeCurrentEvent();
        }
      }
    }
    host.progressionRuntimeModule.restoreChallengeRoom(host.time.now);
  }

  private bootstrapSessionState(host: RunStateRestoreHost, save: RunSaveDataV3): void {
    const { domain, runtime, session } = save;
    if (typeof host.restorePowerSpikeBudgetState === "function") {
      host.restorePowerSpikeBudgetState(runtime.powerSpikeBudgetState);
    }
    if (typeof host.restorePhase6TelemetryState === "function") {
      host.restorePhase6TelemetryState(runtime.phase6TelemetryState);
    }

    host.renderSystem.configureCamera(host.cameras.main, host.worldBounds, host.playerSprite);
    host.uiManager.configureMinimap({
      width: host.dungeon.width,
      height: host.dungeon.height,
      walkable: host.dungeon.walkable,
      layoutHash: host.dungeon.layoutHash
    });
    host.uiManager.resetMinimap();
    host.uiManager.restoreMinimap(runtime.minimap);
    host.lastMinimapRefreshAt = 0;
    host.updateMinimap(host.time.now);
    host.sfxSystem.playAmbientForBiome(host.currentBiome.id);

    host.hudDirty = true;
    host.resumedFromSave = true;
    host.lastAutoSaveAt = host.time.now;
    const restoredSelectionCandidate = domain.selectedMutationIds ?? host.meta.selectedMutationIds;
    const unlockedMutationIds = collectUnlockedMutationIds(host.meta, MUTATION_DEFS);
    const selectionValidation = validateMutationSelection(
      restoredSelectionCandidate,
      MUTATION_DEF_BY_ID,
      host.meta.mutationSlots,
      unlockedMutationIds
    );
    host.resetMutationRuntimeState(
      selectionValidation.ok ? selectionValidation.selected : host.meta.selectedMutationIds
    );
    host.refreshSynergyRuntime(false, {
      emitActivationEvents: false,
      recordTelemetry: false
    });
    if (typeof host.restoreFloorChoiceBudgetSnapshot === "function") {
      host.restoreFloorChoiceBudgetSnapshot(runtime.floorChoiceBudget, host.time.now);
    } else {
      host.resetFloorChoiceBudget(host.run.currentFloor, host.time.now);
    }
    if (typeof host.restoreProgressionPromptState === "function") {
      host.restoreProgressionPromptState(session.progressionPromptState, host.time.now);
    }
    if (typeof host.restoreComparePromptState === "function") {
      host.restoreComparePromptState(session.comparePromptState);
    }
  }
}
