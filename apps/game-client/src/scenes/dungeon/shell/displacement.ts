export interface GridDirection {
  x: number;
  y: number;
}

const GRID_TRAVERSAL_EPSILON = 1e-9;

export interface DisplacementResolution {
  from: { x: number; y: number };
  to: { x: number; y: number };
  direction: GridDirection;
  traveledCells: number;
  blocked: boolean;
  blockedAtFirstCell: boolean;
}

export function normalizeDirection(direction: GridDirection): GridDirection | null {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude < 0.001) {
    return null;
  }
  return {
    x: direction.x / magnitude,
    y: direction.y / magnitude
  };
}

export function directionBetween(
  from: { x: number; y: number },
  to: { x: number; y: number }
): GridDirection | null {
  return normalizeDirection({
    x: to.x - from.x,
    y: to.y - from.y
  });
}

export function resolveStepDisplacement(options: {
  from: { x: number; y: number };
  direction: GridDirection;
  distance: number;
  walkable: boolean[][];
  width: number;
  height: number;
  stopBeforeTile?: { x: number; y: number };
}): DisplacementResolution | null {
  const normalized = normalizeDirection(options.direction);
  if (normalized === null) {
    return null;
  }

  const requestedDistance = Math.max(0, Math.floor(options.distance));
  const from = {
    x: options.from.x,
    y: options.from.y
  };
  let currentTile = {
    x: Math.floor(options.from.x),
    y: Math.floor(options.from.y)
  };
  let traveledCells = 0;
  let blocked = false;
  let blockedAtFirstCell = false;

  const stepX = normalized.x > GRID_TRAVERSAL_EPSILON ? 1 : normalized.x < -GRID_TRAVERSAL_EPSILON ? -1 : 0;
  const stepY = normalized.y > GRID_TRAVERSAL_EPSILON ? 1 : normalized.y < -GRID_TRAVERSAL_EPSILON ? -1 : 0;
  const tDeltaX = stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / normalized.x);
  const tDeltaY = stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / normalized.y);
  let tMaxX =
    stepX === 0
      ? Number.POSITIVE_INFINITY
      : ((stepX > 0 ? Math.floor(options.from.x) + 1 : Math.floor(options.from.x)) - options.from.x) /
        normalized.x;
  let tMaxY =
    stepY === 0
      ? Number.POSITIVE_INFINITY
      : ((stepY > 0 ? Math.floor(options.from.y) + 1 : Math.floor(options.from.y)) - options.from.y) /
        normalized.y;

  while (traveledCells < requestedDistance) {
    const nextBoundaryT = Math.min(tMaxX, tMaxY);
    if (!Number.isFinite(nextBoundaryT) || nextBoundaryT > requestedDistance + GRID_TRAVERSAL_EPSILON) {
      break;
    }
    const crossesX = Math.abs(nextBoundaryT - tMaxX) <= GRID_TRAVERSAL_EPSILON;
    const crossesY = Math.abs(nextBoundaryT - tMaxY) <= GRID_TRAVERSAL_EPSILON;
    const candidate = {
      x: currentTile.x + (crossesX ? stepX : 0),
      y: currentTile.y + (crossesY ? stepY : 0)
    };

    if (
      options.stopBeforeTile !== undefined &&
      candidate.x === options.stopBeforeTile.x &&
      candidate.y === options.stopBeforeTile.y
    ) {
      blocked = true;
      blockedAtFirstCell = traveledCells === 0;
      break;
    }
    const inBounds =
      candidate.x >= 0 &&
      candidate.x < options.width &&
      candidate.y >= 0 &&
      candidate.y < options.height;
    if (!inBounds || !options.walkable[candidate.y]?.[candidate.x]) {
      blocked = true;
      blockedAtFirstCell = traveledCells === 0;
      break;
    }
    currentTile = candidate;
    traveledCells += 1;
    if (crossesX) {
      tMaxX += tDeltaX;
    }
    if (crossesY) {
      tMaxY += tDeltaY;
    }
  }

  return {
    from,
    to: {
      x: currentTile.x,
      y: currentTile.y
    },
    direction: normalized,
    traveledCells,
    blocked,
    blockedAtFirstCell
  };
}
