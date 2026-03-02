import { describe, expect, it } from "vitest";
import { renderMetaMenuPanel } from "./MetaMenuPanel";

describe("renderMetaMenuPanel", () => {
  it("renders tier groups and action attributes", () => {
    const html = renderMetaMenuPanel({
      soulShards: 120,
      unlockedCount: 2,
      totalUnlocks: 6,
      runSave: {
        canContinue: true,
        canAbandon: true,
        statusText: "Saved run found",
        detailText: "Floor 2 · Normal"
      },
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
      talentGroups: [
        {
          path: "core",
          label: "Core",
          talents: [
            {
              id: "core_vitality_training",
              name: "Vitality Training",
              description: "desc",
              path: "core",
              tier: 0,
              rank: 0,
              maxRank: 1,
              cost: 24,
              statusText: "Available",
              purchasable: true
            }
          ]
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
      ],
      startRunEnabled: false
    });

    expect(html).toContain('data-action="difficulty"');
    expect(html).toContain('data-action="purchase"');
    expect(html).toContain('data-action="purchase-talent"');
    expect(html).toContain('data-action="continue"');
    expect(html).toContain('data-action="abandon"');
    expect(html).toContain('data-action="start"');
    expect(html).toContain('data-tier="1"');
    expect(html).toContain('data-tier="2"');
    expect(html).toContain("Soul Shards: 120");
  });
});
