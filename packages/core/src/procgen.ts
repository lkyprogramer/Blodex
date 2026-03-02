import type {
  DungeonCorridor,
  DungeonLayout,
  DungeonRoom,
  HiddenRoomState
} from "./contracts/types";
import { SeededRng } from "./rng";

function createGrid(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => false));
}

function carveRoom(grid: boolean[][], room: DungeonRoom): void {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      grid[y]![x] = true;
    }
  }
}

function center(room: DungeonRoom): { x: number; y: number } {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2)
  };
}

function carveCorridor(
  grid: boolean[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);

  while (x !== to.x) {
    grid[y]![x] = true;
    points.push({ x, y });
    x += dx;
  }

  while (y !== to.y) {
    grid[y]![x] = true;
    points.push({ x, y });
    y += dy;
  }

  grid[y]![x] = true;
  points.push({ x, y });
  return points;
}

function roomsOverlap(a: DungeonRoom, b: DungeonRoom): boolean {
  return !(
    a.x + a.width + 1 < b.x ||
    b.x + b.width + 1 < a.x ||
    a.y + a.height + 1 < b.y ||
    b.y + b.height + 1 < a.y
  );
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function isInsideRoom(room: DungeonRoom, x: number, y: number): boolean {
  return x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height;
}

function isRoomInBounds(room: DungeonRoom, width: number, height: number): boolean {
  return room.x >= 1 && room.y >= 1 && room.x + room.width <= width - 1 && room.y + room.height <= height - 1;
}

function tryGenerateHiddenRoom(
  options: ProcgenOptions,
  floorNumber: number,
  rng: SeededRng,
  grid: boolean[][],
  rooms: DungeonRoom[]
): HiddenRoomState[] {
  if (floorNumber < 2 || rooms.length < 2) {
    return [];
  }

  const maxAttempts = 24;
  const minHiddenSize = Math.max(3, options.minRoomSize - 1);
  const maxHiddenSize = Math.max(minHiddenSize, Math.min(options.maxRoomSize, minHiddenSize + 2));
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const baseRoom = rooms[rng.nextInt(1, rooms.length - 1)];
    if (baseRoom === undefined) {
      continue;
    }
    const baseCenter = center(baseRoom);
    const roomWidth = rng.nextInt(minHiddenSize, maxHiddenSize);
    const roomHeight = rng.nextInt(minHiddenSize, maxHiddenSize);
    const direction = directions[rng.nextInt(0, directions.length - 1)];
    if (direction === undefined) {
      continue;
    }

    let roomX = 0;
    let roomY = 0;
    if (direction.dx === 1) {
      roomX = baseRoom.x + baseRoom.width + 2;
      roomY = clamp(baseCenter.y - Math.floor(roomHeight / 2), 1, options.height - roomHeight - 1);
    } else if (direction.dx === -1) {
      roomX = baseRoom.x - roomWidth - 2;
      roomY = clamp(baseCenter.y - Math.floor(roomHeight / 2), 1, options.height - roomHeight - 1);
    } else if (direction.dy === 1) {
      roomX = clamp(baseCenter.x - Math.floor(roomWidth / 2), 1, options.width - roomWidth - 1);
      roomY = baseRoom.y + baseRoom.height + 2;
    } else {
      roomX = clamp(baseCenter.x - Math.floor(roomWidth / 2), 1, options.width - roomWidth - 1);
      roomY = baseRoom.y - roomHeight - 2;
    }

    const hiddenRoom: DungeonRoom = {
      id: `hidden-room-${attempt}`,
      x: roomX,
      y: roomY,
      width: roomWidth,
      height: roomHeight
    };

    if (!isRoomInBounds(hiddenRoom, options.width, options.height)) {
      continue;
    }
    if (rooms.some((room) => roomsOverlap(hiddenRoom, room))) {
      continue;
    }

    carveRoom(grid, hiddenRoom);
    const hiddenCenter = center(hiddenRoom);
    const branchPath = carveCorridor(grid, baseCenter, hiddenCenter);
    const entrance = branchPath.find((point) => !isInsideRoom(baseRoom, point.x, point.y));
    if (entrance === undefined) {
      continue;
    }

    grid[entrance.y]![entrance.x] = false;
    return [
      {
        roomId: hiddenRoom.id,
        entrance: { x: entrance.x, y: entrance.y },
        revealed: false,
        rewardsClaimed: false
      }
    ];
  }

  return [];
}

export interface ProcgenOptions {
  width: number;
  height: number;
  roomCount?: number;
  minRoomSize: number;
  maxRoomSize: number;
  seed: string;
  floorNumber?: number;
}

function defaultRoomCountByFloor(floorNumber: number | undefined): number {
  if (floorNumber === undefined) {
    return 12;
  }
  if (floorNumber >= 5) {
    return 1;
  }
  if (floorNumber >= 3) {
    return 14;
  }
  return 12;
}

export function generateBossRoom(seed: string, width = 46, height = 46): DungeonLayout {
  const grid = createGrid(width, height);
  const roomWidth = 12;
  const roomHeight = 12;
  const roomX = Math.floor((width - roomWidth) / 2);
  const roomY = Math.floor((height - roomHeight) / 2);
  const bossRoom: DungeonRoom = {
    id: "boss-room",
    x: roomX,
    y: roomY,
    width: roomWidth,
    height: roomHeight
  };

  carveRoom(grid, bossRoom);

  const entrance = {
    x: Math.floor(width / 2),
    y: Math.max(1, roomY - 8)
  };
  const roomCenter = center(bossRoom);
  const corridorPath = carveCorridor(grid, entrance, roomCenter);

  return {
    width,
    height,
    walkable: grid,
    rooms: [bossRoom],
    corridors: [
      {
        fromRoomId: "entrance",
        toRoomId: bossRoom.id,
        path: corridorPath
      }
    ],
    spawnPoints: [
      { x: roomCenter.x - 2, y: roomCenter.y },
      { x: roomCenter.x + 2, y: roomCenter.y }
    ],
    playerSpawn: entrance,
    hiddenRooms: [],
    layoutHash: `${seed}:boss:${width}x${height}`
  };
}

export function generateDungeon(options: ProcgenOptions): DungeonLayout {
  const floorNumber = options.floorNumber ?? 1;
  const resolvedRoomCount = options.roomCount ?? defaultRoomCountByFloor(floorNumber);

  if (floorNumber >= 5 && resolvedRoomCount <= 1) {
    return generateBossRoom(options.seed, options.width, options.height);
  }

  const rng = new SeededRng(options.seed);
  const grid = createGrid(options.width, options.height);
  const rooms: DungeonRoom[] = [];

  for (let attempt = 0; attempt < resolvedRoomCount * 6 && rooms.length < resolvedRoomCount; attempt += 1) {
    const width = rng.nextInt(options.minRoomSize, options.maxRoomSize);
    const height = rng.nextInt(options.minRoomSize, options.maxRoomSize);
    const x = rng.nextInt(1, options.width - width - 2);
    const y = rng.nextInt(1, options.height - height - 2);

    const room: DungeonRoom = {
      id: `room-${rooms.length}`,
      x,
      y,
      width,
      height
    };

    if (rooms.some((existing) => roomsOverlap(room, existing))) {
      continue;
    }

    rooms.push(room);
    carveRoom(grid, room);
  }

  if (rooms.length < 2) {
    throw new Error("Procgen failed to place enough rooms.");
  }

  const corridors: DungeonCorridor[] = [];
  for (let i = 1; i < rooms.length; i += 1) {
    const fromRoom = rooms[i - 1]!;
    const toRoom = rooms[i]!;
    const path = carveCorridor(grid, center(fromRoom), center(toRoom));
    corridors.push({
      fromRoomId: fromRoom.id,
      toRoomId: toRoom.id,
      path
    });
  }

  const hiddenRooms = tryGenerateHiddenRoom(options, floorNumber, rng, grid, rooms);
  const hiddenRoomIdSet = new Set(hiddenRooms.map((entry) => entry.roomId));
  const spawnPoints = rooms
    .filter((room) => !hiddenRoomIdSet.has(room.id))
    .slice(1)
    .map((room) => center(room));
  const playerSpawn = center(rooms[0]!);
  const hiddenHashPart = hiddenRooms
    .map((entry) => `${entry.roomId}@${entry.entrance.x},${entry.entrance.y}`)
    .join("|");
  const layoutHash = `${options.seed}:${rooms.length}:${corridors.length}:${floorNumber}:${hiddenHashPart}`;

  return {
    width: options.width,
    height: options.height,
    walkable: grid,
    rooms,
    corridors,
    spawnPoints,
    playerSpawn,
    hiddenRooms,
    layoutHash
  };
}
