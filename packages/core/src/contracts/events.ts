import type {
  BiomeId,
  BossAttack,
  BossRuntimeState,
  BuffInstance,
  CombatEvent,
  DifficultyMode,
  EquipmentSlot,
  HazardType,
  ItemInstance,
  ItemRarity,
  MonsterAffixId,
  MutationEffect,
  MonsterState,
  Phase6CombatRhythmTelemetry,
  ReplayInputEvent,
  RunSummary,
  SkillResolution,
  ConsumableId,
  StaircaseState
} from "./types";

export interface GameEventMap {
  "combat:hit": {
    combat: CombatEvent;
  };
  "combat:dodge": {
    combat: CombatEvent;
  };
  "combat:death": {
    combat: CombatEvent;
  };
  "player:move": {
    playerId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    timestampMs: number;
  };
  "player:levelup": {
    playerId: string;
    level: number;
    timestampMs: number;
  };
  "loot:drop": {
    sourceId: string;
    item: ItemInstance;
    position: { x: number; y: number };
    timestampMs: number;
  };
  "loot:pickup": {
    playerId: string;
    item: ItemInstance;
    position: { x: number; y: number };
    timestampMs: number;
  };
  "item:equip": {
    playerId: string;
    slot: EquipmentSlot;
    item: ItemInstance;
    timestampMs: number;
  };
  "item:unequip": {
    playerId: string;
    slot: EquipmentSlot;
    item: ItemInstance;
    timestampMs: number;
  };
  "run:start": {
    runSeed: string;
    floor: number;
    difficulty: DifficultyMode;
    startedAtMs: number;
    replayVersion: string;
  };
  "run:end": {
    summary: RunSummary;
    checksum?: string;
    inputs: ReplayInputEvent[];
    finishedAtMs: number;
  };
  "player_facing_choice": {
    floor: number;
    source: string;
    timestampMs: number;
    detail?: string;
  };
  "power_spike": {
    floor: number;
    source: string;
    sourceKind?: string;
    pairId?: string;
    timestampMs: number;
    itemDefId?: string;
    rarity?: ItemRarity;
    accepted?: boolean;
    major?: boolean;
    amplitude?: {
      offensiveDelta: number;
      defensiveDelta: number;
      utilityDelta: number;
      ttkDelta: number;
      sustainDelta: number;
    };
  };
  "build_formed": {
    floor: number;
    source: string;
    timestampMs: number;
    tags: string[];
    keyItemDefIds: string[];
  };
  "rare_drop_presented": {
    floor: number;
    source: string;
    timestampMs: number;
    itemDefId: string;
    rarity: "rare" | "unique";
  };
  "boss_reward_closed": {
    floor: number;
    choiceId: string;
    timestampMs: number;
  };
  "combat_rhythm_window": {
    floor: number;
    timestampMs: number;
    metrics: Pick<
      Phase6CombatRhythmTelemetry,
      "skillCastsPer30s" | "autoAttackDamageShare" | "manaDryWindowMs" | "averageNoInputGapMs" | "maxNoInputGapMs"
    >;
  };
  "synergy_activated": {
    floor: number;
    synergyId: string;
    timestampMs: number;
  };
  "pressure_peak": {
    floor: number;
    kind: "elite_kill" | "near_death_reversal";
    timestampMs: number;
    label?: string;
  };
  "monster:stateChange": {
    monsterId: string;
    from: MonsterState["aiState"];
    to: MonsterState["aiState"];
    timestampMs: number;
  };
  "floor:enter": {
    floor: number;
    biomeId?: BiomeId;
    timestampMs: number;
  };
  "floor:clear": {
    floor: number;
    kills: number;
    staircase: StaircaseState;
    timestampMs: number;
  };
  "boss:phaseChange": {
    bossId: string;
    fromPhase: number;
    toPhase: number;
    hpRatio: number;
    timestampMs: number;
  };
  "boss:summon": {
    bossId: string;
    attack: BossAttack;
    count: number;
    timestampMs: number;
  };
  "boss:attack": {
    boss: BossRuntimeState;
    attack: BossAttack;
    timestampMs: number;
  };
  "boss:attack_intent": {
    bossId: string;
    attack: BossAttack;
    executeAtMs: number;
    target?: { x: number; y: number };
    timestampMs: number;
  };
  "boss:attack_resolve": {
    bossId: string;
    attack: BossAttack;
    target?: { x: number; y: number };
    timestampMs: number;
  };
  "skill:use": {
    playerId: string;
    skillId: string;
    timestampMs: number;
    resolution: SkillResolution;
  };
  "skill:cooldown": {
    playerId: string;
    skillId: string;
    readyAtMs: number;
  };
  "buff:apply": {
    buff: BuffInstance;
    timestampMs: number;
  };
  "buff:expire": {
    buff: BuffInstance;
    timestampMs: number;
  };
  "hazard:trigger": {
    hazardId: string;
    hazardType: HazardType;
    position: { x: number; y: number };
    radiusTiles: number;
    timestampMs: number;
  };
  "hazard:damage": {
    hazardId: string;
    hazardType: HazardType;
    targetId: string;
    amount: number;
    remainingHealth: number;
    timestampMs: number;
  };
  "hazard:enter": {
    hazardId: string;
    hazardType: HazardType;
    targetId: string;
    timestampMs: number;
  };
  "hazard:exit": {
    hazardId: string;
    hazardType: HazardType;
    targetId: string;
    timestampMs: number;
  };
  "monster:affixApplied": {
    monsterId: string;
    affixId: MonsterAffixId;
    timestampMs: number;
  };
  "monster:split": {
    sourceMonsterId: string;
    spawnedIds: string[];
    timestampMs: number;
  };
  "monster:leech": {
    monsterId: string;
    targetId: string;
    amount: number;
    timestampMs: number;
  };
  "consumable:use": {
    playerId: string;
    consumableId: ConsumableId;
    amountApplied: number;
    remainingCharges: number;
    timestampMs: number;
  };
  "consumable:failed": {
    playerId: string;
    consumableId: ConsumableId;
    reason: string;
    timestampMs: number;
  };
  "event:spawn": {
    eventId: string;
    eventName: string;
    floor: number;
    timestampMs: number;
  };
  "event:choice": {
    eventId: string;
    choiceId: string;
    timestampMs: number;
  };
  "merchant:offer": {
    floor: number;
    offerCount: number;
    timestampMs: number;
  };
  "merchant:purchase": {
    offerId: string;
    itemId: string;
    itemName: string;
    priceObol: number;
    timestampMs: number;
  };
  "mutation:trigger": {
    mutationId: string;
    effectType: MutationEffect["type"];
    timestampMs: number;
    detail?: string;
    value?: number;
  };
}

/**
 * @deprecated Use `GameEventMap` and typed event names instead.
 */
export const GAME_EVENTS = {
  PLAYER_MOVED: "PLAYER_MOVED",
  TARGET_ACQUIRED: "TARGET_ACQUIRED",
  ATTACK_RESOLVED: "ATTACK_RESOLVED",
  LOOT_DROPPED: "LOOT_DROPPED",
  ITEM_EQUIPPED: "ITEM_EQUIPPED",
  XP_GAINED: "XP_GAINED",
  LEVEL_UP: "LEVEL_UP",
  RUN_ENDED: "RUN_ENDED"
} as const;

/**
 * @deprecated Use `keyof GameEventMap` instead.
 */
export type GameEventName = (typeof GAME_EVENTS)[keyof typeof GAME_EVENTS];
