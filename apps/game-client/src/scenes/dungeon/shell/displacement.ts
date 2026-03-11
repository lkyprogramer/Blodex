export interface GridDirection {
  x: number;
  y: number;
}

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
    x: Math.round(options.from.x),
    y: Math.round(options.from.y)
  };
  let traveledCells = 0;
  let blocked = false;
  let blockedAtFirstCell = false;

  for (let step = 1; step <= requestedDistance; step += 1) {
    const candidate = {
      x: Math.round(options.from.x + normalized.x * step),
      y: Math.round(options.from.y + normalized.y * step)
    };
    if (candidate.x === currentTile.x && candidate.y === currentTile.y) {
      continue;
    }
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
