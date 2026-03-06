import {
  buildMutationDefMap,
  canStartDailyScoredAttempt,
  collectUnlockedMutationIds,
  normalizeDifficultyMode,
  validateMutationSelection,
  type RunSaveDataV2
} from "@blodex/core";
import Phaser from "phaser";
import {
  BIOME_MAP,
  MUTATION_DEFS,
  MUTATION_DEF_MAP,
  MONSTER_ARCHETYPES,
  RANDOM_EVENT_DEFS,
  getFloorConfig
} from "@blodex/content";
import { resolveBiomeVisualTheme } from "../presentation/BiomeVisualThemeRegistry";
import type { RunStateRestoreHost } from "./savePorts";
const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);

export interface RunStateRestorerOptions {
  host: RunStateRestoreHost;
}

export class RunStateRestorer {
  constructor(private readonly options: RunStateRestorerOptions) {}

  restore(save: RunSaveDataV2): boolean {
    const host = this.options.host;
    try {
      host.pendingResumeSave = null;
      host.runSeed = save.runSeed;
      host.run = {
        ...save.run,
        runSeed: save.runSeed,
        endlessKills: Math.max(0, Math.floor(save.run.endlessKills ?? 0))
      };
      host.syncEndlessMutators(host.time.now);
      host.dailyPracticeMode =
        host.run.runMode === "daily" && host.run.dailyDate !== undefined
          ? !canStartDailyScoredAttempt(host.meta, host.run.dailyDate)
          : false;
      host.dailyFixedWeaponType = host.run.runMode === "daily" ? host.resolveDailyWeaponType(save.runSeed) : null;
      host.selectedDifficulty = normalizeDifficultyMode(save.run.difficulty, "normal");
      host.runEnded = false;
      host.lastDeathReason = "Unknown cause.";
      host.manualMoveTarget = null;
      host.manualMoveTargetFailures = 0;
      host.nextManualPathReplanAt = 0;
      host.nextKeyboardMoveInputAt = 0;
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
      host.blueprintFoundIdsInRun = [...(save.blueprintFoundIdsInRun ?? [])];
      host.attackTargetId = null;
      host.nextPlayerAttackAt = 0;
      host.nextBossAttackAt = 0;
      host.uiManager.clearLogs();
      host.uiManager.hideDeathOverlay();
      host.uiManager.hideEventPanel();
      host.eventPanelOpen = false;

      host.refreshUnlockSnapshots();
      host.consumables = {
        charges: { ...save.consumables.charges },
        cooldowns: { ...save.consumables.cooldowns }
      };
      host.mapRevealActive = save.mapRevealActive;
      host.deferredOutcomes = (save.deferredOutcomes ?? []).map((outcome) => ({
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
      host.configureRngStreams(host.run.currentFloor, save.rngCursor);
      const currentBiomeId = host.run.currentBiomeId as keyof typeof BIOME_MAP;
      host.currentBiome = BIOME_MAP[currentBiomeId] ?? BIOME_MAP.forgotten_catacombs;
      host.dungeon = {
        ...save.dungeon,
        walkable: save.dungeon.walkable.map((row) => [...row]),
        rooms: save.dungeon.rooms.map((room) => ({ ...room })),
        corridors: save.dungeon.corridors.map((corridor) => ({
          ...corridor,
          path: corridor.path.map((point) => ({ ...point }))
        })),
        spawnPoints: save.dungeon.spawnPoints.map((point) => ({ ...point })),
        playerSpawn: { ...save.dungeon.playerSpawn },
        hiddenRooms: (save.dungeon.hiddenRooms ?? []).map((room) => ({
          roomId: room.roomId,
          entrance: { ...room.entrance },
          revealed: room.revealed,
          rewardsClaimed: room.rewardsClaimed
        }))
      };
      host.player = host.refreshPlayerStatsFromEquipment({
        ...save.player,
        position: { ...save.player.position },
        inventory: [...save.player.inventory],
        equipment: { ...save.player.equipment }
      });
      host.staircaseState = {
        position: { ...save.staircase.position },
        visible: save.staircase.visible,
        ...(save.staircase.kind === undefined ? {} : { kind: save.staircase.kind }),
        ...(save.staircase.options === undefined
          ? {}
          : {
              options: [
                {
                  ...save.staircase.options[0],
                  position: { ...save.staircase.options[0].position }
                },
                {
                  ...save.staircase.options[1],
                  position: { ...save.staircase.options[1].position }
                }
              ]
            }),
        ...(save.staircase.selected === undefined ? {} : { selected: save.staircase.selected })
      };

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
        biomeVisualTheme.tileTint === undefined
          ? {
              tileKey: biomeVisualTheme.floorTileKey
            }
          : {
              tileKey: biomeVisualTheme.floorTileKey,
              tintColor: biomeVisualTheme.tileTint
            }
      );
      host.progressionRuntimeModule.renderHiddenRoomMarkers();

      const playerRender = host.renderSystem.spawnPlayer(host.player.position, host.origin);
      host.playerSprite = playerRender.sprite;
      host.playerYOffset = playerRender.yOffset;

      host.hazardRuntimeModule.restoreHazards(save.hazards);

      const runtimes = save.monsters
        .map((monster) => {
          const archetype = MONSTER_ARCHETYPES.find((entry) => entry.id === monster.state.archetypeId);
          if (archetype === undefined) {
            return null;
          }
          const runtime = host.renderSystem.spawnMonster(
            {
              ...monster.state,
              position: { ...monster.state.position },
              ...(monster.state.affixes === undefined ? {} : { affixes: [...monster.state.affixes] })
            },
            archetype,
            host.origin
          );
          runtime.nextAttackAt = monster.nextAttackAt;
          runtime.nextSupportAt = monster.nextSupportAt;
          host.entityLabelById.set(runtime.state.id, archetype.name);
          return runtime;
        })
        .filter((entry): entry is ReturnType<typeof host.renderSystem.spawnMonster> => entry !== null);
      host.entityManager.setMonsters(runtimes);

      for (const drop of save.lootOnGround) {
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

      if (save.boss !== null) {
        host.bossState = {
          ...save.boss,
          position: { ...save.boss.position },
          attackCooldowns: { ...save.boss.attackCooldowns }
        };
        host.entityLabelById.set(host.bossDef.id, host.bossDef.name);
        host.bossSprite = host.renderSystem.spawnBoss(host.bossState.position, host.origin, host.bossDef.spriteKey);
        host.entityManager.setBoss({
          state: host.bossState,
          sprite: host.bossSprite
        });
      } else {
        host.bossState = null;
        host.bossSprite = null;
        host.entityManager.setBoss(null);
      }

      host.progressionRuntimeModule.renderStaircases();

      host.eventRuntimeModule.destroyEventNode();
      const eventNodeSnapshot = save.eventNode;
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
      if (typeof host.restorePhase6TelemetryState === "function") {
        host.restorePhase6TelemetryState(save.phase6TelemetryState);
      }

      host.renderSystem.configureCamera(host.cameras.main, host.worldBounds, host.playerSprite);
      host.uiManager.configureMinimap({
        width: host.dungeon.width,
        height: host.dungeon.height,
        walkable: host.dungeon.walkable,
        layoutHash: host.dungeon.layoutHash
      });
      host.uiManager.resetMinimap();
      host.uiManager.restoreMinimap(save.minimap);
      host.lastMinimapRefreshAt = 0;
      host.updateMinimap(host.time.now);
      host.sfxSystem.playAmbientForBiome(host.currentBiome.id);

      host.hudDirty = true;
      host.resumedFromSave = true;
      host.lastAutoSaveAt = host.time.now;
      const restoredSelectionCandidate = save.selectedMutationIds ?? host.meta.selectedMutationIds;
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
        host.restoreFloorChoiceBudgetSnapshot(save.floorChoiceBudget, host.time.now);
      } else {
        host.resetFloorChoiceBudget(host.run.currentFloor, host.time.now);
      }
      return true;
    } catch (error) {
      console.warn("[Save] Failed to restore run snapshot.", error);
      return false;
    }
  }
}
