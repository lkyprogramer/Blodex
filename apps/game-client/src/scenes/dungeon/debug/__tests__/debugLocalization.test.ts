import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerState } from "@blodex/core";
import { getLocale, setLocale } from "../../../../i18n";
import { injectDebugLockedEquipment } from "../injectDebugLockedEquipment";
import { describeDebugCommands } from "../types";

describe("debug localization", () => {
  const initialLocale = getLocale();

  afterEach(() => {
    setLocale(initialLocale, { persist: false });
  });

  it("localizes debug help lines in zh-CN", () => {
    setLocale("zh-CN", { persist: false });

    expect(describeDebugCommands()[0]).toBe("Alt+H: 显示金手指命令列表");
    expect(describeDebugCommands()).toContain("API.forceSynergy(id): 快速注入一套联动构筑");
  });

  it("localizes injected debug equipment names", () => {
    setLocale("zh-CN", { persist: false });

    const runLog = {
      debug: vi.fn()
    };
    const player = {
      level: 1,
      inventory: []
    } as unknown as PlayerState;

    const updated = injectDebugLockedEquipment({
      player,
      nowMs: 1234,
      runSeed: "seed",
      iconId: "item_ring_01",
      runLog: runLog as never
    });

    expect(updated.inventory[0]?.name).toBe("调试封印戒指（Lv3）");
    expect(runLog.debug).toHaveBeenCalledWith(
      "已加入锁定装备：调试封印戒指（Lv3）。按 E 验证等级门槛反馈。",
      "info",
      1234
    );
  });
});
