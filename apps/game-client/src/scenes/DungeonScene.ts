import Phaser from "phaser";
import {
  aggregateBuffEffects,
  applyBuff,
  applyHazardDamage,
  addRunObols,
  advanceEndlessFloor,
  buildDailyHistoryEntry,
  canStartDailyScoredAttempt,
  canPayEventCost,
  canUseConsumable,
  collectUnlockedAffixIds,
  collectUnlockedBiomeIds,
  collectUnlockedEventIds,
  collectUnlockedMutationIds,
  collectUnlockedWeaponTypes,
  CONSUMABLE_DEFS,
  buildMutationDefMap,
  describeEndlessMutator,
  createInitialConsumableState,
  createMerchantOffers,
  createChallengeRoomState,
  createHazardRuntimeState,
  advanceChallengeRoomWave,
  applyDamageToBoss,
  applyAffixesToMonsterState,
  collectActiveMutationEffects,
  applyRunSummaryToMeta,
  collectTalentEffectTotals,
  canEquip,
  canUseSkill,
  collectLoot,
  grantConsumable,
  hasClaimedDailyReward,
  isItemDefUnlockedByWeaponType,
  isInsideHazard,
  mergeFoundBlueprints,
  multiplyMovementModifiers,
  nextHazardTickAt,
  nextHazardTriggerAt,
  normalizeMutationMetaState,
  mergeSynergyDiscoveries,
  resolveSynergyRuntimeEffects,
  validateMutationSelection,
  pickRandomEvent,
  resolveBiomeForFloorBySeed,
  resolveBranchChoiceFromSide,
  resolveBranchSideAtPosition,
  resolveDailyDate,
  resolveEquippedWeaponType,
  resolveEndlessAffixBonusCount,
  recordEndlessBestFloor,
  resolveWeaponTypeDef,
  rollBlueprintDiscoveries,
  rollEventRisk,
  rollItemDrop,
  createEventBus,
  createInitialMeta,
  createRunState,
  createSkillDefForLevel,
  createStaircaseState,
  defaultBaseStats,
  deriveFloorSeed,
  deriveStats,
  endlessFloorClearBonus,
  endlessKillShardReward,
  endRun,
  enterEndless,
  enterNextFloor,
  equipItem,
  failChallengeRoom,
  findStaircasePosition,
  generateBossRoom,
  generateDungeon,
  initBossState,
  isPlayerOnStaircase,
  markBossAttackUsed,
  markDailyRewardClaimed,
  markSkillUsed,
  migrateMeta,
  normalizeDifficultyMode,
  pickSkillChoicesWeighted,
  rollMonsterAffixes,
  shouldFailChallengeRoomByTimeout,
  shouldSpawnChallengeRoom,
  startChallengeRoom,
  chooseChallengeRoom,
  markRoomAsChallenge,
  resolveSelectedDifficulty,
  spendRunObols,
  shouldRunHazardTick,
  shouldTriggerPeriodicHazard,
  calculateSoulShardReward,
  isDifficultyUnlocked,
  resolveMonsterAffixOnDealDamage,
  resolveMonsterAffixOnKilled,
  resolveMonsterAttack,
  SeededRng,
  selectBossAttack,
  resolveBossAttack,
  syncEndlessMutatorState,
  updateBuffs,
  useConsumable,
  upsertDailyHistory,
  type CombatEvent,
  type BossDef,
  type BossRuntimeState,
  type ChallengeRoomState,
  type ConsumableId,
  type ConsumableState,
  type DeferredOutcomeState,
  type DungeonLayout,
  type DifficultyMode,
  type EventReward,
  type FloorChoiceBudgetState,
  type GameEventMap,
  type GridNode,
  type HazardRuntimeState,
  type ItemDef,
  type ItemInstance,
  type LootTableDef,
  type MerchantOffer,
  type MetaProgression,
  type MutationEffect,
  type MonsterAffixId,
  type MonsterState,
  type PowerSpikeBudgetRuntimeState,
  type PlayerState,
  type RandomEventDef,
  type RunMode,
  type RunRngStreamName,
  type RunSaveDataV2,
  type RollItemDropOptions,
  type RuntimeEventNodeState,
  type RunState,
  type StaircaseState,
  type SkillDef,
  type SkillResolution,
  type SynergyRuntimeEffects,
  type TalentEffectTotals,
  type WeaponType
} from "@blodex/core";
import {
  BIOME_MAP,
  BUFF_DEF_MAP,
  BLUEPRINT_DEFS,
  BLUEPRINT_DEF_MAP,
  BONE_SOVEREIGN,
  GAME_CONFIG,
  HAZARD_MAP,
  MUTATION_DEFS,
  MUTATION_DEF_MAP,
  RANDOM_EVENT_DEFS,
  UNLOCK_DEFS,
  WEAPON_TYPE_DEF_MAP,
  getFloorConfig,
  ITEM_DEF_MAP,
  LOOT_TABLE_MAP,
  MONSTER_ARCHETYPES,
  SKILL_DEFS,
  SYNERGY_DEFS,
  TALENT_DEFS,
  type BiomeDef,
  type FloorConfig
} from "@blodex/content";
import { AISystem } from "../systems/AISystem";
import type { MonsterAiUpdateResult } from "../systems/AISystem";
import { CombatSystem } from "../systems/CombatSystem";
import { EntityManager, type MonsterRuntime } from "../systems/EntityManager";
import { getContentLocalizer, getI18nService, resolveInitialLocale, setLocale, t } from "../i18n";
import { gridToIso } from "../systems/iso";
import { MonsterSpawnSystem } from "../systems/MonsterSpawnSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { SFXSystem } from "../systems/SFXSystem";
import { VFXSystem } from "../systems/VFXSystem";
import {
  FeedbackEventRouter,
  type FeedbackAction,
  type FeedbackRouterInput
} from "../systems/feedbackEventRouter";
import { SAVE_LEASE_TTL_MS, SaveManager } from "../systems/SaveManager";
import { consumableDescriptionLabel, consumableFailureReasonLabel, consumableNameLabel } from "../i18n/labelResolvers";
import { UIManager } from "../ui/UIManager";
import { hideSceneTransition, playSceneTransition } from "../ui/SceneTransitionOverlay";
import {
  detectPreferredImageFormat,
  resolveGeneratedAssetUrl,
  resolveGeneratedPngFallback,
  type PreferredImageFormat
} from "../assets/imageAsset";
import { removeConnectedBackgroundFromTexture } from "../assets/removeBackground";
import { DebugApiBinder } from "./dungeon/debug/DebugApiBinder";
import { DebugCommandRegistry } from "./dungeon/debug/DebugCommandRegistry";
import { DebugRuntimeModule } from "./dungeon/debug/DebugRuntimeModule";
import {
  resolveDebugCheatsEnabled,
  resolveDebugLockedEquipEnabled,
  resolveDebugQueryFlag
} from "./dungeon/debug/debugFlags";
import { injectDebugLockedEquipment } from "./dungeon/debug/injectDebugLockedEquipment";
import { DiagnosticsService } from "./dungeon/diagnostics/DiagnosticsService";
import {
  createBossCombatHost,
  createBossSpawnHost,
  createBossTelegraphHost,
  createDebugCommandHost,
  createDeferredOutcomeHost,
  createDungeonSceneHostBridge,
  createHazardRuntimeHost,
  createHeartbeatFeedbackHost,
  createHostOverlay,
  createProgressionChoiceHost,
  mutableHostField,
  createPowerSpikeRuntimeHost,
  createProgressionRuntimeHost,
  readonlyHostField,
  createRunSaveSnapshotHost,
  createRunStateRestoreHost,
  type DungeonSceneHostBridge
} from "./dungeon/dungeonSceneHostFactories";
import { HeartbeatFeedbackRuntime } from "./dungeon/feedback/HeartbeatFeedbackRuntime";
import { BossCombatService } from "./dungeon/encounter/BossCombatService";
import { BossRuntimeModule, type BossRuntimeHost } from "./dungeon/encounter/BossRuntimeModule";
import { BossSpawnService } from "./dungeon/encounter/BossSpawnService";
import { BossTelegraphPresenter } from "./dungeon/encounter/BossTelegraphPresenter";
import { EncounterController } from "./dungeon/encounter/EncounterController";
import { PlayerActionModule, type PlayerActionHost } from "./dungeon/encounter/PlayerActionModule";
import { entityLabel } from "./dungeon/logging/labelResolvers";
import {
  bindDomainEventEffects,
  type DomainEventEffectHost
} from "./dungeon/logging/DomainEventEffectBinder";
import { RunLogService } from "./dungeon/logging/RunLogService";
import { RunFlowOrchestrator } from "./dungeon/orchestrator/RunFlowOrchestrator";
import { ProgressionChoiceRuntime } from "./dungeon/progression/ProgressionChoiceRuntime";
import { RunCompletionModule, type RunCompletionHost } from "./dungeon/run/RunCompletionModule";
import { resolveInitialRunSeed } from "./dungeon/run/resolveInitialRunSeed";
import { RunPersistenceModule } from "./dungeon/save/RunPersistenceModule";
import { RunSaveSnapshotBuilder } from "./dungeon/save/RunSaveSnapshotBuilder";
import { RunStateRestorer } from "./dungeon/save/RunStateRestorer";
import { SaveCoordinator } from "./dungeon/save/SaveCoordinator";
import { applyForgedSkillBlueprintAugments } from "./dungeon/skills/skillBlueprintRuntime";
import { Phase6TelemetryTracker } from "./dungeon/taste/Phase6Telemetry";
import { PowerSpikeRuntimeModule } from "./dungeon/taste/PowerSpikeRuntimeModule";
import { TasteRuntimePortHub } from "./dungeon/taste/TasteRuntimePorts";
import { HudPresenter } from "./dungeon/ui/HudPresenter";
import { DungeonFrameRuntime } from "./dungeon/shell/DungeonFrameRuntime";
import { DungeonHudRuntime } from "./dungeon/shell/DungeonHudRuntime";
import { DungeonInputRuntime } from "./dungeon/shell/DungeonInputRuntime";
import { DungeonCombatRuntime } from "./dungeon/shell/DungeonCombatRuntime";
import { DungeonDiagnosticsRuntime } from "./dungeon/shell/DungeonDiagnosticsRuntime";
import { DungeonMetaRuntime } from "./dungeon/shell/DungeonMetaRuntime";
import { initializeDungeonSceneShell, type DungeonSceneShellSource } from "./dungeon/shell/DungeonSceneShellRuntime";
import { DungeonSessionFacade } from "./dungeon/shell/DungeonSessionFacade";
import {
  buildHudStatHighlightEntries,
  collectActiveHudStatHighlights,
  type HudStatHighlightEntry
} from "../ui/hud/compare/StatDeltaHighlighter";
import { EventResolutionService } from "./dungeon/world/EventResolutionService";
import { EventRuntimeModule } from "./dungeon/world/EventRuntimeModule";
import { DeferredOutcomeRuntime } from "./dungeon/world/DeferredOutcomeRuntime";
import { FloorProgressionModule, type FloorProgressionHost } from "./dungeon/world/FloorProgressionModule";
import { HazardRuntimeModule } from "./dungeon/world/HazardRuntimeModule";
import { MerchantFlowService } from "./dungeon/world/MerchantFlowService";
import { ProgressionRuntimeModule } from "./dungeon/world/ProgressionRuntimeModule";
import type { RuntimeEventHost } from "./dungeon/world/types";
import { WorldEventController } from "./dungeon/world/WorldEventController";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const RUN_SAVE_APP_VERSION = "phase2-4c";
const AUTO_SAVE_INTERVAL_MS = 60_000;
const DUNGEON_IMAGE_ASSET_IDS = [
  "player_vanguard",
  "monster_melee_01",
  "monster_ranged_01",
  "monster_elite_01",
  "tile_floor_01",
  "biome_catacombs_tile_floor_01",
  "biome_molten_tile_floor_01",
  "biome_venom_tile_floor_01",
  "biome_frozen_tile_floor_01",
  "biome_bone_tile_floor_01",
  "item_weapon_01",
  "item_weapon_02",
  "item_weapon_03",
  "item_helm_01",
  "item_helm_02",
  "item_chest_01",
  "item_chest_02",
  "item_boots_01",
  "item_boots_02",
  "item_ring_01",
  "item_ring_02",
  "boss_bone_sovereign",
  "telegraph_circle_red",
  "staircase_floor_exit",
  "skill_cleave",
  "skill_shadow_step",
  "skill_blood_drain",
  "skill_frost_nova",
  "skill_war_cry"
] as const;
const DUNGEON_IMAGE_ASSET_KEY_SET = new Set<string>(DUNGEON_IMAGE_ASSET_IDS);
const ENTITY_ASSET_KEYS_FOR_BACKGROUND_REMOVAL = [
  "player_vanguard",
  "monster_melee_01",
  "monster_ranged_01",
  "monster_elite_01",
  "boss_bone_sovereign"
] as const;
const DEBUG_CHEATS_QUERY = "debugCheats";
const DISABLE_VFX_QUERY = "disableVfx";
const DISABLE_SFX_QUERY = "disableSfx";
const DEBUG_LOCKED_EQUIP_QUERY = "debugEquipGate";
const DEBUG_DIAGNOSTICS_QUERY = "debugDiagnostics";
const DEBUG_LOCKED_EQUIP_ICON_ID = "item_ring_02";
const MINIMAP_REFRESH_INTERVAL_MS = 120;
const SKILL_READY_FLASH_DURATION_MS = 480;
const STAT_HIGHLIGHT_DURATION_MS = 1_300;
const CONSUMABLE_ICON_BY_ID: Record<ConsumableId, string> = {
  health_potion: "item_consumable_health_potion_01",
  mana_potion: "item_consumable_mana_potion_01",
  scroll_of_mapping: "item_consumable_scroll_mapping_01"
};
const SKILL_DEF_BY_ID = new Map(SKILL_DEFS.map((entry) => [entry.id, entry]));
const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);
const DAILY_WEAPON_ROTATION: WeaponType[] = ["sword", "axe", "dagger", "staff", "hammer"];
const DAILY_MUTATION_COUNT = 2;

interface DungeonSceneInitData {
  difficulty?: DifficultyMode;
  resumeSave?: RunSaveDataV2;
  resumedFromSave?: boolean;
  runMode?: RunMode;
  dailyDate?: string;
  dailyPractice?: boolean;
  runSeed?: string;
}

interface MutationRuntimeState {
  activeIds: string[];
  activeEffects: MutationEffect[];
  killAttackSpeedStacks: number;
  killAttackSpeedUntilMs: number;
  onHitInvulnUntilMs: number;
  onHitInvulnCooldownUntilMs: number;
  lethalGuardUsedFloors: Set<number>;
}

export class DungeonScene extends Phaser.Scene {
  private static readonly ENTITY_DEPTH_OFFSET = 10_000;

  private readonly entityManager = new EntityManager();
  private readonly movementSystem = new MovementSystem();
  private readonly aiSystem = new AISystem();
  private readonly combatSystem = new CombatSystem();
  private readonly monsterSpawnSystem = new MonsterSpawnSystem();
  private readonly sfxSystem: SFXSystem;
  private readonly vfxSystem: VFXSystem;
  private readonly feedbackRouter: FeedbackEventRouter;
  private readonly eventBus = createEventBus<GameEventMap>();
  private readonly renderSystem: RenderSystem;
  private preferredImageFormat: PreferredImageFormat = "png";
  private readonly imageFallbackRetried = new Set<string>();
  private readonly debugApiBinder = new DebugApiBinder();
  private readonly runFlowOrchestrator = new RunFlowOrchestrator();
  private readonly diagnosticsService = new DiagnosticsService();
  private readonly hudPresenter = new HudPresenter();
  private readonly frameRuntime = new DungeonFrameRuntime(() => this.dungeonSceneHostBridge);
  private readonly hudRuntime = new DungeonHudRuntime(() => this.dungeonSceneHostBridge);
  private readonly inputRuntime = new DungeonInputRuntime(() => this.dungeonSceneHostBridge);
  private readonly combatRuntime = new DungeonCombatRuntime(() => this.dungeonSceneHostBridge);
  private readonly diagnosticsRuntime = new DungeonDiagnosticsRuntime({
    diagnosticsService: this.diagnosticsService,
    isEnabled: () => this.diagnosticsEnabled,
    getRun: () => this.run,
    getAiCounts: () => ({ near: this.lastAiNearCount, far: this.lastAiFarCount }),
    getEventBusListenerCount: () => this.eventBus.listenerCount(),
    getEntityDiagnostics: () => this.entityManager.getDiagnostics(),
    getRenderDiagnostics: () => this.renderSystem.getLastSyncStats(),
    getVfxDiagnostics: () => this.vfxSystem.getDiagnostics(),
    getSfxDiagnostics: () => this.sfxSystem.getDiagnostics(),
    getActualFps: () => this.game.loop.actualFps,
    getPhase6Summary: () => this.capturePhase6TelemetrySummary(),
    getTasteSnapshot: () => ({
      buildIdentity: this.tasteRuntime.snapshotBuildIdentity(),
      recentHeartbeats: this.tasteRuntime.listHeartbeatEvents(10),
      recommendations: this.tasteRuntime.buildRecommendations()
    })
  });
  private readonly metaRuntime = new DungeonMetaRuntime(() => this.dungeonSceneHostBridge);
  private readonly sessionFacade = new DungeonSessionFacade(() => this.dungeonSceneHostBridge);
  private readonly dungeonSceneHostBridge: DungeonSceneHostBridge = (() => {
    const scene = this;
    return createDungeonSceneHostBridge({
      runSeed: mutableHostField(() => scene.runSeed, (value) => { scene.runSeed = value; }),
      run: mutableHostField(() => scene.run, (value) => { scene.run = value; }),
      player: mutableHostField(() => scene.player, (value) => { scene.player = value; }),
      bossDef: readonlyHostField(() => scene.bossDef),
      staircaseState: mutableHostField(() => scene.staircaseState, (value) => { scene.staircaseState = value; }),
      lootRng: readonlyHostField(() => scene.lootRng),
      origin: mutableHostField(() => scene.origin, (value) => { scene.origin = value; }),
      eventBus: readonlyHostField(() => scene.eventBus),
      renderSystem: readonlyHostField(() => scene.renderSystem),
      entityManager: readonlyHostField(() => scene.entityManager),
      tasteRuntime: readonlyHostField(() => scene.tasteRuntime),
      phase6Telemetry: readonlyHostField(() => scene.phase6Telemetry),
      contentLocalizer: readonlyHostField(() => scene.contentLocalizer),
      runLog: readonlyHostField(() => scene.runLog),
      hudDirty: mutableHostField(() => scene.hudDirty, (value) => { scene.hudDirty = value; }),
      uiManager: readonlyHostField(() => scene.uiManager),
      eventPanelOpen: mutableHostField(() => scene.eventPanelOpen, (value) => { scene.eventPanelOpen = value; }),
      comparePromptOpen: mutableHostField(() => scene.comparePromptOpen, (value) => { scene.comparePromptOpen = value; }),
      runEnded: mutableHostField(() => scene.runEnded, (value) => { scene.runEnded = value; }),
      consumables: mutableHostField(() => scene.consumables, (value) => { scene.consumables = value; }),
      dungeon: mutableHostField(() => scene.dungeon, (value) => { scene.dungeon = value; }),
      hazards: mutableHostField(() => scene.hazards, (value) => { scene.hazards = value; }),
      bossState: mutableHostField(() => scene.bossState, (value) => { scene.bossState = value; }),
      eventNode: readonlyHostField(() => scene.eventNode),
      merchantOffers: mutableHostField(() => scene.merchantOffers, (value) => { scene.merchantOffers = value; }),
      mapRevealActive: mutableHostField(() => scene.mapRevealActive, (value) => { scene.mapRevealActive = value; }),
      blueprintFoundIdsInRun: mutableHostField(() => scene.blueprintFoundIdsInRun, (value) => { scene.blueprintFoundIdsInRun = value; }),
      mutationRuntime: readonlyHostField(() => scene.mutationRuntime),
      deferredOutcomes: mutableHostField(() => scene.deferredOutcomes, (value) => { scene.deferredOutcomes = value; }),
      saveManager: readonlyHostField(() => scene.saveManager),
      saveCoordinator: readonlyHostField(() => scene.saveCoordinator),
      spawnRng: readonlyHostField(() => scene.spawnRng),
      combatRng: readonlyHostField(() => scene.combatRng),
      skillRng: readonlyHostField(() => scene.skillRng),
      bossRng: readonlyHostField(() => scene.bossRng),
      biomeRng: readonlyHostField(() => scene.biomeRng),
      hazardRng: readonlyHostField(() => scene.hazardRng),
      eventRng: readonlyHostField(() => scene.eventRng),
      merchantRng: readonlyHostField(() => scene.merchantRng),
      pendingResumeSave: mutableHostField(() => scene.pendingResumeSave, (value) => { scene.pendingResumeSave = value; }),
      dailyPracticeMode: mutableHostField(() => scene.dailyPracticeMode, (value) => { scene.dailyPracticeMode = value; }),
      dailyFixedWeaponType: mutableHostField(() => scene.dailyFixedWeaponType, (value) => { scene.dailyFixedWeaponType = value; }),
      selectedDifficulty: mutableHostField(() => scene.selectedDifficulty, (value) => { scene.selectedDifficulty = value; }),
      lastDeathReason: mutableHostField(() => scene.lastDeathReason, (value) => { scene.lastDeathReason = value; }),
      manualMoveTarget: mutableHostField(() => scene.manualMoveTarget, (value) => { scene.manualMoveTarget = value; }),
      manualMoveTargetFailures: mutableHostField(() => scene.manualMoveTargetFailures, (value) => { scene.manualMoveTargetFailures = value; }),
      nextManualPathReplanAt: mutableHostField(() => scene.nextManualPathReplanAt, (value) => { scene.nextManualPathReplanAt = value; }),
      nextKeyboardMoveInputAt: mutableHostField(() => scene.nextKeyboardMoveInputAt, (value) => { scene.nextKeyboardMoveInputAt = value; }),
      statHighlightEntries: mutableHostField(() => scene.statHighlightEntries, (value) => { scene.statHighlightEntries = value; }),
      levelUpPulseUntilMs: mutableHostField(() => scene.levelUpPulseUntilMs, (value) => { scene.levelUpPulseUntilMs = value; }),
      levelUpPulseLevel: mutableHostField(() => scene.levelUpPulseLevel, (value) => { scene.levelUpPulseLevel = value; }),
      nextTransientHudRefreshAt: mutableHostField(() => scene.nextTransientHudRefreshAt, (value) => { scene.nextTransientHudRefreshAt = value; }),
      lastAiNearCount: mutableHostField(() => scene.lastAiNearCount, (value) => { scene.lastAiNearCount = value; }),
      lastAiFarCount: mutableHostField(() => scene.lastAiFarCount, (value) => { scene.lastAiFarCount = value; }),
      path: mutableHostField(() => scene.path, (value) => { scene.path = value; }),
      attackTargetId: mutableHostField(() => scene.attackTargetId, (value) => { scene.attackTargetId = value; }),
      nextPlayerAttackAt: mutableHostField(() => scene.nextPlayerAttackAt, (value) => { scene.nextPlayerAttackAt = value; }),
      nextBossAttackAt: mutableHostField(() => scene.nextBossAttackAt, (value) => { scene.nextBossAttackAt = value; }),
      floorConfig: mutableHostField(() => scene.floorConfig, (value) => { scene.floorConfig = value; }),
      currentBiome: mutableHostField(() => scene.currentBiome, (value) => { scene.currentBiome = value; }),
      worldBounds: mutableHostField(() => scene.worldBounds, (value) => { scene.worldBounds = value; }),
      playerSprite: mutableHostField(() => scene.playerSprite, (value) => { scene.playerSprite = value; }),
      playerYOffset: mutableHostField(() => scene.playerYOffset, (value) => { scene.playerYOffset = value; }),
      bossSprite: mutableHostField(() => scene.bossSprite, (value) => { scene.bossSprite = value; }),
      resumedFromSave: mutableHostField(() => scene.resumedFromSave, (value) => { scene.resumedFromSave = value; }),
      lastAutoSaveAt: mutableHostField(() => scene.lastAutoSaveAt, (value) => { scene.lastAutoSaveAt = value; }),
      lastMinimapRefreshAt: mutableHostField(() => scene.lastMinimapRefreshAt, (value) => { scene.lastMinimapRefreshAt = value; }),
      entityLabelById: readonlyHostField(() => scene.entityLabelById),
      newlyAcquiredItemUntilMs: readonlyHostField(() => scene.newlyAcquiredItemUntilMs),
      previousSkillCooldownLeftById: readonlyHostField(() => scene.previousSkillCooldownLeftById),
      skillReadyFlashUntilMsById: readonlyHostField(() => scene.skillReadyFlashUntilMsById),
      time: readonlyHostField(() => scene.time),
      meta: readonlyHostField(() => scene.meta),
      children: readonlyHostField(() => scene.children),
      cameras: readonlyHostField(() => scene.cameras),
      hazardRuntimeModule: readonlyHostField(() => scene.hazardRuntimeModule),
      progressionRuntimeModule: readonlyHostField(() => scene.progressionRuntimeModule),
      movementSystem: readonlyHostField(() => scene.movementSystem),
      eventRuntimeModule: readonlyHostField(() => scene.eventRuntimeModule),
      sfxSystem: readonlyHostField(() => scene.sfxSystem),
      hazardVisuals: mutableHostField(() => scene.hazardVisuals, (value) => { scene.hazardVisuals = value; }),
      playerHazardContact: readonlyHostField(() => scene.playerHazardContact),
      unlockedBiomeIds: readonlyHostField(() => scene.unlockedBiomeIds),
      unlockedEventIds: readonlyHostField(() => scene.unlockedEventIds),
      debugCheatsEnabled: readonlyHostField(() => scene.debugCheatsEnabled),
      debugLockedEquipQuery: readonlyHostField(() => scene.debugLockedEquipQuery),
      debugLockedEquipIconId: readonlyHostField(() => scene.debugLockedEquipIconId),
      bossRuntimeModule: readonlyHostField(() => scene.bossRuntimeModule),
      talentEffects: readonlyHostField(() => scene.talentEffects),
      unlockedAffixIds: readonlyHostField(() => scene.unlockedAffixIds),
      hiddenEntranceMarkers: readonlyHostField(() => scene.hiddenEntranceMarkers),
      challengeMarker: mutableHostField(() => scene.challengeMarker, (value) => { scene.challengeMarker = value; }),
      challengeRoomState: mutableHostField(() => scene.challengeRoomState, (value) => { scene.challengeRoomState = value; }),
      challengeWaveTotal: mutableHostField(() => scene.challengeWaveTotal, (value) => { scene.challengeWaveTotal = value; }),
      challengeMonsterIds: readonlyHostField(() => scene.challengeMonsterIds),
      add: readonlyHostField(() => scene.add),
      tileWidth: readonlyHostField(() => scene.tileWidth),
      tileHeight: readonlyHostField(() => scene.tileHeight),
      entityDepthOffset: readonlyHostField(() => scene.entityDepthOffset),
      tweens: readonlyHostField(() => scene.tweens),
      runCompletionModule: readonlyHostField(() => scene.runCompletionModule),
      deferredOutcomeRuntime: readonlyHostField(() => scene.deferredOutcomeRuntime),
      synergyRuntime: readonlyHostField(() => scene.synergyRuntime),
      markHighValueChoice: (source, nowMs) => scene.markHighValueChoice(source, nowMs),
      resolveProgressionLootTable: (floor) => scene.resolveProgressionLootTable(floor),
      resolveLootRollOptions: (options) => scene.resolveLootRollOptions(options),
      isItemDefUnlocked: (itemDef) => scene.isItemDefUnlocked(itemDef),
      routeFeedback: (input) => scene.frameRuntime.routeFeedback(input),
      captureFloorChoiceBudgetSnapshot: () => scene.captureFloorChoiceBudgetSnapshot(),
      captureProgressionPromptState: (nowMs) => scene.captureProgressionPromptState(nowMs),
      capturePowerSpikeBudgetState: () => scene.capturePowerSpikeBudgetState(),
      capturePhase6TelemetryState: (elapsedMs) => scene.capturePhase6TelemetryState(elapsedMs),
      syncEndlessMutators: (nowMs) => scene.syncEndlessMutators(nowMs),
      resolveDailyWeaponType: (runSeed) => scene.metaRuntime.resolveDailyWeaponType(runSeed),
      refreshUnlockSnapshots: () => scene.refreshUnlockSnapshots(),
      configureRngStreams: (floor: number, cursor?: Partial<Record<RunRngStreamName, number>>) =>
        scene.configureRngStreams(floor, cursor),
      refreshPlayerStatsFromEquipment: (player) => scene.refreshPlayerStatsFromEquipment(player),
      restorePhase6TelemetryState: (state) => scene.restorePhase6TelemetryState(state),
      updateMinimap: (nowMs) => scene.frameRuntime.updateMinimap(nowMs),
      resetMutationRuntimeState: (selectedIds) => scene.resetMutationRuntimeState(selectedIds),
      refreshSynergyRuntime: (
        persistDiscovery?: boolean,
        options?: {
          emitActivationEvents?: boolean;
          recordTelemetry?: boolean;
        }
      ) => scene.refreshSynergyRuntime(persistDiscovery, options),
      restoreFloorChoiceBudgetSnapshot: (snapshot, nowMs) => scene.restoreFloorChoiceBudgetSnapshot(snapshot, nowMs),
      restoreProgressionPromptState: (snapshot, nowMs) => scene.restoreProgressionPromptState(snapshot, nowMs),
      restorePowerSpikeBudgetState: (snapshot) => scene.restorePowerSpikeBudgetState(snapshot),
      resetFloorChoiceBudget: (floor, nowMs) => scene.resetFloorChoiceBudget(floor, nowMs),
      applyOnKillMutationEffects: (nowMs) => scene.applyOnKillMutationEffects(nowMs),
      resolveMutationDropBonus: () => scene.resolveMutationDropBonus(),
      applyDailyLoadout: (player, nowMs) => scene.metaRuntime.applyDailyLoadout(player, nowMs),
      spawnMonsters: () => scene.spawnMonsters(),
      spawnLootDrop: (item, position, source) => scene.powerSpikeRuntimeModule.spawnLootDrop(item, position, source, scene.time.now),
      tryDiscoverBlueprints: (sourceType, nowMs, sourceId) => scene.tryDiscoverBlueprints(sourceType, nowMs, sourceId),
      scheduleRunSave: () => scene.scheduleRunSave(),
      resolveHiddenRoomRevealRadius: () => scene.resolveHiddenRoomRevealRadius(),
      resolveMutationAttackSpeedMultiplier: (nowMs) => scene.resolveMutationAttackSpeedMultiplier(nowMs),
      emitCombatEvents: (events) => scene.emitCombatEvents(events),
      collectDiagnosticsSnapshot: () => scene.diagnosticsRuntime.snapshot(),
      bootstrapRun: (runSeed, difficulty) => scene.bootstrapRun(runSeed, difficulty),
      pickFloorEventPosition: () => scene.pickFloorEventPosition(),
      flushRunSave: () => scene.flushRunSave(),
      getRunRelativeNowMs: () => scene.getRunRelativeNowMs(),
      handleLevelUpGain: (levelsGained, nowMs, source) => scene.handleLevelUpGain(levelsGained, nowMs, source),
      grantStoryBossReward: (nowMs) => scene.grantStoryBossReward(nowMs),
      flushBossRewardComparePrompts: (onDrained) => scene.flushBossRewardComparePrompts(onDrained),
      describeItem: (item) => scene.powerSpikeRuntimeModule.describeItem(item),
      recordBossRewardClosed: (choiceId, nowMs) => scene.recordBossRewardClosed(choiceId, nowMs),
      saveMeta: (meta) => scene.metaRuntime.saveMeta(meta),
      renderHud: () => scene.hudRuntime.render(),
      capturePhase6TelemetrySummary: (elapsedMs) => scene.capturePhase6TelemetrySummary(elapsedMs),
      resolveRunRecommendations: () => scene.tasteRuntime.buildRecommendations(),
      grantFloorPairFallbackReward: (nowMs) => scene.grantFloorPairFallbackReward(nowMs),
      ensureFloorChoiceBudget: (nowMs) => scene.ensureFloorChoiceBudget(nowMs),
      resolveRuntimeSkillDef: (skillDef) => scene.resolveRuntimeSkillDef(skillDef),
      spawnSplitChildren: (monster, archetype, nowMs) => scene.combatRuntime.spawnSplitChildren(monster, archetype, nowMs),
      collectMutationEffects: (type) => scene.collectMutationEffects(type),
      recordPlayerInput: (nowMs) => scene.recordPlayerInput(nowMs),
      recordSkillResolutionTelemetry: (resolution, nowMs) => scene.recordSkillResolutionTelemetry(resolution, nowMs),
      applyResolvedBuffs: (buffs, nowMs) => scene.applyResolvedBuffs(buffs, nowMs),
      resolveEntityLabel: (entityId) => scene.resolveEntityLabel(entityId),
      flushQueuedComparePrompts: () => scene.heartbeatFeedbackRuntime.flushImmediateComparePrompts(),
      recordAcquiredItemTelemetry: (item, source, nowMs, baselinePlayer) =>
        scene.recordAcquiredItemTelemetry(item, source, nowMs, baselinePlayer)
    });
  })();
  private readonly debugCommandRegistry = new DebugCommandRegistry(createDebugCommandHost(this.dungeonSceneHostBridge));
  private readonly runSaveSnapshotBuilder = new RunSaveSnapshotBuilder({
    host: createRunSaveSnapshotHost(this.dungeonSceneHostBridge),
    appVersion: RUN_SAVE_APP_VERSION
  });
  private readonly runStateRestorer = new RunStateRestorer({
    host: createRunStateRestoreHost(this.dungeonSceneHostBridge)
  });
  private readonly contentLocalizer = getContentLocalizer();
  private readonly runLog = new RunLogService({
    append: () => {
      // UI sink is bound in create().
    }
  }, getI18nService());
  private readonly deferredOutcomeRuntime = new DeferredOutcomeRuntime({
    host: createDeferredOutcomeHost(this.dungeonSceneHostBridge)
  });
  private saveCoordinator!: SaveCoordinator;
  private debugRuntimeModule!: DebugRuntimeModule;
  private runPersistenceModule!: RunPersistenceModule;
  private eventRuntimeModule!: EventRuntimeModule;
  private bossRuntimeModule!: BossRuntimeModule;
  private runCompletionModule!: RunCompletionModule;
  private hazardRuntimeModule!: HazardRuntimeModule;
  private progressionRuntimeModule!: ProgressionRuntimeModule;
  private floorProgressionModule!: FloorProgressionModule;
  private playerActionModule!: PlayerActionModule;
  private encounterController!: EncounterController;
  private worldEventController!: WorldEventController;

  private uiManager!: UIManager;
  private meta: MetaProgression = createInitialMeta();
  private talentEffects: TalentEffectTotals = collectTalentEffectTotals({}, TALENT_DEFS);
  private blueprintFoundIdsInRun: string[] = [];
  private unlockedWeaponTypes = new Set<WeaponType>(["sword"]);
  private mutationRuntime: MutationRuntimeState = {
    activeIds: [],
    activeEffects: [],
    killAttackSpeedStacks: 0,
    killAttackSpeedUntilMs: 0,
    onHitInvulnUntilMs: 0,
    onHitInvulnCooldownUntilMs: 0,
    lethalGuardUsedFloors: new Set<number>()
  };
  private synergyRuntime: SynergyRuntimeEffects = {
    activeSynergyIds: [],
    skillDamagePercent: {},
    skillModifiers: {},
    statPercent: {},
    cooldownOverridesMs: {}
  };
  private readonly hiddenEntranceMarkers = new Map<string, Phaser.GameObjects.Ellipse>();
  private readonly saveManager = new SaveManager();
  private run!: RunState;
  private runSeed = "";
  private selectedDifficulty: DifficultyMode = "normal";
  private pendingDifficulty: DifficultyMode | null = null;
  private pendingResumeSave: RunSaveDataV2 | null = null;
  private pendingRunMode: RunMode = "normal";
  private pendingDailyDate: string | undefined;
  private pendingDailyPractice = false;
  private pendingRunSeed: string | undefined;
  private dailyPracticeMode = false;
  private dailyFixedWeaponType: WeaponType | null = null;
  private resumedFromSave = false;
  private lastAutoSaveAt = 0;

  private spawnRng!: SeededRng;
  private combatRng!: SeededRng;
  private lootRng!: SeededRng;
  private skillRng!: SeededRng;
  private bossRng!: SeededRng;
  private biomeRng!: SeededRng;
  private hazardRng!: SeededRng;
  private eventRng!: SeededRng;
  private merchantRng!: SeededRng;

  private floorConfig: FloorConfig = getFloorConfig(1);
  private currentBiome: BiomeDef = BIOME_MAP.forgotten_catacombs;
  private hazards: HazardRuntimeState[] = [];
  private hazardVisuals: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse> = [];
  private readonly playerHazardContact = new Map<string, boolean>();
  private unlockedBiomeIds = new Set<string>();
  private unlockedAffixIds: MonsterAffixId[] = [];
  private unlockedEventIds: string[] = [];

  private dungeon: DungeonLayout = {
    width: 1,
    height: 1,
    walkable: [[true]],
    rooms: [],
    corridors: [],
    spawnPoints: [],
    playerSpawn: { x: 0, y: 0 },
    layoutHash: "bootstrap"
  };

  private player!: PlayerState;
  private playerSprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

  private bossDef: BossDef = BONE_SOVEREIGN;
  private bossState: BossRuntimeState | null = null;
  private bossSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null = null;

  private staircaseState: StaircaseState = {
    kind: "single",
    position: { x: 0, y: 0 },
    visible: false
  };

  private path: GridNode[] = [];
  private attackTargetId: string | null = null;
  private manualMoveTarget: GridNode | null = null;
  private manualMoveTargetFailures = 0;
  private nextManualPathReplanAt = 0;
  private nextKeyboardMoveInputAt = 0;
  private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private readonly keyboardBindings: Array<{
    eventName: string;
    handler: (...args: unknown[]) => void;
  }> = [];

  private origin = { x: 0, y: 0 };
  private worldBounds = { x: -2000, y: -2000, width: 4000, height: 4000 };
  private readonly tileWidth = GAME_CONFIG.tileWidth;
  private readonly tileHeight = GAME_CONFIG.tileHeight;
  private playerYOffset = 16;
  private nextPlayerAttackAt = 0;
  private nextBossAttackAt = 0;
  private hudDirty = true;
  private runEnded = false;
  private lastDeathReason = "Unknown cause.";
  private nearDeathWindowArmedAtMs: number | null = null;
  private nearDeathFeedbackCooldownUntilMs = 0;
  private readonly entityLabelById = new Map<string, string>();
  private consumables: ConsumableState = createInitialConsumableState(0);
  private eventNode: {
    eventDef: RandomEventDef;
    position: { x: number; y: number };
    marker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
    resolved: boolean;
  } | null = null;
  private challengeRoomState: ChallengeRoomState | null = null;
  private challengeWaveTotal = 0;
  private challengeMarker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null = null;
  private readonly challengeMonsterIds = new Set<string>();
  private merchantOffers: MerchantOffer[] = [];
  private eventPanelOpen = false;
  private comparePromptOpen = false;
  private mapRevealActive = false;
  private deferredOutcomes: DeferredOutcomeState[] = [];
  private debugCheatsEnabled = false;
  private diagnosticsEnabled = false;
  private cleanupStarted = false;
  private preserveSceneTransitionOnCleanup = false;
  private lastAiNearCount = 0;
  private lastAiFarCount = 0;
  private lastMinimapRefreshAt = 0;
  private aiFrameCounter = 0;
  private readonly newlyAcquiredItemUntilMs = new Map<string, number>();
  private readonly previousSkillCooldownLeftById = new Map<string, number>();
  private readonly skillReadyFlashUntilMsById = new Map<string, number>();
  private statHighlightEntries: HudStatHighlightEntry[] = [];
  private levelUpPulseUntilMs = 0;
  private levelUpPulseLevel: number | null = null;
  private readonly progressionChoiceRuntime = new ProgressionChoiceRuntime({
    host: createProgressionChoiceHost(this.dungeonSceneHostBridge, {
      playerActionModule: {
        resolveLevelupSkillChoices: () => this.playerActionModule.resolveLevelupSkillChoices(),
        resolveLevelupSkillChoiceById: (skillId) => this.playerActionModule.resolveLevelupSkillChoiceById(skillId),
        applyLevelupSkillChoice: (skillId) => this.playerActionModule.applyLevelupSkillChoice(skillId)
      },
      registerStatDeltaHighlights: (before, after, nowMs) => this.hudRuntime.registerStatDeltaHighlights(before, after, nowMs),
      recordBuildLevelUpChoice: (stat, source, nowMs) => {
        this.tasteRuntime.recordLevelUpChoice(stat, this.run.currentFloor, source, nowMs);
        this.powerSpikeRuntimeModule.recordBuildFormed(source, nowMs);
      },
      recordPlayerFacingChoice: (source, nowMs) => this.markHighValueChoice(source, nowMs)
    })
  });
  private readonly tasteRuntime = new TasteRuntimePortHub();
  private readonly phase6Telemetry = new Phase6TelemetryTracker();
  private readonly powerSpikeRuntimeModule = new PowerSpikeRuntimeModule({
    host: createPowerSpikeRuntimeHost(this.dungeonSceneHostBridge)
  });
  private readonly heartbeatFeedbackRuntime = new HeartbeatFeedbackRuntime(
    createHeartbeatFeedbackHost(this.dungeonSceneHostBridge)
  );
  private nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
  private readonly debugLockedEquipQuery = DEBUG_LOCKED_EQUIP_QUERY;
  private readonly debugLockedEquipIconId = DEBUG_LOCKED_EQUIP_ICON_ID;
  private readonly entityDepthOffset = DungeonScene.ENTITY_DEPTH_OFFSET;

  constructor() {
    super("dungeon");
    this.renderSystem = new RenderSystem(
      this,
      GAME_CONFIG.tileWidth,
      GAME_CONFIG.tileHeight,
      DungeonScene.ENTITY_DEPTH_OFFSET
    );
    this.sfxSystem = new SFXSystem(this);
    this.vfxSystem = new VFXSystem(this);
    this.feedbackRouter = new FeedbackEventRouter(
      (action) => {
        this.frameRuntime.dispatchFeedbackAction(action);
      },
      {
        onDispatchError: ({ input, error }) => {
          const type = input.type;
          console.warn(`[FeedbackRouter] Failed to dispatch action for ${type}`, error);
          this.runLog.appendKey("log.system.feedback_degraded", { type }, "warn", this.time.now);
        }
      }
    );
    this.heartbeatFeedbackRuntime.bind();
  }

  private pickFloorEventPosition(): { x: number; y: number } | null {
    const candidates = this.dungeon.spawnPoints.filter((point) => {
      if (Math.hypot(point.x - this.player.position.x, point.y - this.player.position.y) < 6) {
        return false;
      }
      if (Math.hypot(point.x - this.staircaseState.position.x, point.y - this.staircaseState.position.y) < 2) {
        return false;
      }
      for (const hazard of this.hazards) {
        if (Math.hypot(point.x - hazard.position.x, point.y - hazard.position.y) < hazard.radiusTiles + 1) {
          return false;
        }
      }
      return true;
    });
    if (candidates.length === 0) {
      return null;
    }
    const picked = this.eventRng.pick(candidates);
    return { x: picked.x, y: picked.y };
  }

  init(data: DungeonSceneInitData): void {
    this.pendingResumeSave = data.resumeSave ?? null;
    this.resumedFromSave = data.resumedFromSave === true;
    this.pendingRunMode = data.runMode === "daily" ? "daily" : "normal";
    this.pendingDailyDate = data.dailyDate;
    this.pendingDailyPractice = data.dailyPractice === true;
    this.pendingRunSeed = data.runSeed;
    if (data.difficulty === undefined) {
      this.pendingDifficulty = null;
      return;
    }
    this.pendingDifficulty = normalizeDifficultyMode(data.difficulty, "normal");
  }

  preload(): void {
    this.preferredImageFormat = detectPreferredImageFormat();
    this.imageFallbackRetried.clear();

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleImageLoadError, this);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleImageLoadError, this);
    });

    for (const assetId of DUNGEON_IMAGE_ASSET_IDS) {
      this.load.image(assetId, resolveGeneratedAssetUrl(assetId, this.preferredImageFormat));
    }
    this.sfxSystem.preload();
  }

  private handleImageLoadError(file: Phaser.Loader.File): void {
    if (this.preferredImageFormat !== "webp") {
      return;
    }

    const key = String(file.key);
    if (!DUNGEON_IMAGE_ASSET_KEY_SET.has(key)) {
      return;
    }

    if (this.imageFallbackRetried.has(key)) {
      return;
    }

    this.imageFallbackRetried.add(key);
    this.load.image(key, resolveGeneratedPngFallback(key));

    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  private applyRuntimeBackgroundRemoval(): void {
    for (const textureKey of ENTITY_ASSET_KEYS_FOR_BACKGROUND_REMOVAL) {
      removeConnectedBackgroundFromTexture(this, textureKey);
    }
    this.renderSystem.setMultiplyBlendFallbackKeys([]);
  }

  create(): void {
    this.debugCheatsEnabled = resolveDebugCheatsEnabled(DEBUG_CHEATS_QUERY);
    this.diagnosticsEnabled = resolveDebugQueryFlag(DEBUG_DIAGNOSTICS_QUERY) || this.debugCheatsEnabled;
    this.vfxSystem.setEnabled(!resolveDebugQueryFlag(DISABLE_VFX_QUERY));
    this.sfxSystem.setEnabled(!resolveDebugQueryFlag(DISABLE_SFX_QUERY));
    initializeDungeonSceneShell(this);
  }

  createShellRuntimeSource(): DungeonSceneShellSource {
    const scene = this;
    return createHostOverlay(this.dungeonSceneHostBridge, {
      get cleanupStarted() { return scene.cleanupStarted; },
      set cleanupStarted(value) { scene.cleanupStarted = value; },
      get preserveSceneTransitionOnCleanup() { return scene.preserveSceneTransitionOnCleanup; },
      set preserveSceneTransitionOnCleanup(value) { scene.preserveSceneTransitionOnCleanup = value; },
      get diagnosticsEnabled() { return scene.diagnosticsEnabled; },
      get uiManager() { return scene.uiManager; },
      set uiManager(value) { scene.uiManager = value; },
      get saveManager() { return scene.saveManager; },
      get sfxSystem() { return scene.sfxSystem; },
      get vfxSystem() { return scene.vfxSystem; },
      get saveCoordinator() { return scene.saveCoordinator; },
      set saveCoordinator(value) { scene.saveCoordinator = value; },
      get runPersistenceModule() { return scene.runPersistenceModule; },
      set runPersistenceModule(value) { scene.runPersistenceModule = value; },
      get eventRuntimeModule() { return scene.eventRuntimeModule; },
      set eventRuntimeModule(value) { scene.eventRuntimeModule = value; },
      get bossRuntimeModule() { return scene.bossRuntimeModule; },
      set bossRuntimeModule(value) { scene.bossRuntimeModule = value; },
      get runCompletionModule() { return scene.runCompletionModule; },
      set runCompletionModule(value) { scene.runCompletionModule = value; },
      get hazardRuntimeModule() { return scene.hazardRuntimeModule; },
      set hazardRuntimeModule(value) { scene.hazardRuntimeModule = value; },
      get progressionRuntimeModule() { return scene.progressionRuntimeModule; },
      set progressionRuntimeModule(value) { scene.progressionRuntimeModule = value; },
      get floorProgressionModule() { return scene.floorProgressionModule; },
      set floorProgressionModule(value) { scene.floorProgressionModule = value; },
      get playerActionModule() { return scene.playerActionModule; },
      set playerActionModule(value) { scene.playerActionModule = value; },
      get encounterController() { return scene.encounterController; },
      set encounterController(value) { scene.encounterController = value; },
      get worldEventController() { return scene.worldEventController; },
      set worldEventController(value) { scene.worldEventController = value; },
      get debugRuntimeModule() { return scene.debugRuntimeModule; },
      set debugRuntimeModule(value) { scene.debugRuntimeModule = value; },
      get combatRuntime() { return scene.combatRuntime; },
      get metaRuntime() { return scene.metaRuntime; },
      get pendingRunSeed() { return scene.pendingRunSeed; },
      get dungeonSceneHostBridge() { return scene.dungeonSceneHostBridge; },
      get runSaveSnapshotBuilder() { return scene.runSaveSnapshotBuilder; },
      get runStateRestorer() { return scene.runStateRestorer; },
      get debugApiBinder() { return scene.debugApiBinder; },
      get debugCommandRegistry() { return scene.debugCommandRegistry; },
      resolveLocalePreference: () => scene.resolveLocalePreference(),
      normalizeMetaForPhase4B: () => scene.normalizeMetaForPhase4B(),
      registerStatDeltaHighlights: (
        beforeStats: PlayerState["derivedStats"],
        afterStats: PlayerState["derivedStats"],
        nowMs: number
      ) => scene.registerStatDeltaHighlights(beforeStats, afterStats, nowMs),
      tryUseConsumable: (consumableId: ConsumableId) => scene.tryUseConsumable(consumableId),
      applyRuntimeBackgroundRemoval: () => scene.applyRuntimeBackgroundRemoval(),
      initDiagnosticsPanel: () => scene.diagnosticsRuntime.init(),
      renderDiagnosticsPanel: (nowMs: number) => scene.diagnosticsRuntime.render(nowMs),
      handlePointerDown: (pointer: Phaser.Input.Pointer) => scene.handlePointerDown(pointer),
      get inputRuntime() { return scene.inputRuntime; },
      cleanupScene: () => scene.cleanupScene()
    }) satisfies DungeonSceneShellSource;
  }

  private isBlockingOverlayOpen(): boolean {
    return this.eventPanelOpen || this.comparePromptOpen;
  }

  update(_: number, deltaMs: number): void {
    const nowMs = this.time.now;
    this.runFlowOrchestrator.update({
      runEnded: this.runEnded,
      eventPanelOpen: this.isBlockingOverlayOpen(),
      nowMs,
      deltaMs,
      onEventPanelFrame: (panelNowMs) => this.frameRuntime.runEventPanelFrame(panelNowMs, () => this.hudRuntime.render()),
      onActiveFrame: (activeNowMs, activeDeltaMs) =>
        this.frameRuntime.runActiveFrame(activeNowMs, activeDeltaMs, () => this.hudRuntime.render())
    });
  }

  private bootstrapRun(runSeed: string, difficulty: DifficultyMode): void {
    this.uiManager.clearLogs();
    this.uiManager.hideDeathOverlay();
    this.uiManager.hideEventPanel();
    this.uiManager.hideHeartbeatToast();
    this.uiManager.hideEquipmentComparePrompt();
    this.powerSpikeRuntimeModule.resetRun();
    this.heartbeatFeedbackRuntime.reset();
    this.sessionFacade.bootstrapRun(runSeed, difficulty);
    this.eventBus.emit("run:start", {
      runSeed: this.runSeed,
      floor: this.run.currentFloor,
      difficulty: this.run.difficulty,
      startedAtMs: this.run.startedAtMs,
      replayVersion: this.run.replay?.version ?? "unknown"
    });
  }

  private refreshUnlockSnapshots(): void {
    this.sessionFacade.refreshUnlockSnapshots();
  }

  private normalizeMetaForPhase4B(): void {
    this.sessionFacade.normalizeMetaForPhase4B();
  }

  private resolveLocalePreference(): void {
    this.sessionFacade.resolveLocalePreference();
  }

  private resetMutationRuntimeState(selectedMutationIds: string[]): void {
    this.sessionFacade.resetMutationRuntimeState(selectedMutationIds);
  }

  private applySynergyDerivedStatPercents(player: PlayerState): PlayerState {
    return this.sessionFacade.applySynergyDerivedStatPercents(player);
  }

  private refreshSynergyRuntime(
    persistDiscovery = true,
    options: {
      emitActivationEvents?: boolean;
      recordTelemetry?: boolean;
    } = {}
  ): void {
    this.sessionFacade.refreshSynergyRuntime(persistDiscovery, options);
  }

  private collectKnownBlueprintIds(): string[] {
    return this.sessionFacade.collectKnownBlueprintIds();
  }

  private addRunBlueprintDiscoveries(blueprintIds: string[], nowMs: number, sourceLabel: string): void {
    this.sessionFacade.addRunBlueprintDiscoveries(blueprintIds, nowMs, sourceLabel);
  }

  private tryDiscoverBlueprints(
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
  ): void {
    this.sessionFacade.tryDiscoverBlueprints(sourceType, nowMs, sourceId);
  }

  private isItemDefUnlocked(itemDef: ItemDef): boolean {
    return this.sessionFacade.isItemDefUnlocked(itemDef);
  }

  private collectMutationEffects<T extends MutationEffect["type"]>(
    type: T
  ): Array<Extract<MutationEffect, { type: T }>> {
    return this.sessionFacade.collectMutationEffects(type);
  }

  private resolveMutationMoveSpeedMultiplier(): number {
    return this.sessionFacade.resolveMutationMoveSpeedMultiplier();
  }

  private resolveMutationAttackSpeedMultiplier(nowMs: number): number {
    return this.sessionFacade.resolveMutationAttackSpeedMultiplier(nowMs);
  }

  private resolveMutationDropBonus(): { obolMultiplier: number; soulShardMultiplier: number } {
    return this.sessionFacade.resolveMutationDropBonus();
  }

  private syncEndlessMutators(nowMs: number): void {
    this.sessionFacade.syncEndlessMutators(nowMs);
  }

  private resolveHiddenRoomRevealRadius(): number {
    return this.sessionFacade.resolveHiddenRoomRevealRadius();
  }

  private applyOnKillMutationEffects(nowMs: number): void {
    this.sessionFacade.applyOnKillMutationEffects(nowMs);
  }

  private configureRngStreams(
    floor: number,
    cursor?: Partial<Record<RunRngStreamName, number>>
  ): void {
    this.sessionFacade.configureRngStreams(floor, cursor);
  }

  private refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState {
    return this.sessionFacade.refreshPlayerStatsFromEquipment(player);
  }

  private updateRuntimeBuffs(nowMs: number): void {
    this.sessionFacade.updateRuntimeBuffs(nowMs);
  }

  private updatePlayerBuffs(nowMs: number): void {
    this.sessionFacade.updatePlayerBuffs(nowMs);
  }

  private updateMonsterBuffs(monster: MonsterRuntime, nowMs: number): void {
    this.sessionFacade.updateMonsterBuffs(monster, nowMs);
  }

  private refreshMonsterBuffRuntime(monster: MonsterRuntime): void {
    this.sessionFacade.refreshMonsterBuffRuntime(monster);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.inputRuntime.handlePointerDown(pointer);
  }

  private getRunRelativeNowMs(): number {
    return Math.max(0, this.time.now - this.run.startedAtMs);
  }

  private updateKeyboardMoveIntent(nowMs: number): void {
    this.inputRuntime.updateKeyboardMoveIntent(nowMs);
  }

  private updatePlayerMovement(dt: number, nowMs: number): void {
    this.inputRuntime.updatePlayerMovement(dt, nowMs);
  }

  handleLevelUpGain(levelsGained: number, nowMs: number, source: string): void {
    this.progressionChoiceRuntime.handleLevelUpGain(levelsGained, nowMs, source);
  }

  resetFloorChoiceBudget(floor: number, nowMs: number): void {
    this.progressionChoiceRuntime.resetFloorChoiceBudget(floor, nowMs);
  }

  captureFloorChoiceBudgetSnapshot(): FloorChoiceBudgetState {
    return this.progressionChoiceRuntime.captureFloorChoiceBudgetSnapshot();
  }

  captureProgressionPromptState(nowMs: number) {
    return this.progressionChoiceRuntime.capturePromptState(nowMs);
  }

  capturePowerSpikeBudgetState(): PowerSpikeBudgetRuntimeState {
    return this.powerSpikeRuntimeModule.captureBudgetState();
  }

  restoreFloorChoiceBudgetSnapshot(snapshot: FloorChoiceBudgetState | null | undefined, nowMs: number): void {
    this.progressionChoiceRuntime.restoreFloorChoiceBudgetSnapshot(snapshot, this.run.currentFloor, nowMs);
  }

  restoreProgressionPromptState(
    snapshot: ReturnType<DungeonScene["captureProgressionPromptState"]> | null | undefined,
    nowMs: number
  ): void {
    this.progressionChoiceRuntime.restorePromptState(snapshot, nowMs);
  }

  restorePowerSpikeBudgetState(snapshot: PowerSpikeBudgetRuntimeState | null | undefined): void {
    this.powerSpikeRuntimeModule.restoreBudgetState(snapshot);
  }

  recordPlayerInput(nowMs: number): void {
    this.phase6Telemetry.recordPlayerInput(nowMs);
  }

  applyResolvedBuffs(buffs: SkillResolution["buffsApplied"], nowMs: number): void {
    for (const buff of buffs) {
      if (buff.targetId === this.player.id) {
        this.player = {
          ...this.player,
          activeBuffs: applyBuff(this.player.activeBuffs ?? [], buff)
        };
        this.player = this.refreshPlayerStatsFromEquipment(this.player);
      } else {
        const monster = this.entityManager.findMonsterById(buff.targetId);
        if (monster !== undefined) {
          monster.state = {
            ...monster.state,
            activeBuffs: applyBuff(monster.state.activeBuffs ?? [], buff)
          };
          this.refreshMonsterBuffRuntime(monster);
        }
      }
      this.eventBus.emit("buff:apply", {
        buff,
        timestampMs: nowMs
      });
    }
  }

  recordBossRewardClosed(choiceId: string, nowMs: number): void {
    this.phase6Telemetry.recordBossRewardClosed();
    this.tasteRuntime.recordHeartbeat({
      type: "player_facing_choice",
      floor: this.run.currentFloor,
      source: "boss_reward_closed",
      timestampMs: nowMs,
      detail: choiceId
    });
    this.eventBus.emit("boss_reward_closed", {
      floor: this.run.currentFloor,
      choiceId,
      timestampMs: nowMs
    });
  }

  recordSkillResolutionTelemetry(resolution: SkillResolution, nowMs: number): void {
    this.phase6Telemetry.recordSkillResolution(this.player.id, resolution);
    this.runLog.append(
      `Skill telemetry: ${resolution.buffsApplied.length} buff applies, ${resolution.events.length} combat events.`,
      "info",
      nowMs
    );
  }

  capturePhase6TelemetrySummary(elapsedMs = Math.max(0, this.time.now - this.run.startedAtMs)) {
    return this.phase6Telemetry.snapshot(elapsedMs);
  }

  capturePhase6TelemetryState(elapsedMs = Math.max(0, this.time.now - this.run.startedAtMs)) {
    return this.phase6Telemetry.exportRuntimeState(elapsedMs);
  }

  restorePhase6TelemetryState(state?: ReturnType<DungeonScene["capturePhase6TelemetryState"]>): void {
    if (state === undefined) {
      this.phase6Telemetry.resetRun(this.run.startedAtMs);
      return;
    }
    this.phase6Telemetry.restoreRuntimeState(state);
  }

  markHighValueChoice(source: string, nowMs: number): void {
    this.progressionChoiceRuntime.markHighValueChoice(source, nowMs);
    this.tasteRuntime.recordBranch(source, this.run.currentFloor, nowMs);
    if (source === "key_drop") {
      return;
    }
    this.phase6Telemetry.recordPlayerFacingChoice(this.run.currentFloor);
    this.tasteRuntime.recordHeartbeat({
      type: "player_facing_choice",
      floor: this.run.currentFloor,
      source,
      timestampMs: nowMs,
      detail: source
    });
    this.eventBus.emit("player_facing_choice", {
      floor: this.run.currentFloor,
      source,
      timestampMs: nowMs,
      detail: source
    });
  }

  ensureFloorChoiceBudget(nowMs: number): void {
    this.progressionChoiceRuntime.ensureFloorChoiceBudget(nowMs);
  }

  resolveProgressionLootTable(floor: number): LootTableDef | undefined {
    return this.progressionChoiceRuntime.resolveProgressionLootTable(floor);
  }

  resolveLootRollOptions(options: RollItemDropOptions = {}): RollItemDropOptions {
    return this.progressionChoiceRuntime.resolveLootRollOptions(options);
  }

  private resolveMinimumActiveSkillManaCost(): number | null {
    const activeSlots =
      this.player.skills?.skillSlots.filter((slot): slot is NonNullable<typeof slot> => slot !== null) ?? [];
    if (activeSlots.length === 0) {
      return null;
    }
    let minimum: number | null = null;
    for (const slot of activeSlots) {
      const skillDef = SKILL_DEF_BY_ID.get(slot.defId);
      if (skillDef === undefined) {
        continue;
      }
      const runtimeSkillDef = this.resolveRuntimeSkillDef(createSkillDefForLevel(skillDef, slot.level));
      minimum = minimum === null ? runtimeSkillDef.manaCost : Math.min(minimum, runtimeSkillDef.manaCost);
    }
    return minimum;
  }

  recordAcquiredItemTelemetry(
    item: ItemInstance,
    source: string,
    nowMs: number,
    baselinePlayer: PlayerState = this.player
  ): void {
    this.powerSpikeRuntimeModule.recordAcquiredItemTelemetry(item, source, nowMs, baselinePlayer);
    if (
      source === "merchant_purchase" ||
      source === "event_reward" ||
      source === "boss_reward" ||
      source === "challenge_reward" ||
      source === "hidden_room_reward" ||
      source === "pair_fallback"
    ) {
      this.heartbeatFeedbackRuntime.maybeQueueEquipmentCompare(item, source);
    }
  }

  private resolveRuntimeSkillDef(skillDef: SkillDef): SkillDef {
    const blueprintAugmentedSkillDef = applyForgedSkillBlueprintAugments(skillDef, this.meta.blueprintForgedIds);
    const damagePercent = this.synergyRuntime.skillDamagePercent[skillDef.id] ?? 0;
    const modifiers = this.synergyRuntime.skillModifiers[skillDef.id] ?? {};
    const cooldownOverride = this.synergyRuntime.cooldownOverridesMs[skillDef.id];
    const effectDamageScale = 1 + damagePercent;
    const manaCostScale = 1 + (modifiers.manaCost ?? 0);

    return {
      ...blueprintAugmentedSkillDef,
      cooldownMs:
        cooldownOverride === undefined
          ? blueprintAugmentedSkillDef.cooldownMs
          : Math.max(100, Math.floor(cooldownOverride)),
      manaCost: Math.max(0, Math.floor(blueprintAugmentedSkillDef.manaCost * manaCostScale)),
      effects: blueprintAugmentedSkillDef.effects.map((effect) => {
        let next = effect;
        if (effect.type === "damage" && damagePercent !== 0) {
          if (typeof effect.value === "number") {
            next = {
              ...next,
              value: effect.value * effectDamageScale
            };
          } else {
            next = {
              ...next,
              value: {
                ...effect.value,
                base: effect.value.base * effectDamageScale,
                ratio: effect.value.ratio * effectDamageScale
              }
            };
          }
        }
        if (modifiers.radius !== undefined && next.radius !== undefined) {
          next = {
            ...next,
            radius: Math.max(0.1, next.radius * (1 + modifiers.radius))
          };
        }
        if (modifiers.duration !== undefined && next.duration !== undefined) {
          next = {
            ...next,
            duration: Math.max(100, Math.floor(next.duration * (1 + modifiers.duration)))
          };
        }
        return next;
      })
    };
  }

  private emitCombatEvents(events: CombatEvent[]): void {
    for (const combat of events) {
      if (combat.kind === "dodge") {
        this.eventBus.emit("combat:dodge", { combat });
        continue;
      }
      if (combat.kind === "death") {
        this.eventBus.emit("combat:death", { combat });
        continue;
      }
      this.eventBus.emit("combat:hit", { combat });
    }
  }

  private resolveEntityLabel(entityId: string): string {
    return entityLabel({
      entityId,
      entityLabelById: this.entityLabelById,
      playerId: this.player.id,
      bossId: this.bossDef.id,
      bossName: this.bossDef.name,
      findMonsterById: (targetId) => this.entityManager.findMonsterById(targetId)
    });
  }

  private computePathTo(target: { x: number; y: number }): GridNode[] {
    return this.movementSystem.computePathTo(
      this.dungeon.walkable,
      { width: this.dungeon.width, height: this.dungeon.height },
      this.player.position,
      target,
      {
        cacheScope: `${this.dungeon.layoutHash}:${this.run.currentFloor}`,
        nowMs: this.time.now
      }
    );
  }

  private spawnMonsters(): void {
    const endlessAffixBonus = this.run.inEndless
      ? resolveEndlessAffixBonusCount(this.run.currentFloor, this.run.mutatorActiveIds ?? [])
      : 0;
    const monsters = this.monsterSpawnSystem.createMonsters({
      dungeon: this.dungeon,
      playerPosition: this.player.position,
      floor: this.run.currentFloor,
      floorConfig: this.floorConfig,
      enemyBaseHealth: GAME_CONFIG.enemyBaseHealth,
      enemyBaseDamage: GAME_CONFIG.enemyBaseDamage,
      archetypes: MONSTER_ARCHETYPES,
      biomeMonsterPool: this.currentBiome.monsterPool,
      blockedPositions: this.hazards.map((hazard) => hazard.position),
      unlockedAffixes: this.unlockedAffixIds,
      extraAffixCount: endlessAffixBonus,
      affixPolicy: this.run.difficultyModifier.affixPolicy,
      rng: this.spawnRng
    });

    const runtimes = monsters.map((monster) => this.renderSystem.spawnMonster(monster.state, monster.archetype, this.origin));
    for (const runtime of runtimes) {
      this.entityLabelById.set(runtime.state.id, runtime.archetype.name);
      for (const affix of runtime.state.affixes ?? []) {
        this.eventBus.emit("monster:affixApplied", {
          monsterId: runtime.state.id,
          affixId: affix,
          timestampMs: this.time.now
        });
      }
    }
    this.entityManager.setMonsters(runtimes);
  }

  grantFloorPairFallbackReward(nowMs: number): void {
    this.powerSpikeRuntimeModule.grantFloorPairFallbackReward(nowMs);
  }

  grantStoryBossReward(nowMs: number): ItemInstance[] {
    const rewards = this.powerSpikeRuntimeModule.grantStoryBossReward(nowMs);
    for (const item of rewards) {
      this.heartbeatFeedbackRuntime.maybeQueueEquipmentCompare(item, "boss_reward");
    }
    return rewards;
  }

  flushBossRewardComparePrompts(onDrained: () => void): boolean {
    return this.heartbeatFeedbackRuntime.flushImmediateComparePrompts(onDrained);
  }

  private tryUseSkill(slotIndex: number): void {
    this.playerActionModule.tryUseSkill(slotIndex);
  }

  private tryUseConsumable(consumableId: ConsumableId): void {
    this.playerActionModule.tryUseConsumable(consumableId);
  }

  private registerStatDeltaHighlights(
    beforeStats: PlayerState["derivedStats"],
    afterStats: PlayerState["derivedStats"],
    nowMs: number
  ): void {
    this.hudRuntime.registerStatDeltaHighlights(beforeStats, afterStats, nowMs);
  }

  private flushRunSave(): void {
    this.runPersistenceModule.flush();
  }

  private scheduleRunSave(): void {
    this.runPersistenceModule.schedule();
  }

  private cleanupScene(): void {
    if (this.cleanupStarted) {
      return;
    }
    this.cleanupStarted = true;
    const before =
      this.diagnosticsEnabled === true
        ? (() => {
            try {
              return this.diagnosticsRuntime.snapshot();
            } catch {
              return { error: "collect-before-failed" };
            }
          })()
        : null;

    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleImageLoadError, this);
    this.imageFallbackRetried.clear();
    if (!this.runEnded) {
      this.flushRunSave();
    }
    this.saveCoordinator.dispose();
    this.sfxSystem.shutdown();
    this.vfxSystem.shutdown();
    this.eventBus.removeAll();
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.inputRuntime.clearKeyboardBindings();
    this.uiManager.reset();
    if (!this.preserveSceneTransitionOnCleanup) {
      hideSceneTransition();
    }
    this.debugRuntimeModule.uninstall();
    this.eventRuntimeModule.destroyEventNode();
    this.progressionRuntimeModule.clearHiddenRoomMarkers();
    this.hazardRuntimeModule.clearHazards();
    this.movementSystem.clearPathCache();
    this.manualMoveTarget = null;
    this.manualMoveTargetFailures = 0;
    this.nextManualPathReplanAt = 0;
    this.nextKeyboardMoveInputAt = 0;
    this.newlyAcquiredItemUntilMs.clear();
    this.previousSkillCooldownLeftById.clear();
    this.skillReadyFlashUntilMsById.clear();
    this.statHighlightEntries = [];
    this.levelUpPulseUntilMs = 0;
    this.levelUpPulseLevel = null;
    this.nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
    this.playerActionModule.resetRuntimeState();
    this.cursorKeys = null;
    this.entityManager.clear();
    this.diagnosticsRuntime.reset();
    if (this.diagnosticsEnabled) {
      const after = this.diagnosticsRuntime.snapshot();
      console.info("[Blodex] cleanup diagnostics", {
        before,
        after
      });
    }
  }
}
