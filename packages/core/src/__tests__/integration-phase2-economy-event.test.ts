import { describe, expect, it } from "vitest";
import type { RandomEventDef, UnlockDef } from "../contracts/types";
import { addRunObols, createRunState, spendRunObols } from "../run";
import { createMerchantOffers, pickRandomEvent } from "../randomEvent";
import { collectUnlockedEventIds, purchaseUnlock } from "../meta";
import { SeededRng } from "../rng";
import { createInitialMeta } from "../run";

const EVENT_UNLOCK: UnlockDef = {
  id: "u_event_portal",
  name: "Portal",
  description: "",
  tier: 2,
  cost: 10,
  cumulativeRequirement: 0,
  effect: { type: "event_unlock", eventId: "unstable_portal" }
};

const EVENT_POOL: RandomEventDef[] = [
  {
    id: "stable_cache",
    name: "Stable Cache",
    description: "",
    floorRange: { min: 1, max: 5 },
    spawnWeight: 1,
    choices: [{ id: "take", name: "Take", description: "", rewards: [{ type: "obol", amount: 5 }] }]
  },
  {
    id: "unstable_portal",
    name: "Unstable Portal",
    description: "",
    floorRange: { min: 3, max: 5 },
    unlockId: "unstable_portal",
    spawnWeight: 999,
    choices: [{ id: "attune", name: "Attune", description: "", rewards: [{ type: "xp", amount: 30 }] }]
  }
];

describe("phase2 economy and event integration", () => {
  it("keeps obol earn/spend accounting consistent", () => {
    const run = createRunState("phase2-economy", 0);
    const earned = addRunObols(run, 20);
    const spent = spendRunObols(earned, 7);

    expect(spent.runEconomy.obols).toBe(13);
    expect(spent.runEconomy.spentObols).toBe(7);
  });

  it("enforces event unlock before entering event candidate pool", () => {
    const rngSeed = "phase2-event-seed";
    const locked = pickRandomEvent(EVENT_POOL, 4, "molten_caverns", [], new SeededRng(rngSeed));

    const unlockedMeta = purchaseUnlock(
      {
        ...createInitialMeta(),
        soulShards: 20
      },
      EVENT_UNLOCK
    );
    const unlockedIds = collectUnlockedEventIds(unlockedMeta, [EVENT_UNLOCK]);
    const unlocked = pickRandomEvent(EVENT_POOL, 4, "molten_caverns", unlockedIds, new SeededRng(rngSeed));

    expect(locked?.id).not.toBe("unstable_portal");
    expect(unlocked?.id).toBe("unstable_portal");
  });

  it("keeps merchant inventory deterministic for fixed seed", () => {
    const candidates = [
      { itemDefId: "a", weight: 10, minFloor: 1 },
      { itemDefId: "b", weight: 10, minFloor: 1 },
      { itemDefId: "c", weight: 10, minFloor: 1 },
      { itemDefId: "d", weight: 10, minFloor: 1 },
      { itemDefId: "e", weight: 10, minFloor: 1 }
    ];
    const first = createMerchantOffers(candidates, 3, new SeededRng("merchant-stable"), 3);
    const second = createMerchantOffers(candidates, 3, new SeededRng("merchant-stable"), 3);

    expect(first).toEqual(second);
  });
});
