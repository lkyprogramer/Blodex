import type { ItemInstance, ItemSpecialAffixKey } from "./contracts/types";

export interface SpecialAffixTotals {
  lifesteal: number;
  critDamage: number;
  aoeRadius: number;
  damageOverTime: number;
  thorns: number;
  healthRegen: number;
  dodgeChance: number;
  xpBonus: number;
  soulShardBonus: number;
  cooldownReduction: number;
}

const SPECIAL_AFFIX_KEYS: readonly ItemSpecialAffixKey[] = [
  "lifesteal",
  "critDamage",
  "aoeRadius",
  "damageOverTime",
  "thorns",
  "healthRegen",
  "dodgeChance",
  "xpBonus",
  "soulShardBonus",
  "cooldownReduction"
];

const RATIO_AFFIX_KEYS = new Set<ItemSpecialAffixKey>([
  "lifesteal",
  "critDamage",
  "aoeRadius",
  "thorns",
  "dodgeChance",
  "xpBonus",
  "soulShardBonus",
  "cooldownReduction"
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFinite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function round(value: number): number {
  return Number.parseFloat(value.toFixed(4));
}

function normalizeLegacyRatio(value: number): number {
  const finite = toFinite(value);
  if (finite > 1) {
    return finite / 100;
  }
  return finite;
}

export function normalizeSpecialAffixValue(key: ItemSpecialAffixKey, value: number): number {
  const finite = toFinite(value);
  if (RATIO_AFFIX_KEYS.has(key)) {
    return round(normalizeLegacyRatio(finite));
  }
  return round(finite);
}

export function createEmptySpecialAffixTotals(): SpecialAffixTotals {
  return {
    lifesteal: 0,
    critDamage: 0,
    aoeRadius: 0,
    damageOverTime: 0,
    thorns: 0,
    healthRegen: 0,
    dodgeChance: 0,
    xpBonus: 0,
    soulShardBonus: 0,
    cooldownReduction: 0
  };
}

export function clampSpecialAffixTotals(
  totals: Partial<SpecialAffixTotals> | undefined
): SpecialAffixTotals {
  const source = totals ?? {};
  return {
    lifesteal: round(clamp(normalizeSpecialAffixValue("lifesteal", source.lifesteal ?? 0), 0, 0.8)),
    critDamage: round(clamp(normalizeSpecialAffixValue("critDamage", source.critDamage ?? 0), 0, 3)),
    aoeRadius: round(clamp(normalizeSpecialAffixValue("aoeRadius", source.aoeRadius ?? 0), 0, 2)),
    damageOverTime: round(clamp(normalizeSpecialAffixValue("damageOverTime", source.damageOverTime ?? 0), 0, 500)),
    thorns: round(clamp(normalizeSpecialAffixValue("thorns", source.thorns ?? 0), 0, 1)),
    healthRegen: round(clamp(normalizeSpecialAffixValue("healthRegen", source.healthRegen ?? 0), 0, 500)),
    dodgeChance: round(clamp(normalizeSpecialAffixValue("dodgeChance", source.dodgeChance ?? 0), 0, 0.75)),
    xpBonus: round(clamp(normalizeSpecialAffixValue("xpBonus", source.xpBonus ?? 0), 0, 5)),
    soulShardBonus: round(
      clamp(normalizeSpecialAffixValue("soulShardBonus", source.soulShardBonus ?? 0), 0, 5)
    ),
    cooldownReduction: round(
      clamp(normalizeSpecialAffixValue("cooldownReduction", source.cooldownReduction ?? 0), 0, 0.75)
    )
  };
}

export function resolveSpecialAffixTotals(equipment: ItemInstance[]): SpecialAffixTotals {
  const totals = createEmptySpecialAffixTotals();
  for (const item of equipment) {
    const rolled = item.rolledSpecialAffixes;
    if (rolled === undefined) {
      continue;
    }
    for (const key of SPECIAL_AFFIX_KEYS) {
      const value = rolled[key];
      if (value === undefined) {
        continue;
      }
      totals[key] += normalizeSpecialAffixValue(key, value);
    }
  }
  return clampSpecialAffixTotals(totals);
}

export interface HealthRegenTickResult {
  health: number;
  carry: number;
  healed: number;
}

export function resolveHealthRegenTick(
  currentHealth: number,
  maxHealth: number,
  healthRegenPerSecond: number,
  deltaMs: number,
  carry = 0
): HealthRegenTickResult {
  const safeMaxHealth = Math.max(0, Math.floor(maxHealth));
  const safeCurrentHealth = clamp(Math.floor(currentHealth), 0, safeMaxHealth);
  if (safeCurrentHealth >= safeMaxHealth) {
    return {
      health: safeCurrentHealth,
      carry: 0,
      healed: 0
    };
  }

  const regenPerSecond = Math.max(0, toFinite(healthRegenPerSecond));
  const elapsedMs = Math.max(0, toFinite(deltaMs));
  const healedFraction = regenPerSecond * (elapsedMs / 1000);
  const pool = Math.max(0, toFinite(carry)) + healedFraction;
  const whole = Math.floor(pool);
  if (whole <= 0) {
    return {
      health: safeCurrentHealth,
      carry: pool,
      healed: 0
    };
  }

  const healed = Math.min(whole, safeMaxHealth - safeCurrentHealth);
  return {
    health: safeCurrentHealth + healed,
    carry: healed < whole ? 0 : pool - healed,
    healed
  };
}

export function applySoulShardBonus(baseSoulShards: number, soulShardBonus: number): number {
  const normalizedBase = Math.max(0, Math.floor(toFinite(baseSoulShards)));
  const normalizedBonus = clamp(
    normalizeSpecialAffixValue("soulShardBonus", soulShardBonus),
    0,
    5
  );
  return Math.max(0, Math.floor(normalizedBase * (1 + normalizedBonus)));
}
