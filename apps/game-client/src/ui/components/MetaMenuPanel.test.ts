import { describe, expect, it } from "vitest";
import { renderMetaMenuPanel } from "./MetaMenuPanel";

describe("renderMetaMenuPanel", () => {
  it("renders tier groups and action attributes", () => {
    const html = renderMetaMenuPanel({
      soulShards: 120,
      unlockedCount: 2,
      totalUnlocks: 6,
      difficulties: [
        {
          mode: "normal",
          label: "Normal",
          shortcut: "Q",
          selected: true,
          unlocked: true,
          requirement: "Always available"
        },
        {
          mode: "hard",
          label: "Hard",
          shortcut: "W",
          selected: false,
          unlocked: true,
          requirement: "Clear 1 Normal run"
        },
        {
          mode: "nightmare",
          label: "Nightmare",
          shortcut: "E",
          selected: false,
          unlocked: false,
          requirement: "Clear 1 Hard run"
        }
      ],
      unlockGroups: [
        {
          tier: 1,
          unlocks: [
            {
              index: 0,
              id: "u0",
              name: "Unlock A",
              description: "desc a",
              tier: 1,
              cost: 10,
              shortcut: "1",
              effectText: "effect a",
              statusText: "Available",
              unlocked: false,
              purchasable: true
            }
          ]
        },
        {
          tier: 2,
          unlocks: [
            {
              index: 1,
              id: "u1",
              name: "Unlock B",
              description: "desc b",
              tier: 2,
              cost: 25,
              shortcut: "2",
              effectText: "effect b",
              statusText: "Locked",
              unlocked: false,
              purchasable: false
            }
          ]
        }
      ]
    });

    expect(html).toContain('data-action="difficulty"');
    expect(html).toContain('data-action="purchase"');
    expect(html).toContain('data-action="start"');
    expect(html).toContain('data-tier="1"');
    expect(html).toContain('data-tier="2"');
    expect(html).toContain("Soul Shards: 120");
  });
});
