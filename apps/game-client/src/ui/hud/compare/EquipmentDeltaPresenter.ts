import {
  calculateItemCategoryScores,
  type ItemInstance,
  type ItemTradeoffCategory
} from "@blodex/core";

export type DeltaDirection = "up" | "down" | "equal";

export type EquipmentDeltaSummaryKey = "offense" | "defense" | "utility";

export interface EquipmentDeltaSummaryLine {
  key: EquipmentDeltaSummaryKey;
  direction: DeltaDirection;
  delta: number;
}

export function resolveDeltaDirection(delta: number): DeltaDirection {
  if (delta > 0) {
    return "up";
  }
  if (delta < 0) {
    return "down";
  }
  return "equal";
}

export function buildEquipmentDeltaSummary(
  item: ItemInstance,
  compareItem: ItemInstance | undefined
): EquipmentDeltaSummaryLine[] {
  const currentScores = calculateItemCategoryScores(item);
  const compareScores = calculateItemCategoryScores(compareItem);

  return (["offense", "defense", "utility"] as ItemTradeoffCategory[]).map((key) => {
    const delta = currentScores[key] - compareScores[key];

    return {
      key,
      direction: resolveDeltaDirection(delta),
      delta
    };
  });
}
