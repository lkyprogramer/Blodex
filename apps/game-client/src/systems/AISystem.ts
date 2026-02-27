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

export class AISystem {
  private moveToward(monster: MonsterRuntime, target: { x: number; y: number }, dt: number, multiplier = 1): void {
    const dx = target.x - monster.state.position.x;
    const dy = target.y - monster.state.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001) {
      return;
    }
    const speed = (monster.state.moveSpeed / 130) * dt * Math.max(0, multiplier);
    const step = Math.min(dist, speed);
    monster.state.position.x += (dx / dist) * step;
    monster.state.position.y += (dy / dist) * step;
  }

  private moveAway(monster: MonsterRuntime, from: { x: number; y: number }, dt: number, multiplier = 1): void {
    const dx = monster.state.position.x - from.x;
    const dy = monster.state.position.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001) {
      return;
    }
    const speed = (monster.state.moveSpeed / 130) * dt * Math.max(0, multiplier);
    const step = Math.min(dist, speed);
    monster.state.position.x += (dx / dist) * step;
    monster.state.position.y += (dy / dist) * step;
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
      const distance = Math.hypot(
        candidate.state.position.x - monster.state.position.x,
        candidate.state.position.y - monster.state.position.y
      );
      if (distance <= supportRange && distance < bestDistance) {
        bestDistance = distance;
        picked = candidate;
      }
    }

    return picked;
  }

  updateMonsters(
    monsters: MonsterRuntime[],
    player: PlayerState,
    dt: number,
    nowMs: number
  ): MonsterAiUpdateResult {
    const transitions: MonsterStateTransition[] = [];
    const supportActions: MonsterSupportAction[] = [];

    for (const monster of monsters) {
      if (monster.state.health <= 0) {
        continue;
      }

      const dx = player.position.x - monster.state.position.x;
      const dy = player.position.y - monster.state.position.y;
      const dist = Math.hypot(dx, dy);
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
            this.moveAway(monster, player.position, dt, 1.08);
          } else if (dist <= chaseRange) {
            monster.state.aiState = "chase";
            this.moveToward(monster, player.position, dt, 0.94);
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
            this.moveToward(monster, player.position, dt, 1.18);
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
              return (
                Math.hypot(
                  candidate.state.position.x - monster.state.position.x,
                  candidate.state.position.y - monster.state.position.y
                ) <= swarmRadius
              );
            }).length;
            monster.state.aiState = "swarm";
            this.moveToward(monster, player.position, dt, 1 + Math.min(0.35, nearbyAllies * 0.08));
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
              this.moveAway(monster, player.position, dt, 0.32);
            } else {
              this.moveToward(monster, player.position, dt);
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
            const allyDistance = Math.hypot(
              ally.state.position.x - monster.state.position.x,
              ally.state.position.y - monster.state.position.y
            );
            if (allyDistance > 1.25) {
              this.moveToward(monster, ally.state.position, dt, 0.9);
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
            this.moveAway(monster, player.position, dt, 0.68);
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
            this.moveToward(monster, player.position, dt);
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
