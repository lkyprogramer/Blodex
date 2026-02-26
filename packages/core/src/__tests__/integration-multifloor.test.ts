import { describe, expect, it } from "vitest";
import { createRunState, enterNextFloor } from "../run";

describe("integration multifloor", () => {
  it("tracks floor progression and resets floor kills", () => {
    let run = createRunState("seed", 0);
    run = { ...run, kills: 10, totalKills: 10 };
    run = enterNextFloor(run);

    expect(run.currentFloor).toBe(2);
    expect(run.floorsCleared).toBe(1);
    expect(run.kills).toBe(0);
    expect(run.totalKills).toBe(10);
  });
});
