import {
  DEFAULT_STORY_MAX_FLOOR,
  SeededRng,
  deriveEquippedPlayerStats,
  isTerminalStoryPowerSpikePairId,
  resolveStoryPowerSpikePairs,
  resolveStoryPowerSpikePairId,
  resolveStoryPowerSpikePairIds,
  resolveSpecialAffixTotals,
  rollItemDrop,
  type ItemDef,
  type ItemInstance,
  type LootTableDef,
  type PlayerState,
  type PowerSpikeBudgetRuntimeState,
  type PowerSpikePairBudgetState,
  type PowerSpikePairId
} from "@blodex/core";
import { ITEM_SET_DEFS } from "@blodex/content";
import type { BuildIdentitySnapshot } from "./TasteRuntimePorts";
import {
  DEFAULT_POWER_SPIKE_CALIBRATION_ASSET,
  type PowerSpikeCalibrationAsset
} from "./PowerSpikeCalibration";

export type PowerSpikeSourceKind =
  | "drop_spawn"
  | "merchant_purchase"
  | "event_reward"
  | "hidden_room_reward"
  | "challenge_reward"
  | "boss_reward"
  | "build_threshold"
  | "floor_pair_fallback"
  | "unknown";

export interface PowerSpikeAmplitude {
  offensiveDelta: number;
  defensiveDelta: number;
  utilityDelta: number;
  ttkDelta: number;
  sustainDelta: number;
  accepted: boolean;
  major: boolean;
  dominantAxis: "offense" | "defense" | "utility";
}

export interface PowerSpikeEvaluation {
  pairId: PowerSpikePairId;
  sourceKind: PowerSpikeSourceKind;
  amplitude: PowerSpikeAmplitude;
  itemDefId?: string;
  rarity?: ItemInstance["rarity"];
}

interface PowerSpikeMetricSnapshot {
  offensiveDelta: number;
  defensiveDelta: number;
  utilityDelta: number;
  ttkDelta: number;
  sustainDelta: number;
}

interface PlayerPowerMetrics {
  offense: number;
  defense: number;
  sustain: number;
  utility: number;
}

interface GuaranteedSpikeRewardOptions {
  table: LootTableDef;
  floor: number;
  player: PlayerState;
  itemDefs: Record<string, ItemDef>;
  seedBase: string;
  preferMajor?: boolean;
  isItemEligible?: (itemDef: ItemDef) => boolean;
}

function createEmptyPairState(): PowerSpikePairBudgetState {
  return {
    hitCount: 0,
    majorHitCount: 0,
    satisfied: false,
    fallbackGranted: false
  };
}

function safeRatio(after: number, before: number): number {
  if (!Number.isFinite(after) || !Number.isFinite(before)) {
    return 0;
  }
  if (before <= 0) {
    return after > 0 ? 1 : 0;
  }
  return (after - before) / before;
}

function clampDelta(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(4));
}

function buildPlayerPowerMetrics(player: PlayerState): PlayerPowerMetrics {
  const equipped = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
  const special = resolveSpecialAffixTotals(equipped);
  const critDamageMultiplier = 0.5 + special.critDamage;
  const offense =
    player.derivedStats.attackPower *
    player.derivedStats.attackSpeed *
    (1 + player.derivedStats.critChance * Math.max(0.5, critDamageMultiplier));
  const defense =
    player.derivedStats.maxHealth *
    (1 + player.derivedStats.armor / 110) *
    (1 / Math.max(0.2, 1 - special.dodgeChance));
  const sustain = special.healthRegen + offense * special.lifesteal * 0.12;
  const utility =
    player.derivedStats.moveSpeed +
    player.derivedStats.maxMana * 0.25 +
    special.cooldownReduction * 120 +
    special.aoeRadius * 80;
  return {
    offense,
    defense,
    sustain,
    utility
  };
}

function simulatePlayerWithCandidateItem(player: PlayerState, candidate: ItemInstance): PlayerState {
  const equipment = {
    ...player.equipment,
    [candidate.slot]: candidate
  };
  const equipped = Object.values(equipment).filter((item): item is ItemInstance => item !== undefined);
  const derivedStats = deriveEquippedPlayerStats(player.baseStats, equipped, {
    itemSetDefs: ITEM_SET_DEFS
  });
  return {
    ...player,
    equipment,
    derivedStats,
    health: Math.min(player.health, derivedStats.maxHealth),
    mana: Math.min(player.mana, derivedStats.maxMana)
  };
}

export function resolvePowerSpikePairIds(maxFloors = DEFAULT_STORY_MAX_FLOOR): PowerSpikePairId[] {
  return resolveStoryPowerSpikePairIds(maxFloors) as PowerSpikePairId[];
}

export function resolvePowerSpikePairId(floor: number, maxFloors = DEFAULT_STORY_MAX_FLOOR): PowerSpikePairId {
  return resolveStoryPowerSpikePairId(floor, maxFloors) as PowerSpikePairId;
}

export function resolvePowerSpikeSourceKind(source: string): PowerSpikeSourceKind {
  switch (source) {
    case "drop_spawn":
      return "drop_spawn";
    case "merchant_purchase":
      return "merchant_purchase";
    case "event_reward":
      return "event_reward";
    case "hidden_room_reward":
      return "hidden_room_reward";
    case "challenge_reward":
      return "challenge_reward";
    case "boss_reward":
      return "boss_reward";
    case "build_threshold":
      return "build_threshold";
    case "pair_fallback":
      return "floor_pair_fallback";
    default:
      return "unknown";
  }
}

export function scorePowerSpikeFromItem(
  player: PlayerState,
  item: ItemInstance,
  calibration: PowerSpikeCalibrationAsset = DEFAULT_POWER_SPIKE_CALIBRATION_ASSET
): PowerSpikeAmplitude {
  const before = buildPlayerPowerMetrics(player);
  const after = buildPlayerPowerMetrics(simulatePlayerWithCandidateItem(player, item));
  const metrics: PowerSpikeMetricSnapshot = {
    offensiveDelta: clampDelta(safeRatio(after.offense, before.offense)),
    defensiveDelta: clampDelta(safeRatio(after.defense, before.defense)),
    utilityDelta: clampDelta(safeRatio(after.utility, before.utility)),
    sustainDelta: clampDelta(safeRatio(after.sustain, before.sustain)),
    ttkDelta: clampDelta(before.offense <= 0 || after.offense <= 0 ? 0 : 1 - before.offense / after.offense)
  };
  return classifyPowerSpikeMetrics(metrics, calibration);
}

export function classifyPowerSpikeMetrics(
  metrics: PowerSpikeMetricSnapshot,
  calibration: PowerSpikeCalibrationAsset = DEFAULT_POWER_SPIKE_CALIBRATION_ASSET
): PowerSpikeAmplitude {
  const dominantAxis =
    metrics.defensiveDelta >= metrics.offensiveDelta && metrics.defensiveDelta >= metrics.utilityDelta
      ? "defense"
      : metrics.utilityDelta >= metrics.offensiveDelta
        ? "utility"
        : "offense";
  const accepted =
    metrics.offensiveDelta >= calibration.thresholds.offensiveAccepted ||
    metrics.ttkDelta >= calibration.thresholds.ttkAccepted ||
    metrics.defensiveDelta >= calibration.thresholds.defensiveAccepted ||
    metrics.sustainDelta >= calibration.thresholds.sustainAccepted ||
    metrics.utilityDelta >= calibration.thresholds.utilityAccepted;
  const major =
    metrics.offensiveDelta >= calibration.thresholds.majorAnyAxis ||
    metrics.defensiveDelta >= calibration.thresholds.majorAnyAxis ||
    metrics.utilityDelta >= calibration.thresholds.majorAnyAxis ||
    metrics.sustainDelta >= calibration.thresholds.majorAnyAxis;
  return {
    offensiveDelta: metrics.offensiveDelta,
    defensiveDelta: metrics.defensiveDelta,
    utilityDelta: metrics.utilityDelta,
    ttkDelta: metrics.ttkDelta,
    sustainDelta: metrics.sustainDelta,
    accepted,
    major,
    dominantAxis
  };
}

export function scorePowerSpikeFromBuildThreshold(
  snapshot: BuildIdentitySnapshot,
  calibration: PowerSpikeCalibrationAsset = DEFAULT_POWER_SPIKE_CALIBRATION_ASSET
): PowerSpikeAmplitude {
  const keyItemBonus = Math.min(
    calibration.buildThreshold.keyItemBonusCap,
    snapshot.keyItemDefIds.length * calibration.buildThreshold.keyItemBonusPerItem
  );
  const pivotBonus = Math.min(
    calibration.buildThreshold.pivotBonusCap,
    snapshot.pivots.length * calibration.buildThreshold.pivotBonusPerPivot
  );
  const offensiveDelta = snapshot.tags.includes("build:offense") ? calibration.buildThreshold.offenseBase + keyItemBonus : 0;
  const defensiveDelta = snapshot.tags.includes("build:defense") ? calibration.buildThreshold.defenseBase + keyItemBonus : 0;
  const utilityDelta =
    snapshot.tags.includes("build:utility") || snapshot.tags.includes("build:branching")
      ? calibration.buildThreshold.utilityBase + pivotBonus
      : pivotBonus;
  const sustainDelta =
    snapshot.tags.includes("build:defense") || snapshot.tags.includes("stat:vitality")
      ? calibration.buildThreshold.sustainBase + keyItemBonus
      : 0;
  const ttkDelta = snapshot.tags.includes("build:offense") ? calibration.buildThreshold.ttkBase + keyItemBonus : 0;
  return classifyPowerSpikeMetrics(
    {
      offensiveDelta: clampDelta(offensiveDelta),
      defensiveDelta: clampDelta(defensiveDelta),
      utilityDelta: clampDelta(utilityDelta),
      ttkDelta: clampDelta(ttkDelta),
      sustainDelta: clampDelta(sustainDelta)
    },
    calibration
  );
}

export function resolveGuaranteedSpikeReward(options: GuaranteedSpikeRewardOptions): ItemInstance | null {
  const candidates = options.table.entries
    .filter((entry) => entry.minFloor <= options.floor)
    .map((entry) => options.itemDefs[entry.itemDefId])
    .filter((entry): entry is ItemDef => entry !== undefined)
    .filter((entry) => options.isItemEligible?.(entry) ?? true);

  let bestAccepted: { item: ItemInstance; amplitude: PowerSpikeAmplitude } | null = null;
  let bestFallback: { item: ItemInstance; amplitude: PowerSpikeAmplitude } | null = null;

  for (const def of candidates) {
    const item = rollItemDrop(
      {
        id: `power-spike-${options.table.id}-${def.id}`,
        entries: [{ itemDefId: def.id, weight: 1, minFloor: 1 }]
      },
      options.itemDefs,
      options.floor,
      new SeededRng(`${options.seedBase}:${def.id}`),
      `${options.seedBase}:${def.id}`
    );
    if (item === null) {
      continue;
    }
    const amplitude = scorePowerSpikeFromItem(options.player, item);
    const score = Math.max(
      amplitude.offensiveDelta,
      amplitude.defensiveDelta,
      amplitude.utilityDelta,
      amplitude.sustainDelta,
      amplitude.ttkDelta
    );
    if (amplitude.accepted) {
      if (
        bestAccepted === null ||
        (options.preferMajor === true && amplitude.major && !bestAccepted.amplitude.major) ||
        score >
          Math.max(
            bestAccepted.amplitude.offensiveDelta,
            bestAccepted.amplitude.defensiveDelta,
            bestAccepted.amplitude.utilityDelta,
            bestAccepted.amplitude.sustainDelta,
            bestAccepted.amplitude.ttkDelta
          )
      ) {
        bestAccepted = { item, amplitude };
      }
    }
    if (
      bestFallback === null ||
      score >
        Math.max(
          bestFallback.amplitude.offensiveDelta,
          bestFallback.amplitude.defensiveDelta,
          bestFallback.amplitude.utilityDelta,
          bestFallback.amplitude.sustainDelta,
          bestFallback.amplitude.ttkDelta
        )
    ) {
      bestFallback = { item, amplitude };
    }
  }

  return (bestAccepted ?? bestFallback)?.item ?? null;
}

export class PowerSpikeBudgetTracker {
  private readonly pairIds: PowerSpikePairId[];
  private state: PowerSpikeBudgetRuntimeState;

  constructor(private readonly maxFloors = DEFAULT_STORY_MAX_FLOOR) {
    this.pairIds = resolvePowerSpikePairIds(maxFloors);
    this.state = this.createEmptyState();
  }

  private createEmptyState(): PowerSpikeBudgetRuntimeState {
    return {
      pairStates: Object.fromEntries(this.pairIds.map((pairId) => [pairId, createEmptyPairState()])) as Record<
        PowerSpikePairId,
        PowerSpikePairBudgetState
      >,
      acceptedSpikeCount: 0,
      majorSpikeCount: 0
    };
  }

  private requirePairState(pairId: PowerSpikePairId): PowerSpikePairBudgetState {
    const existing = this.state.pairStates[pairId];
    if (existing !== undefined) {
      return existing;
    }
    const created = createEmptyPairState();
    this.state.pairStates[pairId] = created;
    return created;
  }

  resetRun(): void {
    this.state = this.createEmptyState();
  }

  exportRuntimeState(): PowerSpikeBudgetRuntimeState {
    return {
      pairStates: Object.fromEntries(
        this.pairIds.map((pairId) => [pairId, { ...this.state.pairStates[pairId] }])
      ) as Record<PowerSpikePairId, PowerSpikePairBudgetState>,
      acceptedSpikeCount: this.state.acceptedSpikeCount,
      majorSpikeCount: this.state.majorSpikeCount
    };
  }

  restoreRuntimeState(state: PowerSpikeBudgetRuntimeState | undefined): void {
    if (state === undefined) {
      this.resetRun();
      return;
    }
    this.state = {
      pairStates: Object.fromEntries(
        this.pairIds.map((pairId) => [pairId, { ...state.pairStates[pairId] }])
      ) as Record<PowerSpikePairId, PowerSpikePairBudgetState>,
      acceptedSpikeCount: state.acceptedSpikeCount,
      majorSpikeCount: state.majorSpikeCount
    };
  }

  recordAcceptedSpike(floor: number, amplitude: PowerSpikeAmplitude): void {
    if (!amplitude.accepted) {
      return;
    }
    const pairId = resolvePowerSpikePairId(floor, this.maxFloors);
    const pairState = this.requirePairState(pairId);
    pairState.hitCount += 1;
    pairState.satisfied = true;
    if (amplitude.major) {
      pairState.majorHitCount += 1;
      this.state.majorSpikeCount += 1;
    }
    this.state.acceptedSpikeCount += 1;
  }

  needsFallbackReward(floor: number): boolean {
    const pairId = resolvePowerSpikePairId(floor, this.maxFloors);
    const pairState = this.requirePairState(pairId);
    if (isTerminalStoryPowerSpikePairId(pairId, this.maxFloors)) {
      const terminalPair = resolveStoryPowerSpikePairs(this.maxFloors).find((pair) => pair.id === pairId);
      if (terminalPair === undefined || Math.max(1, Math.floor(floor)) >= terminalPair.endFloor) {
        return false;
      }
    }
    return !pairState.satisfied && !pairState.fallbackGranted;
  }

  markFallbackGranted(floor: number): void {
    this.requirePairState(resolvePowerSpikePairId(floor, this.maxFloors)).fallbackGranted = true;
  }

  hasMajorSpike(): boolean {
    return this.state.majorSpikeCount > 0;
  }

  isPairSatisfied(pairId: PowerSpikePairId): boolean {
    return this.requirePairState(pairId).satisfied;
  }

  snapshot(): PowerSpikeBudgetRuntimeState {
    return this.exportRuntimeState();
  }
}
