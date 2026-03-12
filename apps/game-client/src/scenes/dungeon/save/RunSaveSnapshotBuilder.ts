import { SAVE_LEASE_TTL_MS } from "../../../systems/SaveManager";
import type {
  BuffInstance,
  PersistedDodgeRuntimeState,
  PersistedBuffState,
  RunRngStreamName,
  RunSaveDataV3,
  RuntimeEventNodeState,
  StaircaseState
} from "@blodex/core";
import type { RunSaveSnapshotHost } from "./savePorts";

export interface RunSaveSnapshotBuilderOptions {
  host: RunSaveSnapshotHost;
  appVersion: string;
}

export class RunSaveSnapshotBuilder {
  constructor(private readonly options: RunSaveSnapshotBuilderOptions) {}

  build(nowMs: number): RunSaveDataV3 | null {
    const host = this.options.host;
    const run = host.run;
    const player = host.player;
    if (host.runEnded || run === undefined || player === undefined) {
      return null;
    }
    const minimapSnapshot = host.uiManager.getMinimapSnapshot() ?? {
      layoutHash: host.dungeon.layoutHash,
      exploredKeys: []
    };
    const wallNowMs = Date.now();
    const staircaseSnapshot: StaircaseState = {
      position: { ...host.staircaseState.position },
      visible: host.staircaseState.visible
    };
    if (host.staircaseState.kind !== undefined) {
      staircaseSnapshot.kind = host.staircaseState.kind;
    }
    if (host.staircaseState.options !== undefined) {
      staircaseSnapshot.options = [
        {
          ...host.staircaseState.options[0],
          position: { ...host.staircaseState.options[0].position }
        },
        {
          ...host.staircaseState.options[1],
          position: { ...host.staircaseState.options[1].position }
        }
      ];
    }
    if (host.staircaseState.selected !== undefined) {
      staircaseSnapshot.selected = host.staircaseState.selected;
    }
    const floorChoiceBudget =
      typeof host.captureFloorChoiceBudgetSnapshot === "function" ? host.captureFloorChoiceBudgetSnapshot() : undefined;
    const progressionPromptState =
      typeof host.captureProgressionPromptState === "function" ? host.captureProgressionPromptState(nowMs) : undefined;
    const comparePromptState =
      typeof host.captureComparePromptState === "function" ? host.captureComparePromptState() : undefined;
    const powerSpikeBudgetState =
      typeof host.capturePowerSpikeBudgetState === "function" ? host.capturePowerSpikeBudgetState() : undefined;
    const phase6TelemetryState =
      typeof host.capturePhase6TelemetryState === "function"
        ? host.capturePhase6TelemetryState(Math.max(0, nowMs - run.startedAtMs))
        : undefined;
    const dodgeSnapshot = this.snapshotDodgeRuntime(nowMs);

    return {
      schemaVersion: 3,
      savedAtMs: wallNowMs,
      appVersion: this.options.appVersion,
      runId: `${host.runSeed}:${run.startedAtMs}`,
      runSeed: host.runSeed,
      domain: {
        run: {
          ...run
        },
        player: this.snapshotPlayer(player, nowMs),
        consumables: {
          charges: { ...host.consumables.charges },
          cooldowns: { ...host.consumables.cooldowns }
        },
        blueprintFoundIdsInRun: [...host.blueprintFoundIdsInRun],
        selectedMutationIds: [...host.mutationRuntime.activeIds]
      },
      runtime: {
        dungeon: {
          ...host.dungeon,
          walkable: host.dungeon.walkable.map((row: boolean[]) => [...row]),
          rooms: host.dungeon.rooms.map((room) => ({
            ...room,
            ...(room.authoredSpawnPoints === undefined
              ? {}
              : { authoredSpawnPoints: room.authoredSpawnPoints.map((point) => ({ ...point })) })
          })),
          corridors: host.dungeon.corridors.map((corridor) => ({
            ...corridor,
            path: corridor.path.map((point) => ({ ...point }))
          })),
          spawnPoints: host.dungeon.spawnPoints.map((point) => ({ ...point })),
          playerSpawn: { ...host.dungeon.playerSpawn },
          ...(host.dungeon.props === undefined
            ? {}
            : {
                props: host.dungeon.props.map((prop) => ({
                  ...prop,
                  position: { ...prop.position }
                }))
              }),
          hiddenRooms: (host.dungeon.hiddenRooms ?? []).map((room) => ({
            roomId: room.roomId,
            entrance: { ...room.entrance },
            revealed: room.revealed,
            rewardsClaimed: room.rewardsClaimed
          }))
        },
        staircase: staircaseSnapshot,
        hazards: host.hazards.map((hazard) => ({
          ...hazard,
          position: { ...hazard.position }
        })),
        ...(dodgeSnapshot === undefined ? {} : { dodge: dodgeSnapshot }),
        bossEncounterId: host.currentBossEncounterId,
        boss:
          host.bossState === null
            ? null
            : {
                ...host.bossState,
                position: { ...host.bossState.position },
                attackCooldowns: { ...host.bossState.attackCooldowns }
              },
        monsters: host.entityManager.listMonsters().map((monster) => this.snapshotMonster(monster, nowMs)),
        lootOnGround: host.entityManager.listLoot().map((drop) => ({
          item: {
            ...drop.item,
            rolledAffixes: { ...drop.item.rolledAffixes },
            ...(drop.item.rolledSpecialAffixes === undefined
              ? {}
              : { rolledSpecialAffixes: { ...drop.item.rolledSpecialAffixes } })
          },
          position: { ...drop.position }
        })),
        eventNode: this.currentEventNodeSnapshot(),
        minimap: {
          layoutHash: minimapSnapshot.layoutHash,
          exploredKeys: [...minimapSnapshot.exploredKeys]
        },
        mapRevealActive: host.mapRevealActive,
        deferredOutcomes: host.deferredOutcomes.map((outcome) => ({
          outcomeId: outcome.outcomeId,
          source: outcome.source,
          trigger:
            outcome.trigger?.type === "floor_reached"
              ? {
                  type: "floor_reached",
                  value: Math.max(1, Math.floor(outcome.trigger.value ?? run.currentFloor))
                }
              : outcome.trigger?.type === "boss_kill"
                ? {
                    type: "boss_kill"
                  }
                : {
                    type: "run_end"
                  },
          reward: {
            ...(outcome.reward?.obol === undefined ? {} : { obol: outcome.reward.obol }),
            ...(outcome.reward?.shard === undefined ? {} : { shard: outcome.reward.shard }),
            ...(outcome.reward?.itemDefId === undefined ? {} : { itemDefId: outcome.reward.itemDefId })
          },
          status: outcome.status
        })),
        ...(floorChoiceBudget === undefined ? {} : { floorChoiceBudget }),
        ...(powerSpikeBudgetState === undefined ? {} : { powerSpikeBudgetState }),
        ...(phase6TelemetryState === undefined ? {} : { phase6TelemetryState }),
        rngCursor: this.collectRngCursor()
      },
      session: {
        ...(progressionPromptState === undefined ? {} : { progressionPromptState }),
        ...(comparePromptState === undefined ? {} : { comparePromptState }),
        lease: {
          tabId: host.saveManager.getTabId(),
          renewedAtMs: wallNowMs,
          leaseUntilMs: wallNowMs + SAVE_LEASE_TTL_MS
        }
      }
    };
  }

  private snapshotPlayer(player: RunSaveSnapshotHost["player"] & NonNullable<unknown>, nowMs: number) {
    const { activeBuffs, ...stablePlayer } = player;
    return {
      ...stablePlayer,
      position: { ...player.position },
      ...(activeBuffs === undefined ? {} : { activeBuffs: this.snapshotBuffs(activeBuffs, nowMs) })
    };
  }

  private snapshotMonster(
    monster: ReturnType<RunSaveSnapshotHost["entityManager"]["listMonsters"]>[number],
    nowMs: number
  ) {
    const { activeBuffs, ...stableState } = monster.state;
    return {
      state: {
        ...stableState,
        position: { ...monster.state.position },
        ...(monster.state.affixes === undefined ? {} : { affixes: [...monster.state.affixes] }),
        ...(activeBuffs === undefined ? {} : { activeBuffs: this.snapshotBuffs(activeBuffs, nowMs) })
      },
      ...(monster.baseMoveSpeed === undefined ? {} : { baseMoveSpeed: monster.baseMoveSpeed }),
      nextAttackAt: monster.nextAttackAt,
      nextSupportAt: monster.nextSupportAt
    };
  }

  private snapshotBuffs(buffs: BuffInstance[], nowMs: number): PersistedBuffState[] {
    return buffs.flatMap((buff) => {
      const remainingMs = Math.max(0, Math.floor(buff.expiresAtMs - nowMs));
      if (remainingMs <= 0) {
        return [];
      }
      return [
        {
          defId: buff.defId,
          sourceId: buff.sourceId,
          targetId: buff.targetId,
          remainingMs
        }
      ];
    });
  }

  private collectRngCursor(): Record<RunRngStreamName, number> {
    const host = this.options.host;
    return {
      procgen: 0,
      spawn: host.spawnRng?.getCursor() ?? 0,
      combat: host.combatRng?.getCursor() ?? 0,
      loot: host.lootRng?.getCursor() ?? 0,
      skill: host.skillRng?.getCursor() ?? 0,
      boss: host.bossRng?.getCursor() ?? 0,
      biome: host.biomeRng?.getCursor() ?? 0,
      hazard: host.hazardRng?.getCursor() ?? 0,
      event: host.eventRng?.getCursor() ?? 0,
      merchant: host.merchantRng?.getCursor() ?? 0
    };
  }

  private snapshotDodgeRuntime(nowMs: number): PersistedDodgeRuntimeState | undefined {
    const dodgeState = this.options.host.dodgeRuntimeState;
    const cooldownRemainingMs = Math.max(0, Math.floor(dodgeState.readyAtMs - nowMs));
    if (
      cooldownRemainingMs <= 0 &&
      !dodgeState.autoTargetSuppressed &&
      dodgeState.lastDodgeDirection === null &&
      dodgeState.lastResult === null
    ) {
      return undefined;
    }
    return {
      cooldownRemainingMs,
      autoTargetSuppressed: dodgeState.autoTargetSuppressed,
      ...(dodgeState.lastDodgeDirection === null ? {} : { lastDirection: { ...dodgeState.lastDodgeDirection } }),
      ...(dodgeState.lastDodgeDirectionSource === null
        ? {}
        : { lastDirectionSource: dodgeState.lastDodgeDirectionSource }),
      ...(dodgeState.lastResult === null ? {} : { lastResult: dodgeState.lastResult })
    };
  }

  private currentEventNodeSnapshot(): RuntimeEventNodeState | null {
    const host = this.options.host;
    if (host.eventNode === null) {
      return null;
    }

    return {
      eventId: host.eventNode.eventDef.id,
      position: { ...host.eventNode.position },
      resolved: host.eventNode.resolved,
      ...(host.merchantOffers.length === 0
        ? {}
        : { merchantOffers: host.merchantOffers.map((offer) => ({ ...offer })) })
    };
  }
}
