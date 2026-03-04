import { SAVE_LEASE_TTL_MS } from "../../../systems/SaveManager";
import type {
  RunRngStreamName,
  RunSaveDataV2,
  RunState,
  RuntimeEventNodeState,
  StaircaseState
} from "@blodex/core";

type SnapshotHost = Record<string, any>;

export interface RunSaveSnapshotBuilderOptions {
  host: SnapshotHost;
  appVersion: string;
}

export class RunSaveSnapshotBuilder {
  constructor(private readonly options: RunSaveSnapshotBuilderOptions) {}

  build(nowMs: number): RunSaveDataV2 | null {
    const host = this.options.host;
    if (host.runEnded || (host.run as RunState | undefined) === undefined || host.player === undefined) {
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

    return {
      schemaVersion: 2,
      savedAtMs: wallNowMs,
      appVersion: this.options.appVersion,
      runId: `${host.runSeed}:${host.run.startedAtMs}`,
      runSeed: host.runSeed,
      run: {
        ...host.run
      },
      player: {
        ...host.player,
        position: { ...host.player.position }
      },
      consumables: {
        charges: { ...host.consumables.charges },
        cooldowns: { ...host.consumables.cooldowns }
      },
      dungeon: {
        ...host.dungeon,
        walkable: host.dungeon.walkable.map((row: boolean[]) => [...row]),
        rooms: host.dungeon.rooms.map((room: Record<string, unknown>) => ({ ...room })),
        corridors: host.dungeon.corridors.map((corridor: { path: Array<Record<string, number>> }) => ({
          ...corridor,
          path: corridor.path.map((point) => ({ ...point }))
        })),
        spawnPoints: host.dungeon.spawnPoints.map((point: Record<string, number>) => ({ ...point })),
        playerSpawn: { ...host.dungeon.playerSpawn },
        hiddenRooms: (host.dungeon.hiddenRooms ?? []).map(
          (room: {
            roomId: string;
            entrance: { x: number; y: number };
            revealed: boolean;
            rewardsClaimed: boolean;
          }) => ({
            roomId: room.roomId,
            entrance: { ...room.entrance },
            revealed: room.revealed,
            rewardsClaimed: room.rewardsClaimed
          })
        )
      },
      staircase: staircaseSnapshot,
      hazards: host.hazards.map((hazard: { position: { x: number; y: number } }) => ({
        ...hazard,
        position: { ...hazard.position }
      })),
      boss:
        host.bossState === null
          ? null
          : {
              ...host.bossState,
              position: { ...host.bossState.position },
              attackCooldowns: { ...host.bossState.attackCooldowns }
            },
      monsters: host.entityManager.listMonsters().map((monster: Record<string, any>) => ({
        state: {
          ...monster.state,
          position: { ...monster.state.position },
          ...(monster.state.affixes === undefined ? {} : { affixes: [...monster.state.affixes] })
        },
        nextAttackAt: monster.nextAttackAt,
        nextSupportAt: monster.nextSupportAt
      })),
      lootOnGround: host.entityManager.listLoot().map((drop: Record<string, any>) => ({
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
      rngCursor: this.collectRngCursor(),
      blueprintFoundIdsInRun: [...host.blueprintFoundIdsInRun],
      selectedMutationIds: [...host.mutationRuntime.activeIds],
      lease: {
        tabId: host.saveManager.getTabId(),
        renewedAtMs: wallNowMs,
        leaseUntilMs: wallNowMs + SAVE_LEASE_TTL_MS
      }
    };
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
        : { merchantOffers: host.merchantOffers.map((offer: Record<string, unknown>) => ({ ...offer })) })
    };
  }
}
