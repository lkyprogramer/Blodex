import type Phaser from "phaser";
import type {
  ChallengeRoomState,
  ConsumableState,
  DungeonLayout,
  GameEventMap,
  ItemDef,
  ItemInstance,
  MonsterState,
  PlayerState,
  RandomEventDef,
  RollItemDropOptions,
  RunState,
  StaircaseState,
  TypedEventBus
} from "@blodex/core";
import type { BiomeDef, FloorConfig } from "@blodex/content";
import type { EntityManager } from "../../../systems/EntityManager";
import type { RenderSystem } from "../../../systems/RenderSystem";
import type { UIManager } from "../../../ui/UIManager";
import type { RunLogService } from "../logging/RunLogService";

export interface DebugCommandHost {
  collectDiagnosticsSnapshot(): Record<string, unknown>;
  entityManager: Pick<EntityManager, "getDiagnostics" | "listLivingMonsters" | "removeMonsterById">;
  eventBus: Pick<TypedEventBus<GameEventMap>, "listenerCount" | "emit">;
  bootstrapRun(runSeed: string, difficulty: RunState["difficulty"]): void;
  time: { now: number };
  selectedDifficulty: RunState["difficulty"];
  hudDirty: boolean;
  runEnded: boolean;
  run: RunState;
  runSeed: string;
  consumables: ConsumableState;
  floorConfig: FloorConfig;
  eventPanelOpen: boolean;
  eventRuntimeModule: {
    consumeCurrentEvent(): void;
    createEventNode(eventDef: RandomEventDef, position: { x: number; y: number }, nowMs: number): void;
    openEventPanel(nowMs: number): void;
    openMerchantPanel(nowMs: number): void;
  };
  pickFloorEventPosition(): { x: number; y: number } | null;
  dungeon: DungeonLayout;
  eventRng: {
    next(): number;
    nextInt(min: number, max: number): number;
    pick<T>(items: T[]): T;
  };
  progressionRuntimeModule: {
    removeChallengeMonsters(): void;
    clearChallengeState(): void;
    resolveChallengeWaveTotal(roomId: string): number;
    challengeRoomCenter(roomId: string): { x: number; y: number } | null;
    startChallengeEncounter(nowMs: number): void;
    finishChallengeEncounter(success: boolean, nowMs: number): void;
    onMonsterDefeated(monsterState: MonsterState, nowMs: number): void;
    renderStaircases(): void;
    setupFloor(floor: number, initial: boolean): void;
  };
  challengeRoomState: ChallengeRoomState | null;
  challengeWaveTotal: number;
  challengeMarker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null;
  renderSystem: Pick<RenderSystem, "spawnTelegraphCircle">;
  origin: { x: number; y: number };
  scheduleRunSave(): void;
  flushRunSave(): void;
  bossState: { health: number } | null;
  bossRuntimeModule: {
    openVictoryChoice(nowMs: number): void;
  };
  runCompletionModule: {
    enterAbyss(nowMs: number): void;
    finishRun(isVictory: boolean): void;
  };
  getRunRelativeNowMs(): number;
  syncEndlessMutators(nowMs: number): void;
  deferredOutcomeRuntime: {
    settle(triggerType: "floor_reached" | "boss_kill" | "run_end", nowMs: number): void;
  };
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
  player: PlayerState;
  handleLevelUpGain(levelsGained: number, nowMs: number, source: string): void;
  lootRng: {
    next(): number;
    nextInt(min: number, max: number): number;
    pick<T>(items: T[]): T;
  };
  resolveLootRollOptions(options: RollItemDropOptions): RollItemDropOptions;
  isItemDefUnlocked(itemDef: ItemDef): boolean;
  spawnLootDrop(item: ItemInstance, position: { x: number; y: number }, source?: string): void;
  staircaseState: StaircaseState;
  tryDiscoverBlueprints(
    sourceType: "floor_clear" | "monster_affix",
    nowMs: number,
    sourceId?: string
  ): void;
  uiManager: Pick<UIManager, "clearSummary" | "hideDeathOverlay">;
  lastDeathReason: string;
  synergyRuntime: {
    activeSynergyIds: string[];
  };
  refreshSynergyRuntime(): void;
  currentBiome: Pick<BiomeDef, "id">;
  runLog: RunLogService;
}
