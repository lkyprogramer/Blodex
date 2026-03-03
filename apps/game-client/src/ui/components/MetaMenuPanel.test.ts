import { describe, expect, it } from "vitest";
import { renderMetaMenuPanel } from "./MetaMenuPanel";

describe("renderMetaMenuPanel", () => {
  it("renders tier groups and action attributes", () => {
    const html = renderMetaMenuPanel({
      soulShards: 120,
      echoes: 5,
      unlockedCount: 2,
      totalUnlocks: 6,
      runSave: {
        canContinue: true,
        canAbandon: true,
        statusText: "Saved run found",
        detailText: "Floor 2 · Normal"
      },
      daily: {
        date: "2026-03-03",
        mode: "scored",
        statusText: "Scored attempt available."
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
      blueprintGroups: [
        {
          category: "weapon",
          label: "Weapon Blueprints",
          blueprints: [
            {
              id: "bp_weapon_axe",
              name: "Axe Frame",
              category: "weapon",
              rarity: "common",
              forgeCost: 16,
              unlockTargetId: "weapon_type_axe",
              statusText: "Ready to Forge",
              canForge: true
            }
          ]
        }
      ],
      mutationGroups: [
        {
          category: "offensive",
          label: "Offensive",
          mutations: [
            {
              id: "mut_battle_instinct",
              name: "Battle Instinct",
              category: "offensive",
              tier: 1,
              unlockText: "Default unlock",
              effectText: "on kill attack speed",
              statusText: "Selected",
              selected: true,
              canToggle: true,
              canUnlockEcho: false
            },
            {
              id: "mut_phase_skin",
              name: "Phase Skin",
              category: "defensive",
              tier: 2,
              unlockText: "Echo unlock (2)",
              effectText: "on hit invuln",
              statusText: "Cost 2 Echoes",
              selected: false,
              canToggle: false,
              canUnlockEcho: true
            }
          ]
        }
      ],
      mutationSlots: 2,
      selectedMutations: 1,
      startRunEnabled: false
    });

    expect(html).toContain('data-action="difficulty"');
    expect(html).toContain('data-action="purchase"');
    expect(html).toContain('data-action="purchase-talent"');
    expect(html).toContain('data-action="forge-blueprint"');
    expect(html).toContain('data-action="toggle-mutation"');
    expect(html).toContain('data-action="unlock-mutation"');
    expect(html).toContain('data-action="continue"');
    expect(html).toContain('data-action="abandon"');
    expect(html).toContain('data-action="start"');
    expect(html).toContain('data-action="start-daily"');
    expect(html).toContain('data-tier="1"');
    expect(html).toContain('data-tier="2"');
    expect(html).toContain("Soul Shards: 120");
    expect(html).toContain("Echoes: 5");
  });
});
