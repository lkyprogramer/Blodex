import type { PlayerState } from "@blodex/core";
import type { MonsterRuntime } from "./EntityManager";

export interface MonsterStateTransition {
  monsterId: string;
  from: MonsterRuntime["state"]["aiState"];
  to: MonsterRuntime["state"]["aiState"];
  timestampMs: number;
}

export interface MonsterSupportAction {
  sourceMonsterId: string;
  targetMonsterId: string;
  amount: number;
  timestampMs: number;
}

export interface MonsterAiUpdateResult {
  transitions: MonsterStateTransition[];
  supportActions: MonsterSupportAction[];
}

export interface MonsterAiNavigationOptions {
  canMoveTo?: (position: { x: number; y: number }, monster: MonsterRuntime) => boolean;
  stuckFramesBeforeRecovery?: number;
}

type MovementMode = "toward" | "away";

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class AISystem {
  private readonly stuckFramesByMonsterId = new Map<string, number>();

  private isWalkable(
    monster: MonsterRuntime,
    position: { x: number; y: number },
    navigation: MonsterAiNavigationOptions
  ): boolean {
    if (navigation.canMoveTo === undefined) {
      return true;
    }
    return navigation.canMoveTo(position, monster);
  }

  private scoreCandidate(
    candidate: { x: number; y: number },
    target: { x: number; y: number },
    mode: MovementMode
  ): number {
    const dist = distance(candidate, target);
    return mode === "toward" ? dist : -dist;
  }

  private resolveNavigablePosition(
    monster: MonsterRuntime,
    target: { x: number; y: number },
    proposed: { x: number; y: number },
    step: number,
    angle: number,
    mode: MovementMode,
    navigation: MonsterAiNavigationOptions
  ): { x: number; y: number } {
    if (this.isWalkable(monster, proposed, navigation)) {
      return proposed;
    }

    const current = monster.state.position;
    const candidates: Array<{ x: number; y: number }> = [
      { x: proposed.x, y: current.y },
      { x: current.x, y: proposed.y }
    ];
    const angleOffsets = [
      Math.PI / 4,
      -Math.PI / 4,
      Math.PI / 2,
      -Math.PI / 2,
      (Math.PI * 3) / 4,
      (-Math.PI * 3) / 4,
      Math.PI,
      -Math.PI
    ];
    for (const offset of angleOffsets) {
      candidates.push({
        x: current.x + Math.cos(angle + offset) * step,
        y: current.y + Math.sin(angle + offset) * step
      });
    }

    let picked: { x: number; y: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (!this.isWalkable(monster, candidate, navigation)) {
        continue;
      }
      const score = this.scoreCandidate(candidate, target, mode);
      if (score < bestScore) {
        bestScore = score;
        picked = candidate;
      }
    }

    return picked ?? { x: current.x, y: current.y };
  }

  private resolveRecoveryPosition(
    monster: MonsterRuntime,
    target: { x: number; y: number },
    step: number,
    mode: MovementMode,
    navigation: MonsterAiNavigationOptions
  ): { x: number; y: number } | undefined {
    const current = monster.state.position;
    const radius = Math.max(0.45, step * 1.25);
    let picked: { x: number; y: number } | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const candidate = {
        x: current.x + Math.cos(angle) * radius,
        y: current.y + Math.sin(angle) * radius
      };
      if (!this.isWalkable(monster, candidate, navigation)) {
        continue;
      }
      const score = this.scoreCandidate(candidate, target, mode);
      if (score < bestScore) {
        bestScore = score;
        picked = candidate;
      }
    }

    return picked;
  }

  private trackStuckAndRecover(
    monster: MonsterRuntime,
    target: { x: number; y: number },
    movedDistance: number,
    step: number,
    mode: MovementMode,
    navigation: MonsterAiNavigationOptions
  ): void {
    if (navigation.canMoveTo === undefined) {
      this.stuckFramesByMonsterId.delete(monster.state.id);
      return;
    }

    const minimumMoved = Math.max(0.02, step * 0.2);
    if (movedDistance >= minimumMoved || step < 0.05) {
      this.stuckFramesByMonsterId.delete(monster.state.id);
      return;
    }

    const nextStuckFrames = (this.stuckFramesByMonsterId.get(monster.state.id) ?? 0) + 1;
    const recoveryThreshold = Math.max(2, navigation.stuckFramesBeforeRecovery ?? 3);
    if (nextStuckFrames < recoveryThreshold) {
      this.stuckFramesByMonsterId.set(monster.state.id, nextStuckFrames);
      return;
    }

    const recoveryPosition = this.resolveRecoveryPosition(
      monster,
      target,
      step,
      mode,
      navigation
    );
    if (recoveryPosition !== undefined) {
      monster.state.position.x = recoveryPosition.x;
      monster.state.position.y = recoveryPosition.y;
    }
    this.stuckFramesByMonsterId.delete(monster.state.id);
  }

  private moveToward(
    monster: MonsterRuntime,
    target: { x: number; y: number },
    dt: number,
    navigation: MonsterAiNavigationOptions,
    multiplier = 1
  ): void {
    const current = monster.state.position;
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001) {
      return;
    }

    const speed = (monster.state.moveSpeed / 130) * dt * Math.max(0, multiplier);
    const step = Math.min(dist, speed);
    const angle = Math.atan2(dy, dx);
    const proposed = {
      x: current.x + (dx / dist) * step,
      y: current.y + (dy / dist) * step
    };
    const next = this.resolveNavigablePosition(monster, target, proposed, step, angle, "toward", navigation);
    const movedDistance = distance(current, next);
    monster.state.position.x = next.x;
    monster.state.position.y = next.y;
    this.trackStuckAndRecover(monster, target, movedDistance, step, "toward", navigation);
  }

  private moveAway(
    monster: MonsterRuntime,
    from: { x: number; y: number },
    dt: number,
    navigation: MonsterAiNavigationOptions,
    multiplier = 1
  ): void {
    const current = monster.state.position;
    const dx = current.x - from.x;
    const dy = current.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001) {
      return;
    }

    const speed = (monster.state.moveSpeed / 130) * dt * Math.max(0, multiplier);
    const step = Math.min(dist, speed);
    const angle = Math.atan2(dy, dx);
    const proposed = {
      x: current.x + (dx / dist) * step,
      y: current.y + (dy / dist) * step
    };
    const next = this.resolveNavigablePosition(monster, from, proposed, step, angle, "away", navigation);
    const movedDistance = distance(current, next);
    monster.state.position.x = next.x;
    monster.state.position.y = next.y;
    this.trackStuckAndRecover(monster, from, movedDistance, step, "away", navigation);
  }

  private closestAllyNeedingHeal(monster: MonsterRuntime, monsters: MonsterRuntime[]): MonsterRuntime | null {
    const healThreshold = monster.archetype.aiConfig.healThreshold ?? 0.65;
    const supportRange = monster.archetype.aiConfig.supportRange ?? 5;
    let picked: MonsterRuntime | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of monsters) {
      if (candidate.state.id === monster.state.id || candidate.state.health <= 0) {
        continue;
      }
      const ratio = candidate.state.health / Math.max(1, candidate.state.maxHealth);
      if (ratio > healThreshold) {
        continue;
      }
      const allyDistance = distance(candidate.state.position, monster.state.position);
      if (allyDistance <= supportRange && allyDistance < bestDistance) {
        bestDistance = allyDistance;
        picked = candidate;
      }
    }

    return picked;
  }

  updateMonsters(
    monsters: MonsterRuntime[],
    player: PlayerState,
    dt: number,
    nowMs: number,
    navigation: MonsterAiNavigationOptions = {}
  ): MonsterAiUpdateResult {
    const transitions: MonsterStateTransition[] = [];
    const supportActions: MonsterSupportAction[] = [];

    for (const monster of monsters) {
      if (monster.state.health <= 0) {
        this.stuckFramesByMonsterId.delete(monster.state.id);
        continue;
      }

      const dist = distance(player.position, monster.state.position);
      const previous = monster.state.aiState;
      const behavior = monster.state.aiBehavior ?? monster.archetype.aiConfig.behavior ?? "chase";
      const chaseRange = monster.archetype.aiConfig.chaseRange;
      const inAttackRange = dist <= monster.state.attackRange + 0.2;

      switch (behavior) {
        case "kite": {
          const preferredDistance = monster.archetype.aiConfig.preferredDistance ?? Math.max(3, monster.state.attackRange + 2);
          if (inAttackRange) {
            monster.state.aiState = "attack";
          } else if (dist < preferredDistance * 0.72) {
            monster.state.aiState = "kite";
            this.moveAway(monster, player.position, dt, navigation, 1.08);
          } else if (dist <= chaseRange) {
            monster.state.aiState = "chase";
            this.moveToward(monster, player.position, dt, navigation, 0.94);
          } else {
            monster.state.aiState = "idle";
          }
          break;
        }
        case "ambush": {
          const ambushRadius = monster.archetype.aiConfig.ambushRadius ?? Math.max(2.8, monster.state.attackRange + 1.8);
          if (inAttackRange) {
            monster.state.aiState = "attack";
          } else if (dist <= ambushRadius) {
            monster.state.aiState = "chase";
            this.moveToward(monster, player.position, dt, navigation, 1.18);
          } else {
            monster.state.aiState = "ambush";
          }
          break;
        }
        case "swarm": {
          if (inAttackRange) {
            monster.state.aiState = "attack";
            break;
          }
          if (dist <= chaseRange) {
            const swarmRadius = monster.archetype.aiConfig.swarmRadius ?? 2.8;
            const nearbyAllies = monsters.filter((candidate) => {
              if (candidate.state.id === monster.state.id || candidate.state.health <= 0) {
                return false;
              }
              return distance(candidate.state.position, monster.state.position) <= swarmRadius;
            }).length;
            monster.state.aiState = "swarm";
            this.moveToward(monster, player.position, dt, navigation, 1 + Math.min(0.35, nearbyAllies * 0.08));
          } else {
            monster.state.aiState = "idle";
          }
          break;
        }
        case "shield": {
          const healthRatio = monster.state.health / Math.max(1, monster.state.maxHealth);
          const shieldThreshold = monster.archetype.aiConfig.shieldThreshold ?? 0.45;
          if (inAttackRange && healthRatio > shieldThreshold) {
            monster.state.aiState = "attack";
          } else if (dist <= chaseRange) {
            monster.state.aiState = healthRatio <= shieldThreshold ? "shield" : "chase";
            if (healthRatio <= shieldThreshold) {
              this.moveAway(monster, player.position, dt, navigation, 0.32);
            } else {
              this.moveToward(monster, player.position, dt, navigation);
            }
          } else {
            monster.state.aiState = "idle";
          }
          break;
        }
        case "support": {
          const ally = this.closestAllyNeedingHeal(monster, monsters);
          if (ally !== null) {
            monster.state.aiState = "support";
            const allyDistance = distance(ally.state.position, monster.state.position);
            if (allyDistance > 1.25) {
              this.moveToward(monster, ally.state.position, dt, navigation, 0.9);
            } else if (nowMs >= monster.nextSupportAt) {
              supportActions.push({
                sourceMonsterId: monster.state.id,
                targetMonsterId: ally.state.id,
                amount: Math.max(1, Math.floor(monster.archetype.aiConfig.healPower ?? 20)),
                timestampMs: nowMs
              });
              monster.nextSupportAt = nowMs + 2600;
            }
          } else if (inAttackRange) {
            monster.state.aiState = "attack";
          } else if (dist <= chaseRange) {
            monster.state.aiState = "support";
            this.moveAway(monster, player.position, dt, navigation, 0.68);
          } else {
            monster.state.aiState = "idle";
          }
          break;
        }
        case "chase":
        default: {
          if (inAttackRange) {
            monster.state.aiState = "attack";
          } else if (dist < chaseRange) {
            monster.state.aiState = "chase";
            this.moveToward(monster, player.position, dt, navigation);
          } else {
            monster.state.aiState = "idle";
          }
          break;
        }
      }

      if (previous !== monster.state.aiState) {
        transitions.push({
          monsterId: monster.state.id,
          from: previous,
          to: monster.state.aiState,
          timestampMs: nowMs
        });
      }
    }

    return {
      transitions,
      supportActions
    };
  }
}
