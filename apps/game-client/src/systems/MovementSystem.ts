import { findPath, type GridNode, type PlayerState } from "@blodex/core";

export interface MovementUpdateResult {
  player: PlayerState;
  path: GridNode[];
  moved: boolean;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}

export class MovementSystem {
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
    target: { x: number; y: number }
  ): GridNode[] {
    const start = {
      x: Math.round(playerPosition.x),
      y: Math.round(playerPosition.y)
    };
    const walkableTarget = this.clampToWalkable(walkable, dimensions, playerPosition, target);
    return findPath(walkable, start, walkableTarget).slice(1);
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
