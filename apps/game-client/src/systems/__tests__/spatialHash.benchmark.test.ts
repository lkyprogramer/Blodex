import { describe, expect, it } from "vitest";
import { SpatialHash, type SpatialPoint } from "../spatialHash";

interface MonsterPoint extends SpatialPoint {
  id: string;
}

interface BenchmarkSummary {
  monsterCount: number;
  naiveChecks: number;
  spatialCandidates: number;
  spatialBuckets: number;
}

function createSeededGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createMonsterDataset(count: number, seed: number): MonsterPoint[] {
  const next = createSeededGenerator(seed);
  const items: MonsterPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    items.push({
      id: `m-${i}`,
      x: Math.floor(next() * 48),
      y: Math.floor(next() * 48)
    });
  }
  return items;
}

function createQueries(count: number, seed: number): SpatialPoint[] {
  const next = createSeededGenerator(seed);
  const points: SpatialPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    points.push({
      x: Math.floor(next() * 48),
      y: Math.floor(next() * 48)
    });
  }
  return points;
}

function runBenchmark(monsterCount: number): BenchmarkSummary {
  const monsters = createMonsterDataset(monsterCount, 1000 + monsterCount);
  const queries = createQueries(220, 4000 + monsterCount);
  const radius = 6;
  const radiusSquared = radius * radius;
  const hash = new SpatialHash<MonsterPoint>(2);
  hash.rebuild(monsters, (monster) => ({ x: monster.x, y: monster.y }));

  let naiveChecks = 0;
  let spatialCandidates = 0;
  let spatialBuckets = 0;

  for (const query of queries) {
    const naive = monsters
      .filter((monster) => {
        naiveChecks += 1;
        const dx = monster.x - query.x;
        const dy = monster.y - query.y;
        return dx * dx + dy * dy <= radiusSquared;
      })
      .map((monster) => monster.id)
      .sort();

    const spatial = hash.queryRadiusWithStats(query, radius);
    spatialCandidates += spatial.stats.candidatesScanned;
    spatialBuckets += spatial.stats.bucketsScanned;
    const optimized = spatial.items.map((monster) => monster.id).sort();
    expect(optimized).toEqual(naive);
  }

  return {
    monsterCount,
    naiveChecks,
    spatialCandidates,
    spatialBuckets
  };
}

describe("SpatialHash benchmark profile", () => {
  it("keeps candidate scans well below naive checks for monster 20/40/60", () => {
    const summaries = [20, 40, 60].map((count) => runBenchmark(count));
    for (const summary of summaries) {
      expect(summary.spatialCandidates).toBeLessThan(summary.naiveChecks);
      expect(summary.spatialCandidates / summary.naiveChecks).toBeLessThan(0.7);
    }
    expect(summaries[2]!.spatialCandidates / summaries[2]!.naiveChecks).toBeLessThan(0.2);
  });
});
