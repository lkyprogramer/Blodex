import type {
  CombatEvent,
  EquipmentSlot,
  ItemInstance,
  MonsterState,
  ReplayInputEvent,
  RunSummary
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
    startedAtMs: number;
    replayVersion: string;
  };
  "run:end": {
    summary: RunSummary;
    checksum?: string;
    inputs: ReplayInputEvent[];
    finishedAtMs: number;
  };
  "monster:stateChange": {
    monsterId: string;
    from: MonsterState["aiState"];
    to: MonsterState["aiState"];
    timestampMs: number;
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
