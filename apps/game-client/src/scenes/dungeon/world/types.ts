import Phaser from "phaser";
import type {
  BossRuntimeState,
  BiomeId,
  ChallengeRoomState,
  ConsumableState,
  DeferredOutcomeState,
  DungeonLayout,
  GameEventMap,
  HazardRuntimeState,
  ItemDef,
  ItemInstance,
  LootTableDef,
  MerchantOffer,
  MetaProgression,
  MonsterAffixId,
  MonsterState,
  PlayerState,
  RandomEventDef,
  RollItemDropOptions,
  RunState,
  StaircaseState,
  TalentEffectTotals,
  TypedEventBus
} from "@blodex/core";
import type { BiomeDef, FloorConfig, MonsterArchetypeDef } from "@blodex/content";
import type { MonsterRuntime } from "../../../systems/EntityManager";
import type { WorldBoundsConfig } from "../../../systems/RenderSystem";
import type { RunLogService } from "../logging/RunLogService";

export interface RuntimeEventNodeState {
  eventDef: RandomEventDef;
  position: { x: number; y: number };
  marker: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  resolved: boolean;
}

interface RuntimeEventContentLocalizer {
  eventName(eventId: string, fallback: string): string;
  eventChoiceName(eventId: string, choiceId: string, fallback: string): string;
  itemName(itemDefId: string, fallback: string): string;
}

interface RuntimeEventRunLog {
  append(message: string, level: string, timestampMs: number): void;
  appendKey(key: string, params: Record<string, unknown> | undefined, level: string, timestampMs: number): void;
}

interface RuntimeEventUiManager {
  showEventDialog(
    eventDef: RandomEventDef,
    choices: Array<{
      choice: RandomEventDef["choices"][number];
      enabled: boolean;
      disabledReason?: string;
    }>,
    onSelect: (choiceId: string) => void,
    onClose: () => void
  ): void;
  showMerchantDialog(
    view: Array<Record<string, unknown>>,
    onSelect: (offerId: string) => void,
    onClose: () => void
  ): void;
  hideEventPanel(): void;
}

interface RuntimeEventModulePort {
  openEventPanel(nowMs: number): void;
  consumeCurrentEvent(): void;
}

interface RuntimeEventRenderSystem {
  spawnTelegraphCircle(
    position: { x: number; y: number },
    radius: number,
    origin: { x: number; y: number }
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
}

interface RuntimeRngPort {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: T[]): T;
}

interface RuntimeDeferredOutcomePort {
  enqueue(
    outcome: {
      source: "event" | "merchant";
      trigger: NonNullable<DeferredOutcomeState["trigger"]>;
      reward: NonNullable<DeferredOutcomeState["reward"]>;
    },
    nowMs: number
  ): void;
}

export interface RuntimeEventHost {
  eventNode: RuntimeEventNodeState | null;
  floorConfig: {
    isBossFloor: boolean;
  };
  eventRng: {
    next(): number;
    nextInt(min: number, max: number): number;
    pick<T>(items: T[]): T;
  };
  merchantRng: {
    next(): number;
    nextInt(min: number, max: number): number;
    pick<T>(items: T[]): T;
  };
  lootRng: {
    next(): number;
    nextInt(min: number, max: number): number;
    pick<T>(items: T[]): T;
  };
  run: RunState;
  currentBiome: {
    id: BiomeId;
    lootBias?: RollItemDropOptions["slotWeightMultiplier"];
  };
  unlockedEventIds: string[];
  dungeon: DungeonLayout;
  staircaseState: StaircaseState;
  hazards: HazardRuntimeState[];
  renderSystem: RuntimeEventRenderSystem;
  origin: { x: number; y: number };
  contentLocalizer: RuntimeEventContentLocalizer;
  eventBus: TypedEventBus<GameEventMap>;
  eventPanelOpen: boolean;
  player: PlayerState;
  uiManager: RuntimeEventUiManager;
  runLog: RuntimeEventRunLog;
  time: { now: number };
  hudDirty: boolean;
  tryDiscoverBlueprints(sourceType: "random_event", nowMs: number, sourceId?: string): void;
  routeFeedback(input: { type: string; [key: string]: unknown }): void;
  flushRunSave(): void;
  runCompletionModule: {
    finishRun(isVictory: boolean): void;
  };
  merchantOffers: MerchantOffer[];
  isItemDefUnlocked(itemDef: ItemDef): boolean;
  markHighValueChoice(source: string, nowMs: number): void;
  resolveLootRollOptions(options: RollItemDropOptions): RollItemDropOptions;
  eventRuntimeModule: RuntimeEventModulePort;
  mapRevealActive: boolean;
  consumables: ConsumableState;
  deferredOutcomeRuntime: RuntimeDeferredOutcomePort;
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
  handleLevelUpGain(levelsGained: number, nowMs: number, source: string): void;
  lastDeathReason: string;
  recordAcquiredItemTelemetry?(item: ItemInstance, source: string, nowMs: number, baselinePlayer?: PlayerState): void;
}

interface HazardRuntimeEntityPort {
  listLivingMonsters(): MonsterRuntime[];
  removeMonsterById(id: string): MonsterRuntime | null;
}

interface HazardRuntimeRenderPort {
  spawnTelegraphCircle(
    position: { x: number; y: number },
    radius: number,
    origin: { x: number; y: number }
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
}

export interface HazardRuntimeHost {
  hazardVisuals: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse>;
  hazards: HazardRuntimeState[];
  playerHazardContact: Map<string, boolean>;
  floorConfig: Pick<FloorConfig, "isBossFloor">;
  currentBiome: Pick<BiomeDef, "hazardPool">;
  run: RunState;
  hazardRng: Pick<RuntimeRngPort, "pick" | "nextInt">;
  dungeon: Pick<DungeonLayout, "spawnPoints">;
  player: PlayerState;
  renderSystem: HazardRuntimeRenderPort;
  origin: WorldBoundsConfig["origin"];
  eventBus: TypedEventBus<GameEventMap>;
  entityManager: HazardRuntimeEntityPort;
  progressionRuntimeModule: {
    onMonsterDefeated(monsterState: MonsterState, nowMs: number): void;
  };
  tryDiscoverBlueprints(sourceType: "monster_affix", nowMs: number, sourceId?: string): void;
  applyOnKillMutationEffects(nowMs: number): void;
  resolveMutationDropBonus(): {
    obolMultiplier: number;
    soulShardMultiplier: number;
  };
  lastDeathReason: string;
  hudDirty: boolean;
}

interface ProgressionRuntimeUiManager extends Pick<RuntimeEventUiManager, "hideEventPanel" | "showEventDialog"> {
  configureMinimap(layout: {
    width: number;
    height: number;
    walkable: boolean[][];
    layoutHash: string;
  }): void;
  resetMinimap(): void;
}

interface ProgressionRuntimeEntityPort {
  clear(): void;
  removeMonsterById(id: string): MonsterRuntime | null;
  listMonsters(): MonsterRuntime[];
  rebuildMonsterSpatialIndex(): void;
  setStaircase(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null): void;
  setStaircases(sprites: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse>): void;
}

interface ProgressionRuntimeRenderPort {
  computeWorldBounds(dungeon: DungeonLayout): WorldBoundsConfig;
  drawDungeon(
    dungeon: DungeonLayout,
    origin: WorldBoundsConfig["origin"],
    tintOrOptions?: number | { tileKey?: string; tintColor?: number }
  ): void;
  spawnPlayer(position: { x: number; y: number }, origin: WorldBoundsConfig["origin"]): {
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    yOffset: number;
  };
  spawnMonster(
    state: MonsterState,
    archetype: MonsterArchetypeDef,
    origin: WorldBoundsConfig["origin"]
  ): MonsterRuntime;
  spawnStaircase(
    position: { x: number; y: number },
    origin: WorldBoundsConfig["origin"]
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  spawnTelegraphCircle(
    position: { x: number; y: number },
    radius: number,
    origin: WorldBoundsConfig["origin"]
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  configureCamera(
    camera: Phaser.Cameras.Scene2D.Camera,
    worldBounds: WorldBoundsConfig["worldBounds"],
    follow: Phaser.GameObjects.GameObject
  ): void;
}

export interface ProgressionRuntimeHost {
  children: {
    removeAll(destroyChildren?: boolean): void;
  };
  entityManager: ProgressionRuntimeEntityPort;
  hazardRuntimeModule: {
    clearHazards(): void;
    initializeHazards(nowMs: number): void;
  };
  movementSystem: {
    clearPathCache(): void;
  };
  floorConfig: FloorConfig;
  configureRngStreams(floor: number): void;
  run: RunState;
  runSeed: string;
  unlockedBiomeIds: Set<string>;
  currentBiome: BiomeDef;
  mapRevealActive: boolean;
  eventPanelOpen: boolean;
  merchantOffers: MerchantOffer[];
  uiManager: ProgressionRuntimeUiManager;
  eventRuntimeModule: {
    destroyEventNode(): void;
    setupFloorEvent(nowMs: number): void;
    consumeCurrentEvent(): void;
  };
  dungeon: DungeonLayout;
  player: PlayerState;
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
  applyDailyLoadout(player: PlayerState, nowMs: number): PlayerState;
  time: { now: number };
  debugCheatsEnabled: boolean;
  debugLockedEquipQuery: string;
  debugLockedEquipIconId: string;
  runLog: RunLogService;
  entityLabelById: Map<string, string>;
  path: Array<{ x: number; y: number }>;
  attackTargetId: string | null;
  manualMoveTarget: { x: number; y: number } | null;
  manualMoveTargetFailures: number;
  nextManualPathReplanAt: number;
  nextPlayerAttackAt: number;
  nextBossAttackAt: number;
  bossState: BossRuntimeState | null;
  bossSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null;
  staircaseState: StaircaseState;
  renderSystem: ProgressionRuntimeRenderPort;
  origin: WorldBoundsConfig["origin"];
  worldBounds: WorldBoundsConfig["worldBounds"];
  cameras: {
    main: Phaser.Cameras.Scene2D.Camera;
  };
  playerSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  playerYOffset: number;
  bossRuntimeModule: {
    spawn(): void;
  };
  spawnMonsters(): void;
  resetFloorChoiceBudget(floor: number, nowMs: number): void;
  lastMinimapRefreshAt: number;
  updateMinimap(nowMs: number): void;
  refreshSynergyRuntime(persistDiscovery?: boolean): void;
  hudDirty: boolean;
  runEnded: boolean;
  talentEffects: TalentEffectTotals;
  meta: MetaProgression;
  lootRng: RuntimeRngPort;
  spawnRng: RuntimeRngPort;
  eventRng: RuntimeRngPort;
  unlockedAffixIds: MonsterAffixId[];
  hiddenEntranceMarkers: Map<string, Phaser.GameObjects.Ellipse>;
  resolveProgressionLootTable(floor: number): LootTableDef | undefined;
  resolveLootRollOptions(options: RollItemDropOptions): RollItemDropOptions;
  isItemDefUnlocked(itemDef: ItemDef): boolean;
  spawnLootDrop(item: ItemInstance, position: { x: number; y: number }, source?: string): void;
  tryDiscoverBlueprints(
    sourceType: "challenge_room" | "hidden_room",
    nowMs: number,
    sourceId?: string
  ): void;
  scheduleRunSave(): void;
  resolveHiddenRoomRevealRadius(): number;
  challengeMarker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null;
  challengeRoomState: ChallengeRoomState | null;
  challengeWaveTotal: number;
  challengeMonsterIds: Set<string>;
  eventBus: TypedEventBus<GameEventMap>;
  add: Pick<Phaser.GameObjects.GameObjectFactory, "ellipse">;
  tileWidth: number;
  tileHeight: number;
  entityDepthOffset: number;
}

interface DeferredOutcomeContentLocalizer {
  itemName(itemDefId: string, fallback: string): string;
}

export interface DeferredOutcomeHost {
  eventRng?: {
    getCursor?(): number;
  };
  run: RunState;
  deferredOutcomes: DeferredOutcomeState[];
  runLog: Pick<RunLogService, "append">;
  scheduleRunSave(): void;
  hudDirty: boolean;
  player: PlayerState;
  lootRng: RuntimeRngPort;
  resolveLootRollOptions(options: RollItemDropOptions): RollItemDropOptions;
  isItemDefUnlocked(itemDef: ItemDef): boolean;
  contentLocalizer: DeferredOutcomeContentLocalizer;
}

export type MerchantPurchaseResult =
  | { kind: "missing_offer" }
  | { kind: "insufficient_obol" }
  | { kind: "delivery_failed" }
  | { kind: "sold_out" }
  | { kind: "remaining_offers" };
