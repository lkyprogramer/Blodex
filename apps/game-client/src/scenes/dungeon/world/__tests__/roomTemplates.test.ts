import { describe, expect, it } from "vitest";
import type { DungeonLayout } from "@blodex/core";
import { applyRoomTemplatesToDungeon } from "../roomTemplates";

function fillRect(walkable: boolean[][], x: number, y: number, width: number, height: number): void {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      walkable[row]![col] = true;
    }
  }
}

function fillCorridor(
  walkable: boolean[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  let currentX = from.x;
  let currentY = from.y;
  while (currentX !== to.x) {
    walkable[currentY]![currentX] = true;
    path.push({ x: currentX, y: currentY });
    currentX += currentX < to.x ? 1 : -1;
  }
  while (currentY !== to.y) {
    walkable[currentY]![currentX] = true;
    path.push({ x: currentX, y: currentY });
    currentY += currentY < to.y ? 1 : -1;
  }
  walkable[currentY]![currentX] = true;
  path.push({ x: currentX, y: currentY });
  return path;
}

function createBaseLayout(): DungeonLayout {
  const width = 46;
  const height = 46;
  const walkable = Array.from({ length: height }, () => Array.from({ length: width }, () => false));
  const rooms: DungeonLayout["rooms"] = [
    { id: "room-0", x: 2, y: 2, width: 6, height: 6 },
    { id: "room-1", x: 12, y: 2, width: 10, height: 8 },
    { id: "room-2", x: 27, y: 2, width: 8, height: 8 },
    { id: "room-3", x: 2, y: 15, width: 5, height: 12 },
    { id: "room-4", x: 13, y: 17, width: 8, height: 7 },
    { id: "room-5", x: 27, y: 16, width: 9, height: 6 }
  ];
  for (const room of rooms) {
    fillRect(walkable, room.x, room.y, room.width, room.height);
  }
  const roomCenters = rooms.map((room) => ({
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2)
  }));
  const corridors: DungeonLayout["corridors"] = [
    {
      fromRoomId: rooms[0]!.id,
      toRoomId: rooms[1]!.id,
      path: fillCorridor(walkable, roomCenters[0]!, roomCenters[1]!)
    },
    {
      fromRoomId: rooms[1]!.id,
      toRoomId: rooms[2]!.id,
      path: fillCorridor(walkable, roomCenters[1]!, roomCenters[2]!)
    },
    {
      fromRoomId: rooms[0]!.id,
      toRoomId: rooms[3]!.id,
      path: fillCorridor(walkable, roomCenters[0]!, roomCenters[3]!)
    },
    {
      fromRoomId: rooms[3]!.id,
      toRoomId: rooms[4]!.id,
      path: fillCorridor(walkable, roomCenters[3]!, roomCenters[4]!)
    },
    {
      fromRoomId: rooms[4]!.id,
      toRoomId: rooms[5]!.id,
      path: fillCorridor(walkable, roomCenters[4]!, roomCenters[5]!)
    }
  ];

  return {
    width,
    height,
    walkable,
    rooms,
    corridors,
    spawnPoints: roomCenters.slice(1),
    playerSpawn: roomCenters[0]!,
    layoutHash: "room-templates-test-layout"
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
  const visited = new Set<string>([`${from.x}:${from.y}`]);
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
      const next = { x: current.x + offset.x, y: current.y + offset.y };
      if (!walkable[next.y]?.[next.x]) {
        continue;
      }
      const key = `${next.x}:${next.y}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push(next);
    }
  }

  return false;
}

describe("applyRoomTemplatesToDungeon", () => {
  it("assigns deterministic templates, props, and authored spawn points", () => {
    const base = createBaseLayout();

    const first = applyRoomTemplatesToDungeon({
      layout: base,
      biomeId: "forgotten_catacombs",
      floorNumber: 4,
      pacingKind: "combat",
      seed: "room-template-seed"
    });
    const second = applyRoomTemplatesToDungeon({
      layout: base,
      biomeId: "forgotten_catacombs",
      floorNumber: 4,
      pacingKind: "combat",
      seed: "room-template-seed"
    });

    expect(first.layoutHash).toBe(second.layoutHash);
    expect(first.rooms).toEqual(second.rooms);
    expect(first.props).toEqual(second.props);
    expect(first.spawnPoints).toEqual(second.spawnPoints);
    expect(first.rooms.some((room) => room.templateId !== undefined)).toBe(true);
  });

  it("keeps props inside their source rooms and preserves a walkable route to authored spawn points", () => {
    const base = createBaseLayout();
    const decorated = applyRoomTemplatesToDungeon({
      layout: base,
      biomeId: "molten_caverns",
      floorNumber: 6,
      pacingKind: "combat",
      seed: "room-template-connectivity"
    });
    const spawnKeySet = new Set(decorated.spawnPoints.map((point) => `${point.x}:${point.y}`));

    expect(decorated.props?.length ?? 0).toBeGreaterThan(0);
    for (const prop of decorated.props ?? []) {
      const room = decorated.rooms.find((entry) => entry.id === prop.roomId);
      expect(room).toBeDefined();
      expect(prop.position.x).toBeGreaterThanOrEqual(room!.x);
      expect(prop.position.x).toBeLessThan(room!.x + room!.width);
      expect(prop.position.y).toBeGreaterThanOrEqual(room!.y);
      expect(prop.position.y).toBeLessThan(room!.y + room!.height);
      if (prop.blocking) {
        expect(spawnKeySet.has(`${prop.position.x}:${prop.position.y}`)).toBe(false);
      }
    }

    for (const room of decorated.rooms.slice(1)) {
      for (const point of room.authoredSpawnPoints ?? []) {
        expect(isReachable(decorated.walkable, decorated.playerSpawn, point)).toBe(true);
      }
    }
  });

  it("keeps corridor centerlines walkable when blocking props land near room entrances", () => {
    const narrowLayout: DungeonLayout = {
      width: 24,
      height: 16,
      walkable: Array.from({ length: 16 }, () => Array.from({ length: 24 }, () => false)),
      rooms: [
        { id: "room-0", x: 1, y: 5, width: 6, height: 6 },
        { id: "room-1", x: 9, y: 4, width: 6, height: 6 },
        { id: "room-2", x: 17, y: 5, width: 6, height: 6 }
      ],
      corridors: [],
      spawnPoints: [],
      playerSpawn: { x: 4, y: 8 },
      layoutHash: "room-template-corridor-guard"
    };
    for (const room of narrowLayout.rooms) {
      fillRect(narrowLayout.walkable, room.x, room.y, room.width, room.height);
    }
    const roomCenters = narrowLayout.rooms.map((room) => ({
      x: Math.floor(room.x + room.width / 2),
      y: Math.floor(room.y + room.height / 2)
    }));
    narrowLayout.corridors = [
      {
        fromRoomId: "room-0",
        toRoomId: "room-1",
        path: fillCorridor(narrowLayout.walkable, roomCenters[0]!, roomCenters[1]!)
      },
      {
        fromRoomId: "room-1",
        toRoomId: "room-2",
        path: fillCorridor(narrowLayout.walkable, roomCenters[1]!, roomCenters[2]!)
      }
    ];
    narrowLayout.spawnPoints = roomCenters.slice(1);

    const decorated = applyRoomTemplatesToDungeon({
      layout: narrowLayout,
      biomeId: "frozen_halls",
      floorNumber: 5,
      pacingKind: "combat",
      seed: "room-template-study-corridor"
    });

    for (const corridor of decorated.corridors) {
      for (const point of corridor.path) {
        expect(decorated.walkable[point.y]?.[point.x]).toBe(true);
      }
    }
    for (const point of decorated.spawnPoints) {
      expect(isReachable(decorated.walkable, decorated.playerSpawn, point)).toBe(true);
    }
  });
});
