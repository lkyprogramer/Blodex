import { describe, expect, it, vi } from "vitest";
import {
  createInitialConsumableState,
  getDifficultyModifier,
  validateSave,
  type RunRngStreamName
} from "@blodex/core";
import type { RunSaveDataV1 } from "@blodex/core";
import { SAVE_LEASE_TTL_MS, SaveManager } from "../SaveManager";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function makeCursor(): Record<RunRngStreamName, number> {
  return {
    procgen: 0,
    spawn: 0,
    combat: 0,
    loot: 0,
    skill: 0,
    boss: 0,
    biome: 0,
    hazard: 0,
    event: 0,
    merchant: 0
  };
}

function makeSnapshot(nowMs = 100): RunSaveDataV1 {
  return {
    schemaVersion: 1,
    savedAtMs: nowMs,
    appVersion: "test",
    runId: "seed:100",
    runSeed: "seed",
    run: {
      startedAtMs: 100,
      runSeed: "seed",
      difficulty: "normal",
      difficultyModifier: getDifficultyModifier("normal"),
      currentFloor: 1,
      currentBiomeId: "forgotten_catacombs",
      floor: 1,
      floorsCleared: 0,
      kills: 0,
      totalKills: 0,
      lootCollected: 0,
      runEconomy: { obols: 0, spentObols: 0 }
    },
    player: {
      id: "player",
      position: { x: 1, y: 1 },
      level: 1,
      xp: 0,
      xpToNextLevel: 10,
      health: 100,
      mana: 40,
      baseStats: { strength: 8, dexterity: 8, vitality: 8, intelligence: 5 },
      derivedStats: {
        maxHealth: 100,
        maxMana: 40,
        armor: 0,
        attackPower: 10,
        critChance: 0.03,
        attackSpeed: 1,
        moveSpeed: 140
      },
      inventory: [],
      equipment: {},
      gold: 0,
      skills: {
        skillSlots: [null, null],
        cooldowns: {}
      },
      activeBuffs: []
    },
    consumables: createInitialConsumableState(0),
    dungeon: {
      width: 2,
      height: 2,
      walkable: [
        [true, true],
        [true, true]
      ],
      rooms: [],
      corridors: [],
      spawnPoints: [{ x: 1, y: 1 }],
      playerSpawn: { x: 1, y: 1 },
      layoutHash: "layout"
    },
    staircase: {
      position: { x: 1, y: 1 },
      visible: false
    },
    hazards: [],
    boss: null,
    monsters: [],
    lootOnGround: [],
    eventNode: null,
    minimap: {
      layoutHash: "layout",
      exploredKeys: [0]
    },
    mapRevealActive: false,
    rngCursor: makeCursor()
  };
}

describe("SaveManager", () => {
  it("acquires lease and blocks other tabs until ttl expires", () => {
    const storage = new MemoryStorage();
    const sessionA = new MemoryStorage();
    const sessionB = new MemoryStorage();

    let now = 1_000;
    const managerA = new SaveManager({ storage, sessionStorage: sessionA, now: () => now });
    const managerB = new SaveManager({ storage, sessionStorage: sessionB, now: () => now });

    const snapshot = makeSnapshot(now);
    expect(validateSave(snapshot)).toBe(true);
    expect(managerA.writeSave(snapshot)).toBe(true);
    expect(managerA.readSave()).not.toBeNull();

    const leaseA = managerA.acquireLease();
    expect(leaseA.ok).toBe(true);

    const blocked = managerB.acquireLease();
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("lease_held");

    now += SAVE_LEASE_TTL_MS + 1;
    const leaseB = managerB.acquireLease();
    expect(leaseB.ok).toBe(true);
  });

  it("tracks settled run ids idempotently", () => {
    const storage = new MemoryStorage();
    const session = new MemoryStorage();
    const manager = new SaveManager({ storage, sessionStorage: session });

    expect(manager.isRunSettled("run-1")).toBe(false);
    manager.markRunSettled("run-1");
    manager.markRunSettled("run-1");
    expect(manager.isRunSettled("run-1")).toBe(true);
  });

  it("debounces scheduled save writes", () => {
    vi.useFakeTimers();

    const storage = new MemoryStorage();
    const session = new MemoryStorage();
    const manager = new SaveManager({ storage, sessionStorage: session, debounceMs: 100 });

    const builder = vi.fn(() => makeSnapshot(Date.now()));

    manager.scheduleSave(builder);
    manager.scheduleSave(builder);
    manager.scheduleSave(builder);

    expect(builder).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(100);
    expect(builder).toHaveBeenCalledTimes(1);

    manager.dispose();
    vi.useRealTimers();
  });
});
