import { describe, expect, it, vi } from "vitest";
import { BONE_SOVEREIGN } from "@blodex/content";
import type { ItemInstance } from "@blodex/core";
import { BossEncounterDispatcher } from "../BossEncounterDispatcher";
import { BossRuntimeModule, type BossRuntimeHost } from "../BossRuntimeModule";

function createReward(defId: string): ItemInstance {
  return {
    id: `${defId}-1`,
    defId,
    name: defId,
    slot: "weapon",
    kind: "equipment",
    rarity: "rare",
    requiredLevel: 5,
    iconId: "item_weapon_01",
    seed: `${defId}-seed`,
    rolledAffixes: {}
  };
}

function createHost(): BossRuntimeHost {
  return {
    bossState: { position: { x: 1, y: 1 }, health: 0 },
    bossSprite: { setPosition: vi.fn(), setVisible: vi.fn() },
    tileWidth: 64,
    tileHeight: 32,
    origin: { x: 0, y: 0 },
    eventPanelOpen: false,
    runEnded: false,
    run: {
      startedAtMs: 0,
      runSeed: "boss-test",
      difficulty: "hard",
      difficultyModifier: {
        monsterHealthMultiplier: 1,
        monsterDamageMultiplier: 1,
        affixPolicy: "default",
        soulShardMultiplier: 1
      },
      currentFloor: 8,
      currentBiomeId: "bone_throne",
      floor: 8,
      floorsCleared: 7,
      kills: 0,
      totalKills: 0,
      lootCollected: 0,
      challengeSuccessCount: 0,
      inEndless: false,
      endlessFloor: 0,
      endlessKills: 0,
      runMode: "normal",
      mutatorActiveIds: [],
      mutatorState: {},
      deferredShardBonus: 0,
      runEconomy: { obols: 0, spentObols: 0 }
    },
    uiManager: { showEventDialog: vi.fn() },
    eventRuntimeModule: { consumeCurrentEvent: vi.fn() },
    runCompletionModule: { enterAbyss: vi.fn(), finishRun: vi.fn() },
    grantBossEncounterReward: vi.fn(() => [createReward("sovereign_requiem")]),
    queueBossEncounterCompare: vi.fn(),
    flushBossRewardComparePrompts: vi.fn(() => false),
    describeItem: vi.fn((item: ItemInstance) => item.defId),
    recordBossRewardClosed: vi.fn(),
    time: { now: 800 },
    runLog: { appendKey: vi.fn() }
  };
}

describe("boss reward binding contract", () => {
  it("passes dispatcher-derived reward binding into the boss reward settlement path", () => {
    const host = createHost();
    const dispatcher = new BossEncounterDispatcher({
      run: host.run,
      bossDef: BONE_SOVEREIGN,
      currentBossEncounterId: null
    });
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher
    });

    module.openVictoryChoice(500);

    expect(host.grantBossEncounterReward).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: "story_bone_throne_finale",
        rareDropTableId: "boss_bone_sovereign_rare",
        exclusiveDropTableId: "boss_bone_sovereign_exclusive"
      }),
      500
    );
    expect(host.queueBossEncounterCompare).toHaveBeenCalledWith(
      expect.objectContaining({ defId: "sovereign_requiem" }),
      expect.objectContaining({
        encounterId: "story_bone_throne_finale",
        compareBinding: "immediate"
      })
    );
  });

  it("binds the molten branch encounter to ember-warden reward tables", () => {
    const host = createHost();
    host.run.branchChoice = "molten_route";
    const dispatcher = new BossEncounterDispatcher({
      run: host.run,
      bossDef: BONE_SOVEREIGN,
      currentBossEncounterId: null
    });
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher
    });

    module.openVictoryChoice(500);

    expect(host.grantBossEncounterReward).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: "branch_molten_trial",
        rareDropTableId: "boss_ember_warden_rare",
        exclusiveDropTableId: "boss_ember_warden_exclusive"
      }),
      500
    );
  });

  it("binds the ossuary challenge encounter to deferred compare rewards", () => {
    const host = createHost();
    host.run.currentFloor = 7;
    host.run.floor = 7;
    const dispatcher = new BossEncounterDispatcher({
      run: host.run,
      bossDef: BONE_SOVEREIGN,
      currentBossEncounterId: null,
      challengeRoomState: {
        challengeId: "ossuary_trial",
        started: true,
        finished: false
      }
    });
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher
    });

    module.openVictoryChoice(500, { challengeId: "ossuary_trial" });

    expect(host.grantBossEncounterReward).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: "challenge_ossuary_trial",
        rewardSource: "challenge_reward",
        compareBinding: "deferred",
        rareDropTableId: "boss_ossuary_keeper_rare",
        exclusiveDropTableId: "boss_ossuary_keeper_exclusive"
      }),
      500
    );
  });
});
