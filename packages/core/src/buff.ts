import type { AggregatedBuffEffect, BuffDef, BuffInstance } from "./contracts/types";

export function applyBuff(target: BuffInstance[], buff: BuffInstance): BuffInstance[] {
  return [...target, buff];
}

export function updateBuffs(
  buffs: BuffInstance[],
  nowMs: number
): { active: BuffInstance[]; expired: BuffInstance[] } {
  const active: BuffInstance[] = [];
  const expired: BuffInstance[] = [];

  for (const buff of buffs) {
    if (nowMs >= buff.expiresAtMs) {
      expired.push(buff);
      continue;
    }
    active.push(buff);
  }

  return { active, expired };
}

export function createEmptyBuffEffect(): AggregatedBuffEffect {
  return {
    additive: {},
    multiplicative: {},
    guaranteedCrit: false,
    dotDamagePerTick: 0,
    dotTickIntervalMs: 0
  };
}

export function aggregateBuffEffects(
  buffs: BuffInstance[],
  buffDefs: Record<string, BuffDef>
): AggregatedBuffEffect {
  const result = createEmptyBuffEffect();

  for (const instance of buffs) {
    const def = buffDefs[instance.defId];
    if (def === undefined) {
      continue;
    }

    if (def.statModifiers !== undefined) {
      for (const [key, value] of Object.entries(def.statModifiers) as Array<[keyof NonNullable<typeof def.statModifiers>, number]>) {
        result.additive[key] = (result.additive[key] ?? 0) + value;
      }
    }

    if (def.statMultipliers !== undefined) {
      for (const [key, value] of Object.entries(def.statMultipliers) as Array<
        [keyof NonNullable<typeof def.statMultipliers>, number]
      >) {
        result.multiplicative[key] = (result.multiplicative[key] ?? 1) * value;
      }
    }

    if (def.guaranteedCrit === true) {
      result.guaranteedCrit = true;
    }

    if (def.slow !== undefined) {
      result.slowMultiplier = Math.min(result.slowMultiplier ?? 1, def.slow);
    }

    if (def.dot !== undefined) {
      result.dotDamagePerTick += def.dot.damagePerTick;
      result.dotTickIntervalMs =
        result.dotTickIntervalMs === 0
          ? def.dot.tickIntervalMs
          : Math.min(result.dotTickIntervalMs, def.dot.tickIntervalMs);
    }
  }

  return result;
}
