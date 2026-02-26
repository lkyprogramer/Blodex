import type {
  ItemInstance,
  MetaProgression,
  PermanentUpgrade,
  PlayerState,
  ReplayInputEvent,
  RunEconomyState,
  RunReplay,
  RunRngStreamName,
  RunSummary
} from "./contracts/types";

export const REPLAY_VERSION = "phase1-v1";

export interface RunState {
  startedAtMs: number;
  runSeed: string;
  currentFloor: number;
  /** @deprecated Use currentFloor. */
  floor: number;
  floorsCleared: number;
  kills: number;
  totalKills: number;
  lootCollected: number;
  runEconomy: RunEconomyState;
  replay?: RunReplay;
  isVictory?: boolean;
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

export function deriveFloorSeed(
  runSeed: string,
  floor: number,
  stream: RunRngStreamName | "main" = "main"
): string {
  return `${runSeed}:floor:${floor}:stream:${stream}`;
}

export function createReplay(runSeed: string, floor: number, version = REPLAY_VERSION): RunReplay {
  return {
    version,
    runSeed,
    floor,
    currentFloor: floor,
    inputs: []
  };
}

export function createRunState(runSeed: string, nowMs: number): RunState {
  return {
    startedAtMs: nowMs,
    runSeed,
    currentFloor: 1,
    floor: 1,
    floorsCleared: 0,
    kills: 0,
    totalKills: 0,
    lootCollected: 0,
    runEconomy: {
      obols: 0
    },
    replay: createReplay(runSeed, 1)
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
      currentFloor: run.currentFloor,
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
      leveledTo: summary.leveledTo,
      isVictory: summary.isVictory ?? false
    },
    replay: {
      version: replay.version,
      runSeed: replay.runSeed,
      floor: replay.floor,
      currentFloor: replay.currentFloor,
      inputs: replay.inputs
    }
  });
  return fnv1a32(payload);
}

export function createInitialPermanentUpgrades(): PermanentUpgrade {
  return {
    startingHealth: 0,
    startingArmor: 0,
    luckBonus: 0,
    skillSlots: 2,
    potionCharges: 0
  };
}

export function createInitialMeta(): MetaProgression {
  return {
    runsPlayed: 0,
    bestFloor: 0,
    bestTimeMs: 0,
    soulShards: 0,
    unlocks: [],
    schemaVersion: 2,
    permanentUpgrades: createInitialPermanentUpgrades()
  };
}

export function collectLoot(player: PlayerState, item: ItemInstance): PlayerState {
  return {
    ...player,
    inventory: [...player.inventory, item]
  };
}

export function enterNextFloor(run: RunState): RunState {
  const nextFloor = run.currentFloor + 1;
  const next: RunState = {
    ...run,
    currentFloor: nextFloor,
    floor: nextFloor,
    floorsCleared: run.floorsCleared + 1,
    kills: 0
  };
  if (run.replay !== undefined) {
    next.replay = {
      ...run.replay,
      currentFloor: nextFloor
    };
  }
  return next;
}

export function addRunObols(run: RunState, delta: number): RunState {
  if (delta <= 0) {
    return run;
  }
  return {
    ...run,
    runEconomy: {
      obols: run.runEconomy.obols + delta
    }
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
    floorReached: run.currentFloor,
    kills: Math.max(run.kills, run.totalKills),
    lootCollected: run.lootCollected,
    elapsedMs,
    leveledTo: player.level,
    isVictory: run.isVictory ?? false,
    obolsEarned: run.runEconomy.obols,
    soulShardsEarned: 0
  };

  const replay =
    run.replay === undefined
      ? undefined
      : {
          ...run.replay,
          currentFloor: run.currentFloor
        };

  const summary =
    replay === undefined
      ? summaryBase
      : {
          ...summaryBase,
          replayChecksum: computeReplayChecksum(summaryBase, replay)
        };

  const bestTimeMs =
    run.currentFloor >= meta.bestFloor && (meta.bestTimeMs === 0 || elapsedMs < meta.bestTimeMs)
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
      ...meta,
      runsPlayed: meta.runsPlayed + 1,
      bestFloor: Math.max(meta.bestFloor, run.currentFloor),
      bestTimeMs
    },
    ...(nextReplay === undefined ? {} : { replay: nextReplay })
  };
}
