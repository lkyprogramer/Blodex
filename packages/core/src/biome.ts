import type { BiomeId, RngLike } from "./contracts/types";

const CATACOMBS: BiomeId = "forgotten_catacombs";
const MOLTEN: BiomeId = "molten_caverns";
const FROZEN: BiomeId = "frozen_halls";
const BONE_THRONE: BiomeId = "bone_throne";

export function resolveMidBiomeOrderByRoll(roll: number): readonly [BiomeId, BiomeId] {
  return roll < 0.5 ? [MOLTEN, FROZEN] : [FROZEN, MOLTEN];
}

export function resolveMidBiomeOrder(rng: RngLike): readonly [BiomeId, BiomeId] {
  return resolveMidBiomeOrderByRoll(rng.next());
}

function hashRunSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveMidBiomeOrderBySeed(runSeed: string): readonly [BiomeId, BiomeId] {
  const parity = hashRunSeed(runSeed) % 2;
  return parity === 0 ? [MOLTEN, FROZEN] : [FROZEN, MOLTEN];
}

export function resolveBiomeForFloor(floor: number, midOrder: readonly [BiomeId, BiomeId]): BiomeId {
  if (floor <= 2) {
    return CATACOMBS;
  }
  if (floor === 3) {
    return midOrder[0];
  }
  if (floor === 4) {
    return midOrder[1];
  }
  return BONE_THRONE;
}

export function resolveBiomeForFloorBySeed(floor: number, runSeed: string): BiomeId {
  return resolveBiomeForFloor(floor, resolveMidBiomeOrderBySeed(runSeed));
}

