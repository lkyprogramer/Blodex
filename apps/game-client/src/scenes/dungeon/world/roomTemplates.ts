import {
  SeededRng,
  type BiomeId,
  type DungeonLayout,
  type DungeonProp,
  type DungeonPropId,
  type DungeonRoom,
  type FloorPacingKind,
  type RoomEncounterTag,
  type RoomTemplateId
} from "@blodex/core";

interface RoomTemplateBuildResult {
  encounterTag: RoomEncounterTag;
  props: DungeonProp[];
  spawnPoints: Array<{ x: number; y: number }>;
}

interface RoomTemplateDef {
  id: RoomTemplateId;
  supports(room: DungeonRoom): boolean;
  allowedPacingKinds?: FloorPacingKind[];
  build(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult;
}

export interface ApplyRoomTemplatesOptions {
  layout: DungeonLayout;
  biomeId: BiomeId;
  floorNumber: number;
  pacingKind?: FloorPacingKind;
  seed: string;
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function pointKey(point: { x: number; y: number }): string {
  return `${point.x}:${point.y}`;
}

function roomCenter(room: DungeonRoom): { x: number; y: number } {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2)
  };
}

function interiorPoint(room: DungeonRoom, xRatio: number, yRatio: number): { x: number; y: number } {
  const minX = room.x + 1;
  const maxX = room.x + room.width - 2;
  const minY = room.y + 1;
  const maxY = room.y + room.height - 2;
  return {
    x: clamp(Math.round(room.x + (room.width - 1) * xRatio), minX, maxX),
    y: clamp(Math.round(room.y + (room.height - 1) * yRatio), minY, maxY)
  };
}

function createProp(
  roomId: string,
  biomeId: BiomeId,
  id: DungeonPropId,
  position: { x: number; y: number },
  blocking: boolean,
  scale = 1
): DungeonProp {
  return {
    id,
    position,
    blocking,
    roomId,
    assetId: `prop_${biomeId}_${id}_01`,
    scale
  };
}

function uniquePoints(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const seen = new Set<string>();
  const result: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    const key = pointKey(point);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(point);
  }
  return result;
}

function isLongHorizontal(room: DungeonRoom): boolean {
  return room.width >= 8 && room.width >= room.height + 3;
}

function isLongVertical(room: DungeonRoom): boolean {
  return room.height >= 8 && room.height >= room.width + 3;
}

function supportsArena(room: DungeonRoom): boolean {
  return room.width >= 7 && room.height >= 7 && Math.abs(room.width - room.height) <= 2;
}

function supportsLargeHall(room: DungeonRoom): boolean {
  return room.width >= 8 && room.height >= 6;
}

function buildArena(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult {
  const props = [
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.28, 0.28), true),
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.72, 0.28), true),
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.28, 0.72), true),
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.72, 0.72), true),
    createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.5, 0.5), false, 1.1)
  ];
  return {
    encounterTag: "open",
    props,
    spawnPoints: uniquePoints([
      interiorPoint(room, 0.2, 0.5),
      interiorPoint(room, 0.8, 0.5),
      interiorPoint(room, 0.5, 0.2),
      interiorPoint(room, 0.5, 0.8)
    ])
  };
}

function buildGrandHall(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult {
  const props = [
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.22, 0.32), true),
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.22, 0.68), true),
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.78, 0.32), true),
    createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.78, 0.68), true),
    createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.5, 0.25), false),
    createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.5, 0.75), false)
  ];
  return {
    encounterTag: "crossfire",
    props,
    spawnPoints: uniquePoints([
      interiorPoint(room, 0.16, 0.5),
      interiorPoint(room, 0.84, 0.5),
      interiorPoint(room, 0.5, 0.18),
      interiorPoint(room, 0.5, 0.82)
    ])
  };
}

function buildAmbushCorridor(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult {
  const horizontal = isLongHorizontal(room);
  const props = horizontal
    ? [
        createProp(room.id, biomeId, "bone_heap", interiorPoint(room, 0.34, 0.24), true),
        createProp(room.id, biomeId, "bone_heap", interiorPoint(room, 0.66, 0.76), true),
        createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.5, 0.2), false),
        createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.5, 0.8), false)
      ]
    : [
        createProp(room.id, biomeId, "bone_heap", interiorPoint(room, 0.24, 0.34), true),
        createProp(room.id, biomeId, "bone_heap", interiorPoint(room, 0.76, 0.66), true),
        createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.2, 0.5), false),
        createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.8, 0.5), false)
      ];
  return {
    encounterTag: "ambush",
    props,
    spawnPoints: uniquePoints(
      horizontal
        ? [
            interiorPoint(room, 0.14, 0.5),
            interiorPoint(room, 0.86, 0.5),
            interiorPoint(room, 0.68, 0.3)
          ]
        : [
            interiorPoint(room, 0.5, 0.14),
            interiorPoint(room, 0.5, 0.86),
            interiorPoint(room, 0.3, 0.68)
          ]
    )
  };
}

function buildCrossroads(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult {
  return {
    encounterTag: "crossfire",
    props: [
      createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.5, 0.5), false, 1.1),
      createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.3, 0.3), true),
      createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.7, 0.7), true)
    ],
    spawnPoints: uniquePoints([
      interiorPoint(room, 0.18, 0.5),
      interiorPoint(room, 0.82, 0.5),
      interiorPoint(room, 0.5, 0.18),
      interiorPoint(room, 0.5, 0.82)
    ])
  };
}

function buildStudy(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult {
  return {
    encounterTag: "support",
    props: [
      createProp(room.id, biomeId, "bookshelf", interiorPoint(room, 0.22, 0.24), true),
      createProp(room.id, biomeId, "bookshelf", interiorPoint(room, 0.22, 0.5), true),
      createProp(room.id, biomeId, "bookshelf", interiorPoint(room, 0.22, 0.76), true),
      createProp(room.id, biomeId, "altar", interiorPoint(room, 0.72, 0.5), false, 1.1),
      createProp(room.id, biomeId, "brazier", interiorPoint(room, 0.78, 0.26), false)
    ],
    spawnPoints: uniquePoints([
      interiorPoint(room, 0.82, 0.22),
      interiorPoint(room, 0.82, 0.78),
      interiorPoint(room, 0.58, 0.5)
    ])
  };
}

function buildVault(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult {
  return {
    encounterTag: "bulwark",
    props: [
      createProp(room.id, biomeId, "altar", interiorPoint(room, 0.5, 0.24), false, 1.1),
      createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.34, 0.56), true),
      createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.66, 0.56), true),
      createProp(room.id, biomeId, "bone_heap", interiorPoint(room, 0.18, 0.76), false),
      createProp(room.id, biomeId, "bone_heap", interiorPoint(room, 0.82, 0.76), false)
    ],
    spawnPoints: uniquePoints([
      interiorPoint(room, 0.22, 0.26),
      interiorPoint(room, 0.78, 0.26),
      interiorPoint(room, 0.5, 0.82)
    ])
  };
}

function buildBridge(room: DungeonRoom, biomeId: BiomeId): RoomTemplateBuildResult {
  const horizontal = room.width >= room.height;
  return {
    encounterTag: "gauntlet",
    props: horizontal
      ? [
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.34, 0.24), true),
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.34, 0.76), true),
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.66, 0.24), true),
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.66, 0.76), true)
        ]
      : [
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.24, 0.34), true),
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.76, 0.34), true),
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.24, 0.66), true),
          createProp(room.id, biomeId, "pillar", interiorPoint(room, 0.76, 0.66), true)
        ],
    spawnPoints: uniquePoints(
      horizontal
        ? [
            interiorPoint(room, 0.14, 0.5),
            interiorPoint(room, 0.86, 0.5),
            interiorPoint(room, 0.5, 0.5)
          ]
        : [
            interiorPoint(room, 0.5, 0.14),
            interiorPoint(room, 0.5, 0.86),
            interiorPoint(room, 0.5, 0.5)
          ]
    )
  };
}

const ROOM_TEMPLATE_DEFS: RoomTemplateDef[] = [
  {
    id: "ambush_corridor",
    supports: (room) => isLongHorizontal(room) || isLongVertical(room),
    allowedPacingKinds: ["combat", "boss"],
    build: buildAmbushCorridor
  },
  {
    id: "bridge",
    supports: (room) => isLongHorizontal(room) || isLongVertical(room),
    allowedPacingKinds: ["combat", "boss"],
    build: buildBridge
  },
  {
    id: "arena",
    supports: supportsArena,
    build: buildArena
  },
  {
    id: "crossroads",
    supports: supportsArena,
    build: buildCrossroads
  },
  {
    id: "study",
    supports: (room) => room.width >= 6 && room.height >= 6,
    allowedPacingKinds: ["combat", "recovery", "preparation"],
    build: buildStudy
  },
  {
    id: "vault",
    supports: (room) => room.width >= 6 && room.height >= 6,
    build: buildVault
  },
  {
    id: "grand_hall",
    supports: supportsLargeHall,
    build: buildGrandHall
  }
];

function fallbackSpawnPoint(room: DungeonRoom): { x: number; y: number } {
  return roomCenter(room);
}

function isPointInsideRoom(room: DungeonRoom, point: { x: number; y: number }): boolean {
  return point.x >= room.x && point.x < room.x + room.width && point.y >= room.y && point.y < room.y + room.height;
}

function collectReservedWalkableKeys(
  layout: DungeonLayout,
  room: DungeonRoom,
  spawnPoints: Array<{ x: number; y: number }>
): Set<string> {
  const reservedKeys = new Set(spawnPoints.map(pointKey));
  reservedKeys.add(pointKey(layout.playerSpawn));
  reservedKeys.add(pointKey(roomCenter(room)));

  for (const spawnPoint of layout.spawnPoints) {
    if (isPointInsideRoom(room, spawnPoint)) {
      reservedKeys.add(pointKey(spawnPoint));
    }
  }

  for (const corridor of layout.corridors) {
    for (const point of corridor.path) {
      if (isPointInsideRoom(room, point)) {
        reservedKeys.add(pointKey(point));
      }
    }
  }

  return reservedKeys;
}

function pickTemplate(
  room: DungeonRoom,
  pacingKind: FloorPacingKind | undefined,
  rng: SeededRng,
  usageByTemplateId: Map<RoomTemplateId, number>
): RoomTemplateDef | null {
  const compatible = ROOM_TEMPLATE_DEFS.filter((template) => {
    if (!template.supports(room)) {
      return false;
    }
    if (template.allowedPacingKinds === undefined || pacingKind === undefined) {
      return true;
    }
    return template.allowedPacingKinds.includes(pacingKind);
  });
  if (compatible.length === 0) {
    return null;
  }

  let bestUsage = Number.POSITIVE_INFINITY;
  for (const template of compatible) {
    bestUsage = Math.min(bestUsage, usageByTemplateId.get(template.id) ?? 0);
  }
  const leastUsed = compatible.filter((template) => (usageByTemplateId.get(template.id) ?? 0) === bestUsage);
  return rng.pick(leastUsed);
}

export function applyRoomTemplatesToDungeon(options: ApplyRoomTemplatesOptions): DungeonLayout {
  const rng = new SeededRng(`${options.seed}:${options.biomeId}:${options.floorNumber}:${options.layout.layoutHash}`);
  const walkable = options.layout.walkable.map((row) => [...row]);
  const props: DungeonProp[] = [];
  const usageByTemplateId = new Map<RoomTemplateId, number>();
  const rooms = options.layout.rooms.map((room, index) => {
    const nextRoom: DungeonRoom = { ...room };
    if (index === 0) {
      nextRoom.authoredSpawnPoints = [fallbackSpawnPoint(room)];
      return nextRoom;
    }

    const template = pickTemplate(room, options.pacingKind, rng, usageByTemplateId);
    if (template === null) {
      nextRoom.authoredSpawnPoints = [fallbackSpawnPoint(room)];
      return nextRoom;
    }

    const built = template.build(room, options.biomeId);
    const validProps = built.props.filter((prop) => isPointInsideRoom(room, prop.position));
    const reservedWalkableKeys = collectReservedWalkableKeys(options.layout, room, built.spawnPoints);
    for (const prop of validProps) {
      if (!prop.blocking) {
        continue;
      }
      if (reservedWalkableKeys.has(pointKey(prop.position))) {
        continue;
      }
      walkable[prop.position.y]![prop.position.x] = false;
    }

    props.push(...validProps);
    nextRoom.templateId = template.id;
    nextRoom.encounterTag = built.encounterTag;
    nextRoom.authoredSpawnPoints = uniquePoints(
      built.spawnPoints.filter((point) => walkable[point.y]?.[point.x] === true && isPointInsideRoom(room, point))
    );
    if ((nextRoom.authoredSpawnPoints?.length ?? 0) === 0) {
      nextRoom.authoredSpawnPoints = [fallbackSpawnPoint(room)];
    }
    usageByTemplateId.set(template.id, (usageByTemplateId.get(template.id) ?? 0) + 1);
    return nextRoom;
  });

  const spawnPoints = uniquePoints(
    rooms
      .slice(1)
      .flatMap((room) => room.authoredSpawnPoints ?? [fallbackSpawnPoint(room)])
      .filter((point) => walkable[point.y]?.[point.x] === true)
  );
  const templateHash = rooms
    .filter((room) => room.templateId !== undefined)
    .map((room) => `${room.id}:${room.templateId}`)
    .join("|");
  const propHash = props
    .map((prop) => `${prop.id}@${prop.position.x},${prop.position.y}:${prop.blocking ? "b" : "d"}`)
    .join("|");

  return {
    ...options.layout,
    walkable,
    rooms,
    props,
    spawnPoints: spawnPoints.length > 0 ? spawnPoints : options.layout.spawnPoints.map((point) => ({ ...point })),
    layoutHash: `${options.layout.layoutHash}:tpl:${templateHash}:prop:${propHash}`
  };
}
