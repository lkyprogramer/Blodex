import type { MonsterAffixId, MonsterState, RngLike } from "./contracts/types";

export interface MonsterAffixRollOptions {
  floor: number;
  isBoss: boolean;
  policy?: "default" | "forceOne";
  availableAffixes?: MonsterAffixId[];
  rng: RngLike;
}

export const MONSTER_AFFIX_IDS: MonsterAffixId[] = [
  "frenzied",
  "armored",
  "vampiric",
  "splitting"
];

export interface MonsterAffixLeechTrigger {
  monsterId: string;
  targetId: string;
  amount: number;
  timestampMs: number;
}

export interface MonsterAffixSplitTrigger {
  sourceMonsterId: string;
  spawnedIds: string[];
  timestampMs: number;
}

export interface MonsterAffixOnDealDamageResult {
  monster: MonsterState;
  leechEvent?: MonsterAffixLeechTrigger;
}

export interface MonsterAffixOnKilledResult {
  children: MonsterState[];
  splitEvent?: MonsterAffixSplitTrigger;
}

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
  const forceOne = options.policy === "forceOne" && !options.isBoss;
  if (!forceOne && (options.floor <= 2 || options.isBoss)) {
    return [];
  }
  const pool =
    options.availableAffixes === undefined
      ? MONSTER_AFFIX_IDS
      : options.availableAffixes.length === 0 && forceOne
        ? MONSTER_AFFIX_IDS
        : options.availableAffixes;
  if (pool.length === 0) {
    return [];
  }
  if (!forceOne && options.rng.next() >= affixRollChanceForFloor(options.floor)) {
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

export function resolveMonsterBaseMoveSpeedWithAffixes(
  moveSpeed: number,
  affixes: MonsterAffixId[] = []
): number {
  return applyAffixesToMonsterState({
    id: "affix-move-speed-probe",
    archetypeId: "affix-move-speed-probe",
    level: 1,
    health: 1,
    maxHealth: 1,
    damage: 1,
    attackRange: 1,
    moveSpeed,
    xpValue: 0,
    dropTableId: "",
    position: { x: 0, y: 0 },
    aiState: "idle",
    affixes
  }).moveSpeed;
}

export function hasMonsterAffix(
  monster: Pick<MonsterState, "affixes">,
  affix: MonsterAffixId
): boolean {
  return (monster.affixes ?? []).includes(affix);
}

export function resolveMonsterAffixOnDealDamage(
  monster: MonsterState,
  targetId: string,
  dealtDamage: number,
  timestampMs: number
): MonsterAffixOnDealDamageResult {
  if (!hasMonsterAffix(monster, "vampiric") || dealtDamage <= 0) {
    return { monster };
  }

  const leech = Math.max(1, Math.floor(dealtDamage * 0.35));
  const nextHealth = Math.min(monster.maxHealth, monster.health + leech);
  const actualLeech = nextHealth - monster.health;
  if (actualLeech <= 0) {
    return { monster };
  }

  return {
    monster: {
      ...monster,
      health: nextHealth
    },
    leechEvent: {
      monsterId: monster.id,
      targetId,
      amount: actualLeech,
      timestampMs
    }
  };
}

export function resolveMonsterAffixOnKilled(
  monster: MonsterState,
  timestampMs: number
): MonsterAffixOnKilledResult {
  if (!hasMonsterAffix(monster, "splitting")) {
    return { children: [] };
  }

  const sourceAffixes = monster.affixes ?? [];
  const childAffixes = sourceAffixes.filter((affix) => affix !== "splitting");
  const children: MonsterState[] = [];

  for (let i = 0; i < 2; i += 1) {
    const angle = (Math.PI * 2 * i) / 2;
    children.push({
      ...monster,
      id: `split-${monster.id}-${i}-${Math.floor(timestampMs)}`,
      health: Math.max(1, Math.floor(monster.maxHealth * 0.42)),
      maxHealth: Math.max(1, Math.floor(monster.maxHealth * 0.42)),
      damage: Math.max(1, Math.floor(monster.damage * 0.68)),
      xpValue: Math.max(1, Math.floor(monster.xpValue * 0.45)),
      dropTableId: "",
      position: {
        x: monster.position.x + Math.cos(angle) * 0.7,
        y: monster.position.y + Math.sin(angle) * 0.7
      },
      aiState: "idle",
      affixes: childAffixes
    });
  }

  return {
    children,
    splitEvent: {
      sourceMonsterId: monster.id,
      spawnedIds: children.map((child) => child.id),
      timestampMs
    }
  };
}
