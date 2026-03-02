import { describe, expect, it } from "vitest";
import { findPath } from "../pathfinding";

describe("findPath", () => {
  it("finds a valid path on walkable tiles", () => {
    const grid = [
      [true, true, true, true],
      [false, false, true, false],
      [true, true, true, true],
      [true, false, false, true]
    ];

    const path = findPath(grid, { x: 0, y: 0 }, { x: 3, y: 3 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 3 });

    for (const point of path) {
      expect(grid[point.y]?.[point.x]).toBe(true);
    }
  });

  it("returns a deterministic partial path when expansion budget is capped", () => {
    const grid = Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => true));
    const partial = findPath(
      grid,
      { x: 0, y: 0 },
      { x: 23, y: 23 },
      { maxExpandedNodes: 8 }
    );

    expect(partial.length).toBeGreaterThan(0);
    expect(partial[0]).toEqual({ x: 0, y: 0 });
    expect(partial[partial.length - 1]).not.toEqual({ x: 23, y: 23 });
    for (const node of partial) {
      expect(grid[node.y]?.[node.x]).toBe(true);
    }

    const second = findPath(
      grid,
      { x: 0, y: 0 },
      { x: 23, y: 23 },
      { maxExpandedNodes: 8 }
    );
    expect(second).toEqual(partial);
  });
});
