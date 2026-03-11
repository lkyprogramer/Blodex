import { describe, expect, it } from "vitest";
import { resolveStepDisplacement } from "../displacement";

describe("resolveStepDisplacement", () => {
  it("blocks on the first crossed tile when starting from a fractional position", () => {
    const walkable = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => true));
    walkable[1]![2] = false;

    const resolved = resolveStepDisplacement({
      from: { x: 1.6, y: 1 },
      direction: { x: 1, y: 0 },
      distance: 2,
      walkable,
      width: 5,
      height: 5
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        to: { x: 1, y: 1 },
        traveledCells: 0,
        blocked: true,
        blockedAtFirstCell: true
      })
    );
  });

  it("preserves diagonal displacement semantics while tracing crossed tiles", () => {
    const walkable = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => true));

    const resolved = resolveStepDisplacement({
      from: { x: 1, y: 1 },
      direction: { x: 1, y: 1 },
      distance: 2,
      walkable,
      width: 5,
      height: 5
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        to: { x: 2, y: 2 },
        traveledCells: 1,
        blocked: false,
        blockedAtFirstCell: false
      })
    );
  });
});
