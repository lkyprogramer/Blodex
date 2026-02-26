import type {
  ItemInstance,
  MetaProgression,
  PlayerState,
  ReplayInputEvent,
  RunReplay,
  RunSummary
} from "./contracts/types";

export const REPLAY_VERSION = "phase0-v1";

export interface RunState {
  startedAtMs: number;
  floor: number;
  kills: number;
  lootCollected: number;
  runSeed?: string;
  replay?: RunReplay;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createRunSeed(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint32Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(8, "0")).join("-");
  }

  return `fallback-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function deriveFloorSeed(runSeed: string, floor: number, stream = "main"): string {
  return `${runSeed}:floor:${floor}:stream:${stream}`;
}

export function createReplay(runSeed: string, floor: number, version = REPLAY_VERSION): RunReplay {
  return {
    version,
    runSeed,
    floor,
    inputs: []
  };
}

export function appendReplayInput(run: RunState, input: ReplayInputEvent): RunState {
  if (run.replay === undefined) {
    return run;
  }

  return {
    ...run,
    replay: {
      ...run.replay,
      inputs: [...run.replay.inputs, input]
    }
  };
}

export function computeReplayChecksum(summary: RunSummary, replay: RunReplay): string {
  const payload = JSON.stringify({
    summary: {
      floorReached: summary.floorReached,
      kills: summary.kills,
      lootCollected: summary.lootCollected,
      elapsedMs: summary.elapsedMs,
      leveledTo: summary.leveledTo
    },
    replay: {
      version: replay.version,
      runSeed: replay.runSeed,
      floor: replay.floor,
      inputs: replay.inputs
    }
  });
  return fnv1a32(payload);
}

export function createInitialMeta(): MetaProgression {
  return {
    runsPlayed: 0,
    bestFloor: 0,
    bestTimeMs: 0
  };
}

export function collectLoot(player: PlayerState, item: ItemInstance): PlayerState {
  return {
    ...player,
    inventory: [...player.inventory, item]
  };
}

export function endRun(
  run: RunState,
  player: PlayerState,
  nowMs: number,
  meta: MetaProgression
): { summary: RunSummary; meta: MetaProgression; replay?: RunReplay } {
  const elapsedMs = Math.max(0, nowMs - run.startedAtMs);
  const summaryBase: RunSummary = {
    floorReached: run.floor,
    kills: run.kills,
    lootCollected: run.lootCollected,
    elapsedMs,
    leveledTo: player.level
  };

  const replay =
    run.replay === undefined
      ? undefined
      : {
          ...run.replay
        };

  const summary =
    replay === undefined
      ? summaryBase
      : {
          ...summaryBase,
          replayChecksum: computeReplayChecksum(summaryBase, replay)
        };

  const bestTimeMs =
    run.floor >= meta.bestFloor && (meta.bestTimeMs === 0 || elapsedMs < meta.bestTimeMs)
      ? elapsedMs
      : meta.bestTimeMs;

  const nextReplay =
    replay === undefined
      ? undefined
      : summary.replayChecksum === undefined
        ? replay
        : {
            ...replay,
            checksum: summary.replayChecksum
          };

  return {
    summary,
    meta: {
      runsPlayed: meta.runsPlayed + 1,
      bestFloor: Math.max(meta.bestFloor, run.floor),
      bestTimeMs
    },
    ...(nextReplay === undefined ? {} : { replay: nextReplay })
  };
}
