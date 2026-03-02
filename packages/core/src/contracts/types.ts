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

export type WeaponType = "sword" | "axe" | "dagger" | "staff" | "hammer";

export interface DifficultyModifier {
  monsterHealthMultiplier: number;
  monsterDamageMultiplier: number;
  affixPolicy: "default" | "forceOne";
  soulShardMultiplier: number;
}

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

export interface BaseStats {
  strength: number;
  dexterity: number;
  vitality: number;
  intelligence: number;
}

export interface DerivedStats {
  maxHealth: number;
  maxMana: number;
  armor: number;
  attackPower: number;
  critChance: number;
  attackSpeed: number;
  moveSpeed: number;
}

export interface AggregatedBuffEffect {
  additive: Partial<Record<keyof DerivedStats, number>>;
  multiplicative: Partial<Record<keyof DerivedStats, number>>;
  guaranteedCrit: boolean;
  slowMultiplier?: number;
  dotDamagePerTick: number;
  dotTickIntervalMs: number;
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

export type RunRngStreamName =
  | "procgen"
  | "spawn"
  | "combat"
  | "loot"
  | "skill"
  | "boss"
  | "biome"
  | "hazard"
  | "event"
  | "merchant";

export interface RunSeed {
  runSeed: string;
  floor: number;
  stream: RunRngStreamName;
}

export interface ReplayInputMove {
  type: "move_target";
  atMs: number;
  target: { x: number; y: number };
}

export interface ReplayInputAttack {
  type: "attack_target";
  atMs: number;
  targetId: string;
}

export interface ReplayInputSkill {
  type: "skill_use";
  atMs: number;
  skillId: string;
  targetId?: string;
}

export interface ReplayInputFloorTransition {
  type: "floor_transition";
  atMs: number;
  fromFloor: number;
  toFloor: number;
}

export type ReplayInputEvent =
  | ReplayInputMove
  | ReplayInputAttack
  | ReplayInputSkill
  | ReplayInputFloorTransition;

export interface RunReplay {
  version: string;
  runSeed: string;
  floor: number;
  currentFloor?: number;
  difficulty?: DifficultyMode;
  inputs: ReplayInputEvent[];
  checksum?: string;
}

export interface ItemAffix {
  key: keyof DerivedStats;
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
  fixedAffixes?: Partial<DerivedStats>;
  fixedSpecialAffixes?: Partial<Record<ItemSpecialAffixKey, number>>;
}

export interface ItemInstance {
  id: string;
  defId: string;
  name: string;
  slot: EquipmentSlot;
  kind?: ItemKind;
  weaponType?: WeaponType;
  rarity: ItemRarity;
  requiredLevel: number;
  iconId: string;
  seed: string;
  rolledAffixes: Partial<DerivedStats>;
  rolledSpecialAffixes?: Partial<Record<ItemSpecialAffixKey, number>>;
}

export interface LootEntry {
  itemDefId: string;
  weight: number;
  minFloor: number;
}

export interface LootTableDef {
  id: string;
  entries: LootEntry[];
}

export interface BuffDef {
  id: string;
  name: string;
  duration: number;
  statModifiers?: Partial<Record<keyof DerivedStats, number>>;
  statMultipliers?: Partial<Record<keyof DerivedStats, number>>;
  dot?: { damagePerTick: number; tickIntervalMs: number };
  slow?: number;
  guaranteedCrit?: boolean;
}

export interface BuffInstance {
  defId: string;
  sourceId: string;
  targetId: string;
  appliedAtMs: number;
  expiresAtMs: number;
}

export interface SkillEffect {
  type: "damage" | "heal" | "buff" | "debuff" | "summon";
  value: number | { base: number; scaling: keyof BaseStats; ratio: number };
  duration?: number;
  radius?: number;
  buffId?: string;
  summonArchetypeId?: MonsterArchetypeId;
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

export interface SkillInstance {
  defId: string;
  level: number;
}

export interface PlayerSkillState {
  skillSlots: Array<SkillInstance | null>;
  cooldowns: Record<string, number>;
}

export interface SkillResolution {
  player: PlayerState;
  affectedMonsters: MonsterState[];
  events: CombatEvent[];
  buffsApplied: BuffInstance[];
}

export interface PlayerState {
  id: string;
  position: { x: number; y: number };
  level: number;
  xp: number;
  xpToNextLevel: number;
  health: number;
  mana: number;
  baseStats: BaseStats;
  derivedStats: DerivedStats;
  inventory: ItemInstance[];
  equipment: Partial<Record<EquipmentSlot, ItemInstance>>;
  gold: number;
  skills?: PlayerSkillState;
  activeBuffs?: BuffInstance[];
}

export interface MonsterState {
  id: string;
  archetypeId: MonsterArchetypeId;
  level: number;
  health: number;
  maxHealth: number;
  damage: number;
  attackRange: number;
  moveSpeed: number;
  xpValue: number;
  dropTableId: string;
  position: { x: number; y: number };
  aiState:
    | "idle"
    | "chase"
    | "kite"
    | "ambush"
    | "swarm"
    | "shield"
    | "support"
    | "attack"
    | "dead";
  aiBehavior?: MonsterAiBehavior;
  affixes?: MonsterAffixId[];
  isBoss?: boolean;
}

export interface DungeonRoom {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DungeonCorridor {
  fromRoomId: string;
  toRoomId: string;
  path: Array<{ x: number; y: number }>;
}

export interface HiddenRoomState {
  roomId: string;
  entrance: { x: number; y: number };
  revealed: boolean;
  rewardsClaimed: boolean;
}

export interface DungeonLayout {
  width: number;
  height: number;
  walkable: boolean[][];
  rooms: DungeonRoom[];
  corridors: DungeonCorridor[];
  spawnPoints: Array<{ x: number; y: number }>;
  playerSpawn: { x: number; y: number };
  hiddenRooms?: HiddenRoomState[];
  layoutHash: string;
}

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

export interface HazardRuntimeState {
  id: string;
  defId: string;
  type: HazardType;
  position: { x: number; y: number };
  radiusTiles: number;
  damagePerTick: number | undefined;
  tickIntervalMs: number | undefined;
  movementMultiplier: number | undefined;
  triggerIntervalMs: number | undefined;
  telegraphMs: number | undefined;
  nextTickAtMs: number | undefined;
  nextTriggerAtMs: number | undefined;
}

export interface MonsterAffixDef {
  id: MonsterAffixId;
  name: string;
  description: string;
}

export interface StaircaseState {
  position: { x: number; y: number };
  visible: boolean;
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

export interface BossRuntimeState {
  bossId: string;
  currentPhaseIndex: number;
  health: number;
  maxHealth: number;
  attackCooldowns: Record<string, number>;
  position: { x: number; y: number };
  aiState: "idle" | "telegraph" | "attacking" | "summoning" | "dead";
  telegraphTarget?: { x: number; y: number };
  telegraphEndMs?: number;
  enrageAtMs?: number;
}

export interface CombatEvent {
  kind: "damage" | "death" | "dodge" | "crit";
  sourceId: string;
  targetId: string;
  amount: number;
  damageType: DamageType;
  timestampMs: number;
}

export type ConsumableId = "health_potion" | "mana_potion" | "scroll_of_mapping";

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  description: string;
  hotkey?: "R" | "F" | "G";
}

export interface ConsumableState {
  charges: Record<ConsumableId, number>;
  cooldowns: Record<ConsumableId, number>;
}

export interface EventCost {
  type: "health" | "mana" | "obol";
  amount: number;
}

export type EventReward =
  | { type: "health"; amount: number }
  | { type: "mana"; amount: number }
  | { type: "obol"; amount: number }
  | { type: "xp"; amount: number }
  | { type: "mapping" }
  | { type: "item"; itemDefId?: string; lootTableId?: string }
  | { type: "consumable"; consumableId: ConsumableId; amount: number };

export interface EventChoice {
  id: string;
  name: string;
  description: string;
  cost?: EventCost;
  rewards: EventReward[];
  risk?: {
    chance: number;
    penalty: EventReward;
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
  choices: EventChoice[];
}

export interface MerchantOffer {
  offerId: string;
  itemDefId: string;
  priceObol: number;
}

export interface RunEconomyState {
  obols: number;
  spentObols?: number;
}

export interface RunSummary {
  floorReached: number;
  kills: number;
  lootCollected: number;
  elapsedMs: number;
  leveledTo: number;
  replayChecksum?: string;
  isVictory?: boolean;
  soulShardsEarned?: number;
  obolsEarned?: number;
  difficulty?: DifficultyMode;
}

export interface PermanentUpgrade {
  startingHealth: number;
  startingArmor: number;
  luckBonus: number;
  skillSlots: number;
  potionCharges: number;
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

export interface MetaProgression {
  runsPlayed: number;
  bestFloor: number;
  bestTimeMs: number;
  soulShards: number;
  unlocks: string[];
  cumulativeUnlockProgress: number;
  schemaVersion: 4;
  selectedDifficulty: DifficultyMode;
  difficultyCompletions: Record<DifficultyMode, number>;
  talentPoints: Record<string, number>;
  totalShardsSpent: number;
  blueprintFoundIds: string[];
  blueprintForgedIds: string[];
  echoes: number;
  mutationSlots: number;
  mutationUnlockedIds: string[];
  selectedMutationIds: string[];
  permanentUpgrades: PermanentUpgrade;
}

export interface UnlockDef {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3 | 4;
  cost: number;
  cumulativeRequirement: number;
  effect:
    | { type: "permanent_upgrade"; key: keyof PermanentUpgrade; value: number }
    | { type: "skill_unlock"; skillId: string }
    | { type: "affix_unlock"; affixId: string }
    | { type: "biome_unlock"; biomeId: string }
    | { type: "event_unlock"; eventId: string };
}

export interface AssetManifestEntry {
  id: string;
  category:
    | "player_sprite"
    | "monster_sprite"
    | "boss_sprite"
    | "tile"
    | "item_icon"
    | "skill_icon"
    | "hud"
    | "fx"
    | "ui_icon";
  styleTag: string;
  promptHash: string;
  sourcePath: string;
  outputPath: string;
  license: string;
  revision: number;
  sourceType?: "generated" | "external";
  sourceRef?: string;
  attribution?: string;
  optimized?: {
    primaryFormat: "webp";
    fallbackFormat: "png";
    targetSize: { width: number; height: number };
    primaryOutputPath: string;
    fallbackOutputPath: string;
  };
}

export interface AudioManifestEntry {
  id: string;
  category: "sfx" | "amb" | "ui";
  eventKey: string;
  sourceType: "generated" | "external";
  sourceRef: string;
  license: string;
  attribution: string;
  outputPath: string;
  revision: number;
}

export interface RngLike {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: T[]): T;
}

export interface RunRngStreams {
  procgen: RngLike;
  spawn: RngLike;
  combat: RngLike;
  loot: RngLike;
  skill: RngLike;
  boss: RngLike;
  biome: RngLike;
  hazard: RngLike;
  event: RngLike;
  merchant: RngLike;
}
