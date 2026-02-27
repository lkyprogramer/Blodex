import type {
  BiomeId,
  EventChoice,
  EventCost,
  MerchantOffer,
  RandomEventDef,
  RngLike
} from "./contracts/types";

interface WeightedCandidate {
  itemDefId: string;
  weight: number;
  minFloor: number;
}

function pickWeighted<T>(
  entries: T[],
  rng: RngLike,
  getWeight: (entry: T) => number
): T | null {
  if (entries.length === 0) {
    return null;
  }
  const total = entries.reduce((sum, entry) => sum + getWeight(entry), 0);
  let needle = rng.next() * total;
  for (const entry of entries) {
    needle -= getWeight(entry);
    if (needle <= 0) {
      return entry;
    }
  }
  return entries[entries.length - 1] ?? null;
}

export function pickRandomEvent(
  events: RandomEventDef[],
  floor: number,
  biomeId: BiomeId,
  unlockedEventIds: string[],
  rng: RngLike
): RandomEventDef | null {
  const filtered = events.filter((eventDef) => {
    const inFloor = floor >= eventDef.floorRange.min && floor <= eventDef.floorRange.max;
    if (!inFloor) {
      return false;
    }
    if (eventDef.biomeIds !== undefined && !eventDef.biomeIds.includes(biomeId)) {
      return false;
    }
    if (eventDef.unlockId !== undefined && !unlockedEventIds.includes(eventDef.unlockId)) {
      return false;
    }
    return true;
  });
  return pickWeighted(filtered, rng, (eventDef) => eventDef.spawnWeight);
}

export function canPayEventCost(
  cost: EventCost | undefined,
  health: number,
  mana: number,
  obols: number
): boolean {
  if (cost === undefined) {
    return true;
  }
  if (cost.type === "health") {
    return health > cost.amount;
  }
  if (cost.type === "mana") {
    return mana >= cost.amount;
  }
  return obols >= cost.amount;
}

export function rollEventRisk(choice: EventChoice, rng: RngLike): boolean {
  if (choice.risk === undefined) {
    return false;
  }
  return rng.next() < choice.risk.chance;
}

export function createMerchantOffers(
  candidates: WeightedCandidate[],
  floor: number,
  rng: RngLike,
  count = 3
): MerchantOffer[] {
  const valid = candidates.filter((candidate) => candidate.minFloor <= floor);
  if (valid.length === 0 || count <= 0) {
    return [];
  }

  const pool = [...valid];
  const offers: MerchantOffer[] = [];

  while (offers.length < count && pool.length > 0) {
    const picked = pickWeighted(pool, rng, (entry) => entry.weight);
    if (picked === null) {
      break;
    }
    const idx = pool.findIndex((entry) => entry.itemDefId === picked.itemDefId);
    if (idx >= 0) {
      pool.splice(idx, 1);
    }
    offers.push({
      offerId: `offer-${offers.length}`,
      itemDefId: picked.itemDefId,
      priceObol: rng.nextInt(5, 15)
    });
  }

  return offers;
}
