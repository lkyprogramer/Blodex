import { describe, expect, it } from "vitest";
import {
  appendReplayInput,
  computeReplayChecksum,
  createReplay,
  deriveFloorSeed
} from "../run";
import type { RunState } from "../run";
import type { RunSummary } from "../contracts/types";

function makeSummary(seed: string): RunSummary {
  return {
    floorReached: 1,
    kills: seed.length % 7,
    lootCollected: seed.length % 5,
    elapsedMs: 45_000,
    leveledTo: 3
  };
}

describe("run replay determinism", () => {
  it("derives stable floor seeds per stream", () => {
    const seed = "run-seed-a";
    expect(deriveFloorSeed(seed, 1, "procgen")).toBe("run-seed-a:floor:1:stream:procgen");
    expect(deriveFloorSeed(seed, 1, "combat")).toBe("run-seed-a:floor:1:stream:combat");
  });

  it("keeps replay checksum deterministic for fixed inputs", () => {
    const samples = ["seed-alpha", "seed-beta", "seed-gamma"];

    for (const sample of samples) {
      const initial: RunState = {
        startedAtMs: 0,
        floor: 1,
        kills: 0,
        lootCollected: 0,
        runSeed: sample,
        replay: createReplay(sample, 1)
      };
      const withInputs = appendReplayInput(
        appendReplayInput(initial, {
          type: "move_target",
          atMs: 120,
          target: { x: 6, y: 8 }
        }),
        {
          type: "attack_target",
          atMs: 510,
          targetId: "monster-3"
        }
      );

      const summary = makeSummary(sample);
      const replay = withInputs.replay;
      expect(replay).toBeDefined();
      if (replay === undefined) {
        continue;
      }

      const first = computeReplayChecksum(summary, replay);
      const second = computeReplayChecksum(summary, replay);
      expect(first).toBe(second);
    }
  });
});
