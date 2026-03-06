import { describe, expect, it, vi } from "vitest";
import { getLocale, setLocale } from "../../../../i18n";
import { ProgressionChoiceRuntime } from "../ProgressionChoiceRuntime";

function createHost() {
  return {
    runEnded: false,
    eventPanelOpen: false,
    time: { now: 0 },
    run: { currentFloor: 2 },
    player: {
      id: "player",
      level: 1,
      health: 100,
      pendingLevelUpChoices: 0,
      baseStats: {
        strength: 8,
        dexterity: 8,
        vitality: 8,
        intelligence: 8
      },
      derivedStats: {
        maxHealth: 100
      }
    },
    currentBiome: { lootBias: {} },
    runLog: {
      append: vi.fn(),
      appendKey: vi.fn()
    },
    refreshSynergyRuntime: vi.fn(),
    playerActionModule: {
      offerLevelupSkill: vi.fn()
    },
    scheduleRunSave: vi.fn(),
    hudDirty: false,
    uiManager: {
      showEventDialog: vi.fn(),
      hideEventPanel: vi.fn()
    }
  };
}

describe("ProgressionChoiceRuntime", () => {
  it("does not reopen level-up prompt when player is dead", () => {
    const host = createHost();
    host.player.pendingLevelUpChoices = 2;
    host.player.health = 0;
    const runtime = new ProgressionChoiceRuntime({ host });

    runtime.maybePromptLevelUpChoice(100, "runtime_tick");

    expect(host.uiManager.showEventDialog).not.toHaveBeenCalled();
    expect(host.eventPanelOpen).toBe(false);
  });

  it("restores floor choice budget state without re-granting fallback point", () => {
    const host = createHost();
    const runtime = new ProgressionChoiceRuntime({ host });

    runtime.markHighValueChoice("event", 10);
    const snapshot = runtime.captureFloorChoiceBudgetSnapshot();
    runtime.resetFloorChoiceBudget(2, 20);
    runtime.restoreFloorChoiceBudgetSnapshot(snapshot, 2, 30);
    runtime.ensureFloorChoiceBudget(40);

    expect(host.player.pendingLevelUpChoices).toBe(0);
    expect(host.runLog.appendKey).toHaveBeenCalledTimes(1);
  });

  it("localizes level-up prompt metadata in zh-CN", () => {
    const previousLocale = getLocale();
    setLocale("zh-CN", { persist: false });
    try {
      const host = createHost();
      host.player.pendingLevelUpChoices = 1;
      const runtime = new ProgressionChoiceRuntime({ host });

      runtime.maybePromptLevelUpChoice(100, "runtime_tick");

      expect(host.uiManager.showEventDialog).toHaveBeenCalledTimes(1);
      const [eventDef] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
      expect(eventDef?.name).toBe("升级 - 属性分配");
      expect(eventDef?.description).toContain("当前待分配：1 点");
      expect(host.runLog.appendKey).toHaveBeenCalledWith(
        "log.progression.levelup_panel_opened",
        { pendingPoints: 1 },
        "info",
        100
      );
    } finally {
      setLocale(previousLocale, { persist: false });
    }
  });
});
