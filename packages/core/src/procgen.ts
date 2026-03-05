import type {
  DungeonCorridor,
  DungeonLayout,
  DungeonRoom,
  HiddenRoomState
} from "./contracts/types";
import { SeededRng } from "./rng";

type CorridorAxisFirst = "horizontal" | "vertical";

interface CarveCorridorOptions {
  halfWidth?: number;
  axisFirst?: CorridorAxisFirst;
}

interface RoomEdge {
  fromIndex: number;
  toIndex: number;
  distance: number;
  key: string;
}

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

function carveBrush(grid: boolean[][], x: number, y: number, halfWidth: number): void {
  const maxY = grid.length - 1;
  const maxX = grid[0]?.length !== undefined ? grid[0].length - 1 : -1;
  if (maxX < 0 || maxY < 0) {
    return;
  }

  const minX = Math.max(0, x - halfWidth);
  const minY = Math.max(0, y - halfWidth);
  const cappedMaxX = Math.min(maxX, x + halfWidth);
  const cappedMaxY = Math.min(maxY, y + halfWidth);
  for (let yy = minY; yy <= cappedMaxY; yy += 1) {
    for (let xx = minX; xx <= cappedMaxX; xx += 1) {
      grid[yy]![xx] = true;
    }
  }
}

function carveCorridor(
  grid: boolean[][],
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: CarveCorridorOptions = {}
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const halfWidth = Math.max(0, Math.floor(options.halfWidth ?? 0));
  const axisFirst = options.axisFirst ?? "horizontal";
  let x = from.x;
  let y = from.y;
  const mark = () => {
    carveBrush(grid, x, y, halfWidth);
    points.push({ x, y });
  };
  const stepHorizontal = () => {
    const dx = Math.sign(to.x - x);
    while (x !== to.x) {
      mark();
      x += dx;
    }
  };
  const stepVertical = () => {
    const dy = Math.sign(to.y - y);
    while (y !== to.y) {
      mark();
      y += dy;
    }
  };

  if (axisFirst === "vertical") {
    stepVertical();
    stepHorizontal();
  } else {
    stepHorizontal();
    stepVertical();
  }

  mark();
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

function normalizeRatio(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return clamp(value, 0, 1);
}

function resolveMainCorridorHalfWidth(floorNumber: number, override: number | undefined): number {
  if (override !== undefined && !Number.isNaN(override)) {
    return Math.max(0, Math.floor(override));
  }
  return floorNumber >= 2 ? 1 : 0;
}

function resolveLoopChance(floorNumber: number, override: number | undefined): number {
  if (override !== undefined) {
    return normalizeRatio(override, 0.2);
  }
  if (floorNumber >= 4) {
    return 0.38;
  }
  if (floorNumber >= 2) {
    return 0.28;
  }
  return 0.16;
}

function resolveMaxExtraCorridors(roomsCount: number, override: number | undefined): number {
  const maxPossible = Math.max(0, (roomsCount * (roomsCount - 1)) / 2 - (roomsCount - 1));
  if (override !== undefined && !Number.isNaN(override)) {
    return clamp(Math.floor(override), 0, maxPossible);
  }
  return clamp(Math.floor(roomsCount / 3), 1, maxPossible);
}

function buildRoomEdges(rooms: DungeonRoom[]): RoomEdge[] {
  const centers = rooms.map((room) => center(room));
  const edges: RoomEdge[] = [];
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const from = centers[i]!;
      const to = centers[j]!;
      const roomA = rooms[i]!;
      const roomB = rooms[j]!;
      const left = roomA.id < roomB.id ? roomA.id : roomB.id;
      const right = roomA.id < roomB.id ? roomB.id : roomA.id;
      edges.push({
        fromIndex: i,
        toIndex: j,
        distance: Math.abs(from.x - to.x) + Math.abs(from.y - to.y),
        key: `${left}->${right}`
      });
    }
  }
  edges.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.key.localeCompare(b.key);
  });
  return edges;
}

function selectCorridorEdges(
  rooms: DungeonRoom[],
  rng: SeededRng,
  loopChance: number,
  maxExtraCorridors: number
): RoomEdge[] {
  const edges = buildRoomEdges(rooms);
  const parent = Array.from({ length: rooms.length }, (_, index) => index);
  const rank = Array.from({ length: rooms.length }, () => 0);
  const selected: RoomEdge[] = [];
  const selectedKeySet = new Set<string>();

  const find = (node: number): number => {
    if (parent[node] !== node) {
      parent[node] = find(parent[node]!);
    }
    return parent[node]!;
  };

  const unite = (a: number, b: number): boolean => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) {
      return false;
    }
    const rankA = rank[rootA]!;
    const rankB = rank[rootB]!;
    if (rankA < rankB) {
      parent[rootA] = rootB;
    } else if (rankA > rankB) {
      parent[rootB] = rootA;
    } else {
      parent[rootB] = rootA;
      rank[rootA] = rankA + 1;
    }
    return true;
  };

  for (const edge of edges) {
    if (!unite(edge.fromIndex, edge.toIndex)) {
      continue;
    }
    selected.push(edge);
    selectedKeySet.add(edge.key);
    if (selected.length === rooms.length - 1) {
      break;
    }
  }

  if (maxExtraCorridors <= 0 || loopChance <= 0) {
    return selected;
  }

  let extraAdded = 0;
  for (const edge of edges) {
    if (extraAdded >= maxExtraCorridors) {
      break;
    }
    if (selectedKeySet.has(edge.key)) {
      continue;
    }
    if (rng.next() > loopChance) {
      continue;
    }
    selected.push(edge);
    selectedKeySet.add(edge.key);
    extraAdded += 1;
  }
  return selected;
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
  corridorHalfWidth?: number;
  corridorLoopChance?: number;
  maxExtraCorridors?: number;
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
  const corridorPath = carveCorridor(grid, entrance, roomCenter, {
    halfWidth: 1,
    axisFirst: "vertical"
  });

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

  const mainCorridorHalfWidth = resolveMainCorridorHalfWidth(floorNumber, options.corridorHalfWidth);
  const loopChance = resolveLoopChance(floorNumber, options.corridorLoopChance);
  const maxExtraCorridors = resolveMaxExtraCorridors(rooms.length, options.maxExtraCorridors);
  const selectedEdges = selectCorridorEdges(rooms, rng, loopChance, maxExtraCorridors);
  const corridors: DungeonCorridor[] = [];
  for (const edge of selectedEdges) {
    const fromRoom = rooms[edge.fromIndex]!;
    const toRoom = rooms[edge.toIndex]!;
    const path = carveCorridor(grid, center(fromRoom), center(toRoom), {
      halfWidth: mainCorridorHalfWidth,
      axisFirst: rng.next() < 0.5 ? "horizontal" : "vertical"
    });
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
