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
    expect(state.charges.scroll_of_mapping_plus).toBe(0);
    expect(state.charges.frenzy_tonic).toBe(0);
    expect(state.charges.phantom_brew).toBe(0);
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

  it("uses greater mapping scroll and restores mana", () => {
    const player = {
      ...makePlayer(),
      mana: 10
    };
    const base = createInitialConsumableState(0);
    const granted = grantConsumable(base, "scroll_of_mapping_plus", 1);

    const result = useConsumable(player, granted, "scroll_of_mapping_plus", 100);
    expect(result.mappingRevealed).toBe(true);
    expect(result.player.mana).toBeGreaterThan(player.mana);
    expect(result.consumables.charges.scroll_of_mapping_plus).toBe(0);
  });

  it("applies tonic and brew buffs on use", () => {
    const player = makePlayer();
    const tonic = useConsumable(player, grantConsumable(createInitialConsumableState(0), "frenzy_tonic", 1), "frenzy_tonic", 100);
    const brew = useConsumable(player, grantConsumable(createInitialConsumableState(0), "phantom_brew", 1), "phantom_brew", 200);

    expect(tonic.buffsApplied[0]?.defId).toBe("frenzy_tonic");
    expect(brew.buffsApplied[0]?.defId).toBe("phantom_brew");
  });

  it("grants and spends newly added consumables on sparse legacy-like state", () => {
    const sparseState = {
      charges: {
        health_potion: 1,
        mana_potion: 1,
        scroll_of_mapping: 0
      },
      cooldowns: {
        health_potion: 0,
        mana_potion: 0,
        scroll_of_mapping: 0
      }
    } as unknown as ReturnType<typeof createInitialConsumableState>;
    const granted = grantConsumable(sparseState, "phantom_brew", 2);
    const result = useConsumable(makePlayer(), granted, "phantom_brew", 100);

    expect(granted.charges.phantom_brew).toBe(2);
    expect(result.consumables.charges.phantom_brew).toBe(1);
    expect(result.buffsApplied[0]?.defId).toBe("phantom_brew");
  });
});
