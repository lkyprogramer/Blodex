import { describe, expect, it } from "vitest";
import { renderBossHealthBar } from "./BossHealthBar";

describe("renderBossHealthBar", () => {
  it("returns empty html when boss runtime state is missing", () => {
    expect(renderBossHealthBar({ isBossFloor: true })).toBe("");
    expect(renderBossHealthBar({ isBossFloor: true, bossHealth: 0 })).toBe("");
    expect(renderBossHealthBar({ isBossFloor: true, bossMaxHealth: 100 })).toBe("");
  });

  it("renders health bar when boss runtime state is available", () => {
    const html = renderBossHealthBar({
      isBossFloor: true,
      bossHealth: 320,
      bossMaxHealth: 800,
      bossPhase: 1
    });

    expect(html).toContain("Boss");
    expect(html).toContain("Phase 2");
    expect(html).toContain("320/800");
  });
});
