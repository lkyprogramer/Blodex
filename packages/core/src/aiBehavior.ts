import type { MonsterAiBehavior, MonsterState } from "./contracts/types";

export interface AiDecisionContext {
  behavior: MonsterAiBehavior;
  distance: number;
  attackRange: number;
  chaseRange: number;
  preferredDistance?: number;
  ambushRadius?: number;
  supportRange?: number;
}

export function resolveAiStateForDistance(context: AiDecisionContext): MonsterState["aiState"] {
  const meleeReach = context.attackRange + 0.2;
  if (context.distance <= meleeReach) {
    return "attack";
  }

  switch (context.behavior) {
    case "kite": {
      const preferred = context.preferredDistance ?? Math.max(context.attackRange + 1, 3);
      if (context.distance < preferred * 0.72) {
        return "kite";
      }
      if (context.distance <= context.chaseRange) {
        return "chase";
      }
      return "idle";
    }
    case "ambush": {
      const ambushRadius = context.ambushRadius ?? Math.max(context.attackRange + 1.5, 2.8);
      if (context.distance > ambushRadius) {
        return "ambush";
      }
      return context.distance <= context.chaseRange ? "chase" : "idle";
    }
    case "support": {
      const supportRange = context.supportRange ?? context.chaseRange;
      return context.distance <= supportRange ? "support" : "idle";
    }
    case "swarm":
      return context.distance <= context.chaseRange ? "swarm" : "idle";
    case "shield":
      return context.distance <= context.chaseRange ? "shield" : "idle";
    case "chase":
    default:
      return context.distance <= context.chaseRange ? "chase" : "idle";
  }
}

