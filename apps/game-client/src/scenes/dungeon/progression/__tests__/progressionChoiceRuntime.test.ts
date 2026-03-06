import { describe, expect, it, vi } from "vitest";
import { getLocale, setLocale } from "../../../../i18n";
import { ProgressionChoiceRuntime } from "../ProgressionChoiceRuntime";

function createHost(): any {
  return {
    runEnded: false,
    eventPanelOpen: false,
    time: { now: 0 },
    eventBus: {
      emit: vi.fn()
    },
    run: { currentFloor: 2 },
    player: {
      id: "player",
      level: 1,
      health: 100,
      pendingLevelUpChoices: 0,
      pendingSkillChoices: 0,
      baseStats: {
        strength: 8,
        dexterity: 8,
        vitality: 8,
        intelligence: 8
      },
      derivedStats: {
        maxHealth: 100,
        attackPower: 10,
        critChance: 0.05,
        attackSpeed: 1,
        armor: 8,
        maxMana: 40,
        moveSpeed: 140
      }
    },
    currentBiome: { lootBias: {} },
    runLog: {
      append: vi.fn(),
      appendKey: vi.fn()
    },
    refreshSynergyRuntime: vi.fn(),
    refreshPlayerStatsFromEquipment: vi.fn((player) => player),
    registerStatDeltaHighlights: vi.fn(),
    playerActionModule: {
      resolveLevelupSkillChoices: vi.fn(() => []),
      resolveLevelupSkillChoiceById: vi.fn(() => null),
      applyLevelupSkillChoice: vi.fn(() => true)
    },
    scheduleRunSave: vi.fn(),
    recordPlayerFacingChoice: vi.fn(),
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

  it("prioritizes skill choice prompts before stat allocation", () => {
    const host = createHost();
    host.player.pendingSkillChoices = 1;
    host.player.pendingLevelUpChoices = 1;
    host.playerActionModule.resolveLevelupSkillChoices.mockReturnValue([
      {
        skillId: "chain_lightning",
        nextLevel: 1,
        name: "Chain Lightning",
        description: "Arcane bolt.",
        cooldownMs: 4200,
        manaCost: 12
      }
    ]);
    const runtime = new ProgressionChoiceRuntime({ host });

    runtime.maybePromptLevelUpChoice(100, "runtime_tick");

    const [eventDef] = vi.mocked(host.uiManager.showEventDialog).mock.calls[0] ?? [];
    expect(eventDef?.id).toBe("levelup_skill_choice");
    expect(host.runLog.appendKey).toHaveBeenCalledWith(
      "log.progression.levelup_skill_panel_opened",
      { pendingChoices: 1 },
      "info",
      100
    );
  });

  it("reuses the same skill offers after closing the panel", () => {
    const host = createHost();
    host.player.pendingSkillChoices = 1;
    host.playerActionModule.resolveLevelupSkillChoices
      .mockReturnValueOnce([
        {
          skillId: "chain_lightning",
          nextLevel: 1,
          name: "Chain Lightning",
          description: "Arcane bolt.",
          cooldownMs: 4200,
          manaCost: 12
        }
      ])
      .mockReturnValueOnce([
        {
          skillId: "spirit_burst",
          nextLevel: 1,
          name: "Spirit Burst",
          description: "Burst spirits.",
          cooldownMs: 5600,
          manaCost: 18
        }
      ]);
    const runtime = new ProgressionChoiceRuntime({ host });

    host.time.now = 100;
    runtime.maybePromptLevelUpChoice(100, "runtime_tick");
    const firstCall = vi.mocked(host.uiManager.showEventDialog).mock.calls[0];
    expect(firstCall?.[0]?.choices[0]?.id).toBe("chain_lightning");

    const onClose = firstCall?.[3];
    expect(onClose).toBeTypeOf("function");
    onClose?.();

    host.time.now = 2700;
    runtime.maybePromptLevelUpChoice(2700, "runtime_tick");

    const secondCall = vi.mocked(host.uiManager.showEventDialog).mock.calls[1];
    expect(secondCall?.[0]?.choices[0]?.id).toBe("chain_lightning");
    expect(host.playerActionModule.resolveLevelupSkillChoices).toHaveBeenCalledTimes(1);
  });

  it("rejects skill selections that are not part of the active offer set", () => {
    const host = createHost();
    host.player.pendingSkillChoices = 1;
    host.playerActionModule.resolveLevelupSkillChoices.mockReturnValue([
      {
        skillId: "chain_lightning",
        nextLevel: 1,
        name: "Chain Lightning",
        description: "Arcane bolt.",
        cooldownMs: 4200,
        manaCost: 12
      }
    ]);
    const runtime = new ProgressionChoiceRuntime({ host });

    runtime.maybePromptLevelUpChoice(100, "runtime_tick");

    const onSelect = vi.mocked(host.uiManager.showEventDialog).mock.calls[0]?.[2];
    onSelect?.("rift_step");

    expect(host.playerActionModule.applyLevelupSkillChoice).not.toHaveBeenCalled();
    expect(host.player.pendingSkillChoices).toBe(1);
  });

  it("restores pending skill offers from saved prompt state without rerolling", () => {
    const host = createHost();
    host.player.pendingSkillChoices = 1;
    host.playerActionModule.resolveLevelupSkillChoices.mockReturnValue([
      {
        skillId: "chain_lightning",
        nextLevel: 1,
        name: "Chain Lightning",
        description: "Arcane bolt.",
        cooldownMs: 4200,
        manaCost: 12
      }
    ]);
    host.playerActionModule.resolveLevelupSkillChoiceById.mockImplementation((skillId: string) =>
      skillId === "chain_lightning"
        ? {
            skillId: "chain_lightning",
            nextLevel: 1,
            name: "Chain Lightning",
            description: "Arcane bolt.",
            cooldownMs: 4200,
            manaCost: 12
          }
        : null
    );
    const runtime = new ProgressionChoiceRuntime({ host });

    host.time.now = 100;
    runtime.maybePromptLevelUpChoice(100, "runtime_tick");
    const onClose = vi.mocked(host.uiManager.showEventDialog).mock.calls[0]?.[3];
    onClose?.();

    const snapshot = runtime.capturePromptState(500);
    runtime.resetRuntime(0, 2);
    runtime.restorePromptState(snapshot, 1000);

    host.time.now = 3000;
    runtime.maybePromptLevelUpChoice(3000, "runtime_tick");
    expect(vi.mocked(host.uiManager.showEventDialog)).toHaveBeenCalledTimes(1);

    host.time.now = 3100;
    runtime.maybePromptLevelUpChoice(3100, "runtime_tick");

    expect(vi.mocked(host.uiManager.showEventDialog)).toHaveBeenCalledTimes(2);
    const restoredCall = vi.mocked(host.uiManager.showEventDialog).mock.calls[1];
    expect(restoredCall?.[0]?.choices[0]?.id).toBe("chain_lightning");
    expect(host.playerActionModule.resolveLevelupSkillChoices).toHaveBeenCalledTimes(1);
    expect(host.playerActionModule.resolveLevelupSkillChoiceById).toHaveBeenCalledWith("chain_lightning");
  });
});
