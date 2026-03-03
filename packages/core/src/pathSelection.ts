import type {
  BiomeId,
  BranchChoice,
  BranchStairOption,
  DungeonLayout,
  StaircaseState
} from "./contracts/types";

const BRANCH_TARGETS: Record<BranchChoice, BiomeId> = {
  molten_route: "molten_caverns",
  frozen_route: "frozen_halls"
};

const BRANCH_LABELS: Record<BranchChoice, string> = {
  molten_route: "Molten Route",
  frozen_route: "Frozen Route"
};

function roomCenter(room: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2)
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findBranchPositions(
  layout: DungeonLayout,
  playerSpawn: { x: number; y: number }
): [{ x: number; y: number }, { x: number; y: number }] {
  const centers = layout.rooms.map((room) => roomCenter(room));
  if (centers.length === 0) {
    return [
      { x: playerSpawn.x + 2, y: playerSpawn.y },
      { x: playerSpawn.x - 2, y: playerSpawn.y }
    ];
  }

  const sorted = [...centers].sort((left, right) => distance(right, playerSpawn) - distance(left, playerSpawn));
  const first = sorted[0] ?? playerSpawn;
  const second = sorted.find((candidate) => candidate.x !== first.x || candidate.y !== first.y) ?? {
    x: first.x + 2,
    y: first.y
  };
  return first.x <= second.x ? [first, second] : [second, first];
}

export function resolveBranchChoiceFromSide(side: "left" | "right"): BranchChoice {
  return side === "left" ? "molten_route" : "frozen_route";
}

export function resolveBranchChoiceFromTargetBiome(targetBiome: BiomeId): BranchChoice | undefined {
  if (targetBiome === "molten_caverns") {
    return "molten_route";
  }
  if (targetBiome === "frozen_halls") {
    return "frozen_route";
  }
  return undefined;
}

export function createBranchStairOptions(
  layout: DungeonLayout,
  playerSpawn: { x: number; y: number } = layout.playerSpawn
): [BranchStairOption, BranchStairOption] {
  const [left, right] = findBranchPositions(layout, playerSpawn);
  return [
    {
      position: left,
      targetBiome: BRANCH_TARGETS.molten_route,
      label: BRANCH_LABELS.molten_route
    },
    {
      position: right,
      targetBiome: BRANCH_TARGETS.frozen_route,
      label: BRANCH_LABELS.frozen_route
    }
  ];
}

export function createBranchStaircaseState(
  layout: DungeonLayout,
  playerSpawn: { x: number; y: number } = layout.playerSpawn
): StaircaseState {
  return {
    kind: "branch",
    position: { ...playerSpawn },
    visible: false,
    options: createBranchStairOptions(layout, playerSpawn)
  };
}

export function resolveBranchSideAtPosition(
  staircase: StaircaseState,
  playerPosition: { x: number; y: number },
  radius = 0.8
): "left" | "right" | undefined {
  if (!staircase.visible || staircase.kind !== "branch" || staircase.options === undefined) {
    return undefined;
  }
  const [left, right] = staircase.options;
  if (distance(playerPosition, left.position) <= radius) {
    return "left";
  }
  if (distance(playerPosition, right.position) <= radius) {
    return "right";
  }
  return undefined;
}
