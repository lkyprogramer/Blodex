import type { EquipmentSlot } from "./contracts/types";
import type { ItemTradeoffCategory } from "./itemTradeoff";

export interface ItemTradeoffWeightConfig {
  category: ItemTradeoffCategory;
  weight: number;
}

export interface ItemTradeoffSampleScenario {
  id: string;
  slot: EquipmentSlot;
  candidateDefId: string;
  compareDefId?: string;
  expectedDecision: "equip" | "skip" | "prompt";
  note: string;
}

export interface ItemTradeoffCalibrationAsset {
  id: string;
  version: number;
  baselineArtifactPath: string;
  rationale: string;
  slotIdentity: Record<EquipmentSlot, string>;
  weights: Readonly<Record<string, ItemTradeoffWeightConfig>>;
  merchantCompareThresholds: {
    minPowerDelta: number;
    minPositiveSummaryCount: number;
  };
  sampleScenarios: readonly ItemTradeoffSampleScenario[];
}

export const DEFAULT_ITEM_TRADEOFF_CALIBRATION_ASSET: ItemTradeoffCalibrationAsset = {
  id: "phase7-7.2-item-tradeoff-v1",
  version: 1,
  baselineArtifactPath: "docs/plans/phase7/calibration/2026-03-08-phase7-7.2-item-tradeoff-calibration.md",
  rationale:
    "Phase 7.2 freezes the compare/merchant/simulator tradeoff model into an explicit calibration asset so score drift is auditable instead of being hidden in ordinary constants.",
  slotIdentity: {
    weapon: "primary-dps-slot",
    helm: "top-end-defense-slot",
    chest: "core-defense-slot",
    boots: "mobility-slot",
    ring: "hybrid-utility-slot"
  },
  weights: {
    attackPower: { category: "offense", weight: 2.2 },
    critChance: { category: "offense", weight: 160 },
    critDamage: { category: "offense", weight: 120 },
    attackSpeed: { category: "offense", weight: 32 },
    aoeRadius: { category: "offense", weight: 90 },
    skillBonusDamage: { category: "offense", weight: 1.8 },
    lifesteal: { category: "offense", weight: 150 },
    maxHealth: { category: "defense", weight: 0.18 },
    armor: { category: "defense", weight: 1.35 },
    dodgeChance: { category: "defense", weight: 120 },
    healthRegen: { category: "defense", weight: 3 },
    thorns: { category: "defense", weight: 70 },
    maxMana: { category: "utility", weight: 0.18 },
    moveSpeed: { category: "utility", weight: 0.55 },
    xpBonus: { category: "utility", weight: 12 },
    soulShardBonus: { category: "utility", weight: 8 },
    cooldownReduction: { category: "utility", weight: 110 }
  },
  merchantCompareThresholds: {
    minPowerDelta: 10,
    minPositiveSummaryCount: 2
  },
  sampleScenarios: [
    {
      id: "weapon-major-upgrade",
      slot: "weapon",
      candidateDefId: "sanctified_greatsword",
      compareDefId: "rusted_sabre",
      expectedDecision: "prompt",
      note: "High-value offensive upgrade should trigger compare prompt and be treated as a clear equip decision."
    },
    {
      id: "boots-tradeoff-mobility",
      slot: "boots",
      candidateDefId: "catacomb_greaves",
      compareDefId: "wanderer_boots",
      expectedDecision: "prompt",
      note: "Boots should preserve the mobility-vs-defense tradeoff instead of collapsing to a flat offense score."
    },
    {
      id: "low-value-merchant-sidegrade",
      slot: "ring",
      candidateDefId: "oath_ring",
      compareDefId: "iron_vow_loop",
      expectedDecision: "skip",
      note: "Low-value merchant sidegrades should stay below the compare gate."
    }
  ]
};

export function getItemTradeoffCalibrationAsset(
  asset: ItemTradeoffCalibrationAsset = DEFAULT_ITEM_TRADEOFF_CALIBRATION_ASSET
): ItemTradeoffCalibrationAsset {
  return {
    ...asset,
    slotIdentity: { ...asset.slotIdentity },
    weights: Object.fromEntries(
      Object.entries(asset.weights).map(([key, value]) => [key, { ...value }])
    ) as Record<string, ItemTradeoffWeightConfig>,
    merchantCompareThresholds: { ...asset.merchantCompareThresholds },
    sampleScenarios: asset.sampleScenarios.map((scenario) => ({ ...scenario }))
  };
}
