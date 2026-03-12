import { describe, expect, it, vi } from "vitest";
import { BONE_SOVEREIGN } from "@blodex/content";
import { BossSpawnService } from "../BossSpawnService";

describe("BossSpawnService", () => {
  it("scales boss health by the floor config multiplier", () => {
    const setBoss = vi.fn();
    const spawnBoss = vi.fn(() => ({ setPosition: vi.fn() }));
    const host = {
      dungeon: {
        rooms: [{ id: "room-1", x: 8, y: 8, width: 6, height: 6 }],
        playerSpawn: { x: 2, y: 2 }
      },
      bossDef: BONE_SOVEREIGN,
      bossState: null,
      bossSprite: null,
      entityLabelById: new Map<string, string>(),
      renderSystem: {
        spawnBoss,
        spawnMonster: vi.fn()
      },
      entityManager: {
        setBoss,
        listMonsters: vi.fn(() => []),
        rebuildMonsterSpatialIndex: vi.fn()
      },
      origin: { x: 0, y: 0 },
      run: {
        currentFloor: 8,
        difficultyModifier: {
          affixPolicy: "default"
        }
      },
      unlockedAffixIds: [],
      spawnRng: {
        next: vi.fn(() => 0.5),
        nextInt: vi.fn(() => 0),
        pick: <T>(items: T[]) => items[0] as T
      },
      time: { now: 0 },
      floorConfig: {
        monsterHpMultiplier: 2,
        monsterDmgMultiplier: 1
      },
      eventBus: {
        emit: vi.fn()
      }
    } as unknown as ConstructorParameters<typeof BossSpawnService>[0]["host"];

    const service = new BossSpawnService({ host });

    service.spawnBoss();

    expect(host.bossState?.health).toBe(BONE_SOVEREIGN.baseHealth * 2);
    expect(host.bossState?.maxHealth).toBe(BONE_SOVEREIGN.baseHealth * 2);
    expect(setBoss).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          health: BONE_SOVEREIGN.baseHealth * 2,
          maxHealth: BONE_SOVEREIGN.baseHealth * 2
        })
      })
    );
  });
});
