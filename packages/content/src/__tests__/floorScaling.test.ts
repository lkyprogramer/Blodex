import { describe, expect, it } from "vitest";
import { getFloorConfig } from "../floorScaling";

describe("getFloorConfig", () => {
  it("creates explicit preparation windows on floors 5 and 7 for 8-floor story runs", () => {
    const floor5 = getFloorConfig(5);
    const floor7 = getFloorConfig(7);

    expect(floor5).toMatchObject({
      monsterCount: 0,
      pacingKind: "recovery",
      grantsFloorClearRewards: false,
      eventNodeBias: "near_player",
      layoutRoomCount: 7
    });
    expect(floor7).toMatchObject({
      monsterCount: 0,
      pacingKind: "preparation",
      grantsFloorClearRewards: false,
      eventNodeBias: "near_player",
      layoutRoomCount: 6
    });
  });

  it("raises early-floor density and exports spawn tuning for combat floors", () => {
    const floor1 = getFloorConfig(1);
    const floor4 = getFloorConfig(4);

    expect(floor1.monsterCount).toBe(14);
    expect(floor4.monsterCount).toBe(19);
    expect(floor1.spawnMinDistance).toBe(4);
    expect(floor1.spawnMaxDistance).toBe(30);
    expect(floor1.spawnMinSpacing).toBe(2);
    expect(floor1.spawnPackChance).toBeGreaterThan(0);
    expect(floor4.grantsFloorClearRewards).toBe(true);
  });
});
