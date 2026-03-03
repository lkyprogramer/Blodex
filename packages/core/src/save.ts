import type {
  BossRuntimeState,
  ConsumableState,
  DungeonLayout,
  HazardRuntimeState,
  ItemInstance,
  MerchantOffer,
  MonsterState,
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

type RunStateV1 = Omit<RunState, "challengeSuccessCount" | "inEndless" | "endlessFloor" | "runMode"> &
  Partial<Pick<RunState, "challengeSuccessCount" | "inEndless" | "endlessFloor" | "runMode" | "dailyDate">>;

export interface RuntimeMonsterState {
  state: MonsterState;
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
  run: RunState;
  staircase: StaircaseState;
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

function isRuntimeMonsterState(value: unknown): value is RuntimeMonsterState {
  return isRecord(value) && isRecord(value.state) && isFiniteNumber(value.nextAttackAt) && isFiniteNumber(value.nextSupportAt);
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
    (value.runMode === "normal" || value.runMode === "daily")
  );
}

function normalizeLegacyDraftFields(input: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    ...input
  };

  if (normalized.blueprintFoundIdsInRun === undefined && isStringArray(input.blueprintsFoundThisRun)) {
    normalized.blueprintFoundIdsInRun = [...input.blueprintsFoundThisRun];
  }

  if (normalized.selectedMutationIds === undefined && isStringArray(input.selectedMutations)) {
    normalized.selectedMutationIds = [...input.selectedMutations];
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
  return true;
}

function normalizeRunStateFromV1(input: RunStateV1): RunState {
  return {
    ...input,
    challengeSuccessCount: Math.max(0, Math.floor(input.challengeSuccessCount ?? 0)),
    inEndless: input.inEndless === true,
    endlessFloor: Math.max(0, Math.floor(input.endlessFloor ?? 0)),
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
    staircase: normalizeStaircaseFromV1(save)
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
  return validateSaveV2(raw);
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
