import { describe, expect, it } from "vitest";
import { SKILL_DEF_MAP } from "@blodex/content";
import { applyForgedSkillBlueprintAugments } from "../skillBlueprintRuntime";

function getSkillDef(skillId: keyof typeof SKILL_DEF_MAP) {
  const skillDef = SKILL_DEF_MAP[skillId];
  expect(skillDef).toBeDefined();
  return skillDef!;
}

describe("applyForgedSkillBlueprintAugments", () => {
  it("recasts legacy skill blueprints as strengthen effects instead of dead unlocks", () => {
    const warCry = applyForgedSkillBlueprintAugments(getSkillDef("war_cry"), ["bp_skill_war_cry"]);
    const frostNova = applyForgedSkillBlueprintAugments(getSkillDef("frost_nova"), ["bp_skill_frost_nova"]);

    expect(warCry.cooldownMs).toBe(7920);
    expect(warCry.effects[0]?.duration).toBe(9000);
    expect(frostNova.range).toBe(2.4);
    expect(frostNova.effects[0]?.duration).toBe(4050);
  });

  it("applies chain lightning blueprint as a real combat modifier", () => {
    const base = getSkillDef("chain_lightning");
    const next = applyForgedSkillBlueprintAugments(base, ["bp_skill_chain_lightning"]);

    expect(next.manaCost).toBe(12);
    expect(next.cooldownMs).toBe(3444);
    expect(next.range).toBe(7.2);
  });

  it("expands spirit burst into a larger, harder-hitting blast", () => {
    const base = getSkillDef("spirit_burst");
    const next = applyForgedSkillBlueprintAugments(base, ["bp_skill_spirit_burst"]);

    expect(next.range).toBe(3.24);
    const damageEffect = next.effects.find((effect) => effect.type === "damage");
    expect(damageEffect).toBeDefined();
    expect(typeof damageEffect?.value).toBe("object");
    if (damageEffect !== undefined && typeof damageEffect.value !== "number") {
      expect(damageEffect.value.base).toBeCloseTo(16.52);
      expect(damageEffect.value.ratio).toBeCloseTo(1.298);
    }
  });

  it("turns rift step blueprint into a variant with post-cast guaranteed crit", () => {
    const base = getSkillDef("rift_step");
    const next = applyForgedSkillBlueprintAugments(base, ["bp_skill_rift_step"]);

    expect(next.cooldownMs).toBe(2880);
    const buffEffect = next.effects.find(
      (effect) => effect.type === "buff" && effect.buffId === "guaranteed_crit"
    );
    expect(buffEffect).toBeDefined();
  });
});
