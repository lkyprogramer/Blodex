import type { DerivedStats } from "@blodex/core";
import { describe, expect, it } from "vitest";
import {
  buildHudStatHighlightEntries,
  collectActiveHudStatHighlights
} from "../StatDeltaHighlighter";

function makeStats(partial: Partial<DerivedStats>): DerivedStats {
  return {
    maxHealth: 120,
    maxMana: 60,
    armor: 10,
    attackPower: 14,
    critChance: 0.05,
    attackSpeed: 1,
    moveSpeed: 130,
    ...(partial ?? {})
  };
}

describe("StatDeltaHighlighter", () => {
  it("creates highlight entries only for changed tracked stats", () => {
    const before = makeStats({ attackPower: 12, armor: 8, critChance: 0.05 });
    const after = makeStats({ attackPower: 16, armor: 6, critChance: 0.05 });

    const entries = buildHudStatHighlightEntries(before, after, 1_000, 900);

    expect(entries).toEqual([
      {
        key: "attackPower",
        direction: "up",
        expiresAtMs: 1_900
      },
      {
        key: "armor",
        direction: "down",
        expiresAtMs: 1_900
      }
    ]);
  });

  it("filters expired entries and returns next refresh time", () => {
    const result = collectActiveHudStatHighlights(
      [
        { key: "attackPower", direction: "up", expiresAtMs: 1200 },
        { key: "armor", direction: "down", expiresAtMs: 900 }
      ],
      1_000
    );

    expect(result.active).toEqual([{ key: "attackPower", direction: "up" }]);
    expect(result.nextRefreshAt).toBe(1200);
  });
});
