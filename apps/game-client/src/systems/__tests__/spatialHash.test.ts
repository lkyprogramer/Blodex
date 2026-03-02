import { describe, expect, it } from "vitest";
import { SpatialHash } from "../spatialHash";

interface Node {
  id: string;
  x: number;
  y: number;
}

describe("SpatialHash", () => {
  it("queries nearby items by radius", () => {
    const hash = new SpatialHash<Node>(2);
    const nodes: Node[] = [
      { id: "a", x: 1, y: 1 },
      { id: "b", x: 4, y: 4 },
      { id: "c", x: 7, y: 7 }
    ];
    hash.rebuild(nodes, (node) => ({ x: node.x, y: node.y }));

    const nearby = hash.queryRadius({ x: 2, y: 2 }, 2.4).map((node) => node.id).sort();
    expect(nearby).toEqual(["a"]);
  });

  it("supports dynamic remove and clear", () => {
    const hash = new SpatialHash<Node>(2);
    const node: Node = { id: "x", x: 3, y: 3 };
    hash.insert(node, { x: node.x, y: node.y });
    expect(hash.queryRadius({ x: 3, y: 3 }, 1).map((entry) => entry.id)).toEqual(["x"]);

    hash.remove(node);
    expect(hash.queryRadius({ x: 3, y: 3 }, 1)).toEqual([]);

    hash.insert(node, { x: node.x, y: node.y });
    hash.clear();
    expect(hash.queryRadius({ x: 3, y: 3 }, 10)).toEqual([]);
  });
});
