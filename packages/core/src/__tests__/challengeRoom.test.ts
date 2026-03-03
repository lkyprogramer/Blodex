import { describe, expect, it } from "vitest";
import {
  advanceChallengeRoomWave,
  chooseChallengeRoom,
  createChallengeRoomState,
  failChallengeRoom,
  markRoomAsChallenge,
  shouldFailChallengeRoomByTimeout,
  shouldSpawnChallengeRoom,
  startChallengeRoom
} from "../challengeRoom";
import type { DungeonLayout, RngLike } from "../contracts/types";

function makeRng(sequence: number[]): RngLike {
  let index = 0;
  return {
    next(): number {
      const value = sequence[index] ?? sequence[sequence.length - 1] ?? 0.5;
      index += 1;
      return value;
    },
    nextInt(min: number, max: number): number {
      if (max <= min) {
        return min;
      }
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(items: T[]): T {
      return items[this.nextInt(0, Math.max(0, items.length - 1))] as T;
    }
  };
}

function makeLayout(): DungeonLayout {
  return {
    width: 20,
    height: 20,
    walkable: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true)),
    rooms: [
      { id: "room-0", x: 2, y: 2, width: 5, height: 5 },
      { id: "room-1", x: 10, y: 3, width: 5, height: 5 },
      { id: "room-2", x: 12, y: 12, width: 5, height: 5 }
    ],
    corridors: [],
    spawnPoints: [],
    playerSpawn: { x: 3, y: 3 },
    layoutHash: "challenge-layout"
  };
}

describe("challengeRoom", () => {
  it("only spawns from floor 2+", () => {
    const rng = makeRng([0.1, 0.1]);
    expect(shouldSpawnChallengeRoom(1, rng)).toBe(false);
    expect(shouldSpawnChallengeRoom(2, rng)).toBe(true);
  });

  it("selects and marks challenge room", () => {
    const layout = makeLayout();
    const room = chooseChallengeRoom(layout, makeRng([0.6]));
    expect(room).not.toBeNull();
    const marked = markRoomAsChallenge(layout, room!.id);
    expect(marked.rooms.some((entry) => entry.id === room!.id && entry.roomType === "challenge")).toBe(true);
  });

  it("resolves success/fail flow", () => {
    const started = startChallengeRoom(createChallengeRoomState("room-1"), 1_000);
    expect(started.started).toBe(true);
    expect(started.deadlineAtMs).toBe(31_000);

    const wave1 = advanceChallengeRoomWave(started, 3);
    expect(wave1.finished).toBe(false);
    const success = advanceChallengeRoomWave(advanceChallengeRoomWave(wave1, 3), 3);
    expect(success.finished).toBe(true);
    expect(success.success).toBe(true);

    const timeout = startChallengeRoom(createChallengeRoomState("room-2"), 500, 1000);
    expect(shouldFailChallengeRoomByTimeout(timeout, 1500)).toBe(true);
    const failed = failChallengeRoom(timeout);
    expect(failed.finished).toBe(true);
    expect(failed.success).toBe(false);
  });
});
