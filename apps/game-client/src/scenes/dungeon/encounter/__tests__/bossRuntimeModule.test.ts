import { describe, expect, it, vi } from "vitest";
import type { ItemInstance } from "@blodex/core";
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
    grantStoryBossReward: vi.fn(() => [createReward("sovereign_requiem"), createReward("voidsigil_band")]),
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

describe("BossRuntimeModule", () => {
  it("grants story boss rewards before showing the victory choice panel", () => {
    const host = createHost();
    const module = new BossRuntimeModule({
      host,
      combatService: { updateCombat: vi.fn() } as never,
      spawnService: { spawnBoss: vi.fn() } as never
    });

    module.openVictoryChoice(700);

    expect(host.grantStoryBossReward).toHaveBeenCalledWith(700);
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
      spawnService: { spawnBoss: vi.fn() } as never
    });

    module.openVictoryChoice(700);

    const [, , onSelect] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
    onSelect?.("enter_abyss");

    expect(host.recordBossRewardClosed).toHaveBeenCalledWith("enter_abyss", 800);
    expect(host.runCompletionModule.enterAbyss).toHaveBeenCalledWith(800);
    expect(host.runCompletionModule.finishRun).not.toHaveBeenCalled();
  });
});
