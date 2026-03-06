import Phaser from "phaser";
import {
  collectLoot,
  rollBossDrops,
  type GameEventMap,
  type BossDef,
  type ItemDef,
  type ItemInstance,
  type LootTableDef,
  type PlayerState,
  type PowerSpikeBudgetRuntimeState,
  type RollItemDropOptions,
  type RngLike,
  type RunState,
  type StaircaseState,
  type TypedEventBus
} from "@blodex/core";
import { ITEM_DEF_MAP, LOOT_TABLE_MAP } from "@blodex/content";
import type { LogLevel } from "../../../ui/Hud";
import type { MessageParams } from "../../../i18n/types";
import type { Phase6TelemetryTracker } from "./Phase6Telemetry";
import type { HeartbeatEvent, TasteRuntimePortHub } from "./TasteRuntimePorts";
import {
  PowerSpikeBudgetTracker,
  resolveGuaranteedSpikeReward,
  resolvePowerSpikePairId,
  resolvePowerSpikeSourceKind,
  scorePowerSpikeFromBuildThreshold,
  scorePowerSpikeFromItem,
  type PowerSpikeEvaluation
} from "./PowerSpikeRuntime";

interface PowerSpikeRuntimeContentLocalizer {
  itemName(itemDefId: string, fallback: string): string;
}

interface PowerSpikeRuntimeRunLog {
  append(message: string, level?: LogLevel, timestampMs?: number): void;
  appendKey(key: string, params?: MessageParams, level?: LogLevel, timestampMs?: number): void;
}

interface PowerSpikeRuntimeRenderPort {
  spawnLootSprite(
    item: ItemInstance,
    position: { x: number; y: number },
    origin: { x: number; y: number }
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
}

interface PowerSpikeRuntimeEntityPort {
  addLoot(drop: {
    item: ItemInstance;
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
    position: { x: number; y: number };
  }): void;
}

export interface PowerSpikeRuntimeHost {
  runSeed: string;
  run: RunState;
  player: PlayerState;
  bossDef: Pick<BossDef, "dropTableId">;
  staircaseState: Pick<StaircaseState, "position">;
  lootRng: RngLike;
  origin: { x: number; y: number };
  eventBus: TypedEventBus<GameEventMap>;
  renderSystem: PowerSpikeRuntimeRenderPort;
  entityManager: PowerSpikeRuntimeEntityPort;
  tasteRuntime: Pick<TasteRuntimePortHub, "recordDrop" | "recordPickup" | "recordHeartbeat" | "snapshotBuildIdentity">;
  phase6Telemetry: Pick<Phase6TelemetryTracker, "recordRareDropPresented" | "recordPowerSpike" | "syncBuildIdentity">;
  contentLocalizer: PowerSpikeRuntimeContentLocalizer;
  runLog: PowerSpikeRuntimeRunLog;
  markHighValueChoice(source: string, nowMs: number): void;
  resolveProgressionLootTable(floor: number): LootTableDef | undefined;
  resolveLootRollOptions(options: RollItemDropOptions): RollItemDropOptions;
  isItemDefUnlocked(itemDef: ItemDef): boolean;
  hudDirty: boolean;
}

export interface PowerSpikeRuntimeModuleOptions {
  host: PowerSpikeRuntimeHost;
}

const BOSS_EXCLUSIVE_TABLE_ID = "boss_bone_sovereign_exclusive";

export class PowerSpikeRuntimeModule {
  private readonly budget = new PowerSpikeBudgetTracker();

  constructor(private readonly options: PowerSpikeRuntimeModuleOptions) {}

  resetRun(): void {
    this.budget.resetRun();
  }

  captureBudgetState(): PowerSpikeBudgetRuntimeState {
    return this.budget.exportRuntimeState();
  }

  restoreBudgetState(snapshot: PowerSpikeBudgetRuntimeState | null | undefined): void {
    this.budget.restoreRuntimeState(snapshot ?? undefined);
  }

  describeItem(item: ItemInstance): string {
    return this.options.host.contentLocalizer.itemName(item.defId, item.name);
  }

  recordBuildFormed(source: string, nowMs: number): void {
    const host = this.options.host;
    const snapshot = host.tasteRuntime.snapshotBuildIdentity();
    if (!host.phase6Telemetry.syncBuildIdentity(snapshot)) {
      return;
    }
    host.tasteRuntime.recordHeartbeat({
      type: "build_formed",
      floor: host.run.currentFloor,
      source,
      timestampMs: nowMs,
      detail: snapshot.tags.join(",")
    });
    host.eventBus.emit("build_formed", {
      floor: host.run.currentFloor,
      source,
      timestampMs: nowMs,
      tags: snapshot.tags,
      keyItemDefIds: snapshot.keyItemDefIds
    });
    const amplitude = scorePowerSpikeFromBuildThreshold(snapshot);
    if (!amplitude.accepted) {
      return;
    }
    this.recordAcceptedPowerSpike(
      {
        pairId: resolvePowerSpikePairId(host.run.currentFloor),
        sourceKind: "build_threshold",
        amplitude
      },
      source,
      nowMs
    );
  }

  recordAcquiredItemTelemetry(
    item: ItemInstance,
    source: string,
    nowMs: number,
    baselinePlayer: PlayerState = this.options.host.player
  ): void {
    this.recordPowerSpikeItem(item, source, nowMs, false, baselinePlayer);
    this.recordBuildFormed(source, nowMs);
  }

  spawnLootDrop(
    item: ItemInstance,
    position: { x: number; y: number },
    source = "drop_spawn",
    nowMs: number
  ): void {
    const host = this.options.host;
    host.entityManager.addLoot({
      item,
      sprite: host.renderSystem.spawnLootSprite(item, position, host.origin),
      position: { ...position }
    });
    host.tasteRuntime.recordDrop(item, host.run.currentFloor, source, nowMs);
    this.recordRareDropPresented(item, source, nowMs, host.player);
    if (item.rarity === "rare" || item.kind === "unique") {
      host.markHighValueChoice("key_drop", nowMs);
    }
  }

  grantFloorPairFallbackReward(nowMs: number): void {
    const host = this.options.host;
    if (!this.budget.needsFallbackReward(host.run.currentFloor)) {
      return;
    }
    const fallbackTable = host.resolveProgressionLootTable(host.run.currentFloor + 1);
    if (fallbackTable === undefined) {
      return;
    }
    const reward = resolveGuaranteedSpikeReward({
      table: fallbackTable,
      floor: Math.max(host.run.currentFloor, 2),
      player: host.player,
      itemDefs: ITEM_DEF_MAP,
      seedBase: `${host.runSeed}:${host.run.currentFloor}:pair-fallback`,
      preferMajor: host.run.currentFloor >= 4 && !this.budget.hasMajorSpike(),
      isItemEligible: (itemDef) => host.isItemDefUnlocked(itemDef)
    });
    if (reward === null) {
      return;
    }
    this.budget.markFallbackGranted(host.run.currentFloor);
    this.spawnLootDrop(reward, host.staircaseState.position, "pair_fallback", nowMs);
    host.runLog.append(
      `Power spike fallback injected on floor ${host.run.currentFloor}: ${reward.defId}.`,
      "warn",
      nowMs
    );
  }

  grantStoryBossReward(nowMs: number): ItemInstance[] {
    const host = this.options.host;
    const drops = rollBossDrops(
      LOOT_TABLE_MAP[host.bossDef.dropTableId]!,
      LOOT_TABLE_MAP[BOSS_EXCLUSIVE_TABLE_ID]!,
      ITEM_DEF_MAP,
      host.run.currentFloor,
      host.lootRng,
      `${host.runSeed}:boss-reward:${Math.floor(nowMs)}`,
      host.resolveLootRollOptions({
        isItemEligible: (itemDef: ItemDef) => host.isItemDefUnlocked(itemDef)
      })
    );
    const collected = [drops.guaranteedRare, drops.guaranteedBossExclusive, drops.bonusDrop].filter(
      (item): item is ItemInstance => item !== undefined
    );
    for (const item of collected) {
      const baselinePlayer = host.player;
      host.player = collectLoot(host.player, item);
      host.run = {
        ...host.run,
        lootCollected: host.run.lootCollected + 1
      };
      host.tasteRuntime.recordPickup(item, host.run.currentFloor, "boss_reward", nowMs);
      this.recordAcquiredItemTelemetry(item, "boss_reward", nowMs, baselinePlayer);
      host.runLog.appendKey(
        "log.event.reward.item_acquired",
        {
          source: "boss_reward",
          itemName: host.contentLocalizer.itemName(item.defId, item.name)
        },
        "success",
        nowMs
      );
    }
    host.hudDirty = true;
    return collected;
  }

  private recordRareDropPresented(
    item: ItemInstance,
    source: string,
    nowMs: number,
    baselinePlayer: PlayerState
  ): void {
    this.recordPowerSpikeItem(item, source, nowMs, true, baselinePlayer);
  }

  private recordPowerSpikeItem(
    item: ItemInstance,
    source: string,
    nowMs: number,
    countsAsPresentation: boolean,
    baselinePlayer: PlayerState
  ): void {
    const host = this.options.host;
    if (countsAsPresentation && (item.rarity === "rare" || item.kind === "unique")) {
      host.phase6Telemetry.recordRareDropPresented(item);
      host.eventBus.emit("rare_drop_presented", {
        floor: host.run.currentFloor,
        source,
        timestampMs: nowMs,
        itemDefId: item.defId,
        rarity: item.rarity
      });
    }
    const amplitude = scorePowerSpikeFromItem(baselinePlayer, item);
    if (!amplitude.accepted) {
      return;
    }
    this.recordAcceptedPowerSpike(
      {
        pairId: resolvePowerSpikePairId(host.run.currentFloor),
        sourceKind: resolvePowerSpikeSourceKind(source),
        amplitude,
        itemDefId: item.defId,
        rarity: item.rarity
      },
      source,
      nowMs
    );
  }

  private recordAcceptedPowerSpike(
    evaluation: PowerSpikeEvaluation,
    source: string,
    nowMs: number
  ): void {
    const host = this.options.host;
    this.budget.recordAcceptedSpike(host.run.currentFloor, evaluation.amplitude);
    host.phase6Telemetry.recordPowerSpike(evaluation.amplitude.major);
    host.tasteRuntime.recordHeartbeat(this.buildPowerSpikeHeartbeat(host.run.currentFloor, source, nowMs, evaluation));
    host.eventBus.emit("power_spike", {
      floor: host.run.currentFloor,
      source,
      sourceKind: evaluation.sourceKind,
      pairId: evaluation.pairId,
      timestampMs: nowMs,
      ...(evaluation.itemDefId === undefined ? {} : { itemDefId: evaluation.itemDefId }),
      ...(evaluation.rarity === undefined ? {} : { rarity: evaluation.rarity }),
      accepted: true,
      major: evaluation.amplitude.major,
      amplitude: {
        offensiveDelta: evaluation.amplitude.offensiveDelta,
        defensiveDelta: evaluation.amplitude.defensiveDelta,
        utilityDelta: evaluation.amplitude.utilityDelta,
        ttkDelta: evaluation.amplitude.ttkDelta,
        sustainDelta: evaluation.amplitude.sustainDelta
      }
    });
  }

  private buildPowerSpikeHeartbeat(
    floor: number,
    source: string,
    nowMs: number,
    evaluation: PowerSpikeEvaluation
  ): HeartbeatEvent {
    return {
      type: "power_spike",
      floor,
      source,
      timestampMs: nowMs,
      detail:
        evaluation.itemDefId === undefined
          ? `${evaluation.sourceKind}:${evaluation.pairId}`
          : `${evaluation.itemDefId}:${evaluation.pairId}`
    };
  }
}
