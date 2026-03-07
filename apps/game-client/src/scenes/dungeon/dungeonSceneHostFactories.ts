import type { DebugCommandHost } from "./debug/ports";
import type { HeartbeatFeedbackRuntimeHost } from "./feedback/HeartbeatFeedbackRuntime";
import type { BossRuntimeHost } from "./encounter/BossRuntimeModule";
import type { BossCombatHost, BossSpawnHost, BossTelegraphHost } from "./encounter/ports";
import type { PlayerActionHost } from "./encounter/PlayerActionModule";
import type { DomainEventEffectHost } from "./logging/DomainEventEffectBinder";
import type { RunCompletionHost } from "./run/RunCompletionModule";
import type { RunSaveSnapshotHost, RunStateRestoreHost } from "./save/savePorts";
import type { ProgressionChoiceHost } from "./progression/ProgressionChoiceRuntime";
import type { PowerSpikeRuntimeHost } from "./taste/PowerSpikeRuntimeModule";
import type { DeferredOutcomeHost, HazardRuntimeHost, ProgressionRuntimeHost, RuntimeEventHost } from "./world/types";
import type { FloorProgressionHost } from "./world/FloorProgressionModule";
import type { DungeonCombatSource } from "./shell/DungeonCombatRuntime";
import type { DungeonFrameSource } from "./shell/DungeonFrameRuntime";
import type { DungeonHudSource } from "./shell/DungeonHudRuntime";
import type { DungeonInputSource } from "./shell/DungeonInputRuntime";
import type { DungeonMetaSource } from "./shell/DungeonMetaRuntime";
import type { DungeonSessionSource } from "./shell/DungeonSessionFacade";

export type DungeonSceneHostBridge =
  & PowerSpikeRuntimeHost
  & HeartbeatFeedbackRuntimeHost
  & RunSaveSnapshotHost
  & RunStateRestoreHost
  & HazardRuntimeHost
  & ProgressionRuntimeHost
  & DeferredOutcomeHost
  & BossSpawnHost
  & BossTelegraphHost
  & BossCombatHost
  & DebugCommandHost
  & RuntimeEventHost
  & BossRuntimeHost
  & RunCompletionHost
  & FloorProgressionHost
  & PlayerActionHost
  & DomainEventEffectHost
  & DungeonFrameSource
  & DungeonHudSource
  & DungeonInputSource
  & DungeonCombatSource
  & DungeonMetaSource
  & DungeonSessionSource;

export interface ReadonlyHostField<T> {
  read(): T;
}

export interface MutableHostField<T> extends ReadonlyHostField<T> {
  write(value: T): void;
}

export function readonlyHostField<T>(read: () => T): ReadonlyHostField<T> {
  return { read };
}

export function mutableHostField<T>(read: () => T, write: (value: T) => void): MutableHostField<T> {
  return { read, write };
}

const MUTABLE_KEYS = [
  "runSeed",
  "run",
  "player",
  "staircaseState",
  "origin",
  "hudDirty",
  "eventPanelOpen",
  "comparePromptOpen",
  "runEnded",
  "consumables",
  "dungeon",
  "hazards",
  "bossState",
  "merchantOffers",
  "mapRevealActive",
  "blueprintFoundIdsInRun",
  "deferredOutcomes",
  "pendingResumeSave",
  "dailyPracticeMode",
  "pendingRunMode",
  "dailyFixedWeaponType",
  "pendingDifficulty",
  "selectedDifficulty",
  "pendingDailyDate",
  "pendingDailyPractice",
  "pendingRunSeed",
  "lastDeathReason",
  "manualMoveTarget",
  "manualMoveTargetFailures",
  "nextManualPathReplanAt",
  "nextKeyboardMoveInputAt",
  "cursorKeys",
  "statHighlightEntries",
  "levelUpPulseUntilMs",
  "levelUpPulseLevel",
  "nextTransientHudRefreshAt",
  "lastAiNearCount",
  "lastAiFarCount",
  "aiFrameCounter",
  "path",
  "attackTargetId",
  "nextPlayerAttackAt",
  "nextBossAttackAt",
  "floorConfig",
  "currentBiome",
  "worldBounds",
  "playerSprite",
  "playerYOffset",
  "bossSprite",
  "resumedFromSave",
  "lastAutoSaveAt",
  "lastMinimapRefreshAt",
  "nearDeathWindowArmedAtMs",
  "nearDeathFeedbackCooldownUntilMs",
  "hazardVisuals",
  "challengeMarker",
  "challengeRoomState",
  "challengeWaveTotal"
] as const satisfies ReadonlyArray<keyof DungeonSceneHostBridge>;

const READONLY_KEYS = [
  "bossDef",
  "lootRng",
  "eventBus",
  "renderSystem",
  "entityManager",
  "tasteRuntime",
  "phase6Telemetry",
  "contentLocalizer",
  "runLog",
  "uiManager",
  "hudPresenter",
  "eventNode",
  "mutationRuntime",
  "saveManager",
  "spawnRng",
  "combatRng",
  "skillRng",
  "bossRng",
  "biomeRng",
  "hazardRng",
  "eventRng",
  "merchantRng",
  "entityLabelById",
  "newlyAcquiredItemUntilMs",
  "previousSkillCooldownLeftById",
  "skillReadyFlashUntilMsById",
  "time",
  "meta",
  "children",
  "cameras",
  "hazardRuntimeModule",
  "progressionRuntimeModule",
  "progressionChoiceRuntime",
  "playerActionModule",
  "encounterController",
  "worldEventController",
  "movementSystem",
  "combatRuntime",
  "combatSystem",
  "aiSystem",
  "eventRuntimeModule",
  "feedbackRouter",
  "sfxSystem",
  "vfxSystem",
  "powerSpikeRuntimeModule",
  "heartbeatFeedbackRuntime",
  "input",
  "keyboardBindings",
  "playerHazardContact",
  "unlockedBiomeIds",
  "unlockedWeaponTypes",
  "debugCheatsEnabled",
  "debugLockedEquipQuery",
  "debugLockedEquipIconId",
  "bossRuntimeModule",
  "debugRuntimeModule",
  "metaRuntime",
  "talentEffects",
  "unlockedAffixIds",
  "hiddenEntranceMarkers",
  "challengeMonsterIds",
  "add",
  "tileWidth",
  "tileHeight",
  "entityDepthOffset",
  "tweens",
  "runCompletionModule",
  "deferredOutcomeRuntime",
  "synergyRuntime",
  "unlockedEventIds",
  "saveCoordinator"
] as const satisfies ReadonlyArray<keyof DungeonSceneHostBridge>;

const METHOD_KEYS = [
  "markHighValueChoice",
  "resolveProgressionLootTable",
  "resolveLootRollOptions",
  "isItemDefUnlocked",
  "routeFeedback",
  "captureFloorChoiceBudgetSnapshot",
  "captureProgressionPromptState",
  "capturePowerSpikeBudgetState",
  "capturePhase6TelemetryState",
  "syncEndlessMutators",
  "resolveDailyWeaponType",
  "refreshUnlockSnapshots",
  "configureRngStreams",
  "refreshPlayerStatsFromEquipment",
  "restorePhase6TelemetryState",
  "updateMinimap",
  "resetMutationRuntimeState",
  "refreshSynergyRuntime",
  "restoreFloorChoiceBudgetSnapshot",
  "restoreProgressionPromptState",
  "restorePowerSpikeBudgetState",
  "resetFloorChoiceBudget",
  "applyOnKillMutationEffects",
  "resolveMutationDropBonus",
  "applyDailyLoadout",
  "spawnMonsters",
  "spawnLootDrop",
  "tryDiscoverBlueprints",
  "scheduleRunSave",
  "resolveHiddenRoomRevealRadius",
  "resolveMutationAttackSpeedMultiplier",
  "emitCombatEvents",
  "collectDiagnosticsSnapshot",
  "bootstrapRun",
  "pickFloorEventPosition",
  "flushRunSave",
  "getRunRelativeNowMs",
  "handleLevelUpGain"
  ,"grantStoryBossReward"
  ,"flushBossRewardComparePrompts"
  ,"describeItem"
  ,"recordBossRewardClosed"
  ,"saveMeta"
  ,"renderHud"
  ,"capturePhase6TelemetrySummary"
  ,"resolveRunRecommendations"
  ,"grantFloorPairFallbackReward"
  ,"ensureFloorChoiceBudget"
  ,"resolveRuntimeSkillDef"
  ,"spawnSplitChildren"
  ,"collectMutationEffects"
  ,"recordPlayerInput"
  ,"recordSkillResolutionTelemetry"
  ,"applyResolvedBuffs"
  ,"resolveEntityLabel"
  ,"flushQueuedComparePrompts"
  ,"recordAcquiredItemTelemetry"
] as const satisfies ReadonlyArray<keyof DungeonSceneHostBridge>;

type MutableKey = (typeof MUTABLE_KEYS)[number];
type ReadonlyKey = (typeof READONLY_KEYS)[number];
type MethodKey = (typeof METHOD_KEYS)[number];

export type DungeonSceneHostBridgeSource =
  & { [K in MutableKey]: MutableHostField<DungeonSceneHostBridge[K]> }
  & { [K in ReadonlyKey]: ReadonlyHostField<DungeonSceneHostBridge[K]> }
  & Pick<DungeonSceneHostBridge, MethodKey>;

function bindReadonly<K extends ReadonlyKey>(
  target: Partial<DungeonSceneHostBridge>,
  key: K,
  field: ReadonlyHostField<DungeonSceneHostBridge[K]>
): void {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: false,
    get: () => field.read()
  });
}

function bindMutable<K extends MutableKey>(
  target: Partial<DungeonSceneHostBridge>,
  key: K,
  field: MutableHostField<DungeonSceneHostBridge[K]>
): void {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: false,
    get: () => field.read(),
    set: (value: DungeonSceneHostBridge[K]) => {
      field.write(value);
    }
  });
}

function bindMethod<K extends MethodKey>(
  target: Partial<DungeonSceneHostBridge>,
  key: K,
  method: DungeonSceneHostBridge[K]
): void {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: false,
    value: method
  });
}

export function createDungeonSceneHostBridge(source: DungeonSceneHostBridgeSource): DungeonSceneHostBridge {
  const bridge: Partial<DungeonSceneHostBridge> = {};
  for (const key of READONLY_KEYS) {
    bindReadonly(bridge, key, source[key]);
  }
  for (const key of MUTABLE_KEYS) {
    bindMutable(bridge, key, source[key]);
  }
  for (const key of METHOD_KEYS) {
    bindMethod(bridge, key, source[key]);
  }
  return bridge as DungeonSceneHostBridge;
}

export function createHostOverlay<TBase extends object, TExtras extends object>(
  base: TBase,
  extras: TExtras
): TBase & TExtras {
  Object.setPrototypeOf(extras, base);
  return extras as TBase & TExtras;
}

export function createPowerSpikeRuntimeHost(bridge: DungeonSceneHostBridge): PowerSpikeRuntimeHost {
  return bridge;
}

export function createHeartbeatFeedbackHost(bridge: DungeonSceneHostBridge): HeartbeatFeedbackRuntimeHost {
  return bridge;
}

export function createRunSaveSnapshotHost(bridge: DungeonSceneHostBridge): RunSaveSnapshotHost {
  return bridge;
}

export function createRunStateRestoreHost(bridge: DungeonSceneHostBridge): RunStateRestoreHost {
  return bridge;
}

export function createHazardRuntimeHost(bridge: DungeonSceneHostBridge): HazardRuntimeHost {
  return bridge;
}

export function createProgressionRuntimeHost(bridge: DungeonSceneHostBridge): ProgressionRuntimeHost {
  return bridge;
}

export function createDeferredOutcomeHost(bridge: DungeonSceneHostBridge): DeferredOutcomeHost {
  return bridge;
}

export function createBossSpawnHost(bridge: DungeonSceneHostBridge): BossSpawnHost {
  return bridge;
}

export function createBossTelegraphHost(bridge: DungeonSceneHostBridge): BossTelegraphHost {
  return bridge;
}

export function createBossCombatHost(bridge: DungeonSceneHostBridge): BossCombatHost {
  return bridge;
}

export function createDebugCommandHost(bridge: DungeonSceneHostBridge): DebugCommandHost {
  return bridge;
}

export function createRuntimeEventHost(bridge: DungeonSceneHostBridge): RuntimeEventHost {
  return bridge;
}

export function createBossRuntimeHost(bridge: DungeonSceneHostBridge): BossRuntimeHost {
  return bridge;
}

export function createRunCompletionHost(bridge: DungeonSceneHostBridge): RunCompletionHost {
  return bridge;
}

export function createFloorProgressionHost(bridge: DungeonSceneHostBridge): FloorProgressionHost {
  return bridge;
}

export function createPlayerActionHost(bridge: DungeonSceneHostBridge): PlayerActionHost {
  return bridge;
}

export function createDomainEventEffectHost(bridge: DungeonSceneHostBridge): DomainEventEffectHost {
  return bridge;
}

export function createProgressionChoiceHost(
  bridge: DungeonSceneHostBridge,
  extras: Pick<
    ProgressionChoiceHost,
    "playerActionModule" | "registerStatDeltaHighlights" | "recordBuildLevelUpChoice" | "recordPlayerFacingChoice"
  >
): ProgressionChoiceHost {
  return createHostOverlay(bridge, extras);
}
