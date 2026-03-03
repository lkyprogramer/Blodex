import { describe, expect, it } from "vitest";
import type { UnlockDef } from "../contracts/types";
import {
  collectUnlockedAffixIds,
  collectUnlockedBiomeIds,
  collectUnlockedEventIds,
  purchaseUnlock
} from "../meta";
import { createInitialMeta } from "../run";

const PHASE2_UNLOCKS: UnlockDef[] = [
  {
    id: "u_affix_frenzied",
    name: "Affix Frenzied",
    description: "",
    tier: 1,
    cost: 20,
    cumulativeRequirement: 0,
    effect: { type: "affix_unlock", affixId: "frenzied" }
  },
  {
    id: "u_affix_vampiric",
    name: "Affix Vampiric",
    description: "",
    tier: 2,
    cost: 20,
    cumulativeRequirement: 0,
    effect: { type: "affix_unlock", affixId: "vampiric" }
  },
  {
    id: "u_event_merchant",
    name: "Event Merchant",
    description: "",
    tier: 2,
    cost: 20,
    cumulativeRequirement: 0,
    effect: { type: "event_unlock", eventId: "wandering_merchant" }
  },
  {
    id: "u_biome_extra",
    name: "Biome",
    description: "",
    tier: 3,
    cost: 20,
    cumulativeRequirement: 0,
    effect: { type: "biome_unlock", biomeId: "molten_caverns" }
  }
];

describe("meta phase2 unlock collection", () => {
  it("includes default biome availability and no affixes before unlocks", () => {
    const meta = createInitialMeta();
    expect(collectUnlockedBiomeIds(meta, PHASE2_UNLOCKS)).toEqual(
      expect.arrayContaining([
        "forgotten_catacombs",
        "molten_caverns",
        "frozen_halls",
        "phantom_graveyard",
        "venom_swamp",
        "bone_throne"
      ])
    );
    expect(collectUnlockedAffixIds(meta, PHASE2_UNLOCKS)).toEqual([]);
    expect(collectUnlockedEventIds(meta, PHASE2_UNLOCKS)).toEqual([]);
  });

  it("collects newly purchased phase2 unlock effects", () => {
    let meta = {
      ...createInitialMeta(),
      soulShards: 200
    };
    meta = purchaseUnlock(meta, PHASE2_UNLOCKS[0]!);
    meta = purchaseUnlock(meta, PHASE2_UNLOCKS[1]!);
    meta = purchaseUnlock(meta, PHASE2_UNLOCKS[2]!);

    expect(collectUnlockedAffixIds(meta, PHASE2_UNLOCKS)).toEqual(
      expect.arrayContaining(["frenzied", "vampiric"])
    );
    expect(collectUnlockedEventIds(meta, PHASE2_UNLOCKS)).toContain("wandering_merchant");
  });
});
