import { describe, expect, it, vi } from "vitest";
import type { MetaProgression, PlayerState } from "@blodex/core";
import { createInitialConsumableState, createInitialMeta, defaultBaseStats, deriveStats } from "@blodex/core";
import { EventResolutionService } from "../EventResolutionService";

function makePlayer(): PlayerState {
  const baseStats = defaultBaseStats();
  const derivedStats = deriveStats(baseStats, []);
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 98,
    health: derivedStats.maxHealth,
    mana: derivedStats.maxMana,
    baseStats,
    derivedStats,
    inventory: [],
    equipment: {},
    gold: 0
  };
}

function makeHost(overrides: Partial<ConstructorParameters<typeof EventResolutionService>[0]["host"]> = {}) {
  const player = makePlayer();
  const meta: MetaProgression = createInitialMeta();
  return {
    eventNode: null,
    floorConfig: { isBossFloor: false },
    eventRng: { next: vi.fn(() => 0.5), nextInt: vi.fn(() => 1), pick: vi.fn((items: unknown[]) => items[0]) },
    merchantRng: { next: vi.fn(() => 0.5), nextInt: vi.fn(() => 1), pick: vi.fn((items: unknown[]) => items[0]) },
    lootRng: { next: vi.fn(() => 0.5), nextInt: vi.fn(() => 1), pick: vi.fn((items: unknown[]) => items[0]) },
    run: {
      startedAtMs: 0,
      runSeed: "seed",
      difficulty: "normal",
      difficultyModifier: {
        monsterHealthMultiplier: 1,
        monsterDamageMultiplier: 1,
        affixPolicy: "default",
        soulShardMultiplier: 1
      },
      currentFloor: 3,
      floor: 3,
      floorsCleared: 2,
      kills: 0,
      totalKills: 0,
      lootCollected: 0,
      challengeSuccessCount: 0,
      inEndless: false,
      endlessFloor: 0,
      mutatorActiveIds: [],
      mutatorState: {},
      deferredShardBonus: 0,
      runMode: "normal",
      runEconomy: { obols: 0, spentObols: 0 }
    },
    currentBiome: { id: "molten_caverns" },
    unlockedEventIds: [],
    dungeon: { spawnPoints: [], width: 1, height: 1, walkable: [[true]], rooms: [], corridors: [], playerSpawn: { x: 0, y: 0 } },
    staircaseState: { kind: "single", position: { x: 0, y: 0 }, visible: false },
    hazards: [],
    renderSystem: { spawnTelegraphCircle: vi.fn() },
    origin: { x: 0, y: 0 },
    contentLocalizer: {
      eventName: vi.fn((_id: string, fallback: string) => fallback),
      eventChoiceName: vi.fn((_eventId: string, _choiceId: string, fallback: string) => fallback),
      itemName: vi.fn((_id: string, fallback: string) => fallback)
    },
    eventBus: { emit: vi.fn() },
    eventPanelOpen: false,
    player,
    uiManager: { showEventDialog: vi.fn(), showMerchantDialog: vi.fn(), hideEventPanel: vi.fn() },
    runLog: { append: vi.fn(), appendKey: vi.fn() },
    time: { now: 100 },
    hudDirty: false,
    meta,
    tryDiscoverBlueprints: vi.fn(),
    addRunBlueprintDiscoveries: vi.fn(),
    routeFeedback: vi.fn(),
    flushRunSave: vi.fn(),
    runCompletionModule: { finishRun: vi.fn() },
    merchantOffers: [],
    talentEffects: { economy: { merchantDiscount: 0 } },
    isItemDefUnlocked: vi.fn(() => true),
    markHighValueChoice: vi.fn(),
    resolveLootRollOptions: vi.fn((options) => options),
    eventRuntimeModule: { openEventPanel: vi.fn(), consumeCurrentEvent: vi.fn() },
    mapRevealActive: false,
    consumables: createInitialConsumableState(0),
    deferredOutcomeRuntime: { enqueue: vi.fn() },
    refreshPlayerStatsFromEquipment: vi.fn((nextPlayer: PlayerState) => nextPlayer),
    handleLevelUpGain: vi.fn(),
    lastDeathReason: "",
    ...overrides
  } as unknown as ConstructorParameters<typeof EventResolutionService>[0]["host"];
}

describe("EventResolutionService", () => {
  it("converts locked advanced consumable rewards into blueprint discovery", () => {
    const host = makeHost();
    const service = new EventResolutionService({ host });

    service.applyReward({ type: "consumable", consumableId: "frenzy_tonic", amount: 1 }, 100, "event:test");

    expect(host.addRunBlueprintDiscoveries).toHaveBeenCalledWith(
      ["bp_consumable_frenzy_tonic"],
      100,
      "event:test"
    );
    expect(host.consumables.charges.frenzy_tonic).toBe(0);
  });

  it("grants advanced consumables only after their blueprint is forged", () => {
    const host = makeHost({
      meta: {
        ...createInitialMeta(),
        blueprintForgedIds: ["bp_consumable_frenzy_tonic"]
      }
    });
    const service = new EventResolutionService({ host });

    service.applyReward({ type: "consumable", consumableId: "frenzy_tonic", amount: 1 }, 100, "event:test");

    expect(host.addRunBlueprintDiscoveries).not.toHaveBeenCalled();
    expect(host.consumables.charges.frenzy_tonic).toBe(1);
  });

  it("applies explicit blueprint rewards without granting charges", () => {
    const host = makeHost();
    const service = new EventResolutionService({ host });

    service.applyReward({ type: "blueprint", blueprintId: "bp_consumable_mapping_plus" }, 120, "event:test");

    expect(host.addRunBlueprintDiscoveries).toHaveBeenCalledWith(
      ["bp_consumable_mapping_plus"],
      120,
      "event:test"
    );
    expect(host.consumables.charges.scroll_of_mapping_plus).toBe(0);
  });
});
