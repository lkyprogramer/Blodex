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

export interface MerchantPricingPolicy {
  minPrice?: number;
  maxPrice?: number;
  floorPriceStep?: number;
  scarcitySurcharge?: number;
  priceMultiplier?: number;
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

export function resolveEventRiskChance(choice: EventChoice, riskChanceBonus = 0): number {
  if (choice.risk === undefined) {
    return 0;
  }
  return Math.min(0.95, Math.max(0, choice.risk.chance + riskChanceBonus));
}

export function rollEventRisk(choice: EventChoice, rng: RngLike, riskChanceBonus = 0): boolean {
  const chance = resolveEventRiskChance(choice, riskChanceBonus);
  if (chance <= 0) {
    return false;
  }
  return rng.next() < chance;
}

export function createMerchantOffers(
  candidates: WeightedCandidate[],
  floor: number,
  rng: RngLike,
  count = 3,
  pricing: MerchantPricingPolicy = {}
): MerchantOffer[] {
  const valid = candidates.filter((candidate) => candidate.minFloor <= floor);
  if (valid.length === 0 || count <= 0) {
    return [];
  }

  const pool = [...valid];
  const offers: MerchantOffer[] = [];

  const minPrice = Math.max(1, Math.floor(pricing.minPrice ?? 5));
  const maxPrice = Math.max(minPrice, Math.floor(pricing.maxPrice ?? 15));
  const floorPriceStep = Math.max(0, Math.floor(pricing.floorPriceStep ?? 0));
  const scarcitySurcharge = Math.max(0, Math.floor(pricing.scarcitySurcharge ?? 0));
  const priceMultiplier = Math.max(0.5, pricing.priceMultiplier ?? 1);

  while (offers.length < count && pool.length > 0) {
    const picked = pickWeighted(pool, rng, (entry) => entry.weight);
    if (picked === null) {
      break;
    }
    const idx = pool.findIndex((entry) => entry.itemDefId === picked.itemDefId);
    if (idx >= 0) {
      pool.splice(idx, 1);
    }
    const basePrice = rng.nextInt(minPrice, maxPrice);
    const adjustedPrice = Math.max(
      minPrice,
      Math.floor((basePrice + floorPriceStep + scarcitySurcharge) * priceMultiplier)
    );
    offers.push({
      offerId: `offer-${offers.length}`,
      itemDefId: picked.itemDefId,
      priceObol: adjustedPrice
    });
  }

  return offers;
}
