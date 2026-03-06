import { describe, expect, it } from "vitest";
import { deriveStats, type ItemInstance, type PlayerState } from "@blodex/core";
import { ITEM_DEF_MAP, LOOT_TABLE_MAP } from "@blodex/content";
import {
  PowerSpikeBudgetTracker,
  resolveGuaranteedSpikeReward,
  scorePowerSpikeFromBuildThreshold,
  scorePowerSpikeFromItem
} from "../PowerSpikeRuntime";

function makeItem(defId: string, overrides: Partial<ItemInstance> = {}): ItemInstance {
  const def = ITEM_DEF_MAP[defId]!;
  return {
    id: `${defId}-instance`,
    defId: def.id,
    name: def.name,
    slot: def.slot,
    kind: def.kind ?? "equipment",
    ...(def.weaponType === undefined ? {} : { weaponType: def.weaponType }),
    rarity: def.rarity,
    requiredLevel: def.requiredLevel,
    iconId: def.iconId,
    seed: `${defId}-seed`,
    rolledAffixes: {},
    ...(def.fixedSpecialAffixes === undefined ? {} : { rolledSpecialAffixes: { ...def.fixedSpecialAffixes } }),
    ...overrides
  };
}

function createPlayer(equipment: ItemInstance[] = []): PlayerState {
  const baseStats = {
    strength: 8,
    dexterity: 8,
    vitality: 8,
    intelligence: 5
  };
  const equipmentBySlot = Object.fromEntries(equipment.map((item) => [item.slot, item]));
  const derivedStats = deriveStats(baseStats, equipment);
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 3,
    xp: 0,
    xpToNextLevel: 100,
    pendingLevelUpChoices: 0,
    pendingSkillChoices: 0,
    health: derivedStats.maxHealth,
    mana: derivedStats.maxMana,
    baseStats,
    derivedStats,
    inventory: [],
    equipment: equipmentBySlot,
    gold: 0,
    skills: {
      skillSlots: [],
      cooldowns: {}
    },
    activeBuffs: []
  };
}

describe("PowerSpikeRuntime", () => {
  it("scores large rare item upgrades as accepted major spikes", () => {
    const current = makeItem("rusted_sabre", {
      rolledAffixes: {
        attackPower: 2
      }
    });
    const candidate = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16,
        critChance: 0.04,
        attackSpeed: 0.04,
        maxHealth: 14
      },
      rolledSpecialAffixes: {
        critDamage: 0.2,
        lifesteal: 0.05
      }
    });
    const amplitude = scorePowerSpikeFromItem(createPlayer([current]), candidate);

    expect(amplitude.accepted).toBe(true);
    expect(amplitude.major).toBe(true);
    expect(amplitude.offensiveDelta).toBeGreaterThanOrEqual(0.3);
  });

  it("resolves a fallback reward candidate that satisfies spike thresholds", () => {
    const player = createPlayer([makeItem("rusted_sabre"), makeItem("grim_helm"), makeItem("patchwork_hauberk")]);
    const reward = resolveGuaranteedSpikeReward({
      table: LOOT_TABLE_MAP.cathedral_depths!,
      floor: 2,
      player,
      itemDefs: ITEM_DEF_MAP,
      seedBase: "phase6-6.2:test:fallback"
    });

    expect(reward).not.toBeNull();
    expect(scorePowerSpikeFromItem(player, reward!)).toMatchObject({
      accepted: true
    });
  });

  it("tracks pair satisfaction and fallback grant state", () => {
    const tracker = new PowerSpikeBudgetTracker();

    expect(tracker.needsFallbackReward(2)).toBe(true);
    tracker.markFallbackGranted(2);
    expect(tracker.needsFallbackReward(2)).toBe(false);
    tracker.recordAcceptedSpike(2, {
      offensiveDelta: 0.32,
      defensiveDelta: 0.12,
      utilityDelta: 0.08,
      ttkDelta: 0.27,
      sustainDelta: 0.05,
      accepted: true,
      major: false,
      dominantAxis: "offense"
    });

    expect(tracker.isPairSatisfied("1-2")).toBe(true);
    expect(tracker.snapshot().acceptedSpikeCount).toBe(1);
  });

  it("treats formed build thresholds as contract spikes", () => {
    const amplitude = scorePowerSpikeFromBuildThreshold({
      tags: ["build:offense", "stat:dexterity", "build:branching"],
      keyItemDefIds: ["bloodsigil_band"],
      pivots: [
        {
          type: "item",
          floor: 2,
          source: "drop",
          timestampMs: 1000,
          detail: "bloodsigil_band"
        }
      ]
    });

    expect(amplitude.accepted).toBe(true);
    expect(amplitude.offensiveDelta).toBeGreaterThan(0.3);
  });
});
