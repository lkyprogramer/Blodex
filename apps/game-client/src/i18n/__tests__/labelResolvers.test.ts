import { afterEach, describe, expect, it } from "vitest";
import { consumableDescriptionLabel, consumableNameLabel, difficultyLabel, levelUpStatChoiceLabel } from "../labelResolvers";
import { getLocale, setLocale } from "..";

describe("i18n label resolvers", () => {
  const initialLocale = getLocale();

  afterEach(() => {
    setLocale(initialLocale, { persist: false });
  });

  it("resolves zh-CN difficulty labels", () => {
    setLocale("zh-CN", { persist: false });

    expect(difficultyLabel("normal")).toBe("普通");
    expect(difficultyLabel("hard")).toBe("困难");
  });

  it("resolves localized consumable display text", () => {
    setLocale("zh-CN", { persist: false });

    expect(consumableNameLabel("health_potion")).toBe("生命药剂");
    expect(consumableDescriptionLabel("scroll_of_mapping")).toBe("揭示当前楼层目标位置。");
  });

  it("resolves localized level-up choice labels", () => {
    setLocale("en-US", { persist: false });

    expect(levelUpStatChoiceLabel("strength").name).toBe("Power Drill (+1 STR)");

    setLocale("zh-CN", { persist: false });

    expect(levelUpStatChoiceLabel("strength").name).toBe("力量钻头（+1 力量）");
  });
});
