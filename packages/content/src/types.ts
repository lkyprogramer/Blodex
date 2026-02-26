export type EquipmentSlot = "weapon" | "helm" | "chest" | "boots" | "ring";

export type ItemRarity = "common" | "magic" | "rare";

export type MonsterArchetypeId = "melee_grunt" | "ranged_caster" | "elite_bruiser";

export type DamageType = "physical" | "arcane";

export interface FloorConfig {
  floorNumber: number;
  monsterHpMultiplier: number;
  monsterDmgMultiplier: number;
  monsterCount: number;
  clearThreshold: number;
  isBossFloor: boolean;
}

export interface MonsterAiConfig {
  chaseRange: number;
  attackCooldownMs: number;
  fleeThreshold?: number;
  wanderRadius?: number;
}

export interface MonsterArchetypeDef {
  id: MonsterArchetypeId;
  name: string;
  healthMultiplier: number;
  damageMultiplier: number;
  attackRange: number;
  moveSpeed: number;
  xpValue: number;
  spriteId: string;
  dropTableId: string;
  aiConfig: MonsterAiConfig;
}

export interface ItemAffix {
  key:
    | "maxHealth"
    | "maxMana"
    | "armor"
    | "attackPower"
    | "critChance"
    | "attackSpeed"
    | "moveSpeed";
  min: number;
  max: number;
}

export interface ItemDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  requiredLevel: number;
  iconId: string;
  minAffixes: number;
  maxAffixes: number;
  affixPool: ItemAffix[];
}

export interface LootTableDef {
  id: string;
  entries: Array<{ itemDefId: string; weight: number; minFloor: number }>;
}

export interface GameConfig {
  tileWidth: number;
  tileHeight: number;
  gridWidth: number;
  gridHeight: number;
  floorClearKillTarget: number;
  floorClearKillRatio?: number;
  maxFloors?: number;
  enemyBaseHealth: number;
  enemyBaseDamage: number;
}

export interface BossAttack {
  id: string;
  cooldownMs: number;
  telegraphMs: number;
  type: "melee" | "projectile" | "aoe_zone" | "summon";
  damage: number;
  range: number;
  radius?: number;
}

export interface BossPhase {
  hpThreshold: number;
  attackPattern: BossAttack[];
  enrageTimer?: number;
}

export interface BossDef {
  id: string;
  name: string;
  spriteKey: string;
  baseHealth: number;
  phases: BossPhase[];
  dropTableId: string;
  exclusiveFloor: number;
}

export interface SkillEffect {
  type: "damage" | "heal" | "buff" | "debuff" | "summon";
  value: number | { base: number; scaling: "strength" | "dexterity" | "vitality" | "intelligence"; ratio: number };
  duration?: number;
  radius?: number;
  buffId?: string;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  cooldownMs: number;
  manaCost: number;
  damageType: DamageType;
  targeting: "self" | "nearest" | "directional" | "aoe_around";
  range: number;
  effects: SkillEffect[];
  unlockCondition?: string;
}

export interface UnlockDef {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3 | 4;
  cost: number;
  cumulativeRequirement: number;
  effect:
    | { type: "permanent_upgrade"; key: "startingHealth" | "startingArmor" | "luckBonus" | "skillSlots" | "potionCharges"; value: number }
    | { type: "skill_unlock"; skillId: string }
    | { type: "affix_unlock"; affixId: string }
    | { type: "biome_unlock"; biomeId: string };
}
