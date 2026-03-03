import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "../CatalogRegistry";
import { DefaultI18nService } from "../I18nService";
import { EN_US_CATALOG } from "../catalog/en-US";
import { ZH_CN_CATALOG } from "../catalog/zh-CN";
import { ContentLocalizer } from "../content/ContentLocalizer";

function createZhCnLocalizer(): ContentLocalizer {
  const i18n = new DefaultI18nService(new CatalogRegistry([EN_US_CATALOG, ZH_CN_CATALOG]), {
    defaultLocale: "en-US",
    fallbackLocale: "en-US"
  });
  i18n.setLocale("zh-CN");
  return new ContentLocalizer(i18n);
}

describe("ContentLocalizer zh-CN", () => {
  it("localizes representative content families", () => {
    const localizer = createZhCnLocalizer();

    expect(localizer.itemName("rusted_sabre", "Rusted Sabre")).toBe("锈蚀军刀");
    expect(localizer.skillName("cleave", "Cleave")).toBe("横扫");
    expect(localizer.skillDescription("cleave", "Wide swing around the caster.")).toBe("对自身周围进行大范围挥砍。");
    expect(localizer.eventName("mysterious_shrine", "Mysterious Shrine")).toBe("神秘祭坛");
    expect(localizer.eventChoiceName("mysterious_shrine", "offer_obol", "Offer Obol")).toBe("献上欧铂");
    expect(localizer.unlockName("u_starting_hp_10", "Toughened Flesh")).toBe("坚韧血肉");
    expect(localizer.talentName("core_vitality_training", "Vitality Training")).toBe("体能训练");
    expect(localizer.blueprintName("bp_skill_frost_nova", "Frost Nova Etching")).toBe("冰封符印草图");
    expect(localizer.mutationName("mut_battle_instinct", "Battle Instinct")).toBe("战斗本能");
    expect(localizer.biomeName("forgotten_catacombs", "Forgotten Catacombs")).toBe("遗忘地穴");
    expect(localizer.monsterName("melee_grunt", "Melee Grunt")).toBe("地穴猎犬");
    expect(localizer.affixName("frenzied", "Frenzied")).toBe("狂热");
    expect(localizer.affixDescription("frenzied", "Moves and attacks faster.")).toBe("移动与攻击速度更快。");
    expect(localizer.bossName("bone_sovereign", "Bone Sovereign")).toBe("白骨君王");
  });

  it("falls back to provided text for unknown ids", () => {
    const localizer = createZhCnLocalizer();

    expect(localizer.itemName("missing-item", "Fallback Item")).toBe("Fallback Item");
    expect(localizer.skillName("missing-skill", "Fallback Skill")).toBe("Fallback Skill");
    expect(localizer.eventChoiceDescription("missing-event", "missing-choice", "Fallback Choice")).toBe("Fallback Choice");
    expect(localizer.monsterName("missing-monster", "Fallback Monster")).toBe("Fallback Monster");
  });
});
