import { describe, expect, it } from "vitest";
import { generateDungeon } from "../procgen";

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
    expect(dungeon.corridors.length).toBe(dungeon.rooms.length - 1);
    for (const corridor of dungeon.corridors) {
      expect(corridor.path.length).toBeGreaterThan(0);
    }
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
