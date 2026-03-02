import { describe, expect, it } from "vitest";
import { UI_POLISH_FLAGS } from "../../config/uiFlags";
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

  it("can fallback to legacy template", () => {
    const previous = UI_POLISH_FLAGS.runSummaryV2Enabled;
    UI_POLISH_FLAGS.runSummaryV2Enabled = false;

    let html = "";
    try {
      html = renderRunSummaryScreen({
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
    } finally {
      UI_POLISH_FLAGS.runSummaryV2Enabled = previous;
    }

    expect(html).toContain("Run Ended");
    expect(html).toContain('class="stat-line"');
    expect(html).not.toContain("run-summary-card");
  });
});
