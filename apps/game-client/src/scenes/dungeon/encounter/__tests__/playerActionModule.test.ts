import { describe, expect, it, vi } from "vitest";
import type { ConsumableState, PlayerState, RunState } from "@blodex/core";
import { PlayerActionModule, type PlayerActionHost } from "../PlayerActionModule";

function createPlayer(): PlayerState {
  return {
    id: "player-1",
    position: { x: 0, y: 0 },
    level: 3,
    xp: 0,
    xpToNextLevel: 100,
    health: 90,
    mana: 30,
    baseStats: {
      strength: 8,
      dexterity: 7,
      vitality: 6,
      intelligence: 5
    },
    derivedStats: {
      maxHealth: 100,
      maxMana: 40,
      armor: 5,
      attackPower: 12,
      critChance: 0.05,
      attackSpeed: 1,
      moveSpeed: 4
    },
    inventory: [],
    equipment: {},
    gold: 0,
    skills: {
      skillSlots: [{ defId: "cleave", level: 1 }, null, null],
      cooldowns: {}
    }
  };
}

function createRun(): RunState {
  return {
    startedAtMs: 0,
    runSeed: "player-action-test",
    difficulty: "normal",
    difficultyModifier: {
      monsterHealthMultiplier: 1,
      monsterDamageMultiplier: 1,
      affixPolicy: "default",
      soulShardMultiplier: 1
    },
    currentFloor: 1,
    currentBiomeId: "forgotten_catacombs",
    floor: 1,
    floorsCleared: 0,
    kills: 0,
    totalKills: 0,
    lootCollected: 0,
    challengeSuccessCount: 0,
    inEndless: false,
    endlessFloor: 0,
    endlessKills: 0,
    runMode: "normal",
    mutatorActiveIds: [],
    mutatorState: {},
    deferredShardBonus: 0,
    runEconomy: {
      obols: 0,
      spentObols: 0
    }
  };
}

function createConsumables(): ConsumableState {
  return {
    charges: {
      health_potion: 1,
      mana_potion: 1,
      scroll_of_mapping: 1
    },
    cooldowns: {
      health_potion: 0,
      mana_potion: 0,
      scroll_of_mapping: 0
    }
  };
}

function createHost(comparePromptOpen: boolean): {
  host: PlayerActionHost;
  combatUseSkill: ReturnType<typeof vi.fn>;
  eventEmit: ReturnType<typeof vi.fn>;
  scheduleRunSave: ReturnType<typeof vi.fn>;
} {
  const combatUseSkill = vi.fn();
  const eventEmit = vi.fn();
  const scheduleRunSave = vi.fn();
  const host: PlayerActionHost = {
    player: createPlayer(),
    run: createRun(),
    runEnded: false,
    eventPanelOpen: false,
    comparePromptOpen,
    time: { now: 1200 },
    resolveRuntimeSkillDef: vi.fn((skillDef) => skillDef),
    entityManager: {
      listMonsters: vi.fn(() => []),
      removeMonsterById: vi.fn(() => null)
    },
    combatSystem: {
      useSkill: combatUseSkill as never
    },
    skillRng: {
      next: vi.fn(() => 0.5),
      nextInt: vi.fn(() => 0),
      pick: <T>(items: T[]) => items[0] as T
    },
    progressionRuntimeModule: {
      onMonsterDefeated: vi.fn()
    },
    tryDiscoverBlueprints: vi.fn(),
    applyOnKillMutationEffects: vi.fn(),
    spawnSplitChildren: vi.fn(),
    refreshPlayerStatsFromEquipment: vi.fn((player) => player),
    handleLevelUpGain: vi.fn(),
    resolveMutationDropBonus: vi.fn(() => ({ obolMultiplier: 1, soulShardMultiplier: 1 })),
    getRunRelativeNowMs: vi.fn(() => 1200),
    recordPlayerInput: vi.fn(),
    recordSkillResolutionTelemetry: vi.fn(),
    applyResolvedBuffs: vi.fn(),
    eventBus: {
      on: vi.fn(() => () => undefined),
      off: vi.fn(),
      emit: eventEmit,
      removeAll: vi.fn(),
      listenerCount: vi.fn(() => 0)
    },
    refreshSynergyRuntime: vi.fn(),
    hudDirty: false,
    consumables: createConsumables(),
    collectMutationEffects: (() => []) as PlayerActionHost["collectMutationEffects"],
    mapRevealActive: false,
    runLog: {
      appendKey: vi.fn()
    },
    meta: {
      blueprintForgedIds: [],
      unlocks: []
    },
    scheduleRunSave
  };
  return { host, combatUseSkill, eventEmit, scheduleRunSave };
}

describe("PlayerActionModule", () => {
  it("blocks skill hotkeys while a blocking overlay is open", () => {
    const { host, combatUseSkill, eventEmit } = createHost(true);
    const module = new PlayerActionModule({ host });

    const used = module.tryUseSkill(0);

    expect(used).toBe(false);
    expect(combatUseSkill).not.toHaveBeenCalled();
    expect(eventEmit).not.toHaveBeenCalled();
  });

  it("blocks consumable hotkeys while a blocking overlay is open", () => {
    const { host, eventEmit, scheduleRunSave } = createHost(true);
    const module = new PlayerActionModule({ host });

    const used = module.tryUseConsumable("health_potion");

    expect(used).toBe(false);
    expect(host.consumables.charges.health_potion).toBe(1);
    expect(eventEmit).not.toHaveBeenCalled();
    expect(scheduleRunSave).not.toHaveBeenCalled();
  });
});
