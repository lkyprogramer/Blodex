import { describe, expect, it } from "vitest";
import { analyzeRunOutcome } from "../RunOutcomeAnalyzer";

describe("analyzeRunOutcome", () => {
  it("returns two distinct next-run plans with missed opportunities", () => {
    const analysis = analyzeRunOutcome({
      summary: {
        isVictory: false,
        floorReached: 5,
        kills: 38,
        lootCollected: 9,
        elapsedMs: 180_000,
        leveledTo: 8,
        difficulty: "hard"
      },
      buildIdentity: {
        tags: ["build:offense"],
        keyItemDefIds: [],
        pivots: []
      },
      heartbeats: [
        {
          type: "key_branch",
          floor: 2,
          source: "merchant",
          timestampMs: 1000,
          detail: "merchant"
        }
      ],
      recommendations: [],
      branchChoice: "molten_route",
      lastDeathReason: "Boss heavy strike."
    });

    expect(analysis.failureHeadline.length).toBeGreaterThan(0);
    expect(analysis.missedOpportunities.length).toBeGreaterThan(0);
    expect(analysis.suggestions).toHaveLength(2);
    expect(analysis.suggestions[0].id).not.toBe(analysis.suggestions[1].id);
    expect(analysis.suggestions[0].lane).toBe("stabilize");
    expect(analysis.suggestions[1].lane).toBe("pivot");
  });
});
