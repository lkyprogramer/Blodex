import type Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as core from "@blodex/core";
import {
  createEventBus,
  createRunState,
  defaultBaseStats,
  deriveStats,
  type GameEventMap,
  type ItemInstance,
  type PlayerState
} from "@blodex/core";
import { ITEM_DEF_MAP, LOOT_TABLE_MAP } from "@blodex/content";
import { Phase6TelemetryTracker } from "../Phase6Telemetry";
import { scorePowerSpikeFromItem } from "../PowerSpikeRuntime";
import { PowerSpikeRuntimeModule, type PowerSpikeRuntimeHost } from "../PowerSpikeRuntimeModule";

vi.mock("@blodex/core", async () => {
  const actual = await vi.importActual<typeof import("@blodex/core")>("@blodex/core");
  return {
    ...actual,
    collectLoot: vi.fn(actual.collectLoot),
    rollBossDrops: vi.fn(actual.rollBossDrops)
  };
});

function makeItem(defId: string, overrides: Partial<ItemInstance> = {}): ItemInstance {
  const def = ITEM_DEF_MAP[defId]!;
  return {
    id: `${defId}-instance-${Math.random().toString(16).slice(2)}`,
    defId: def.id,
    name: def.name,
    slot: def.slot,
    kind: def.kind ?? "equipment",
    ...(def.weaponType === undefined ? {} : { weaponType: def.weaponType }),
    rarity: def.rarity,
    requiredLevel: def.requiredLevel,
    iconId: def.iconId,
    seed: `${defId}-seed`,
    rolledAffixes: {},
    ...(def.fixedSpecialAffixes === undefined ? {} : { rolledSpecialAffixes: { ...def.fixedSpecialAffixes } }),
    ...overrides
  };
}

function createPlayer(equipment: ItemInstance[] = []): PlayerState {
  const baseStats = defaultBaseStats();
  const equipmentBySlot = Object.fromEntries(equipment.map((item) => [item.slot, item]));
  const derivedStats = deriveStats(baseStats, equipment);
  return {
    id: "player",
    position: { x: 0, y: 0 },
    level: 5,
    xp: 0,
    xpToNextLevel: 100,
    pendingLevelUpChoices: 0,
    pendingSkillChoices: 0,
    health: derivedStats.maxHealth,
    mana: derivedStats.maxMana,
    baseStats,
    derivedStats,
    inventory: [],
    equipment: equipmentBySlot,
    gold: 0,
    skills: {
      skillSlots: [],
      cooldowns: {}
    },
    activeBuffs: []
  };
}

function createHost(overrides: Partial<PowerSpikeRuntimeHost> = {}) {
  const telemetry = new Phase6TelemetryTracker();
  telemetry.resetRun(0);
  const eventBus = createEventBus<GameEventMap>();
  const groundLoot: ItemInstance[] = [];
  const host: PowerSpikeRuntimeHost = {
    runSeed: "phase6-6.2-test",
    run: createRunState("phase6-6.2-test", 0, "normal"),
    player: createPlayer([makeItem("rusted_sabre", { rolledAffixes: { attackPower: 2 } })]),
    bossDef: {
      dropTableId: "starter_floor"
    },
    staircaseState: {
      position: { x: 4, y: 4 }
    },
    lootRng: new core.SeededRng("phase6-6.2-loot"),
    origin: { x: 0, y: 0 },
    eventBus,
    renderSystem: {
      spawnLootSprite: () => ({ destroy() {} }) as unknown as Phaser.GameObjects.Ellipse
    },
    entityManager: {
      addLoot(drop) {
        groundLoot.push(drop.item);
      }
    },
    tasteRuntime: {
      recordDrop: vi.fn(),
      recordPickup: vi.fn(),
      recordHeartbeat: vi.fn(),
      snapshotBuildIdentity: () => ({
        tags: [],
        keyItemDefIds: [],
        pivots: []
      })
    },
    phase6Telemetry: telemetry,
    contentLocalizer: {
      itemName: (_itemDefId, fallback) => fallback
    },
    runLog: {
      append: vi.fn(),
      appendKey: vi.fn()
    },
    markHighValueChoice: vi.fn(),
    resolveProgressionLootTable: () => LOOT_TABLE_MAP.starter_floor,
    resolveLootRollOptions: (options) => options,
    isItemDefUnlocked: () => true,
    hudDirty: false,
    ...overrides
  };
  return {
    host,
    telemetry,
    eventBus,
    groundLoot
  };
}

describe("PowerSpikeRuntimeModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not consume fallback budget when no eligible reward can be generated", () => {
    const { host, groundLoot } = createHost({
      run: {
        ...createRunState("phase6-6.2-test", 0, "normal"),
        currentFloor: 2,
        floor: 2
      },
      resolveProgressionLootTable: () => ({
        id: "fallback-test",
        entries: [{ itemDefId: "sanctified_greatsword", weight: 1, minFloor: 1 }]
      }),
      isItemDefUnlocked: () => false
    });
    const module = new PowerSpikeRuntimeModule({ host });

    module.grantFloorPairFallbackReward(1_000);

    expect(module.captureBudgetState().pairStates["1-2"].fallbackGranted).toBe(false);
    expect(module.captureBudgetState().pairStates["1-2"].satisfied).toBe(false);
    expect(groundLoot).toHaveLength(0);
  });

  it("scores boss rewards sequentially against the current player baseline", () => {
    const strongWeapon = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16,
        critChance: 0.04,
        attackSpeed: 0.04,
        maxHealth: 12
      },
      rolledSpecialAffixes: {
        critDamage: 0.15
      }
    });
    const mediumWeapon = makeItem("dusk_halberd", {
      rolledAffixes: {
        attackPower: 10,
        critChance: 0.02,
        attackSpeed: 0.03
      }
    });
    const { host, telemetry } = createHost({
      run: {
        ...createRunState("phase6-6.2-test", 0, "normal"),
        currentFloor: 5,
        floor: 5
      }
    });
    const preBossPlayer = host.player;
    const firstAccepted = scorePowerSpikeFromItem(preBossPlayer, strongWeapon);
    const equippedAfterFirst = {
      ...preBossPlayer,
      equipment: {
        ...preBossPlayer.equipment,
        [strongWeapon.slot]: strongWeapon
      }
    };
    equippedAfterFirst.derivedStats = deriveStats(
      equippedAfterFirst.baseStats,
      Object.values(equippedAfterFirst.equipment).filter((item): item is ItemInstance => item !== undefined)
    );
    const secondAcceptedPreBoss = scorePowerSpikeFromItem(preBossPlayer, mediumWeapon);
    const secondAcceptedSequential = scorePowerSpikeFromItem(equippedAfterFirst, mediumWeapon);

    expect(firstAccepted.accepted).toBe(true);
    expect(secondAcceptedPreBoss.accepted).toBe(true);
    expect(secondAcceptedSequential.accepted).toBe(false);

    vi.mocked(core.rollBossDrops).mockReturnValue({
      guaranteedRare: strongWeapon,
      guaranteedBossExclusive: mediumWeapon
    });
    vi.mocked(core.collectLoot).mockImplementation((player, item) => {
      const equipment = {
        ...player.equipment,
        [item.slot]: item
      };
      const equipped = Object.values(equipment).filter((entry): entry is ItemInstance => entry !== undefined);
      const derivedStats = deriveStats(player.baseStats, equipped);
      return {
        ...player,
        inventory: [...player.inventory, item],
        equipment,
        derivedStats,
        health: Math.min(player.health, derivedStats.maxHealth),
        mana: Math.min(player.mana, derivedStats.maxMana)
      };
    });

    const module = new PowerSpikeRuntimeModule({ host });
    module.grantStoryBossReward(5_000);

    expect(telemetry.snapshot(60_000).story.powerSpikes).toBe(1);
  });
});
