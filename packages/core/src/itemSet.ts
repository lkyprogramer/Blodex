import type { DamageType, DerivedStats, ItemInstance, ItemSetDef, ItemSetId } from "./contracts/types";

export interface ItemSetEffectTotals {
  countsBySetId: Partial<Record<ItemSetId, number>>;
  activeThresholdsBySetId: Partial<Record<ItemSetId, number[]>>;
  activeSetIds: ItemSetId[];
  derivedFlat: Partial<DerivedStats>;
  derivedPercent: Partial<Record<keyof DerivedStats, number>>;
  associatedDamageTypes: DamageType[];
}

export interface ItemSetTransition {
  setId: ItemSetId;
  beforePieces: number;
  afterPieces: number;
  activatedThresholds: number[];
  lostThresholds: number[];
  nextThreshold?: number;
}

function emptyDerivedFlat(): Partial<DerivedStats> {
  return {};
}

function emptyDerivedPercent(): Partial<Record<keyof DerivedStats, number>> {
  return {};
}

function addDerivedFlat(target: Partial<DerivedStats>, delta: Partial<DerivedStats> | undefined): void {
  if (delta === undefined) {
    return;
  }
  for (const [key, value] of Object.entries(delta) as Array<[keyof DerivedStats, number]>) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function addDerivedPercent(
  target: Partial<Record<keyof DerivedStats, number>>,
  delta: Partial<Record<keyof DerivedStats, number>> | undefined
): void {
  if (delta === undefined) {
    return;
  }
  for (const [key, value] of Object.entries(delta) as Array<[keyof DerivedStats, number]>) {
    target[key] = (target[key] ?? 0) + value;
  }
}

export function countEquippedItemSetPieces(equippedItems: ItemInstance[]): Partial<Record<ItemSetId, number>> {
  const counts: Partial<Record<ItemSetId, number>> = {};
  for (const item of equippedItems) {
    if (item.setId === undefined) {
      continue;
    }
    counts[item.setId] = (counts[item.setId] ?? 0) + 1;
  }
  return counts;
}

export function resolveEquippedItemSetEffects(
  equippedItems: ItemInstance[],
  setDefs: ItemSetDef[]
): ItemSetEffectTotals {
  const countsBySetId = countEquippedItemSetPieces(equippedItems);
  const derivedFlat = emptyDerivedFlat();
  const derivedPercent = emptyDerivedPercent();
  const activeSetIds: ItemSetId[] = [];
  const associatedDamageTypes: DamageType[] = [];
  const activeThresholdsBySetId: Partial<Record<ItemSetId, number[]>> = {};

  for (const setDef of setDefs) {
    const pieces = countsBySetId[setDef.id] ?? 0;
    if (pieces <= 0) {
      continue;
    }
    const activeThresholds = setDef.bonuses
      .filter((bonus) => pieces >= bonus.pieces)
      .map((bonus) => bonus.pieces)
      .sort((left, right) => left - right);
    if (activeThresholds.length === 0) {
      continue;
    }
    activeSetIds.push(setDef.id);
    activeThresholdsBySetId[setDef.id] = activeThresholds;
    if (setDef.associatedDamageType !== undefined && !associatedDamageTypes.includes(setDef.associatedDamageType)) {
      associatedDamageTypes.push(setDef.associatedDamageType);
    }
    for (const bonus of setDef.bonuses) {
      if (pieces < bonus.pieces) {
        continue;
      }
      addDerivedFlat(derivedFlat, bonus.derivedFlat);
      addDerivedPercent(derivedPercent, bonus.derivedPercent);
    }
  }

  return {
    countsBySetId,
    activeThresholdsBySetId,
    activeSetIds,
    derivedFlat,
    derivedPercent,
    associatedDamageTypes
  };
}

export function resolveItemSetTransition(
  candidate: ItemInstance,
  compareItem: ItemInstance | undefined,
  equippedItems: ItemInstance[],
  setDefs: ItemSetDef[]
): ItemSetTransition | null {
  const relevantSetId = candidate.setId ?? compareItem?.setId;
  if (relevantSetId === undefined) {
    return null;
  }
  const setDef = setDefs.find((entry) => entry.id === relevantSetId);
  if (setDef === undefined) {
    return null;
  }

  const baseEquipment =
    compareItem === undefined
      ? [...equippedItems]
      : equippedItems.filter((entry) => entry.id !== compareItem.id && entry.id !== candidate.id);
  const beforeEquipment = compareItem === undefined ? [...baseEquipment] : [...baseEquipment, compareItem];
  const afterEquipment =
    compareItem === undefined
      ? equippedItems.some((entry) => entry.id === candidate.id)
        ? [...baseEquipment]
        : [...baseEquipment, candidate]
      : [...baseEquipment, candidate];

  const beforePieces = countEquippedItemSetPieces(beforeEquipment)[relevantSetId] ?? 0;
  const afterPieces = countEquippedItemSetPieces(afterEquipment)[relevantSetId] ?? 0;
  if (beforePieces === afterPieces) {
    return null;
  }

  const thresholds = setDef.bonuses.map((bonus) => bonus.pieces).sort((left, right) => left - right);
  const activatedThresholds = thresholds.filter((pieces) => beforePieces < pieces && afterPieces >= pieces);
  const lostThresholds = thresholds.filter((pieces) => beforePieces >= pieces && afterPieces < pieces);
  const nextThreshold = thresholds.find((pieces) => pieces > afterPieces);

  return {
    setId: relevantSetId,
    beforePieces,
    afterPieces,
    activatedThresholds,
    lostThresholds,
    ...(nextThreshold === undefined ? {} : { nextThreshold })
  };
}
