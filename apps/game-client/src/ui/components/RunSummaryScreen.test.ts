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
});
