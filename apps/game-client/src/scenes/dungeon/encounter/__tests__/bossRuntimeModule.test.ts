import { describe, expect, it, vi } from "vitest";
import type { ItemInstance } from "@blodex/core";
import { BONE_SOVEREIGN } from "@blodex/content";
import { BossEncounterDispatcher } from "../BossEncounterDispatcher";
import { BossRuntimeModule, type BossRuntimeHost } from "../BossRuntimeModule";

function createReward(defId: string, rarity: ItemInstance["rarity"] = "rare"): ItemInstance {
  return {
    id: `${defId}-1`,
    defId,
    name: defId,
    slot: "weapon",
    kind: "equipment",
    rarity,
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
      currentFloor: 5,
      currentBiomeId: "bone_throne",
      floor: 5,
      floorsCleared: 4,
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
      runEconomy: {
        obols: 0,
        spentObols: 0
      }
    },
    uiManager: {
      showEventDialog: vi.fn()
    },
    eventRuntimeModule: {
      consumeCurrentEvent: vi.fn()
    },
    runCompletionModule: {
      enterAbyss: vi.fn(),
      finishRun: vi.fn()
    },
    grantBossEncounterReward: vi.fn(() => [createReward("sovereign_requiem"), createReward("voidsigil_band")]),
    queueBossEncounterCompare: vi.fn(),
    flushBossRewardComparePrompts: vi.fn(() => false),
    describeItem: vi.fn((item: ItemInstance) => item.defId),
    recordBossRewardClosed: vi.fn(),
    time: {
      now: 800
    },
    runLog: {
      appendKey: vi.fn()
    }
  };
}

function createDispatcher(host: BossRuntimeHost) {
  return new BossEncounterDispatcher({
    run: host.run,
    bossDef: BONE_SOVEREIGN,
    currentBossEncounterId: null
  });
}

describe("BossRuntimeModule", () => {
  it("grants story boss rewards before showing the victory choice panel", () => {
    const host = createHost();
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher: createDispatcher(host)
    });

    module.openVictoryChoice(700);

    expect(host.grantBossEncounterReward).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: "story_bone_throne_finale",
        rewardSource: "boss_reward"
      }),
      700
    );
    const [eventDef, , onSelect] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
    expect(eventDef?.description).toContain("sovereign_requiem");
    expect(eventDef?.description).toContain("voidsigil_band");

    onSelect?.("claim_victory");

    expect(host.recordBossRewardClosed).toHaveBeenCalledWith("claim_victory", 800);
    expect(host.runCompletionModule.finishRun).toHaveBeenCalledWith(true);
    expect(host.runCompletionModule.enterAbyss).not.toHaveBeenCalled();
  });

  it("reuses the same reward settlement path when entering abyss", () => {
    const host = createHost();
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher: createDispatcher(host)
    });

    module.openVictoryChoice(700);

    const [, , onSelect] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
    onSelect?.("enter_abyss");

    expect(host.recordBossRewardClosed).toHaveBeenCalledWith("enter_abyss", 800);
    expect(host.runCompletionModule.enterAbyss).toHaveBeenCalledWith(800);
    expect(host.runCompletionModule.finishRun).not.toHaveBeenCalled();
  });

  it("derives branch victory presentation and compare dispatch from encounter metadata", () => {
    const host = createHost();
    host.run.branchChoice = "molten_route";
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher: createDispatcher(host)
    });

    module.openVictoryChoice(700);

    const [eventDef] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
    expect(eventDef?.name).toBe("Molten Trial Cleared");
    expect(eventDef?.description).toContain("molten route reward");
    expect(eventDef?.description).not.toContain("Daily mode");
    expect(host.queueBossEncounterCompare).toHaveBeenCalledWith(
      expect.objectContaining({ defId: "sovereign_requiem" }),
      expect.objectContaining({ compareBinding: "immediate", encounterId: "branch_molten_trial" })
    );
    expect(host.runLog.appendKey).toHaveBeenCalledWith(
      "boss.branch.molten_trial.log_defeated",
      undefined,
      "success",
      700
    );
  });

  it("defers run resolution until boss reward compare prompts drain", () => {
    const host = createHost();
    let onDrained: (() => void) | undefined;
    const flushBossRewardComparePrompts = host.flushBossRewardComparePrompts;
    expect(flushBossRewardComparePrompts).toBeDefined();
    vi.mocked(flushBossRewardComparePrompts!).mockImplementation((callback) => {
      onDrained = callback;
      return true;
    });
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher: createDispatcher(host)
    });

    module.openVictoryChoice(700);

    const [, , onSelect] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
    onSelect?.("claim_victory");

    expect(host.recordBossRewardClosed).toHaveBeenCalledWith("claim_victory", 800);
    expect(host.runCompletionModule.finishRun).not.toHaveBeenCalled();

    expect(onDrained).toBeTypeOf("function");
    onDrained?.();

    expect(host.runCompletionModule.finishRun).toHaveBeenCalledWith(true);
  });

  it("passes deferred compare binding through the boss reward settlement path", () => {
    const host = createHost();
    host.flushBossRewardComparePrompts = vi.fn(() => true);
    const dispatcher = {
      resolveEncounter: vi.fn(() => ({
        encounter: {
          id: "challenge_ossuary_trial",
          encounterType: "challenge",
          selector: {
            kind: "challenge",
            challengeId: "ossuary_trial",
            floor: 5
          },
          rewardPolicyId: "challenge_boss_default",
          telegraphProfileId: "challenge_default",
          summaryKey: "boss.challenge.ossuary_trial",
          bossId: "bone_sovereign"
        },
        bossDef: BONE_SOVEREIGN,
        rewardPolicy: {
          id: "challenge_boss_default",
          flow: "resume_run",
          rewardSource: "challenge_reward",
          compareBinding: "deferred"
        },
        telegraphProfile: {
          id: "challenge_default",
          tintColor: 0x5aa0d6,
          alpha: 0.46,
          pulseDurationMs: 180,
          radiusScale: 1
        }
      })),
      resolveRewardBinding: vi.fn(() => ({
        encounterId: "challenge_ossuary_trial",
        rewardSource: "challenge_reward",
        compareBinding: "deferred" as const,
        flow: "resume_run" as const,
        rareDropTableId: "boss_bone_sovereign_rare"
      })),
      allowsEnterAbyss: vi.fn(() => false),
      resolveChoiceAction: vi.fn(() => "resume_run" as const)
    } as unknown as BossEncounterDispatcher;
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never,
      dispatcher
    });

    module.openVictoryChoice(700, {
      challengeId: "ossuary_trial"
    });

    const [, , onSelect] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
    onSelect?.("claim_victory");

    expect(host.flushBossRewardComparePrompts).toHaveBeenCalledWith(expect.any(Function), "deferred");
    expect(host.runCompletionModule.finishRun).not.toHaveBeenCalled();
  });
});
