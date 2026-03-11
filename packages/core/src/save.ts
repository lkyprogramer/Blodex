import type {
  BossRuntimeState,
  ConsumableState,
  DeferredOutcomeState,
  DodgeDirectionSource,
  DodgeResult,
  DungeonLayout,
  HazardRuntimeState,
  ItemInstance,
  MerchantOffer,
  MonsterState,
  Phase6TelemetryRuntimeState,
  PlayerState,
  RunRngStreamName,
  StaircaseState
} from "./contracts/types";
import type { RunState } from "./run";
import {
  DEFAULT_STORY_MAX_FLOOR,
  resolveStoryPowerSpikePairIds,
  type StoryPowerSpikePairId
} from "./storyRun";

export const RUN_SAVE_STORAGE_KEY_V3 = "blodex_run_save_v3";
export const RUN_SAVE_STORAGE_KEY = RUN_SAVE_STORAGE_KEY_V3;
export const RUN_SAVE_STORAGE_KEYS = [RUN_SAVE_STORAGE_KEY_V3] as const;

const RUN_RNG_STREAM_NAMES: RunRngStreamName[] = [
  "procgen",
  "spawn",
  "combat",
  "loot",
  "skill",
  "boss",
  "biome",
  "hazard",
  "event",
  "merchant"
];
const CONSUMABLE_IDS = [
  "health_potion",
  "mana_potion",
  "scroll_of_mapping",
  "scroll_of_mapping_plus",
  "frenzy_tonic",
  "phantom_brew"
] as const;

const EQUIPMENT_SLOTS = ["weapon", "helm", "chest", "boots", "ring"] as const;
const ITEM_RARITIES = ["common", "magic", "rare"] as const;
const ITEM_KINDS = ["equipment", "consumable", "unique"] as const;
const WEAPON_TYPES = ["sword", "axe", "dagger", "staff", "hammer", "sword_master"] as const;
const DAMAGE_TYPES = ["physical", "arcane", "fire", "cold", "lightning"] as const;
const BOSS_AI_STATES = ["idle", "telegraph", "attacking", "summoning", "dead"] as const;
const MONSTER_AI_STATES = ["idle", "chase", "kite", "ambush", "swarm", "shield", "support", "attack", "dead"] as const;
const MONSTER_AI_BEHAVIORS = ["chase", "kite", "ambush", "swarm", "shield", "support"] as const;
const MONSTER_AFFIX_IDS = ["frenzied", "armored", "vampiric", "splitting", "hulking", "warded", "skirmisher", "manaburn"] as const;

export interface PersistedBuffState {
  defId: string;
  sourceId: string;
  targetId: string;
  remainingMs: number;
}

export interface PersistentPlayerState extends Omit<PlayerState, "activeBuffs"> {
  activeBuffs?: PersistedBuffState[];
}

export interface PersistentMonsterState extends Omit<MonsterState, "activeBuffs"> {
  activeBuffs?: PersistedBuffState[];
}

export interface RuntimeMonsterState {
  state: PersistentMonsterState;
  baseMoveSpeed?: number;
  nextAttackAt: number;
  nextSupportAt: number;
}

export interface RuntimeEventNodeState {
  eventId: string;
  position: { x: number; y: number };
  resolved: boolean;
  merchantOffers?: MerchantOffer[];
}

export interface PersistedDodgeRuntimeState {
  cooldownRemainingMs: number;
  autoTargetSuppressed: boolean;
  lastDirection?: { x: number; y: number };
  lastDirectionSource?: DodgeDirectionSource;
  lastResult?: DodgeResult;
}

export interface MinimapSnapshot {
  layoutHash: string;
  exploredKeys: number[];
}

export interface SaveLease {
  tabId: string;
  leaseUntilMs: number;
  renewedAtMs: number;
}

export interface FloorChoiceBudgetState {
  floor: number;
  satisfied: boolean;
  source?: string;
}

export interface ProgressionPromptState {
  nextPromptDelayMs: number;
  pendingLevelUpSkillOfferIds: string[];
}

export type PowerSpikePairId = StoryPowerSpikePairId;

export interface PowerSpikePairBudgetState {
  hitCount: number;
  majorHitCount: number;
  satisfied: boolean;
  fallbackGranted: boolean;
}

export interface PowerSpikeBudgetRuntimeState {
  pairStates: Record<PowerSpikePairId, PowerSpikePairBudgetState>;
  acceptedSpikeCount: number;
  majorSpikeCount: number;
}

export type ComparePromptSource =
  | "auto_pickup"
  | "merchant_purchase"
  | "event_reward"
  | "boss_reward"
  | "challenge_reward"
  | "hidden_room_reward"
  | "pair_fallback";

export interface ComparePromptEntryState {
  itemId: string;
  source: ComparePromptSource;
}

export interface ComparePromptRuntimeState {
  active?: ComparePromptEntryState;
  immediate: ComparePromptEntryState[];
  deferred: ComparePromptEntryState[];
  drainMode: "all" | "immediate";
}

export interface RunSaveDomainState {
  run: RunState;
  player: PersistentPlayerState;
  consumables: ConsumableState;
  blueprintFoundIdsInRun: string[];
  selectedMutationIds: string[];
}

export interface RunSaveRuntimeState {
  dungeon: DungeonLayout;
  staircase: StaircaseState;
  hazards: HazardRuntimeState[];
  dodge?: PersistedDodgeRuntimeState;
  bossEncounterId?: string | null;
  boss: BossRuntimeState | null;
  monsters: RuntimeMonsterState[];
  lootOnGround: Array<{ item: ItemInstance; position: { x: number; y: number } }>;
  eventNode: RuntimeEventNodeState | null;
  minimap: MinimapSnapshot;
  mapRevealActive: boolean;
  deferredOutcomes: DeferredOutcomeState[];
  floorChoiceBudget?: FloorChoiceBudgetState;
  powerSpikeBudgetState?: PowerSpikeBudgetRuntimeState;
  phase6TelemetryState?: Phase6TelemetryRuntimeState;
  rngCursor: Record<RunRngStreamName, number>;
}

export interface RunSaveSessionState {
  progressionPromptState?: ProgressionPromptState;
  comparePromptState?: ComparePromptRuntimeState;
  lease?: SaveLease;
}

export interface RunSaveDataV3 {
  schemaVersion: 3;
  savedAtMs: number;
  appVersion: string;
  runId: string;
  runSeed: string;
  domain: RunSaveDomainState;
  runtime: RunSaveRuntimeState;
  session: RunSaveSessionState;
}

export type RunSaveEnvelope = RunSaveDataV3 & Record<string, unknown>;

export interface DeserializeRunStateResult {
  save: RunSaveEnvelope | null;
  sourceVersion: 3 | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isRunRngCursor(value: unknown): value is Record<RunRngStreamName, number> {
  if (!isRecord(value)) {
    return false;
  }
  for (const stream of RUN_RNG_STREAM_NAMES) {
    if (!isFiniteNumber(value[stream])) {
      return false;
    }
  }
  return true;
}

function isSaveLease(value: unknown): value is SaveLease {
  return (
    isRecord(value) &&
    typeof value.tabId === "string" &&
    isFiniteNumber(value.leaseUntilMs) &&
    isFiniteNumber(value.renewedAtMs)
  );
}

function isFloorChoiceBudgetState(value: unknown): value is FloorChoiceBudgetState {
  return (
    isRecord(value) &&
    isFiniteNumber(value.floor) &&
    typeof value.satisfied === "boolean" &&
    (value.source === undefined || typeof value.source === "string")
  );
}

function isProgressionPromptState(value: unknown): value is ProgressionPromptState {
  return (
    isRecord(value) &&
    isFiniteNumber(value.nextPromptDelayMs) &&
    isStringArray(value.pendingLevelUpSkillOfferIds)
  );
}

function isPowerSpikePairBudgetState(value: unknown): value is PowerSpikePairBudgetState {
  return (
    isRecord(value) &&
    isFiniteNumber(value.hitCount) &&
    isFiniteNumber(value.majorHitCount) &&
    typeof value.satisfied === "boolean" &&
    typeof value.fallbackGranted === "boolean"
  );
}

function isPowerSpikeBudgetRuntimeState(value: unknown): value is PowerSpikeBudgetRuntimeState {
  if (!isRecord(value) || !isRecord(value.pairStates)) {
    return false;
  }
  const requiredPairIds = resolveStoryPowerSpikePairIds(DEFAULT_STORY_MAX_FLOOR);
  const statePairIds = Object.keys(value.pairStates);
  if (
    statePairIds.length !== requiredPairIds.length ||
    requiredPairIds.some((pairId) => !isPowerSpikePairBudgetState((value.pairStates as Record<string, unknown>)[pairId]))
  ) {
    return false;
  }
  return isFiniteNumber(value.acceptedSpikeCount) && isFiniteNumber(value.majorSpikeCount);
}

function normalizeLegacyPowerSpikeBudgetState(value: unknown): void {
  if (!isRecord(value) || !isRecord(value.pairStates)) {
    return;
  }
  const pairStates = value.pairStates as Record<string, unknown>;
  const legacyLatePair = pairStates["5"];
  if (!isPowerSpikePairBudgetState(legacyLatePair)) {
    return;
  }
  if (pairStates["5-6"] === undefined) {
    pairStates["5-6"] = { ...legacyLatePair };
  }
  if (pairStates["7-8"] === undefined) {
    pairStates["7-8"] = { ...legacyLatePair };
  }
  delete pairStates["5"];
}

function normalizeLegacyV3DraftFields(raw: Record<string, unknown>): void {
  if (raw.schemaVersion !== 3 || !isRecord(raw.runtime)) {
    return;
  }
  normalizeLegacyPowerSpikeBudgetState(raw.runtime.powerSpikeBudgetState);
}

function isStringNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => isFiniteNumber(entry));
}

function isConsumableCountRecord(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return CONSUMABLE_IDS.every((consumableId) => isFiniteNumber(value[consumableId]));
}

function isConsumableState(value: unknown): value is ConsumableState {
  return (
    isRecord(value) &&
    isConsumableCountRecord(value.charges) &&
    isConsumableCountRecord(value.cooldowns)
  );
}

function isKnownStringLiteral<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isBaseStats(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.strength) &&
    isFiniteNumber(value.dexterity) &&
    isFiniteNumber(value.vitality) &&
    isFiniteNumber(value.intelligence)
  );
}

function isDerivedStats(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.maxHealth) &&
    isFiniteNumber(value.maxMana) &&
    isFiniteNumber(value.armor) &&
    isFiniteNumber(value.attackPower) &&
    isFiniteNumber(value.critChance) &&
    isFiniteNumber(value.attackSpeed) &&
    isFiniteNumber(value.moveSpeed)
  );
}

function isDamageProfile(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).every(
    ([key, entry]) => isKnownStringLiteral(key, DAMAGE_TYPES) && isFiniteNumber(entry)
  );
}

function isFiniteNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => isFiniteNumber(entry));
}

function isItemInstance(value: unknown): value is ItemInstance {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.defId === "string" &&
    typeof value.name === "string" &&
    isKnownStringLiteral(value.slot, EQUIPMENT_SLOTS) &&
    (value.kind === undefined || isKnownStringLiteral(value.kind, ITEM_KINDS)) &&
    (value.setId === undefined || typeof value.setId === "string") &&
    (value.weaponType === undefined || isKnownStringLiteral(value.weaponType, WEAPON_TYPES)) &&
    isKnownStringLiteral(value.rarity, ITEM_RARITIES) &&
    isFiniteNumber(value.requiredLevel) &&
    typeof value.iconId === "string" &&
    typeof value.seed === "string" &&
    isStringNumberRecord(value.rolledAffixes) &&
    (value.rolledSpecialAffixes === undefined || isStringNumberRecord(value.rolledSpecialAffixes))
  );
}

function isEquipmentRecord(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).every(
    ([key, entry]) => isKnownStringLiteral(key, EQUIPMENT_SLOTS) && (entry === undefined || isItemInstance(entry))
  );
}

function isSkillInstance(value: unknown): boolean {
  return isRecord(value) && typeof value.defId === "string" && isFiniteNumber(value.level);
}

function isPlayerSkillState(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.skillSlots) &&
    value.skillSlots.every((entry) => entry === null || isSkillInstance(entry)) &&
    isStringNumberRecord(value.cooldowns)
  );
}

function isPhase6TelemetryRuntimeState(value: unknown): value is Phase6TelemetryRuntimeState {
  if (!isRecord(value)) {
    return false;
  }
  if (!isFiniteNumber(value.startedAtMs) || typeof value.buildFormedState !== "boolean") {
    return false;
  }
  if (!Array.isArray(value.inputTimestampsMs) || !value.inputTimestampsMs.every((entry) => isFiniteNumber(entry))) {
    return false;
  }
  if (!isRecord(value.story) || !isRecord(value.combat) || !isRecord(value.runtimeEffects)) {
    return false;
  }
  return (
    isFiniteNumber(value.story.playerFacingChoices) &&
    isStringNumberRecord(value.story.choiceCountByFloor) &&
    isFiniteNumber(value.story.powerSpikes) &&
    isFiniteNumber(value.story.majorPowerSpikes) &&
    isFiniteNumber(value.story.buildFormed) &&
    isFiniteNumber(value.story.rareDropsPresented) &&
    isFiniteNumber(value.story.bossRewardClosed) &&
    isFiniteNumber(value.combat.skillUses) &&
    isFiniteNumber(value.combat.skillCastsPer30s) &&
    isFiniteNumber(value.combat.skillDamage) &&
    isFiniteNumber(value.combat.autoAttackDamage) &&
    isFiniteNumber(value.combat.skillDamageShare) &&
    isFiniteNumber(value.combat.autoAttackDamageShare) &&
    isFiniteNumber(value.combat.manaDryWindowMs) &&
    isFiniteNumber(value.combat.averageNoInputGapMs) &&
    isFiniteNumber(value.combat.maxNoInputGapMs) &&
    isStringNumberRecord(value.runtimeEffects.buffApplyCountById) &&
    isStringNumberRecord(value.runtimeEffects.buffUptimeMsById) &&
    isStringNumberRecord(value.runtimeEffects.damageDealtByType) &&
    isStringNumberRecord(value.runtimeEffects.damageTakenByType) &&
    isStringNumberRecord(value.runtimeEffects.resolvedHitCountByType) &&
    isStringNumberRecord(value.runtimeEffects.synergyActivationCountById) &&
    isStringNumberRecord(value.runtimeEffects.synergyFirstActivatedFloorById)
  );
}

function isPersistedBuffState(value: unknown): value is PersistedBuffState {
  return (
    isRecord(value) &&
    typeof value.defId === "string" &&
    typeof value.sourceId === "string" &&
    typeof value.targetId === "string" &&
    isFiniteNumber(value.remainingMs) &&
    value.remainingMs >= 0
  );
}

function isPersistedBuffStateArray(value: unknown): value is PersistedBuffState[] {
  return Array.isArray(value) && value.every((entry) => isPersistedBuffState(entry));
}

function isPersistentPlayerState(value: unknown): value is PersistentPlayerState {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isPoint(value.position) &&
    isFiniteNumber(value.level) &&
    isFiniteNumber(value.xp) &&
    isFiniteNumber(value.xpToNextLevel) &&
    (value.pendingLevelUpChoices === undefined || isFiniteNumber(value.pendingLevelUpChoices)) &&
    (value.pendingSkillChoices === undefined || isFiniteNumber(value.pendingSkillChoices)) &&
    isFiniteNumber(value.health) &&
    isFiniteNumber(value.mana) &&
    isBaseStats(value.baseStats) &&
    isDerivedStats(value.derivedStats) &&
    Array.isArray(value.inventory) &&
    value.inventory.every((entry) => isItemInstance(entry)) &&
    isEquipmentRecord(value.equipment) &&
    isFiniteNumber(value.gold) &&
    (value.skills === undefined || isPlayerSkillState(value.skills)) &&
    (value.activeBuffs === undefined || isPersistedBuffStateArray(value.activeBuffs))
  );
}

function isPersistentMonsterState(value: unknown): value is PersistentMonsterState {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.archetypeId === "string" &&
    (value.enemyProfileId === undefined || typeof value.enemyProfileId === "string") &&
    (value.damageProfile === undefined || isDamageProfile(value.damageProfile)) &&
    isFiniteNumber(value.level) &&
    isFiniteNumber(value.health) &&
    isFiniteNumber(value.maxHealth) &&
    isFiniteNumber(value.damage) &&
    isFiniteNumber(value.attackRange) &&
    isFiniteNumber(value.moveSpeed) &&
    isFiniteNumber(value.xpValue) &&
    typeof value.dropTableId === "string" &&
    isPoint(value.position) &&
    isKnownStringLiteral(value.aiState, MONSTER_AI_STATES) &&
    (value.aiBehavior === undefined || isKnownStringLiteral(value.aiBehavior, MONSTER_AI_BEHAVIORS)) &&
    (value.affixes === undefined ||
      (Array.isArray(value.affixes) && value.affixes.every((entry) => isKnownStringLiteral(entry, MONSTER_AFFIX_IDS)))) &&
    (value.isBoss === undefined || typeof value.isBoss === "boolean") &&
    (value.activeBuffs === undefined || isPersistedBuffStateArray(value.activeBuffs))
  );
}

function isRuntimeMonsterState(value: unknown): value is RuntimeMonsterState {
  return (
    isRecord(value) &&
    isPersistentMonsterState(value.state) &&
    isFiniteNumber(value.nextAttackAt) &&
    isFiniteNumber(value.nextSupportAt) &&
    (value.baseMoveSpeed === undefined || isFiniteNumber(value.baseMoveSpeed))
  );
}

function isBossRuntimeState(value: unknown): value is BossRuntimeState {
  return (
    isRecord(value) &&
    typeof value.bossId === "string" &&
    (value.enemyProfileId === undefined || typeof value.enemyProfileId === "string") &&
    (value.damageProfile === undefined || isDamageProfile(value.damageProfile)) &&
    isFiniteNumber(value.currentPhaseIndex) &&
    isFiniteNumber(value.health) &&
    isFiniteNumber(value.maxHealth) &&
    isFiniteNumberRecord(value.attackCooldowns) &&
    isPoint(value.position) &&
    isKnownStringLiteral(value.aiState, BOSS_AI_STATES) &&
    (value.telegraphTarget === undefined || isPoint(value.telegraphTarget)) &&
    (value.telegraphEndMs === undefined || isFiniteNumber(value.telegraphEndMs)) &&
    (value.telegraphAttackId === undefined || typeof value.telegraphAttackId === "string") &&
    (value.enrageAtMs === undefined || isFiniteNumber(value.enrageAtMs))
  );
}

function isRuntimeEventNodeState(value: unknown): value is RuntimeEventNodeState {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.eventId !== "string") {
    return false;
  }
  if (!isPoint(value.position)) {
    return false;
  }
  if (typeof value.resolved !== "boolean") {
    return false;
  }
  if (value.merchantOffers !== undefined && !Array.isArray(value.merchantOffers)) {
    return false;
  }
  return true;
}

function isMinimapSnapshot(value: unknown): value is MinimapSnapshot {
  return (
    isRecord(value) &&
    typeof value.layoutHash === "string" &&
    Array.isArray(value.exploredKeys) &&
    value.exploredKeys.every((entry) => isFiniteNumber(entry))
  );
}

function isDodgeDirectionSource(value: unknown): value is DodgeDirectionSource {
  return value === "move_vector" || value === "cursor" || value === "facing";
}

function isDodgeResult(value: unknown): value is DodgeResult {
  return value === "attempt" || value === "blocked" || value === "success" || value === "evade_success";
}

function isPersistedDodgeRuntimeState(value: unknown): value is PersistedDodgeRuntimeState {
  return (
    isRecord(value) &&
    isFiniteNumber(value.cooldownRemainingMs) &&
    value.cooldownRemainingMs >= 0 &&
    typeof value.autoTargetSuppressed === "boolean" &&
    (value.lastDirection === undefined || isPoint(value.lastDirection)) &&
    (value.lastDirectionSource === undefined || isDodgeDirectionSource(value.lastDirectionSource)) &&
    (value.lastResult === undefined || isDodgeResult(value.lastResult))
  );
}

function isLootEntry(value: unknown): value is { item: ItemInstance; position: { x: number; y: number } } {
  return isRecord(value) && isRecord(value.item) && isPoint(value.position);
}

function isHiddenRoomState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.roomId === "string" &&
    isPoint(value.entrance) &&
    typeof value.revealed === "boolean" &&
    typeof value.rewardsClaimed === "boolean"
  );
}

function isDungeonLayoutSnapshot(value: unknown): value is DungeonLayout {
  if (!isRecord(value)) {
    return false;
  }
  if (value.hiddenRooms !== undefined) {
    if (!Array.isArray(value.hiddenRooms)) {
      return false;
    }
    if (!value.hiddenRooms.every((entry) => isHiddenRoomState(entry))) {
      return false;
    }
  }
  return true;
}

function isBranchStairOption(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPoint(value.position) &&
    typeof value.targetBiome === "string" &&
    typeof value.label === "string"
  );
}

function isStaircaseState(value: unknown): value is StaircaseState {
  if (!isRecord(value) || !isPoint(value.position) || typeof value.visible !== "boolean") {
    return false;
  }
  if (value.kind === undefined || value.kind === "single") {
    return true;
  }
  if (value.kind !== "branch" || value.options === undefined || !Array.isArray(value.options) || value.options.length !== 2) {
    return false;
  }
  if (!value.options.every((option) => isBranchStairOption(option))) {
    return false;
  }
  if (value.selected !== undefined && value.selected !== "left" && value.selected !== "right") {
    return false;
  }
  return true;
}

function isDeferredOutcomeTrigger(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }
  if (value.type === "floor_reached") {
    return isFiniteNumber(value.value);
  }
  return value.type === "boss_kill" || value.type === "run_end";
}

function isDeferredOutcomeReward(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (value.obol !== undefined && !isFiniteNumber(value.obol)) {
    return false;
  }
  if (value.shard !== undefined && !isFiniteNumber(value.shard)) {
    return false;
  }
  if (value.itemDefId !== undefined && typeof value.itemDefId !== "string") {
    return false;
  }
  return true;
}

function isDeferredOutcomeState(value: unknown): value is DeferredOutcomeState {
  return (
    isRecord(value) &&
    typeof value.outcomeId === "string" &&
    (value.source === "event" || value.source === "merchant") &&
    isDeferredOutcomeTrigger(value.trigger) &&
    isDeferredOutcomeReward(value.reward) &&
    (value.status === "pending" || value.status === "settled")
  );
}

function isRunState(value: unknown): value is RunState {
  return (
    isRecord(value) &&
    isFiniteNumber(value.startedAtMs) &&
    typeof value.runSeed === "string" &&
    typeof value.difficulty === "string" &&
    isRecord(value.difficultyModifier) &&
    isFiniteNumber(value.currentFloor) &&
    typeof value.currentBiomeId === "string" &&
    isFiniteNumber(value.floor) &&
    isFiniteNumber(value.floorsCleared) &&
    isFiniteNumber(value.kills) &&
    isFiniteNumber(value.totalKills) &&
    isFiniteNumber(value.lootCollected) &&
    isFiniteNumber(value.challengeSuccessCount) &&
    typeof value.inEndless === "boolean" &&
    isFiniteNumber(value.endlessFloor) &&
    (value.endlessKills === undefined || isFiniteNumber(value.endlessKills)) &&
    (value.mutatorActiveIds === undefined || isStringArray(value.mutatorActiveIds)) &&
    (value.mutatorState === undefined || isRecord(value.mutatorState)) &&
    (value.deferredShardBonus === undefined || isFiniteNumber(value.deferredShardBonus)) &&
    (value.runMode === "normal" || value.runMode === "daily") &&
    isRecord(value.runEconomy)
  );
}

function isComparePromptEntryState(value: unknown): value is ComparePromptEntryState {
  return (
    isRecord(value) &&
    typeof value.itemId === "string" &&
    (
      value.source === "auto_pickup" ||
      value.source === "merchant_purchase" ||
      value.source === "event_reward" ||
      value.source === "boss_reward" ||
      value.source === "challenge_reward" ||
      value.source === "hidden_room_reward" ||
      value.source === "pair_fallback"
    )
  );
}

function isComparePromptRuntimeState(value: unknown): value is ComparePromptRuntimeState {
  return (
    isRecord(value) &&
    (value.active === undefined || isComparePromptEntryState(value.active)) &&
    Array.isArray(value.immediate) &&
    value.immediate.every((entry) => isComparePromptEntryState(entry)) &&
    Array.isArray(value.deferred) &&
    value.deferred.every((entry) => isComparePromptEntryState(entry)) &&
    (value.drainMode === "all" || value.drainMode === "immediate")
  );
}

function validateRuntimeState(runtime: Record<string, unknown>): boolean {
  if (!isDungeonLayoutSnapshot(runtime.dungeon) || !isStaircaseState(runtime.staircase)) {
    return false;
  }
  if (!Array.isArray(runtime.hazards) || !runtime.hazards.every((entry) => isRecord(entry))) {
    return false;
  }
  if (!(runtime.boss === null || isBossRuntimeState(runtime.boss))) {
    return false;
  }
  if (!(runtime.bossEncounterId === undefined || runtime.bossEncounterId === null || typeof runtime.bossEncounterId === "string")) {
    return false;
  }
  if (runtime.dodge !== undefined && !isPersistedDodgeRuntimeState(runtime.dodge)) {
    return false;
  }
  if (!Array.isArray(runtime.monsters) || !runtime.monsters.every((entry) => isRuntimeMonsterState(entry))) {
    return false;
  }
  if (!Array.isArray(runtime.lootOnGround) || !runtime.lootOnGround.every((entry) => isLootEntry(entry))) {
    return false;
  }
  if (!(runtime.eventNode === null || isRuntimeEventNodeState(runtime.eventNode))) {
    return false;
  }
  if (!isMinimapSnapshot(runtime.minimap)) {
    return false;
  }
  if (typeof runtime.mapRevealActive !== "boolean") {
    return false;
  }
  if (
    !Array.isArray(runtime.deferredOutcomes) ||
    !runtime.deferredOutcomes.every((entry) => isDeferredOutcomeState(entry))
  ) {
    return false;
  }
  if (runtime.floorChoiceBudget !== undefined && !isFloorChoiceBudgetState(runtime.floorChoiceBudget)) {
    return false;
  }
  if (runtime.powerSpikeBudgetState !== undefined && !isPowerSpikeBudgetRuntimeState(runtime.powerSpikeBudgetState)) {
    return false;
  }
  if (runtime.phase6TelemetryState !== undefined && !isPhase6TelemetryRuntimeState(runtime.phase6TelemetryState)) {
    return false;
  }
  if (!isRunRngCursor(runtime.rngCursor)) {
    return false;
  }
  return true;
}

function validateDomainState(domain: Record<string, unknown>): boolean {
  return (
    isRunState(domain.run) &&
    isPersistentPlayerState(domain.player) &&
    isConsumableState(domain.consumables) &&
    isStringArray(domain.blueprintFoundIdsInRun) &&
    isStringArray(domain.selectedMutationIds)
  );
}

function validateSessionState(session: Record<string, unknown>): boolean {
  return (
    (session.progressionPromptState === undefined || isProgressionPromptState(session.progressionPromptState)) &&
    (session.comparePromptState === undefined || isComparePromptRuntimeState(session.comparePromptState)) &&
    (session.lease === undefined || isSaveLease(session.lease))
  );
}

export function validateSave(raw: unknown): raw is RunSaveEnvelope {
  if (!isRecord(raw)) {
    return false;
  }
  normalizeLegacyV3DraftFields(raw);
  if (raw.schemaVersion !== 3) {
    return false;
  }
  if (!isFiniteNumber(raw.savedAtMs) || typeof raw.appVersion !== "string") {
    return false;
  }
  if (typeof raw.runId !== "string" || raw.runId.length === 0) {
    return false;
  }
  if (typeof raw.runSeed !== "string" || raw.runSeed.length === 0) {
    return false;
  }
  if (!isRecord(raw.domain) || !validateDomainState(raw.domain)) {
    return false;
  }
  if (!isRecord(raw.runtime) || !validateRuntimeState(raw.runtime)) {
    return false;
  }
  if (!isRecord(raw.session) || !validateSessionState(raw.session)) {
    return false;
  }
  return true;
}

export function deserializeRunStateResult(raw: string): DeserializeRunStateResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!validateSave(parsed)) {
      return {
        save: null,
        sourceVersion: null
      };
    }
    return {
      save: parsed,
      sourceVersion: 3
    };
  } catch {
    return {
      save: null,
      sourceVersion: null
    };
  }
}

export function serializeRunState(snapshot: RunSaveDataV3): string {
  if (!validateSave(snapshot)) {
    throw new Error("Invalid run save snapshot.");
  }
  return JSON.stringify(snapshot);
}

export function deserializeRunState(raw: string): RunSaveEnvelope | null {
  return deserializeRunStateResult(raw).save;
}
