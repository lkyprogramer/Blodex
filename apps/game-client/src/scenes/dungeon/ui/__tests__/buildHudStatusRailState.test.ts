import { setLocale } from "../../../../i18n";
import { describe, expect, it } from "vitest";
import type { PlayerState } from "@blodex/core";
import { buildHudStatusRailState } from "../buildHudStatusRailState";

function createPlayer(): PlayerState {
  return {
    id: "player-1",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    health: 100,
    mana: 50,
    baseStats: {
      strength: 10,
      dexterity: 10,
      vitality: 10,
      intelligence: 10
    },
    derivedStats: {
      maxHealth: 100,
      maxMana: 50,
      armor: 5,
      attackPower: 12,
      critChance: 0.05,
      attackSpeed: 1,
      moveSpeed: 120
    },
    inventory: [],
    equipment: {
      weapon: {
        id: "ember-weapon",
        defId: "emberbrand_edge",
        name: "Emberbrand Edge",
        slot: "weapon",
        rarity: "rare",
        requiredLevel: 1,
        iconId: "item_weapon",
        seed: "1",
        setId: "ember_vow",
        rolledAffixes: {},
        rolledSpecialAffixes: {}
      },
      ring: {
        id: "ember-ring",
        defId: "cindersigil_band",
        name: "Cindersigil Band",
        slot: "ring",
        rarity: "rare",
        requiredLevel: 1,
        iconId: "item_ring",
        seed: "2",
        setId: "ember_vow",
        rolledAffixes: {},
        rolledSpecialAffixes: {}
      }
    },
    gold: 0,
    skills: {
      skillSlots: [],
      cooldowns: {}
    },
    activeBuffs: [
      {
        defId: "phantom_brew",
        sourceId: "player-1",
        targetId: "player-1",
        appliedAtMs: 0,
        expiresAtMs: 8_000
      },
      {
        defId: "war_cry",
        sourceId: "player-1",
        targetId: "player-1",
        appliedAtMs: 0,
        expiresAtMs: 3_000
      },
      {
        defId: "frost_slow",
        sourceId: "monster-1",
        targetId: "player-1",
        appliedAtMs: 0,
        expiresAtMs: 1_500
      },
      {
        defId: "guaranteed_crit",
        sourceId: "player-1",
        targetId: "player-1",
        appliedAtMs: 0,
        expiresAtMs: 2_500
      },
      {
        defId: "frenzy_tonic",
        sourceId: "player-1",
        targetId: "player-1",
        appliedAtMs: 0,
        expiresAtMs: 4_500
      },
      {
        defId: "phantom_brew",
        sourceId: "player-1",
        targetId: "player-1",
        appliedAtMs: 0,
        expiresAtMs: 6_000
      },
      {
        defId: "war_cry",
        sourceId: "player-1",
        targetId: "player-1",
        appliedAtMs: 0,
        expiresAtMs: 6_500
      }
    ]
  };
}

describe("buildHudStatusRailState", () => {
  it("sorts buffs by category and remaining time while preserving set/synergy indicators", () => {
    setLocale("en-US", { persist: false });
    const result = buildHudStatusRailState({
      player: createPlayer(),
      synergyRuntime: {
        activeSynergyIds: ["syn_staff_chain_lightning_overload"]
      },
      nowMs: 1_000,
      itemSetName: (_setId, fallback) => fallback
    });

    expect(result.state?.buffs).toHaveLength(6);
    expect(result.state?.overflowCount).toBe(1);
    expect(result.state?.buffs[0]).toMatchObject({
      id: "frost_slow",
      tone: "debuff"
    });
    expect(result.state?.indicators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "set:ember_vow",
          tone: "set"
        }),
        expect.objectContaining({
          id: "synergy:syn_staff_chain_lightning_overload",
          tone: "synergy"
        })
      ])
    );
    expect(result.nextRefreshAt).toBeGreaterThan(1_000);
    expect(result.nextRefreshAt).toBeLessThanOrEqual(1_250);
  });

  it("shows set progress even before the first set threshold is active", () => {
    setLocale("en-US", { persist: false });
    const basePlayer = createPlayer();
    const result = buildHudStatusRailState({
      player: {
        ...basePlayer,
        equipment: {
          weapon: basePlayer.equipment.weapon!
        }
      },
      synergyRuntime: {
        activeSynergyIds: []
      },
      nowMs: 1_000,
      itemSetName: (_setId, fallback) => fallback
    });

    expect(result.state?.indicators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "set:ember_vow",
          detail: "1/3",
          tone: "set"
        })
      ])
    );
  });
});
