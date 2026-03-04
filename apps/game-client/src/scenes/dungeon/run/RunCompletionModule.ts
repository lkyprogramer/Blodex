import {
  addRunObols,
  advanceEndlessFloor,
  appendReplayInput,
  applyRunSummaryToMeta,
  buildDailyHistoryEntry,
  calculateSoulShardReward,
  endlessFloorClearBonus,
  endlessKillShardReward,
  endRun,
  enterEndless,
  enterNextFloor,
  hasClaimedDailyReward,
  markDailyRewardClaimed,
  mergeFoundBlueprints,
  recordEndlessBestFloor,
  upsertDailyHistory,
  type GameEventMap
} from "@blodex/core";
import { resolveInitialRunSeed } from "./resolveInitialRunSeed";

type RunHost = Record<string, any>;

export interface RunCompletionModuleOptions {
  host: RunHost;
}

export class RunCompletionModule {
  constructor(private readonly options: RunCompletionModuleOptions) {}

  enterAbyss(nowMs: number): void {
    const host = this.options.host;
    if (host.run.inEndless) {
      return;
    }

    const fromFloor = host.run.currentFloor;
    host.run = appendReplayInput(host.run, {
      type: "floor_transition",
      atMs: host.getRunRelativeNowMs(),
      fromFloor,
      toFloor: fromFloor + 1
    });
    host.run = enterNextFloor(host.run);
    host.run = {
      ...enterEndless(host.run),
      endlessKills: 0
    };
    host.run = addRunObols(host.run, endlessFloorClearBonus(host.run.currentFloor));
    host.runLog.appendKey(
      "log.run.entered_abyss_floor",
      {
        floor: host.run.currentFloor
      },
      "warn",
      nowMs
    );
    host.setupFloor(host.run.currentFloor, false);
    host.flushRunSave();
  }

  finishRun(isVictory: boolean): void {
    const host = this.options.host;
    if (host.runEnded) {
      return;
    }

    host.sfxSystem.stopAmbient();
    host.eventRuntimeModule.consumeCurrentEvent();
    host.runEnded = true;
    host.run = {
      ...host.run,
      isVictory
    };
    if (isVictory) {
      host.tryDiscoverBlueprints("boss_kill", host.time.now, host.bossDef.id);
      host.tryDiscoverBlueprints("boss_first_kill", host.time.now, host.bossDef.id);
    }

    const { summary: baseSummary, meta: nextMeta, replay } = endRun(host.run, host.player, host.time.now, host.meta);
    const { soulShardMultiplier } = host.resolveMutationDropBonus();
    const baseSoulShards =
      host.run.inEndless && isVictory === false
        ? (() => {
            const kills = Math.max(0, host.run.endlessKills ?? 0);
            const perKillReward = endlessKillShardReward(host.run.currentFloor);
            let floorBonus = 0;
            for (let floor = 6; floor <= host.run.currentFloor; floor += 1) {
              floorBonus += endlessFloorClearBonus(floor);
            }
            return kills * perKillReward + floorBonus;
          })()
        : calculateSoulShardReward(host.run, isVictory);
    let soulShards = Math.max(0, Math.floor(baseSoulShards * soulShardMultiplier));
    if (host.run.runMode === "daily" && host.dailyPracticeMode) {
      soulShards = 0;
    }

    let summary = {
      ...baseSummary,
      isVictory,
      soulShardsEarned: soulShards,
      obolsEarned: host.run.runEconomy.obols
    };
    let mergedMeta = mergeFoundBlueprints(nextMeta, host.blueprintFoundIdsInRun);
    if (host.run.inEndless) {
      mergedMeta = recordEndlessBestFloor(mergedMeta, host.run.currentFloor);
    }
    if (host.run.runMode === "daily" && host.run.dailyDate !== undefined) {
      summary = {
        ...summary,
        dailyDate: host.run.dailyDate
      };
      if (!host.dailyPracticeMode) {
        const rewarded = !hasClaimedDailyReward(mergedMeta, host.run.dailyDate);
        const dailyEntry = buildDailyHistoryEntry(host.run.dailyDate, host.runSeed, summary, rewarded);
        summary = {
          ...summary,
          score: dailyEntry.score
        };
        mergedMeta = upsertDailyHistory(mergedMeta, dailyEntry);
        if (rewarded) {
          mergedMeta = markDailyRewardClaimed(mergedMeta, host.run.dailyDate);
        }
      }
    }

    const runId = `${host.runSeed}:${host.run.startedAtMs}`;
    if (!host.saveManager.isRunSettled(runId)) {
      host.meta = applyRunSummaryToMeta(mergedMeta, summary);
      const committed = host.saveMeta(host.meta);
      if (committed) {
        host.saveManager.markRunSettled(runId);
        host.saveManager.deleteSave();
      }
    } else {
      host.saveManager.deleteSave();
    }

    host.saveCoordinator.stopHeartbeat();
    host.bossState = null;
    host.renderHud();
    host.hudDirty = false;
    if (isVictory) {
      host.uiManager.hideDeathOverlay();
    } else {
      host.uiManager.showDeathOverlay(host.lastDeathReason);
    }
    host.uiManager.showSummary(summary);

    const runEndPayload: GameEventMap["run:end"] = {
      summary,
      inputs: replay?.inputs ?? [],
      finishedAtMs: host.time.now,
      ...(summary.replayChecksum === undefined ? {} : { checksum: summary.replayChecksum })
    };
    host.eventBus.emit("run:end", runEndPayload);
  }

  resetRun(): void {
    const host = this.options.host;
    host.uiManager.clearSummary();
    host.bootstrapRun(resolveInitialRunSeed(host.pendingRunSeed), host.selectedDifficulty);
    host.saveCoordinator.startHeartbeat();
    host.flushRunSave();
    host.hudDirty = true;
  }
}
