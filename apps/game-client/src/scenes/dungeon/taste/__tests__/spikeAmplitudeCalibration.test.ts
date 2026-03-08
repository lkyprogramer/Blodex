import { describe, expect, it } from "vitest";
import { type ItemInstance, deriveStats, type PlayerState } from "@blodex/core";
import { ITEM_DEF_MAP } from "@blodex/content";
import {
  DEFAULT_POWER_SPIKE_CALIBRATION_ASSET,
  getPowerSpikeCalibrationAsset
} from "../PowerSpikeCalibration";
import { scorePowerSpikeFromBuildThreshold, scorePowerSpikeFromItem } from "../PowerSpikeRuntime";

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

describe("powerSpikeCalibration", () => {
  it("exposes an explicit calibration asset with representative samples and artifact path", () => {
    const asset = getPowerSpikeCalibrationAsset();

    expect(asset.id).toBe("phase7-7.2-power-spike-v1");
    expect(asset.baselineArtifactPath).toContain("phase7-7.2-spike-amplitude-calibration.md");
    expect(asset.representativeSamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "rare-weapon-upgrade", sourceKind: "item" }),
        expect.objectContaining({ id: "build-threshold-offense-pivot", sourceKind: "build_threshold" })
      ])
    );
  });

  it("keeps the representative rare weapon upgrade above the accepted and major thresholds", () => {
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
        maxHealth: 12
      },
      rolledSpecialAffixes: {
        critDamage: 0.15
      }
    });

    const amplitude = scorePowerSpikeFromItem(createPlayer([current]), candidate, DEFAULT_POWER_SPIKE_CALIBRATION_ASSET);

    expect(amplitude.accepted).toBe(true);
    expect(amplitude.major).toBe(true);
  });

  it("keeps the representative build-threshold sample above the accepted line", () => {
    const amplitude = scorePowerSpikeFromBuildThreshold(
      {
        tags: ["build:offense", "build:branching", "stat:dexterity"],
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
      },
      DEFAULT_POWER_SPIKE_CALIBRATION_ASSET
    );

    expect(amplitude.accepted).toBe(true);
    expect(amplitude.offensiveDelta).toBeGreaterThanOrEqual(
      DEFAULT_POWER_SPIKE_CALIBRATION_ASSET.thresholds.offensiveAccepted
    );
  });
});
