import type { ConsumableDef, ConsumableId, ConsumableState, PlayerState } from "./contracts/types";

const POTION_COOLDOWN_MS = 1200;

export const CONSUMABLE_DEFS: ConsumableDef[] = [
  {
    id: "health_potion",
    name: "Health Potion",
    description: "Restore 40% max HP.",
    hotkey: "R"
  },
  {
    id: "mana_potion",
    name: "Mana Potion",
    description: "Restore 60% max Mana.",
    hotkey: "F"
  },
  {
    id: "scroll_of_mapping",
    name: "Scroll of Mapping",
    description: "Reveal current floor objective.",
    hotkey: "G"
  }
];

export function createInitialConsumableState(potionChargeUpgrade: number): ConsumableState {
  const baseCharge = Math.max(0, 1 + Math.floor(potionChargeUpgrade));
  return {
    charges: {
      health_potion: baseCharge,
      mana_potion: baseCharge,
      scroll_of_mapping: 0
    },
    cooldowns: {
      health_potion: 0,
      mana_potion: 0,
      scroll_of_mapping: 0
    }
  };
}

export function grantConsumable(
  state: ConsumableState,
  consumableId: ConsumableId,
  amount: number
): ConsumableState {
  if (amount <= 0) {
    return state;
  }
  return {
    ...state,
    charges: {
      ...state.charges,
      [consumableId]: state.charges[consumableId] + amount
    }
  };
}

export function canUseConsumable(
  player: PlayerState,
  consumables: ConsumableState,
  consumableId: ConsumableId,
  nowMs: number
): { ok: true } | { ok: false; reason: string } {
  if ((consumables.charges[consumableId] ?? 0) <= 0) {
    return { ok: false, reason: "No charges left." };
  }
  const readyAt = consumables.cooldowns[consumableId] ?? 0;
  if (nowMs < readyAt) {
    return { ok: false, reason: `Cooldown ${(Math.max(0, readyAt - nowMs) / 1000).toFixed(1)}s.` };
  }

  if (consumableId === "health_potion" && player.health >= player.derivedStats.maxHealth) {
    return { ok: false, reason: "HP already full." };
  }
  if (consumableId === "mana_potion" && player.mana >= player.derivedStats.maxMana) {
    return { ok: false, reason: "Mana already full." };
  }

  return { ok: true };
}

export interface ConsumableUseResult {
  player: PlayerState;
  consumables: ConsumableState;
  consumableId: ConsumableId;
  amountApplied: number;
  mappingRevealed: boolean;
}

export function useConsumable(
  player: PlayerState,
  consumables: ConsumableState,
  consumableId: ConsumableId,
  nowMs: number
): ConsumableUseResult {
  let amountApplied = 0;
  let mappingRevealed = false;
  let nextPlayer = player;
  let cooldownUntil = nowMs;

  if (consumableId === "health_potion") {
    amountApplied = Math.max(1, Math.floor(player.derivedStats.maxHealth * 0.4));
    nextPlayer = {
      ...player,
      health: Math.min(player.derivedStats.maxHealth, player.health + amountApplied)
    };
    cooldownUntil = nowMs + POTION_COOLDOWN_MS;
  } else if (consumableId === "mana_potion") {
    amountApplied = Math.max(1, Math.floor(player.derivedStats.maxMana * 0.6));
    nextPlayer = {
      ...player,
      mana: Math.min(player.derivedStats.maxMana, player.mana + amountApplied)
    };
    cooldownUntil = nowMs + POTION_COOLDOWN_MS;
  } else {
    mappingRevealed = true;
  }

  const next: ConsumableState = {
    ...consumables,
    charges: {
      ...consumables.charges,
      [consumableId]: Math.max(0, consumables.charges[consumableId] - 1)
    },
    cooldowns: {
      ...consumables.cooldowns,
      [consumableId]: cooldownUntil
    }
  };

  return {
    player: nextPlayer,
    consumables: next,
    consumableId,
    amountApplied,
    mappingRevealed
  };
}

