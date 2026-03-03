import { describe, expect, it } from "vitest";
import { ZH_CN_CATALOG } from "../catalog/zh-CN";

describe("zh-CN catalog smoke", () => {
  it("provides translated labels for language gate and locale switcher", () => {
    expect(ZH_CN_CATALOG.messages["ui.meta.language.label"]).toBe("语言");
    expect(ZH_CN_CATALOG.messages["ui.meta.language.aria_label"]).toBe("语言切换器");
    expect(ZH_CN_CATALOG.messages["ui.locale.english"]).toBe("English");
    expect(ZH_CN_CATALOG.messages["ui.locale.zh_cn"]).toBe("简体中文");
    expect(ZH_CN_CATALOG.messages["ui.language_gate.title"]).toBe("选择语言");
    expect(ZH_CN_CATALOG.messages["ui.language_gate.confirm"]).toBe("确认语言");
  });

  it("covers critical run and summary copy in zh-CN", () => {
    const keys = [
      "ui.meta.action.start_run",
      "ui.meta.action.start_daily",
      "ui.hud.run.title",
      "ui.hud.log.title",
      "ui.summary.title.victory",
      "ui.summary.title.defeat",
      "ui.summary.continue",
      "log.run.resumed_saved",
      "log.item.discarded",
      "log.run.daily_practice_switched"
    ];

    for (const key of keys) {
      const message = ZH_CN_CATALOG.messages[key];
      expect(typeof message).toBe("string");
      expect(message?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
