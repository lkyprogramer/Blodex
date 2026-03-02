export type EquipmentSlot = "weapon" | "helm" | "chest" | "boots" | "ring";

export type ItemRarity = "common" | "magic" | "rare";

export type ItemKind = "equipment" | "consumable" | "unique";

export type MonsterArchetypeId = string;

export type BiomeId =
  | "forgotten_catacombs"
  | "molten_caverns"
  | "frozen_halls"
  | "bone_throne";

export type HazardType = "damage_zone" | "movement_modifier" | "periodic_trap";

export type MonsterAiBehavior = "chase" | "kite" | "ambush" | "swarm" | "shield" | "support";

export type MonsterAffixId = "frenzied" | "armored" | "vampiric" | "splitting";

export type DamageType = "physical" | "arcane";

export type DifficultyMode = "normal" | "hard" | "nightmare";

export type WeaponType = "sword" | "axe" | "dagger" | "staff" | "hammer" | "sword_master";

export type ItemSpecialAffixKey =
  | "lifesteal"
  | "critDamage"
  | "aoeRadius"
  | "damageOverTime"
  | "thorns"
  | "healthRegen"
  | "dodgeChance"
  | "xpBonus"
  | "soulShardBonus"
  | "cooldownReduction";

export type ConsumableId = "health_potion" | "mana_potion" | "scroll_of_mapping";

export interface FloorConfig {
  floorNumber: number;
  monsterHpMultiplier: number;
  monsterDmgMultiplier: number;
  monsterCount: number;
  clearThreshold: number;
  isBossFloor: boolean;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  ambientColor: number;
  floorTilesetKey: string;
  wallStyleKey: string;
  roomCount: { min: number; max: number };
  monsterPool: MonsterArchetypeId[];
  hazardPool: string[];
  lootBias: Partial<Record<EquipmentSlot, number>>;
}

export interface HazardDef {
  id: string;
  type: HazardType;
  damagePerTick?: number;
  tickIntervalMs?: number;
  movementMultiplier?: number;
  triggerIntervalMs?: number;
  telegraphMs?: number;
  radiusTiles?: number;
  spriteKey: string;
}

export interface MonsterAffixDef {
  id: MonsterAffixId;
  name: string;
  description: string;
}

export interface MonsterAiConfig {
  behavior: MonsterAiBehavior;
  chaseRange: number;
  attackCooldownMs: number;
  preferredDistance?: number;
  ambushRadius?: number;
  swarmRadius?: number;
  shieldThreshold?: number;
  supportRange?: number;
  healThreshold?: number;
  healPower?: number;
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

export interface ItemSpecialAffix {
  key: ItemSpecialAffixKey;
  min: number;
  max: number;
}

export interface ItemDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  kind?: ItemKind;
  weaponType?: WeaponType;
  rarity: ItemRarity;
  requiredLevel: number;
  iconId: string;
  minAffixes: number;
  maxAffixes: number;
  affixPool: ItemAffix[];
  minSpecialAffixes?: number;
  maxSpecialAffixes?: number;
  specialAffixPool?: ItemSpecialAffix[];
  fixedAffixes?: Partial<Record<ItemAffix["key"], number>>;
  fixedSpecialAffixes?: Partial<Record<ItemSpecialAffixKey, number>>;
}

export interface LootTableDef {
  id: string;
  entries: Array<{ itemDefId: string; weight: number; minFloor: number }>;
}

export interface RandomEventChoice {
  id: string;
  name: string;
  description: string;
  cost?: { type: "health" | "mana" | "obol"; amount: number };
  rewards: Array<
    | { type: "health"; amount: number }
    | { type: "mana"; amount: number }
    | { type: "obol"; amount: number }
    | { type: "xp"; amount: number }
    | { type: "mapping" }
    | { type: "item"; itemDefId?: string; lootTableId?: string }
    | { type: "consumable"; consumableId: ConsumableId; amount: number }
  >;
  risk?: {
    chance: number;
    penalty:
      | { type: "health"; amount: number }
      | { type: "mana"; amount: number }
      | { type: "obol"; amount: number }
      | { type: "xp"; amount: number }
      | { type: "mapping" }
      | { type: "item"; itemDefId?: string; lootTableId?: string }
      | { type: "consumable"; consumableId: ConsumableId; amount: number };
  };
}

export interface RandomEventDef {
  id: string;
  name: string;
  description: string;
  floorRange: { min: number; max: number };
  biomeIds?: BiomeId[];
  unlockId?: string;
  spawnWeight: number;
  choices: RandomEventChoice[];
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
    | { type: "biome_unlock"; biomeId: string }
    | { type: "event_unlock"; eventId: string };
}

export type TalentPath = "core" | "warrior" | "ranger" | "arcanist" | "utility";

export type TalentEffect =
  | {
      type: "base_stat_flat";
      stat: "strength" | "dexterity" | "vitality" | "intelligence";
      value: number;
    }
  | {
      type: "derived_stat_flat";
      stat: "maxHealth" | "maxMana" | "armor" | "attackPower";
      value: number;
    }
  | {
      type: "derived_stat_percent";
      stat: "attackPower" | "attackSpeed" | "moveSpeed" | "critChance";
      value: number;
    }
  | {
      type: "economy";
      key: "deathRetention" | "merchantDiscount";
      value: number;
    }
  | {
      type: "capacity";
      key: "skillSlots" | "potionCharges";
      value: number;
    }
  | {
      type: "trigger";
      key: "lethalGuard" | "phaseDodge" | "manaShield";
      value: number;
    };

export interface TalentPrerequisite {
  talentId: string;
  minRank: number;
}

export interface TalentNodeDef {
  id: string;
  path: TalentPath;
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  name: string;
  description: string;
  cost: number;
  maxRank: number;
  prerequisites: TalentPrerequisite[];
  effects: TalentEffect[];
  uiPosition: { x: number; y: number };
}

export interface BlueprintDropSource {
  type:
    | "monster_affix"
    | "boss_kill"
    | "boss_first_kill"
    | "challenge_room"
    | "hidden_room"
    | "random_event"
    | "floor_clear";
  sourceId?: string;
  chance: number;
  floorMin?: number;
  onlyIfNotFound?: boolean;
}

export interface BlueprintDef {
  id: string;
  name: string;
  category: "skill" | "weapon" | "consumable" | "event" | "mutation";
  unlockTargetId: string;
  forgeCost: number;
  rarity: "common" | "rare" | "legendary";
  dropSources: BlueprintDropSource[];
}

export type MutationEffect =
  | { type: "on_kill_heal_percent"; value: number }
  | { type: "on_kill_attack_speed"; value: number; durationMs: number; maxStacks: number }
  | { type: "on_hit_invuln"; chance: number; durationMs: number; cooldownMs: number }
  | { type: "on_hit_reflect_percent"; value: number }
  | { type: "once_per_floor_lethal_guard"; invulnMs: number }
  | { type: "drop_bonus"; soulShardPercent: number; obolPercent: number }
  | { type: "move_speed_multiplier"; value: number }
  | { type: "potion_heal_amp_and_self_damage"; healPercent: number; selfDamageCurrentHpPercent: number }
  | { type: "hidden_room_reveal_radius"; value: number };

export interface MutationDef {
  id: string;
  name: string;
  category: "offensive" | "defensive" | "utility";
  tier: 1 | 2 | 3;
  unlock:
    | { type: "default" }
    | { type: "blueprint"; blueprintId: string }
    | { type: "echo"; cost: number };
  incompatibleWith?: string[];
  effects: MutationEffect[];
}

export interface WeaponTypeDef {
  id: WeaponType;
  attackSpeedMultiplier: number;
  attackRange: number;
  damageMultiplier: number;
  mechanic:
    | { type: "none" }
    | { type: "crit_bonus"; critChanceBonus: number; critDamageMultiplier?: number }
    | { type: "aoe_cleave"; radius: number; secondaryDamagePercent: number }
    | { type: "stagger"; chance: number; slowPercent: number; durationMs: number }
    | { type: "skill_amp"; skillDamagePercent: number }
    | { type: "projectile"; speed: number };
  unlock:
    | { type: "default" }
    | { type: "blueprint"; blueprintId: string };
}
