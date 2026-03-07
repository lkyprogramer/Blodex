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
  appendReplayInput,
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
import { gridToIso, isoToGrid } from "../systems/iso";
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
import { consumableDescriptionLabel, consumableFailureReasonLabel, consumableNameLabel, difficultyLabel } from "../i18n/labelResolvers";
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
import type { DebugCommandHost } from "./dungeon/debug/ports";
import { DebugRuntimeModule } from "./dungeon/debug/DebugRuntimeModule";
import {
  resolveDebugCheatsEnabled,
  resolveDebugLockedEquipEnabled,
  resolveDebugQueryFlag
} from "./dungeon/debug/debugFlags";
import { injectDebugLockedEquipment } from "./dungeon/debug/injectDebugLockedEquipment";
import { DiagnosticsService } from "./dungeon/diagnostics/DiagnosticsService";
import { HeartbeatFeedbackRuntime, type HeartbeatFeedbackRuntimeHost } from "./dungeon/feedback/HeartbeatFeedbackRuntime";
import { BossCombatService } from "./dungeon/encounter/BossCombatService";
import { BossRuntimeModule, type BossRuntimeHost } from "./dungeon/encounter/BossRuntimeModule";
import { BossSpawnService } from "./dungeon/encounter/BossSpawnService";
import { BossTelegraphPresenter } from "./dungeon/encounter/BossTelegraphPresenter";
import type { BossCombatHost, BossSpawnHost, BossTelegraphHost } from "./dungeon/encounter/ports";
import { EncounterController } from "./dungeon/encounter/EncounterController";
import { PlayerActionModule, type PlayerActionHost } from "./dungeon/encounter/PlayerActionModule";
import { entityLabel } from "./dungeon/logging/labelResolvers";
import {
  bindDomainEventEffects,
  type DomainEventEffectHost
} from "./dungeon/logging/DomainEventEffectBinder";
import { RunLogService } from "./dungeon/logging/RunLogService";
import { RunFlowOrchestrator } from "./dungeon/orchestrator/RunFlowOrchestrator";
import { ProgressionChoiceRuntime, type ProgressionChoiceHost } from "./dungeon/progression/ProgressionChoiceRuntime";
import { RunCompletionModule, type RunCompletionHost } from "./dungeon/run/RunCompletionModule";
import { resolveInitialRunSeed } from "./dungeon/run/resolveInitialRunSeed";
import { RunPersistenceModule } from "./dungeon/save/RunPersistenceModule";
import { RunSaveSnapshotBuilder } from "./dungeon/save/RunSaveSnapshotBuilder";
import { RunStateRestorer } from "./dungeon/save/RunStateRestorer";
import type { RunSaveSnapshotHost, RunStateRestoreHost } from "./dungeon/save/savePorts";
import { SaveCoordinator } from "./dungeon/save/SaveCoordinator";
import { applyForgedSkillBlueprintAugments } from "./dungeon/skills/skillBlueprintRuntime";
import { Phase6TelemetryTracker } from "./dungeon/taste/Phase6Telemetry";
import { PowerSpikeRuntimeModule, type PowerSpikeRuntimeHost } from "./dungeon/taste/PowerSpikeRuntimeModule";
import { TasteRuntimePortHub } from "./dungeon/taste/TasteRuntimePorts";
import { HudPresenter } from "./dungeon/ui/HudPresenter";
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
import type {
  DeferredOutcomeHost,
  HazardRuntimeHost,
  ProgressionRuntimeHost,
  RuntimeEventHost
} from "./dungeon/world/types";
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
const MANUAL_PATH_REPLAN_INTERVAL_MS = 90;
const KEYBOARD_MOVE_INPUT_INTERVAL_MS = 70;
const AI_ACTIVE_RADIUS_TILES = 10;
const AI_FAR_UPDATE_INTERVAL_FRAMES = 3;
const ELITE_DROP_TABLE_ID = "catacomb_elite";
const NEAR_DEATH_ARM_THRESHOLD = 0.2;
const NEAR_DEATH_RECOVERY_THRESHOLD = 0.45;
const NEAR_DEATH_RECOVERY_WINDOW_MS = 8_000;
const NEAR_DEATH_FEEDBACK_COOLDOWN_MS = 10_000;
const MONSTER_COMBAT_RADIUS_TILES = 12;
const LOOT_PICKUP_RADIUS_TILES = 1.15;
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
  private readonly debugCommandRegistry = new DebugCommandRegistry(this.createDebugCommandHost());
  private readonly runSaveSnapshotBuilder = new RunSaveSnapshotBuilder({
    host: this.createRunSaveSnapshotHost(),
    appVersion: RUN_SAVE_APP_VERSION
  });
  private readonly runStateRestorer = new RunStateRestorer({
    host: this.createRunStateRestoreHost()
  });
  private readonly contentLocalizer = getContentLocalizer();
  private readonly runLog = new RunLogService({
    append: () => {
      // UI sink is bound in create().
    }
  }, getI18nService());
  private readonly deferredOutcomeRuntime = new DeferredOutcomeRuntime({
    host: this.createDeferredOutcomeHost()
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
    host: this as unknown as ProgressionChoiceHost
  });
  private readonly tasteRuntime = new TasteRuntimePortHub();
  private readonly phase6Telemetry = new Phase6TelemetryTracker();
  private readonly powerSpikeRuntimeModule = new PowerSpikeRuntimeModule({
    host: this.createPowerSpikeRuntimeHost()
  });
  private readonly heartbeatFeedbackRuntime = new HeartbeatFeedbackRuntime(this.createHeartbeatFeedbackHost());
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
        this.dispatchFeedbackAction(action);
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

  private createPowerSpikeRuntimeHost(): PowerSpikeRuntimeHost {
    const scene = this;
    return {
      get runSeed() { return scene.runSeed; },
      get run() { return scene.run; },
      set run(value) { scene.run = value; },
      get player() { return scene.player; },
      set player(value) { scene.player = value; },
      get bossDef() { return scene.bossDef; },
      get staircaseState() { return scene.staircaseState; },
      get lootRng() { return scene.lootRng; },
      get origin() { return scene.origin; },
      get eventBus() { return scene.eventBus; },
      get renderSystem() { return scene.renderSystem; },
      get entityManager() { return scene.entityManager; },
      get tasteRuntime() { return scene.tasteRuntime; },
      get phase6Telemetry() { return scene.phase6Telemetry; },
      get contentLocalizer() { return scene.contentLocalizer; },
      get runLog() { return scene.runLog; },
      get hudDirty() { return scene.hudDirty; },
      set hudDirty(value) { scene.hudDirty = value; },
      markHighValueChoice(source, nowMs) { scene.markHighValueChoice(source, nowMs); },
      resolveProgressionLootTable(floor) { return scene.resolveProgressionLootTable(floor); },
      resolveLootRollOptions(options) { return scene.resolveLootRollOptions(options); },
      isItemDefUnlocked(itemDef) { return scene.isItemDefUnlocked(itemDef); }
    };
  }

  private createHeartbeatFeedbackHost(): HeartbeatFeedbackRuntimeHost {
    const scene = this;
    return {
      get eventBus() {
        return scene.eventBus;
      },
      get uiManager() {
        return scene.uiManager;
      },
      get contentLocalizer() {
        return scene.contentLocalizer;
      },
      get player() {
        return scene.player;
      },
      routeFeedback(input) {
        scene.routeFeedback(input);
      },
      get eventPanelOpen() {
        return scene.eventPanelOpen;
      },
      get comparePromptOpen() {
        return scene.comparePromptOpen;
      },
      set comparePromptOpen(value) {
        scene.comparePromptOpen = value;
      },
      get hudDirty() {
        return scene.hudDirty;
      },
      set hudDirty(value) {
        scene.hudDirty = value;
      }
    };
  }

  private createRunSaveSnapshotHost(): RunSaveSnapshotHost {
    const scene = this;
    return {
      get runEnded() {
        return scene.runEnded;
      },
      get runSeed() {
        return scene.runSeed;
      },
      get run() {
        return scene.run;
      },
      get player() {
        return scene.player;
      },
      get consumables() {
        return scene.consumables;
      },
      get dungeon() {
        return scene.dungeon;
      },
      get staircaseState() {
        return scene.staircaseState;
      },
      get hazards() {
        return scene.hazards;
      },
      get bossState() {
        return scene.bossState;
      },
      get eventNode() {
        return scene.eventNode;
      },
      get merchantOffers() {
        return scene.merchantOffers;
      },
      get mapRevealActive() {
        return scene.mapRevealActive;
      },
      get blueprintFoundIdsInRun() {
        return scene.blueprintFoundIdsInRun;
      },
      get mutationRuntime() {
        return scene.mutationRuntime;
      },
      get deferredOutcomes() {
        return scene.deferredOutcomes;
      },
      get uiManager() {
        return scene.uiManager;
      },
      get entityManager() {
        return scene.entityManager;
      },
      get saveManager() {
        return scene.saveManager;
      },
      captureFloorChoiceBudgetSnapshot() {
        return scene.captureFloorChoiceBudgetSnapshot();
      },
      captureProgressionPromptState(nowMs) {
        return scene.captureProgressionPromptState(nowMs);
      },
      capturePowerSpikeBudgetState() {
        return scene.capturePowerSpikeBudgetState();
      },
      capturePhase6TelemetryState(elapsedMs) {
        return scene.capturePhase6TelemetryState(elapsedMs);
      },
      get spawnRng() {
        return scene.spawnRng;
      },
      get combatRng() {
        return scene.combatRng;
      },
      get lootRng() {
        return scene.lootRng;
      },
      get skillRng() {
        return scene.skillRng;
      },
      get bossRng() {
        return scene.bossRng;
      },
      get biomeRng() {
        return scene.biomeRng;
      },
      get hazardRng() {
        return scene.hazardRng;
      },
      get eventRng() {
        return scene.eventRng;
      },
      get merchantRng() {
        return scene.merchantRng;
      }
    };
  }

  private createRunStateRestoreHost(): RunStateRestoreHost {
    const scene = this;
    return {
      get pendingResumeSave() {
        return scene.pendingResumeSave;
      },
      set pendingResumeSave(value) {
        scene.pendingResumeSave = value;
      },
      get runSeed() {
        return scene.runSeed;
      },
      set runSeed(value) {
        scene.runSeed = value;
      },
      get run() {
        return scene.run;
      },
      set run(value) {
        scene.run = value;
      },
      get dailyPracticeMode() {
        return scene.dailyPracticeMode;
      },
      set dailyPracticeMode(value) {
        scene.dailyPracticeMode = value;
      },
      get dailyFixedWeaponType() {
        return scene.dailyFixedWeaponType;
      },
      set dailyFixedWeaponType(value) {
        scene.dailyFixedWeaponType = value;
      },
      get selectedDifficulty() {
        return scene.selectedDifficulty;
      },
      set selectedDifficulty(value) {
        scene.selectedDifficulty = value;
      },
      get runEnded() {
        return scene.runEnded;
      },
      set runEnded(value) {
        scene.runEnded = value;
      },
      get lastDeathReason() {
        return scene.lastDeathReason;
      },
      set lastDeathReason(value) {
        scene.lastDeathReason = value;
      },
      get manualMoveTarget() {
        return scene.manualMoveTarget;
      },
      set manualMoveTarget(value) {
        scene.manualMoveTarget = value;
      },
      get manualMoveTargetFailures() {
        return scene.manualMoveTargetFailures;
      },
      set manualMoveTargetFailures(value) {
        scene.manualMoveTargetFailures = value;
      },
      get nextManualPathReplanAt() {
        return scene.nextManualPathReplanAt;
      },
      set nextManualPathReplanAt(value) {
        scene.nextManualPathReplanAt = value;
      },
      get nextKeyboardMoveInputAt() {
        return scene.nextKeyboardMoveInputAt;
      },
      set nextKeyboardMoveInputAt(value) {
        scene.nextKeyboardMoveInputAt = value;
      },
      get eventPanelOpen() {
        return scene.eventPanelOpen;
      },
      set eventPanelOpen(value) {
        scene.eventPanelOpen = value;
      },
      get statHighlightEntries() {
        return scene.statHighlightEntries;
      },
      set statHighlightEntries(value) {
        scene.statHighlightEntries = value;
      },
      get levelUpPulseUntilMs() {
        return scene.levelUpPulseUntilMs;
      },
      set levelUpPulseUntilMs(value) {
        scene.levelUpPulseUntilMs = value;
      },
      get levelUpPulseLevel() {
        return scene.levelUpPulseLevel;
      },
      set levelUpPulseLevel(value) {
        scene.levelUpPulseLevel = value;
      },
      get nextTransientHudRefreshAt() {
        return scene.nextTransientHudRefreshAt;
      },
      set nextTransientHudRefreshAt(value) {
        scene.nextTransientHudRefreshAt = value;
      },
      get lastAiNearCount() {
        return scene.lastAiNearCount;
      },
      set lastAiNearCount(value) {
        scene.lastAiNearCount = value;
      },
      get lastAiFarCount() {
        return scene.lastAiFarCount;
      },
      set lastAiFarCount(value) {
        scene.lastAiFarCount = value;
      },
      get path() {
        return scene.path;
      },
      set path(value) {
        scene.path = value;
      },
      get blueprintFoundIdsInRun() {
        return scene.blueprintFoundIdsInRun;
      },
      set blueprintFoundIdsInRun(value) {
        scene.blueprintFoundIdsInRun = value;
      },
      get attackTargetId() {
        return scene.attackTargetId;
      },
      set attackTargetId(value) {
        scene.attackTargetId = value;
      },
      get nextPlayerAttackAt() {
        return scene.nextPlayerAttackAt;
      },
      set nextPlayerAttackAt(value) {
        scene.nextPlayerAttackAt = value;
      },
      get nextBossAttackAt() {
        return scene.nextBossAttackAt;
      },
      set nextBossAttackAt(value) {
        scene.nextBossAttackAt = value;
      },
      get consumables() {
        return scene.consumables;
      },
      set consumables(value) {
        scene.consumables = value;
      },
      get mapRevealActive() {
        return scene.mapRevealActive;
      },
      set mapRevealActive(value) {
        scene.mapRevealActive = value;
      },
      get deferredOutcomes() {
        return scene.deferredOutcomes;
      },
      set deferredOutcomes(value) {
        scene.deferredOutcomes = value;
      },
      get merchantOffers() {
        return scene.merchantOffers;
      },
      set merchantOffers(value) {
        scene.merchantOffers = value;
      },
      get floorConfig() {
        return scene.floorConfig;
      },
      set floorConfig(value) {
        scene.floorConfig = value;
      },
      get currentBiome() {
        return scene.currentBiome;
      },
      set currentBiome(value) {
        scene.currentBiome = value;
      },
      get dungeon() {
        return scene.dungeon;
      },
      set dungeon(value) {
        scene.dungeon = value;
      },
      get player() {
        return scene.player;
      },
      set player(value) {
        scene.player = value;
      },
      get staircaseState() {
        return scene.staircaseState;
      },
      set staircaseState(value) {
        scene.staircaseState = value;
      },
      get origin() {
        return scene.origin;
      },
      set origin(value) {
        scene.origin = value;
      },
      get worldBounds() {
        return scene.worldBounds;
      },
      set worldBounds(value) {
        scene.worldBounds = value;
      },
      get playerSprite() {
        return scene.playerSprite;
      },
      set playerSprite(value) {
        scene.playerSprite = value;
      },
      get playerYOffset() {
        return scene.playerYOffset;
      },
      set playerYOffset(value) {
        scene.playerYOffset = value;
      },
      get bossDef() {
        return scene.bossDef;
      },
      get bossState() {
        return scene.bossState;
      },
      set bossState(value) {
        scene.bossState = value;
      },
      get bossSprite() {
        return scene.bossSprite;
      },
      set bossSprite(value) {
        scene.bossSprite = value;
      },
      get hudDirty() {
        return scene.hudDirty;
      },
      set hudDirty(value) {
        scene.hudDirty = value;
      },
      get resumedFromSave() {
        return scene.resumedFromSave;
      },
      set resumedFromSave(value) {
        scene.resumedFromSave = value;
      },
      get lastAutoSaveAt() {
        return scene.lastAutoSaveAt;
      },
      set lastAutoSaveAt(value) {
        scene.lastAutoSaveAt = value;
      },
      get lastMinimapRefreshAt() {
        return scene.lastMinimapRefreshAt;
      },
      set lastMinimapRefreshAt(value) {
        scene.lastMinimapRefreshAt = value;
      },
      get eventNode() {
        return scene.eventNode;
      },
      get entityLabelById() {
        return scene.entityLabelById;
      },
      get newlyAcquiredItemUntilMs() {
        return scene.newlyAcquiredItemUntilMs;
      },
      get previousSkillCooldownLeftById() {
        return scene.previousSkillCooldownLeftById;
      },
      get skillReadyFlashUntilMsById() {
        return scene.skillReadyFlashUntilMsById;
      },
      get time() {
        return scene.time;
      },
      get meta() {
        return scene.meta;
      },
      get children() {
        return scene.children;
      },
      get cameras() {
        return scene.cameras;
      },
      get uiManager() {
        return scene.uiManager;
      },
      get entityManager() {
        return scene.entityManager;
      },
      get hazardRuntimeModule() {
        return scene.hazardRuntimeModule;
      },
      get progressionRuntimeModule() {
        return scene.progressionRuntimeModule;
      },
      get movementSystem() {
        return scene.movementSystem;
      },
      get renderSystem() {
        return scene.renderSystem;
      },
      get eventRuntimeModule() {
        return scene.eventRuntimeModule;
      },
      get sfxSystem() {
        return scene.sfxSystem;
      },
      syncEndlessMutators(nowMs) {
        scene.syncEndlessMutators(nowMs);
      },
      resolveDailyWeaponType(runSeed) {
        return scene.resolveDailyWeaponType(runSeed);
      },
      refreshUnlockSnapshots() {
        scene.refreshUnlockSnapshots();
      },
      configureRngStreams(floor, cursor) {
        scene.configureRngStreams(floor, cursor);
      },
      refreshPlayerStatsFromEquipment(player) {
        return scene.refreshPlayerStatsFromEquipment(player);
      },
      restorePhase6TelemetryState(state) {
        scene.restorePhase6TelemetryState(state);
      },
      updateMinimap(nowMs) {
        scene.updateMinimap(nowMs);
      },
      resetMutationRuntimeState(selectedIds) {
        scene.resetMutationRuntimeState(selectedIds);
      },
      refreshSynergyRuntime(persistDiscovery, options) {
        scene.refreshSynergyRuntime(persistDiscovery, options);
      },
      restoreFloorChoiceBudgetSnapshot(snapshot, nowMs) {
        scene.restoreFloorChoiceBudgetSnapshot(snapshot, nowMs);
      },
      restoreProgressionPromptState(snapshot, nowMs) {
        scene.restoreProgressionPromptState(snapshot, nowMs);
      },
      restorePowerSpikeBudgetState(snapshot) {
        scene.restorePowerSpikeBudgetState(snapshot);
      },
      resetFloorChoiceBudget(floor, nowMs) {
        scene.resetFloorChoiceBudget(floor, nowMs);
      }
    };
  }

  private createHazardRuntimeHost(): HazardRuntimeHost {
    const scene = this;
    return {
      get hazardVisuals() {
        return scene.hazardVisuals;
      },
      set hazardVisuals(value) {
        scene.hazardVisuals = value;
      },
      get hazards() {
        return scene.hazards;
      },
      set hazards(value) {
        scene.hazards = value;
      },
      get playerHazardContact() {
        return scene.playerHazardContact;
      },
      get floorConfig() {
        return scene.floorConfig;
      },
      get currentBiome() {
        return scene.currentBiome;
      },
      get run() {
        return scene.run;
      },
      set run(value) {
        scene.run = value;
      },
      get hazardRng() {
        return scene.hazardRng;
      },
      get dungeon() {
        return scene.dungeon;
      },
      get player() {
        return scene.player;
      },
      set player(value) {
        scene.player = value;
      },
      get renderSystem() {
        return scene.renderSystem;
      },
      get origin() {
        return scene.origin;
      },
      get eventBus() {
        return scene.eventBus;
      },
      get entityManager() {
        return scene.entityManager;
      },
      get progressionRuntimeModule() {
        return scene.progressionRuntimeModule;
      },
      tryDiscoverBlueprints(sourceType, nowMs, sourceId) {
        scene.tryDiscoverBlueprints(sourceType, nowMs, sourceId);
      },
      applyOnKillMutationEffects(nowMs) {
        scene.applyOnKillMutationEffects(nowMs);
      },
      resolveMutationDropBonus() {
        return scene.resolveMutationDropBonus();
      },
      get lastDeathReason() {
        return scene.lastDeathReason;
      },
      set lastDeathReason(value) {
        scene.lastDeathReason = value;
      },
      get hudDirty() {
        return scene.hudDirty;
      },
      set hudDirty(value) {
        scene.hudDirty = value;
      }
    };
  }

  private createProgressionRuntimeHost(): ProgressionRuntimeHost {
    const scene = this;
    return {
      get children() {
        return scene.children;
      },
      get entityManager() {
        return scene.entityManager;
      },
      get hazardRuntimeModule() {
        return scene.hazardRuntimeModule;
      },
      get movementSystem() {
        return scene.movementSystem;
      },
      get floorConfig() {
        return scene.floorConfig;
      },
      set floorConfig(value) {
        scene.floorConfig = value;
      },
      configureRngStreams(floor) {
        scene.configureRngStreams(floor);
      },
      get run() {
        return scene.run;
      },
      set run(value) {
        scene.run = value;
      },
      get runSeed() {
        return scene.runSeed;
      },
      get unlockedBiomeIds() {
        return scene.unlockedBiomeIds;
      },
      get currentBiome() {
        return scene.currentBiome;
      },
      set currentBiome(value) {
        scene.currentBiome = value;
      },
      get mapRevealActive() {
        return scene.mapRevealActive;
      },
      set mapRevealActive(value) {
        scene.mapRevealActive = value;
      },
      get eventPanelOpen() {
        return scene.eventPanelOpen;
      },
      set eventPanelOpen(value) {
        scene.eventPanelOpen = value;
      },
      get merchantOffers() {
        return scene.merchantOffers;
      },
      set merchantOffers(value) {
        scene.merchantOffers = value;
      },
      get uiManager() {
        return scene.uiManager;
      },
      get eventRuntimeModule() {
        return scene.eventRuntimeModule;
      },
      get dungeon() {
        return scene.dungeon;
      },
      set dungeon(value) {
        scene.dungeon = value;
      },
      get player() {
        return scene.player;
      },
      set player(value) {
        scene.player = value;
      },
      refreshPlayerStatsFromEquipment(player) {
        return scene.refreshPlayerStatsFromEquipment(player);
      },
      applyDailyLoadout(player, nowMs) {
        return scene.applyDailyLoadout(player, nowMs);
      },
      get time() {
        return scene.time;
      },
      get debugCheatsEnabled() {
        return scene.debugCheatsEnabled;
      },
      get debugLockedEquipQuery() {
        return scene.debugLockedEquipQuery;
      },
      get debugLockedEquipIconId() {
        return scene.debugLockedEquipIconId;
      },
      get runLog() {
        return scene.runLog;
      },
      get entityLabelById() {
        return scene.entityLabelById;
      },
      get path() {
        return scene.path;
      },
      set path(value) {
        scene.path = value;
      },
      get attackTargetId() {
        return scene.attackTargetId;
      },
      set attackTargetId(value) {
        scene.attackTargetId = value;
      },
      get manualMoveTarget() {
        return scene.manualMoveTarget;
      },
      set manualMoveTarget(value) {
        scene.manualMoveTarget = value;
      },
      get manualMoveTargetFailures() {
        return scene.manualMoveTargetFailures;
      },
      set manualMoveTargetFailures(value) {
        scene.manualMoveTargetFailures = value;
      },
      get nextManualPathReplanAt() {
        return scene.nextManualPathReplanAt;
      },
      set nextManualPathReplanAt(value) {
        scene.nextManualPathReplanAt = value;
      },
      get nextPlayerAttackAt() {
        return scene.nextPlayerAttackAt;
      },
      set nextPlayerAttackAt(value) {
        scene.nextPlayerAttackAt = value;
      },
      get nextBossAttackAt() {
        return scene.nextBossAttackAt;
      },
      set nextBossAttackAt(value) {
        scene.nextBossAttackAt = value;
      },
      get bossState() {
        return scene.bossState;
      },
      set bossState(value) {
        scene.bossState = value;
      },
      get bossSprite() {
        return scene.bossSprite;
      },
      set bossSprite(value) {
        scene.bossSprite = value;
      },
      get staircaseState() {
        return scene.staircaseState;
      },
      set staircaseState(value) {
        scene.staircaseState = value;
      },
      get renderSystem() {
        return scene.renderSystem;
      },
      get origin() {
        return scene.origin;
      },
      set origin(value) {
        scene.origin = value;
      },
      get worldBounds() {
        return scene.worldBounds;
      },
      set worldBounds(value) {
        scene.worldBounds = value;
      },
      get cameras() {
        return scene.cameras;
      },
      get playerSprite() {
        return scene.playerSprite;
      },
      set playerSprite(value) {
        scene.playerSprite = value;
      },
      get playerYOffset() {
        return scene.playerYOffset;
      },
      set playerYOffset(value) {
        scene.playerYOffset = value;
      },
      get bossRuntimeModule() {
        return scene.bossRuntimeModule;
      },
      spawnMonsters() {
        scene.spawnMonsters();
      },
      resetFloorChoiceBudget(floor, nowMs) {
        scene.resetFloorChoiceBudget(floor, nowMs);
      },
      get lastMinimapRefreshAt() {
        return scene.lastMinimapRefreshAt;
      },
      set lastMinimapRefreshAt(value) {
        scene.lastMinimapRefreshAt = value;
      },
      updateMinimap(nowMs) {
        scene.updateMinimap(nowMs);
      },
      refreshSynergyRuntime(persistDiscovery) {
        scene.refreshSynergyRuntime(persistDiscovery);
      },
      get hudDirty() {
        return scene.hudDirty;
      },
      set hudDirty(value) {
        scene.hudDirty = value;
      },
      get runEnded() {
        return scene.runEnded;
      },
      set runEnded(value) {
        scene.runEnded = value;
      },
      get talentEffects() {
        return scene.talentEffects;
      },
      get meta() {
        return scene.meta;
      },
      get lootRng() {
        return scene.lootRng;
      },
      get spawnRng() {
        return scene.spawnRng;
      },
      get eventRng() {
        return scene.eventRng;
      },
      get unlockedAffixIds() {
        return scene.unlockedAffixIds;
      },
      get hiddenEntranceMarkers() {
        return scene.hiddenEntranceMarkers;
      },
      resolveProgressionLootTable(floor) {
        return scene.resolveProgressionLootTable(floor);
      },
      resolveLootRollOptions(options) {
        return scene.resolveLootRollOptions(options);
      },
      isItemDefUnlocked(itemDef) {
        return scene.isItemDefUnlocked(itemDef);
      },
      spawnLootDrop(item, position, source) {
        scene.powerSpikeRuntimeModule.spawnLootDrop(item, position, source, scene.time.now);
      },
      tryDiscoverBlueprints(sourceType, nowMs, sourceId) {
        scene.tryDiscoverBlueprints(sourceType, nowMs, sourceId);
      },
      scheduleRunSave() {
        scene.scheduleRunSave();
      },
      resolveHiddenRoomRevealRadius() {
        return scene.resolveHiddenRoomRevealRadius();
      },
      get challengeMarker() {
        return scene.challengeMarker;
      },
      set challengeMarker(value) {
        scene.challengeMarker = value;
      },
      get challengeRoomState() {
        return scene.challengeRoomState;
      },
      set challengeRoomState(value) {
        scene.challengeRoomState = value;
      },
      get challengeWaveTotal() {
        return scene.challengeWaveTotal;
      },
      set challengeWaveTotal(value) {
        scene.challengeWaveTotal = value;
      },
      get challengeMonsterIds() {
        return scene.challengeMonsterIds;
      },
      get eventBus() {
        return scene.eventBus;
      },
      get add() {
        return scene.add;
      },
      get tileWidth() {
        return scene.tileWidth;
      },
      get tileHeight() {
        return scene.tileHeight;
      },
      get entityDepthOffset() {
        return scene.entityDepthOffset;
      }
    };
  }

  private createDeferredOutcomeHost(): DeferredOutcomeHost {
    const scene = this;
    return {
      get eventRng() {
        return scene.eventRng;
      },
      get run() {
        return scene.run;
      },
      set run(value) {
        scene.run = value;
      },
      get deferredOutcomes() {
        return scene.deferredOutcomes;
      },
      set deferredOutcomes(value) {
        scene.deferredOutcomes = value;
      },
      get runLog() {
        return scene.runLog;
      },
      scheduleRunSave() {
        scene.scheduleRunSave();
      },
      get hudDirty() {
        return scene.hudDirty;
      },
      set hudDirty(value) {
        scene.hudDirty = value;
      },
      get player() {
        return scene.player;
      },
      set player(value) {
        scene.player = value;
      },
      get lootRng() {
        return scene.lootRng;
      },
      resolveLootRollOptions(options) {
        return scene.resolveLootRollOptions(options);
      },
      isItemDefUnlocked(itemDef) {
        return scene.isItemDefUnlocked(itemDef);
      },
      get contentLocalizer() {
        return scene.contentLocalizer;
      }
    };
  }

  private createBossSpawnHost(): BossSpawnHost {
    const scene = this;
    return {
      get dungeon() {
        return scene.dungeon;
      },
      get bossDef() {
        return scene.bossDef;
      },
      get bossState() {
        return scene.bossState;
      },
      set bossState(value) {
        scene.bossState = value;
      },
      get bossSprite() {
        return scene.bossSprite;
      },
      set bossSprite(value) {
        scene.bossSprite = value;
      },
      get entityLabelById() {
        return scene.entityLabelById;
      },
      get renderSystem() {
        return scene.renderSystem;
      },
      get entityManager() {
        return scene.entityManager;
      },
      get origin() {
        return scene.origin;
      },
      get run() {
        return scene.run;
      },
      get unlockedAffixIds() {
        return scene.unlockedAffixIds;
      },
      get spawnRng() {
        return scene.spawnRng;
      },
      get time() {
        return scene.time;
      },
      get floorConfig() {
        return scene.floorConfig;
      },
      get eventBus() {
        return scene.eventBus;
      }
    };
  }

  private createBossTelegraphHost(): BossTelegraphHost {
    const scene = this;
    return {
      get renderSystem() {
        return scene.renderSystem;
      },
      get origin() {
        return scene.origin;
      },
      get tweens() {
        return scene.tweens;
      },
      get tileWidth() {
        return scene.tileWidth;
      },
      get tileHeight() {
        return scene.tileHeight;
      }
    };
  }

  private createBossCombatHost(): BossCombatHost {
    const scene = this;
    return {
      get floorConfig() {
        return scene.floorConfig;
      },
      get bossState() {
        return scene.bossState;
      },
      set bossState(value) {
        scene.bossState = value;
      },
      get player() {
        return scene.player;
      },
      set player(value) {
        scene.player = value;
      },
      resolveMutationAttackSpeedMultiplier(nowMs) {
        return scene.resolveMutationAttackSpeedMultiplier(nowMs);
      },
      get nextPlayerAttackAt() {
        return scene.nextPlayerAttackAt;
      },
      set nextPlayerAttackAt(value) {
        scene.nextPlayerAttackAt = value;
      },
      get combatRng() {
        return scene.combatRng;
      },
      get eventBus() {
        return scene.eventBus;
      },
      get bossDef() {
        return scene.bossDef;
      },
      get hudDirty() {
        return scene.hudDirty;
      },
      set hudDirty(value) {
        scene.hudDirty = value;
      },
      get nextBossAttackAt() {
        return scene.nextBossAttackAt;
      },
      set nextBossAttackAt(value) {
        scene.nextBossAttackAt = value;
      },
      get bossRng() {
        return scene.bossRng;
      },
      emitCombatEvents(events) {
        scene.emitCombatEvents(events);
      }
    };
  }

  private createDebugCommandHost(): DebugCommandHost {
    const scene = this;
    return {
      collectDiagnosticsSnapshot() {
        return scene.collectDiagnosticsSnapshot();
      },
      get entityManager() {
        return scene.entityManager;
      },
      get eventBus() {
        return scene.eventBus;
      },
      bootstrapRun(runSeed, difficulty) {
        scene.bootstrapRun(runSeed, difficulty);
      },
      get time() {
        return scene.time;
      },
      get selectedDifficulty() {
        return scene.selectedDifficulty;
      },
      get runSeed() {
        return scene.runSeed;
      },
      get hudDirty() {
        return scene.hudDirty;
      },
      set hudDirty(value) {
        scene.hudDirty = value;
      },
      get runEnded() {
        return scene.runEnded;
      },
      set runEnded(value) {
        scene.runEnded = value;
      },
      get run() {
        return scene.run;
      },
      set run(value) {
        scene.run = value;
      },
      get consumables() {
        return scene.consumables;
      },
      set consumables(value) {
        scene.consumables = value;
      },
      get floorConfig() {
        return scene.floorConfig;
      },
      get eventPanelOpen() {
        return scene.eventPanelOpen;
      },
      set eventPanelOpen(value) {
        scene.eventPanelOpen = value;
      },
      get eventRuntimeModule() {
        return scene.eventRuntimeModule;
      },
      pickFloorEventPosition() {
        return scene.pickFloorEventPosition();
      },
      get dungeon() {
        return scene.dungeon;
      },
      set dungeon(value) {
        scene.dungeon = value;
      },
      get eventRng() {
        return scene.eventRng;
      },
      get progressionRuntimeModule() {
        return scene.progressionRuntimeModule;
      },
      get challengeRoomState() {
        return scene.challengeRoomState;
      },
      set challengeRoomState(value) {
        scene.challengeRoomState = value;
      },
      get challengeWaveTotal() {
        return scene.challengeWaveTotal;
      },
      set challengeWaveTotal(value) {
        scene.challengeWaveTotal = value;
      },
      get challengeMarker() {
        return scene.challengeMarker;
      },
      set challengeMarker(value) {
        scene.challengeMarker = value;
      },
      get renderSystem() {
        return scene.renderSystem;
      },
      get origin() {
        return scene.origin;
      },
      scheduleRunSave() {
        scene.scheduleRunSave();
      },
      flushRunSave() {
        scene.flushRunSave();
      },
      get bossState() {
        return scene.bossState;
      },
      set bossState(value) {
        scene.bossState = value;
      },
      get bossRuntimeModule() {
        return scene.bossRuntimeModule;
      },
      get runCompletionModule() {
        return scene.runCompletionModule;
      },
      getRunRelativeNowMs() {
        return scene.getRunRelativeNowMs();
      },
      syncEndlessMutators(nowMs) {
        scene.syncEndlessMutators(nowMs);
      },
      get deferredOutcomeRuntime() {
        return scene.deferredOutcomeRuntime;
      },
      refreshPlayerStatsFromEquipment(player) {
        return scene.refreshPlayerStatsFromEquipment(player);
      },
      get player() {
        return scene.player;
      },
      set player(value) {
        scene.player = value;
      },
      handleLevelUpGain(levelsGained, nowMs, source) {
        scene.handleLevelUpGain(levelsGained, nowMs, source);
      },
      get lootRng() {
        return scene.lootRng;
      },
      resolveLootRollOptions(options) {
        return scene.resolveLootRollOptions(options);
      },
      isItemDefUnlocked(itemDef) {
        return scene.isItemDefUnlocked(itemDef);
      },
      spawnLootDrop(item, position, source) {
        scene.powerSpikeRuntimeModule.spawnLootDrop(item, position, source, scene.time.now);
      },
      get staircaseState() {
        return scene.staircaseState;
      },
      set staircaseState(value) {
        scene.staircaseState = value;
      },
      tryDiscoverBlueprints(sourceType, nowMs, sourceId) {
        scene.tryDiscoverBlueprints(sourceType, nowMs, sourceId);
      },
      get uiManager() {
        return scene.uiManager;
      },
      get lastDeathReason() {
        return scene.lastDeathReason;
      },
      set lastDeathReason(value) {
        scene.lastDeathReason = value;
      },
      get synergyRuntime() {
        return scene.synergyRuntime;
      },
      refreshSynergyRuntime() {
        scene.refreshSynergyRuntime();
      },
      get currentBiome() {
        return scene.currentBiome;
      },
      get runLog() {
        return scene.runLog;
      }
    };
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
    this.cleanupStarted = false;
    this.preserveSceneTransitionOnCleanup = false;
    this.cameras.main.setBackgroundColor("#11161d");
    this.debugCheatsEnabled = resolveDebugCheatsEnabled(DEBUG_CHEATS_QUERY);
    this.diagnosticsEnabled = resolveDebugQueryFlag(DEBUG_DIAGNOSTICS_QUERY) || this.debugCheatsEnabled;
    this.vfxSystem.setEnabled(!resolveDebugQueryFlag(DISABLE_VFX_QUERY));
    this.sfxSystem.setEnabled(!resolveDebugQueryFlag(DISABLE_SFX_QUERY));
    this.meta = this.loadMeta();
    this.resolveLocalePreference();
    this.normalizeMetaForPhase4B();
    this.refreshTalentEffects();
    this.selectedDifficulty =
      this.pendingResumeSave === null
        ? this.resolveSelectedDifficultyForRun()
        : normalizeDifficultyMode(this.pendingResumeSave.run.difficulty, "normal");
    this.uiManager = new UIManager(
      (itemId) => {
        const item = this.player.inventory.find((candidate) => candidate.id === itemId);
        if (item === undefined) {
          this.runLog.appendKey("log.item.equip_failed_missing", { itemId }, "warn", this.time.now);
          return;
        }

        if (!canEquip(this.player, item)) {
          this.runLog.appendKey(
            "log.item.equip_failed_locked",
            {
              itemName: this.contentLocalizer.itemName(item.defId, item.name),
              requiredLevel: item.requiredLevel,
              currentLevel: this.player.level
            },
            "warn",
            this.time.now
          );
          return;
        }

        const previousStats = this.player.derivedStats;
        this.player = this.refreshPlayerStatsFromEquipment(equipItem(this.player, itemId));
        const equipped = this.player.equipment[item.slot];
        if (equipped?.id === item.id) {
          this.registerStatDeltaHighlights(previousStats, this.player.derivedStats, this.time.now);
          this.refreshSynergyRuntime();
          this.hudDirty = true;
          this.scheduleRunSave();
          this.eventBus.emit("item:equip", {
            playerId: this.player.id,
            slot: item.slot,
            item: equipped,
            timestampMs: this.time.now
          });
          return;
        }

        this.runLog.appendKey(
          "log.item.equip_failed_generic",
          {
            itemName: this.contentLocalizer.itemName(item.defId, item.name)
          },
          "warn",
          this.time.now
        );
      },
      (slot) => {
        const equipped = this.player.equipment[slot];
        const unequippedPlayer: PlayerState = {
          ...this.player,
          inventory: equipped === undefined ? this.player.inventory : [...this.player.inventory, equipped],
          equipment: {
            ...this.player.equipment,
            [slot]: undefined
          }
        };
        const previousStats = this.player.derivedStats;
        this.player = this.refreshPlayerStatsFromEquipment(unequippedPlayer);
        if (equipped !== undefined) {
          this.registerStatDeltaHighlights(previousStats, this.player.derivedStats, this.time.now);
          this.refreshSynergyRuntime();
          this.hudDirty = true;
          this.scheduleRunSave();
          this.eventBus.emit("item:unequip", {
            playerId: this.player.id,
            slot,
            item: equipped,
            timestampMs: this.time.now
          });
        }
      },
      (itemId) => {
        const item = this.player.inventory.find((candidate) => candidate.id === itemId);
        if (item === undefined) {
          this.runLog.appendKey("log.item.discard_failed_missing", { itemId }, "warn", this.time.now);
          return;
        }
        this.player = {
          ...this.player,
          inventory: this.player.inventory.filter((candidate) => candidate.id !== itemId)
        };
        this.hudDirty = true;
        this.runLog.appendKey(
          "log.item.discarded",
          {
            itemName: this.contentLocalizer.itemName(item.defId, item.name)
          },
          "info",
          this.time.now
        );
      },
      (consumableId) => {
        this.tryUseConsumable(consumableId);
      },
      () => {
        this.preserveSceneTransitionOnCleanup = true;
        playSceneTransition({
          title: t("ui.transition.return_sanctum.title"),
          subtitle: t("ui.transition.return_sanctum.subtitle"),
          mode: "scene",
          durationMs: 520
        });
        this.uiManager.reset();
        this.sfxSystem.stopAmbient();
        this.scene.start("meta-menu");
      }
    );
    this.runLog.setSink({
      append: (message, level, timestampMs) => {
        this.uiManager.appendLog(message, level, timestampMs);
      }
    });
    this.saveCoordinator = new SaveCoordinator({
      saveManager: this.saveManager,
      isRunEnded: () => this.runEnded,
      buildSnapshot: () => this.runPersistenceModule.buildSnapshot(this.time.now)
    });
    this.runPersistenceModule = new RunPersistenceModule({
      saveCoordinator: this.saveCoordinator,
      snapshotBuilder: this.runSaveSnapshotBuilder,
      stateRestorer: this.runStateRestorer,
      nowMs: () => this.time.now,
      onFlush: (nowMs) => {
        this.lastAutoSaveAt = nowMs;
      }
    });
    const eventResolutionService = new EventResolutionService({
      host: this as unknown as RuntimeEventHost
    });
    const merchantFlowService = new MerchantFlowService({
      host: this as unknown as RuntimeEventHost
    });
    this.eventRuntimeModule = new EventRuntimeModule({
      host: this as unknown as RuntimeEventHost,
      resolutionService: eventResolutionService,
      merchantFlowService
    });
    const bossSpawnService = new BossSpawnService({
      host: this.createBossSpawnHost()
    });
    const bossTelegraphPresenter = new BossTelegraphPresenter({
      host: this.createBossTelegraphHost()
    });
    const bossCombatService = new BossCombatService({
      host: this.createBossCombatHost(),
      spawnService: bossSpawnService,
      telegraphPresenter: bossTelegraphPresenter
    });
    this.bossRuntimeModule = new BossRuntimeModule({
      host: this as unknown as BossRuntimeHost,
      combatService: bossCombatService,
      spawnService: bossSpawnService
    });
    this.runCompletionModule = new RunCompletionModule({
      host: this as unknown as RunCompletionHost
    });
    this.hazardRuntimeModule = new HazardRuntimeModule({
      host: this.createHazardRuntimeHost()
    });
    this.progressionRuntimeModule = new ProgressionRuntimeModule({
      host: this.createProgressionRuntimeHost()
    });
    this.floorProgressionModule = new FloorProgressionModule({
      host: this as unknown as FloorProgressionHost
    });
    this.playerActionModule = new PlayerActionModule({
      host: this as unknown as PlayerActionHost
    });
    this.encounterController = new EncounterController({
      updateCombat: (nowMs) => this.updateCombat(nowMs),
      updateMonsters: (deltaSeconds, nowMs) => this.updateMonsters(deltaSeconds, nowMs),
      updateMonsterCombat: (nowMs) => this.updateMonsterCombat(nowMs),
      updateBossCombat: (nowMs) => this.bossRuntimeModule.updateCombat(nowMs),
      updateChallengeRoom: (nowMs) => this.progressionRuntimeModule.updateChallengeRoom(nowMs)
    });
    this.worldEventController = new WorldEventController({
      updateHazards: (nowMs) => this.hazardRuntimeModule.updateHazards(nowMs),
      collectNearbyLoot: (nowMs) => this.collectNearbyLoot(nowMs),
      updateEventInteraction: (nowMs) => this.eventRuntimeModule.updateInteraction(nowMs),
      updateFloorProgress: (nowMs) => this.floorProgressionModule.update(nowMs),
      updateMinimap: (nowMs) => this.updateMinimap(nowMs)
    });
    this.debugRuntimeModule = new DebugRuntimeModule({
      debugApiBinder: this.debugApiBinder,
      commandRegistry: this.debugCommandRegistry,
      isDebugEnabled: () => this.debugCheatsEnabled,
      onResetRun: () => this.runCompletionModule.resetRun()
    });
    this.installDebugApi();
    this.applyRuntimeBackgroundRemoval();
    this.sfxSystem.initialize();
    this.uiManager.hideDeathOverlay();
    this.uiManager.clearLogs();
    this.uiManager.hideEventPanel();
    this.initDiagnosticsPanel();
    this.bindDomainEventEffects();
    this.clearKeyboardBindings();
    this.saveCoordinator.bindPageLifecycle();
    if (this.pendingResumeSave !== null && (this.tasteRuntime.resetRunState(), this.runPersistenceModule.restore(this.pendingResumeSave))) {
      this.saveCoordinator.startHeartbeat();
      this.runLog.appendKey("log.run.resumed_saved", undefined, "info", this.time.now);
      this.flushRunSave();
    } else {
      this.bootstrapRun(resolveInitialRunSeed(this.pendingRunSeed), this.selectedDifficulty);
      this.saveCoordinator.startHeartbeat();
      this.flushRunSave();
    }
    this.pendingResumeSave = null;
    this.renderDiagnosticsPanel(this.time.now);

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.bindSkillKeys();
    this.bindMovementKeys();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());
    this.hudDirty = true;
  }

  private resolveSelectedDifficultyForRun(): DifficultyMode {
    if (this.pendingRunMode === "daily") {
      this.pendingDifficulty = null;
      return resolveSelectedDifficulty(this.meta);
    }
    const requested = this.pendingDifficulty ?? this.meta.selectedDifficulty;
    const normalized = normalizeDifficultyMode(requested, "normal");
    const resolved = isDifficultyUnlocked(this.meta, normalized)
      ? normalized
      : resolveSelectedDifficulty(this.meta);
    this.pendingDifficulty = null;
    if (resolved !== this.meta.selectedDifficulty) {
      this.meta = {
        ...this.meta,
        selectedDifficulty: resolved
      };
      this.saveMeta(this.meta);
    }
    return resolved;
  }

  private refreshTalentEffects(): void {
    this.talentEffects = collectTalentEffectTotals(this.meta.talentPoints, TALENT_DEFS);
  }

  private initDiagnosticsPanel(): void {
    this.diagnosticsService.init(this.diagnosticsEnabled);
  }

  private renderDiagnosticsPanel(nowMs: number): void {
    const entity = this.entityManager.getDiagnostics();
    const vfx = this.vfxSystem.getDiagnostics();
    const sfx = this.sfxSystem.getDiagnostics();
    const render = this.renderSystem.getLastSyncStats();
    const fps = this.game.loop.actualFps;
    this.diagnosticsService.render(this.diagnosticsEnabled, nowMs, [
      `FPS ${fps.toFixed(1)} | floor ${this.run.currentFloor} ${difficultyLabel(this.run.difficulty)}`,
      `AI near/far ${this.lastAiNearCount}/${this.lastAiFarCount}`,
      `Listeners eventBus ${this.eventBus.listenerCount()}`,
      `Entity M ${entity.monsters} (alive ${entity.livingMonsters}) L ${entity.loot} T ${entity.telegraphs}`,
      `Render visible/culled ${render.monstersVisible}/${render.monstersCulled}`,
      `VFX active ${vfx.activeTransientObjects} dropped ${vfx.droppedEffects}`,
      `SFX ambient ${sfx.ambientActive ? sfx.ambientKey ?? "on" : "off"}`
    ]);
  }

  private collectDiagnosticsSnapshot(): Record<string, unknown> {
    return {
      floor: this.run.currentFloor,
      difficulty: this.run.difficulty,
      ai: {
        near: this.lastAiNearCount,
        far: this.lastAiFarCount
      },
      listeners: {
        eventBus: this.eventBus.listenerCount()
      },
      entity: this.entityManager.getDiagnostics(),
      render: this.renderSystem.getLastSyncStats(),
      vfx: this.vfxSystem.getDiagnostics(),
      sfx: this.sfxSystem.getDiagnostics(),
      phase6: this.capturePhase6TelemetrySummary(),
      taste: { buildIdentity: this.tasteRuntime.snapshotBuildIdentity(), recentHeartbeats: this.tasteRuntime.listHeartbeatEvents(10), recommendations: this.tasteRuntime.buildRecommendations() }
    };
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
      onEventPanelFrame: (panelNowMs) => this.runEventPanelFrame(panelNowMs),
      onActiveFrame: (activeNowMs, activeDeltaMs) => this.runActiveFrame(activeNowMs, activeDeltaMs)
    });
  }

  private runEventPanelFrame(nowMs: number): void {
    if (!this.hudDirty && nowMs >= this.nextTransientHudRefreshAt) {
      this.hudDirty = true;
    }
    if (this.hudDirty) {
      this.renderHud();
      this.hudDirty = false;
    }
    this.updateMinimap(nowMs);
    this.renderDiagnosticsPanel(nowMs);
  }

  private runActiveFrame(nowMs: number, deltaMs: number): void {
    this.progressionChoiceRuntime.maybePromptLevelUpChoice(nowMs, "runtime_tick");
    if (this.isBlockingOverlayOpen()) {
      this.runEventPanelFrame(nowMs);
      return;
    }

    const playerHazardMovementMultiplier = this.hazardRuntimeModule.resolvePlayerHazardMovementMultiplier();
    const mutationMoveMultiplier = this.resolveMutationMoveSpeedMultiplier();

    this.updateKeyboardMoveIntent(nowMs);
    this.updatePlayerMovement((deltaMs / 1000) * playerHazardMovementMultiplier * mutationMoveMultiplier, nowMs);
    this.playerActionModule.applySpecialAffixHealthRegen(deltaMs);
    this.playerActionModule.applyPassiveManaRegen(deltaMs);
    this.updateRuntimeBuffs(nowMs);
    this.phase6Telemetry.sampleManaDryWindow(
      this.player.mana,
      this.resolveMinimumActiveSkillManaCost(),
      deltaMs
    );
    this.progressionRuntimeModule.revealNearbyHiddenRoomsByMutation(nowMs);
    this.encounterController.updateFrame({
      deltaSeconds: deltaMs / 1000,
      nowMs
    });
    this.worldEventController.updatePreResolution(nowMs);
    this.encounterController.updateChallenge(nowMs);

    this.renderSystem.syncPlayerSprite(this.playerSprite, this.player.position, this.playerYOffset, this.origin);
    this.renderSystem.syncMonsterSprites(this.entityManager.listMonsters(), this.origin);
    this.bossRuntimeModule.syncSprite();

    if (this.player.health <= 0) {
      this.runCompletionModule.finishRun(false);
      return;
    }

    if (this.floorConfig.isBossFloor && this.bossState !== null && this.bossState.health <= 0) {
      this.tasteRuntime.recordKeyKill("boss", this.run.currentFloor, "boss_kill", nowMs);
      this.deferredOutcomeRuntime.settle("boss_kill", nowMs);
      if (this.run.inEndless) {
        this.runCompletionModule.finishRun(true);
      } else {
        this.bossRuntimeModule.openVictoryChoice(nowMs);
      }
      return;
    }

    this.updatePressurePeakRuntime(nowMs);
    this.worldEventController.updatePostResolution(nowMs);
    if (nowMs - this.lastAutoSaveAt >= AUTO_SAVE_INTERVAL_MS) {
      this.flushRunSave();
    }

    if (!this.hudDirty && nowMs >= this.nextTransientHudRefreshAt) {
      this.hudDirty = true;
    }
    if (this.hudDirty) {
      this.renderHud();
      this.hudDirty = false;
    }
    this.renderDiagnosticsPanel(nowMs);
  }

  private updateMinimap(nowMs: number): void {
    if (nowMs - this.lastMinimapRefreshAt < MINIMAP_REFRESH_INTERVAL_MS) {
      return;
    }
    this.lastMinimapRefreshAt = nowMs;

    const monsters = this.entityManager.listLivingMonsters().map((monster) => ({
      x: Math.round(monster.state.position.x),
      y: Math.round(monster.state.position.y)
    }));
    const loot = this.entityManager.listLoot().map((drop) => ({
      x: Math.round(drop.position.x),
      y: Math.round(drop.position.y)
    }));
    const staircase =
      this.staircaseState.visible === true
        ? {
            x: Math.round(this.staircaseState.position.x),
            y: Math.round(this.staircaseState.position.y)
          }
        : undefined;
    const eventNode =
      this.eventNode === null || this.eventNode.resolved
        ? undefined
        : {
            x: Math.round(this.eventNode.position.x),
            y: Math.round(this.eventNode.position.y)
          };

    this.uiManager.renderMinimap({
      player: {
        x: Math.round(this.player.position.x),
        y: Math.round(this.player.position.y)
      },
      monsters,
      loot,
      ...(staircase === undefined ? {} : { staircase }),
      ...(eventNode === undefined ? {} : { eventNode }),
      revealAll: this.mapRevealActive
    });
  }

  private routeFeedback(input: FeedbackRouterInput): void {
    this.feedbackRouter.route(input);
  }

  private resolveEntitySprite(
    entityId: string
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null {
    if (entityId === this.player.id) {
      return this.playerSprite ?? null;
    }
    if (entityId === this.bossDef.id) {
      return this.bossSprite;
    }
    const monster = this.entityManager.findMonsterById(entityId);
    return monster?.sprite ?? null;
  }

  private dispatchFeedbackAction(action: FeedbackAction): void {
    if (action.channel === "sfx") {
      this.sfxSystem.dispatch(action);
      return;
    }

    switch (action.cue) {
      case "combat_hit":
        this.vfxSystem.playCombatHit(
          this.resolveEntitySprite(action.targetId),
          action.amount,
          action.critical,
          action.weaponType
        );
        return;
      case "combat_dodge":
        this.vfxSystem.playCombatDodge(this.resolveEntitySprite(action.targetId));
        return;
      case "combat_death":
        this.vfxSystem.playCombatDeath(this.resolveEntitySprite(action.targetId));
        return;
      case "skill_cast":
        this.vfxSystem.playSkillCast(this.resolveEntitySprite(action.casterId), action.skillId);
        return;
      case "boss_phase":
        this.vfxSystem.playBossPhaseChange(this.resolveEntitySprite(action.bossId));
        return;
      case "rare_drop":
        this.vfxSystem.playRareDrop(action.rarity);
        return;
      case "build_formed":
        this.vfxSystem.playBuildFormed();
        return;
      case "boss_reward":
        this.vfxSystem.playBossReward();
        return;
      case "synergy_activated":
        this.vfxSystem.playSynergyActivated();
        return;
      case "power_spike":
        this.vfxSystem.playPowerSpike(action.major);
        return;
      case "hazard_trigger": {
        const mapped = gridToIso(
          action.position.x,
          action.position.y,
          this.tileWidth,
          this.tileHeight,
          this.origin.x,
          this.origin.y
        );
        this.vfxSystem.playHazardTrigger(mapped.x, mapped.y, action.hazardType);
        return;
      }
      case "level_up":
        this.vfxSystem.playLevelUp(this.resolveEntitySprite(action.playerId), action.level);
        return;
      default:
        return;
    }
  }

  private bindDomainEventEffects(): void {
    bindDomainEventEffects(this as unknown as DomainEventEffectHost);
  }

  private bindSkillKeys(): void {
    const bind = (code: string, slotIndex: number) => {
      this.bindKeyboard(`keydown-${code}`, () => {
        this.tryUseSkill(slotIndex);
      });
    };

    bind("ONE", 0);
    bind("TWO", 1);
    bind("THREE", 2);
    bind("FOUR", 3);
    bind("Q", 0);
    this.bindKeyboard("keydown-R", () => this.tryUseConsumable("health_potion"));
    this.bindKeyboard("keydown-F", () => this.tryUseConsumable("mana_potion"));
    this.bindKeyboard("keydown-G", () => this.tryUseConsumable("scroll_of_mapping"));

    if (this.debugCheatsEnabled) {
      this.bindKeyboard("keydown", (event) => {
        this.debugRuntimeModule.handleHotkey(event as KeyboardEvent);
      });
    }
  }

  private bindMovementKeys(): void {
    const keyboard = this.input.keyboard;
    if (keyboard === undefined || keyboard === null) {
      this.cursorKeys = null;
      return;
    }
    this.cursorKeys = keyboard.createCursorKeys();
  }

  private bindKeyboard(eventName: string, handler: (...args: unknown[]) => void): void {
    const keyboard = this.input.keyboard;
    if (keyboard === undefined || keyboard === null) {
      return;
    }
    keyboard.on(eventName, handler);
    this.keyboardBindings.push({ eventName, handler });
  }

  private clearKeyboardBindings(): void {
    const keyboard = this.input.keyboard;
    if (keyboard !== undefined && keyboard !== null) {
      for (const binding of this.keyboardBindings) {
        keyboard.off(binding.eventName, binding.handler);
      }
    }
    this.keyboardBindings.length = 0;
  }

  private installDebugApi(): void {
    this.debugRuntimeModule.install();
  }

  private removeDebugApi(): void {
    this.debugRuntimeModule.uninstall();
  }

  private resolveDailyWeaponType(runSeed: string): WeaponType {
    let hash = 0;
    for (let idx = 0; idx < runSeed.length; idx += 1) {
      hash = (hash * 31 + runSeed.charCodeAt(idx)) >>> 0;
    }
    return DAILY_WEAPON_ROTATION[hash % DAILY_WEAPON_ROTATION.length] ?? "sword";
  }

  private resolveDailyMutationIds(runSeed: string): string[] {
    const candidates = MUTATION_DEFS.map((entry) => entry.id).sort((left, right) => left.localeCompare(right));
    if (candidates.length === 0) {
      return [];
    }
    let hash = 2166136261;
    for (let idx = 0; idx < runSeed.length; idx += 1) {
      hash ^= runSeed.charCodeAt(idx);
      hash = Math.imul(hash, 16777619);
    }
    const picked: string[] = [];
    const pool = [...candidates];
    while (picked.length < DAILY_MUTATION_COUNT && pool.length > 0) {
      const index = hash % pool.length;
      const [selected] = pool.splice(index, 1);
      if (selected !== undefined) {
        picked.push(selected);
      }
      hash = Math.imul(hash ^ 0x9e3779b9, 16777619) >>> 0;
    }
    return picked;
  }

  private createDailyWeaponInstance(weaponType: WeaponType): ItemInstance {
    const baseAttackPower =
      weaponType === "hammer" ? 9 : weaponType === "staff" ? 7 : weaponType === "axe" ? 8 : 7;
    const baseCritChance = weaponType === "dagger" ? 0.04 : weaponType === "staff" ? 0.01 : 0.02;
    return {
      id: `daily_weapon_${weaponType}_${this.runSeed.slice(0, 8)}`,
      defId: `daily_weapon_${weaponType}`,
      name: `Daily Armament (${weaponType})`,
      slot: "weapon",
      kind: "equipment",
      weaponType,
      rarity: "magic",
      requiredLevel: 1,
      iconId: "item_weapon_02",
      seed: `${this.runSeed}:daily_weapon:${weaponType}`,
      rolledAffixes: {
        attackPower: baseAttackPower,
        critChance: baseCritChance,
        attackSpeed: 2
      }
    };
  }

  private applyDailyLoadout(player: PlayerState, nowMs: number): PlayerState {
    if (this.dailyFixedWeaponType === null) {
      return player;
    }
    const dailyWeapon = this.createDailyWeaponInstance(this.dailyFixedWeaponType);
    const inventory = [
      ...player.inventory.filter((entry) => !(entry.slot === "weapon" && entry.id.startsWith("daily_weapon_"))),
      dailyWeapon
    ];
    let nextPlayer: PlayerState = {
      ...player,
      inventory
    };
    nextPlayer = equipItem(nextPlayer, dailyWeapon.id);
    this.runLog.appendKey(
      "log.run.daily_loadout_active",
      {
        weaponName: dailyWeapon.name
      },
      "info",
      nowMs
    );
    return this.refreshPlayerStatsFromEquipment(nextPlayer);
  }

  private bootstrapRun(runSeed: string, difficulty: DifficultyMode): void {
    this.tasteRuntime.resetRunState();
    this.runSeed = runSeed;
    const requestedMode: RunMode = this.pendingRunMode === "daily" ? "daily" : "normal";
    const selectedRunMode: RunMode = requestedMode;
    const resolvedDailyDate = selectedRunMode === "daily" ? this.pendingDailyDate ?? resolveDailyDate() : undefined;
    const canScoreDaily =
      selectedRunMode === "daily" && resolvedDailyDate !== undefined
        ? canStartDailyScoredAttempt(this.meta, resolvedDailyDate)
        : false;
    this.dailyPracticeMode = selectedRunMode === "daily" ? this.pendingDailyPractice || !canScoreDaily : false;
    if (selectedRunMode === "daily" && this.pendingDailyPractice !== this.dailyPracticeMode) {
      this.runLog.appendKey(
        this.dailyPracticeMode
          ? "log.run.daily_practice_switched"
          : "log.run.daily_scored_unlocked",
        undefined,
        "info",
        this.time.now
      );
    }
    this.dailyFixedWeaponType = selectedRunMode === "daily" ? this.resolveDailyWeaponType(runSeed) : null;
    this.selectedDifficulty = selectedRunMode === "daily" ? "hard" : difficulty;
    this.resumedFromSave = false;
    this.runEnded = false;
    this.lastDeathReason = "Unknown cause.";
    this.manualMoveTarget = null;
    this.manualMoveTargetFailures = 0;
    this.nextManualPathReplanAt = 0;
    this.nextKeyboardMoveInputAt = 0;
    this.entityLabelById.clear();
    this.newlyAcquiredItemUntilMs.clear();
    this.previousSkillCooldownLeftById.clear();
    this.skillReadyFlashUntilMsById.clear();
    this.statHighlightEntries = [];
    this.levelUpPulseUntilMs = 0;
    this.levelUpPulseLevel = null;
    this.nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
    this.playerActionModule.resetRuntimeState();
    this.lastAiNearCount = 0;
    this.lastAiFarCount = 0;
    this.uiManager.clearLogs();
    this.uiManager.hideDeathOverlay();
    this.uiManager.hideEventPanel();
    this.uiManager.hideHeartbeatToast();
    this.uiManager.hideEquipmentComparePrompt();
    this.blueprintFoundIdsInRun = [];
    this.refreshUnlockSnapshots();
    if (selectedRunMode === "daily") {
      this.resetMutationRuntimeState(this.resolveDailyMutationIds(runSeed));
    } else {
      this.resetMutationRuntimeState(this.meta.selectedMutationIds);
    }
    this.consumables = createInitialConsumableState(this.meta.permanentUpgrades.potionCharges);
    this.mapRevealActive = false;
    this.eventPanelOpen = false;
    this.comparePromptOpen = false;
    this.nearDeathWindowArmedAtMs = null;
    this.nearDeathFeedbackCooldownUntilMs = 0;
    this.merchantOffers = [];
    this.deferredOutcomes = [];
    this.eventRuntimeModule.destroyEventNode();
    const run = createRunState(runSeed, this.time.now, this.selectedDifficulty);
    this.run =
      selectedRunMode === "daily"
        ? {
            ...run,
            runMode: "daily",
            ...(resolvedDailyDate === undefined ? {} : { dailyDate: resolvedDailyDate })
          }
        : run;
    this.powerSpikeRuntimeModule.resetRun();
    this.heartbeatFeedbackRuntime.reset();
    this.phase6Telemetry.resetRun(this.run.startedAtMs);
    this.progressionChoiceRuntime.resetRuntime(this.time.now, this.run.currentFloor);
    this.progressionRuntimeModule.setupFloor(1, true);

    this.eventBus.emit("run:start", {
      runSeed: this.runSeed,
      floor: this.run.currentFloor,
      difficulty: this.run.difficulty,
      startedAtMs: this.run.startedAtMs,
      replayVersion: this.run.replay?.version ?? "unknown"
    });
    if (this.debugCheatsEnabled) {
      this.runLog.debug(t("log.debug.cheats_enabled"), "info", this.time.now);
    }
    this.pendingRunMode = "normal";
    this.pendingDailyDate = undefined;
    this.pendingDailyPractice = false;
    this.pendingRunSeed = undefined;
    this.lastAutoSaveAt = this.time.now;
  }

  private refreshUnlockSnapshots(): void {
    this.unlockedBiomeIds = new Set(collectUnlockedBiomeIds(this.meta, UNLOCK_DEFS));
    this.unlockedAffixIds = collectUnlockedAffixIds(this.meta, UNLOCK_DEFS) as MonsterAffixId[];
    const unlockedEvents = new Set<string>(collectUnlockedEventIds(this.meta, UNLOCK_DEFS));
    for (const blueprintId of this.meta.blueprintForgedIds) {
      const blueprint = BLUEPRINT_DEF_MAP[blueprintId];
      if (blueprint?.category === "event") {
        unlockedEvents.add(blueprint.unlockTargetId);
      }
    }
    this.unlockedEventIds = [...unlockedEvents.values()];
    this.unlockedWeaponTypes = collectUnlockedWeaponTypes(this.meta, WEAPON_TYPE_DEF_MAP);
  }

  private normalizeMetaForPhase4B(): void {
    const normalized = normalizeMutationMetaState(this.meta, MUTATION_DEFS);
    if (JSON.stringify(normalized) !== JSON.stringify(this.meta)) {
      this.meta = normalized;
      this.saveMeta(this.meta);
    } else {
      this.meta = normalized;
    }
  }

  private resolveLocalePreference(): void {
    const locale = resolveInitialLocale({
      preferredLocale: this.meta.preferredLocale,
      defaultLocale: "en-US"
    });
    setLocale(locale, { persist: this.meta.preferredLocale !== null });
    if (this.meta.preferredLocale !== null && this.meta.preferredLocale !== locale) {
      this.meta = {
        ...this.meta,
        preferredLocale: locale
      };
      this.saveMeta(this.meta);
    }
  }

  private resetMutationRuntimeState(selectedMutationIds: string[]): void {
    const activeEffects = collectActiveMutationEffects(selectedMutationIds, MUTATION_DEF_BY_ID);
    this.mutationRuntime = {
      activeIds: [...selectedMutationIds],
      activeEffects,
      killAttackSpeedStacks: 0,
      killAttackSpeedUntilMs: 0,
      onHitInvulnUntilMs: 0,
      onHitInvulnCooldownUntilMs: 0,
      lethalGuardUsedFloors: new Set<number>()
    };
  }

  private applySynergyDerivedStatPercents(player: PlayerState): PlayerState {
    const baseline = this.refreshPlayerStatsFromEquipment(player);
    const nextDerived = { ...baseline.derivedStats };
    for (const [stat, percent] of Object.entries(this.synergyRuntime.statPercent)) {
      if (!(stat in nextDerived)) {
        continue;
      }
      const key = stat as keyof typeof nextDerived;
      const baseValue = nextDerived[key];
      const scaled = baseValue * (1 + percent);
      nextDerived[key] =
        key === "critChance" || key === "attackSpeed" || key === "moveSpeed"
          ? Math.max(0, scaled)
          : Math.max(0, Math.floor(scaled));
    }
    return {
      ...baseline,
      derivedStats: nextDerived,
      health: Math.min(baseline.health, nextDerived.maxHealth),
      mana: Math.min(baseline.mana, nextDerived.maxMana)
    };
  }

  private refreshSynergyRuntime(
    persistDiscovery = true,
    options: {
      emitActivationEvents?: boolean;
      recordTelemetry?: boolean;
    } = {}
  ): void {
    if (this.player === undefined) {
      this.synergyRuntime = {
        activeSynergyIds: [],
        skillDamagePercent: {},
        skillModifiers: {},
        statPercent: {},
        cooldownOverridesMs: {}
      };
      return;
    }
    const emitActivationEvents = options.emitActivationEvents ?? true;
    const recordTelemetry = options.recordTelemetry ?? emitActivationEvents;
    const previousSynergyIds = new Set(this.synergyRuntime.activeSynergyIds);

    const activeSkills =
      this.player.skills?.skillSlots
        .filter((slot): slot is NonNullable<(typeof this.player.skills.skillSlots)[number]> => slot !== null)
        .map((slot) => ({
          id: slot.defId,
          level: slot.level
        })) ?? [];

    this.synergyRuntime = resolveSynergyRuntimeEffects(SYNERGY_DEFS, {
      weaponType: resolveEquippedWeaponType(this.player),
      activeSkills,
      talentPoints: this.meta.talentPoints,
      selectedMutationIds: this.mutationRuntime.activeIds,
      equipment: Object.values(this.player.equipment)
    });
    this.player = this.applySynergyDerivedStatPercents(this.player);

    const discoveredMeta = mergeSynergyDiscoveries(this.meta, this.synergyRuntime.activeSynergyIds);
    if (discoveredMeta !== this.meta) {
      this.meta = discoveredMeta;
      if (persistDiscovery) {
        this.saveMeta(discoveredMeta);
      }
    }
    for (const synergyId of this.synergyRuntime.activeSynergyIds) {
      if (previousSynergyIds.has(synergyId)) {
        continue;
      }
      if (recordTelemetry) {
        this.phase6Telemetry.recordSynergyActivated(synergyId, this.run.currentFloor);
      }
      if (!emitActivationEvents) {
        continue;
      }
      this.tasteRuntime.recordHeartbeat({
        type: "synergy_activated",
        floor: this.run.currentFloor,
        source: "synergy_runtime",
        timestampMs: this.time.now,
        detail: synergyId
      });
      this.eventBus.emit("synergy_activated", {
        floor: this.run.currentFloor,
        synergyId,
        timestampMs: this.time.now
      });
    }
    this.hudDirty = true;
  }

  private collectKnownBlueprintIds(): string[] {
    const known = new Set<string>(this.meta.blueprintFoundIds);
    for (const blueprintId of this.blueprintFoundIdsInRun) {
      known.add(blueprintId);
    }
    return [...known.values()];
  }

  private addRunBlueprintDiscoveries(blueprintIds: string[], nowMs: number, sourceLabel: string): void {
    if (blueprintIds.length === 0) {
      return;
    }
    const known = new Set(this.blueprintFoundIdsInRun);
    const discovered: string[] = [];
    for (const blueprintId of blueprintIds) {
      if (known.has(blueprintId)) {
        continue;
      }
      known.add(blueprintId);
      discovered.push(blueprintId);
      this.blueprintFoundIdsInRun.push(blueprintId);
    }
    if (discovered.length === 0) {
      return;
    }
    for (const blueprintId of discovered) {
      const blueprint = BLUEPRINT_DEF_MAP[blueprintId];
      const label =
        blueprint === undefined
          ? blueprintId
          : this.contentLocalizer.blueprintName(blueprint.id, blueprint.name);
      this.runLog.appendKey(
        "log.blueprint.discovered",
        {
          sourceLabel,
          blueprintName: label
        },
        "success",
        nowMs
      );
    }
    this.scheduleRunSave();
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
    const discovered = rollBlueprintDiscoveries(
      BLUEPRINT_DEFS,
      sourceId === undefined
        ? {
            sourceType,
            floor: this.run.currentFloor
          }
        : {
            sourceType,
            sourceId,
            floor: this.run.currentFloor
          },
      this.lootRng,
      this.collectKnownBlueprintIds()
    );
    this.addRunBlueprintDiscoveries(discovered, nowMs, sourceType);
  }

  private isItemDefUnlocked(itemDef: ItemDef): boolean {
    return isItemDefUnlockedByWeaponType(itemDef, this.unlockedWeaponTypes);
  }

  private collectMutationEffects<T extends MutationEffect["type"]>(
    type: T
  ): Array<Extract<MutationEffect, { type: T }>> {
    return this.mutationRuntime.activeEffects.filter(
      (effect): effect is Extract<MutationEffect, { type: T }> => effect.type === type
    );
  }

  private resolveMutationMoveSpeedMultiplier(): number {
    return this.collectMutationEffects("move_speed_multiplier").reduce((multiplier, effect) => {
      return multiplier * Math.max(0.1, effect.value);
    }, 1);
  }

  private resolveMutationAttackSpeedMultiplier(nowMs: number): number {
    const killBuffs = this.collectMutationEffects("on_kill_attack_speed");
    if (killBuffs.length === 0 || nowMs > this.mutationRuntime.killAttackSpeedUntilMs) {
      if (this.mutationRuntime.killAttackSpeedStacks !== 0) {
        this.mutationRuntime.killAttackSpeedStacks = 0;
      }
      return 1;
    }
    const bonusPerStack = Math.max(...killBuffs.map((effect) => effect.value));
    return 1 + this.mutationRuntime.killAttackSpeedStacks * bonusPerStack;
  }

  private resolveMutationDropBonus(): { obolMultiplier: number; soulShardMultiplier: number } {
    const bonus = this.collectMutationEffects("drop_bonus").reduce(
      (accumulator, effect) => {
        return {
          obol: accumulator.obol + effect.obolPercent,
          soul: accumulator.soul + effect.soulShardPercent
        };
      },
      { obol: 0, soul: 0 }
    );
    return {
      obolMultiplier: Math.max(0, 1 + bonus.obol),
      soulShardMultiplier: Math.max(0, 1 + bonus.soul)
    };
  }

  private syncEndlessMutators(nowMs: number): void {
    const synced = syncEndlessMutatorState(this.run);
    this.run = synced.run;
    if (synced.activatedIds.length === 0) {
      return;
    }
    for (const mutatorId of synced.activatedIds) {
      this.runLog.append(
        `Endless mutator activated: ${describeEndlessMutator(mutatorId)}.`,
        "warn",
        nowMs
      );
    }
    this.hudDirty = true;
    this.scheduleRunSave();
  }

  private resolveHiddenRoomRevealRadius(): number {
    return this.collectMutationEffects("hidden_room_reveal_radius").reduce((radius, effect) => {
      return Math.max(radius, effect.value);
    }, 0);
  }

  private applyOnKillMutationEffects(nowMs: number): void {
    const healEffects = this.collectMutationEffects("on_kill_heal_percent");
    if (healEffects.length > 0) {
      const healPercent = healEffects.reduce((sum, effect) => sum + effect.value, 0);
      const healAmount = Math.max(1, Math.floor(this.player.derivedStats.maxHealth * healPercent));
      this.player = {
        ...this.player,
        health: Math.min(this.player.derivedStats.maxHealth, this.player.health + healAmount)
      };
      this.eventBus.emit("mutation:trigger", {
        mutationId: "runtime:on_kill_heal",
        effectType: "on_kill_heal_percent",
        timestampMs: nowMs,
        value: healAmount,
        detail: `healed ${healAmount}`
      });
    }

    const speedEffects = this.collectMutationEffects("on_kill_attack_speed");
    if (speedEffects.length > 0) {
      const maxStacks = Math.max(...speedEffects.map((effect) => effect.maxStacks));
      const durationMs = Math.max(...speedEffects.map((effect) => effect.durationMs));
      this.mutationRuntime.killAttackSpeedStacks = Math.min(
        maxStacks,
        this.mutationRuntime.killAttackSpeedStacks + 1
      );
      this.mutationRuntime.killAttackSpeedUntilMs = nowMs + durationMs;
      this.eventBus.emit("mutation:trigger", {
        mutationId: "runtime:on_kill_attack_speed",
        effectType: "on_kill_attack_speed",
        timestampMs: nowMs,
        value: this.mutationRuntime.killAttackSpeedStacks
      });
    }
  }

  private configureRngStreams(
    floor: number,
    cursor?: Partial<Record<RunRngStreamName, number>>
  ): void {
    this.spawnRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "spawn"), cursor?.spawn ?? 0);
    this.combatRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "combat"), cursor?.combat ?? 0);
    this.lootRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "loot"), cursor?.loot ?? 0);
    this.skillRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "skill"), cursor?.skill ?? 0);
    this.bossRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "boss"), cursor?.boss ?? 0);
    this.biomeRng = new SeededRng(deriveFloorSeed(this.runSeed, 0, "biome"), cursor?.biome ?? 0);
    this.hazardRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "hazard"), cursor?.hazard ?? 0);
    this.eventRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "event"), cursor?.event ?? 0);
    this.merchantRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "merchant"), cursor?.merchant ?? 0);
  }

  private refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState {
    const equipped = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
    const buffEffects = aggregateBuffEffects(player.activeBuffs ?? [], BUFF_DEF_MAP);
    const derivedStats = deriveStats(
      player.baseStats,
      equipped,
      buffEffects,
      this.meta.permanentUpgrades,
      this.talentEffects
    );

    return {
      ...player,
      derivedStats,
      health: Math.min(player.health, derivedStats.maxHealth),
      mana: Math.min(player.mana, derivedStats.maxMana)
    };
  }

  private updateRuntimeBuffs(nowMs: number): void {
    this.updatePlayerBuffs(nowMs);
    for (const monster of this.entityManager.listMonsters()) {
      this.updateMonsterBuffs(monster, nowMs);
    }
  }

  private updatePlayerBuffs(nowMs: number): void {
    const activeBuffs = this.player.activeBuffs ?? [];
    if (activeBuffs.length === 0) {
      return;
    }
    const updated = updateBuffs(activeBuffs, nowMs);
    if (updated.expired.length === 0 && updated.active.length === activeBuffs.length) {
      return;
    }
    this.player = this.refreshPlayerStatsFromEquipment({
      ...this.player,
      activeBuffs: updated.active
    });
    for (const buff of updated.expired) {
      this.eventBus.emit("buff:expire", {
        buff,
        timestampMs: nowMs
      });
    }
  }

  private updateMonsterBuffs(monster: MonsterRuntime, nowMs: number): void {
    const activeBuffs = monster.state.activeBuffs ?? [];
    if (activeBuffs.length === 0) {
      return;
    }
    const updated = updateBuffs(activeBuffs, nowMs);
    if (updated.expired.length === 0 && updated.active.length === activeBuffs.length) {
      return;
    }
    monster.state = {
      ...monster.state,
      activeBuffs: updated.active
    };
    this.refreshMonsterBuffRuntime(monster);
    for (const buff of updated.expired) {
      this.eventBus.emit("buff:expire", {
        buff,
        timestampMs: nowMs
      });
    }
  }

  private refreshMonsterBuffRuntime(monster: MonsterRuntime): void {
    const buffEffects = aggregateBuffEffects(monster.state.activeBuffs ?? [], BUFF_DEF_MAP);
    monster.state = {
      ...monster.state,
      moveSpeed: Number(((monster.baseMoveSpeed ?? monster.state.moveSpeed) * (buffEffects.slowMultiplier ?? 1)).toFixed(2))
    };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.runEnded || this.isBlockingOverlayOpen()) {
      return;
    }
    const nowMs = this.time.now;

    const clickedGrid = isoToGrid(
      pointer.worldX,
      pointer.worldY,
      this.tileWidth,
      this.tileHeight,
      this.origin.x,
      this.origin.y
    );
    const targetTile = {
      x: Math.round(clickedGrid.x),
      y: Math.round(clickedGrid.y)
    };

    const hiddenRoom = (this.dungeon.hiddenRooms ?? []).find((entry) => {
      return (
        !entry.revealed &&
        entry.entrance.x === targetTile.x &&
        entry.entrance.y === targetTile.y
      );
    });
    if (hiddenRoom !== undefined) {
      this.progressionRuntimeModule.revealHiddenRoom(hiddenRoom.roomId, nowMs, "click");
      this.recordPlayerInput(nowMs);
      return;
    }

    const clickedMonster = this.entityManager.pickMonsterAt(targetTile);
    if (clickedMonster !== null) {
      this.attackTargetId = clickedMonster.state.id;
      this.manualMoveTarget = null;
      this.manualMoveTargetFailures = 0;
      this.run = appendReplayInput(this.run, {
        type: "attack_target",
        atMs: this.getRunRelativeNowMs(),
        targetId: clickedMonster.state.id
      });
      this.recordPlayerInput(nowMs);
      return;
    }

    this.attackTargetId = null;
    this.manualMoveTarget = targetTile;
    this.manualMoveTargetFailures = 0;
    this.nextManualPathReplanAt = 0;
    this.path = this.computePathTo(targetTile);
    this.run = appendReplayInput(this.run, {
      type: "move_target",
      atMs: this.getRunRelativeNowMs(),
      target: targetTile
    });
    this.recordPlayerInput(nowMs);
  }

  private getRunRelativeNowMs(): number {
    return Math.max(0, this.time.now - this.run.startedAtMs);
  }

  private updateKeyboardMoveIntent(nowMs: number): void {
    if (this.runEnded || this.isBlockingOverlayOpen() || this.cursorKeys === null) {
      return;
    }
    if (this.path.length > 0 || nowMs < this.nextKeyboardMoveInputAt) {
      return;
    }

    const leftDown = this.cursorKeys.left?.isDown === true;
    const rightDown = this.cursorKeys.right?.isDown === true;
    const upDown = this.cursorKeys.up?.isDown === true;
    const downDown = this.cursorKeys.down?.isDown === true;
    const moveX = (rightDown ? 1 : 0) - (leftDown ? 1 : 0);
    const moveY = (downDown ? 1 : 0) - (upDown ? 1 : 0);
    if (moveX === 0 && moveY === 0) {
      return;
    }

    this.nextKeyboardMoveInputAt = nowMs + KEYBOARD_MOVE_INPUT_INTERVAL_MS;
    const targetTile = {
      x: Math.round(this.player.position.x) + moveX,
      y: Math.round(this.player.position.y) + moveY
    };
    const nextPath = this.computePathTo(targetTile);
    if (nextPath.length === 0) {
      return;
    }

    this.attackTargetId = null;
    this.manualMoveTarget = targetTile;
    this.manualMoveTargetFailures = 0;
    this.nextManualPathReplanAt = 0;
    this.path = nextPath;
    this.run = appendReplayInput(this.run, {
      type: "move_target",
      atMs: this.getRunRelativeNowMs(),
      target: targetTile
    });
    this.recordPlayerInput(nowMs);
  }

  private updatePlayerMovement(dt: number, nowMs: number): void {
    const result = this.movementSystem.updatePlayerMovement(this.player, this.path, dt);
    this.player = result.player;
    this.path = result.path;
    if (result.moved && result.from !== undefined && result.to !== undefined) {
      this.eventBus.emit("player:move", {
        playerId: this.player.id,
        from: result.from,
        to: result.to,
        timestampMs: nowMs
      });
    }
    this.updateManualMoveTarget(nowMs);
  }

  private updateManualMoveTarget(nowMs: number): void {
    if (this.manualMoveTarget === null || this.runEnded || this.isBlockingOverlayOpen()) {
      return;
    }
    if (this.attackTargetId !== null) {
      this.manualMoveTarget = null;
      this.manualMoveTargetFailures = 0;
      return;
    }

    const distance = Math.hypot(
      this.manualMoveTarget.x - this.player.position.x,
      this.manualMoveTarget.y - this.player.position.y
    );
    if (distance <= 0.2) {
      this.manualMoveTarget = null;
      this.manualMoveTargetFailures = 0;
      this.nextManualPathReplanAt = 0;
      return;
    }
    if (this.path.length > 0 || nowMs < this.nextManualPathReplanAt) {
      return;
    }

    this.nextManualPathReplanAt = nowMs + MANUAL_PATH_REPLAN_INTERVAL_MS;
    const nextPath = this.computePathTo(this.manualMoveTarget);
    if (nextPath.length > 0) {
      this.path = nextPath;
      this.manualMoveTargetFailures = 0;
      return;
    }

    this.manualMoveTargetFailures += 1;
    if (this.manualMoveTargetFailures >= 8) {
      this.manualMoveTarget = null;
      this.manualMoveTargetFailures = 0;
      this.runLog.appendKey("log.pathfinding.aborted_unreachable", undefined, "warn", nowMs);
    }
  }

  private updateCombat(nowMs: number): void {
    if (this.floorConfig.isBossFloor) {
      return;
    }

    const playerCombat = this.combatSystem.updatePlayerAttack({
      player: this.player,
      run: this.run,
      monsters: this.entityManager.listMonsters(),
      attackTargetId: this.attackTargetId,
      nextPlayerAttackAt: this.nextPlayerAttackAt,
      nowMs,
      combatRng: this.combatRng,
      lootRng: this.lootRng,
      itemDefs: ITEM_DEF_MAP,
      lootTables: LOOT_TABLE_MAP,
      attackSpeedMultiplier: this.resolveMutationAttackSpeedMultiplier(nowMs),
      weaponTypeDefs: WEAPON_TYPE_DEF_MAP,
      canDropItemDef: (itemDef) => this.isItemDefUnlocked(itemDef),
      slotWeightMultiplier: this.currentBiome.lootBias
    });

    this.player = playerCombat.player;
    this.run = playerCombat.run;
    this.attackTargetId = playerCombat.attackTargetId;
    this.nextPlayerAttackAt = playerCombat.nextPlayerAttackAt;

    if (playerCombat.requestPathTarget !== undefined) {
      this.manualMoveTarget = null;
      this.manualMoveTargetFailures = 0;
      this.path = this.computePathTo(playerCombat.requestPathTarget);
    }

    this.emitCombatEvents(playerCombat.combatEvents);
    this.phase6Telemetry.recordCombatEvents(this.player.id, playerCombat.combatEvents, "auto");
    if (playerCombat.combatEvents.length > 0) {
      this.hudDirty = true;
    }

    if (playerCombat.leveledUp) {
      this.handleLevelUpGain(playerCombat.levelsGained, nowMs, "combat_kill");
    }

    if (playerCombat.killedMonsterId !== undefined) {
      const { obolMultiplier } = this.resolveMutationDropBonus();
      const bonusObol = Math.max(0, Math.floor(obolMultiplier) - 1);
      if (bonusObol > 0) {
        this.run = addRunObols(this.run, bonusObol);
      }
      const dead = this.entityManager.removeMonsterById(playerCombat.killedMonsterId);
      if (dead !== null) {
        this.handleMonsterDefeat(dead, nowMs);
      }
    }

    if (playerCombat.droppedItem !== undefined) {
      this.powerSpikeRuntimeModule.spawnLootDrop(
        playerCombat.droppedItem.item,
        playerCombat.droppedItem.position,
        "drop_spawn",
        nowMs
      );
      this.eventBus.emit("loot:drop", {
        sourceId: playerCombat.droppedItem.sourceId,
        item: playerCombat.droppedItem.item,
        position: playerCombat.droppedItem.position,
        timestampMs: nowMs
      });
    }
  }

  private handleMonsterDefeat(
    dead: NonNullable<ReturnType<EntityManager["removeMonsterById"]>>,
    nowMs: number
  ): void {
    if (dead.archetype.dropTableId === ELITE_DROP_TABLE_ID) {
      this.tasteRuntime.recordKeyKill("elite", this.run.currentFloor, "elite_kill", nowMs);
      this.eventBus.emit("pressure_peak", {
        floor: this.run.currentFloor,
        kind: "elite_kill",
        timestampMs: nowMs,
        label: this.contentLocalizer.monsterName(dead.archetype.id, dead.archetype.name)
      });
    }
    this.progressionRuntimeModule.onMonsterDefeated(dead.state, nowMs);
    for (const affixId of dead.state.affixes ?? []) {
      this.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
    }
    this.applyOnKillMutationEffects(nowMs);
    dead.sprite.destroy();
    dead.healthBarBg.destroy();
    dead.healthBarFg.destroy();
    dead.affixMarker?.destroy();
    this.spawnSplitChildren(dead.state, dead.archetype, nowMs);
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

  recordBuildLevelUpChoice(stat: keyof PlayerState["baseStats"], source: string, nowMs: number): void {
    this.tasteRuntime.recordLevelUpChoice(stat, this.run.currentFloor, source, nowMs);
    this.powerSpikeRuntimeModule.recordBuildFormed(source, nowMs);
  }

  recordPlayerFacingChoice(source: string, nowMs: number): void {
    this.markHighValueChoice(source, nowMs);
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

  private updatePressurePeakRuntime(nowMs: number): void {
    if (this.player.health <= 0) {
      this.nearDeathWindowArmedAtMs = null;
      return;
    }

    const healthRatio = this.player.health / Math.max(1, this.player.derivedStats.maxHealth);
    if (healthRatio <= NEAR_DEATH_ARM_THRESHOLD) {
      this.nearDeathWindowArmedAtMs ??= nowMs;
      return;
    }

    if (this.nearDeathWindowArmedAtMs === null) {
      return;
    }
    if (nowMs - this.nearDeathWindowArmedAtMs > NEAR_DEATH_RECOVERY_WINDOW_MS) {
      this.nearDeathWindowArmedAtMs = null;
      return;
    }
    if (healthRatio < NEAR_DEATH_RECOVERY_THRESHOLD || nowMs < this.nearDeathFeedbackCooldownUntilMs) {
      return;
    }

    this.nearDeathWindowArmedAtMs = null;
    this.nearDeathFeedbackCooldownUntilMs = nowMs + NEAR_DEATH_FEEDBACK_COOLDOWN_MS;
    this.eventBus.emit("pressure_peak", {
      floor: this.run.currentFloor,
      kind: "near_death_reversal",
      timestampMs: nowMs
    });
  }

  describeItem(item: ItemInstance): string {
    return this.powerSpikeRuntimeModule.describeItem(item);
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

  resolveRunRecommendations() {
    return this.tasteRuntime.buildRecommendations();
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

  private isMonsterWalkable(position: { x: number; y: number }): boolean {
    const tileX = Math.round(position.x);
    const tileY = Math.round(position.y);
    if (tileX < 0 || tileY < 0 || tileX >= this.dungeon.width || tileY >= this.dungeon.height) {
      return false;
    }
    return this.dungeon.walkable[tileY]?.[tileX] === true;
  }

  private updateMonsters(dt: number, nowMs: number): void {
    const livingMonsters = this.entityManager.listLivingMonsters();
    if (livingMonsters.length === 0) {
      return;
    }

    const nearMonsters = this.entityManager.queryMonstersInRadius(
      this.player.position,
      AI_ACTIVE_RADIUS_TILES,
      true
    );
    this.lastAiNearCount = nearMonsters.length;
    const nearIds = new Set(nearMonsters.map((monster) => monster.state.id));
    const farMonsters = livingMonsters.filter((monster) => !nearIds.has(monster.state.id));
    this.lastAiFarCount = farMonsters.length;
    const nearResult = this.aiSystem.updateMonsters(nearMonsters, this.player, dt, nowMs, {
      canMoveTo: (position) => this.isMonsterWalkable(position)
    });
    this.aiFrameCounter = (this.aiFrameCounter + 1) % AI_FAR_UPDATE_INTERVAL_FRAMES;
    const farResult =
      farMonsters.length > 0 && this.aiFrameCounter === 0
        ? this.aiSystem.updateMonsters(
            farMonsters,
            this.player,
            dt * AI_FAR_UPDATE_INTERVAL_FRAMES,
            nowMs,
            {
              canMoveTo: (position) => this.isMonsterWalkable(position)
            }
          )
        : { transitions: [], supportActions: [] };
    const aiResult = this.mergeAiResults(nearResult, farResult);
    this.entityManager.rebuildMonsterSpatialIndex();

    for (const transition of aiResult.transitions) {
      this.eventBus.emit("monster:stateChange", transition);
    }

    for (const action of aiResult.supportActions) {
      const target = this.entityManager.findMonsterById(action.targetMonsterId);
      const source = this.entityManager.findMonsterById(action.sourceMonsterId);
      if (target === undefined || source === undefined || target.state.health <= 0) {
        continue;
      }
      const before = target.state.health;
      target.state.health = Math.min(target.state.maxHealth, target.state.health + action.amount);
      if (target.state.health > before) {
        this.runLog.appendKey(
          "log.monster.support_heal",
          {
            sourceName: source.archetype.name,
            targetName: target.archetype.name,
            amount: target.state.health - before
          },
          "info",
          action.timestampMs
        );
        this.hudDirty = true;
      }
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

  private updateMonsterCombat(nowMs: number): void {
    const healthBeforeHits = this.player.health;
    const monsterCombat = this.combatSystem.updateMonsterAttacks(
      this.entityManager.queryMonstersInRadius(
        this.player.position,
        MONSTER_COMBAT_RADIUS_TILES,
        true
      ),
      this.player,
      nowMs,
      this.combatRng
    );

    this.player = monsterCombat.player;
    const playerTookDamage = this.player.health < healthBeforeHits;
    if (playerTookDamage && nowMs <= this.mutationRuntime.onHitInvulnUntilMs) {
      this.player = {
        ...this.player,
        health: healthBeforeHits
      };
    } else if (
      playerTookDamage &&
      nowMs > this.mutationRuntime.onHitInvulnCooldownUntilMs
    ) {
      const invulnEffects = this.collectMutationEffects("on_hit_invuln");
      for (const effect of invulnEffects) {
        if (this.combatRng.next() >= effect.chance) {
          continue;
        }
        this.mutationRuntime.onHitInvulnUntilMs = nowMs + effect.durationMs;
        this.mutationRuntime.onHitInvulnCooldownUntilMs = nowMs + effect.cooldownMs;
        this.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:on_hit_invuln",
          effectType: "on_hit_invuln",
          timestampMs: nowMs,
          value: effect.durationMs
        });
        break;
      }
    }

    if (this.player.health <= 0) {
      const lethalGuard = this.collectMutationEffects("once_per_floor_lethal_guard")
        .map((effect) => effect.invulnMs)
        .sort((left, right) => right - left)[0];
      if (
        lethalGuard !== undefined &&
        !this.mutationRuntime.lethalGuardUsedFloors.has(this.run.currentFloor)
      ) {
        this.mutationRuntime.lethalGuardUsedFloors.add(this.run.currentFloor);
        this.mutationRuntime.onHitInvulnUntilMs = nowMs + lethalGuard;
        this.player = {
          ...this.player,
          health: 1
        };
        this.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:lethal_guard",
          effectType: "once_per_floor_lethal_guard",
          timestampMs: nowMs,
          value: lethalGuard
        });
      }
    }

    const reflectPercent = this.collectMutationEffects("on_hit_reflect_percent").reduce((sum, effect) => {
      return sum + effect.value;
    }, 0);
    if (reflectPercent > 0) {
      for (const event of monsterCombat.combatEvents) {
        if (event.targetId !== this.player.id || (event.kind !== "damage" && event.kind !== "crit") || event.amount <= 0) {
          continue;
        }
        const source = this.entityManager.findMonsterById(event.sourceId);
        if (source === undefined || source.state.health <= 0) {
          continue;
        }
        const reflectedDamage = Math.max(1, Math.floor(event.amount * reflectPercent));
        source.state.health = Math.max(0, source.state.health - reflectedDamage);
        this.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:on_hit_reflect",
          effectType: "on_hit_reflect_percent",
          timestampMs: nowMs,
          value: reflectedDamage,
          detail: source.state.id
        });
        if (source.state.health > 0) {
          continue;
        }
        const dead = this.entityManager.removeMonsterById(source.state.id);
        if (dead === null) {
          continue;
        }
        this.handleMonsterDefeat(dead, nowMs);
        const { obolMultiplier } = this.resolveMutationDropBonus();
        this.run = addRunObols(
          {
            ...this.run,
            kills: this.run.kills + 1,
            totalKills: this.run.totalKills + 1,
            endlessKills: (this.run.endlessKills ?? 0) + (this.run.inEndless ? 1 : 0)
          },
          Math.max(1, Math.floor(obolMultiplier))
        );
      }
    }

    this.emitCombatEvents(monsterCombat.combatEvents);
    this.phase6Telemetry.recordCombatEvents(this.player.id, monsterCombat.combatEvents, "other");
    for (const event of monsterCombat.combatEvents) {
      if (event.kind === "dodge" || event.amount <= 0) {
        continue;
      }
      const source = this.entityManager.findMonsterById(event.sourceId);
      if (source === undefined) {
        continue;
      }
      const affixResult = resolveMonsterAffixOnDealDamage(
        source.state,
        event.targetId,
        event.amount,
        nowMs
      );
      source.state = affixResult.monster;
      if (affixResult.leechEvent === undefined) {
        continue;
      }
      this.eventBus.emit("monster:leech", affixResult.leechEvent);
    }
    if (monsterCombat.combatEvents.length > 0) {
      this.hudDirty = true;
    }
  }

  private spawnSplitChildren(
    sourceState: MonsterState,
    archetype: (typeof MONSTER_ARCHETYPES)[number],
    nowMs: number
  ): void {
    const splitResult = resolveMonsterAffixOnKilled(sourceState, nowMs);
    if (splitResult.children.length === 0) {
      return;
    }

    for (const childState of splitResult.children) {
      const runtime = this.renderSystem.spawnMonster(childState, archetype, this.origin);
      this.entityManager.listMonsters().push(runtime);
      this.entityLabelById.set(childState.id, `${archetype.name} Fragment`);
      for (const affix of childState.affixes ?? []) {
        this.eventBus.emit("monster:affixApplied", {
          monsterId: childState.id,
          affixId: affix,
          timestampMs: nowMs
        });
      }
    }

    this.entityManager.rebuildMonsterSpatialIndex();
    if (splitResult.splitEvent !== undefined) {
      this.eventBus.emit("monster:split", splitResult.splitEvent);
    }
  }

  private collectNearbyLoot(nowMs: number): void {
    const picked = this.entityManager.consumeLootNear(this.player.position, LOOT_PICKUP_RADIUS_TILES);
    if (picked.length === 0) {
      return;
    }

    for (const drop of picked) {
      const baselinePlayer = this.player;
      this.player = collectLoot(this.player, drop.item);
      this.run = {
        ...this.run,
        lootCollected: this.run.lootCollected + 1
      };
      this.tasteRuntime.recordPickup(drop.item, this.run.currentFloor, "auto_pickup", nowMs);
      this.recordAcquiredItemTelemetry(drop.item, "auto_pickup", nowMs, baselinePlayer);
      this.heartbeatFeedbackRuntime.maybeQueueEquipmentCompare(drop.item, "auto_pickup");
      drop.sprite.destroy();
      this.eventBus.emit("loot:pickup", {
        playerId: this.player.id,
        item: drop.item,
        position: drop.position,
        timestampMs: nowMs
      });
    }
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

  flushQueuedComparePrompts(): boolean {
    return this.heartbeatFeedbackRuntime.flushImmediateComparePrompts();
  }

  private tryUseSkill(slotIndex: number): void {
    this.playerActionModule.tryUseSkill(slotIndex);
  }

  private tryUseConsumable(consumableId: ConsumableId): void {
    this.playerActionModule.tryUseConsumable(consumableId);
  }

  private renderHud(): void {
    const nowMs = this.time.now;
    const newlyAcquiredItemIds = this.collectNewlyAcquiredItemIds(nowMs);
    const statHighlightSnapshot = collectActiveHudStatHighlights(this.statHighlightEntries, nowMs);
    this.statHighlightEntries = statHighlightSnapshot.persisted;
    if (this.levelUpPulseUntilMs <= nowMs) {
      this.levelUpPulseLevel = null;
    }
    const levelUpPulseLevel = this.levelUpPulseUntilMs > nowMs ? (this.levelUpPulseLevel ?? this.player.level) : undefined;
    const consumables = CONSUMABLE_DEFS.map((def) => {
      const cooldownLeftMs = Math.max(0, (this.consumables.cooldowns[def.id] ?? 0) - nowMs);
      const availability = canUseConsumable(this.player, this.consumables, def.id, nowMs);
      return {
        id: def.id,
        name: consumableNameLabel(def.id, def.name),
        description: consumableDescriptionLabel(def.id, def.description),
        hotkey: def.hotkey ?? "-",
        iconId: CONSUMABLE_ICON_BY_ID[def.id],
        charges: this.consumables.charges[def.id] ?? 0,
        cooldownLeftMs,
        ...(availability.ok ? {} : { disabledReason: consumableFailureReasonLabel(availability.reason) })
      };
    });
    const activeSkillIds = new Set<string>();
    let hasActiveSkillCooldown = false;
    const skillSlots = (this.player.skills?.skillSlots ?? []).map((slot, index) => {
      if (slot === null) {
        return {
          hotkey: String(index + 1),
          name: t("ui.skillbar.locked_slot_name"),
          description: t("ui.skillbar.locked_slot_description"),
          iconId: "meta_unlock_locked",
          cooldownLeftMs: 0,
          outOfMana: false,
          locked: true
        };
      }
      activeSkillIds.add(slot.defId);
      const skillDef = SKILL_DEF_BY_ID.get(slot.defId);
      const scaledSkillDef = skillDef === undefined ? undefined : createSkillDefForLevel(skillDef, slot.level);
      const runtimeSkillDef =
        scaledSkillDef === undefined ? undefined : this.resolveRuntimeSkillDef(scaledSkillDef);
      const cooldownLeftMs = Math.max(0, (this.player.skills?.cooldowns[slot.defId] ?? 0) - nowMs);
      if (cooldownLeftMs > 0) {
        hasActiveSkillCooldown = true;
      }
      const previousCooldownLeftMs = this.previousSkillCooldownLeftById.get(slot.defId) ?? 0;
      if (previousCooldownLeftMs > 0 && cooldownLeftMs === 0) {
        this.skillReadyFlashUntilMsById.set(slot.defId, nowMs + SKILL_READY_FLASH_DURATION_MS);
      }
      this.previousSkillCooldownLeftById.set(slot.defId, cooldownLeftMs);
      const readyFlashUntilMs = this.skillReadyFlashUntilMsById.get(slot.defId) ?? 0;
      const readyFlash = readyFlashUntilMs > nowMs;
      if (!readyFlash && readyFlashUntilMs > 0) {
        this.skillReadyFlashUntilMsById.delete(slot.defId);
      }
      const baseCooldownMs = runtimeSkillDef?.cooldownMs ?? scaledSkillDef?.cooldownMs ?? skillDef?.cooldownMs ?? 0;
      const resolvedName = runtimeSkillDef?.name ?? scaledSkillDef?.name ?? skillDef?.name ?? slot.defId;
      const resolvedDescription =
        runtimeSkillDef?.description ?? scaledSkillDef?.description ?? skillDef?.description ?? "";
      return {
        id: slot.defId,
        hotkey: String(index + 1),
        name: `${this.contentLocalizer.skillName(slot.defId, resolvedName)} Lv.${slot.level}`,
        description: this.contentLocalizer.skillDescription(slot.defId, resolvedDescription),
        iconId: runtimeSkillDef?.icon ?? scaledSkillDef?.icon ?? skillDef?.icon ?? "meta_unlock_available",
        cooldownLeftMs,
        baseCooldownMs,
        cooldownProgress:
          baseCooldownMs > 0 ? Math.min(1, Math.max(0, cooldownLeftMs / baseCooldownMs)) : 0,
        readyFlash,
        manaCost: runtimeSkillDef?.manaCost ?? scaledSkillDef?.manaCost ?? skillDef?.manaCost ?? 0,
        targeting: runtimeSkillDef?.targeting ?? scaledSkillDef?.targeting ?? skillDef?.targeting ?? "self",
        range: runtimeSkillDef?.range ?? scaledSkillDef?.range ?? skillDef?.range ?? 0,
        outOfMana: this.player.mana < (runtimeSkillDef?.manaCost ?? scaledSkillDef?.manaCost ?? skillDef?.manaCost ?? 0),
        locked: false
      };
    });
    for (const skillId of [...this.previousSkillCooldownLeftById.keys()]) {
      if (!activeSkillIds.has(skillId)) {
        this.previousSkillCooldownLeftById.delete(skillId);
        this.skillReadyFlashUntilMsById.delete(skillId);
      }
    }

    const runState = {
      floor: this.run.currentFloor,
      difficulty: this.run.difficulty,
      runMode: this.run.runMode,
      inEndless: this.run.inEndless,
      endlessFloor: this.run.endlessFloor,
      endlessMutators: (this.run.mutatorActiveIds ?? []).map((mutatorId) =>
        describeEndlessMutator(mutatorId)
      ),
      biome: this.contentLocalizer.biomeName(this.currentBiome.id, this.currentBiome.name),
      kills: this.run.kills,
      lootCollected: this.run.lootCollected,
      targetKills: this.floorConfig.monsterCount,
      obols: this.run.runEconomy.obols,
      floorGoalReached: this.staircaseState.visible || this.mapRevealActive,
      mappingRevealed: this.mapRevealActive,
      newlyAcquiredItemIds,
      ...(levelUpPulseLevel === undefined ? {} : { levelUpPulseLevel }),
      ...(statHighlightSnapshot.active.length === 0
        ? {}
        : { statHighlights: statHighlightSnapshot.active }),
      consumables,
      skillSlots,
      isBossFloor: this.floorConfig.isBossFloor,
      bossPhase: this.bossState?.currentPhaseIndex ?? 0,
      ...(this.bossState === null
        ? {}
        : {
            bossHealth: this.bossState.health,
            bossMaxHealth: this.bossState.maxHealth
          })
    };
    this.recomputeNextTransientHudRefreshAt(
      nowMs,
      hasActiveSkillCooldown,
      statHighlightSnapshot.nextRefreshAt
    );

    const viewState = {
      player: this.player,
      run: runState,
      meta: this.meta
    };
    const snapshot = this.hudPresenter.buildSnapshot({
      view: viewState,
      logs: this.uiManager.getLogs(),
      flags: {
        runEnded: this.runEnded,
        eventPanelOpen: this.isBlockingOverlayOpen(),
        debugCheatsEnabled: this.debugCheatsEnabled,
        timestampMs: nowMs
      }
    });
    this.uiManager.renderSnapshot(snapshot);
  }

  private registerStatDeltaHighlights(
    beforeStats: PlayerState["derivedStats"],
    afterStats: PlayerState["derivedStats"],
    nowMs: number
  ): void {
    const nextEntries = buildHudStatHighlightEntries(
      beforeStats,
      afterStats,
      nowMs,
      STAT_HIGHLIGHT_DURATION_MS
    );
    if (nextEntries.length === 0) {
      return;
    }
    const activeEntries = this.statHighlightEntries.filter((entry) => entry.expiresAtMs > nowMs);
    const mergedByKey = new Map(activeEntries.map((entry) => [entry.key, entry] as const));
    for (const entry of nextEntries) {
      mergedByKey.set(entry.key, entry);
      if (entry.expiresAtMs < this.nextTransientHudRefreshAt) {
        this.nextTransientHudRefreshAt = entry.expiresAtMs;
      }
    }
    this.statHighlightEntries = [...mergedByKey.values()];
  }

  private collectNewlyAcquiredItemIds(nowMs: number): string[] {
    if (this.newlyAcquiredItemUntilMs.size === 0) {
      return [];
    }
    const inventoryIds = new Set(this.player.inventory.map((item) => item.id));
    const visibleIds: string[] = [];
    for (const [itemId, expiresAtMs] of this.newlyAcquiredItemUntilMs) {
      if (expiresAtMs <= nowMs || !inventoryIds.has(itemId)) {
        this.newlyAcquiredItemUntilMs.delete(itemId);
        continue;
      }
      visibleIds.push(itemId);
    }
    return visibleIds;
  }

  private recomputeNextTransientHudRefreshAt(
    nowMs: number,
    hasActiveSkillCooldown: boolean,
    nextStatHighlightAt = Number.POSITIVE_INFINITY
  ): void {
    let next = Number.POSITIVE_INFINITY;
    for (const expiresAtMs of this.newlyAcquiredItemUntilMs.values()) {
      if (expiresAtMs > nowMs && expiresAtMs < next) {
        next = expiresAtMs;
      }
    }
    for (const expiresAtMs of this.skillReadyFlashUntilMsById.values()) {
      if (expiresAtMs > nowMs && expiresAtMs < next) {
        next = expiresAtMs;
      }
    }
    if (hasActiveSkillCooldown) {
      next = Math.min(next, nowMs + 120);
    }
    if (this.levelUpPulseUntilMs > nowMs) {
      next = Math.min(next, this.levelUpPulseUntilMs);
    }
    if (nextStatHighlightAt > nowMs) {
      next = Math.min(next, nextStatHighlightAt);
    }
    this.nextTransientHudRefreshAt = next;
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
              return this.collectDiagnosticsSnapshot();
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
    this.clearKeyboardBindings();
    this.uiManager.reset();
    if (!this.preserveSceneTransitionOnCleanup) {
      hideSceneTransition();
    }
    this.removeDebugApi();
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
    this.diagnosticsService.reset();
    if (this.diagnosticsEnabled) {
      const after = this.collectDiagnosticsSnapshot();
      console.info("[Blodex] cleanup diagnostics", {
        before,
        after
      });
    }
  }

  private loadMeta(): MetaProgression {
    const rawV2 = window.localStorage.getItem(META_STORAGE_KEY_V2);
    if (rawV2 !== null) {
      try {
        return migrateMeta(JSON.parse(rawV2));
      } catch {
        return createInitialMeta();
      }
    }

    const rawV1 = window.localStorage.getItem(META_STORAGE_KEY_V1);
    if (rawV1 !== null) {
      try {
        const migrated = migrateMeta(JSON.parse(rawV1));
        window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(migrated));
        return migrated;
      } catch {
        return createInitialMeta();
      }
    }

    return createInitialMeta();
  }

  private saveMeta(meta: MetaProgression): boolean {
    try {
      window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(meta));
      this.refreshTalentEffects();
      return true;
    } catch {
      return false;
    }
  }
}
