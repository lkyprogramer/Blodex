import { describe, expect, it, vi } from "vitest";
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
      append: vi.fn()
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
    expect(host.runLog.append).toHaveBeenCalledTimes(1);
  });
});
