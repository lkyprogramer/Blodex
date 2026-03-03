import Phaser from "phaser";
import {
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
  applyXpGain,
  canEquip,
  canUseSkill,
  collectLoot,
  grantConsumable,
  hasClaimedDailyReward,
  hasMonsterAffix,
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
  createRunSeed,
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
  resolveMonsterAttack,
  SeededRng,
  selectBossAttack,
  resolveBossAttack,
  useConsumable,
  upsertDailyHistory,
  type CombatEvent,
  type BossDef,
  type BossRuntimeState,
  type ChallengeRoomState,
  type ConsumableId,
  type ConsumableState,
  type DungeonLayout,
  type DifficultyMode,
  type EventReward,
  type GameEventMap,
  type GridNode,
  type HazardRuntimeState,
  type ItemDef,
  type ItemInstance,
  type MerchantOffer,
  type MetaProgression,
  type MutationEffect,
  type MonsterAffixId,
  type MonsterState,
  type PlayerState,
  type RandomEventDef,
  type RunMode,
  type RunRngStreamName,
  type RunSaveDataV2,
  type RuntimeEventNodeState,
  type RunState,
  type StaircaseState,
  type SkillDef,
  type SynergyRuntimeEffects,
  type TalentEffectTotals,
  type WeaponType
} from "@blodex/core";
import {
  BIOME_MAP,
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
import { EntityManager } from "../systems/EntityManager";
import { UI_POLISH_FLAGS } from "../config/uiFlags";
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
import { DiagnosticsService } from "./dungeon/diagnostics/DiagnosticsService";
import { EncounterController } from "./dungeon/encounter/EncounterController";
import { RunLogService } from "./dungeon/logging/RunLogService";
import { RunFlowOrchestrator } from "./dungeon/orchestrator/RunFlowOrchestrator";
import { SaveCoordinator } from "./dungeon/save/SaveCoordinator";
import { HudPresenter } from "./dungeon/ui/HudPresenter";
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
const FLOOR_EVENT_SPAWN_CHANCE = 0.62;
const DEBUG_CHEATS_QUERY = "debugCheats";
const DISABLE_VFX_QUERY = "disableVfx";
const DISABLE_SFX_QUERY = "disableSfx";
const DEBUG_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);
const DEBUG_LOCKED_EQUIP_QUERY = "debugEquipGate";
const DEBUG_DIAGNOSTICS_QUERY = "debugDiagnostics";
const DEBUG_LOCKED_EQUIP_ICON_ID = "item_ring_02";
const MINIMAP_REFRESH_INTERVAL_MS = 120;
const MANUAL_PATH_REPLAN_INTERVAL_MS = 90;
const KEYBOARD_MOVE_INPUT_INTERVAL_MS = 70;
const AI_ACTIVE_RADIUS_TILES = 10;
const AI_FAR_UPDATE_INTERVAL_FRAMES = 3;
const MONSTER_COMBAT_RADIUS_TILES = 12;
const LOOT_PICKUP_RADIUS_TILES = 1.15;
const ITEM_NEWLY_ACQUIRED_TTL_MS = 2_000;
const SKILL_READY_FLASH_DURATION_MS = 480;
const CONSUMABLE_ICON_BY_ID: Record<ConsumableId, string> = {
  health_potion: "item_consumable_health_potion_01",
  mana_potion: "item_consumable_mana_potion_01",
  scroll_of_mapping: "item_consumable_scroll_mapping_01"
};
const SKILL_DEF_BY_ID = new Map(SKILL_DEFS.map((entry) => [entry.id, entry]));
const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);
const DAILY_WEAPON_ROTATION: WeaponType[] = ["sword", "axe", "dagger", "staff", "hammer"];
const DAILY_MUTATION_COUNT = 2;
const ABYSS_VICTORY_EVENT_ID = "boss_victory_choice";
const DEBUG_COMMANDS = [
  { combo: "Alt+H", description: "Show cheat commands" },
  { combo: "Alt+L", description: "Dump diagnostics snapshot to console/log" },
  { combo: "Alt+J", description: "Run lifecycle smoke reset loop (12 iterations)" },
  { combo: "Alt+O", description: "Add 30 Obol" },
  { combo: "Alt+C", description: "Grant 2 charges for all consumables" },
  { combo: "Alt+E", description: "Force spawn random event and open panel" },
  { combo: "Alt+M", description: "Open wandering merchant panel" },
  { combo: "Alt+K", description: "Clear current floor instantly" },
  { combo: "Alt+X", description: "Force player death (death feedback check)" },
  { combo: "API.setHealth(value)", description: "Set player HP directly for HUD/feedback validation" },
  { combo: "Alt+1..5", description: "Jump to floor 1-5 (biome/hazard/boss checks)" },
  { combo: "Alt+N", description: "Start a fresh run" },
  { combo: "API.forceChallenge()", description: "Inject a challenge room on current floor" },
  { combo: "API.startChallenge()", description: "Start challenge encounter immediately" },
  { combo: "API.settleChallenge(true|false)", description: "Force challenge success/failure" },
  { combo: "API.openBossVictory()", description: "Open boss victory choice instantly" },
  { combo: "API.enterAbyss()", description: "Force enter abyss/endless" },
  { combo: "API.nextFloor()", description: "Advance to next floor immediately" },
  { combo: "API.forceSynergy(id)", description: "Inject loadout to activate a synergy quickly" }
] as const;

interface BlodexDebugApi {
  addObols: (amount?: number) => void;
  grantConsumables: (charges?: number) => void;
  spawnEvent: (eventId?: string) => void;
  openMerchant: () => void;
  clearFloor: () => void;
  jumpFloor: (floor: number) => void;
  setHealth: (value: number) => number;
  killPlayer: () => void;
  newRun: () => void;
  forceChallenge: () => boolean;
  startChallenge: () => boolean;
  settleChallenge: (success?: boolean) => boolean;
  openBossVictory: () => boolean;
  enterAbyss: () => boolean;
  nextFloor: () => boolean;
  forceSynergy: (synergyId?: string) => string[];
  diagnostics: () => Record<string, unknown>;
  stressRuns: (iterations?: number) => Record<string, unknown>;
  help: () => string[];
}

declare global {
  interface Window {
    __blodexDebug?: BlodexDebugApi;
  }
}

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
  private readonly runLog = new RunLogService({
    append: () => {
      // UI sink is bound in create().
    }
  });
  private saveCoordinator!: SaveCoordinator;
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
  private mapRevealActive = false;
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
  private nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;

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
          this.runLog.append(`Feedback degraded for ${type}; continuing run safely.`, "warn", this.time.now);
        }
      }
    );
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
    this.debugCheatsEnabled = this.isDebugCheatsEnabled();
    this.diagnosticsEnabled = this.resolveDebugFlag(DEBUG_DIAGNOSTICS_QUERY) || this.debugCheatsEnabled;
    this.vfxSystem.setEnabled(!this.resolveDebugFlag(DISABLE_VFX_QUERY));
    this.sfxSystem.setEnabled(!this.resolveDebugFlag(DISABLE_SFX_QUERY));
    this.meta = this.loadMeta();
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
          this.runLog.append(`Equip failed: item ${itemId} not found in backpack.`, "warn", this.time.now);
          return;
        }

        if (!canEquip(this.player, item)) {
          this.runLog.append(
            `Cannot equip ${item.name}: Need Lv${item.requiredLevel}, current Lv${this.player.level}.`,
            "warn",
            this.time.now
          );
          return;
        }

        this.player = this.refreshPlayerStatsFromEquipment(equipItem(this.player, itemId));
        const equipped = this.player.equipment[item.slot];
        if (equipped?.id === item.id) {
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

        this.runLog.append(`Equip failed: ${item.name} could not be equipped.`, "warn", this.time.now);
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
        this.player = this.refreshPlayerStatsFromEquipment(unequippedPlayer);
        if (equipped !== undefined) {
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
          this.runLog.append(`Discard failed: item ${itemId} not found in backpack.`, "warn", this.time.now);
          return;
        }
        this.player = {
          ...this.player,
          inventory: this.player.inventory.filter((candidate) => candidate.id !== itemId)
        };
        this.hudDirty = true;
        this.runLog.append(`Discarded ${item.name}.`, "info", this.time.now);
      },
      (consumableId) => {
        this.tryUseConsumable(consumableId);
      },
      () => {
        this.preserveSceneTransitionOnCleanup = true;
        playSceneTransition({
          title: "Return to Sanctum",
          subtitle: "Meta Progression",
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
      buildSnapshot: () => this.buildRunSaveSnapshot(this.time.now)
    });
    this.encounterController = new EncounterController({
      updateCombat: (nowMs) => this.updateCombat(nowMs),
      updateMonsters: (deltaSeconds, nowMs) => this.updateMonsters(deltaSeconds, nowMs),
      updateMonsterCombat: (nowMs) => this.updateMonsterCombat(nowMs),
      updateBossCombat: (nowMs) => this.updateBossCombat(nowMs),
      updateChallengeRoom: (nowMs) => this.updateChallengeRoom(nowMs)
    });
    this.worldEventController = new WorldEventController({
      updateHazards: (nowMs) => this.updateHazards(nowMs),
      collectNearbyLoot: (nowMs) => this.collectNearbyLoot(nowMs),
      updateEventInteraction: (nowMs) => this.updateEventInteraction(nowMs),
      updateFloorProgress: (nowMs) => this.updateFloorProgress(nowMs),
      updateMinimap: (nowMs) => this.updateMinimap(nowMs)
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
    if (this.pendingResumeSave !== null && this.restoreRunFromSave(this.pendingResumeSave)) {
      this.saveCoordinator.startHeartbeat();
      this.runLog.append("Resumed saved run.", "info", this.time.now);
      this.flushRunSave();
    } else {
      this.bootstrapRun(this.resolveInitialRunSeed(), this.selectedDifficulty);
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
      `FPS ${fps.toFixed(1)} | floor ${this.run.currentFloor} ${this.run.difficulty.toUpperCase()}`,
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
      sfx: this.sfxSystem.getDiagnostics()
    };
  }

  update(_: number, deltaMs: number): void {
    const nowMs = this.time.now;
    if (!UI_POLISH_FLAGS.sceneRefactorR1Enabled) {
      if (this.runEnded) {
        return;
      }
      if (this.eventPanelOpen) {
        this.runEventPanelFrame(nowMs);
        return;
      }
      this.runActiveFrame(nowMs, deltaMs);
      return;
    }

    this.runFlowOrchestrator.update({
      runEnded: this.runEnded,
      eventPanelOpen: this.eventPanelOpen,
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
    const playerHazardMovementMultiplier = this.resolvePlayerHazardMovementMultiplier();
    const mutationMoveMultiplier = this.resolveMutationMoveSpeedMultiplier();

    this.updateKeyboardMoveIntent(nowMs);
    this.updatePlayerMovement((deltaMs / 1000) * playerHazardMovementMultiplier * mutationMoveMultiplier, nowMs);
    this.revealNearbyHiddenRoomsByMutation(nowMs);
    this.encounterController.updateFrame({
      deltaSeconds: deltaMs / 1000,
      nowMs
    });
    this.worldEventController.updatePreResolution(nowMs);

    this.renderSystem.syncPlayerSprite(this.playerSprite, this.player.position, this.playerYOffset, this.origin);
    this.renderSystem.syncMonsterSprites(this.entityManager.listMonsters(), this.origin);
    this.syncBossSprite();

    if (this.player.health <= 0) {
      this.finishRun(false);
      return;
    }

    if (this.floorConfig.isBossFloor && this.bossState !== null && this.bossState.health <= 0) {
      if (this.run.inEndless) {
        this.finishRun(true);
      } else {
        this.openBossVictoryChoice(nowMs);
      }
      return;
    }

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
          action.critical
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
      default:
        return;
    }
  }

  private bindDomainEventEffects(): void {
    this.eventBus.on("combat:hit", ({ combat }) => {
      this.routeFeedback({
        type: "combat:hit",
        combat
      });
      this.hudDirty = true;
      const source = this.resolveEntityLabel(combat.sourceId);
      const target = this.resolveEntityLabel(combat.targetId);
      if (combat.targetId === this.player.id) {
        this.runLog.append(
          `${source} hit ${target} for ${combat.amount} damage.`,
          combat.kind === "crit" ? "danger" : "warn",
          combat.timestampMs
        );
        return;
      }
      this.runLog.append(
        `${source} ${combat.kind === "crit" ? "critically hit" : "hit"} ${target} for ${combat.amount} damage.`,
        combat.kind === "crit" ? "success" : "info",
        combat.timestampMs
      );
    });

    this.eventBus.on("combat:dodge", ({ combat }) => {
      this.routeFeedback({
        type: "combat:dodge",
        combat
      });
      this.hudDirty = true;
      const source = this.resolveEntityLabel(combat.sourceId);
      const target = this.resolveEntityLabel(combat.targetId);
      this.runLog.append(
        `${target} dodged ${source}'s attack.`,
        combat.targetId === this.player.id ? "success" : "info",
        combat.timestampMs
      );
    });

    this.eventBus.on("combat:death", ({ combat }) => {
      this.routeFeedback({
        type: "combat:death",
        combat
      });
      this.hudDirty = true;
      const source = this.resolveEntityLabel(combat.sourceId);
      const target = this.resolveEntityLabel(combat.targetId);
      if (combat.targetId === this.player.id) {
        this.lastDeathReason = `Slain by ${source} (${combat.amount} ${combat.damageType} damage).`;
        this.runLog.append(`${target} was slain by ${source}.`, "danger", combat.timestampMs);
        return;
      }
      this.runLog.append(`${target} was slain by ${source}.`, "success", combat.timestampMs);
    });

    this.eventBus.on("loot:drop", ({ sourceId, item, timestampMs }) => {
      this.hudDirty = true;
      this.runLog.append(
        `${this.resolveEntityLabel(sourceId)} dropped ${item.name}.`,
        "info",
        timestampMs
      );
    });

    this.eventBus.on("loot:pickup", ({ item, timestampMs }) => {
      this.hudDirty = true;
      const expiresAtMs = timestampMs + ITEM_NEWLY_ACQUIRED_TTL_MS;
      this.newlyAcquiredItemUntilMs.set(item.id, expiresAtMs);
      this.nextTransientHudRefreshAt = Math.min(this.nextTransientHudRefreshAt, expiresAtMs);
      this.runLog.append(`Picked up ${item.name}.`, "success", timestampMs);
    });

    this.eventBus.on("player:levelup", ({ level, timestampMs }) => {
      this.hudDirty = true;
      this.runLog.append(`Level up! Vanguard reached Lv${level}.`, "success", timestampMs);
    });

    this.eventBus.on("item:equip", ({ item, slot, timestampMs }) => {
      this.hudDirty = true;
      this.runLog.append(`Equipped ${item.name} (${slot}).`, "success", timestampMs);
    });

    this.eventBus.on("item:unequip", ({ item, slot, timestampMs }) => {
      this.hudDirty = true;
      this.runLog.append(`Unequipped ${item.name} (${slot}).`, "info", timestampMs);
    });

    this.eventBus.on("skill:use", ({ playerId, skillId, timestampMs }) => {
      this.routeFeedback({
        type: "skill:use",
        skillId,
        playerId
      });
      this.runLog.append(`Skill used: ${skillId}.`, "info", timestampMs);
    });

    this.eventBus.on("skill:cooldown", ({ skillId, readyAtMs }) => {
      const cooldownMs = Math.max(0, readyAtMs - this.time.now);
      this.runLog.append(
        `${skillId} cooldown ${(cooldownMs / 1000).toFixed(1)}s.`,
        "info",
        this.time.now
      );
    });

    this.eventBus.on("consumable:use", ({ consumableId, amountApplied, remainingCharges, timestampMs }) => {
      this.routeFeedback({
        type: "consumable:use",
        consumableId
      });
      this.hudDirty = true;
      const label =
        consumableId === "health_potion"
          ? `Health potion restored ${amountApplied} HP`
          : consumableId === "mana_potion"
            ? `Mana potion restored ${amountApplied} mana`
            : "Scroll of Mapping revealed objective";
      this.runLog.append(`${label}. Charges left: ${remainingCharges}.`, "success", timestampMs);
    });

    this.eventBus.on("consumable:failed", ({ consumableId, reason, timestampMs }) => {
      this.hudDirty = true;
      this.runLog.append(`Cannot use ${consumableId}: ${reason}`, "warn", timestampMs);
    });

    this.eventBus.on("event:spawn", ({ eventId, eventName, floor, timestampMs }) => {
      this.routeFeedback({
        type: "event:spawn",
        eventId
      });
      this.hudDirty = true;
      this.runLog.append(`Event discovered on floor ${floor}: ${eventName}.`, "info", timestampMs);
    });

    this.eventBus.on("event:choice", ({ eventId, choiceId, timestampMs }) => {
      this.hudDirty = true;
      this.runLog.append(`Event choice selected: ${eventId} -> ${choiceId}.`, "info", timestampMs);
    });

    this.eventBus.on("merchant:offer", ({ floor, offerCount, timestampMs }) => {
      this.routeFeedback({
        type: "merchant:offer"
      });
      this.runLog.append(`Merchant opened on floor ${floor} with ${offerCount} offers.`, "info", timestampMs);
    });

    this.eventBus.on("merchant:purchase", ({ itemName, priceObol, timestampMs }) => {
      this.routeFeedback({
        type: "merchant:purchase"
      });
      this.hudDirty = true;
      this.runLog.append(`Purchased ${itemName} for ${priceObol} Obol.`, "success", timestampMs);
      this.scheduleRunSave();
    });

    this.eventBus.on("monster:stateChange", ({ monsterId, from, to, timestampMs }) => {
      this.runLog.append(
        `${this.resolveEntityLabel(monsterId)} state: ${from} -> ${to}.`,
        "info",
        timestampMs
      );
    });

    this.eventBus.on("monster:affixApplied", ({ monsterId, affixId, timestampMs }) => {
      this.runLog.append(
        `${this.resolveEntityLabel(monsterId)} gained affix: ${affixId}.`,
        "warn",
        timestampMs
      );
    });

    this.eventBus.on("monster:split", ({ sourceMonsterId, spawnedIds, timestampMs }) => {
      this.runLog.append(
        `${this.resolveEntityLabel(sourceMonsterId)} split into ${spawnedIds.length} fragments.`,
        "warn",
        timestampMs
      );
    });

    this.eventBus.on("monster:leech", ({ monsterId, amount, targetId, timestampMs }) => {
      this.runLog.append(
        `${this.resolveEntityLabel(monsterId)} leeched ${amount} HP from ${this.resolveEntityLabel(targetId)}.`,
        "danger",
        timestampMs
      );
    });

    this.eventBus.on("run:start", ({ floor, runSeed, difficulty, startedAtMs }) => {
      this.routeFeedback({
        type: "run:start",
        biomeId: this.currentBiome.id
      });
      this.runLog.append(
        `Run started on floor ${floor} (${difficulty.toUpperCase()}, seed ${runSeed}).`,
        "info",
        startedAtMs
      );
    });

    this.eventBus.on("run:end", ({ summary, finishedAtMs }) => {
      this.hudDirty = true;
      this.runLog.append(
        summary.isVictory
          ? `Run complete! Floor ${summary.floorReached}, level ${summary.leveledTo}.`
          : `Run ended on floor ${summary.floorReached}, level ${summary.leveledTo}.`,
        summary.isVictory ? "success" : "danger",
        finishedAtMs
      );
    });

    this.eventBus.on("floor:enter", ({ floor, biomeId, timestampMs }) => {
      this.routeFeedback({
        type: "floor:enter",
        ...(biomeId === undefined ? {} : { biomeId })
      });
      this.hudDirty = true;
      const biomeName =
        biomeId === undefined ? "" : ` (${BIOME_MAP[biomeId]?.name ?? biomeId})`;
      this.runLog.append(`Entered floor ${floor}${biomeName}.`, "info", timestampMs);
      this.flushRunSave();
    });

    this.eventBus.on("floor:clear", ({ floor, kills, timestampMs }) => {
      this.hudDirty = true;
      this.runLog.append(`Floor ${floor} cleared with ${kills} kills.`, "success", timestampMs);
    });

    this.eventBus.on("boss:phaseChange", ({ bossId, toPhase, hpRatio, timestampMs }) => {
      this.routeFeedback({
        type: "boss:phaseChange",
        bossId
      });
      this.hudDirty = true;
      this.runLog.append(
        `Boss shifted to phase ${toPhase + 1} (${Math.floor(hpRatio * 100)}% HP).`,
        "warn",
        timestampMs
      );
    });

    this.eventBus.on("boss:summon", ({ count, timestampMs }) => {
      this.runLog.append(`Boss summoned ${count} minions.`, "warn", timestampMs);
    });

    this.eventBus.on("hazard:enter", ({ hazardType, targetId, timestampMs }) => {
      if (targetId !== this.player.id) {
        return;
      }
      this.runLog.append(`Entered ${hazardType} zone.`, "warn", timestampMs);
    });

    this.eventBus.on("hazard:exit", ({ hazardType, targetId, timestampMs }) => {
      if (targetId !== this.player.id) {
        return;
      }
      this.runLog.append(`Left ${hazardType} zone.`, "info", timestampMs);
    });

    this.eventBus.on("hazard:trigger", ({ hazardType, position, timestampMs }) => {
      this.routeFeedback({
        type: "hazard:trigger",
        hazardType,
        position
      });
      if (hazardType !== "periodic_trap") {
        this.runLog.append(`${hazardType} triggered.`, "warn", timestampMs);
      }
    });

    this.eventBus.on("hazard:damage", ({ hazardType, targetId, amount, remainingHealth, timestampMs }) => {
      if (hazardType === "periodic_trap" && targetId !== this.player.id) {
        return;
      }
      const label = this.resolveEntityLabel(targetId);
      const level = targetId === this.player.id ? "danger" : "info";
      this.runLog.append(
        `${label} took ${amount} damage from ${hazardType} (${Math.floor(remainingHealth)} HP left).`,
        level,
        timestampMs
      );
      this.hudDirty = true;
    });
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
        this.handleDebugHotkeys(event as KeyboardEvent);
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

  private resolveInitialRunSeed(): string {
    if (this.pendingRunSeed !== undefined && this.pendingRunSeed.trim().length > 0) {
      return this.pendingRunSeed.trim();
    }
    const requested = new URLSearchParams(window.location.search).get("seed");
    if (requested !== null && requested.trim().length > 0) {
      return requested.trim();
    }
    return createRunSeed();
  }

  private resolveDebugFlag(queryKey: string): boolean {
    const raw = new URLSearchParams(window.location.search).get(queryKey);
    if (raw === null) {
      return false;
    }
    return DEBUG_FLAG_VALUES.has(raw.trim().toLowerCase());
  }

  private isDebugCheatsEnabled(): boolean {
    if (!import.meta.env.DEV) {
      return false;
    }
    return this.resolveDebugFlag(DEBUG_CHEATS_QUERY);
  }

  private isDebugLockedEquipEnabled(): boolean {
    if (!import.meta.env.DEV) {
      return false;
    }
    return this.debugCheatsEnabled || this.resolveDebugFlag(DEBUG_LOCKED_EQUIP_QUERY);
  }

  private installDebugApi(): void {
    if (!this.debugCheatsEnabled) {
      this.removeDebugApi();
      return;
    }
    const api: BlodexDebugApi = {
      addObols: (amount = 30) => this.debugAddObols(amount),
      grantConsumables: (charges = 2) => this.debugGrantConsumables(charges),
      spawnEvent: (eventId) => this.debugSpawnEvent(eventId),
      openMerchant: () => this.debugOpenMerchant(),
      clearFloor: () => this.debugForceClearFloor(),
      jumpFloor: (floor) => this.debugJumpToFloor(floor),
      setHealth: (value) => this.debugSetHealth(value),
      killPlayer: () => this.debugForceDeath(),
      newRun: () => this.resetRun(),
      forceChallenge: () => this.debugForceChallengeRoom(),
      startChallenge: () => this.debugStartChallenge(),
      settleChallenge: (success = true) => this.debugSettleChallenge(success),
      openBossVictory: () => this.debugOpenBossVictoryChoice(),
      enterAbyss: () => this.debugEnterAbyss(),
      nextFloor: () => this.debugAdvanceFloor(),
      forceSynergy: (synergyId = "syn_staff_chain_lightning_overload") =>
        this.debugForceSynergy(synergyId),
      diagnostics: () => this.debugDumpDiagnostics(),
      stressRuns: (iterations = 12) => this.debugStressRuns(iterations),
      help: () => DEBUG_COMMANDS.map((entry) => `${entry.combo}: ${entry.description}`)
    };
    this.debugApiBinder.install(api);
  }

  private removeDebugApi(): void {
    this.debugApiBinder.remove();
  }

  private debugLog(message: string, level: "info" | "warn" | "success" | "danger" = "info"): void {
    this.runLog.debug(message, level, this.time.now);
  }

  private debugDumpDiagnostics(): Record<string, unknown> {
    const snapshot = this.collectDiagnosticsSnapshot();
    console.info("[Blodex] diagnostics snapshot", snapshot);
    const entity = this.entityManager.getDiagnostics();
    this.debugLog(
      `Diag listeners=${this.eventBus.listenerCount()} monsters=${entity.monsters}/${entity.livingMonsters} loot=${entity.loot}`,
      "info"
    );
    return snapshot;
  }

  private debugStressRuns(iterations: number): Record<string, unknown> {
    const count = Math.max(1, Math.min(50, Math.floor(iterations)));
    const before = this.collectDiagnosticsSnapshot();
    for (let i = 0; i < count; i += 1) {
      this.bootstrapRun(`stress-${this.time.now}-${i}`, this.selectedDifficulty);
    }
    this.hudDirty = true;
    const after = this.collectDiagnosticsSnapshot();
    const summary = {
      iterations: count,
      before,
      after
    };
    console.info("[Blodex] lifecycle stress summary", summary);
    this.debugLog(`Lifecycle stress finished (${count} resets).`, "success");
    return summary;
  }

  private showDebugHelp(): void {
    for (const command of DEBUG_COMMANDS) {
      this.debugLog(`${command.combo}: ${command.description}`);
    }
  }

  private handleDebugHotkeys(event: KeyboardEvent): void {
    if (!this.debugCheatsEnabled || !event.altKey) {
      return;
    }

    let handled = true;
    switch (event.code) {
      case "KeyH":
        this.showDebugHelp();
        break;
      case "KeyL":
        this.debugDumpDiagnostics();
        break;
      case "KeyJ":
        this.debugStressRuns(12);
        break;
      case "KeyO":
        this.debugAddObols(30);
        break;
      case "KeyC":
        this.debugGrantConsumables(2);
        break;
      case "KeyE":
        this.debugSpawnEvent();
        break;
      case "KeyM":
        this.debugOpenMerchant();
        break;
      case "KeyK":
        this.debugForceClearFloor();
        break;
      case "KeyX":
        this.debugForceDeath();
        break;
      case "KeyN":
        this.resetRun();
        break;
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
        this.debugJumpToFloor(Number.parseInt(event.code.slice(-1), 10));
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
  }

  private debugAddObols(amount: number): void {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    const normalized = Math.max(1, Math.floor(amount));
    this.run = addRunObols(this.run, normalized);
    this.hudDirty = true;
    this.debugLog(`Added ${normalized} Obol. Current: ${this.run.runEconomy.obols}.`, "success");
  }

  private debugGrantConsumables(charges: number): void {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    const normalized = Math.max(1, Math.floor(charges));
    for (const def of CONSUMABLE_DEFS) {
      this.consumables = grantConsumable(this.consumables, def.id, normalized);
    }
    this.hudDirty = true;
    this.debugLog(`Granted ${normalized} charges to all consumables.`, "success");
  }

  private isWalkableGridPoint(point: { x: number; y: number }): boolean {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x < 0 || y < 0 || x >= this.dungeon.width || y >= this.dungeon.height) {
      return false;
    }
    return this.dungeon.walkable[y]?.[x] === true;
  }

  private resolveDebugEventPosition(): { x: number; y: number } | null {
    const offsets = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 }
    ];
    for (const offset of offsets) {
      const candidate = {
        x: Math.round(this.player.position.x + offset.x),
        y: Math.round(this.player.position.y + offset.y)
      };
      if (this.isWalkableGridPoint(candidate)) {
        return candidate;
      }
    }
    return this.pickFloorEventPosition();
  }

  private pickDebugEvent(eventId?: string): RandomEventDef | null {
    if (eventId !== undefined) {
      return RANDOM_EVENT_DEFS.find((entry) => entry.id === eventId) ?? null;
    }
    const eligible = RANDOM_EVENT_DEFS.filter((entry) => {
      const floorOk =
        this.run.currentFloor >= entry.floorRange.min && this.run.currentFloor <= entry.floorRange.max;
      const biomeOk = entry.biomeIds === undefined || entry.biomeIds.includes(this.currentBiome.id);
      return floorOk && biomeOk;
    });
    if (eligible.length === 0) {
      return null;
    }
    const sorted = [...eligible].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[0] ?? null;
  }

  private debugSpawnEvent(eventId?: string): void {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    if (this.floorConfig.isBossFloor) {
      this.debugLog("Cannot spawn floor event on boss floor.", "warn");
      return;
    }

    const eventDef = this.pickDebugEvent(eventId);
    if (eventDef === null) {
      this.debugLog("No matching event definition found for this floor/biome.", "warn");
      return;
    }
    const position = this.resolveDebugEventPosition();
    if (position === null) {
      this.debugLog("No valid position to place debug event.", "warn");
      return;
    }

    this.consumeCurrentEvent();
    this.createEventNode(eventDef, position, this.time.now);
    this.openEventPanel(this.time.now);
    this.hudDirty = true;
    this.debugLog(`Spawned event ${eventDef.id}.`);
  }

  private debugOpenMerchant(): void {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    if (this.floorConfig.isBossFloor) {
      this.debugLog("Merchant is unavailable on boss floor.", "warn");
      return;
    }
    const merchantEvent = RANDOM_EVENT_DEFS.find((entry) => entry.id === "wandering_merchant");
    if (merchantEvent === undefined) {
      this.debugLog("wandering_merchant event definition not found.", "warn");
      return;
    }
    const position = this.resolveDebugEventPosition();
    if (position === null) {
      this.debugLog("No valid position to open merchant.", "warn");
      return;
    }

    this.consumeCurrentEvent();
    this.createEventNode(merchantEvent, position, this.time.now);
    this.openMerchantPanel(this.time.now);
    this.hudDirty = true;
    this.debugLog("Opened wandering merchant panel.");
  }

  private debugForceChallengeRoom(): boolean {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (this.floorConfig.isBossFloor) {
      this.debugLog("Challenge room is unavailable on boss floor.", "warn");
      return false;
    }
    if (this.eventPanelOpen) {
      this.consumeCurrentEvent();
    }

    let challengeRoom = this.dungeon.rooms.find((room) => room.roomType === "challenge");
    if (challengeRoom === undefined) {
      const picked = chooseChallengeRoom(this.dungeon, this.eventRng);
      if (picked === null) {
        this.debugLog("No room available for challenge injection.", "warn");
        return false;
      }
      this.dungeon = markRoomAsChallenge(this.dungeon, picked.id);
      challengeRoom = this.dungeon.rooms.find((room) => room.id === picked.id);
    }
    if (challengeRoom === undefined) {
      this.debugLog("Challenge room injection failed.", "warn");
      return false;
    }

    this.removeChallengeMonsters();
    this.clearChallengeState();
    this.challengeRoomState = createChallengeRoomState(challengeRoom.id);
    this.challengeWaveTotal = this.resolveChallengeWaveTotal(challengeRoom.id);
    const center = this.challengeRoomCenter(challengeRoom.id);
    if (center !== null) {
      this.challengeMarker = this.renderSystem.spawnTelegraphCircle(center, 0.95, this.origin);
      this.challengeMarker.setAlpha(0.2);
      if (this.challengeMarker instanceof Phaser.GameObjects.Image) {
        this.challengeMarker.setTint(0x9c6ac4);
      }
    }
    this.hudDirty = true;
    this.scheduleRunSave();
    this.debugLog(`Challenge room ready (${this.challengeWaveTotal} waves).`, "success");
    return true;
  }

  private debugStartChallenge(): boolean {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (this.challengeRoomState === null && !this.debugForceChallengeRoom()) {
      return false;
    }
    if (this.challengeRoomState === null) {
      return false;
    }
    if (this.challengeRoomState.finished) {
      this.debugLog("Challenge already finished on this floor.", "warn");
      return false;
    }
    if (!this.challengeRoomState.started) {
      this.startChallengeEncounter(this.time.now);
      this.debugLog("Challenge encounter started.", "success");
    } else {
      this.debugLog("Challenge encounter already active.", "info");
    }
    return true;
  }

  private debugSettleChallenge(success: boolean): boolean {
    if (!this.debugStartChallenge() || this.challengeRoomState === null) {
      return false;
    }
    if (this.challengeRoomState.finished) {
      this.debugLog("Challenge already settled.", "warn");
      return false;
    }
    this.finishChallengeEncounter(success, this.time.now);
    this.debugLog(`Challenge forced to ${success ? "success" : "failure"}.`, success ? "success" : "warn");
    return true;
  }

  private debugOpenBossVictoryChoice(): boolean {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (!this.floorConfig.isBossFloor) {
      this.debugLog("Boss victory choice is only available on boss floor.", "warn");
      return false;
    }
    if (this.bossState !== null && this.bossState.health > 0) {
      this.bossState = {
        ...this.bossState,
        health: 0
      };
    }
    this.openBossVictoryChoice(this.time.now);
    this.hudDirty = true;
    this.debugLog("Boss victory choice opened.", "success");
    return true;
  }

  private debugEnterAbyss(): boolean {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (this.run.runMode === "daily") {
      this.debugLog("Daily mode cannot enter abyss.", "warn");
      return false;
    }
    if (this.run.inEndless) {
      this.debugLog("Already in abyss/endless.", "info");
      return true;
    }
    if (this.run.currentFloor < 5) {
      this.debugLog("Abyss entry requires reaching floor 5.", "warn");
      return false;
    }
    if (this.floorConfig.isBossFloor && this.bossState !== null && this.bossState.health > 0) {
      this.bossState = {
        ...this.bossState,
        health: 0
      };
    }
    this.enterAbyss(this.time.now);
    this.debugLog(`Forced abyss entry at floor ${this.run.currentFloor}.`, "success");
    return true;
  }

  private debugAdvanceFloor(): boolean {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (this.floorConfig.isBossFloor && !this.run.inEndless) {
      return this.debugOpenBossVictoryChoice();
    }
    const fromFloor = this.run.currentFloor;
    this.run = appendReplayInput(this.run, {
      type: "floor_transition",
      atMs: this.getRunRelativeNowMs(),
      fromFloor,
      toFloor: fromFloor + 1
    });
    this.run = enterNextFloor(this.run);
    if (this.run.inEndless) {
      this.run = advanceEndlessFloor(this.run);
      this.run = addRunObols(this.run, endlessFloorClearBonus(this.run.currentFloor));
    } else {
      this.run = addRunObols(this.run, 5);
    }
    this.setupFloor(this.run.currentFloor, false);
    this.flushRunSave();
    this.debugLog(
      `Advanced to floor ${this.run.currentFloor}${this.run.inEndless ? ` (endless ${this.run.endlessFloor})` : ""}.`,
      "success"
    );
    return true;
  }

  private debugForceSynergy(synergyId: string): string[] {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return [];
    }
    if (synergyId !== "syn_staff_chain_lightning_overload") {
      this.debugLog(`Unsupported synergy preset: ${synergyId}.`, "warn");
      return [...this.synergyRuntime.activeSynergyIds];
    }

    const nowMs = this.time.now;
    const existingSkills = this.player.skills;
    if (existingSkills === undefined) {
      this.debugLog("Player skills are unavailable; cannot inject synergy preset.", "warn");
      return [...this.synergyRuntime.activeSynergyIds];
    }
    const slots = [...existingSkills.skillSlots];
    slots[0] = { defId: "chain_lightning", level: 1 };
    const staffItem: ItemInstance = {
      id: `debug_synergy_staff_${Math.floor(nowMs)}`,
      defId: "sovereign_requiem",
      name: "Debug Sovereign Requiem",
      kind: "unique",
      slot: "weapon",
      weaponType: "staff",
      rarity: "rare",
      requiredLevel: 1,
      iconId: "item_weapon_03",
      seed: `debug-synergy-${this.runSeed}`,
      rolledAffixes: {
        attackPower: 22,
        critChance: 4,
        attackSpeed: 4
      },
      rolledSpecialAffixes: {
        lifesteal: 6,
        critDamage: 22
      }
    };
    this.player = this.refreshPlayerStatsFromEquipment({
      ...this.player,
      equipment: {
        ...this.player.equipment,
        weapon: staffItem
      },
      skills: {
        ...existingSkills,
        skillSlots: slots,
        cooldowns: {
          ...existingSkills.cooldowns,
          chain_lightning: 0
        }
      }
    });
    this.refreshSynergyRuntime();
    this.hudDirty = true;
    this.scheduleRunSave();
    const activeSynergyIds = [...this.synergyRuntime.activeSynergyIds];
    this.debugLog(`Forced synergy preset ${synergyId}. Active: ${activeSynergyIds.join(", ") || "none"}.`, "success");
    return activeSynergyIds;
  }

  private debugForceClearFloor(): void {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    const nowMs = this.time.now;

    if (this.floorConfig.isBossFloor) {
      if (this.bossState === null) {
        this.debugLog("Boss runtime not ready.", "warn");
        return;
      }
      this.bossState = {
        ...this.bossState,
        health: 0
      };
      this.hudDirty = true;
      this.debugLog("Boss health set to 0. Triggering victory summary.", "success");
      this.finishRun(true);
      return;
    }

    let removed = 0;
    let simulatedDrops = 0;
    let simulatedLevelUps = 0;
    while (true) {
      const living = [...this.entityManager.listLivingMonsters()];
      if (living.length === 0) {
        break;
      }
      let removedThisPass = 0;
      for (const monster of living) {
        const dead = this.entityManager.removeMonsterById(monster.state.id);
        if (dead === null) {
          continue;
        }
        this.onMonsterDefeated(dead.state, nowMs);
        const xpResult = applyXpGain(this.player, dead.state.xpValue, "strength");
        this.player = this.refreshPlayerStatsFromEquipment(xpResult.player);
        if (xpResult.leveledUp) {
          simulatedLevelUps += 1;
          this.eventBus.emit("player:levelup", {
            playerId: this.player.id,
            level: this.player.level,
            timestampMs: nowMs
          });
          this.refreshSynergyRuntime(false);
          this.offerLevelupSkill();
        }
        const lootTable = LOOT_TABLE_MAP[dead.state.dropTableId];
        if (lootTable !== undefined) {
          const droppedItem = rollItemDrop(
            lootTable,
            ITEM_DEF_MAP,
            this.run.currentFloor,
            this.lootRng,
            `debug-clear-${this.run.currentFloor}-${dead.state.id}-${Math.floor(nowMs)}`,
            {
              isItemEligible: (itemDef) => this.isItemDefUnlocked(itemDef)
            }
          );
          if (droppedItem !== null) {
            simulatedDrops += 1;
            this.spawnLootDrop(droppedItem, dead.state.position);
            this.eventBus.emit("loot:drop", {
              sourceId: dead.state.id,
              item: droppedItem,
              position: dead.state.position,
              timestampMs: nowMs
            });
          }
        }
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();
        dead.affixMarker?.destroy();
        removed += 1;
        removedThisPass += 1;
      }
      if (removedThisPass === 0) {
        break;
      }
    }

    const revealThreshold = Math.ceil(this.floorConfig.monsterCount * this.floorConfig.clearThreshold);
    const nextKills = Math.max(this.run.kills + removed, revealThreshold);
    this.run = addRunObols(
      {
        ...this.run,
        kills: nextKills,
        totalKills: this.run.totalKills + removed,
        endlessKills: (this.run.endlessKills ?? 0) + (this.run.inEndless ? removed : 0)
      },
      removed
    );

    if (!this.staircaseState.visible) {
      this.staircaseState = {
        ...this.staircaseState,
        visible: true
      };
      this.renderStaircases();
      this.eventBus.emit("floor:clear", {
        floor: this.run.currentFloor,
        kills: this.run.kills,
        staircase: this.staircaseState,
        timestampMs: nowMs
      });
      this.tryDiscoverBlueprints("floor_clear", nowMs);
    }

    this.hudDirty = true;
    this.debugLog(
      `Cleared floor instantly (${removed} monsters removed, ${simulatedDrops} drops, +${simulatedLevelUps} levels).`,
      "success"
    );
  }

  private debugJumpToFloor(targetFloor: number): void {
    const maxFloors = GAME_CONFIG.maxFloors ?? 5;
    const normalized = Math.max(1, Math.min(maxFloors, Math.floor(targetFloor)));
    if (!Number.isFinite(normalized)) {
      this.debugLog(`Invalid floor index: ${targetFloor}`, "warn");
      return;
    }

    if (this.runEnded) {
      this.uiManager.clearSummary();
      this.uiManager.hideDeathOverlay();
      this.runEnded = false;
    }
    if (this.run.currentFloor === normalized) {
      this.debugLog(`Already on floor ${normalized}.`);
      return;
    }

    this.run = appendReplayInput(this.run, {
      type: "floor_transition",
      atMs: this.getRunRelativeNowMs(),
      fromFloor: this.run.currentFloor,
      toFloor: normalized
    });
    this.run = {
      ...this.run,
      currentFloor: normalized,
      floor: normalized
    };
    this.setupFloor(normalized, false);
    this.hudDirty = true;
    this.debugLog(`Jumped to floor ${normalized}.`, "success");
  }

  private debugForceDeath(): void {
    if (this.runEnded) {
      this.debugLog("Run already ended.", "warn");
      return;
    }
    this.lastDeathReason = "Debug cheat forced death to validate death feedback pipeline.";
    this.player = {
      ...this.player,
      health: 0
    };
    this.hudDirty = true;
    this.debugLog("Forced player death.", "danger");
    this.finishRun(false);
  }

  private debugSetHealth(value: number): number {
    if (this.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return this.player.health;
    }
    const normalized = Math.max(0, Math.min(this.player.derivedStats.maxHealth, Math.floor(value)));
    this.player = {
      ...this.player,
      health: normalized
    };
    this.hudDirty = true;
    this.debugLog(`Set HP to ${normalized}/${Math.floor(this.player.derivedStats.maxHealth)}.`, "info");
    return normalized;
  }

  private injectDebugLockedEquipment(player: PlayerState, nowMs: number): PlayerState {
    const existing = player.inventory.find((item) => item.defId === "debug_locked_ring");
    if (existing !== undefined) {
      return player;
    }

    const requiredLevel = Math.max(player.level + 2, 3);
    const debugItem: ItemInstance = {
      id: `debug_locked_ring_${Math.floor(nowMs)}`,
      defId: "debug_locked_ring",
      name: `Debug Sealed Ring (Lv${requiredLevel})`,
      slot: "ring",
      kind: "equipment",
      rarity: "rare",
      requiredLevel,
      iconId: DEBUG_LOCKED_EQUIP_ICON_ID,
      seed: `debug-${this.runSeed}`,
      rolledAffixes: {
        attackPower: 4,
        armor: 2
      }
    };

    this.runLog.append(
      `[Debug] Added locked item: ${debugItem.name}. Click E to verify level gate feedback.`,
      "info",
      nowMs
    );

    return {
      ...player,
      inventory: [...player.inventory, debugItem]
    };
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
    const baseCritChance = weaponType === "dagger" ? 4 : weaponType === "staff" ? 1 : 2;
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
    this.runLog.append(
      `Daily loadout active: ${dailyWeapon.name}.`,
      "info",
      nowMs
    );
    return this.refreshPlayerStatsFromEquipment(nextPlayer);
  }

  private bootstrapRun(runSeed: string, difficulty: DifficultyMode): void {
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
      this.runLog.append(
        this.dailyPracticeMode
          ? "Daily scored attempt already consumed today. Switched to Practice mode."
          : "Daily scored attempt unlocked.",
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
    this.nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
    this.lastAiNearCount = 0;
    this.lastAiFarCount = 0;
    this.uiManager.clearLogs();
    this.uiManager.hideDeathOverlay();
    this.uiManager.hideEventPanel();
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
    this.merchantOffers = [];
    this.destroyEventNode();
    const run = createRunState(runSeed, this.time.now, this.selectedDifficulty);
    this.run =
      selectedRunMode === "daily"
        ? {
            ...run,
            runMode: "daily",
            ...(resolvedDailyDate === undefined ? {} : { dailyDate: resolvedDailyDate })
          }
        : run;
    this.setupFloor(1, true);

    this.eventBus.emit("run:start", {
      runSeed: this.runSeed,
      floor: this.run.currentFloor,
      difficulty: this.run.difficulty,
      startedAtMs: this.run.startedAtMs,
      replayVersion: this.run.replay?.version ?? "unknown"
    });
    if (this.debugCheatsEnabled) {
      this.debugLog("Cheats enabled (?debugCheats=1). Press Alt+H for command list.");
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

  private refreshSynergyRuntime(persistDiscovery = true): void {
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
      const label = blueprint?.name ?? blueprintId;
      this.runLog.append(`Blueprint discovered (${sourceLabel}): ${label}.`, "success", nowMs);
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

  private setupFloor(floor: number, initial: boolean): void {
    this.children.removeAll(true);
    this.entityManager.clear();
    this.clearHazards();
    this.clearHiddenRoomMarkers();
    this.clearChallengeState();
    this.movementSystem.clearPathCache();

    this.floorConfig = getFloorConfig(floor, this.run.difficultyModifier);
    this.configureRngStreams(floor);
    const rolledBiomeId = resolveBiomeForFloorBySeed(floor, this.runSeed, this.run.branchChoice);
    const biomeId = this.unlockedBiomeIds.has(rolledBiomeId) ? rolledBiomeId : "forgotten_catacombs";
    this.currentBiome = BIOME_MAP[biomeId] ?? BIOME_MAP.forgotten_catacombs;
    this.mapRevealActive = false;
    this.eventPanelOpen = false;
    this.merchantOffers = [];
    this.uiManager.hideEventPanel();
    this.destroyEventNode();

    this.dungeon = this.floorConfig.isBossFloor
      ? this.renderBossFloor(floor)
      : this.renderNormalFloor(floor);

    this.player = initial ? this.makeInitialPlayer() : this.reusePlayerForNewFloor(this.player);
    this.player = {
      ...this.player,
      position: { ...this.dungeon.playerSpawn }
    };
    if (initial && this.run.runMode === "daily") {
      this.player = this.applyDailyLoadout(this.player, this.time.now);
    }
    if (initial && this.isDebugLockedEquipEnabled()) {
      this.player = this.injectDebugLockedEquipment(this.player, this.time.now);
    }
    this.entityLabelById.set(this.player.id, "Vanguard");

    this.path = [];
    this.attackTargetId = null;
    this.manualMoveTarget = null;
    this.manualMoveTargetFailures = 0;
    this.nextManualPathReplanAt = 0;
    this.nextPlayerAttackAt = 0;
    this.nextBossAttackAt = 0;
    this.bossState = null;
    this.bossSprite = null;
    this.staircaseState = createStaircaseState(this.dungeon, this.dungeon.playerSpawn, floor);

    const world = this.renderSystem.computeWorldBounds(this.dungeon);
    this.origin = world.origin;
    this.worldBounds = world.worldBounds;
    this.cameras.main.setBackgroundColor(
      Phaser.Display.Color.IntegerToColor(this.currentBiome.ambientColor).rgba
    );
    this.renderSystem.drawDungeon(
      this.dungeon,
      this.origin,
      this.resolveBiomeTileTint(this.currentBiome.id)
    );
    this.renderHiddenRoomMarkers();

    const playerRender = this.renderSystem.spawnPlayer(this.player.position, this.origin);
    this.playerSprite = playerRender.sprite;
    this.playerYOffset = playerRender.yOffset;
    this.initializeHazards(this.time.now);

    if (this.floorConfig.isBossFloor) {
      this.spawnBoss();
    } else {
      this.spawnMonsters();
      this.setupFloorEvent(this.time.now);
      this.initializeChallengeRoom(this.time.now);
    }

    this.renderSystem.configureCamera(this.cameras.main, this.worldBounds, this.playerSprite);

    this.run = {
      ...this.run,
      currentFloor: floor,
      currentBiomeId: this.currentBiome.id,
      floor,
      kills: 0
    };
    this.uiManager.configureMinimap({
      width: this.dungeon.width,
      height: this.dungeon.height,
      walkable: this.dungeon.walkable,
      layoutHash: this.dungeon.layoutHash
    });
    this.uiManager.resetMinimap();
    this.lastMinimapRefreshAt = 0;
    this.updateMinimap(this.time.now);
    this.refreshSynergyRuntime();

    this.hudDirty = true;
    this.runEnded = false;

    if (!initial) {
      playSceneTransition({
        title: `Floor ${floor}`,
        subtitle: this.currentBiome.name,
        mode: "floor",
        durationMs: 420
      });
    }

    if (!initial) {
      this.eventBus.emit("floor:enter", {
        floor,
        biomeId: this.currentBiome.id,
        timestampMs: this.time.now
      });
    }
  }

  private renderNormalFloor(floor: number) {
    return generateDungeon({
      width: 46,
      height: 46,
      minRoomSize: 4,
      maxRoomSize: 9,
      floorNumber: floor,
      seed: deriveFloorSeed(this.runSeed, floor, "procgen")
    });
  }

  private renderBossFloor(floor: number) {
    return generateBossRoom(deriveFloorSeed(this.runSeed, floor, "procgen"), 46, 46);
  }

  private clearHiddenRoomMarkers(): void {
    for (const marker of this.hiddenEntranceMarkers.values()) {
      marker.destroy();
    }
    this.hiddenEntranceMarkers.clear();
  }

  private renderHiddenRoomMarkers(): void {
    this.clearHiddenRoomMarkers();
    for (const hiddenRoom of this.dungeon.hiddenRooms ?? []) {
      if (hiddenRoom.revealed) {
        continue;
      }
      const iso = gridToIso(
        hiddenRoom.entrance.x,
        hiddenRoom.entrance.y,
        this.tileWidth,
        this.tileHeight,
        this.origin.x,
        this.origin.y
      );
      const marker = this.add
        .ellipse(iso.x, iso.y - 4, 18, 10, 0xd1b06e, 0.32)
        .setStrokeStyle(1, 0x614420, 0.9)
        .setDepth(iso.y + DungeonScene.ENTITY_DEPTH_OFFSET - 6);
      this.hiddenEntranceMarkers.set(hiddenRoom.roomId, marker);
    }
  }

  private revealHiddenRoom(roomId: string, nowMs: number, source: "click" | "mutation"): boolean {
    const hiddenRooms = this.dungeon.hiddenRooms ?? [];
    const target = hiddenRooms.find((entry) => entry.roomId === roomId);
    if (target === undefined || target.revealed) {
      return false;
    }

    target.revealed = true;
    const row = this.dungeon.walkable[target.entrance.y];
    if (row !== undefined) {
      row[target.entrance.x] = true;
    }
    this.movementSystem.clearPathCache();
    this.path = [];
    this.manualMoveTarget = null;
    this.manualMoveTargetFailures = 0;

    this.hiddenEntranceMarkers.get(roomId)?.destroy();
    this.hiddenEntranceMarkers.delete(roomId);
    this.uiManager.configureMinimap({
      width: this.dungeon.width,
      height: this.dungeon.height,
      walkable: this.dungeon.walkable,
      layoutHash: this.dungeon.layoutHash
    });

    this.runLog.append(
      source === "click"
        ? "Cracked wall opened. Hidden room revealed."
        : "Mutation pulse revealed a hidden entrance.",
      "success",
      nowMs
    );

    if (!target.rewardsClaimed) {
      const rewardTable = this.run.currentFloor >= 3 ? LOOT_TABLE_MAP.cathedral_depths : LOOT_TABLE_MAP.starter_floor;
      if (rewardTable !== undefined) {
        const reward = rollItemDrop(
          rewardTable,
          ITEM_DEF_MAP,
          this.run.currentFloor,
          this.lootRng,
          `hidden-room-${roomId}-${Math.floor(nowMs)}`,
          {
            isItemEligible: (itemDef) => this.isItemDefUnlocked(itemDef)
          }
        );
        if (reward !== null) {
          this.spawnLootDrop(reward, target.entrance);
        }
      }
      target.rewardsClaimed = true;
      this.tryDiscoverBlueprints("hidden_room", nowMs, roomId);
    }

    this.scheduleRunSave();
    return true;
  }

  private revealNearbyHiddenRoomsByMutation(nowMs: number): void {
    const radius = this.resolveHiddenRoomRevealRadius();
    if (radius <= 0) {
      return;
    }
    for (const hiddenRoom of this.dungeon.hiddenRooms ?? []) {
      if (hiddenRoom.revealed) {
        continue;
      }
      if (Math.hypot(this.player.position.x - hiddenRoom.entrance.x, this.player.position.y - hiddenRoom.entrance.y) > radius) {
        continue;
      }
      this.revealHiddenRoom(hiddenRoom.roomId, nowMs, "mutation");
    }
  }

  private clearChallengeState(): void {
    this.challengeMarker?.destroy();
    this.challengeMarker = null;
    this.challengeRoomState = null;
    this.challengeWaveTotal = 0;
    this.challengeMonsterIds.clear();
  }

  private resolveChallengeWaveTotal(roomId: string): number {
    const seed = `${this.runSeed}:${this.run.currentFloor}:${roomId}`;
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 2 === 0 ? 2 : 3;
  }

  private inferChallengeWaveFromMonsterId(monsterId: string): number | null {
    const match = /^challenge-(\d+)-(\d+)-/.exec(monsterId);
    if (match === null) {
      return null;
    }
    const floor = Number.parseInt(match[1] ?? "", 10);
    const wave = Number.parseInt(match[2] ?? "", 10);
    if (!Number.isFinite(floor) || !Number.isFinite(wave) || floor !== this.run.currentFloor || wave < 1) {
      return null;
    }
    return wave;
  }

  private removeChallengeMonsters(): void {
    if (this.challengeMonsterIds.size === 0) {
      return;
    }
    const trackedIds = [...this.challengeMonsterIds];
    for (const monsterId of trackedIds) {
      const dead = this.entityManager.removeMonsterById(monsterId);
      if (dead === null) {
        continue;
      }
      dead.sprite.destroy();
      dead.healthBarBg.destroy();
      dead.healthBarFg.destroy();
      dead.affixMarker?.destroy();
    }
  }

  private findChallengeRoomById(roomId: string) {
    return this.dungeon.rooms.find((room) => room.id === roomId);
  }

  private challengeRoomCenter(roomId: string): { x: number; y: number } | null {
    const room = this.findChallengeRoomById(roomId);
    if (room === undefined) {
      return null;
    }
    return {
      x: Math.floor(room.x + room.width / 2),
      y: Math.floor(room.y + room.height / 2)
    };
  }

  private initializeChallengeRoom(nowMs: number): void {
    if (this.floorConfig.isBossFloor || this.run.currentFloor < 2) {
      return;
    }
    const existing = this.dungeon.rooms.find((room) => room.roomType === "challenge");
    let selected = existing;
    if (selected === undefined && shouldSpawnChallengeRoom(this.run.currentFloor, this.eventRng)) {
      const chosen = chooseChallengeRoom(this.dungeon, this.eventRng);
      if (chosen !== null) {
        this.dungeon = markRoomAsChallenge(this.dungeon, chosen.id);
        selected = this.dungeon.rooms.find((room) => room.id === chosen.id);
      }
    }
    if (selected === undefined) {
      return;
    }
    this.challengeRoomState = createChallengeRoomState(selected.id);
    this.challengeWaveTotal = this.resolveChallengeWaveTotal(selected.id);
    const center = this.challengeRoomCenter(selected.id);
    if (center === null) {
      return;
    }
    this.challengeMarker = this.renderSystem.spawnTelegraphCircle(center, 0.95, this.origin);
    this.challengeMarker.setAlpha(0.2);
    if (this.challengeMarker instanceof Phaser.GameObjects.Image) {
      this.challengeMarker.setTint(0x9c6ac4);
    }
    this.runLog.append(`Challenge room discovered (Waves: ${this.challengeWaveTotal}).`, "info", nowMs);
  }

  private openChallengeRoomPanel(nowMs: number): void {
    if (
      this.challengeRoomState === null ||
      this.challengeRoomState.started ||
      this.challengeRoomState.finished ||
      this.eventPanelOpen
    ) {
      return;
    }
    const eventDef: RandomEventDef = {
      id: `challenge_${this.challengeRoomState.roomId}`,
      name: "Challenge Room",
      description: "Seal the room and survive timed waves for bonus rewards.",
      floorRange: { min: this.run.currentFloor, max: this.run.currentFloor },
      spawnWeight: 1,
      choices: [
        {
          id: "enter",
          name: "Enter Challenge",
          description: "Begin timed waves immediately.",
          rewards: []
        },
        {
          id: "skip",
          name: "Leave",
          description: "Keep exploring this floor.",
          rewards: []
        }
      ]
    };
    const choices = eventDef.choices.map((choice) => ({
      choice,
      enabled: true as const
    }));
    this.eventPanelOpen = true;
    this.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId) => {
        this.consumeCurrentEvent();
        if (choiceId === "enter") {
          this.startChallengeEncounter(this.time.now);
        }
      },
      () => this.consumeCurrentEvent()
    );
    this.runLog.append("Challenge room ready. Confirm entry to start.", "warn", nowMs);
  }

  private spawnChallengeWave(nowMs: number): void {
    if (this.challengeRoomState === null || !this.challengeRoomState.started || this.challengeRoomState.finished) {
      return;
    }
    const room = this.findChallengeRoomById(this.challengeRoomState.roomId);
    if (room === undefined) {
      this.finishChallengeEncounter(false, nowMs);
      return;
    }
    const walkableTiles: Array<{ x: number; y: number }> = [];
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        if (!this.dungeon.walkable[y]?.[x]) {
          continue;
        }
        walkableTiles.push({ x, y });
      }
    }
    if (walkableTiles.length === 0) {
      this.finishChallengeEncounter(false, nowMs);
      return;
    }

    const waveNumber = this.challengeRoomState.waveIndex + 1;
    const spawnCount = Math.max(2, 1 + waveNumber);
    const archetypeById = new Map(MONSTER_ARCHETYPES.map((entry) => [entry.id, entry]));
    const pooled = this.currentBiome.monsterPool
      .map((id) => archetypeById.get(id))
      .filter((entry): entry is (typeof MONSTER_ARCHETYPES)[number] => entry !== undefined);
    const spawnPool = pooled.length > 0 ? pooled : MONSTER_ARCHETYPES;
    const endlessAffixBonus = this.run.inEndless ? resolveEndlessAffixBonusCount(this.run.currentFloor) : 0;
    const monsters = this.entityManager.listMonsters();
    for (let idx = 0; idx < spawnCount; idx += 1) {
      const tile = this.spawnRng.pick(walkableTiles);
      const archetype = this.spawnRng.pick(spawnPool);
      const baseAffixes = rollMonsterAffixes({
        floor: this.run.currentFloor,
        isBoss: false,
        ...(this.run.difficultyModifier.affixPolicy === undefined
          ? {}
          : { policy: this.run.difficultyModifier.affixPolicy }),
        availableAffixes: this.unlockedAffixIds,
        rng: this.spawnRng
      });
      const affixes = [...baseAffixes];
      if (endlessAffixBonus > 0) {
        const pool = [...this.unlockedAffixIds].filter((affixId) => !affixes.includes(affixId));
        while (pool.length > 0 && affixes.length < baseAffixes.length + endlessAffixBonus) {
          const pickedIndex = this.spawnRng.nextInt(0, pool.length - 1);
          const [pickedAffix] = pool.splice(pickedIndex, 1);
          if (pickedAffix !== undefined) {
            affixes.push(pickedAffix);
          }
        }
      }
      const state = applyAffixesToMonsterState({
        id: `challenge-${this.run.currentFloor}-${waveNumber}-${idx}-${Math.floor(nowMs)}`,
        archetypeId: archetype.id,
        level: this.run.currentFloor,
        health: Math.floor(GAME_CONFIG.enemyBaseHealth * archetype.healthMultiplier * this.floorConfig.monsterHpMultiplier),
        maxHealth: Math.floor(
          GAME_CONFIG.enemyBaseHealth * archetype.healthMultiplier * this.floorConfig.monsterHpMultiplier
        ),
        damage: Math.floor(GAME_CONFIG.enemyBaseDamage * archetype.damageMultiplier * this.floorConfig.monsterDmgMultiplier),
        attackRange: archetype.attackRange,
        moveSpeed: archetype.moveSpeed,
        xpValue: archetype.xpValue,
        dropTableId: archetype.dropTableId,
        position: { x: tile.x, y: tile.y },
        aiState: archetype.aiConfig.behavior === "ambush" ? "ambush" : "idle",
        aiBehavior: archetype.aiConfig.behavior,
        ...(affixes.length === 0 ? {} : { affixes })
      });
      const runtime = this.renderSystem.spawnMonster(state, archetype, this.origin);
      monsters.push(runtime);
      this.challengeMonsterIds.add(runtime.state.id);
      this.entityLabelById.set(runtime.state.id, `${archetype.name} (Challenge)`);
      for (const affix of runtime.state.affixes ?? []) {
        this.eventBus.emit("monster:affixApplied", {
          monsterId: runtime.state.id,
          affixId: affix,
          timestampMs: nowMs
        });
      }
    }
    this.entityManager.rebuildMonsterSpatialIndex();
    this.runLog.append(`Challenge wave ${waveNumber}/${this.challengeWaveTotal} started.`, "warn", nowMs);
  }

  private startChallengeEncounter(nowMs: number): void {
    if (this.challengeRoomState === null || this.challengeRoomState.started || this.challengeRoomState.finished) {
      return;
    }
    this.challengeRoomState = startChallengeRoom(this.challengeRoomState, nowMs);
    this.challengeMonsterIds.clear();
    this.spawnChallengeWave(nowMs);
    this.scheduleRunSave();
    this.hudDirty = true;
  }

  private finishChallengeEncounter(success: boolean, nowMs: number): void {
    if (this.challengeRoomState === null || this.challengeRoomState.finished) {
      return;
    }
    this.challengeRoomState = success ? { ...this.challengeRoomState, finished: true, success: true } : failChallengeRoom(this.challengeRoomState);
    this.removeChallengeMonsters();
    this.challengeMonsterIds.clear();
    if (success) {
      this.run = addRunObols(
        {
          ...this.run,
          challengeSuccessCount: this.run.challengeSuccessCount + 1
        },
        12
      );
      const rewardTable = LOOT_TABLE_MAP.catacomb_elite ?? LOOT_TABLE_MAP.cathedral_depths;
      const reward =
        rewardTable === undefined
          ? null
          : rollItemDrop(
              rewardTable,
              ITEM_DEF_MAP,
              Math.max(3, this.run.currentFloor),
              this.lootRng,
              `challenge-reward-${this.run.currentFloor}-${Math.floor(nowMs)}`,
              {
                isItemEligible: (itemDef) => this.isItemDefUnlocked(itemDef)
              }
            );
      const center = this.challengeRoomCenter(this.challengeRoomState.roomId);
      if (reward !== null && center !== null) {
        this.spawnLootDrop(reward, center);
      }
      this.tryDiscoverBlueprints("challenge_room", nowMs, this.challengeRoomState.roomId);
      this.runLog.append("Challenge cleared. Rewards granted.", "success", nowMs);
      if (this.challengeMarker instanceof Phaser.GameObjects.Image) {
        this.challengeMarker.setTint(0x5abf8a);
      }
      this.challengeMarker?.setAlpha(0.12);
    } else {
      const hpPenalty = Math.max(1, Math.floor(this.player.derivedStats.maxHealth * 0.2));
      this.player = {
        ...this.player,
        health: Math.max(1, this.player.health - hpPenalty),
        position: { ...this.dungeon.playerSpawn }
      };
      this.path = [];
      this.manualMoveTarget = null;
      this.manualMoveTargetFailures = 0;
      this.runLog.append(`Challenge failed. Lost ${hpPenalty} HP.`, "danger", nowMs);
      if (this.challengeMarker instanceof Phaser.GameObjects.Image) {
        this.challengeMarker.setTint(0xc66767);
      }
      this.challengeMarker?.setAlpha(0.16);
    }
    this.scheduleRunSave();
    this.hudDirty = true;
  }

  private onMonsterDefeated(monsterState: MonsterState, nowMs: number): void {
    if (
      this.challengeRoomState === null ||
      !this.challengeRoomState.started ||
      this.challengeRoomState.finished ||
      !this.challengeMonsterIds.delete(monsterState.id)
    ) {
      return;
    }
    if (this.challengeMonsterIds.size > 0) {
      return;
    }
    const advanced = advanceChallengeRoomWave(this.challengeRoomState, this.challengeWaveTotal);
    if (advanced.finished && advanced.success) {
      this.finishChallengeEncounter(true, nowMs);
      return;
    }
    this.challengeRoomState = advanced;
    this.spawnChallengeWave(nowMs);
  }

  private restoreChallengeRoom(nowMs: number): void {
    if (this.floorConfig.isBossFloor || this.run.currentFloor < 2) {
      return;
    }
    const challengeRoom = this.dungeon.rooms.find((room) => room.roomType === "challenge");
    if (challengeRoom === undefined) {
      return;
    }
    this.challengeRoomState = createChallengeRoomState(challengeRoom.id);
    this.challengeWaveTotal = this.resolveChallengeWaveTotal(challengeRoom.id);
    const center = this.challengeRoomCenter(challengeRoom.id);
    if (center !== null) {
      this.challengeMarker = this.renderSystem.spawnTelegraphCircle(center, 0.95, this.origin);
      this.challengeMarker.setAlpha(0.2);
      if (this.challengeMarker instanceof Phaser.GameObjects.Image) {
        this.challengeMarker.setTint(0x9c6ac4);
      }
    }

    const floorPrefix = `challenge-${this.run.currentFloor}-`;
    const challengeMonsters = this.entityManager
      .listMonsters()
      .filter((monster) => monster.state.id.startsWith(floorPrefix));
    if (challengeMonsters.length === 0) {
      return;
    }

    let maxWave = 1;
    for (const monster of challengeMonsters) {
      this.challengeMonsterIds.add(monster.state.id);
      const inferredWave = this.inferChallengeWaveFromMonsterId(monster.state.id);
      if (inferredWave !== null) {
        maxWave = Math.max(maxWave, inferredWave);
      }
    }

    const startedAtMs = Math.max(0, nowMs - 1_000);
    this.challengeRoomState = {
      ...this.challengeRoomState,
      started: true,
      waveIndex: Math.max(0, maxWave - 1),
      startedAtMs,
      deadlineAtMs: startedAtMs + 30_000
    };
    this.runLog.append("Resumed active challenge encounter.", "info", nowMs);
  }

  private updateChallengeRoom(nowMs: number): void {
    if (this.challengeRoomState === null || this.challengeRoomState.finished) {
      return;
    }
    if (!this.challengeRoomState.started) {
      const center = this.challengeRoomCenter(this.challengeRoomState.roomId);
      if (center === null) {
        return;
      }
      const distance = Math.hypot(this.player.position.x - center.x, this.player.position.y - center.y);
      if (distance <= 1.1) {
        this.openChallengeRoomPanel(nowMs);
      }
      return;
    }
    if (shouldFailChallengeRoomByTimeout(this.challengeRoomState, nowMs)) {
      this.finishChallengeEncounter(false, nowMs);
    }
  }

  private resolveBiomeTileTint(biomeId: BiomeDef["id"]): number | undefined {
    switch (biomeId) {
      case "molten_caverns":
        return 0xf4d2bc;
      case "frozen_halls":
        return 0xcfe2f0;
      case "bone_throne":
        return 0xe4d6d6;
      case "forgotten_catacombs":
      default:
        return undefined;
    }
  }

  private clearHazards(): void {
    for (const visual of this.hazardVisuals) {
      visual.destroy();
    }
    this.hazardVisuals = [];
    this.hazards = [];
    this.playerHazardContact.clear();
  }

  private pickHazardPositions(count: number): Array<{ x: number; y: number }> {
    const candidates = this.dungeon.spawnPoints.filter(
      (point) => Math.hypot(point.x - this.player.position.x, point.y - this.player.position.y) >= 4
    );
    const picked: Array<{ x: number; y: number }> = [];
    const mutable = [...candidates];

    while (picked.length < count && mutable.length > 0) {
      const idx = this.hazardRng.nextInt(0, mutable.length - 1);
      const candidate = mutable.splice(idx, 1)[0];
      if (candidate === undefined) {
        break;
      }
      const tooClose = picked.some((entry) => Math.hypot(entry.x - candidate.x, entry.y - candidate.y) < 3);
      if (!tooClose) {
        picked.push({ ...candidate });
      }
    }

    return picked;
  }

  private initializeHazards(nowMs: number): void {
    if (this.floorConfig.isBossFloor) {
      return;
    }

    const hazardIds = this.currentBiome.hazardPool;
    if (hazardIds.length === 0) {
      return;
    }

    const count = this.run.currentFloor <= 2 ? 1 : this.run.currentFloor <= 4 ? 2 : 3;
    const positions = this.pickHazardPositions(count);
    for (let i = 0; i < positions.length; i += 1) {
      const position = positions[i]!;
      const hazardId = this.hazardRng.pick(hazardIds);
      const def = HAZARD_MAP[hazardId];
      if (def === undefined) {
        continue;
      }
      const runtime = createHazardRuntimeState(
        def,
        `hazard-${this.run.currentFloor}-${i}`,
        position,
        nowMs
      );
      this.hazards.push(runtime);
      this.addHazardVisual(runtime);
    }
  }

  private addHazardVisual(runtime: HazardRuntimeState): void {
    const visual = this.renderSystem.spawnTelegraphCircle(runtime.position, runtime.radiusTiles, this.origin);
    const baseAlpha =
      runtime.type === "damage_zone"
        ? 0.22
        : runtime.type === "movement_modifier"
          ? 0.16
          : 0.12;
    visual.setAlpha(baseAlpha);
    if (visual instanceof Phaser.GameObjects.Image) {
      const tint =
        runtime.type === "damage_zone"
          ? 0xdb694d
          : runtime.type === "movement_modifier"
            ? 0x6aa7cf
            : 0xbfa4d9;
      visual.setTint(tint);
    } else if (visual instanceof Phaser.GameObjects.Ellipse) {
      const fill =
        runtime.type === "damage_zone"
          ? 0xdb694d
          : runtime.type === "movement_modifier"
            ? 0x6aa7cf
            : 0xbfa4d9;
      visual.setFillStyle(fill, baseAlpha);
    }
    this.hazardVisuals.push(visual);
  }

  private destroyEventNode(): void {
    if (this.eventNode !== null) {
      this.eventNode.marker.destroy();
    }
    this.eventNode = null;
    this.merchantOffers = [];
    this.eventPanelOpen = false;
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

  private setupFloorEvent(nowMs: number): void {
    this.destroyEventNode();
    if (this.floorConfig.isBossFloor) {
      return;
    }
    if (this.eventRng.next() > FLOOR_EVENT_SPAWN_CHANCE) {
      return;
    }

    const eventDef = pickRandomEvent(
      RANDOM_EVENT_DEFS,
      this.run.currentFloor,
      this.currentBiome.id,
      this.unlockedEventIds,
      this.eventRng
    );
    if (eventDef === null) {
      return;
    }
    const position = this.pickFloorEventPosition();
    if (position === null) {
      return;
    }

    this.createEventNode(eventDef, position, nowMs);
  }

  private createEventNode(
    eventDef: RandomEventDef,
    position: { x: number; y: number },
    nowMs: number,
    options?: { emitSpawnEvent?: boolean }
  ): void {
    const marker = this.renderSystem.spawnTelegraphCircle(position, 0.8, this.origin);
    marker.setAlpha(0.18);
    if (marker instanceof Phaser.GameObjects.Image) {
      marker.setTint(0xd0a86f);
    }

    this.eventNode = {
      eventDef,
      position,
      marker,
      resolved: false
    };
    if (options?.emitSpawnEvent !== false) {
      this.eventBus.emit("event:spawn", {
        eventId: eventDef.id,
        eventName: eventDef.name,
        floor: this.run.currentFloor,
        timestampMs: nowMs
      });
    }
  }

  private updateEventInteraction(nowMs: number): void {
    if (this.eventNode === null || this.eventNode.resolved || this.eventPanelOpen) {
      return;
    }
    const distance = Math.hypot(
      this.player.position.x - this.eventNode.position.x,
      this.player.position.y - this.eventNode.position.y
    );
    if (distance > 0.9) {
      return;
    }
    this.openEventPanel(nowMs);
  }

  private openEventPanel(nowMs: number): void {
    if (this.eventNode === null || this.eventNode.resolved) {
      return;
    }
    this.eventPanelOpen = true;
    const eventDef = this.eventNode.eventDef;
    const choices = eventDef.choices.map((choice) => {
      if (canPayEventCost(choice.cost, this.player.health, this.player.mana, this.run.runEconomy.obols)) {
        return { choice, enabled: true as const };
      }
      const reason = choice.cost === undefined ? "Unavailable." : `Need ${choice.cost.amount} ${choice.cost.type}.`;
      return { choice, enabled: false as const, disabledReason: reason };
    });

    this.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId) => this.resolveEventChoice(choiceId, this.time.now),
      () => this.dismissCurrentEvent(this.time.now)
    );
    this.runLog.append(`Event encountered: ${eventDef.name}.`, "info", nowMs);
  }

  private dismissCurrentEvent(nowMs: number): void {
    if (this.eventNode === null) {
      return;
    }
    this.runLog.append(`Left event ${this.eventNode.eventDef.name} without interaction.`, "info", nowMs);
    this.consumeCurrentEvent();
  }

  private applyEventCost(nowMs: number, eventId: string, choiceId: string): boolean {
    if (this.eventNode === null) {
      return false;
    }
    const choice = this.eventNode.eventDef.choices.find((entry) => entry.id === choiceId);
    if (choice === undefined) {
      return false;
    }
    const cost = choice.cost;
    if (!canPayEventCost(cost, this.player.health, this.player.mana, this.run.runEconomy.obols)) {
      const reason = cost === undefined ? "invalid cost" : `need ${cost.amount} ${cost.type}`;
      this.runLog.append(`Cannot choose ${choice.name}: ${reason}.`, "warn", nowMs);
      this.openEventPanel(nowMs);
      return false;
    }

    if (cost !== undefined) {
      if (cost.type === "health") {
        this.player = {
          ...this.player,
          health: Math.max(1, this.player.health - cost.amount)
        };
      } else if (cost.type === "mana") {
        this.player = {
          ...this.player,
          mana: Math.max(0, this.player.mana - cost.amount)
        };
      } else {
        this.run = spendRunObols(this.run, cost.amount);
      }
      this.runLog.append(
        `Event cost paid (${eventId}/${choiceId}): ${cost.amount} ${cost.type}.`,
        "warn",
        nowMs
      );
    }

    return true;
  }

  private applyEventReward(reward: EventReward, nowMs: number, source: string): void {
    if (reward.type === "health") {
      this.player = {
        ...this.player,
        health: Math.min(this.player.derivedStats.maxHealth, this.player.health + reward.amount)
      };
      this.runLog.append(`${source}: restored ${reward.amount} HP.`, "success", nowMs);
      return;
    }
    if (reward.type === "mana") {
      this.player = {
        ...this.player,
        mana: Math.min(this.player.derivedStats.maxMana, this.player.mana + reward.amount)
      };
      this.runLog.append(`${source}: restored ${reward.amount} mana.`, "success", nowMs);
      return;
    }
    if (reward.type === "obol") {
      this.run = addRunObols(this.run, reward.amount);
      this.runLog.append(`${source}: gained ${reward.amount} Obol.`, "success", nowMs);
      return;
    }
    if (reward.type === "xp") {
      const xpResult = applyXpGain(this.player, reward.amount, "intelligence");
      this.player = this.refreshPlayerStatsFromEquipment(xpResult.player);
      this.runLog.append(`${source}: gained ${reward.amount} XP.`, "success", nowMs);
      if (xpResult.leveledUp) {
        this.eventBus.emit("player:levelup", {
          playerId: this.player.id,
          level: this.player.level,
          timestampMs: nowMs
        });
        this.offerLevelupSkill();
      }
      return;
    }
    if (reward.type === "mapping") {
      this.mapRevealActive = true;
      this.runLog.append(`${source}: mapping scroll revealed objective.`, "info", nowMs);
      return;
    }
    if (reward.type === "consumable") {
      this.consumables = grantConsumable(this.consumables, reward.consumableId, reward.amount);
      this.runLog.append(
        `${source}: gained ${reward.amount}x ${reward.consumableId}.`,
        "success",
        nowMs
      );
      return;
    }
    const lootTableId = reward.lootTableId;
    const table =
      reward.itemDefId === undefined
        ? lootTableId === undefined
          ? undefined
          : LOOT_TABLE_MAP[lootTableId]
        : {
            id: `event-${reward.itemDefId}`,
            entries: [{ itemDefId: reward.itemDefId, weight: 1, minFloor: 1 }]
          };
    if (table === undefined) {
      this.runLog.append(`${source}: no valid item reward table.`, "warn", nowMs);
      return;
    }
    const item = rollItemDrop(
      table,
      ITEM_DEF_MAP,
      this.run.currentFloor,
      this.lootRng,
      `event-${Math.floor(nowMs)}-${this.run.currentFloor}`,
      {
        isItemEligible: (itemDef) => this.isItemDefUnlocked(itemDef)
      }
    );
    if (item === null) {
      this.runLog.append(`${source}: item roll failed.`, "warn", nowMs);
      return;
    }
    this.player = collectLoot(this.player, item);
    this.run = {
      ...this.run,
      lootCollected: this.run.lootCollected + 1
    };
    this.runLog.append(`${source}: acquired ${item.name}.`, "success", nowMs);
  }

  private applyEventPenalty(reward: EventReward, nowMs: number, source: string): void {
    if (reward.type === "health") {
      this.player = {
        ...this.player,
        health: Math.max(0, this.player.health - reward.amount)
      };
      this.runLog.append(`${source}: lost ${reward.amount} HP.`, "danger", nowMs);
      if (this.player.health <= 0) {
        this.lastDeathReason = `Fell to event penalty (${reward.amount} health).`;
      }
      return;
    }
    if (reward.type === "mana") {
      this.player = {
        ...this.player,
        mana: Math.max(0, this.player.mana - reward.amount)
      };
      this.runLog.append(`${source}: lost ${reward.amount} mana.`, "warn", nowMs);
      return;
    }
    if (reward.type === "obol") {
      const spent = Math.min(this.run.runEconomy.obols, reward.amount);
      this.run = spendRunObols(this.run, spent);
      this.runLog.append(`${source}: lost ${spent} Obol.`, "warn", nowMs);
      return;
    }
    this.runLog.append(`${source}: penalty ignored (${reward.type}).`, "warn", nowMs);
  }

  private resolveEventChoice(choiceId: string, nowMs: number): void {
    if (this.eventNode === null || this.eventNode.resolved) {
      return;
    }
    const { eventDef } = this.eventNode;
    const choice = eventDef.choices.find((entry) => entry.id === choiceId);
    if (choice === undefined) {
      this.runLog.append(`Event choice ${choiceId} not found.`, "warn", nowMs);
      return;
    }
    if (!this.applyEventCost(nowMs, eventDef.id, choice.id)) {
      this.hudDirty = true;
      return;
    }

    this.eventBus.emit("event:choice", {
      eventId: eventDef.id,
      choiceId: choice.id,
      timestampMs: nowMs
    });

    for (const reward of choice.rewards) {
      this.applyEventReward(reward, nowMs, `Event ${eventDef.name}`);
    }
    this.tryDiscoverBlueprints("random_event", nowMs, eventDef.id);

    if (rollEventRisk(choice, this.eventRng) && choice.risk !== undefined) {
      this.applyEventPenalty(choice.risk.penalty, nowMs, `${eventDef.name} backlash`);
    }

    if (eventDef.id === "wandering_merchant" && choice.id === "browse") {
      this.openMerchantPanel(nowMs);
      this.hudDirty = true;
      return;
    }

    this.consumeCurrentEvent();
    this.hudDirty = true;
    this.flushRunSave();
    if (this.player.health <= 0) {
      this.finishRun(false);
    }
  }

  private openMerchantPanel(nowMs: number): void {
    const merchantPool = LOOT_TABLE_MAP.merchant_pool;
    if (merchantPool === undefined) {
      this.runLog.append("Merchant pool missing.", "warn", nowMs);
      this.consumeCurrentEvent();
      return;
    }
    if (this.merchantOffers.length === 0) {
      const visibleEntries = merchantPool.entries.filter((entry) => {
        const itemDef = ITEM_DEF_MAP[entry.itemDefId];
        return itemDef !== undefined && this.isItemDefUnlocked(itemDef);
      });
      this.merchantOffers = createMerchantOffers(
        visibleEntries,
        this.run.currentFloor,
        this.merchantRng,
        3
      );
      this.eventBus.emit("merchant:offer", {
        floor: this.run.currentFloor,
        offerCount: this.merchantOffers.length,
        timestampMs: nowMs
      });
    }

    const view = this.merchantOffers.map((offer) => {
      const itemDef = ITEM_DEF_MAP[offer.itemDefId];
      return {
        ...offer,
        itemName: itemDef?.name ?? offer.itemDefId,
        rarity: itemDef?.rarity ?? "common"
      };
    });
    this.eventPanelOpen = true;
    this.uiManager.showMerchantDialog(
      view,
      (offerId) => this.tryBuyMerchantOffer(offerId, this.time.now),
      () => this.consumeCurrentEvent()
    );
  }

  private tryBuyMerchantOffer(offerId: string, nowMs: number): void {
    const offer = this.merchantOffers.find((entry) => entry.offerId === offerId);
    if (offer === undefined) {
      this.runLog.append(`Offer ${offerId} unavailable.`, "warn", nowMs);
      this.routeFeedback({
        type: "merchant:fail"
      });
      return;
    }
    if (this.run.runEconomy.obols < offer.priceObol) {
      this.runLog.append(`Not enough Obol for ${offer.itemDefId}.`, "warn", nowMs);
      this.routeFeedback({
        type: "merchant:fail"
      });
      return;
    }

    const item = rollItemDrop(
      {
        id: `merchant-${offer.itemDefId}`,
        entries: [{ itemDefId: offer.itemDefId, weight: 1, minFloor: 1 }]
      },
      ITEM_DEF_MAP,
      this.run.currentFloor,
      this.lootRng,
      `merchant-${offer.offerId}-${Math.floor(nowMs)}`,
      {
        isItemEligible: (itemDef) => this.isItemDefUnlocked(itemDef)
      }
    );
    if (item === null) {
      this.runLog.append(`Merchant failed to deliver ${offer.itemDefId}.`, "warn", nowMs);
      this.routeFeedback({
        type: "merchant:fail"
      });
      return;
    }

    this.run = spendRunObols(this.run, offer.priceObol);
    this.player = collectLoot(this.player, item);
    this.run = {
      ...this.run,
      lootCollected: this.run.lootCollected + 1
    };
    this.eventBus.emit("merchant:purchase", {
      offerId: offer.offerId,
      itemId: item.id,
      itemName: item.name,
      priceObol: offer.priceObol,
      timestampMs: nowMs
    });
    this.merchantOffers = this.merchantOffers.filter((entry) => entry.offerId !== offer.offerId);
    if (this.merchantOffers.length === 0) {
      this.runLog.append("Merchant sold out.", "info", nowMs);
      this.consumeCurrentEvent();
    } else {
      this.openMerchantPanel(nowMs);
    }
    this.hudDirty = true;
  }

  private consumeCurrentEvent(): void {
    if (this.eventNode !== null) {
      this.eventNode.resolved = true;
    }
    this.destroyEventNode();
    this.uiManager.hideEventPanel();
    this.eventPanelOpen = false;
    this.hudDirty = true;
  }

  private makeInitialPlayer(): PlayerState {
    const baseStatsSeed = defaultBaseStats();
    const baseStats = {
      strength: baseStatsSeed.strength + (this.talentEffects.baseStats.strength ?? 0),
      dexterity: baseStatsSeed.dexterity + (this.talentEffects.baseStats.dexterity ?? 0),
      vitality: baseStatsSeed.vitality + (this.talentEffects.baseStats.vitality ?? 0),
      intelligence: baseStatsSeed.intelligence + (this.talentEffects.baseStats.intelligence ?? 0)
    };
    const derivedStats = deriveStats(
      baseStats,
      [],
      undefined,
      this.meta.permanentUpgrades,
      this.talentEffects
    );

    const startingSkillIds = this.pickStartingSkillIds();

    return {
      id: "player",
      position: { ...this.dungeon.playerSpawn },
      level: 1,
      xp: 0,
      xpToNextLevel: 98,
      health: derivedStats.maxHealth,
      mana: derivedStats.maxMana,
      baseStats,
      derivedStats,
      inventory: [],
      equipment: {},
      gold: 0,
      skills: {
        skillSlots: Array.from({ length: Math.min(4, Math.max(2, this.meta.permanentUpgrades.skillSlots)) }, (_, idx) => {
          const id = startingSkillIds[idx];
          return id === undefined ? null : { defId: id, level: 1 };
        }),
        cooldowns: {}
      },
      activeBuffs: []
    };
  }

  private reusePlayerForNewFloor(player: PlayerState): PlayerState {
    return this.refreshPlayerStatsFromEquipment(player);
  }

  private refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState {
    const equipped = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
    const derivedStats = deriveStats(
      player.baseStats,
      equipped,
      undefined,
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

  private pickStartingSkillIds(): string[] {
    const forgedSkillUnlocks = new Set(
      this.meta.blueprintForgedIds
        .map((blueprintId) => BLUEPRINT_DEF_MAP[blueprintId])
        .filter((blueprint) => blueprint?.category === "skill")
        .map((blueprint) => blueprint?.unlockTargetId)
        .filter((skillId): skillId is string => typeof skillId === "string")
    );
    const pool = SKILL_DEFS.filter((skill) => {
      if (skill.unlockCondition === undefined) {
        return true;
      }
      return this.meta.unlocks.includes(skill.unlockCondition) || forgedSkillUnlocks.has(skill.unlockCondition);
    });

    const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    return sorted.slice(0, 2).map((entry) => entry.id);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.runEnded || this.eventPanelOpen) {
      return;
    }

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
      this.revealHiddenRoom(hiddenRoom.roomId, this.time.now, "click");
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
  }

  private getRunRelativeNowMs(): number {
    return Math.max(0, this.time.now - this.run.startedAtMs);
  }

  private updateKeyboardMoveIntent(nowMs: number): void {
    if (this.runEnded || this.eventPanelOpen || this.cursorKeys === null) {
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
    if (this.manualMoveTarget === null || this.runEnded || this.eventPanelOpen) {
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
      this.runLog.append("Pathfinding aborted: cannot reach destination.", "warn", nowMs);
    }
  }

  private resolvePlayerHazardMovementMultiplier(): number {
    const modifiers: number[] = [];
    for (const hazard of this.hazards) {
      if (hazard.type !== "movement_modifier" || hazard.movementMultiplier === undefined) {
        continue;
      }
      if (isInsideHazard(this.player.position, hazard)) {
        modifiers.push(hazard.movementMultiplier);
      }
    }
    return multiplyMovementModifiers(modifiers);
  }

  private updateHazardContactEvents(nowMs: number): void {
    for (const hazard of this.hazards) {
      const inside = isInsideHazard(this.player.position, hazard);
      const previous = this.playerHazardContact.get(hazard.id) === true;
      if (inside && !previous) {
        this.playerHazardContact.set(hazard.id, true);
        this.eventBus.emit("hazard:enter", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          targetId: this.player.id,
          timestampMs: nowMs
        });
      } else if (!inside && previous) {
        this.playerHazardContact.delete(hazard.id);
        this.eventBus.emit("hazard:exit", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          targetId: this.player.id,
          timestampMs: nowMs
        });
      }
    }
  }

  private applyHazardDamageToPlayer(
    hazard: HazardRuntimeState,
    amount: number,
    nowMs: number
  ): void {
    const nextHealth = applyHazardDamage(this.player.health, amount);
    this.player = {
      ...this.player,
      health: nextHealth
    };
    this.eventBus.emit("hazard:damage", {
      hazardId: hazard.id,
      hazardType: hazard.type,
      targetId: this.player.id,
      amount,
      remainingHealth: nextHealth,
      timestampMs: nowMs
    });
    if (nextHealth <= 0) {
      this.lastDeathReason = `Fatal ${hazard.type} damage from ${hazard.defId} (${amount}).`;
    }
    this.hudDirty = true;
  }

  private applyHazardDamageToMonsters(
    hazard: HazardRuntimeState,
    amount: number,
    nowMs: number
  ): void {
    const deadIds: string[] = [];
    for (const monster of this.entityManager.listLivingMonsters()) {
      if (!isInsideHazard(monster.state.position, hazard)) {
        continue;
      }
      const nextHealth = applyHazardDamage(monster.state.health, amount);
      monster.state.health = nextHealth;
      this.eventBus.emit("hazard:damage", {
        hazardId: hazard.id,
        hazardType: hazard.type,
        targetId: monster.state.id,
        amount,
        remainingHealth: nextHealth,
        timestampMs: nowMs
      });
      if (nextHealth <= 0) {
        deadIds.push(monster.state.id);
      }
    }

    if (deadIds.length === 0) {
      return;
    }

    for (const monsterId of deadIds) {
      const dead = this.entityManager.removeMonsterById(monsterId);
      if (dead === null) {
        continue;
      }
      this.onMonsterDefeated(dead.state, nowMs);
      for (const affixId of dead.state.affixes ?? []) {
        this.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
      }
      this.applyOnKillMutationEffects(nowMs);
      dead.sprite.destroy();
      dead.healthBarBg.destroy();
      dead.healthBarFg.destroy();
      dead.affixMarker?.destroy();
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
    this.hudDirty = true;
  }

  private updateHazards(nowMs: number): void {
    if (this.hazards.length === 0) {
      return;
    }

    this.updateHazardContactEvents(nowMs);
    for (let i = 0; i < this.hazards.length; i += 1) {
      const hazard = this.hazards[i]!;
      const visual = this.hazardVisuals[i];
      const damage = hazard.damagePerTick ?? 0;
      if (hazard.type === "damage_zone") {
        if (!shouldRunHazardTick(nowMs, hazard.nextTickAtMs)) {
          continue;
        }
        hazard.nextTickAtMs = nextHazardTickAt(nowMs, hazard.tickIntervalMs);
        if (isInsideHazard(this.player.position, hazard)) {
          this.applyHazardDamageToPlayer(hazard, damage, nowMs);
        }
        this.applyHazardDamageToMonsters(hazard, damage, nowMs);
        continue;
      }

      if (hazard.type === "periodic_trap") {
        if (visual !== undefined && hazard.nextTriggerAtMs !== undefined && hazard.telegraphMs !== undefined) {
          const telegraphStartsAt = hazard.nextTriggerAtMs - hazard.telegraphMs;
          if (nowMs >= telegraphStartsAt) {
            visual.setAlpha(Math.max(0.26, visual.alpha));
          }
        }

        if (!shouldTriggerPeriodicHazard(nowMs, hazard.nextTriggerAtMs)) {
          continue;
        }
        this.eventBus.emit("hazard:trigger", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          position: { ...hazard.position },
          radiusTiles: hazard.radiusTiles,
          timestampMs: nowMs
        });
        if (isInsideHazard(this.player.position, hazard)) {
          this.applyHazardDamageToPlayer(hazard, damage, nowMs);
        }
        this.applyHazardDamageToMonsters(hazard, damage, nowMs);
        hazard.nextTriggerAtMs = nextHazardTriggerAt(nowMs, hazard.triggerIntervalMs);
        if (visual !== undefined) {
          visual.setAlpha(0.12);
        }
      }
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
      canDropItemDef: (itemDef) => this.isItemDefUnlocked(itemDef)
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
    if (playerCombat.combatEvents.length > 0) {
      this.hudDirty = true;
    }

    if (playerCombat.leveledUp) {
      this.eventBus.emit("player:levelup", {
        playerId: this.player.id,
        level: this.player.level,
        timestampMs: nowMs
      });
      this.refreshSynergyRuntime(false);
      this.offerLevelupSkill();
    }

    if (playerCombat.killedMonsterId !== undefined) {
      const { obolMultiplier } = this.resolveMutationDropBonus();
      const bonusObol = Math.max(0, Math.floor(obolMultiplier) - 1);
      if (bonusObol > 0) {
        this.run = addRunObols(this.run, bonusObol);
      }
      const dead = this.entityManager.removeMonsterById(playerCombat.killedMonsterId);
      if (dead !== null) {
        this.onMonsterDefeated(dead.state, nowMs);
        for (const affixId of dead.state.affixes ?? []) {
          this.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
        }
        this.applyOnKillMutationEffects(nowMs);
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();
        dead.affixMarker?.destroy();
        if (hasMonsterAffix(dead.state, "splitting")) {
          this.spawnSplitChildren(dead.state, dead.archetype, nowMs);
        }
      }
    }

    if (playerCombat.droppedItem !== undefined) {
      this.spawnLootDrop(playerCombat.droppedItem.item, playerCombat.droppedItem.position);
      this.eventBus.emit("loot:drop", {
        sourceId: playerCombat.droppedItem.sourceId,
        item: playerCombat.droppedItem.item,
        position: playerCombat.droppedItem.position,
        timestampMs: nowMs
      });
    }
  }

  private offerLevelupSkill(): void {
    if (this.player.skills === undefined) {
      return;
    }

    const forgedSkillUnlocks = new Set(
      this.meta.blueprintForgedIds
        .map((blueprintId) => BLUEPRINT_DEF_MAP[blueprintId])
        .filter((blueprint) => blueprint?.category === "skill")
        .map((blueprint) => blueprint?.unlockTargetId)
        .filter((skillId): skillId is string => typeof skillId === "string")
    );
    const pool = SKILL_DEFS.filter((skill) => {
      if (skill.unlockCondition === undefined) {
        return true;
      }
      return this.meta.unlocks.includes(skill.unlockCondition) || forgedSkillUnlocks.has(skill.unlockCondition);
    });
    const ownedSkillIds = this.player.skills.skillSlots
      .filter((entry): entry is NonNullable<(typeof this.player.skills.skillSlots)[number]> => entry !== null)
      .map((entry) => entry.defId);
    const strongestStat =
      this.player.baseStats.strength >= this.player.baseStats.dexterity &&
      this.player.baseStats.strength >= this.player.baseStats.intelligence
        ? "strength"
        : this.player.baseStats.dexterity >= this.player.baseStats.intelligence
          ? "dexterity"
          : "intelligence";
    const choices = pickSkillChoicesWeighted(
      pool,
      this.skillRng,
      {
        strongestStat,
        ownedSkillIds
      },
      3
    );
    if (choices.length === 0) {
      return;
    }

    const pick = choices[0]!;
    const slots = [...this.player.skills.skillSlots];
    const existingIndex = slots.findIndex((entry) => entry?.defId === pick.id);
    if (existingIndex >= 0) {
      const existing = slots[existingIndex];
      if (existing !== null && existing !== undefined) {
        slots[existingIndex] = {
          defId: existing.defId,
          level: Math.min(3, existing.level + 1)
        };
      }
    } else {
      const firstEmpty = slots.findIndex((entry) => entry === null);
      if (firstEmpty >= 0) {
        slots[firstEmpty] = { defId: pick.id, level: 1 };
      } else {
        slots[0] = { defId: pick.id, level: 1 };
      }
    }

    this.player = {
      ...this.player,
      skills: {
        ...this.player.skills,
        skillSlots: slots
      }
    };
    this.refreshSynergyRuntime();
    this.hudDirty = true;
    this.scheduleRunSave();
  }

  private applySynergyToSkillDef(skillDef: SkillDef): SkillDef {
    const damagePercent = this.synergyRuntime.skillDamagePercent[skillDef.id] ?? 0;
    const modifiers = this.synergyRuntime.skillModifiers[skillDef.id] ?? {};
    const cooldownOverride = this.synergyRuntime.cooldownOverridesMs[skillDef.id];
    const effectDamageScale = 1 + damagePercent;
    const manaCostScale = 1 + (modifiers.manaCost ?? 0);

    return {
      ...skillDef,
      cooldownMs:
        cooldownOverride === undefined
          ? skillDef.cooldownMs
          : Math.max(100, Math.floor(cooldownOverride)),
      manaCost: Math.max(0, Math.floor(skillDef.manaCost * manaCostScale)),
      effects: skillDef.effects.map((effect) => {
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
    const cached = this.entityLabelById.get(entityId);
    if (cached !== undefined) {
      return cached;
    }

    if (entityId === this.player.id) {
      return "Vanguard";
    }

    if (entityId === this.bossDef.id) {
      return this.bossDef.name;
    }

    const monster = this.entityManager.findMonsterById(entityId);
    if (monster !== undefined) {
      const name = monster.archetype.name;
      this.entityLabelById.set(entityId, name);
      return name;
    }

    return entityId;
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
    const nearResult = this.aiSystem.updateMonsters(nearMonsters, this.player, dt, nowMs);
    this.aiFrameCounter = (this.aiFrameCounter + 1) % AI_FAR_UPDATE_INTERVAL_FRAMES;
    const farResult =
      farMonsters.length > 0 && this.aiFrameCounter === 0
        ? this.aiSystem.updateMonsters(
            farMonsters,
            this.player,
            dt * AI_FAR_UPDATE_INTERVAL_FRAMES,
            nowMs
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
        this.runLog.append(
          `${source.archetype.name} healed ${target.archetype.name} for ${target.state.health - before}.`,
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
        this.onMonsterDefeated(dead.state, nowMs);
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();
        dead.affixMarker?.destroy();
        for (const affixId of dead.state.affixes ?? []) {
          this.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
        }
        this.applyOnKillMutationEffects(nowMs);
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
    for (const event of monsterCombat.combatEvents) {
      if (event.kind === "dodge" || event.amount <= 0) {
        continue;
      }
      const source = this.entityManager.findMonsterById(event.sourceId);
      if (source === undefined || !hasMonsterAffix(source.state, "vampiric")) {
        continue;
      }
      const heal = Math.max(1, Math.floor(event.amount * 0.35));
      const before = source.state.health;
      source.state.health = Math.min(source.state.maxHealth, source.state.health + heal);
      const actual = source.state.health - before;
      if (actual <= 0) {
        continue;
      }
      this.eventBus.emit("monster:leech", {
        monsterId: source.state.id,
        targetId: event.targetId,
        amount: actual,
        timestampMs: nowMs
      });
    }
    if (monsterCombat.combatEvents.length > 0) {
      this.hudDirty = true;
    }
  }

  private updateBossCombat(nowMs: number): void {
    if (!this.floorConfig.isBossFloor || this.bossState === null) {
      return;
    }

    const distanceToBoss = Math.hypot(
      this.player.position.x - this.bossState.position.x,
      this.player.position.y - this.bossState.position.y
    );
    const weaponType = resolveEquippedWeaponType(this.player);
    const weaponDef = resolveWeaponTypeDef(weaponType, WEAPON_TYPE_DEF_MAP);
    const bonusAttackSpeed = this.resolveMutationAttackSpeedMultiplier(nowMs);
    const critChanceBonus = weaponDef.mechanic.type === "crit_bonus" ? weaponDef.mechanic.critChanceBonus : 0;
    const critDamageMultiplier = weaponDef.mechanic.type === "crit_bonus"
      ? (weaponDef.mechanic.critDamageMultiplier ?? 1.7)
      : 1.7;

    if (distanceToBoss <= Math.max(1.1, weaponDef.attackRange + 0.3) && nowMs >= this.nextPlayerAttackAt) {
      const crit = this.combatRng.next() < Math.min(0.95, this.player.derivedStats.critChance + critChanceBonus);
      const damage = Math.max(
        1,
        Math.floor(this.player.derivedStats.attackPower * weaponDef.damageMultiplier * (crit ? critDamageMultiplier : 1))
      );
      const previousPhase = this.bossState.currentPhaseIndex;
      this.bossState = applyDamageToBoss(this.bossState, damage);
      this.bossState = {
        ...this.bossState,
        ...(
          this.bossState.health <= this.bossState.maxHealth * 0.5 && this.bossState.currentPhaseIndex === 0
            ? { currentPhaseIndex: 1 }
            : {}
        )
      };
      this.nextPlayerAttackAt =
        nowMs +
        1000 /
          Math.max(
            0.6,
            this.player.derivedStats.attackSpeed *
              Math.max(0.2, weaponDef.attackSpeedMultiplier) *
              bonusAttackSpeed
          );

      if (this.bossState.currentPhaseIndex !== previousPhase) {
        this.eventBus.emit("boss:phaseChange", {
          bossId: this.bossDef.id,
          fromPhase: previousPhase,
          toPhase: this.bossState.currentPhaseIndex,
          hpRatio: this.bossState.health / this.bossState.maxHealth,
          timestampMs: nowMs
        });
      }

      this.hudDirty = true;
    }

    if (nowMs < this.nextBossAttackAt) {
      return;
    }

    const attack = selectBossAttack(this.bossState, this.bossDef, nowMs, this.bossRng);
    if (attack === null) {
      return;
    }

    const attackResult = resolveBossAttack(attack, this.bossState, this.player, this.bossRng, nowMs);
    this.player = attackResult.player;
    this.emitCombatEvents(attackResult.events);

    if (attack.type === "summon") {
      this.eventBus.emit("boss:summon", {
        bossId: this.bossDef.id,
        attack,
        count: attackResult.summonCount ?? 2,
        timestampMs: nowMs
      });
      this.spawnSummonedMonsters(attackResult.summonCount ?? 2);
    }

    this.bossState = markBossAttackUsed(this.bossState, attack, nowMs);
    this.nextBossAttackAt = nowMs + Math.max(800, attack.cooldownMs * 0.4);
    this.hudDirty = true;
  }

  private spawnSummonedMonsters(count: number): void {
    const archetype = MONSTER_ARCHETYPES[0];
    if (archetype === undefined || this.bossState === null) {
      return;
    }

    const existing = this.entityManager.listMonsters().length;
    for (let i = 0; i < count; i += 1) {
      const idx = existing + i;
      const angle = (Math.PI * 2 * i) / Math.max(1, count);
      const position = {
        x: this.bossState.position.x + Math.cos(angle) * 2,
        y: this.bossState.position.y + Math.sin(angle) * 2
      };
      const rolledAffixes = rollMonsterAffixes({
        floor: this.run.currentFloor,
        isBoss: false,
        policy: this.run.difficultyModifier.affixPolicy,
        availableAffixes: this.unlockedAffixIds,
        rng: this.spawnRng
      });
      const state = applyAffixesToMonsterState({
        id: `summon-${idx}-${Math.floor(this.time.now)}`,
        archetypeId: archetype.id,
        level: this.run.currentFloor,
        health: Math.floor(65 * this.floorConfig.monsterHpMultiplier),
        maxHealth: Math.floor(65 * this.floorConfig.monsterHpMultiplier),
        damage: Math.floor(8 * this.floorConfig.monsterDmgMultiplier),
        attackRange: archetype.attackRange,
        moveSpeed: archetype.moveSpeed,
        xpValue: archetype.xpValue,
        dropTableId: archetype.dropTableId,
        position,
        aiState: "chase",
        aiBehavior: "chase",
        affixes: rolledAffixes
      } satisfies MonsterState);
      const runtime = this.renderSystem.spawnMonster(state, archetype, this.origin);
      this.entityLabelById.set(runtime.state.id, runtime.archetype.name);
      for (const affix of runtime.state.affixes ?? []) {
        this.eventBus.emit("monster:affixApplied", {
          monsterId: runtime.state.id,
          affixId: affix,
          timestampMs: this.time.now
        });
      }
      this.entityManager.listMonsters().push(runtime);
    }
    this.entityManager.rebuildMonsterSpatialIndex();
  }

  private spawnSplitChildren(
    sourceState: MonsterState,
    archetype: (typeof MONSTER_ARCHETYPES)[number],
    nowMs: number
  ): void {
    const spawnedIds: string[] = [];
    const sourceAffixes = sourceState.affixes ?? [];
    const childAffixes = sourceAffixes.filter((affix) => affix !== "splitting");

    for (let i = 0; i < 2; i += 1) {
      const angle = (Math.PI * 2 * i) / 2;
      const childState: MonsterState = {
        ...sourceState,
        id: `split-${sourceState.id}-${i}-${Math.floor(nowMs)}`,
        health: Math.max(1, Math.floor(sourceState.maxHealth * 0.42)),
        maxHealth: Math.max(1, Math.floor(sourceState.maxHealth * 0.42)),
        damage: Math.max(1, Math.floor(sourceState.damage * 0.68)),
        xpValue: Math.max(1, Math.floor(sourceState.xpValue * 0.45)),
        dropTableId: "",
        position: {
          x: sourceState.position.x + Math.cos(angle) * 0.7,
          y: sourceState.position.y + Math.sin(angle) * 0.7
        },
        aiState: "idle",
        affixes: childAffixes
      };
      const runtime = this.renderSystem.spawnMonster(childState, archetype, this.origin);
      this.entityManager.listMonsters().push(runtime);
      this.entityLabelById.set(childState.id, `${archetype.name} Fragment`);
      spawnedIds.push(childState.id);
      for (const affix of childAffixes) {
        this.eventBus.emit("monster:affixApplied", {
          monsterId: childState.id,
          affixId: affix,
          timestampMs: nowMs
        });
      }
    }

    if (spawnedIds.length > 0) {
      this.entityManager.rebuildMonsterSpatialIndex();
      this.eventBus.emit("monster:split", {
        sourceMonsterId: sourceState.id,
        spawnedIds,
        timestampMs: nowMs
      });
    }
  }

  private collectNearbyLoot(nowMs: number): void {
    const picked = this.entityManager.consumeLootNear(this.player.position, LOOT_PICKUP_RADIUS_TILES);
    if (picked.length === 0) {
      return;
    }

    for (const drop of picked) {
      this.player = collectLoot(this.player, drop.item);
      this.run = {
        ...this.run,
        lootCollected: this.run.lootCollected + 1
      };
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
    const endlessAffixBonus = this.run.inEndless ? resolveEndlessAffixBonusCount(this.run.currentFloor) : 0;
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

  private spawnBoss(): void {
    const roomCenter = findStaircasePosition(this.dungeon, this.dungeon.playerSpawn);
    this.bossState = initBossState(this.bossDef, roomCenter);
    this.entityLabelById.set(this.bossDef.id, this.bossDef.name);
    this.bossSprite = this.renderSystem.spawnBoss(roomCenter, this.origin, this.bossDef.spriteKey);
    this.entityManager.setBoss({
      state: this.bossState,
      sprite: this.bossSprite
    });
  }

  private spawnLootDrop(item: ItemInstance, position: { x: number; y: number }): void {
    this.entityManager.addLoot({
      item,
      sprite: this.renderSystem.spawnLootSprite(item, position, this.origin),
      position: { ...position }
    });
  }

  private renderStaircases(): void {
    if (!this.staircaseState.visible) {
      this.entityManager.setStaircases([]);
      return;
    }
    if (this.staircaseState.kind === "branch" && this.staircaseState.options !== undefined) {
      this.entityManager.setStaircases(
        this.staircaseState.options.map((option) => this.renderSystem.spawnStaircase(option.position, this.origin))
      );
      return;
    }
    this.entityManager.setStaircase(this.renderSystem.spawnStaircase(this.staircaseState.position, this.origin));
  }

  private syncBossSprite(): void {
    if (this.bossState === null || this.bossSprite === null) {
      return;
    }

    const mapped = gridToIso(
      this.bossState.position.x,
      this.bossState.position.y,
      this.tileWidth,
      this.tileHeight,
      this.origin.x,
      this.origin.y
    );

    this.bossSprite.setPosition(mapped.x, mapped.y);
    this.bossSprite.setVisible(this.bossState.health > 0);
  }

  private updateFloorProgress(nowMs: number): void {
    if (this.floorConfig.isBossFloor) {
      return;
    }

    const revealThreshold = Math.ceil(this.floorConfig.monsterCount * this.floorConfig.clearThreshold);
    if (!this.staircaseState.visible && this.run.kills >= revealThreshold) {
      this.staircaseState = {
        ...this.staircaseState,
        visible: true
      };
      this.renderStaircases();
      this.eventBus.emit("floor:clear", {
        floor: this.run.currentFloor,
        kills: this.run.kills,
        staircase: this.staircaseState,
        timestampMs: nowMs
      });
      this.tryDiscoverBlueprints("floor_clear", nowMs);
    }

    if (!this.staircaseState.visible) {
      return;
    }
    if (!isPlayerOnStaircase(this.player.position, this.staircaseState, 0.85)) {
      return;
    }

    if (this.staircaseState.kind === "branch") {
      const side = resolveBranchSideAtPosition(this.staircaseState, this.player.position, 0.85);
      if (side === undefined) {
        return;
      }
      this.staircaseState = {
        ...this.staircaseState,
        selected: side
      };
      this.run = {
        ...this.run,
        branchChoice: resolveBranchChoiceFromSide(side)
      };
    }

    const storyMaxFloor = GAME_CONFIG.maxFloors ?? 5;
    if (!this.run.inEndless && this.run.currentFloor >= storyMaxFloor) {
      return;
    }

    const fromFloor = this.run.currentFloor;
    this.run = appendReplayInput(this.run, {
      type: "floor_transition",
      atMs: this.getRunRelativeNowMs(),
      fromFloor,
      toFloor: fromFloor + 1
    });
    this.run = enterNextFloor(this.run);
    if (this.run.inEndless) {
      this.run = advanceEndlessFloor(this.run);
      this.run = addRunObols(this.run, endlessFloorClearBonus(this.run.currentFloor));
    } else {
      this.run = addRunObols(this.run, 5);
    }
    this.setupFloor(this.run.currentFloor, false);
  }

  private openBossVictoryChoice(nowMs: number): void {
    if (this.eventPanelOpen || this.runEnded) {
      return;
    }
    const canEnterAbyss = this.run.runMode !== "daily";
    const eventDef: RandomEventDef = {
      id: ABYSS_VICTORY_EVENT_ID,
      name: "Bone Throne Cleared",
      description: canEnterAbyss
        ? "Claim victory now or descend into the Abyss for endless escalation."
        : "Daily mode only allows Claim Victory.",
      floorRange: { min: this.run.currentFloor, max: this.run.currentFloor },
      spawnWeight: 1,
      choices: [
        {
          id: "claim_victory",
          name: "Claim Victory",
          description: "End run and secure rewards.",
          rewards: []
        },
        {
          id: "enter_abyss",
          name: "Enter Abyss",
          description: "Continue to endless floors with escalating danger.",
          rewards: []
        }
      ]
    };
    const choices = eventDef.choices.map((choice) => {
      if (choice.id === "enter_abyss" && !canEnterAbyss) {
        return {
          choice,
          enabled: false as const,
          disabledReason: "Daily mode does not support Abyss."
        };
      }
      return {
        choice,
        enabled: true as const
      };
    });
    this.eventPanelOpen = true;
    this.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId) => {
        this.consumeCurrentEvent();
        if (choiceId === "enter_abyss" && canEnterAbyss) {
          this.enterAbyss(this.time.now);
          return;
        }
        this.finishRun(true);
      },
      () => {
        this.consumeCurrentEvent();
        this.finishRun(true);
      }
    );
    this.runLog.append("Bone Sovereign defeated. Choose your fate.", "success", nowMs);
  }

  private enterAbyss(nowMs: number): void {
    if (this.run.inEndless) {
      return;
    }
    const fromFloor = this.run.currentFloor;
    this.run = appendReplayInput(this.run, {
      type: "floor_transition",
      atMs: this.getRunRelativeNowMs(),
      fromFloor,
      toFloor: fromFloor + 1
    });
    this.run = enterNextFloor(this.run);
    this.run = {
      ...enterEndless(this.run),
      endlessKills: 0
    };
    this.run = addRunObols(this.run, endlessFloorClearBonus(this.run.currentFloor));
    this.runLog.append(`Entered Abyss Floor ${this.run.currentFloor}.`, "warn", nowMs);
    this.setupFloor(this.run.currentFloor, false);
    this.flushRunSave();
  }

  private finishRun(isVictory: boolean): void {
    if (this.runEnded) {
      return;
    }
    this.sfxSystem.stopAmbient();
    this.consumeCurrentEvent();
    this.runEnded = true;
    this.run = {
      ...this.run,
      isVictory
    };
    if (isVictory) {
      this.tryDiscoverBlueprints("boss_kill", this.time.now, this.bossDef.id);
      this.tryDiscoverBlueprints("boss_first_kill", this.time.now, this.bossDef.id);
    }

    const { summary: baseSummary, meta: nextMeta, replay } = endRun(this.run, this.player, this.time.now, this.meta);
    const { soulShardMultiplier } = this.resolveMutationDropBonus();
    const baseSoulShards =
      this.run.inEndless && isVictory === false
        ? (() => {
            const kills = Math.max(0, this.run.endlessKills ?? 0);
            const perKillReward = endlessKillShardReward(this.run.currentFloor);
            let floorBonus = 0;
            for (let floor = 6; floor <= this.run.currentFloor; floor += 1) {
              floorBonus += endlessFloorClearBonus(floor);
            }
            return kills * perKillReward + floorBonus;
          })()
        : calculateSoulShardReward(this.run, isVictory);
    let soulShards = Math.max(0, Math.floor(baseSoulShards * soulShardMultiplier));
    if (this.run.runMode === "daily" && this.dailyPracticeMode) {
      soulShards = 0;
    }
    let summary = {
      ...baseSummary,
      isVictory,
      soulShardsEarned: soulShards,
      obolsEarned: this.run.runEconomy.obols
    };
    let mergedMeta = mergeFoundBlueprints(nextMeta, this.blueprintFoundIdsInRun);
    if (this.run.inEndless) {
      mergedMeta = recordEndlessBestFloor(mergedMeta, this.run.currentFloor);
    }
    if (this.run.runMode === "daily" && this.run.dailyDate !== undefined) {
      summary = {
        ...summary,
        dailyDate: this.run.dailyDate
      };
      if (!this.dailyPracticeMode) {
        const rewarded = !hasClaimedDailyReward(mergedMeta, this.run.dailyDate);
        const dailyEntry = buildDailyHistoryEntry(this.run.dailyDate, this.runSeed, summary, rewarded);
        summary = {
          ...summary,
          score: dailyEntry.score
        };
        mergedMeta = upsertDailyHistory(mergedMeta, dailyEntry);
        if (rewarded) {
          mergedMeta = markDailyRewardClaimed(mergedMeta, this.run.dailyDate);
        }
      }
    }
    const runId = `${this.runSeed}:${this.run.startedAtMs}`;
    if (!this.saveManager.isRunSettled(runId)) {
      this.meta = applyRunSummaryToMeta(mergedMeta, summary);
      const committed = this.saveMeta(this.meta);
      if (committed) {
        this.saveManager.markRunSettled(runId);
        this.saveManager.deleteSave();
      }
    } else {
      this.saveManager.deleteSave();
    }
    this.saveCoordinator.stopHeartbeat();
    this.bossState = null;
    this.renderHud();
    this.hudDirty = false;
    if (isVictory) {
      this.uiManager.hideDeathOverlay();
    } else {
      this.uiManager.showDeathOverlay(this.lastDeathReason);
    }
    this.uiManager.showSummary(summary);

    const runEndPayload: GameEventMap["run:end"] = {
      summary,
      inputs: replay?.inputs ?? [],
      finishedAtMs: this.time.now,
      ...(summary.replayChecksum === undefined ? {} : { checksum: summary.replayChecksum })
    };
    this.eventBus.emit("run:end", runEndPayload);
  }

  private resetRun(): void {
    this.uiManager.clearSummary();
    this.bootstrapRun(this.resolveInitialRunSeed(), this.selectedDifficulty);
    this.saveCoordinator.startHeartbeat();
    this.flushRunSave();
    this.hudDirty = true;
  }

  private tryUseSkill(slotIndex: number): void {
    if (this.player.skills === undefined || this.runEnded || this.eventPanelOpen) {
      return;
    }
    const nowMs = this.time.now;

    const slot = this.player.skills.skillSlots[slotIndex];
    if (slot === null || slot === undefined) {
      return;
    }

    const def = SKILL_DEFS.find((entry) => entry.id === slot.defId);
    if (def === undefined) {
      return;
    }
    const scaledDef = createSkillDefForLevel(def, slot.level);
    const runtimeSkillDef = this.applySynergyToSkillDef(scaledDef);

    if (!canUseSkill(this.player, this.player.skills, runtimeSkillDef, nowMs)) {
      return;
    }

    const monsters = this.entityManager.listMonsters();
    const resolution = this.combatSystem.useSkill(
      this.player,
      monsters,
      runtimeSkillDef as SkillDef,
      this.skillRng,
      nowMs,
      WEAPON_TYPE_DEF_MAP
    );
    this.player = {
      ...resolution.player,
      skills: markSkillUsed(this.player.skills, runtimeSkillDef as SkillDef, nowMs)
    };

    let kills = 0;
    for (const event of resolution.events) {
      if (event.kind !== "death") {
        continue;
      }
      const dead = this.entityManager.removeMonsterById(event.targetId);
      if (dead !== null) {
        this.onMonsterDefeated(dead.state, nowMs);
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();
        dead.affixMarker?.destroy();
        for (const affixId of dead.state.affixes ?? []) {
          this.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
        }
        this.applyOnKillMutationEffects(nowMs);
        if (hasMonsterAffix(dead.state, "splitting")) {
          this.spawnSplitChildren(dead.state, dead.archetype, nowMs);
        }

        const xpResult = applyXpGain(this.player, dead.state.xpValue, "strength");
        this.player = {
          ...xpResult.player,
          derivedStats: deriveStats(
            xpResult.player.baseStats,
            Object.values(xpResult.player.equipment).filter((item): item is ItemInstance => item !== undefined),
            undefined,
            this.meta.permanentUpgrades,
            this.talentEffects
          )
        };
      }
      kills += 1;
    }

    if (kills > 0) {
      const { obolMultiplier } = this.resolveMutationDropBonus();
      this.run = addRunObols(
        {
          ...this.run,
          kills: this.run.kills + kills,
          totalKills: this.run.totalKills + kills,
          endlessKills: (this.run.endlessKills ?? 0) + (this.run.inEndless ? kills : 0)
        },
        Math.max(kills, Math.floor(kills * obolMultiplier))
      );
    }

    this.eventBus.emit("skill:use", {
      playerId: this.player.id,
      skillId: def.id,
      timestampMs: nowMs,
      resolution
    });
    this.eventBus.emit("skill:cooldown", {
      playerId: this.player.id,
      skillId: def.id,
      readyAtMs: this.player.skills?.cooldowns[def.id] ?? nowMs
    });
    this.refreshSynergyRuntime();
    this.hudDirty = true;
  }

  private tryUseConsumable(consumableId: ConsumableId): void {
    if (this.runEnded || this.eventPanelOpen) {
      return;
    }
    const nowMs = this.time.now;
    const availability = canUseConsumable(this.player, this.consumables, consumableId, nowMs);
    if (!availability.ok) {
      this.eventBus.emit("consumable:failed", {
        playerId: this.player.id,
        consumableId,
        reason: availability.reason,
        timestampMs: nowMs
      });
      return;
    }

    const result = useConsumable(this.player, this.consumables, consumableId, nowMs);
    this.player = result.player;
    this.consumables = result.consumables;
    if (consumableId === "health_potion") {
      const potionEffects = this.collectMutationEffects("potion_heal_amp_and_self_damage");
      if (potionEffects.length > 0) {
        const healPercent = potionEffects.reduce((sum, effect) => sum + effect.healPercent, 0);
        const selfDamagePercent = potionEffects.reduce(
          (sum, effect) => sum + effect.selfDamageCurrentHpPercent,
          0
        );
        const extraHeal = Math.max(0, Math.floor(result.amountApplied * healPercent));
        const healedHealth = Math.min(this.player.derivedStats.maxHealth, this.player.health + extraHeal);
        const selfDamage = Math.max(0, Math.floor(healedHealth * selfDamagePercent));
        this.player = {
          ...this.player,
          health: Math.max(1, healedHealth - selfDamage)
        };
        this.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:potion_tradeoff",
          effectType: "potion_heal_amp_and_self_damage",
          timestampMs: nowMs,
          value: extraHeal - selfDamage
        });
      }
    }
    if (result.mappingRevealed) {
      this.mapRevealActive = true;
      this.runLog.append("Objective mapped on HUD.", "info", nowMs);
    }
    this.eventBus.emit("consumable:use", {
      playerId: this.player.id,
      consumableId,
      amountApplied: result.amountApplied,
      remainingCharges: this.consumables.charges[consumableId] ?? 0,
      timestampMs: nowMs
    });
    this.hudDirty = true;
  }

  private renderHud(): void {
    const nowMs = this.time.now;
    const newlyAcquiredItemIds = this.collectNewlyAcquiredItemIds(nowMs);
    const consumables = CONSUMABLE_DEFS.map((def) => {
      const cooldownLeftMs = Math.max(0, (this.consumables.cooldowns[def.id] ?? 0) - nowMs);
      const availability = canUseConsumable(this.player, this.consumables, def.id, nowMs);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        hotkey: def.hotkey ?? "-",
        iconId: CONSUMABLE_ICON_BY_ID[def.id],
        charges: this.consumables.charges[def.id] ?? 0,
        cooldownLeftMs,
        ...(availability.ok ? {} : { disabledReason: availability.reason })
      };
    });
    const activeSkillIds = new Set<string>();
    let hasActiveSkillCooldown = false;
    const skillSlots = (this.player.skills?.skillSlots ?? []).map((slot, index) => {
      if (slot === null) {
        return {
          hotkey: String(index + 1),
          name: "Locked",
          description: "Unlock more skill slots from meta progression.",
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
        scaledSkillDef === undefined ? undefined : this.applySynergyToSkillDef(scaledSkillDef);
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
      return {
        id: slot.defId,
        hotkey: String(index + 1),
        name: `${runtimeSkillDef?.name ?? scaledSkillDef?.name ?? skillDef?.name ?? slot.defId} Lv.${slot.level}`,
        description: runtimeSkillDef?.description ?? scaledSkillDef?.description ?? skillDef?.description ?? "",
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
      biome: this.currentBiome.name,
      kills: this.run.kills,
      lootCollected: this.run.lootCollected,
      targetKills: this.floorConfig.monsterCount,
      obols: this.run.runEconomy.obols,
      floorGoalReached: this.staircaseState.visible || this.mapRevealActive,
      mappingRevealed: this.mapRevealActive,
      newlyAcquiredItemIds,
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
    this.recomputeNextTransientHudRefreshAt(nowMs, hasActiveSkillCooldown);

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
        eventPanelOpen: this.eventPanelOpen,
        debugCheatsEnabled: this.debugCheatsEnabled,
        timestampMs: nowMs
      }
    });
    this.uiManager.renderSnapshot(snapshot);
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

  private recomputeNextTransientHudRefreshAt(nowMs: number, hasActiveSkillCooldown: boolean): void {
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
    this.nextTransientHudRefreshAt = next;
  }

  private collectRngCursor(): Record<RunRngStreamName, number> {
    return {
      procgen: 0,
      spawn: this.spawnRng?.getCursor() ?? 0,
      combat: this.combatRng?.getCursor() ?? 0,
      loot: this.lootRng?.getCursor() ?? 0,
      skill: this.skillRng?.getCursor() ?? 0,
      boss: this.bossRng?.getCursor() ?? 0,
      biome: this.biomeRng?.getCursor() ?? 0,
      hazard: this.hazardRng?.getCursor() ?? 0,
      event: this.eventRng?.getCursor() ?? 0,
      merchant: this.merchantRng?.getCursor() ?? 0
    };
  }

  private currentEventNodeSnapshot(): RuntimeEventNodeState | null {
    if (this.eventNode === null) {
      return null;
    }

    return {
      eventId: this.eventNode.eventDef.id,
      position: { ...this.eventNode.position },
      resolved: this.eventNode.resolved,
      ...(this.merchantOffers.length === 0
        ? {}
        : { merchantOffers: this.merchantOffers.map((offer) => ({ ...offer })) })
    };
  }

  private buildRunSaveSnapshot(nowMs: number): RunSaveDataV2 | null {
    if (this.runEnded || (this.run as RunState | undefined) === undefined || this.player === undefined) {
      return null;
    }
    const minimapSnapshot = this.uiManager.getMinimapSnapshot() ?? {
      layoutHash: this.dungeon.layoutHash,
      exploredKeys: []
    };
    const wallNowMs = Date.now();
    const staircaseSnapshot: StaircaseState = {
      position: { ...this.staircaseState.position },
      visible: this.staircaseState.visible
    };
    if (this.staircaseState.kind !== undefined) {
      staircaseSnapshot.kind = this.staircaseState.kind;
    }
    if (this.staircaseState.options !== undefined) {
      staircaseSnapshot.options = [
        {
          ...this.staircaseState.options[0],
          position: { ...this.staircaseState.options[0].position }
        },
        {
          ...this.staircaseState.options[1],
          position: { ...this.staircaseState.options[1].position }
        }
      ];
    }
    if (this.staircaseState.selected !== undefined) {
      staircaseSnapshot.selected = this.staircaseState.selected;
    }

    return {
      schemaVersion: 2,
      savedAtMs: wallNowMs,
      appVersion: RUN_SAVE_APP_VERSION,
      runId: `${this.runSeed}:${this.run.startedAtMs}`,
      runSeed: this.runSeed,
      run: {
        ...this.run
      },
      player: {
        ...this.player,
        position: { ...this.player.position }
      },
      consumables: {
        charges: { ...this.consumables.charges },
        cooldowns: { ...this.consumables.cooldowns }
      },
      dungeon: {
        ...this.dungeon,
        walkable: this.dungeon.walkable.map((row) => [...row]),
        rooms: this.dungeon.rooms.map((room) => ({ ...room })),
        corridors: this.dungeon.corridors.map((corridor) => ({
          ...corridor,
          path: corridor.path.map((point) => ({ ...point }))
        })),
        spawnPoints: this.dungeon.spawnPoints.map((point) => ({ ...point })),
        playerSpawn: { ...this.dungeon.playerSpawn },
        hiddenRooms: (this.dungeon.hiddenRooms ?? []).map((room) => ({
          roomId: room.roomId,
          entrance: { ...room.entrance },
          revealed: room.revealed,
          rewardsClaimed: room.rewardsClaimed
        }))
      },
      staircase: staircaseSnapshot,
      hazards: this.hazards.map((hazard) => ({
        ...hazard,
        position: { ...hazard.position }
      })),
      boss:
        this.bossState === null
          ? null
          : {
              ...this.bossState,
              position: { ...this.bossState.position },
              attackCooldowns: { ...this.bossState.attackCooldowns }
            },
      monsters: this.entityManager.listMonsters().map((monster) => ({
        state: {
          ...monster.state,
          position: { ...monster.state.position },
          ...(monster.state.affixes === undefined ? {} : { affixes: [...monster.state.affixes] })
        },
        nextAttackAt: monster.nextAttackAt,
        nextSupportAt: monster.nextSupportAt
      })),
      lootOnGround: this.entityManager.listLoot().map((drop) => ({
        item: {
          ...drop.item,
          rolledAffixes: { ...drop.item.rolledAffixes },
          ...(drop.item.rolledSpecialAffixes === undefined
            ? {}
            : { rolledSpecialAffixes: { ...drop.item.rolledSpecialAffixes } })
        },
        position: { ...drop.position }
      })),
      eventNode: this.currentEventNodeSnapshot(),
      minimap: {
        layoutHash: minimapSnapshot.layoutHash,
        exploredKeys: [...minimapSnapshot.exploredKeys]
      },
      mapRevealActive: this.mapRevealActive,
      rngCursor: this.collectRngCursor(),
      blueprintFoundIdsInRun: [...this.blueprintFoundIdsInRun],
      selectedMutationIds: [...this.mutationRuntime.activeIds],
      lease: {
        tabId: this.saveManager.getTabId(),
        renewedAtMs: wallNowMs,
        leaseUntilMs: wallNowMs + SAVE_LEASE_TTL_MS
      }
    };
  }

  private flushRunSave(): void {
    this.saveCoordinator.flush();
    this.lastAutoSaveAt = this.time.now;
  }

  private scheduleRunSave(): void {
    this.saveCoordinator.schedule();
  }

  private restoreRunFromSave(save: RunSaveDataV2): boolean {
    try {
      this.pendingResumeSave = null;
      this.runSeed = save.runSeed;
      this.run = {
        ...save.run,
        runSeed: save.runSeed,
        endlessKills: Math.max(0, Math.floor(save.run.endlessKills ?? 0))
      };
      this.dailyPracticeMode =
        this.run.runMode === "daily" && this.run.dailyDate !== undefined
          ? !canStartDailyScoredAttempt(this.meta, this.run.dailyDate)
          : false;
      this.dailyFixedWeaponType = this.run.runMode === "daily" ? this.resolveDailyWeaponType(save.runSeed) : null;
      this.selectedDifficulty = normalizeDifficultyMode(save.run.difficulty, "normal");
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
      this.nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
      this.lastAiNearCount = 0;
      this.lastAiFarCount = 0;
      this.path = [];
      this.blueprintFoundIdsInRun = [...(save.blueprintFoundIdsInRun ?? [])];
      this.attackTargetId = null;
      this.nextPlayerAttackAt = 0;
      this.nextBossAttackAt = 0;
      this.uiManager.clearLogs();
      this.uiManager.hideDeathOverlay();
      this.uiManager.hideEventPanel();
      this.eventPanelOpen = false;

      this.refreshUnlockSnapshots();
      this.consumables = {
        charges: { ...save.consumables.charges },
        cooldowns: { ...save.consumables.cooldowns }
      };
      this.mapRevealActive = save.mapRevealActive;
      this.merchantOffers = [];

      this.children.removeAll(true);
      this.entityManager.clear();
      this.clearHazards();
      this.clearChallengeState();
      this.movementSystem.clearPathCache();

      this.floorConfig = getFloorConfig(this.run.currentFloor, this.run.difficultyModifier);
      this.configureRngStreams(this.run.currentFloor, save.rngCursor);
      this.currentBiome = BIOME_MAP[this.run.currentBiomeId] ?? BIOME_MAP.forgotten_catacombs;
      this.dungeon = {
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
      this.player = this.refreshPlayerStatsFromEquipment({
        ...save.player,
        position: { ...save.player.position },
        inventory: [...save.player.inventory],
        equipment: { ...save.player.equipment }
      });
      this.staircaseState = {
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

      const world = this.renderSystem.computeWorldBounds(this.dungeon);
      this.origin = world.origin;
      this.worldBounds = world.worldBounds;
      this.cameras.main.setBackgroundColor(
        Phaser.Display.Color.IntegerToColor(this.currentBiome.ambientColor).rgba
      );
      this.renderSystem.drawDungeon(
        this.dungeon,
        this.origin,
        this.resolveBiomeTileTint(this.currentBiome.id)
      );
      this.renderHiddenRoomMarkers();

      const playerRender = this.renderSystem.spawnPlayer(this.player.position, this.origin);
      this.playerSprite = playerRender.sprite;
      this.playerYOffset = playerRender.yOffset;

      this.hazards = save.hazards.map((hazard) => ({
        ...hazard,
        position: { ...hazard.position }
      }));
      for (const hazard of this.hazards) {
        this.addHazardVisual(hazard);
      }

      const runtimes = save.monsters
        .map((monster) => {
          const archetype = MONSTER_ARCHETYPES.find((entry) => entry.id === monster.state.archetypeId);
          if (archetype === undefined) {
            return null;
          }
          const runtime = this.renderSystem.spawnMonster(
            {
              ...monster.state,
              position: { ...monster.state.position },
              ...(monster.state.affixes === undefined
                ? {}
                : { affixes: [...monster.state.affixes] })
            },
            archetype,
            this.origin
          );
          runtime.nextAttackAt = monster.nextAttackAt;
          runtime.nextSupportAt = monster.nextSupportAt;
          this.entityLabelById.set(runtime.state.id, archetype.name);
          return runtime;
        })
        .filter((entry): entry is ReturnType<RenderSystem["spawnMonster"]> => entry !== null);
      this.entityManager.setMonsters(runtimes);

      for (const drop of save.lootOnGround) {
        this.entityManager.addLoot({
          item: {
            ...drop.item,
            rolledAffixes: { ...drop.item.rolledAffixes },
            ...(drop.item.rolledSpecialAffixes === undefined
              ? {}
              : { rolledSpecialAffixes: { ...drop.item.rolledSpecialAffixes } })
          },
          position: { ...drop.position },
          sprite: this.renderSystem.spawnLootSprite(drop.item, drop.position, this.origin)
        });
      }

      if (save.boss !== null) {
        this.bossState = {
          ...save.boss,
          position: { ...save.boss.position },
          attackCooldowns: { ...save.boss.attackCooldowns }
        };
        this.entityLabelById.set(this.bossDef.id, this.bossDef.name);
        this.bossSprite = this.renderSystem.spawnBoss(this.bossState.position, this.origin, this.bossDef.spriteKey);
        this.entityManager.setBoss({
          state: this.bossState,
          sprite: this.bossSprite
        });
      } else {
        this.bossState = null;
        this.bossSprite = null;
        this.entityManager.setBoss(null);
      }

      this.renderStaircases();

      this.destroyEventNode();
      const eventNodeSnapshot = save.eventNode;
      if (eventNodeSnapshot !== null) {
        const eventDef = RANDOM_EVENT_DEFS.find((entry) => entry.id === eventNodeSnapshot.eventId);
        if (eventDef !== undefined) {
          this.createEventNode(eventDef, eventNodeSnapshot.position, this.time.now, { emitSpawnEvent: false });
          if (this.eventNode !== null) {
            this.eventNode.resolved = eventNodeSnapshot.resolved;
          }
          this.merchantOffers = eventNodeSnapshot.merchantOffers?.map((offer) => ({ ...offer })) ?? [];
          if (eventNodeSnapshot.resolved) {
            this.consumeCurrentEvent();
          }
        }
      }
      this.restoreChallengeRoom(this.time.now);

      this.renderSystem.configureCamera(this.cameras.main, this.worldBounds, this.playerSprite);
      this.uiManager.configureMinimap({
        width: this.dungeon.width,
        height: this.dungeon.height,
        walkable: this.dungeon.walkable,
        layoutHash: this.dungeon.layoutHash
      });
      this.uiManager.resetMinimap();
      this.uiManager.restoreMinimap(save.minimap);
      this.lastMinimapRefreshAt = 0;
      this.updateMinimap(this.time.now);

      this.hudDirty = true;
      this.resumedFromSave = true;
      this.lastAutoSaveAt = this.time.now;
      const restoredSelectionCandidate = save.selectedMutationIds ?? this.meta.selectedMutationIds;
      const unlockedMutationIds = collectUnlockedMutationIds(this.meta, MUTATION_DEFS);
      const selectionValidation = validateMutationSelection(
        restoredSelectionCandidate,
        MUTATION_DEF_BY_ID,
        this.meta.mutationSlots,
        unlockedMutationIds
      );
      this.resetMutationRuntimeState(
        selectionValidation.ok ? selectionValidation.selected : this.meta.selectedMutationIds
      );
      this.refreshSynergyRuntime();
      return true;
    } catch (error) {
      console.warn("[Save] Failed to restore run snapshot.", error);
      return false;
    }
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
    this.destroyEventNode();
    this.clearHiddenRoomMarkers();
    this.clearHazards();
    this.movementSystem.clearPathCache();
    this.manualMoveTarget = null;
    this.manualMoveTargetFailures = 0;
    this.nextManualPathReplanAt = 0;
    this.nextKeyboardMoveInputAt = 0;
    this.newlyAcquiredItemUntilMs.clear();
    this.previousSkillCooldownLeftById.clear();
    this.skillReadyFlashUntilMsById.clear();
    this.nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
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
