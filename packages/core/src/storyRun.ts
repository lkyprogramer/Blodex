export const DEFAULT_STORY_MAX_FLOOR = 8;
export const PHASE6_BASELINE_MAX_FLOOR = 5;

export type StoryPowerSpikePairId = `${number}` | `${number}-${number}`;

export interface StoryPowerSpikePair {
  id: StoryPowerSpikePairId;
  startFloor: number;
  endFloor: number;
}

export const STORY_BRANCH_FLOORS = [2, 6] as const;
export const STORY_GUARANTEED_CHALLENGE_FLOORS = [7] as const;
export const STORY_GUARANTEED_MERCHANT_FLOORS = [2, 4, 7] as const;
export const STORY_GUARANTEED_EVENT_FLOORS = {
  3: "forge_anvil",
  5: "gambler_cache"
} as const satisfies Partial<Record<number, string>>;

const STORY_BRANCH_FLOOR_SET = new Set<number>(STORY_BRANCH_FLOORS);
const STORY_GUARANTEED_CHALLENGE_FLOOR_SET = new Set<number>(STORY_GUARANTEED_CHALLENGE_FLOORS);
const STORY_GUARANTEED_MERCHANT_FLOOR_SET = new Set<number>(STORY_GUARANTEED_MERCHANT_FLOORS);

export function resolveStoryMaxFloor(maxFloors = DEFAULT_STORY_MAX_FLOOR): number {
  return Math.max(1, Math.floor(maxFloors));
}

export function isStoryBossFloor(floor: number, maxFloors = DEFAULT_STORY_MAX_FLOOR): boolean {
  return Math.max(1, Math.floor(floor)) >= resolveStoryMaxFloor(maxFloors);
}

export function isStoryBranchFloor(floor: number): boolean {
  return STORY_BRANCH_FLOOR_SET.has(Math.max(1, Math.floor(floor)));
}

export function isGuaranteedChallengeFloor(floor: number): boolean {
  return STORY_GUARANTEED_CHALLENGE_FLOOR_SET.has(Math.max(1, Math.floor(floor)));
}

export function isGuaranteedMerchantFloor(floor: number): boolean {
  return STORY_GUARANTEED_MERCHANT_FLOOR_SET.has(Math.max(1, Math.floor(floor)));
}

export function resolveGuaranteedEventIdForFloor(floor: number): string | undefined {
  return STORY_GUARANTEED_EVENT_FLOORS[Math.max(1, Math.floor(floor)) as keyof typeof STORY_GUARANTEED_EVENT_FLOORS];
}

export function resolveEndlessStartFloor(maxFloors = DEFAULT_STORY_MAX_FLOOR): number {
  return resolveStoryMaxFloor(maxFloors) + 1;
}

export function resolveStoryPowerSpikePairs(maxFloors = DEFAULT_STORY_MAX_FLOOR): StoryPowerSpikePair[] {
  const storyMaxFloor = resolveStoryMaxFloor(maxFloors);
  const pairs: StoryPowerSpikePair[] = [];
  for (let startFloor = 1; startFloor <= storyMaxFloor; startFloor += 2) {
    const endFloor = Math.min(storyMaxFloor, startFloor + 1);
    pairs.push({
      id: startFloor === endFloor ? `${startFloor}` : `${startFloor}-${endFloor}`,
      startFloor,
      endFloor
    });
  }
  return pairs;
}

export function resolveStoryPowerSpikePairIds(maxFloors = DEFAULT_STORY_MAX_FLOOR): StoryPowerSpikePairId[] {
  return resolveStoryPowerSpikePairs(maxFloors).map((pair) => pair.id);
}

export function resolveStoryPowerSpikePairId(
  floor: number,
  maxFloors = DEFAULT_STORY_MAX_FLOOR
): StoryPowerSpikePairId {
  const normalizedFloor = Math.max(1, Math.floor(floor));
  const pair =
    resolveStoryPowerSpikePairs(maxFloors).find(
      (candidate) => normalizedFloor >= candidate.startFloor && normalizedFloor <= candidate.endFloor
    ) ?? resolveStoryPowerSpikePairs(maxFloors).at(-1);
  if (pair === undefined) {
    return "1";
  }
  return pair.id;
}

export function isTerminalStoryPowerSpikePairId(
  pairId: StoryPowerSpikePairId,
  maxFloors = DEFAULT_STORY_MAX_FLOOR
): boolean {
  const pairs = resolveStoryPowerSpikePairs(maxFloors);
  return pairs.at(-1)?.id === pairId;
}
