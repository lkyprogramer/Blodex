import type { DamageProfile, DamageType } from "./contracts/types";

export function resolveDamageProfileMultiplier(
  damageProfile: DamageProfile | undefined,
  damageType: DamageType
): number {
  const multiplier = damageProfile?.[damageType];
  if (multiplier === undefined || !Number.isFinite(multiplier)) {
    return 1;
  }
  return Math.max(0.05, multiplier);
}
