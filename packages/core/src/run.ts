import type {
  BiomeId,
  BranchChoice,
  DifficultyMode,
  DifficultyModifier,
  ItemInstance,
  MetaProgression,
  PermanentUpgrade,
  PlayerState,
  ReplayInputEvent,
  RunMode,
  RunEconomyState,
  RunReplay,
  RunRngStreamName,
  RunSummary
} from "./contracts/types";
import { resolveBiomeForFloorBySeed } from "./biome";
import {
  createInitialDifficultyCompletions,
  DEFAULT_DIFFICULTY,
  getDifficultyModifier
} from "./difficulty";

export const REPLAY_VERSION = "phase2-v1";

export interface RunState {
  startedAtMs: number;
  runSeed: string;
  difficulty: DifficultyMode;
  difficultyModifier: DifficultyModifier;
  currentFloor: number;
  currentBiomeId: BiomeId;
  /** @deprecated Use currentFloor. */
  floor: number;
  floorsCleared: number;
  kills: number;
  totalKills: number;
  lootCollected: number;
  branchChoice?: BranchChoice;
  challengeSuccessCount: number;
  inEndless: boolean;
  endlessFloor: number;
  runMode: RunMode;
  dailyDate?: string;
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
  stream: RunRngStreamName
): string {
  return `${runSeed}:floor:${floor}:stream:${stream}`;
}

export function createReplay(
  runSeed: string,
  floor: number,
  version = REPLAY_VERSION,
  difficulty: DifficultyMode = DEFAULT_DIFFICULTY
): RunReplay {
  return {
    version,
    runSeed,
    floor,
    difficulty,
    currentFloor: floor,
    inputs: []
  };
}

export function createRunState(
  runSeed: string,
  nowMs: number,
  difficulty: DifficultyMode = DEFAULT_DIFFICULTY
): RunState {
  const difficultyModifier = getDifficultyModifier(difficulty);
  return {
    startedAtMs: nowMs,
    runSeed,
    difficulty,
    difficultyModifier,
    currentFloor: 1,
    currentBiomeId: resolveBiomeForFloorBySeed(1, runSeed),
    floor: 1,
    floorsCleared: 0,
    kills: 0,
    totalKills: 0,
    lootCollected: 0,
    challengeSuccessCount: 0,
    inEndless: false,
    endlessFloor: 0,
    runMode: "normal",
    runEconomy: {
      obols: 0,
      spentObols: 0
    },
    replay: createReplay(runSeed, 1, REPLAY_VERSION, difficulty)
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
      difficulty: replay.difficulty,
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
    cumulativeUnlockProgress: 0,
    schemaVersion: 5,
    selectedDifficulty: DEFAULT_DIFFICULTY,
    difficultyCompletions: createInitialDifficultyCompletions(),
    talentPoints: {},
    totalShardsSpent: 0,
    blueprintFoundIds: [],
    blueprintForgedIds: [],
    echoes: 0,
    mutationSlots: 1,
    mutationUnlockedIds: [],
    selectedMutationIds: [],
    synergyDiscoveredIds: [],
    endlessBestFloor: 0,
    dailyHistory: [],
    dailyRewardClaimedDates: [],
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
    currentBiomeId: resolveBiomeForFloorBySeed(nextFloor, run.runSeed, run.branchChoice),
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
      ...run.runEconomy,
      obols: run.runEconomy.obols + delta
    }
  };
}

export function spendRunObols(run: RunState, delta: number): RunState {
  if (delta <= 0 || run.runEconomy.obols < delta) {
    return run;
  }
  return {
    ...run,
    runEconomy: {
      ...run.runEconomy,
      obols: run.runEconomy.obols - delta,
      spentObols: (run.runEconomy.spentObols ?? 0) + delta
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
    soulShardsEarned: 0,
    difficulty: run.difficulty,
    challengeSuccessCount: run.challengeSuccessCount,
    runMode: run.runMode,
    ...(run.dailyDate === undefined ? {} : { dailyDate: run.dailyDate })
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
