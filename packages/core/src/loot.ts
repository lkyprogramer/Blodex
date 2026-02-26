import type { ItemDef, ItemInstance, LootEntry, LootTableDef, RngLike } from "./contracts/types";

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function rollAffixes(itemDef: ItemDef, rng: RngLike): ItemInstance["rolledAffixes"] {
  const rolled: ItemInstance["rolledAffixes"] = {};
  const affixCount = clamp(rng.nextInt(itemDef.minAffixes, itemDef.maxAffixes), 1, itemDef.affixPool.length);
  const pool = [...itemDef.affixPool];

  for (let i = 0; i < affixCount; i += 1) {
    const index = rng.nextInt(0, pool.length - 1);
    const picked = pool.splice(index, 1)[0];
    if (picked === undefined) {
      continue;
    }
    const value = rng.nextInt(picked.min, picked.max);
    rolled[picked.key] = (rolled[picked.key] ?? 0) + value;
  }

  return rolled;
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
  return {
    id: `${def.id}-${seedFragment}`,
    defId: def.id,
    name: def.name,
    slot: def.slot,
    rarity: def.rarity,
    requiredLevel: def.requiredLevel,
    iconId: def.iconId,
    seed: seedFragment,
    rolledAffixes: rollAffixes(def, rng)
  };
}

export function rollItemDrop(
  lootTable: LootTableDef,
  itemDefs: Record<string, ItemDef>,
  floor: number,
  rng: RngLike,
  seedFragment: string
): ItemInstance | null {
  const validEntries = lootTable.entries.filter((entry) => entry.minFloor <= floor);
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
  seedFragment: string
): BossDropResult {
  const rare = rollItemDrop(rareTable, itemDefs, floor, rng, `${seedFragment}-rare`);
  const exclusive = rollItemDrop(bossExclusiveTable, itemDefs, floor, rng, `${seedFragment}-exclusive`);

  if (rare === null || exclusive === null) {
    throw new Error("Boss drop tables must be valid and include floor-compatible entries.");
  }

  const bonusDrop = rng.next() < 0.35 ? rollItemDrop(rareTable, itemDefs, floor, rng, `${seedFragment}-bonus`) : null;

  return {
    guaranteedRare: rare,
    guaranteedBossExclusive: exclusive,
    ...(bonusDrop === null ? {} : { bonusDrop })
  };
}
