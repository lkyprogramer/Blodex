import { describe, expect, it } from "vitest";
import { resolveBiomeForFloorBySeed } from "../biome";
import { createInitialConsumableState } from "../consumable";
import { createStaircaseState } from "../floor";
import { resolveBranchChoiceFromSide, resolveBranchSideAtPosition } from "../pathSelection";
import { deserializeRunState, serializeRunState, type RunSaveDataV3 } from "../save";
import { createRunState } from "../run";
import { defaultBaseStats, deriveStats } from "../stats";

describe("phase4c integration", () => {
  it("routes F3/F4 biome by branch choice", () => {
    const layout = {
      width: 24,
      height: 24,
      walkable: Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => true)),
      rooms: [
        { id: "r0", x: 2, y: 2, width: 5, height: 5 },
        { id: "r1", x: 15, y: 2, width: 5, height: 5 },
        { id: "r2", x: 10, y: 14, width: 7, height: 6 }
      ],
      corridors: [],
      spawnPoints: [{ x: 5, y: 5 }],
      playerSpawn: { x: 4, y: 4 },
      layoutHash: "phase4c-layout"
    };

    const staircase = {
      ...createStaircaseState(layout, layout.playerSpawn, 2),
      visible: true
    };
    expect(staircase.kind).toBe("branch");
    if (staircase.kind !== "branch" || staircase.options === undefined) {
      return;
    }

    const side = resolveBranchSideAtPosition(staircase, staircase.options[0].position, 0.5);
    expect(side).toBe("left");
    const choice = resolveBranchChoiceFromSide(side!);
    expect(resolveBiomeForFloorBySeed(3, "run-seed-x", choice)).toBe("molten_caverns");
    expect(resolveBiomeForFloorBySeed(4, "run-seed-x", choice)).toBe("phantom_graveyard");
    expect(resolveBiomeForFloorBySeed(5, "run-seed-x", choice)).toBe("bone_throne");
  });

  it("round-trips v3 branch staircase state at floor 2", () => {
    const baseStats = defaultBaseStats();
    const run = createRunState("seed-a", 1000, "normal");
    const save: RunSaveDataV3 = {
      schemaVersion: 3,
      savedAtMs: 1000,
      appVersion: "test",
      runId: "seed-a:1000",
      runSeed: "seed-a",
      domain: {
        run: {
          ...run,
          currentFloor: 2,
          floor: 2,
          currentBiomeId: "forgotten_catacombs"
        },
        player: {
          id: "p1",
          position: { x: 4, y: 4 },
          level: 1,
          xp: 0,
          xpToNextLevel: 100,
          pendingLevelUpChoices: 0,
          pendingSkillChoices: 0,
          health: 100,
          mana: 40,
          baseStats,
          derivedStats: deriveStats(baseStats, []),
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
        blueprintFoundIdsInRun: [],
        selectedMutationIds: []
      },
      runtime: {
        dungeon: {
          width: 16,
          height: 16,
          walkable: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => true)),
          rooms: [
            { id: "r0", x: 2, y: 2, width: 4, height: 4 },
            { id: "r1", x: 10, y: 10, width: 4, height: 4 }
          ],
          corridors: [],
          spawnPoints: [{ x: 11, y: 11 }],
          playerSpawn: { x: 3, y: 3 },
          layoutHash: "layout-v1"
        },
        staircase: {
          ...createStaircaseState(
            {
              width: 16,
              height: 16,
              walkable: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => true)),
              rooms: [
                { id: "r0", x: 2, y: 2, width: 4, height: 4 },
                { id: "r1", x: 10, y: 10, width: 4, height: 4 }
              ],
              corridors: [],
              spawnPoints: [{ x: 11, y: 11 }],
              playerSpawn: { x: 3, y: 3 },
              layoutHash: "layout-v1"
            },
            { x: 3, y: 3 },
            2
          ),
          visible: true
        },
        hazards: [],
        boss: null,
        monsters: [],
        lootOnGround: [],
        eventNode: null,
        minimap: {
          layoutHash: "layout-v1",
          exploredKeys: []
        },
        mapRevealActive: false,
        deferredOutcomes: [],
        rngCursor: {
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
        }
      },
      session: {}
    };

    const loaded = deserializeRunState(serializeRunState(save));
    expect(loaded?.runtime.staircase.kind).toBe("branch");
  });
});
