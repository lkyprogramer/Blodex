import type Phaser from "phaser";
import type {
  BossRuntimeState,
  ConsumableState,
  DeferredOutcomeState,
  DifficultyMode,
  DungeonLayout,
  FloorChoiceBudgetState,
  HazardRuntimeState,
  MerchantOffer,
  MetaProgression,
  Phase6TelemetryRuntimeState,
  PlayerState,
  RunRngStreamName,
  RunSaveDataV2,
  RunState,
  StaircaseState,
  WeaponType
} from "@blodex/core";
import type { BiomeDef, FloorConfig, RandomEventDef } from "@blodex/content";
import type { EntityManager } from "../../../systems/EntityManager";
import type { MovementSystem } from "../../../systems/MovementSystem";
import type { RenderSystem, WorldBoundsConfig } from "../../../systems/RenderSystem";
import type { SaveManager } from "../../../systems/SaveManager";
import type { UIManager } from "../../../ui/UIManager";
import type { HudStatHighlightEntry } from "../../../ui/hud/compare/StatDeltaHighlighter";
import type { EventRuntimeModule } from "../world/EventRuntimeModule";
import type { HazardRuntimeModule } from "../world/HazardRuntimeModule";
import type { ProgressionRuntimeModule } from "../world/ProgressionRuntimeModule";

export interface RunSaveSnapshotRngPort {
  getCursor(): number;
}

export interface RunSaveSnapshotSceneStatePort {
  runEnded: boolean;
  runSeed: string;
  run: RunState | undefined;
  player: PlayerState | undefined;
  consumables: ConsumableState;
  dungeon: DungeonLayout;
  staircaseState: StaircaseState;
  hazards: HazardRuntimeState[];
  bossState: BossRuntimeState | null;
  eventNode:
    | {
        eventDef: Pick<RandomEventDef, "id">;
        position: { x: number; y: number };
        resolved: boolean;
      }
    | null;
  merchantOffers: MerchantOffer[];
  mapRevealActive: boolean;
  blueprintFoundIdsInRun: string[];
  mutationRuntime: {
    activeIds: string[];
  };
  deferredOutcomes: DeferredOutcomeState[];
}

export interface RunSaveSnapshotServicePort {
  uiManager: Pick<UIManager, "getMinimapSnapshot">;
  entityManager: Pick<EntityManager, "listMonsters" | "listLoot">;
  saveManager: Pick<SaveManager, "getTabId">;
}

export interface RunSaveSnapshotHookPort {
  captureFloorChoiceBudgetSnapshot?(): FloorChoiceBudgetState | undefined;
  capturePhase6TelemetryState?(elapsedMs?: number): Phase6TelemetryRuntimeState | undefined;
}

export interface RunSaveSnapshotRngCollectionPort {
  spawnRng?: RunSaveSnapshotRngPort;
  combatRng?: RunSaveSnapshotRngPort;
  lootRng?: RunSaveSnapshotRngPort;
  skillRng?: RunSaveSnapshotRngPort;
  bossRng?: RunSaveSnapshotRngPort;
  biomeRng?: RunSaveSnapshotRngPort;
  hazardRng?: RunSaveSnapshotRngPort;
  eventRng?: RunSaveSnapshotRngPort;
  merchantRng?: RunSaveSnapshotRngPort;
}

export interface RunSaveSnapshotHost
  extends RunSaveSnapshotSceneStatePort,
    RunSaveSnapshotServicePort,
    RunSaveSnapshotHookPort,
    RunSaveSnapshotRngCollectionPort {}

export interface RunStateRestoreMutableStatePort {
  pendingResumeSave: RunSaveDataV2 | null;
  runSeed: string;
  run: RunState;
  dailyPracticeMode: boolean;
  dailyFixedWeaponType: WeaponType | null;
  selectedDifficulty: DifficultyMode;
  runEnded: boolean;
  lastDeathReason: string;
  manualMoveTarget: { x: number; y: number } | null;
  manualMoveTargetFailures: number;
  nextManualPathReplanAt: number;
  nextKeyboardMoveInputAt: number;
  eventPanelOpen: boolean;
  statHighlightEntries: HudStatHighlightEntry[];
  levelUpPulseUntilMs: number;
  levelUpPulseLevel: number | null;
  nextTransientHudRefreshAt: number;
  lastAiNearCount: number;
  lastAiFarCount: number;
  path: Array<{ x: number; y: number }>;
  blueprintFoundIdsInRun: string[];
  attackTargetId: string | null;
  nextPlayerAttackAt: number;
  nextBossAttackAt: number;
  consumables: ConsumableState;
  mapRevealActive: boolean;
  deferredOutcomes: DeferredOutcomeState[];
  merchantOffers: MerchantOffer[];
  floorConfig: FloorConfig;
  currentBiome: BiomeDef;
  dungeon: DungeonLayout;
  player: PlayerState;
  staircaseState: StaircaseState;
  origin: WorldBoundsConfig["origin"];
  worldBounds: WorldBoundsConfig["worldBounds"];
  playerSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  playerYOffset: number;
  bossDef: {
    id: string;
    name: string;
    spriteKey: string;
  };
  bossState: BossRuntimeState | null;
  bossSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null;
  hudDirty: boolean;
  resumedFromSave: boolean;
  lastAutoSaveAt: number;
  lastMinimapRefreshAt: number;
  eventNode:
    | {
        resolved: boolean;
      }
    | null;
}

export interface RunStateRestoreCollectionPort {
  entityLabelById: Map<string, string>;
  newlyAcquiredItemUntilMs: Map<string, number>;
  previousSkillCooldownLeftById: Map<string, number>;
  skillReadyFlashUntilMsById: Map<string, number>;
}

export interface RunStateRestoreEnvironmentPort {
  time: {
    now: number;
  };
  meta: MetaProgression;
  children: {
    removeAll(destroyChildren?: boolean): void;
  };
  cameras: {
    main: Phaser.Cameras.Scene2D.Camera;
  };
  uiManager: Pick<
    UIManager,
    "clearLogs" | "hideDeathOverlay" | "hideEventPanel" | "configureMinimap" | "resetMinimap" | "restoreMinimap"
  >;
}

export interface RunStateRestoreRuntimePort {
  entityManager: Pick<EntityManager, "clear" | "setMonsters" | "addLoot" | "setBoss">;
  hazardRuntimeModule: Pick<HazardRuntimeModule, "clearHazards" | "restoreHazards">;
  progressionRuntimeModule: Pick<
    ProgressionRuntimeModule,
    "clearChallengeState" | "renderHiddenRoomMarkers" | "renderStaircases" | "restoreChallengeRoom"
  >;
  movementSystem: Pick<MovementSystem, "clearPathCache">;
  renderSystem: Pick<
    RenderSystem,
    "computeWorldBounds" | "drawDungeon" | "spawnPlayer" | "spawnMonster" | "spawnLootSprite" | "spawnBoss" | "configureCamera"
  >;
  eventRuntimeModule: Pick<EventRuntimeModule, "destroyEventNode" | "createEventNode" | "consumeCurrentEvent">;
  sfxSystem: {
    playAmbientForBiome(biomeId: string): void;
  };
}

export interface RunStateRestoreBehaviorPort {
  syncEndlessMutators(nowMs: number): void;
  resolveDailyWeaponType(runSeed: string): WeaponType | null;
  refreshUnlockSnapshots(): void;
  configureRngStreams(floor: number, cursor?: Partial<Record<RunRngStreamName, number>>): void;
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
  restorePhase6TelemetryState?(state?: Phase6TelemetryRuntimeState): void;
  updateMinimap(nowMs: number): void;
  resetMutationRuntimeState(selectedIds: string[]): void;
  refreshSynergyRuntime(
    persistDiscovery?: boolean,
    options?: {
      emitActivationEvents?: boolean;
    }
  ): void;
  restoreFloorChoiceBudgetSnapshot?(snapshot: FloorChoiceBudgetState | null | undefined, nowMs: number): void;
  resetFloorChoiceBudget(floor: number, nowMs: number): void;
}

export interface RunStateRestoreHost
  extends RunStateRestoreMutableStatePort,
    RunStateRestoreCollectionPort,
    RunStateRestoreEnvironmentPort,
    RunStateRestoreRuntimePort,
    RunStateRestoreBehaviorPort {}
