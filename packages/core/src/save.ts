import type {
  BossRuntimeState,
  ConsumableState,
  DeferredOutcomeState,
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
import { createBranchStairOptions } from "./pathSelection";
import type { RunState } from "./run";

export const RUN_SAVE_STORAGE_KEY_V1 = "blodex_run_save_v1";
export const RUN_SAVE_STORAGE_KEY_V2 = "blodex_run_save_v2";
export const RUN_SAVE_STORAGE_KEY = RUN_SAVE_STORAGE_KEY_V2;
export const RUN_SAVE_STORAGE_KEYS = [RUN_SAVE_STORAGE_KEY_V2, RUN_SAVE_STORAGE_KEY_V1] as const;

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

type RunStateV1 = Omit<
  RunState,
  | "challengeSuccessCount"
  | "inEndless"
  | "endlessFloor"
  | "endlessKills"
  | "runMode"
  | "mutatorActiveIds"
  | "mutatorState"
  | "deferredShardBonus"
> &
  Partial<
    Pick<
      RunState,
      | "challengeSuccessCount"
      | "inEndless"
      | "endlessFloor"
      | "endlessKills"
      | "runMode"
      | "dailyDate"
      | "mutatorActiveIds"
      | "mutatorState"
      | "deferredShardBonus"
    >
  >;

export interface RuntimeMonsterState {
  state: MonsterState;
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

export type PowerSpikePairId = "1-2" | "3-4" | "5";

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

export interface RunSaveDataV1 {
  schemaVersion: 1;
  savedAtMs: number;
  appVersion: string;
  runId: string;
  runSeed: string;
  run: RunStateV1;
  player: PlayerState;
  consumables: ConsumableState;
  dungeon: DungeonLayout;
  staircase: StaircaseState;
  hazards: HazardRuntimeState[];
  boss: BossRuntimeState | null;
  monsters: RuntimeMonsterState[];
  lootOnGround: Array<{ item: ItemInstance; position: { x: number; y: number } }>;
  eventNode: RuntimeEventNodeState | null;
  minimap: MinimapSnapshot;
  mapRevealActive: boolean;
  rngCursor: Record<RunRngStreamName, number>;
  blueprintFoundIdsInRun?: string[];
  selectedMutationIds?: string[];
  lease?: SaveLease;
}

export interface RunSaveDataV2 extends Omit<RunSaveDataV1, "schemaVersion" | "run"> {
  schemaVersion: 2;
  runtimeNowMs?: number;
  run: RunState;
  staircase: StaircaseState;
  deferredOutcomes?: DeferredOutcomeState[];
  floorChoiceBudget?: FloorChoiceBudgetState;
  progressionPromptState?: ProgressionPromptState;
  powerSpikeBudgetState?: PowerSpikeBudgetRuntimeState;
  phase6TelemetryState?: Phase6TelemetryRuntimeState;
}

export type RunSaveEnvelope = RunSaveDataV2 & Record<string, unknown>;

export interface DeserializeRunStateResult {
  save: RunSaveEnvelope | null;
  sourceVersion: 1 | 2 | null;
  migratedFromV1: boolean;
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
  return (
    isPowerSpikePairBudgetState(value.pairStates["1-2"]) &&
    isPowerSpikePairBudgetState(value.pairStates["3-4"]) &&
    isPowerSpikePairBudgetState(value.pairStates["5"]) &&
    isFiniteNumber(value.acceptedSpikeCount) &&
    isFiniteNumber(value.majorSpikeCount)
  );
}

function isStringNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => isFiniteNumber(entry));
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

function isRuntimeMonsterState(value: unknown): value is RuntimeMonsterState {
  return (
    isRecord(value) &&
    isRecord(value.state) &&
    isFiniteNumber(value.nextAttackAt) &&
    isFiniteNumber(value.nextSupportAt) &&
    (value.baseMoveSpeed === undefined || isFiniteNumber(value.baseMoveSpeed))
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

function isStaircaseStateV1(value: unknown): value is StaircaseState {
  return isRecord(value) && isPoint(value.position) && typeof value.visible === "boolean";
}

function isStaircaseStateV2(value: unknown): value is StaircaseState {
  if (!isStaircaseStateV1(value)) {
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

function isMutatorState(value: unknown): value is Record<string, { activatedAtFloor: number; stacks?: number }> {
  if (!isRecord(value)) {
    return false;
  }
  for (const entry of Object.values(value)) {
    if (!isRecord(entry)) {
      return false;
    }
    if (!isFiniteNumber(entry.activatedAtFloor)) {
      return false;
    }
    if (entry.stacks !== undefined && !isFiniteNumber(entry.stacks)) {
      return false;
    }
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

function isRunStateV1(value: unknown): value is RunStateV1 {
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
    isRecord(value.runEconomy)
  );
}

function isRunStateV2(value: unknown): value is RunState {
  return (
    isRunStateV1(value) &&
    isFiniteNumber(value.challengeSuccessCount) &&
    typeof value.inEndless === "boolean" &&
    isFiniteNumber(value.endlessFloor) &&
    (value.endlessKills === undefined || isFiniteNumber(value.endlessKills)) &&
    (value.mutatorActiveIds === undefined || isStringArray(value.mutatorActiveIds)) &&
    (value.mutatorState === undefined || isMutatorState(value.mutatorState)) &&
    (value.deferredShardBonus === undefined || isFiniteNumber(value.deferredShardBonus)) &&
    (value.runMode === "normal" || value.runMode === "daily")
  );
}

function normalizeLegacySpecialAffixKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeLegacySpecialAffixKeys(entry));
  }
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    normalized[key] = normalizeLegacySpecialAffixKeys(entry);
  }

  if (isRecord(normalized.rolledSpecialAffixes)) {
    const specialAffixes = { ...normalized.rolledSpecialAffixes };
    if (specialAffixes.skillBonusDamage === undefined && specialAffixes.damageOverTime !== undefined) {
      specialAffixes.skillBonusDamage = specialAffixes.damageOverTime;
    }
    delete specialAffixes.damageOverTime;
    normalized.rolledSpecialAffixes = specialAffixes;
  }

  return normalized;
}

function normalizeLegacyDraftFields(input: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeLegacySpecialAffixKeys(input) as Record<string, unknown>;

  if (normalized.blueprintFoundIdsInRun === undefined && isStringArray(input.blueprintsFoundThisRun)) {
    normalized.blueprintFoundIdsInRun = [...input.blueprintsFoundThisRun];
  }

  if (normalized.selectedMutationIds === undefined && isStringArray(input.selectedMutations)) {
    normalized.selectedMutationIds = [...input.selectedMutations];
  }

  if (isRecord(normalized.phase6TelemetryState) && isRecord(normalized.phase6TelemetryState.story)) {
    normalized.phase6TelemetryState = {
      ...normalized.phase6TelemetryState,
      story: {
        ...normalized.phase6TelemetryState.story,
        majorPowerSpikes: normalized.phase6TelemetryState.story.majorPowerSpikes ?? 0
      }
    };
  }

  delete normalized.blueprintsFoundThisRun;
  delete normalized.selectedMutations;
  return normalized;
}

function validateSaveCommon(save: Record<string, unknown>): boolean {
  if (!isFiniteNumber(save.savedAtMs)) {
    return false;
  }
  if (typeof save.appVersion !== "string") {
    return false;
  }
  if (typeof save.runId !== "string" || save.runId.length === 0) {
    return false;
  }
  if (typeof save.runSeed !== "string" || save.runSeed.length === 0) {
    return false;
  }
  if (save.runtimeNowMs !== undefined && !isFiniteNumber(save.runtimeNowMs)) {
    return false;
  }
  if (!isRecord(save.player) || !isRecord(save.consumables)) {
    return false;
  }
  if (!isDungeonLayoutSnapshot(save.dungeon) || !isRecord(save.staircase)) {
    return false;
  }
  if (!Array.isArray(save.hazards) || !save.hazards.every((entry) => isRecord(entry))) {
    return false;
  }
  if (!(save.boss === null || isRecord(save.boss))) {
    return false;
  }
  if (!Array.isArray(save.monsters) || !save.monsters.every((entry) => isRuntimeMonsterState(entry))) {
    return false;
  }
  if (!Array.isArray(save.lootOnGround) || !save.lootOnGround.every((entry) => isLootEntry(entry))) {
    return false;
  }
  if (!(save.eventNode === null || isRuntimeEventNodeState(save.eventNode))) {
    return false;
  }
  if (!isMinimapSnapshot(save.minimap)) {
    return false;
  }
  if (typeof save.mapRevealActive !== "boolean") {
    return false;
  }
  if (!isRunRngCursor(save.rngCursor)) {
    return false;
  }
  if (save.blueprintFoundIdsInRun !== undefined && !isStringArray(save.blueprintFoundIdsInRun)) {
    return false;
  }
  if (save.selectedMutationIds !== undefined && !isStringArray(save.selectedMutationIds)) {
    return false;
  }
  if (save.lease !== undefined && !isSaveLease(save.lease)) {
    return false;
  }
  if (save.floorChoiceBudget !== undefined && !isFloorChoiceBudgetState(save.floorChoiceBudget)) {
    return false;
  }
  if (save.progressionPromptState !== undefined && !isProgressionPromptState(save.progressionPromptState)) {
    return false;
  }
  if (
    save.powerSpikeBudgetState !== undefined &&
    !isPowerSpikeBudgetRuntimeState(save.powerSpikeBudgetState)
  ) {
    return false;
  }
  if (
    save.deferredOutcomes !== undefined &&
    (!Array.isArray(save.deferredOutcomes) || !save.deferredOutcomes.every((entry) => isDeferredOutcomeState(entry)))
  ) {
    return false;
  }
  if (
    save.phase6TelemetryState !== undefined &&
    !isPhase6TelemetryRuntimeState(save.phase6TelemetryState)
  ) {
    return false;
  }
  return true;
}

function normalizeRunStateFromV1(input: RunStateV1): RunState {
  return {
    ...input,
    challengeSuccessCount: Math.max(0, Math.floor(input.challengeSuccessCount ?? 0)),
    inEndless: input.inEndless === true,
    endlessFloor: Math.max(0, Math.floor(input.endlessFloor ?? 0)),
    endlessKills: Math.max(0, Math.floor(input.endlessKills ?? 0)),
    mutatorActiveIds: isStringArray(input.mutatorActiveIds) ? [...input.mutatorActiveIds] : [],
    mutatorState: isMutatorState(input.mutatorState) ? { ...input.mutatorState } : {},
    deferredShardBonus: Math.max(0, Math.floor(input.deferredShardBonus ?? 0)),
    runMode: input.runMode === "daily" ? "daily" : "normal",
    ...(input.dailyDate === undefined ? {} : { dailyDate: input.dailyDate })
  };
}

function normalizeStaircaseFromV1(save: RunSaveDataV1): StaircaseState {
  const floor = Math.floor(save.run.currentFloor);
  if (floor === 2) {
    return {
      kind: "branch",
      visible: save.staircase.visible,
      position: { ...save.staircase.position },
      options: createBranchStairOptions(save.dungeon, save.dungeon.playerSpawn)
    };
  }
  return {
    kind: "single",
    visible: save.staircase.visible,
    position: { ...save.staircase.position }
  };
}

export function migrateRunSaveV1ToV2(save: RunSaveDataV1): RunSaveDataV2 {
  return {
    ...save,
    schemaVersion: 2,
    run: normalizeRunStateFromV1(save.run),
    staircase: normalizeStaircaseFromV1(save),
    deferredOutcomes: []
  };
}

export function validateSaveV1(raw: unknown): raw is RunSaveDataV1 {
  if (!isRecord(raw)) {
    return false;
  }

  const save = normalizeLegacyDraftFields(raw);
  if (save.schemaVersion !== 1) {
    return false;
  }
  if (!isRunStateV1(save.run) || !isStaircaseStateV1(save.staircase)) {
    return false;
  }
  return validateSaveCommon(save);
}

export function validateSaveV2(raw: unknown): raw is RunSaveEnvelope {
  if (!isRecord(raw)) {
    return false;
  }
  if (raw.schemaVersion !== 2) {
    return false;
  }
  if (!isRunStateV2(raw.run) || !isStaircaseStateV2(raw.staircase)) {
    return false;
  }
  return validateSaveCommon(raw);
}

export function validateSave(raw: unknown): raw is RunSaveEnvelope {
  if (!isRecord(raw)) {
    return false;
  }
  const normalized = normalizeLegacyDraftFields(raw);
  if (!validateSaveV2(normalized)) {
    return false;
  }

  for (const key of Object.keys(raw)) {
    delete raw[key];
  }
  Object.assign(raw, normalized);
  return true;
}

function deserializeRunStateWithMigration(raw: string): DeserializeRunStateResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {
        save: null,
        sourceVersion: null,
        migratedFromV1: false
      };
    }

    const normalized = normalizeLegacyDraftFields(parsed);
    if (validateSaveV2(normalized)) {
      return {
        save: normalized,
        sourceVersion: 2,
        migratedFromV1: false
      };
    }

    if (validateSaveV1(normalized)) {
      const migrated = migrateRunSaveV1ToV2(normalized);
      if (!validateSaveV2(migrated)) {
        return {
          save: null,
          sourceVersion: 1,
          migratedFromV1: false
        };
      }
      return {
        save: migrated,
        sourceVersion: 1,
        migratedFromV1: true
      };
    }

    return {
      save: null,
      sourceVersion: null,
      migratedFromV1: false
    };
  } catch {
    return {
      save: null,
      sourceVersion: null,
      migratedFromV1: false
    };
  }
}

export function deserializeRunStateResult(raw: string): DeserializeRunStateResult {
  return deserializeRunStateWithMigration(raw);
}

export function serializeRunState(snapshot: RunSaveDataV2): string {
  if (!validateSaveV2(snapshot)) {
    throw new Error("Invalid run save snapshot.");
  }
  return JSON.stringify(snapshot);
}

export function deserializeRunState(raw: string): RunSaveEnvelope | null {
  return deserializeRunStateWithMigration(raw).save;
}
