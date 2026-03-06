import { describe, expect, it } from "vitest";
import { renderRunSummaryScreen } from "./RunSummaryScreen";

describe("renderRunSummaryScreen", () => {
  it("renders v2 victory card by default", () => {
    const html = renderRunSummaryScreen({
      isVictory: true,
      floorReached: 5,
      kills: 44,
      lootCollected: 18,
      obolsEarned: 72,
      soulShardsEarned: 16,
      elapsedMs: 98_000,
      leveledTo: 9,
      difficulty: "hard"
    });

    expect(html).toContain("run-summary-card victory");
    expect(html).toContain("summary-reward");
    expect(html).toContain("+16");
    expect(html).toContain("id=\"new-run-button\"");
  });

  it("renders defeat summary card on the single active template", () => {
    const html = renderRunSummaryScreen({
      isVictory: false,
      floorReached: 2,
      kills: 10,
      lootCollected: 6,
      obolsEarned: 14,
      soulShardsEarned: 3,
      elapsedMs: 40_000,
      leveledTo: 4,
      difficulty: "normal"
    });

    expect(html).toContain("run-summary-card defeat");
    expect(html).toContain("summary-stats-grid");
    expect(html).toContain('id="new-run-button"');
  });

  it("renders outcome analysis cards when next-run plans are available", () => {
    const html = renderRunSummaryScreen(
      {
        isVictory: false,
        floorReached: 4,
        kills: 21,
        lootCollected: 7,
        obolsEarned: 20,
        soulShardsEarned: 5,
        elapsedMs: 71_000,
        leveledTo: 6,
        difficulty: "hard"
      },
      {
        failureHeadline: "Boss pressure closed the run before your build stabilized.",
        missedOpportunities: ["Too few high-value branches were taken."],
        suggestions: [
          {
            id: "stabilize-defense",
            lane: "stabilize",
            title: "Stabilize through defense",
            reason: "Missing defense.",
            action: "Take VIT."
          },
          {
            id: "pivot-route-frozen",
            lane: "pivot",
            title: "Pivot through Frozen Route",
            reason: "Route swap.",
            action: "Take Frozen Route."
          }
        ]
      }
    );

    expect(html).toContain("summary-analysis");
    expect(html).toContain("summary-plan-card stabilize");
    expect(html).toContain("summary-plan-card pivot");
    expect(html).toContain("Pivot through Frozen Route");
  });

  it("renders phase 6 baseline rows when telemetry is present", () => {
    const html = renderRunSummaryScreen({
      isVictory: true,
      floorReached: 5,
      kills: 31,
      lootCollected: 11,
      obolsEarned: 22,
      soulShardsEarned: 8,
      elapsedMs: 82_000,
      leveledTo: 7,
      difficulty: "hard",
      phase6Telemetry: {
        story: {
          playerFacingChoices: 6,
          choiceCountByFloor: { "1": 1, "2": 2 },
          powerSpikes: 2,
          buildFormed: 1,
          rareDropsPresented: 2,
          bossRewardClosed: 1
        },
        combat: {
          skillUses: 11,
          skillCastsPer30s: 4.1,
          skillDamage: 140,
          autoAttackDamage: 210,
          skillDamageShare: 0.4,
          autoAttackDamageShare: 0.6,
          manaDryWindowMs: 8_000,
          averageNoInputGapMs: 1_250,
          maxNoInputGapMs: 3_800
        },
        runtimeEffects: {
          buffApplyCountById: { war_cry_buff: 2 },
          buffUptimeMsById: { war_cry_buff: 6_000 },
          damageDealtByType: { physical: 210, arcane: 140 },
          damageTakenByType: { physical: 32 },
          resolvedHitCountByType: { physical: 10, arcane: 4 },
          synergyActivationCountById: { crit_chain: 1 },
          synergyFirstActivatedFloorById: { crit_chain: 3 }
        }
      }
    });

    expect(html).toContain("Choices");
    expect(html).toContain("Spikes / Builds");
    expect(html).toContain("Rhythm");
    expect(html).toContain("4.1 casts / 30s");
  });
});
