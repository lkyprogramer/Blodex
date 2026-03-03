import type { ChallengeRoomState, DungeonLayout, DungeonRoom, RngLike } from "./contracts/types";

export const CHALLENGE_DURATION_MS = 30_000;
export const CHALLENGE_SPAWN_CHANCE_MIN = 0.1;
export const CHALLENGE_SPAWN_CHANCE_MAX = 0.15;

function clampChance(value: number): number {
  if (!Number.isFinite(value)) {
    return CHALLENGE_SPAWN_CHANCE_MIN;
  }
  return Math.max(0, Math.min(1, value));
}

function pickSpawnChance(rng: RngLike, minChance: number, maxChance: number): number {
  const low = clampChance(minChance);
  const high = clampChance(maxChance);
  if (high <= low) {
    return low;
  }
  return low + (high - low) * rng.next();
}

export function shouldSpawnChallengeRoom(
  floorNumber: number,
  rng: RngLike,
  minChance = CHALLENGE_SPAWN_CHANCE_MIN,
  maxChance = CHALLENGE_SPAWN_CHANCE_MAX
): boolean {
  if (floorNumber < 2) {
    return false;
  }
  const chance = pickSpawnChance(rng, minChance, maxChance);
  return rng.next() <= chance;
}

export function chooseChallengeRoom(layout: DungeonLayout, rng: RngLike): DungeonRoom | null {
  if (layout.rooms.length === 0) {
    return null;
  }
  const candidates = layout.rooms.filter((room) => room.roomType !== "challenge");
  if (candidates.length === 0) {
    return null;
  }
  const idx = rng.nextInt(0, candidates.length - 1);
  return candidates[idx] ?? null;
}

export function markRoomAsChallenge(layout: DungeonLayout, roomId: string): DungeonLayout {
  return {
    ...layout,
    rooms: layout.rooms.map((room) => {
      if (room.id !== roomId) {
        return room;
      }
      return {
        ...room,
        roomType: "challenge"
      };
    })
  };
}

export function createChallengeRoomState(roomId: string): ChallengeRoomState {
  return {
    roomId,
    started: false,
    finished: false,
    success: false,
    waveIndex: 0
  };
}

export function startChallengeRoom(
  state: ChallengeRoomState,
  nowMs: number,
  durationMs = CHALLENGE_DURATION_MS
): ChallengeRoomState {
  if (state.started || state.finished) {
    return state;
  }
  return {
    ...state,
    started: true,
    startedAtMs: nowMs,
    deadlineAtMs: nowMs + Math.max(1, Math.floor(durationMs))
  };
}

export function advanceChallengeRoomWave(
  state: ChallengeRoomState,
  totalWaves: number
): ChallengeRoomState {
  if (!state.started || state.finished) {
    return state;
  }
  const clampedTotal = Math.max(1, Math.floor(totalWaves));
  const nextWave = state.waveIndex + 1;
  if (nextWave >= clampedTotal) {
    return {
      ...state,
      waveIndex: clampedTotal,
      finished: true,
      success: true
    };
  }
  return {
    ...state,
    waveIndex: nextWave
  };
}

export function failChallengeRoom(state: ChallengeRoomState): ChallengeRoomState {
  if (state.finished) {
    return state;
  }
  return {
    ...state,
    finished: true,
    success: false
  };
}

export function shouldFailChallengeRoomByTimeout(state: ChallengeRoomState, nowMs: number): boolean {
  if (!state.started || state.finished) {
    return false;
  }
  if (state.deadlineAtMs === undefined) {
    return false;
  }
  return nowMs >= state.deadlineAtMs;
}
