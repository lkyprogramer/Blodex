import type {
  ItemDef,
  ItemInstance,
  ItemSpecialAffixKey,
  LootEntry,
  LootTableDef,
  RngLike
} from "./contracts/types";
import { normalizeSpecialAffixValue } from "./specialAffix";

export interface RollItemDropOptions {
  isItemEligible?: (itemDef: ItemDef) => boolean;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function normalizeDerivedAffixValue(key: keyof ItemInstance["rolledAffixes"], value: number): number {
  if (key === "critChance") {
    // Legacy data stores percent points (e.g. 2 => 2%) while runtime uses ratio (0.02).
    return value >= 1 ? value / 100 : value;
  }
  return value;
}

function applyDerivedAffixValue(
  target: ItemInstance["rolledAffixes"],
  key: keyof ItemInstance["rolledAffixes"],
  rawValue: number
): void {
  const value = normalizeDerivedAffixValue(key, rawValue);
  target[key] = (target[key] ?? 0) + value;
}

function applySpecialAffixValue(
  target: NonNullable<ItemInstance["rolledSpecialAffixes"]>,
  key: ItemSpecialAffixKey,
  rawValue: number
): void {
  const value = normalizeSpecialAffixValue(key, rawValue);
  target[key] = (target[key] ?? 0) + value;
}

function rollAffixes(itemDef: ItemDef, rng: RngLike): ItemInstance["rolledAffixes"] {
  const fixed = itemDef.fixedAffixes ?? {};
  if ((itemDef.kind ?? "equipment") === "unique") {
    const uniqueAffixes: ItemInstance["rolledAffixes"] = {};
    for (const [key, value] of Object.entries(fixed) as Array<[keyof ItemInstance["rolledAffixes"], number]>) {
      applyDerivedAffixValue(uniqueAffixes, key, value);
    }
    return uniqueAffixes;
  }

  const rolled: ItemInstance["rolledAffixes"] = {};
  for (const [key, value] of Object.entries(fixed) as Array<[keyof ItemInstance["rolledAffixes"], number]>) {
    applyDerivedAffixValue(rolled, key, value);
  }
  if (itemDef.affixPool.length === 0) {
    return rolled;
  }

  const minCount = Math.max(0, itemDef.minAffixes);
  const maxCount = Math.max(minCount, itemDef.maxAffixes);
  const affixCount = clamp(rng.nextInt(minCount, maxCount), 0, itemDef.affixPool.length);
  const pool = [...itemDef.affixPool];

  for (let i = 0; i < affixCount; i += 1) {
    const index = rng.nextInt(0, pool.length - 1);
    const picked = pool.splice(index, 1)[0];
    if (picked === undefined) {
      continue;
    }
    const value = rng.nextInt(picked.min, picked.max);
    applyDerivedAffixValue(rolled, picked.key, value);
  }

  return rolled;
}

function rollSpecialAffixes(
  itemDef: ItemDef,
  rng: RngLike
): ItemInstance["rolledSpecialAffixes"] {
  const fixed = itemDef.fixedSpecialAffixes ?? {};
  if ((itemDef.kind ?? "equipment") === "unique") {
    if (Object.keys(fixed).length === 0) {
      return undefined;
    }
    const uniqueSpecialAffixes: NonNullable<ItemInstance["rolledSpecialAffixes"]> = {};
    for (const [key, value] of Object.entries(fixed) as Array<[ItemSpecialAffixKey, number]>) {
      applySpecialAffixValue(uniqueSpecialAffixes, key, value);
    }
    return uniqueSpecialAffixes;
  }

  const pool = [...(itemDef.specialAffixPool ?? [])];
  if (pool.length === 0) {
    return Object.keys(fixed).length === 0 ? undefined : { ...fixed };
  }

  const min = Math.max(0, itemDef.minSpecialAffixes ?? 0);
  const max = Math.max(min, itemDef.maxSpecialAffixes ?? min);
  const count = clamp(rng.nextInt(min, max), 0, pool.length);
  const rolled: NonNullable<ItemInstance["rolledSpecialAffixes"]> = {};
  for (const [key, value] of Object.entries(fixed) as Array<[ItemSpecialAffixKey, number]>) {
    applySpecialAffixValue(rolled, key, value);
  }

  for (let i = 0; i < count; i += 1) {
    const idx = rng.nextInt(0, pool.length - 1);
    const picked = pool.splice(idx, 1)[0];
    if (picked === undefined) {
      continue;
    }
    const value = rng.nextInt(picked.min, picked.max);
    applySpecialAffixValue(rolled, picked.key, value);
  }

  return Object.keys(rolled).length === 0 ? undefined : rolled;
}

function pickWeightedEntry(entries: LootEntry[], rng: RngLike): LootEntry | null {
  if (entries.length === 0) {
    return null;
  }

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let needle = rng.next() * totalWeight;
  let selected = entries[0]!;

  for (const entry of entries) {
    needle -= entry.weight;
    if (needle <= 0) {
      selected = entry;
      break;
    }
  }

  return selected;
}

function createItemInstance(def: ItemDef, seedFragment: string, rng: RngLike): ItemInstance {
  const kind = def.kind ?? "equipment";
  const rolledSpecialAffixes = rollSpecialAffixes(def, rng);
  return {
    id: `${def.id}-${seedFragment}`,
    defId: def.id,
    name: def.name,
    kind,
    slot: def.slot,
    ...(def.weaponType === undefined ? {} : { weaponType: def.weaponType }),
    rarity: def.rarity,
    requiredLevel: def.requiredLevel,
    iconId: def.iconId,
    seed: seedFragment,
    rolledAffixes: rollAffixes(def, rng),
    ...(rolledSpecialAffixes === undefined ? {} : { rolledSpecialAffixes })
  };
}

export function rollItemDrop(
  lootTable: LootTableDef,
  itemDefs: Record<string, ItemDef>,
  floor: number,
  rng: RngLike,
  seedFragment: string,
  options: RollItemDropOptions = {}
): ItemInstance | null {
  const validEntries = lootTable.entries.filter((entry) => {
    if (entry.minFloor > floor) {
      return false;
    }
    const def = itemDefs[entry.itemDefId];
    if (def === undefined) {
      return false;
    }
    if (options.isItemEligible !== undefined && !options.isItemEligible(def)) {
      return false;
    }
    return true;
  });
  if (validEntries.length === 0) {
    return null;
  }

  const selected = pickWeightedEntry(validEntries, rng);
  if (selected === null) {
    return null;
  }

  const def = itemDefs[selected.itemDefId];
  if (def === undefined) {
    return null;
  }

  return createItemInstance(def, seedFragment, rng);
}

export interface BossDropResult {
  guaranteedRare: ItemInstance;
  guaranteedBossExclusive: ItemInstance;
  bonusDrop?: ItemInstance;
}

export function rollBossDrops(
  rareTable: LootTableDef,
  bossExclusiveTable: LootTableDef,
  itemDefs: Record<string, ItemDef>,
  floor: number,
  rng: RngLike,
  seedFragment: string,
  options: RollItemDropOptions = {}
): BossDropResult {
  const rare = rollItemDrop(rareTable, itemDefs, floor, rng, `${seedFragment}-rare`, options);
  const exclusive = rollItemDrop(bossExclusiveTable, itemDefs, floor, rng, `${seedFragment}-exclusive`, options);

  if (rare === null || exclusive === null) {
    throw new Error("Boss drop tables must be valid and include floor-compatible entries.");
  }

  const bonusDrop =
    rng.next() < 0.35 ? rollItemDrop(rareTable, itemDefs, floor, rng, `${seedFragment}-bonus`, options) : null;

  return {
    guaranteedRare: rare,
    guaranteedBossExclusive: exclusive,
    ...(bonusDrop === null ? {} : { bonusDrop })
  };
}
