import type { BiomeId, BranchChoice, RngLike } from "./contracts/types";

const CATACOMBS: BiomeId = "forgotten_catacombs";
const MOLTEN: BiomeId = "molten_caverns";
const FROZEN: BiomeId = "frozen_halls";
const PHANTOM_GRAVEYARD: BiomeId = "phantom_graveyard";
const VENOM_SWAMP: BiomeId = "venom_swamp";
const BONE_THRONE: BiomeId = "bone_throne";

export function resolveBranchChoiceByRoll(roll: number): BranchChoice {
  return roll < 0.5 ? "molten_route" : "frozen_route";
}

export function resolveRouteBiomes(choice: BranchChoice): readonly [BiomeId, BiomeId] {
  if (choice === "molten_route") {
    return [MOLTEN, PHANTOM_GRAVEYARD];
  }
  return [FROZEN, VENOM_SWAMP];
}

export function resolveMidBiomeOrderByRoll(roll: number): readonly [BiomeId, BiomeId] {
  return resolveRouteBiomes(resolveBranchChoiceByRoll(roll));
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
  return resolveRouteBiomes(resolveBranchChoiceBySeed(runSeed));
}

export function resolveBranchChoiceBySeed(runSeed: string): BranchChoice {
  return hashRunSeed(runSeed) % 2 === 0 ? "molten_route" : "frozen_route";
}

export function resolveBiomeForFloor(
  floor: number,
  midOrderOrChoice: readonly [BiomeId, BiomeId] | BranchChoice
): BiomeId {
  if (floor <= 2) {
    return CATACOMBS;
  }
  if (floor >= 5) {
    return BONE_THRONE;
  }
  const midOrder =
    typeof midOrderOrChoice === "string" ? resolveRouteBiomes(midOrderOrChoice) : midOrderOrChoice;
  if (floor === 3) {
    return midOrder[0];
  }
  return midOrder[1];
}

export function resolveBiomeForFloorBySeed(
  floor: number,
  runSeed: string,
  branchChoice?: BranchChoice
): BiomeId {
  return resolveBiomeForFloor(floor, branchChoice ?? resolveBranchChoiceBySeed(runSeed));
}
