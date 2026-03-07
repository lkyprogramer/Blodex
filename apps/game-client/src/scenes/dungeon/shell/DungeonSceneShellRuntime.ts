import Phaser from "phaser";
import {
  canEquip,
  equipItem,
  normalizeDifficultyMode,
  type MetaProgression,
  type RunSaveDataV2,
  type ConsumableId,
  type DifficultyMode,
  type EquipmentSlot,
  type ItemInstance,
  type PlayerState
} from "@blodex/core";
import { t } from "../../../i18n";
import type { MessageParams } from "../../../i18n/types";
import { playSceneTransition } from "../../../ui/SceneTransitionOverlay";
import { UIManager } from "../../../ui/UIManager";
import { BossRuntimeModule } from "../encounter/BossRuntimeModule";
import { BossCombatService } from "../encounter/BossCombatService";
import { BossSpawnService } from "../encounter/BossSpawnService";
import { BossTelegraphPresenter } from "../encounter/BossTelegraphPresenter";
import { EncounterController } from "../encounter/EncounterController";
import { PlayerActionModule } from "../encounter/PlayerActionModule";
import { RunCompletionModule } from "../run/RunCompletionModule";
import { resolveInitialRunSeed } from "../run/resolveInitialRunSeed";
import { RunPersistenceModule } from "../save/RunPersistenceModule";
import { RunSaveSnapshotBuilder } from "../save/RunSaveSnapshotBuilder";
import { RunStateRestorer } from "../save/RunStateRestorer";
import { SaveCoordinator } from "../save/SaveCoordinator";
import { SaveManager } from "../../../systems/SaveManager";
import { EventResolutionService } from "../world/EventResolutionService";
import { EventRuntimeModule } from "../world/EventRuntimeModule";
import { FloorProgressionModule } from "../world/FloorProgressionModule";
import { MerchantFlowService } from "../world/MerchantFlowService";
import { ProgressionRuntimeModule } from "../world/ProgressionRuntimeModule";
import { HazardRuntimeModule } from "../world/HazardRuntimeModule";
import { WorldEventController } from "../world/WorldEventController";
import { DebugApiBinder } from "../debug/DebugApiBinder";
import { DebugCommandRegistry } from "../debug/DebugCommandRegistry";
import { DebugRuntimeModule } from "../debug/DebugRuntimeModule";
import { bindDomainEventEffects, type DomainEventEffectHost } from "../logging/DomainEventEffectBinder";
import type { LogLevel } from "../../../ui/Hud";
import type { DungeonScene } from "../../DungeonScene";
import {
  createBossCombatHost,
  createBossRuntimeHost,
  createBossSpawnHost,
  createBossTelegraphHost,
  createDomainEventEffectHost,
  createFloorProgressionHost,
  createHazardRuntimeHost,
  createPlayerActionHost,
  createProgressionRuntimeHost
  ,
  createRunCompletionHost,
  createRuntimeEventHost,
  type DungeonSceneHostBridge
} from "../dungeonSceneHostFactories";

export interface DungeonSceneShellSource {
  cleanupStarted: boolean;
  preserveSceneTransitionOnCleanup: boolean;
  debugCheatsEnabled: boolean;
  diagnosticsEnabled: boolean;
  meta: MetaProgression;
  pendingResumeSave: RunSaveDataV2 | null;
  selectedDifficulty: DifficultyMode;
  player: PlayerState;
  uiManager: Pick<UIManager, "appendLog" | "reset" | "clearLogs" | "hideEventPanel" | "hideDeathOverlay">;
  saveCoordinator: SaveCoordinator;
  runPersistenceModule: RunPersistenceModule;
  eventRuntimeModule: EventRuntimeModule;
  bossRuntimeModule: BossRuntimeModule;
  runCompletionModule: RunCompletionModule;
  hazardRuntimeModule: HazardRuntimeModule;
  progressionRuntimeModule: ProgressionRuntimeModule;
  floorProgressionModule: FloorProgressionModule;
  playerActionModule: PlayerActionModule;
  encounterController: EncounterController;
  worldEventController: WorldEventController;
  debugRuntimeModule: DebugRuntimeModule;
  combatRuntime: {
    updateCombat(nowMs: number): void;
    updateMonsters(deltaSeconds: number, nowMs: number): void;
    updateMonsterCombat(nowMs: number): void;
    collectNearbyLoot(nowMs: number): void;
  };
  metaRuntime: {
    loadMeta(): MetaProgression;
    refreshTalentEffects(): void;
    resolveSelectedDifficultyForRun(): DifficultyMode;
  };
  runEnded: boolean;
  pendingRunSeed: string | undefined;
  lastAutoSaveAt: number;
  hudDirty: boolean;
  time: { now: number };
  runLog: {
    appendKey(key: string, params?: MessageParams, level?: LogLevel, timestampMs?: number): void;
    setSink(sink: { append: (message: string, level: LogLevel, timestampMs: number) => void }): void;
  };
  eventBus: {
    emit(event: string, payload: unknown): void;
  };
  dungeonSceneHostBridge: DungeonSceneHostBridge;
  sfxSystem: {
    setEnabled(enabled: boolean): void;
    initialize(): void;
    stopAmbient(): void;
  };
  vfxSystem: {
    setEnabled(enabled: boolean): void;
  };
  saveManager: SaveManager;
  runSaveSnapshotBuilder: RunSaveSnapshotBuilder;
  runStateRestorer: RunStateRestorer;
  debugApiBinder: DebugApiBinder;
  debugCommandRegistry: DebugCommandRegistry;
  contentLocalizer: {
    itemName(id: string, fallback: string): string;
  };
  resolveLocalePreference(): void;
  normalizeMetaForPhase4B(): void;
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
  registerStatDeltaHighlights(beforeStats: PlayerState["derivedStats"], afterStats: PlayerState["derivedStats"], nowMs: number): void;
  refreshSynergyRuntime(): void;
  scheduleRunSave(): void;
  tryUseConsumable(consumableId: ConsumableId): void;
  updateMinimap(nowMs: number): void;
  applyRuntimeBackgroundRemoval(): void;
  initDiagnosticsPanel(): void;
  bootstrapRun(runSeed: string, difficulty: DifficultyMode): void;
  flushRunSave(): void;
  renderDiagnosticsPanel(nowMs: number): void;
  handlePointerDown(pointer: Phaser.Input.Pointer): void;
  inputRuntime: {
    clearKeyboardBindings(): void;
    bindSkillKeys(): void;
    bindMovementKeys(): void;
  };
  cleanupScene(): void;
}

function createUiManager(scene: DungeonScene, source: DungeonSceneShellSource): UIManager {
  return new UIManager(
    (itemId) => {
      const item = source.player.inventory.find((candidate) => candidate.id === itemId);
      if (item === undefined) {
        source.runLog.appendKey("log.item.equip_failed_missing", { itemId }, "warn", source.time.now);
        return;
      }

      if (!canEquip(source.player, item)) {
        source.runLog.appendKey(
          "log.item.equip_failed_locked",
          {
            itemName: source.contentLocalizer.itemName(item.defId, item.name),
            requiredLevel: item.requiredLevel,
            currentLevel: source.player.level
          },
          "warn",
          source.time.now
        );
        return;
      }

      const previousStats = source.player.derivedStats;
      source.player = source.refreshPlayerStatsFromEquipment(equipItem(source.player, itemId));
      const equipped = source.player.equipment[item.slot];
      if (equipped?.id === item.id) {
        source.registerStatDeltaHighlights(previousStats, source.player.derivedStats, source.time.now);
        source.refreshSynergyRuntime();
        source.hudDirty = true;
        source.scheduleRunSave();
        source.eventBus.emit("item:equip", {
          playerId: source.player.id,
          slot: item.slot,
          item: equipped,
          timestampMs: source.time.now
        });
        return;
      }

      source.runLog.appendKey(
        "log.item.equip_failed_generic",
        {
          itemName: source.contentLocalizer.itemName(item.defId, item.name)
        },
        "warn",
        source.time.now
      );
    },
    (slot) => {
      const equipped = source.player.equipment[slot];
      const unequippedPlayer: PlayerState = {
        ...source.player,
        inventory: equipped === undefined ? source.player.inventory : [...source.player.inventory, equipped],
        equipment: {
          ...source.player.equipment,
          [slot]: undefined
        }
      };
      const previousStats = source.player.derivedStats;
      source.player = source.refreshPlayerStatsFromEquipment(unequippedPlayer);
      if (equipped !== undefined) {
        source.registerStatDeltaHighlights(previousStats, source.player.derivedStats, source.time.now);
        source.refreshSynergyRuntime();
        source.hudDirty = true;
        source.scheduleRunSave();
        source.eventBus.emit("item:unequip", {
          playerId: source.player.id,
          slot,
          item: equipped,
          timestampMs: source.time.now
        });
      }
    },
    (itemId) => {
      const item = source.player.inventory.find((candidate) => candidate.id === itemId);
      if (item === undefined) {
        source.runLog.appendKey("log.item.discard_failed_missing", { itemId }, "warn", source.time.now);
        return;
      }
      source.player = {
        ...source.player,
        inventory: source.player.inventory.filter((candidate) => candidate.id !== itemId)
      };
      source.hudDirty = true;
      source.runLog.appendKey(
        "log.item.discarded",
        {
          itemName: source.contentLocalizer.itemName(item.defId, item.name)
        },
        "info",
        source.time.now
      );
    },
    (consumableId) => {
      source.tryUseConsumable(consumableId);
    },
    () => {
      source.preserveSceneTransitionOnCleanup = true;
      playSceneTransition({
        title: t("ui.transition.return_sanctum.title"),
        subtitle: t("ui.transition.return_sanctum.subtitle"),
        mode: "scene",
        durationMs: 520
      });
      source.uiManager.reset();
      source.sfxSystem.stopAmbient();
      scene.scene.start("meta-menu");
    }
  );
}

export function initializeDungeonSceneShell(scene: DungeonScene): void {
  const source = scene.createShellRuntimeSource();
  source.cleanupStarted = false;
  source.preserveSceneTransitionOnCleanup = false;
  scene.cameras.main.setBackgroundColor("#11161d");
  source.meta = source.metaRuntime.loadMeta();
  source.resolveLocalePreference();
  source.normalizeMetaForPhase4B();
  source.metaRuntime.refreshTalentEffects();
  source.selectedDifficulty =
    source.pendingResumeSave === null
      ? source.metaRuntime.resolveSelectedDifficultyForRun()
      : normalizeDifficultyMode(source.pendingResumeSave.run.difficulty, "normal");

  source.uiManager = createUiManager(scene, source);
  source.runLog.setSink({
    append: (message, level, timestampMs) => {
      source.uiManager.appendLog(message, level, timestampMs);
    }
  });
  source.saveCoordinator = new SaveCoordinator({
    saveManager: source.saveManager,
    isRunEnded: () => source.runEnded,
    buildSnapshot: () => source.runPersistenceModule.buildSnapshot(source.time.now)
  });
  source.runPersistenceModule = new RunPersistenceModule({
    saveCoordinator: source.saveCoordinator,
    snapshotBuilder: source.runSaveSnapshotBuilder,
    stateRestorer: source.runStateRestorer,
    nowMs: () => source.time.now,
    onFlush: (nowMs) => {
      source.lastAutoSaveAt = nowMs;
    }
  });

  const eventResolutionService = new EventResolutionService({
    host: createRuntimeEventHost(source.dungeonSceneHostBridge)
  });
  const merchantFlowService = new MerchantFlowService({
    host: createRuntimeEventHost(source.dungeonSceneHostBridge)
  });
  source.eventRuntimeModule = new EventRuntimeModule({
    host: createRuntimeEventHost(source.dungeonSceneHostBridge),
    resolutionService: eventResolutionService,
    merchantFlowService
  });

  const bossSpawnService = new BossSpawnService({
    host: createBossSpawnHost(source.dungeonSceneHostBridge)
  });
  const bossTelegraphPresenter = new BossTelegraphPresenter({
    host: createBossTelegraphHost(source.dungeonSceneHostBridge)
  });
  const bossCombatService = new BossCombatService({
    host: createBossCombatHost(source.dungeonSceneHostBridge),
    spawnService: bossSpawnService,
    telegraphPresenter: bossTelegraphPresenter
  });
  source.bossRuntimeModule = new BossRuntimeModule({
    host: createBossRuntimeHost(source.dungeonSceneHostBridge),
    combatService: bossCombatService,
    spawnService: bossSpawnService
  });
  source.runCompletionModule = new RunCompletionModule({
    host: createRunCompletionHost(source.dungeonSceneHostBridge)
  });
  source.hazardRuntimeModule = new HazardRuntimeModule({
    host: createHazardRuntimeHost(source.dungeonSceneHostBridge)
  });
  source.progressionRuntimeModule = new ProgressionRuntimeModule({
    host: createProgressionRuntimeHost(source.dungeonSceneHostBridge)
  });
  source.floorProgressionModule = new FloorProgressionModule({
    host: createFloorProgressionHost(source.dungeonSceneHostBridge)
  });
  source.playerActionModule = new PlayerActionModule({
    host: createPlayerActionHost(source.dungeonSceneHostBridge)
  });
  source.encounterController = new EncounterController({
    updateCombat: (nowMs: number) => source.combatRuntime.updateCombat(nowMs),
    updateMonsters: (deltaSeconds: number, nowMs: number) => source.combatRuntime.updateMonsters(deltaSeconds, nowMs),
    updateMonsterCombat: (nowMs: number) => source.combatRuntime.updateMonsterCombat(nowMs),
    updateBossCombat: (nowMs: number) => source.bossRuntimeModule.updateCombat(nowMs),
    updateChallengeRoom: (nowMs: number) => source.progressionRuntimeModule.updateChallengeRoom(nowMs)
  });
  source.worldEventController = new WorldEventController({
    updateHazards: (nowMs: number) => source.hazardRuntimeModule.updateHazards(nowMs),
    collectNearbyLoot: (nowMs: number) => source.combatRuntime.collectNearbyLoot(nowMs),
    updateEventInteraction: (nowMs: number) => source.eventRuntimeModule.updateInteraction(nowMs),
    updateFloorProgress: (nowMs: number) => source.floorProgressionModule.update(nowMs),
    updateMinimap: (nowMs: number) => source.updateMinimap(nowMs)
  });
  source.debugRuntimeModule = new DebugRuntimeModule({
    debugApiBinder: source.debugApiBinder,
    commandRegistry: source.debugCommandRegistry,
    isDebugEnabled: () => source.debugCheatsEnabled,
    onResetRun: () => source.runCompletionModule.resetRun()
  });

  source.debugRuntimeModule.install();
  source.applyRuntimeBackgroundRemoval();
  source.sfxSystem.initialize();
  source.uiManager.hideDeathOverlay();
  source.uiManager.clearLogs();
  source.uiManager.hideEventPanel();
  source.initDiagnosticsPanel();
  bindDomainEventEffects(createDomainEventEffectHost(source.dungeonSceneHostBridge));
  source.inputRuntime.clearKeyboardBindings();
  source.saveCoordinator.bindPageLifecycle();
  if (source.pendingResumeSave !== null && source.runPersistenceModule.restore(source.pendingResumeSave)) {
    source.saveCoordinator.startHeartbeat();
    source.runLog.appendKey("log.run.resumed_saved", undefined, "info", source.time.now);
    source.flushRunSave();
  } else {
    source.bootstrapRun(resolveInitialRunSeed(source.pendingRunSeed), source.selectedDifficulty);
    source.saveCoordinator.startHeartbeat();
    source.flushRunSave();
  }
  source.pendingResumeSave = null;
  source.renderDiagnosticsPanel(source.time.now);

  scene.input.on("pointerdown", source.handlePointerDown, scene);
  source.inputRuntime.bindSkillKeys();
  source.inputRuntime.bindMovementKeys();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => source.cleanupScene());
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => source.cleanupScene());
  source.hudDirty = true;
}
