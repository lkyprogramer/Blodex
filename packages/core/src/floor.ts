import type { DungeonLayout, FloorConfig, StaircaseState } from "./contracts/types";

function roomCenter(room: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2)
  };
}

export function shouldRevealStaircase(kills: number, floorConfig: FloorConfig): boolean {
  const threshold = Math.ceil(floorConfig.monsterCount * floorConfig.clearThreshold);
  return kills >= threshold;
}

export function findStaircasePosition(
  layout: DungeonLayout,
  playerSpawn: { x: number; y: number }
): { x: number; y: number } {
  if (layout.rooms.length === 0) {
    return { ...playerSpawn };
  }

  let best = roomCenter(layout.rooms[0]!);
  let bestDistance = -1;

  for (const room of layout.rooms) {
    const center = roomCenter(room);
    const distance = Math.hypot(center.x - playerSpawn.x, center.y - playerSpawn.y);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = center;
    }
  }

  return best;
}

export function createStaircaseState(
  layout: DungeonLayout,
  playerSpawn: { x: number; y: number } = layout.playerSpawn
): StaircaseState {
  return {
    position: findStaircasePosition(layout, playerSpawn),
    visible: false
  };
}

export function updateStaircaseState(
  current: StaircaseState,
  kills: number,
  floorConfig: FloorConfig
): StaircaseState {
  if (current.visible || !shouldRevealStaircase(kills, floorConfig)) {
    return current;
  }
  return {
    ...current,
    visible: true
  };
}

export function isPlayerOnStaircase(
  playerPosition: { x: number; y: number },
  staircase: StaircaseState,
  radius = 0.8
): boolean {
  if (!staircase.visible) {
    return false;
  }
  return Math.hypot(playerPosition.x - staircase.position.x, playerPosition.y - staircase.position.y) <= radius;
}
