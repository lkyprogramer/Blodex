import { describe, expect, it, vi } from "vitest";
import * as core from "@blodex/core";
import { LOOT_TABLE_MAP } from "@blodex/content";
vi.mock("phaser", () => ({
  default: {
    GameObjects: {
      Image: class {},
      Rectangle: class {},
      Ellipse: class {}
    },
    Display: {
      Color: {
        IntegerToColor: () => ({ rgba: "rgba(0,0,0,1)" })
      }
    }
  }
}));

import { ProgressionRuntimeModule } from "../ProgressionRuntimeModule";

describe("ProgressionRuntimeModule", () => {
  it("routes successful challenge completion through unified boss victory flow", () => {
    const openVictoryChoice = vi.fn();
    const spawnLootDrop = vi.fn();
    const tryDiscoverBlueprints = vi.fn();
    const scheduleRunSave = vi.fn();
    const challengeMarker = {
      setTint: vi.fn(),
      setAlpha: vi.fn()
    };

    const host = {
      challengeRoomState: {
        roomId: "room-1",
        challengeId: "ossuary_trial",
        started: true,
        finished: false,
        success: false,
        waveIndex: 1
      },
      challengeMonsterIds: new Set<string>(["challenge-1"]),
      run: {
        currentFloor: 5,
        challengeSuccessCount: 0,
        runEconomy: {
          obols: 0
        }
      },
      player: {
        health: 120,
        derivedStats: {
          maxHealth: 120
        },
        position: {
          x: 2,
          y: 2
        }
      },
      challengeMarker,
      bossRuntimeModule: {
        spawn: vi.fn(),
        openVictoryChoice
      },
      entityManager: {
        removeMonsterById: vi.fn(() => null)
      },
      tryDiscoverBlueprints,
      runLog: {
        appendKey: vi.fn()
      },
      scheduleRunSave,
      hudDirty: false,
      spawnLootDrop,
      resolveProgressionLootTable: vi.fn(() => LOOT_TABLE_MAP.starter_floor),
      lootRng: { next: vi.fn(() => 0.5), nextInt: vi.fn(() => 0) },
      resolveLootRollOptions: vi.fn((options) => options),
      isItemDefUnlocked: vi.fn(() => true),
      path: [] as Array<{ x: number; y: number }>,
      manualMoveTarget: null,
      manualMoveTargetFailures: 0,
      dungeon: {
        rooms: [{ id: "room-1", roomType: "challenge", x: 4, y: 5, width: 4, height: 4 }]
      }
    } as unknown as ConstructorParameters<typeof ProgressionRuntimeModule>[0]["host"];

    const module = new ProgressionRuntimeModule({ host });

    module.finishChallengeEncounter(true, 1_000);

    expect(host.run.challengeSuccessCount).toBe(1);
    expect(tryDiscoverBlueprints).toHaveBeenCalledWith("challenge_room", 1_000, "room-1");
    expect(openVictoryChoice).toHaveBeenCalledWith(1_000, {
      challengeId: "ossuary_trial"
    });
    expect(spawnLootDrop).not.toHaveBeenCalled();
    expect(scheduleRunSave).toHaveBeenCalledTimes(1);
    expect(host.hudDirty).toBe(true);
  });

  it("falls back to challenge room rewards when no challenge encounter is defined for the current floor", () => {
    const openVictoryChoice = vi.fn();
    const spawnLootDrop = vi.fn();
    const tryDiscoverBlueprints = vi.fn();
    const scheduleRunSave = vi.fn();
    const challengeMarker = {
      setTint: vi.fn(),
      setAlpha: vi.fn()
    };
    const reward = { id: "reward-1", defId: "rusted_sabre", slot: "weapon", name: "Reward" };
    const rollItemDrop = vi.spyOn(core, "rollItemDrop").mockReturnValue(reward as never);

    try {
      const host = {
        challengeRoomState: {
          roomId: "room-2",
          started: true,
          finished: false,
          success: false,
          waveIndex: 1
        },
        challengeMonsterIds: new Set<string>(["challenge-2"]),
        run: {
          currentFloor: 3,
          challengeSuccessCount: 0,
          runEconomy: {
            obols: 0
          }
        },
        player: {
          health: 120,
          derivedStats: {
            maxHealth: 120
          },
          position: {
            x: 2,
            y: 2
          }
        },
        challengeMarker,
        bossRuntimeModule: {
          spawn: vi.fn(),
          openVictoryChoice
        },
        entityManager: {
          removeMonsterById: vi.fn(() => null)
        },
        tryDiscoverBlueprints,
        runLog: {
          appendKey: vi.fn()
        },
        scheduleRunSave,
        hudDirty: false,
        spawnLootDrop,
        resolveProgressionLootTable: vi.fn(() => LOOT_TABLE_MAP.starter_floor),
        lootRng: { next: vi.fn(() => 0.5), nextInt: vi.fn(() => 0) },
        resolveLootRollOptions: vi.fn((options) => options),
        isItemDefUnlocked: vi.fn(() => true),
        path: [] as Array<{ x: number; y: number }>,
        manualMoveTarget: null,
        manualMoveTargetFailures: 0,
        dungeon: {
          rooms: [{ id: "room-2", roomType: "challenge", x: 8, y: 10, width: 4, height: 4 }]
        }
      } as unknown as ConstructorParameters<typeof ProgressionRuntimeModule>[0]["host"];

      const module = new ProgressionRuntimeModule({ host });

      module.finishChallengeEncounter(true, 2_000);

      expect(host.run.challengeSuccessCount).toBe(1);
      expect(tryDiscoverBlueprints).toHaveBeenCalledWith("challenge_room", 2_000, "room-2");
      expect(openVictoryChoice).not.toHaveBeenCalled();
      expect(spawnLootDrop).toHaveBeenCalledWith(reward, { x: 10, y: 12 }, "challenge_reward");
      expect(scheduleRunSave).toHaveBeenCalledTimes(1);
      expect(host.hudDirty).toBe(true);
    } finally {
      rollItemDrop.mockRestore();
    }
  });
});
