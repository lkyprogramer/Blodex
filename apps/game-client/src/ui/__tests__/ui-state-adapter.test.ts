import type { MetaProgression, PlayerState } from "@blodex/core";
import { describe, expect, it } from "vitest";
import { createUIStateSnapshot } from "../state/UIStateAdapter";

const META_MOCK: MetaProgression = {
  schemaVersion: 2,
  runsPlayed: 3,
  bestFloor: 5,
  bestTimeMs: 123_000,
  soulShards: 12,
  cumulativeUnlockProgress: 80,
  selectedDifficulty: "normal",
  difficultyCompletions: {
    normal: 1,
    hard: 0,
    nightmare: 0
  },
  unlocks: [],
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
  level: 2,
  xp: 35,
  xpToNextLevel: 100,
  health: 80,
  mana: 30,
  baseStats: {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10
  },
  derivedStats: {
    maxHealth: 100,
    maxMana: 50,
    attackPower: 20,
    armor: 8,
    critChance: 0.1,
    attackSpeed: 1,
    moveSpeed: 1
  },
  inventory: [],
  equipment: {},
  gold: 0,
  skills: {
    skillSlots: [],
    cooldowns: {}
  },
  activeBuffs: []
};

describe("createUIStateSnapshot", () => {
  it("builds floor and boss runtime view fields", () => {
    const snapshot = createUIStateSnapshot(
      {
        player: PLAYER_MOCK,
        meta: META_MOCK,
        run: {
          floor: 4,
          biome: "Frozen Halls",
          kills: 9,
          lootCollected: 3,
          targetKills: 12,
          floorGoalReached: true,
          isBossFloor: true,
          bossHealth: 450,
          bossMaxHealth: 1000,
          bossPhase: 1,
          mappingRevealed: true
        }
      },
      {
        logs: [{ id: 1, level: "info", message: "hello", timestampMs: 100 }],
        flags: {
          runEnded: false,
          eventPanelOpen: false,
          debugCheatsEnabled: true,
          timestampMs: 100
        }
      }
    );

    expect(snapshot.floor).toEqual({
      floor: 4,
      biome: "Frozen Halls",
      kills: 9,
      targetKills: 12,
      floorGoalReached: true,
      mappingRevealed: true,
      isBossFloor: true
    });
    expect(snapshot.boss).toEqual({
      health: 450,
      maxHealth: 1000,
      phase: 1
    });
    expect(snapshot.logs).toHaveLength(1);
    expect(snapshot.flags.debugCheatsEnabled).toBe(true);
  });

  it("omits boss runtime state on non-boss floors", () => {
    const snapshot = createUIStateSnapshot(
      {
        player: PLAYER_MOCK,
        meta: META_MOCK,
        run: {
          floor: 2,
          kills: 3,
          lootCollected: 1,
          targetKills: 10,
          floorGoalReached: false
        }
      },
      {
        logs: [],
        flags: {
          runEnded: false,
          eventPanelOpen: true,
          debugCheatsEnabled: false,
          timestampMs: 220
        }
      }
    );

    expect(snapshot.boss).toBeUndefined();
    expect(snapshot.floor.isBossFloor).toBe(false);
    expect(snapshot.flags.eventPanelOpen).toBe(true);
  });
});
