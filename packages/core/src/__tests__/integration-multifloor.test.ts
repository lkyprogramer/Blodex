import { describe, expect, it } from "vitest";

interface FloorRunState {
  currentFloor: number;
  floorsCleared: number;
  kills: number;
  totalKills: number;
}

function createRunState(): FloorRunState {
  return {
    currentFloor: 1,
    floorsCleared: 0,
    kills: 0,
    totalKills: 0
  };
}

function enterNextFloor(run: FloorRunState): FloorRunState {
  return {
    ...run,
    currentFloor: run.currentFloor + 1,
    floorsCleared: run.floorsCleared + 1,
    kills: 0,
    totalKills: run.totalKills + run.kills
  };
}

describe("integration multifloor", () => {
  it("tracks floor progression and resets floor kills", () => {
    let run = createRunState();
    run = { ...run, kills: 10 };
    run = enterNextFloor(run);

    expect(run.currentFloor).toBe(2);
    expect(run.floorsCleared).toBe(1);
    expect(run.kills).toBe(0);
    expect(run.totalKills).toBe(10);
  });
});
