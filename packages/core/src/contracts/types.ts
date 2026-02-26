export type EquipmentSlot = "weapon" | "helm" | "chest" | "boots" | "ring";

export type ItemRarity = "common" | "magic" | "rare";

export type MonsterArchetypeId = "melee_grunt" | "ranged_caster" | "elite_bruiser";

export type DamageType = "physical" | "arcane";

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

export type RunRngStreamName = "procgen" | "spawn" | "combat" | "loot" | "skill" | "boss";

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
  inputs: ReplayInputEvent[];
  checksum?: string;
}

export interface ItemAffix {
  key: keyof DerivedStats;
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

export interface ItemInstance {
  id: string;
  defId: string;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  requiredLevel: number;
  iconId: string;
  seed: string;
  rolledAffixes: Partial<DerivedStats>;
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
  aiState: "idle" | "chase" | "attack" | "dead";
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

export interface DungeonLayout {
  width: number;
  height: number;
  walkable: boolean[][];
  rooms: DungeonRoom[];
  corridors: DungeonCorridor[];
  spawnPoints: Array<{ x: number; y: number }>;
  playerSpawn: { x: number; y: number };
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

export interface RunEconomyState {
  obols: number;
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
}

export interface PermanentUpgrade {
  startingHealth: number;
  startingArmor: number;
  luckBonus: number;
  skillSlots: number;
  potionCharges: number;
}

export interface MetaProgression {
  runsPlayed: number;
  bestFloor: number;
  bestTimeMs: number;
  soulShards: number;
  unlocks: string[];
  cumulativeUnlockProgress: number;
  schemaVersion: 2;
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
    | { type: "biome_unlock"; biomeId: string };
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
}
