import { findPath, type GridNode, type PlayerState } from "@blodex/core";

export interface MovementUpdateResult {
  player: PlayerState;
  path: GridNode[];
  moved: boolean;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}

export class MovementSystem {
  private readonly pathCache = new Map<
    string,
    {
      cachedAtMs: number;
      path: GridNode[];
    }
  >();
  private readonly pathCacheTtlMs = 700;
  private readonly maxPathCacheEntries = 120;
  private readonly maxExpandedNodesPerSearch = 2400;

  clearPathCache(): void {
    this.pathCache.clear();
  }

  clampToWalkable(
    walkable: boolean[][],
    dimensions: { width: number; height: number },
    playerPosition: { x: number; y: number },
    target: { x: number; y: number }
  ): GridNode {
    const clamped = {
      x: Math.max(0, Math.min(dimensions.width - 1, target.x)),
      y: Math.max(0, Math.min(dimensions.height - 1, target.y))
    };

    if (walkable[clamped.y]?.[clamped.x]) {
      return clamped;
    }

    let nearest = playerPosition;
    let nearestDist = Number.POSITIVE_INFINITY;

    for (let y = Math.max(0, clamped.y - 2); y <= Math.min(dimensions.height - 1, clamped.y + 2); y += 1) {
      for (let x = Math.max(0, clamped.x - 2); x <= Math.min(dimensions.width - 1, clamped.x + 2); x += 1) {
        if (!walkable[y]?.[x]) {
          continue;
        }

        const dist = Math.hypot(x - clamped.x, y - clamped.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = { x, y };
        }
      }
    }

    return {
      x: nearest.x,
      y: nearest.y
    };
  }

  computePathTo(
    walkable: boolean[][],
    dimensions: { width: number; height: number },
    playerPosition: { x: number; y: number },
    target: { x: number; y: number },
    options?: {
      cacheScope?: string;
      nowMs?: number;
    }
  ): GridNode[] {
    const start = {
      x: Math.round(playerPosition.x),
      y: Math.round(playerPosition.y)
    };
    const walkableTarget = this.clampToWalkable(walkable, dimensions, playerPosition, target);
    const nowMs = options?.nowMs ?? 0;
    const cacheScope = options?.cacheScope ?? "default";
    const cacheKey = `${cacheScope}:${start.x},${start.y}->${walkableTarget.x},${walkableTarget.y}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached !== undefined && nowMs - cached.cachedAtMs <= this.pathCacheTtlMs) {
      return cached.path.map((node) => ({ x: node.x, y: node.y }));
    }

    const computed = findPath(walkable, start, walkableTarget, {
      maxExpandedNodes: this.maxExpandedNodesPerSearch
    }).slice(1);
    this.pathCache.set(cacheKey, {
      cachedAtMs: nowMs,
      path: computed.map((node) => ({ x: node.x, y: node.y }))
    });
    if (this.pathCache.size > this.maxPathCacheEntries) {
      const oldestKey = this.pathCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.pathCache.delete(oldestKey);
      }
    }
    return computed;
  }

  updatePlayerMovement(player: PlayerState, path: GridNode[], dt: number): MovementUpdateResult {
    const next = path[0];
    if (next === undefined) {
      return {
        player,
        path,
        moved: false
      };
    }

    const speedCellsPerSec = player.derivedStats.moveSpeed / 130;
    const dx = next.x - player.position.x;
    const dy = next.y - player.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.02) {
      const rest = path.slice(1);
      const to = { x: next.x, y: next.y };
      return {
        player: {
          ...player,
          position: to
        },
        path: rest,
        moved: true,
        from: player.position,
        to
      };
    }

    const step = Math.min(dist, speedCellsPerSec * dt);
    const to = {
      x: player.position.x + (dx / dist) * step,
      y: player.position.y + (dy / dist) * step
    };

    return {
      player: {
        ...player,
        position: to
      },
      path,
      moved: true,
      from: player.position,
      to
    };
  }
}
