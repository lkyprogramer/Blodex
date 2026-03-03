import type { MetaProgression, PlayerState } from "@blodex/core";
import type { LogEntry } from "../Hud";

export interface UIStateView {
  player: PlayerState;
  run: {
    floor: number;
    difficulty?: string;
    runMode?: "normal" | "daily";
    inEndless?: boolean;
    endlessFloor?: number;
    biome?: string;
    kills: number;
    lootCollected: number;
    targetKills: number;
    obols?: number;
    floorGoalReached?: boolean;
    isBossFloor?: boolean;
    bossHealth?: number;
    bossMaxHealth?: number;
    bossPhase?: number;
    mappingRevealed?: boolean;
    newlyAcquiredItemIds?: string[];
  };
  meta: MetaProgression;
}

export interface UIFloorRuntimeState {
  floor: number;
  biome?: string;
  kills: number;
  targetKills: number;
  floorGoalReached: boolean;
  mappingRevealed: boolean;
  isBossFloor: boolean;
}

export interface UIBossRuntimeState {
  health: number;
  maxHealth: number;
  phase: number;
}

export interface UIStateSnapshot<TView extends UIStateView = UIStateView> {
  view: TView;
  player: PlayerState;
  run: TView["run"];
  meta: MetaProgression;
  floor: UIFloorRuntimeState;
  boss?: UIBossRuntimeState;
  logs: readonly LogEntry[];
  flags: {
    runEnded: boolean;
    eventPanelOpen: boolean;
    debugCheatsEnabled: boolean;
    timestampMs: number;
  };
}

export function createUIStateSnapshot<TView extends UIStateView>(
  view: TView,
  options: {
    logs: readonly LogEntry[];
    flags: {
      runEnded: boolean;
      eventPanelOpen: boolean;
      debugCheatsEnabled: boolean;
      timestampMs: number;
    };
  }
): UIStateSnapshot<TView> {
  const boss =
    view.run.isBossFloor && view.run.bossHealth !== undefined && view.run.bossMaxHealth !== undefined
      ? {
          health: view.run.bossHealth,
          maxHealth: view.run.bossMaxHealth,
          phase: view.run.bossPhase ?? 0
        }
      : undefined;

  return {
    view,
    player: view.player,
    run: view.run,
    meta: view.meta,
    floor: {
      floor: view.run.floor,
      kills: view.run.kills,
      targetKills: view.run.targetKills,
      floorGoalReached: view.run.floorGoalReached ?? false,
      mappingRevealed: view.run.mappingRevealed ?? false,
      isBossFloor: view.run.isBossFloor ?? false,
      ...(view.run.biome === undefined ? {} : { biome: view.run.biome })
    },
    ...(boss === undefined ? {} : { boss }),
    logs: options.logs,
    flags: options.flags
  };
}
