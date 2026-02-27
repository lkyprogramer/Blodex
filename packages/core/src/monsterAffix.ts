import type { MonsterAffixId, MonsterState, RngLike } from "./contracts/types";

export interface MonsterAffixRollOptions {
  floor: number;
  isBoss: boolean;
  availableAffixes?: MonsterAffixId[];
  rng: RngLike;
}

export const MONSTER_AFFIX_IDS: MonsterAffixId[] = [
  "frenzied",
  "armored",
  "vampiric",
  "splitting"
];

export function affixRollChanceForFloor(floor: number): number {
  if (floor <= 2) {
    return 0;
  }
  if (floor <= 4) {
    return 0.2;
  }
  return 0.12;
}

export function rollMonsterAffixes(options: MonsterAffixRollOptions): MonsterAffixId[] {
  if (options.floor <= 2 || options.isBoss) {
    return [];
  }
  const pool =
    options.availableAffixes === undefined ? MONSTER_AFFIX_IDS : options.availableAffixes;
  if (pool.length === 0) {
    return [];
  }
  if (options.rng.next() >= affixRollChanceForFloor(options.floor)) {
    return [];
  }
  return [options.rng.pick(pool)];
}

function withScaled(value: number, ratio: number): number {
  return Math.max(1, Math.floor(value * ratio));
}

export function applyAffixesToMonsterState(monster: MonsterState): MonsterState {
  const affixes = monster.affixes ?? [];
  if (affixes.length === 0) {
    return monster;
  }

  let next = { ...monster };
  for (const affix of affixes) {
    switch (affix) {
      case "frenzied":
        next = {
          ...next,
          moveSpeed: withScaled(next.moveSpeed, 1.22),
          damage: withScaled(next.damage, 1.16)
        };
        break;
      case "armored":
        next = {
          ...next,
          maxHealth: withScaled(next.maxHealth, 1.28),
          health: withScaled(next.health, 1.28),
          damage: withScaled(next.damage, 0.94)
        };
        break;
      case "vampiric":
      case "splitting":
        break;
    }
  }
  return next;
}

export function hasMonsterAffix(
  monster: Pick<MonsterState, "affixes">,
  affix: MonsterAffixId
): boolean {
  return (monster.affixes ?? []).includes(affix);
}
