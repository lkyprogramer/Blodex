import {
  addRunObols,
  advanceEndlessFloor,
  applySoulShardBonus,
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
  resolveSpecialAffixTotals,
  recordEndlessBestFloor,
  upsertDailyHistory,
  type BossRuntimeState,
  type DifficultyMode,
  type GameEventMap,
  type ItemInstance,
  type MetaProgression,
  type PlayerState,
  type RunState,
  type RunSummary,
  type TypedEventBus
} from "@blodex/core";
import type { LogLevel } from "../../../ui/Hud";
import { resolveInitialRunSeed } from "./resolveInitialRunSeed";
import { analyzeRunOutcome, type RunOutcomeAnalysis } from "../taste/RunOutcomeAnalyzer";
import type {
  BuildIdentitySnapshot,
  HeartbeatEvent,
  RunRecommendation
} from "../taste/TasteRuntimePorts";

interface RunCompletionRunLog {
  append(message: string, level: LogLevel, timestampMs: number): void;
  appendKey(key: string, params: Record<string, unknown> | undefined, level: LogLevel, timestampMs: number): void;
}

interface RunCompletionUiManager {
  hideDeathOverlay(): void;
  showDeathOverlay(reason: string): void;
  showSummary(summary: RunSummary, analysis?: RunOutcomeAnalysis): void;
  clearSummary(): void;
}

interface RunCompletionSaveManager {
  isRunSettled(runId: string): boolean;
  markRunSettled(runId: string): void;
  deleteSave(): void;
}

interface RunCompletionTastePort {
  snapshotBuildIdentity(): BuildIdentitySnapshot;
  listHeartbeatEvents(limit?: number): HeartbeatEvent[];
  buildRecommendations(): RunRecommendation[];
}

export interface RunCompletionHost {
  run: RunState;
  getRunRelativeNowMs(): number;
  syncEndlessMutators(nowMs: number): void;
  runLog: RunCompletionRunLog;
  progressionRuntimeModule: {
    setupFloor(floor: number, isNewRun: boolean): void;
  };
  deferredOutcomeRuntime: {
    settle(trigger: string, nowMs: number): void;
  };
  flushRunSave(): void;
  runEnded: boolean;
  sfxSystem: {
    stopAmbient(): void;
  };
  eventRuntimeModule: {
    consumeCurrentEvent(): void;
  };
  time: {
    now: number;
  };
  tryDiscoverBlueprints(
    sourceType:
      | "monster_affix"
      | "boss_kill"
      | "boss_first_kill"
      | "challenge_room"
      | "hidden_room"
      | "random_event"
      | "floor_clear",
    nowMs: number,
    sourceId?: string
  ): void;
  bossDef: {
    id: string;
  };
  player: PlayerState;
  meta: MetaProgression;
  resolveMutationDropBonus(): {
    obolMultiplier: number;
    soulShardMultiplier: number;
  };
  dailyPracticeMode: boolean;
  runSeed: string;
  blueprintFoundIdsInRun: string[];
  saveManager: RunCompletionSaveManager;
  saveMeta(meta: MetaProgression): boolean;
  saveCoordinator: {
    stopHeartbeat(): void;
    startHeartbeat(): void;
  };
  bossState: BossRuntimeState | null;
  renderHud(): void;
  hudDirty: boolean;
  uiManager: RunCompletionUiManager;
  lastDeathReason: string;
  resolveRunRecommendations?(): RunRecommendation[];
  tasteRuntime: RunCompletionTastePort;
  capturePhase6TelemetrySummary?(elapsedMs?: number): RunSummary["phase6Telemetry"];
  eventBus: TypedEventBus<GameEventMap>;
  bootstrapRun(runSeed: string, difficulty: DifficultyMode): void;
  pendingRunSeed?: string;
  selectedDifficulty: DifficultyMode;
}

export interface RunCompletionModuleOptions {
  host: RunCompletionHost;
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
    host.syncEndlessMutators(nowMs);
    host.run = addRunObols(
      host.run,
      endlessFloorClearBonus(host.run.currentFloor, host.run.mutatorActiveIds ?? [])
    );
    host.runLog.appendKey(
      "log.run.entered_abyss_floor",
      {
        floor: host.run.currentFloor
      },
      "warn",
      nowMs
    );
    host.progressionRuntimeModule.setupFloor(host.run.currentFloor, false);
    host.deferredOutcomeRuntime.settle("floor_reached", nowMs);
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
    host.deferredOutcomeRuntime.settle("run_end", host.time.now);
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
            const perKillReward = endlessKillShardReward(
              host.run.currentFloor,
              host.run.mutatorActiveIds ?? []
            );
            let floorBonus = 0;
            for (let floor = 6; floor <= host.run.currentFloor; floor += 1) {
              floorBonus += endlessFloorClearBonus(floor, host.run.mutatorActiveIds ?? []);
            }
            return kills * perKillReward + floorBonus;
          })()
        : calculateSoulShardReward(host.run, isVictory);
    let soulShards = Math.max(
      0,
      Math.floor(baseSoulShards * soulShardMultiplier) + Math.max(0, Math.floor(host.run.deferredShardBonus ?? 0))
    );
    const specialAffixTotals = resolveSpecialAffixTotals(
      Object.values(host.player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );
    soulShards = applySoulShardBonus(soulShards, specialAffixTotals.soulShardBonus);
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
    const phase6Telemetry =
      typeof host.capturePhase6TelemetrySummary === "function"
        ? host.capturePhase6TelemetrySummary(summary.elapsedMs)
        : undefined;
    if (phase6Telemetry !== undefined) {
      summary = {
        ...summary,
        phase6Telemetry
      };
      host.runLog.append(
        `Phase 6 baseline: ${phase6Telemetry.combat.skillCastsPer30s.toFixed(1)} skill casts / 30s, ${Math.round(
          phase6Telemetry.combat.autoAttackDamageShare * 100
        )}% auto damage share, ${phase6Telemetry.combat.averageNoInputGapMs.toFixed(0)}ms average idle gap.`,
        "info",
        host.time.now
      );
      host.eventBus.emit("combat_rhythm_window", {
        floor: host.run.currentFloor,
        timestampMs: host.time.now,
        metrics: {
          skillCastsPer30s: phase6Telemetry.combat.skillCastsPer30s,
          autoAttackDamageShare: phase6Telemetry.combat.autoAttackDamageShare,
          manaDryWindowMs: phase6Telemetry.combat.manaDryWindowMs,
          averageNoInputGapMs: phase6Telemetry.combat.averageNoInputGapMs,
          maxNoInputGapMs: phase6Telemetry.combat.maxNoInputGapMs
        }
      });
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
    if (typeof host.resolveRunRecommendations === "function") {
      const recommendations = host.resolveRunRecommendations();
      const outcomeAnalysis = analyzeRunOutcome({
        summary,
        buildIdentity: host.tasteRuntime.snapshotBuildIdentity(),
        heartbeats: host.tasteRuntime.listHeartbeatEvents(),
        recommendations,
        ...(host.run.branchChoice === undefined ? {} : { branchChoice: host.run.branchChoice }),
        ...(host.run.currentBiomeId === undefined ? {} : { currentBiomeId: host.run.currentBiomeId }),
        ...(host.lastDeathReason.length === 0 ? {} : { lastDeathReason: host.lastDeathReason })
      });
      host.runLog.appendKey(
        "log.run.diagnosis",
        {
          headline: outcomeAnalysis.failureHeadline
        },
        isVictory ? "success" : "warn",
        host.time.now
      );
      for (const missed of outcomeAnalysis.missedOpportunities) {
        host.runLog.appendKey(
          "log.run.missed_opportunity",
          {
            message: missed
          },
          "info",
          host.time.now
        );
      }
      for (const [index, suggestion] of outcomeAnalysis.suggestions.entries()) {
        host.runLog.appendKey(
          "log.run.next_plan",
          {
            index: index + 1,
            title: suggestion.title,
            action: suggestion.action
          },
          "info",
          host.time.now
        );
      }
      host.uiManager.showSummary(summary, outcomeAnalysis);
    } else {
      host.uiManager.showSummary(summary);
    }

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
