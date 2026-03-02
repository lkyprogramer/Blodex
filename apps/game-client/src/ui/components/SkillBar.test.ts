import { describe, expect, it } from "vitest";
import { UI_POLISH_FLAGS } from "../../config/uiFlags";
import { renderSkillBar } from "./SkillBar";

describe("renderSkillBar", () => {
  it("renders tooltip metadata for consumables and skills", () => {
    const html = renderSkillBar(
      {
        consumables: [
          {
            id: "scroll_of_mapping",
            name: "Scroll of Mapping",
            description: "Reveal current floor objective.",
            hotkey: "G",
            iconId: "item_consumable_scroll_mapping_01",
            charges: 0,
            cooldownLeftMs: 0,
            disabledReason: "No charges left."
          }
        ],
        skillSlots: [
          {
            id: "blood_drain",
            hotkey: "1",
            name: "Blood Drain",
            description: "Drain life from the nearest enemy.",
            iconId: "skill_blood_drain",
            cooldownLeftMs: 0,
            baseCooldownMs: 8000,
            manaCost: 15,
            targeting: "nearest",
            range: 3,
            cooldownProgress: 0.5,
            readyFlash: true,
            outOfMana: false,
            locked: false
          }
        ]
      },
      "png"
    );

    expect(html).toContain('data-tooltip-kind="consumable"');
    expect(html).toContain('data-tooltip-description="Reveal current floor objective."');
    expect(html).toContain('data-consumable-disabled="1"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('data-tooltip-disabled-reason="No charges left."');

    expect(html).toContain('data-tooltip-kind="skill"');
    expect(html).toContain('data-tooltip-description="Drain life from the nearest enemy."');
    expect(html).toContain('data-tooltip-mana-cost="15"');
    expect(html).toContain('data-tooltip-targeting="nearest"');
    expect(html).toContain('data-tooltip-range="3"');
    expect(html).toContain("skill-cooldown-overlay");
    expect(html).toContain("ready-flash");
  });

  it("can disable cooldown overlay via feature flag", () => {
    const previous = UI_POLISH_FLAGS.skillCooldownOverlayEnabled;
    UI_POLISH_FLAGS.skillCooldownOverlayEnabled = false;

    let html = "";
    try {
      html = renderSkillBar(
        {
          skillSlots: [
            {
              id: "frost_nova",
              hotkey: "2",
              name: "Frost Nova",
              cooldownLeftMs: 4000,
              baseCooldownMs: 8000,
              outOfMana: false,
              locked: false
            }
          ]
        },
        "png"
      );
    } finally {
      UI_POLISH_FLAGS.skillCooldownOverlayEnabled = previous;
    }

    expect(html).not.toContain("skill-cooldown-overlay");
  });
});
