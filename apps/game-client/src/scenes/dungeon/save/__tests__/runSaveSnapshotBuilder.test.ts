import { describe, expect, it, vi } from "vitest";
import { RunSaveSnapshotBuilder } from "../RunSaveSnapshotBuilder";
import type { RunSaveSnapshotHost } from "../savePorts";

describe("RunSaveSnapshotBuilder", () => {
  it("captures run-relative telemetry and persisted progression prompt state", () => {
    const capturePhase6TelemetryState = vi.fn(() => ({
      startedAtMs: 100,
      buildFormedState: false,
      inputTimestampsMs: [],
      story: {
        playerFacingChoices: 0,
        choiceCountByFloor: {},
        powerSpikes: 0,
        majorPowerSpikes: 0,
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
    const captureProgressionPromptState = vi.fn(() => ({
      nextPromptDelayMs: 2_100,
      pendingLevelUpSkillOfferIds: ["chain_lightning"]
    }));
    const capturePowerSpikeBudgetState = vi.fn(() => ({
      pairStates: {
        "1-2": { hitCount: 1, majorHitCount: 0, satisfied: true, fallbackGranted: false },
        "3-4": { hitCount: 0, majorHitCount: 0, satisfied: false, fallbackGranted: false },
        "5": { hitCount: 0, majorHitCount: 0, satisfied: false, fallbackGranted: false }
      },
      acceptedSpikeCount: 1,
      majorSpikeCount: 0
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
        listMonsters: () => [
          {
            state: {
              id: "monster-1",
              position: { x: 2, y: 3 },
              moveSpeed: 64
            },
            baseMoveSpeed: 128,
            nextAttackAt: 10,
            nextSupportAt: 20
          }
        ],
        listLoot: () => []
      },
      eventNode: null,
      merchantOffers: [],
      captureProgressionPromptState,
      capturePowerSpikeBudgetState,
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
    expect(captureProgressionPromptState).toHaveBeenCalledWith(260);
    expect(capturePowerSpikeBudgetState).toHaveBeenCalledTimes(1);
    expect(snapshot?.runtimeNowMs).toBe(260);
    expect(snapshot?.phase6TelemetryState).toBeDefined();
    expect(snapshot?.powerSpikeBudgetState?.pairStates["1-2"]?.hitCount).toBe(1);
    expect(snapshot?.progressionPromptState).toEqual({
      nextPromptDelayMs: 2_100,
      pendingLevelUpSkillOfferIds: ["chain_lightning"]
    });
    expect(snapshot?.monsters[0]?.baseMoveSpeed).toBe(128);
  });
});
