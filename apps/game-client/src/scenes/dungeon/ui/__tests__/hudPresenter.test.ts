import type { MetaProgression, PlayerState } from "@blodex/core";
import { describe, expect, it } from "vitest";
import { HudPresenter } from "../HudPresenter";

const META_MOCK: MetaProgression = {
  schemaVersion: 6,
  preferredLocale: "en-US",
  runsPlayed: 2,
  bestFloor: 3,
  bestTimeMs: 90_000,
  soulShards: 12,
  cumulativeUnlockProgress: 30,
  selectedDifficulty: "normal",
  difficultyCompletions: {
    normal: 1,
    hard: 0,
    nightmare: 0
  },
  unlocks: [],
  talentPoints: {},
  totalShardsSpent: 0,
  blueprintFoundIds: [],
  blueprintForgedIds: [],
  echoes: 0,
  mutationSlots: 1,
  mutationUnlockedIds: [],
  selectedMutationIds: [],
  synergyDiscoveredIds: [],
  endlessBestFloor: 0,
  dailyHistory: [],
  dailyRewardClaimedDates: [],
  permanentUpgrades: {
    startingHealth: 0,
    startingArmor: 0,
    luckBonus: 0,
    potionCharges: 1,
    skillSlots: 2
  }
};

const PLAYER_MOCK: PlayerState = {
  id: "player",
  position: { x: 0, y: 0 },
  level: 1,
  xp: 0,
  xpToNextLevel: 50,
  health: 100,
  mana: 40,
  baseStats: {
    strength: 10,
    dexterity: 10,
    vitality: 10,
    intelligence: 10
  },
  derivedStats: {
    maxHealth: 100,
    maxMana: 40,
    attackPower: 20,
    armor: 5,
    critChance: 0.05,
    attackSpeed: 1,
    moveSpeed: 140
  },
  inventory: [],
  equipment: {},
  gold: 0,
  skills: {
    skillSlots: [null, null],
    cooldowns: {}
  },
  activeBuffs: []
};

describe("HudPresenter", () => {
  it("builds snapshot with stable flags and view projections", () => {
    const presenter = new HudPresenter();
    const logs = [{ id: 1, message: "ok", level: "info" as const, timestampMs: 100 }];
    const view = {
      player: PLAYER_MOCK,
      meta: META_MOCK,
      run: {
        floor: 2,
        biome: "Forgotten Catacombs",
        kills: 4,
        lootCollected: 1,
        targetKills: 12,
        floorGoalReached: false,
        mappingRevealed: true
      }
    };

    const snapshot = presenter.buildSnapshot({
      view,
      logs,
      flags: {
        runEnded: false,
        eventPanelOpen: false,
        debugCheatsEnabled: true,
        timestampMs: 100
      }
    });

    expect(snapshot.view).toBe(view);
    expect(snapshot.logs).toBe(logs);
    expect(snapshot.floor).toEqual({
      floor: 2,
      biome: "Forgotten Catacombs",
      kills: 4,
      targetKills: 12,
      floorGoalReached: false,
      mappingRevealed: true,
      isBossFloor: false
    });
    expect(snapshot.flags.debugCheatsEnabled).toBe(true);
  });
});
