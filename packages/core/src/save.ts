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
import type { RunState } from "./run";

export const RUN_SAVE_STORAGE_KEY = "blodex_run_save_v1";

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
  run: RunState;
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

export type RunSaveEnvelope = RunSaveDataV1 & Record<string, unknown>;

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
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y)
  );
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
  return (
    isRecord(value) &&
    isRecord(value.state) &&
    isFiniteNumber(value.nextAttackAt) &&
    isFiniteNumber(value.nextSupportAt)
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
  return (
    isRecord(value) &&
    isRecord(value.item) &&
    isPoint(value.position)
  );
}

function normalizeLegacyDraftFields(input: Record<string, unknown>): RunSaveEnvelope {
  const normalized: RunSaveEnvelope = {
    ...input
  } as RunSaveEnvelope;

  if (
    normalized.blueprintFoundIdsInRun === undefined &&
    isStringArray(input.blueprintsFoundThisRun)
  ) {
    normalized.blueprintFoundIdsInRun = [...input.blueprintsFoundThisRun];
  }

  if (
    normalized.selectedMutationIds === undefined &&
    isStringArray(input.selectedMutations)
  ) {
    normalized.selectedMutationIds = [...input.selectedMutations];
  }

  delete normalized.blueprintsFoundThisRun;
  delete normalized.selectedMutations;
  return normalized;
}

export function validateSave(raw: unknown): raw is RunSaveEnvelope {
  if (!isRecord(raw)) {
    return false;
  }

  const save = normalizeLegacyDraftFields(raw);
  if (save.schemaVersion !== 1) {
    return false;
  }
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
  if (!isRecord(save.run) || !isRecord(save.player) || !isRecord(save.consumables)) {
    return false;
  }
  if (!isRecord(save.dungeon) || !isRecord(save.staircase)) {
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

export function serializeRunState(snapshot: RunSaveDataV1): string {
  const normalized = normalizeLegacyDraftFields(snapshot as unknown as Record<string, unknown>);
  if (!validateSave(normalized)) {
    throw new Error("Invalid run save snapshot.");
  }

  return JSON.stringify(normalized);
}

export function deserializeRunState(raw: string): RunSaveEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    const normalized = normalizeLegacyDraftFields(parsed);
    return validateSave(normalized) ? normalized : null;
  } catch {
    return null;
  }
}
