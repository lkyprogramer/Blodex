import {
  calculateItemPowerScore,
  collectItemAffixMap,
  resolveItemSetTransition,
  getItemTradeoffCalibrationAsset,
  type ItemInstance
} from "@blodex/core";
import { ITEM_SET_DEFS, ITEM_SET_DEF_MAP } from "@blodex/content";
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

export interface EquipmentCompareSetTransitionView {
  setId: string;
  setName: string;
  beforePieces: number;
  afterPieces: number;
  activatedThresholds: number[];
  lostThresholds: number[];
  nextThreshold?: number;
  associatedDamageType?: string;
  direction: DeltaDirection;
}

export interface EquipmentCompareView {
  affixLines: EquipmentCompareAffixView[];
  summaryLines: ReturnType<typeof buildEquipmentDeltaSummary>;
  powerDelta: number;
  powerDirection: DeltaDirection;
  setTransition?: EquipmentCompareSetTransitionView;
}

export function buildEquipmentCompareView(
  item: ItemInstance,
  compareItem: ItemInstance | undefined,
  equippedItems: ItemInstance[] = []
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
        direction: resolveDeltaDirection(compareItem === undefined ? value : value - compareValue)
      };
    });
  const powerDelta =
    compareItem === undefined ? calculateItemPowerScore(item) : calculateItemPowerScore(item) - calculateItemPowerScore(compareItem);
  const setTransition = resolveItemSetTransition(item, compareItem, equippedItems, ITEM_SET_DEFS);
  return {
    affixLines,
    summaryLines: buildEquipmentDeltaSummary(item, compareItem),
    powerDelta,
    powerDirection: resolveDeltaDirection(powerDelta),
    ...(setTransition === null
      ? {}
      : {
          setTransition: {
            ...setTransition,
            setName: ITEM_SET_DEF_MAP[setTransition.setId]?.name ?? setTransition.setId,
            ...(ITEM_SET_DEF_MAP[setTransition.setId]?.associatedDamageType === undefined
              ? {}
              : { associatedDamageType: ITEM_SET_DEF_MAP[setTransition.setId]!.associatedDamageType }),
            direction: resolveDeltaDirection(setTransition.afterPieces - setTransition.beforePieces)
          }
        })
  };
}

export function isMerchantHighValueCompareCandidate(
  item: ItemInstance,
  compareItem: ItemInstance | undefined,
  equippedItems: ItemInstance[] = []
): boolean {
  if (compareItem === undefined) {
    return false;
  }
  const calibration = getItemTradeoffCalibrationAsset();
  const compareView = buildEquipmentCompareView(item, compareItem, equippedItems);
  const positiveSummaryCount = compareView.summaryLines.filter((line) => line.direction === "up").length;
  return (
    compareView.powerDelta >= calibration.merchantCompareThresholds.minPowerDelta &&
    positiveSummaryCount >= calibration.merchantCompareThresholds.minPositiveSummaryCount
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
