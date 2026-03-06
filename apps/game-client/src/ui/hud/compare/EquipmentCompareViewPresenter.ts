import type { ItemInstance } from "@blodex/core";
import {
  buildEquipmentDeltaSummary,
  resolveDeltaDirection,
  type DeltaDirection,
  type EquipmentDeltaSummaryKey
} from "./EquipmentDeltaPresenter";

export interface EquipmentCompareAffixView {
  key: string;
  value: number;
  delta?: number;
  direction: DeltaDirection;
}

export interface EquipmentCompareView {
  affixLines: EquipmentCompareAffixView[];
  summaryLines: ReturnType<typeof buildEquipmentDeltaSummary>;
  powerDelta: number;
  powerDirection: DeltaDirection;
}

const MERCHANT_COMPARE_MIN_POWER_DELTA = 6;
const MERCHANT_COMPARE_MIN_POSITIVE_SUMMARIES = 2;

function collectItemAffixMap(item: ItemInstance | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (item === undefined) {
    return map;
  }
  for (const [key, value] of Object.entries(item.rolledAffixes)) {
    if (value !== undefined) {
      map.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(item.rolledSpecialAffixes ?? {})) {
    if (value !== undefined) {
      map.set(key, value);
    }
  }
  return map;
}

function calculateItemPowerScore(item: ItemInstance): number {
  let score = 0;
  for (const value of Object.values(item.rolledAffixes)) {
    if (value !== undefined) {
      score += value;
    }
  }
  for (const value of Object.values(item.rolledSpecialAffixes ?? {})) {
    if (value !== undefined) {
      score += value;
    }
  }
  return score;
}

export function buildEquipmentCompareView(
  item: ItemInstance,
  compareItem: ItemInstance | undefined
): EquipmentCompareView {
  const itemAffixes = collectItemAffixMap(item);
  const compareAffixes = compareItem === undefined ? new Map<string, number>() : collectItemAffixMap(compareItem);
  const keys = new Set<string>([...itemAffixes.keys(), ...compareAffixes.keys()]);
  const affixLines = [...keys]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => {
      const value = itemAffixes.get(key) ?? 0;
      const compareValue = compareAffixes.get(key) ?? 0;
      const delta = compareItem === undefined ? undefined : value - compareValue;
      return {
        key,
        value,
        ...(delta === undefined ? {} : { delta }),
        direction: resolveDeltaDirection(delta ?? 0)
      };
    });
  const powerDelta =
    compareItem === undefined ? calculateItemPowerScore(item) : calculateItemPowerScore(item) - calculateItemPowerScore(compareItem);
  return {
    affixLines,
    summaryLines: buildEquipmentDeltaSummary(item, compareItem),
    powerDelta,
    powerDirection: resolveDeltaDirection(powerDelta)
  };
}

export function isMerchantHighValueCompareCandidate(
  item: ItemInstance,
  compareItem: ItemInstance | undefined
): boolean {
  if (compareItem === undefined) {
    return false;
  }
  const compareView = buildEquipmentCompareView(item, compareItem);
  const positiveSummaryCount = compareView.summaryLines.filter((line) => line.direction === "up").length;
  return (
    compareView.powerDelta >= MERCHANT_COMPARE_MIN_POWER_DELTA &&
    positiveSummaryCount >= MERCHANT_COMPARE_MIN_POSITIVE_SUMMARIES
  );
}

export function summaryDirectionSymbol(direction: DeltaDirection): string {
  switch (direction) {
    case "up":
      return "+";
    case "down":
      return "-";
    default:
      return "=";
  }
}

export function summaryKeyLabelKey(key: EquipmentDeltaSummaryKey): "offense" | "defense" | "utility" {
  return key;
}
