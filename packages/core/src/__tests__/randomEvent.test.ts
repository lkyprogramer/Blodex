import { describe, expect, it } from "vitest";
import type { EventChoice, RandomEventDef } from "../contracts/types";
import {
  canPayEventCost,
  createMerchantOffers,
  pickRandomEvent,
  rollEventRisk
} from "../randomEvent";
import { SeededRng } from "../rng";

const EVENTS: RandomEventDef[] = [
  {
    id: "event-a",
    name: "Event A",
    description: "A",
    floorRange: { min: 1, max: 3 },
    spawnWeight: 30,
    choices: [{ id: "ok", name: "OK", description: "", rewards: [] }]
  },
  {
    id: "event-b",
    name: "Event B",
    description: "B",
    floorRange: { min: 2, max: 5 },
    biomeIds: ["molten_caverns"],
    spawnWeight: 10,
    choices: [{ id: "ok", name: "OK", description: "", rewards: [] }]
  },
  {
    id: "event-c",
    name: "Event C",
    description: "C",
    floorRange: { min: 1, max: 5 },
    unlockId: "unlock-c",
    spawnWeight: 999,
    choices: [{ id: "ok", name: "OK", description: "", rewards: [] }]
  }
];

describe("randomEvent", () => {
  it("picks deterministic event from filtered pool", () => {
    const rng1 = new SeededRng("event-seed-1");
    const rng2 = new SeededRng("event-seed-1");
    const first = pickRandomEvent(EVENTS, 2, "molten_caverns", [], rng1);
    const second = pickRandomEvent(EVENTS, 2, "molten_caverns", [], rng2);
    expect(first?.id).toBe(second?.id);
    expect(first?.id).not.toBe("event-c");
  });

  it("honors unlock requirement", () => {
    const rng = new SeededRng("unlock-seed");
    const locked = pickRandomEvent(EVENTS, 3, "forgotten_catacombs", [], rng);
    const unlocked = pickRandomEvent(EVENTS, 3, "forgotten_catacombs", ["unlock-c"], new SeededRng("unlock-seed"));

    expect(locked?.id).not.toBe("event-c");
    expect(unlocked?.id).toBe("event-c");
  });

  it("checks event cost and risk", () => {
    expect(canPayEventCost({ type: "health", amount: 20 }, 21, 0, 0)).toBe(true);
    expect(canPayEventCost({ type: "health", amount: 20 }, 20, 0, 0)).toBe(false);
    expect(canPayEventCost({ type: "mana", amount: 5 }, 1, 5, 0)).toBe(true);
    expect(canPayEventCost({ type: "obol", amount: 6 }, 1, 1, 5)).toBe(false);

    const risky: EventChoice = {
      id: "risky",
      name: "Risky",
      description: "",
      rewards: [],
      risk: { chance: 1, penalty: { type: "health", amount: 1 } }
    };
    expect(rollEventRisk(risky, new SeededRng("risk"))).toBe(true);
  });

  it("creates unique merchant offers with bounded prices", () => {
    const offers = createMerchantOffers(
      [
        { itemDefId: "a", weight: 10, minFloor: 1 },
        { itemDefId: "b", weight: 10, minFloor: 1 },
        { itemDefId: "c", weight: 10, minFloor: 2 },
        { itemDefId: "d", weight: 10, minFloor: 2 }
      ],
      2,
      new SeededRng("merchant-seed"),
      3
    );
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((offer) => offer.itemDefId)).size).toBe(3);
    for (const offer of offers) {
      expect(offer.priceObol).toBeGreaterThanOrEqual(5);
      expect(offer.priceObol).toBeLessThanOrEqual(15);
    }
  });
});
