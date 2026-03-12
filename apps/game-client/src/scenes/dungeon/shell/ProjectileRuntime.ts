import type { ProjectileSpriteHandle } from "../../../systems/RenderSystem";

export interface CompletedProjectileImpact {
  projectileId: string;
  sourceId: string;
  targetId: string;
  position: { x: number; y: number };
  withinHitRadius: boolean;
  timestampMs: number;
}

interface ActiveProjectile {
  projectileId: string;
  floor: number;
  sourceId: string;
  targetId: string;
  position: { x: number; y: number };
  targetPosition: { x: number; y: number };
  direction: { x: number; y: number };
  remainingDistance: number;
  speedTilesPerSecond: number;
  hitRadiusTiles: number;
  sprite: ProjectileSpriteHandle;
}

export interface ProjectileRuntimeHost {
  renderSystem: {
    spawnProjectile(
      position: { x: number; y: number },
      origin: { x: number; y: number },
      options?: { tint?: number; width?: number; height?: number }
    ): ProjectileSpriteHandle;
    syncProjectileSprite(
      sprite: ProjectileSpriteHandle,
      position: { x: number; y: number },
      origin: { x: number; y: number }
    ): void;
  };
  origin: { x: number; y: number };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeDirection(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const length = Math.max(0.001, distance(from, to));
  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length
  };
}

export class ProjectileRuntime {
  private readonly activeProjectiles: ActiveProjectile[] = [];
  private readonly completedImpacts: CompletedProjectileImpact[] = [];
  private nextProjectileId = 1;

  constructor(private readonly resolveHost: () => ProjectileRuntimeHost) {}

  private get host(): ProjectileRuntimeHost {
    return this.resolveHost();
  }

  spawn(input: {
    floor: number;
    sourceId: string;
    targetId: string;
    sourcePosition: { x: number; y: number };
    targetPosition: { x: number; y: number };
    speedTilesPerSecond: number;
    hitRadiusTiles: number;
    tint?: number;
    width?: number;
    height?: number;
  }): string {
    const projectileId = `monster-projectile-${this.nextProjectileId}`;
    this.nextProjectileId += 1;

    const sprite = this.host.renderSystem.spawnProjectile(
      input.sourcePosition,
      this.host.origin,
      {
        ...(input.tint === undefined ? {} : { tint: input.tint }),
        ...(input.width === undefined ? {} : { width: input.width }),
        ...(input.height === undefined ? {} : { height: input.height })
      }
    );
    this.host.renderSystem.syncProjectileSprite(sprite, input.sourcePosition, this.host.origin);

    this.activeProjectiles.push({
      projectileId,
      floor: input.floor,
      sourceId: input.sourceId,
      targetId: input.targetId,
      position: { ...input.sourcePosition },
      targetPosition: { ...input.targetPosition },
      direction: normalizeDirection(input.sourcePosition, input.targetPosition),
      remainingDistance: distance(input.sourcePosition, input.targetPosition),
      speedTilesPerSecond: Math.max(1, input.speedTilesPerSecond),
      hitRadiusTiles: Math.max(0.25, input.hitRadiusTiles),
      sprite
    });

    return projectileId;
  }

  update(args: {
    deltaSeconds: number;
    nowMs: number;
    floor: number;
    playerPosition: { x: number; y: number };
  }): Array<{
    projectileId: string;
    sourceId: string;
    targetId: string;
    position: { x: number; y: number };
    reason: "floor_reset";
    timestampMs: number;
  }> {
    const floorResetMisses: Array<{
      projectileId: string;
      sourceId: string;
      targetId: string;
      position: { x: number; y: number };
      reason: "floor_reset";
      timestampMs: number;
    }> = [];
    const remaining: ActiveProjectile[] = [];

    for (const projectile of this.activeProjectiles) {
      if (projectile.floor !== args.floor) {
        projectile.sprite.destroy();
        floorResetMisses.push({
          projectileId: projectile.projectileId,
          sourceId: projectile.sourceId,
          targetId: projectile.targetId,
          position: { ...projectile.position },
          reason: "floor_reset",
          timestampMs: args.nowMs
        });
        continue;
      }

      const travelDistance = Math.min(
        projectile.remainingDistance,
        Math.max(0, projectile.speedTilesPerSecond * Math.max(0, args.deltaSeconds))
      );
      projectile.position = {
        x: projectile.position.x + projectile.direction.x * travelDistance,
        y: projectile.position.y + projectile.direction.y * travelDistance
      };
      projectile.remainingDistance = Math.max(0, projectile.remainingDistance - travelDistance);
      this.host.renderSystem.syncProjectileSprite(projectile.sprite, projectile.position, this.host.origin);

      if (projectile.remainingDistance > 0.001) {
        remaining.push(projectile);
        continue;
      }

      projectile.sprite.destroy();
      this.completedImpacts.push({
        projectileId: projectile.projectileId,
        sourceId: projectile.sourceId,
        targetId: projectile.targetId,
        position: { ...projectile.targetPosition },
        withinHitRadius: distance(args.playerPosition, projectile.targetPosition) <= projectile.hitRadiusTiles,
        timestampMs: args.nowMs
      });
    }

    this.activeProjectiles.length = 0;
    this.activeProjectiles.push(...remaining);
    return floorResetMisses;
  }

  drainCompletedImpacts(): CompletedProjectileImpact[] {
    if (this.completedImpacts.length === 0) {
      return [];
    }
    const impacts = [...this.completedImpacts];
    this.completedImpacts.length = 0;
    return impacts;
  }

  clear(): void {
    for (const projectile of this.activeProjectiles) {
      projectile.sprite.destroy();
    }
    this.activeProjectiles.length = 0;
    this.completedImpacts.length = 0;
  }

  getActiveCount(): number {
    return this.activeProjectiles.length;
  }
}
