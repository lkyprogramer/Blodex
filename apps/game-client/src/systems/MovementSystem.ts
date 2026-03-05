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
  private readonly targetClampSearchRadius = 6;
  private readonly playerFallbackSearchRadius = 3;

  clearPathCache(): void {
    this.pathCache.clear();
  }

  private findNearestWalkableInRings(
    walkable: boolean[][],
    dimensions: { width: number; height: number },
    center: { x: number; y: number },
    maxRadius: number
  ): GridNode | null {
    const anchor = {
      x: Math.max(0, Math.min(dimensions.width - 1, Math.round(center.x))),
      y: Math.max(0, Math.min(dimensions.height - 1, Math.round(center.y)))
    };
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      let nearest: GridNode | null = null;
      let nearestDist = Number.POSITIVE_INFINITY;
      const minX = Math.max(0, anchor.x - radius);
      const maxX = Math.min(dimensions.width - 1, anchor.x + radius);
      const minY = Math.max(0, anchor.y - radius);
      const maxY = Math.min(dimensions.height - 1, anchor.y + radius);

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const ringDistance = Math.max(Math.abs(x - anchor.x), Math.abs(y - anchor.y));
          if (ringDistance !== radius) {
            continue;
          }
          if (!walkable[y]?.[x]) {
            continue;
          }
          const dist = Math.hypot(x - anchor.x, y - anchor.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = { x, y };
          }
        }
      }
      if (nearest !== null) {
        return nearest;
      }
    }
    return null;
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

    const nearestToTarget = this.findNearestWalkableInRings(
      walkable,
      dimensions,
      clamped,
      this.targetClampSearchRadius
    );
    if (nearestToTarget !== null) {
      return nearestToTarget;
    }

    const nearestToPlayer = this.findNearestWalkableInRings(
      walkable,
      dimensions,
      playerPosition,
      this.playerFallbackSearchRadius
    );
    if (nearestToPlayer !== null) {
      return nearestToPlayer;
    }

    return {
      x: Math.max(0, Math.min(dimensions.width - 1, Math.round(playerPosition.x))),
      y: Math.max(0, Math.min(dimensions.height - 1, Math.round(playerPosition.y)))
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
