export interface SpatialPoint {
  x: number;
  y: number;
}

export interface SpatialQueryStats {
  bucketsScanned: number;
  candidatesScanned: number;
}

export interface SpatialQueryResult<T> {
  items: T[];
  stats: SpatialQueryStats;
}

function bucketKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export class SpatialHash<T> {
  private readonly buckets = new Map<string, Set<T>>();
  private readonly points = new Map<T, SpatialPoint>();

  constructor(private readonly cellSize = 2) {}

  clear(): void {
    this.buckets.clear();
    this.points.clear();
  }

  rebuild(items: readonly T[], resolver: (item: T) => SpatialPoint): void {
    this.clear();
    for (const item of items) {
      const point = resolver(item);
      this.insert(item, point);
    }
  }

  insert(item: T, point: SpatialPoint): void {
    this.points.set(item, point);
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    const key = bucketKey(cx, cy);
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      this.buckets.set(key, new Set([item]));
      return;
    }
    bucket.add(item);
  }

  remove(item: T): void {
    const point = this.points.get(item);
    if (point === undefined) {
      return;
    }
    this.points.delete(item);
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    const key = bucketKey(cx, cy);
    const bucket = this.buckets.get(key);
    if (bucket === undefined) {
      return;
    }
    bucket.delete(item);
    if (bucket.size === 0) {
      this.buckets.delete(key);
    }
  }

  queryRadius(center: SpatialPoint, radius: number): T[] {
    return this.queryRadiusWithStats(center, radius).items;
  }

  queryRadiusWithStats(center: SpatialPoint, radius: number): SpatialQueryResult<T> {
    if (radius <= 0) {
      return {
        items: [],
        stats: {
          bucketsScanned: 0,
          candidatesScanned: 0
        }
      };
    }
    const minX = Math.floor((center.x - radius) / this.cellSize);
    const maxX = Math.floor((center.x + radius) / this.cellSize);
    const minY = Math.floor((center.y - radius) / this.cellSize);
    const maxY = Math.floor((center.y + radius) / this.cellSize);
    const result = new Set<T>();
    const squaredRadius = radius * radius;
    let bucketsScanned = 0;
    let candidatesScanned = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const key = bucketKey(x, y);
        const bucket = this.buckets.get(key);
        if (bucket === undefined) {
          continue;
        }
        bucketsScanned += 1;
        for (const item of bucket) {
          candidatesScanned += 1;
          const point = this.points.get(item);
          if (point === undefined) {
            continue;
          }
          const dx = point.x - center.x;
          const dy = point.y - center.y;
          if (dx * dx + dy * dy <= squaredRadius) {
            result.add(item);
          }
        }
      }
    }

    return {
      items: [...result],
      stats: {
        bucketsScanned,
        candidatesScanned
      }
    };
  }
}
