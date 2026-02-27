import { describe, expect, it } from "vitest";
import type { PlayerState } from "../contracts/types";
import {
  canUseConsumable,
  createInitialConsumableState,
  grantConsumable,
  useConsumable
} from "../consumable";
import { defaultBaseStats, deriveStats } from "../stats";

function makePlayer(): PlayerState {
  const baseStats = defaultBaseStats();
  const derivedStats = deriveStats(baseStats, []);
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 98,
    health: derivedStats.maxHealth,
    mana: derivedStats.maxMana,
    baseStats,
    derivedStats,
    inventory: [],
    equipment: {},
    gold: 0
  };
}

describe("consumable", () => {
  it("initializes charges from permanent upgrade", () => {
    const state = createInitialConsumableState(2);
    expect(state.charges.health_potion).toBe(3);
    expect(state.charges.mana_potion).toBe(3);
    expect(state.charges.scroll_of_mapping).toBe(0);
  });

  it("restores health and applies cooldown", () => {
    const player = makePlayer();
    const initial = {
      ...player,
      health: Math.floor(player.derivedStats.maxHealth * 0.5)
    };
    const consumables = createInitialConsumableState(0);
    const result = useConsumable(initial, consumables, "health_potion", 1_000);

    expect(result.player.health).toBeGreaterThan(initial.health);
    expect(result.consumables.charges.health_potion).toBe(0);
    expect(result.consumables.cooldowns.health_potion).toBeGreaterThan(1_000);
  });

  it("blocks use when cooldown or charges are not available", () => {
    const player = makePlayer();
    const withNoCharge = createInitialConsumableState(-1);
    const noCharge = canUseConsumable(player, withNoCharge, "health_potion", 100);
    expect(noCharge.ok).toBe(false);

    const charged = createInitialConsumableState(0);
    const used = useConsumable(
      {
        ...player,
        health: Math.floor(player.derivedStats.maxHealth * 0.7)
      },
      charged,
      "health_potion",
      200
    );
    const cooldown = canUseConsumable(used.player, used.consumables, "health_potion", 300);
    expect(cooldown.ok).toBe(false);
  });

  it("grants mapping scroll and reveals mapping flag on use", () => {
    const player = makePlayer();
    const base = createInitialConsumableState(0);
    const granted = grantConsumable(base, "scroll_of_mapping", 1);
    const availability = canUseConsumable(player, granted, "scroll_of_mapping", 100);
    expect(availability.ok).toBe(true);

    const result = useConsumable(player, granted, "scroll_of_mapping", 100);
    expect(result.mappingRevealed).toBe(true);
    expect(result.consumables.charges.scroll_of_mapping).toBe(0);
  });
});
