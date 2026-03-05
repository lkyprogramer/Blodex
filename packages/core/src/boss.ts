import type {
  BossAttack,
  BossDef,
  BossRuntimeState,
  CombatEvent,
  PlayerState,
  RngLike
} from "./contracts/types";
import {
  clampSpecialAffixTotals,
  createEmptySpecialAffixTotals,
  type SpecialAffixTotals
} from "./specialAffix";

export interface BossAttackResolution {
  player: PlayerState;
  events: CombatEvent[];
  summonCount?: number;
}

export function initBossState(boss: BossDef, position: { x: number; y: number }): BossRuntimeState {
  return {
    bossId: boss.id,
    currentPhaseIndex: 0,
    health: boss.baseHealth,
    maxHealth: boss.baseHealth,
    attackCooldowns: {},
    position: { ...position },
    aiState: "idle"
  };
}

export function updateBossPhase(state: BossRuntimeState, boss: BossDef): BossRuntimeState {
  const hpRatio = state.maxHealth <= 0 ? 0 : state.health / state.maxHealth;

  let nextPhase = state.currentPhaseIndex;
  for (let i = 0; i < boss.phases.length; i += 1) {
    if (hpRatio <= boss.phases[i]!.hpThreshold) {
      nextPhase = i;
    }
  }

  if (nextPhase === state.currentPhaseIndex) {
    return state;
  }

  return {
    ...state,
    currentPhaseIndex: nextPhase
  };
}

export function selectBossAttack(
  state: BossRuntimeState,
  boss: BossDef,
  nowMs: number,
  rng: RngLike
): BossAttack | null {
  if (state.health <= 0) {
    return null;
  }

  const phase = boss.phases[state.currentPhaseIndex] ?? boss.phases[boss.phases.length - 1];
  if (phase === undefined || phase.attackPattern.length === 0) {
    return null;
  }

  const ready = phase.attackPattern.filter((attack) => {
    const readyAt = state.attackCooldowns[attack.id] ?? 0;
    return nowMs >= readyAt;
  });

  if (ready.length === 0) {
    return null;
  }

  return ready[rng.nextInt(0, ready.length - 1)] ?? null;
}

export function markBossAttackUsed(
  state: BossRuntimeState,
  attack: BossAttack,
  nowMs: number
): BossRuntimeState {
  return {
    ...state,
    attackCooldowns: {
      ...state.attackCooldowns,
      [attack.id]: nowMs + attack.cooldownMs
    }
  };
}

export function resolveBossAttack(
  attack: BossAttack,
  boss: BossRuntimeState,
  player: PlayerState,
  rng: RngLike,
  nowMs: number,
  target?: { x: number; y: number },
  specialAffixTotals?: Partial<SpecialAffixTotals>
): BossAttackResolution {
  if (attack.type === "summon") {
    return {
      player,
      events: [],
      summonCount: 2
    };
  }

  const strikeTarget = target ?? boss.position;
  const castDistance = Math.hypot(
    boss.position.x - strikeTarget.x,
    boss.position.y - strikeTarget.y
  );
  if (attack.type === "aoe_zone" && castDistance > attack.range) {
    return {
      player,
      events: []
    };
  }

  const distanceToPlayer = Math.hypot(
    (attack.type === "aoe_zone" ? strikeTarget.x : boss.position.x) - player.position.x,
    (attack.type === "aoe_zone" ? strikeTarget.y : boss.position.y) - player.position.y
  );
  const hitRange = attack.type === "aoe_zone" ? attack.radius ?? 1.15 : attack.range;
  if (distanceToPlayer > hitRange) {
    return {
      player,
      events: []
    };
  }

  const totals = clampSpecialAffixTotals(
    specialAffixTotals ?? createEmptySpecialAffixTotals()
  );
  const dodgeChance = Math.min(0.75, Math.max(0, totals.dodgeChance));
  if (rng.next() < dodgeChance) {
    return {
      player,
      events: [
        {
          kind: "dodge",
          sourceId: boss.bossId,
          targetId: player.id,
          amount: 0,
          damageType: "physical",
          timestampMs: nowMs
        }
      ]
    };
  }

  const mitigated = Math.max(1, Math.floor(attack.damage - player.derivedStats.armor * 0.1));
  const nextHealth = Math.max(0, player.health - mitigated);
  const events: CombatEvent[] = [
    {
      kind: "damage",
      sourceId: boss.bossId,
      targetId: player.id,
      amount: mitigated,
      damageType: "physical",
      timestampMs: nowMs
    }
  ];

  if (nextHealth === 0) {
    events.push({
      kind: "death",
      sourceId: boss.bossId,
      targetId: player.id,
      amount: mitigated,
      damageType: "physical",
      timestampMs: nowMs
    });
  }

  return {
    player: {
      ...player,
      health: nextHealth
    },
    events
  };
}

export function applyDamageToBoss(state: BossRuntimeState, damage: number): BossRuntimeState {
  const health = Math.max(0, state.health - Math.max(1, Math.floor(damage)));
  return {
    ...state,
    health,
    aiState: health <= 0 ? "dead" : state.aiState
  };
}
