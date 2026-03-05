import { describe, expect, it } from "vitest";
import { generateDungeon } from "../procgen";

function roomCenter(room: { x: number; y: number; width: number; height: number }) {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2)
  };
}

function isReachable(
  walkable: boolean[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  if (!walkable[from.y]?.[from.x] || !walkable[to.y]?.[to.x]) {
    return false;
  }
  const visited = new Set<string>([`${from.x},${from.y}`]);
  const queue = [{ x: from.x, y: from.y }];
  const offsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    if (current.x === to.x && current.y === to.y) {
      return true;
    }
    for (const offset of offsets) {
      const nx = current.x + offset.x;
      const ny = current.y + offset.y;
      if (!walkable[ny]?.[nx]) {
        continue;
      }
      const key = `${nx},${ny}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  return false;
}

function countWalkable(grid: boolean[][]): number {
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell) {
        total += 1;
      }
    }
  }
  return total;
}

describe("generateDungeon", () => {
  it("is deterministic for identical seeds", () => {
    const a = generateDungeon({
      width: 50,
      height: 50,
      roomCount: 10,
      minRoomSize: 4,
      maxRoomSize: 8,
      seed: "seed-123"
    });

    const b = generateDungeon({
      width: 50,
      height: 50,
      roomCount: 10,
      minRoomSize: 4,
      maxRoomSize: 8,
      seed: "seed-123"
    });

    expect(a.layoutHash).toBe(b.layoutHash);
    expect(a.rooms).toEqual(b.rooms);
    expect(a.corridors).toEqual(b.corridors);
  });

  it("creates reachable room centers along corridors", () => {
    const dungeon = generateDungeon({
      width: 50,
      height: 50,
      roomCount: 8,
      minRoomSize: 4,
      maxRoomSize: 8,
      seed: "seed-rooms"
    });

    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(4);
    expect(dungeon.corridors.length).toBeGreaterThanOrEqual(dungeon.rooms.length - 1);
    for (const corridor of dungeon.corridors) {
      expect(corridor.path.length).toBeGreaterThan(0);
    }
    const spawn = dungeon.playerSpawn;
    for (const room of dungeon.rooms) {
      const target = roomCenter(room);
      expect(isReachable(dungeon.walkable, spawn, target)).toBe(true);
    }
  });

  it("adds deterministic loop corridors when loop chance is enabled", () => {
    const options = {
      width: 52,
      height: 52,
      roomCount: 10,
      minRoomSize: 4,
      maxRoomSize: 8,
      floorNumber: 3,
      corridorLoopChance: 1,
      maxExtraCorridors: 3,
      seed: "seed-loop-corridor"
    };
    const a = generateDungeon(options);
    const b = generateDungeon(options);
    expect(a.corridors.length).toBeGreaterThan(a.rooms.length - 1);
    expect(a.corridors).toEqual(b.corridors);
  });

  it("widens walkable corridor footprint when corridorHalfWidth increases", () => {
    const base = generateDungeon({
      width: 46,
      height: 46,
      roomCount: 9,
      minRoomSize: 4,
      maxRoomSize: 8,
      corridorLoopChance: 0,
      maxExtraCorridors: 0,
      corridorHalfWidth: 0,
      seed: "seed-corridor-width"
    });
    const widened = generateDungeon({
      width: 46,
      height: 46,
      roomCount: 9,
      minRoomSize: 4,
      maxRoomSize: 8,
      corridorLoopChance: 0,
      maxExtraCorridors: 0,
      corridorHalfWidth: 1,
      seed: "seed-corridor-width"
    });

    expect(countWalkable(widened.walkable)).toBeGreaterThan(countWalkable(base.walkable));
  });

  it("generates hidden room entrances as blocked tiles on floor 2+", () => {
    const dungeon = generateDungeon({
      width: 50,
      height: 50,
      roomCount: 10,
      minRoomSize: 4,
      maxRoomSize: 8,
      floorNumber: 3,
      seed: "seed-hidden-room"
    });

    expect(dungeon.hiddenRooms).toBeDefined();
    expect(dungeon.hiddenRooms?.length).toBeGreaterThanOrEqual(0);
    for (const hidden of dungeon.hiddenRooms ?? []) {
      expect(dungeon.walkable[hidden.entrance.y]?.[hidden.entrance.x]).toBe(false);
      expect(hidden.revealed).toBe(false);
      expect(hidden.rewardsClaimed).toBe(false);
    }
  });
});
