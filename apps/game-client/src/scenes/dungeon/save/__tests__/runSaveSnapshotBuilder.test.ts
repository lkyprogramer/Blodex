import { describe, expect, it, vi } from "vitest";
import { RunSaveSnapshotBuilder } from "../RunSaveSnapshotBuilder";
import type { RunSaveSnapshotHost } from "../savePorts";

describe("RunSaveSnapshotBuilder", () => {
  it("passes run-relative elapsed time into phase6 telemetry capture", () => {
    const capturePhase6TelemetryState = vi.fn(() => ({
      startedAtMs: 100,
      buildFormedState: false,
      inputTimestampsMs: [],
      story: {
        playerFacingChoices: 0,
        choiceCountByFloor: {},
        powerSpikes: 0,
        buildFormed: 0,
        rareDropsPresented: 0,
        bossRewardClosed: 0
      },
      combat: {
        skillUses: 0,
        skillCastsPer30s: 0,
        skillDamage: 0,
        autoAttackDamage: 0,
        skillDamageShare: 0,
        autoAttackDamageShare: 0,
        manaDryWindowMs: 0,
        averageNoInputGapMs: 0,
        maxNoInputGapMs: 0
      },
      runtimeEffects: {
        buffApplyCountById: {},
        buffUptimeMsById: {},
        damageDealtByType: {},
        damageTakenByType: {},
        resolvedHitCountByType: {},
        synergyActivationCountById: {},
        synergyFirstActivatedFloorById: {}
      }
    }));
    const host = {
      runEnded: false,
      runSeed: "seed-1",
      run: {
        startedAtMs: 100
      },
      player: {
        position: {
          x: 4,
          y: 7
        }
      },
      consumables: {
        charges: {},
        cooldowns: {}
      },
      uiManager: {
        getMinimapSnapshot: vi.fn(() => null)
      },
      dungeon: {
        layoutHash: "layout-1",
        walkable: [[true]],
        rooms: [],
        corridors: [],
        spawnPoints: [],
        playerSpawn: { x: 0, y: 0 }
      },
      staircaseState: {
        position: { x: 1, y: 1 },
        visible: false
      },
      hazards: [],
      bossState: null,
      entityManager: {
        listMonsters: () => [],
        listLoot: () => []
      },
      eventNode: null,
      merchantOffers: [],
      capturePhase6TelemetryState,
      deferredOutcomes: [],
      saveManager: {
        getTabId: () => "tab-1"
      },
      blueprintFoundIdsInRun: [],
      mutationRuntime: {
        activeIds: []
      }
    } as unknown as RunSaveSnapshotHost;

    const builder = new RunSaveSnapshotBuilder({
      host,
      appVersion: "test"
    });

    const snapshot = builder.build(260);

    expect(capturePhase6TelemetryState).toHaveBeenCalledWith(160);
    expect(snapshot?.phase6TelemetryState).toBeDefined();
  });
});
