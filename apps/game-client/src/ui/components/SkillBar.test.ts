import { describe, expect, it } from "vitest";
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
  });
});
