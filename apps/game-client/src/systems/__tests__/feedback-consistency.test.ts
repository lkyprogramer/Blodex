import type { CombatEvent } from "@blodex/core";
import { describe, expect, it } from "vitest";
import { FeedbackEventRouter, type FeedbackAction, type FeedbackRouterInput } from "../feedbackEventRouter";

interface OutcomeState {
  playerHp: number;
  monsterHp: number;
  log: string[];
}

function makeCombat(partial: Partial<CombatEvent>): CombatEvent {
  return {
    kind: "damage",
    sourceId: "player",
    targetId: "monster",
    amount: 10,
    damageType: "physical",
    timestampMs: 1000,
    ...(partial ?? {})
  };
}

function applyDomainOutcome(state: OutcomeState, input: FeedbackRouterInput): OutcomeState {
  if (input.type === "combat:hit") {
    if (input.combat.targetId === "player") {
      return {
        ...state,
        playerHp: Math.max(0, state.playerHp - input.combat.amount),
        log: [...state.log, `player-${input.combat.amount}`]
      };
    }
    if (input.combat.targetId === "monster") {
      return {
        ...state,
        monsterHp: Math.max(0, state.monsterHp - input.combat.amount),
        log: [...state.log, `monster-${input.combat.amount}`]
      };
    }
  }
  if (input.type === "combat:death") {
    if (input.combat.targetId === "player") {
      return {
        ...state,
        playerHp: 0,
        log: [...state.log, "player-death"]
      };
    }
    if (input.combat.targetId === "monster") {
      return {
        ...state,
        monsterHp: 0,
        log: [...state.log, "monster-death"]
      };
    }
  }
  return state;
}

function runScenario(feedbackEnabled: boolean): { state: OutcomeState; actions: FeedbackAction[] } {
  const initial: OutcomeState = {
    playerHp: 240,
    monsterHp: 180,
    log: []
  };
  const actions: FeedbackAction[] = [];
  const router = new FeedbackEventRouter((action) => {
    actions.push(action);
  });

  const inputs: FeedbackRouterInput[] = [
    {
      type: "run:start",
      biomeId: "forgotten_catacombs"
    },
    {
      type: "combat:hit",
      combat: makeCombat({
        targetId: "monster",
        amount: 28,
        kind: "crit"
      })
    },
    {
      type: "skill:use",
      skillId: "cleave",
      playerId: "player"
    },
    {
      type: "combat:hit",
      combat: makeCombat({
        sourceId: "monster",
        targetId: "player",
        amount: 16
      })
    },
    {
      type: "hazard:trigger",
      hazardType: "periodic_trap",
      position: { x: 10, y: 12 }
    },
    {
      type: "combat:death",
      combat: makeCombat({
        targetId: "monster",
        amount: 80
      })
    }
  ];

  let state = initial;
  for (const input of inputs) {
    if (feedbackEnabled) {
      router.route(input);
    }
    state = applyDomainOutcome(state, input);
  }

  return {
    state,
    actions
  };
}

describe("feedback consistency", () => {
  it("keeps combat outcome identical when feedback routing is enabled or disabled", () => {
    const withFeedback = runScenario(true);
    const withoutFeedback = runScenario(false);

    expect(withFeedback.state).toEqual(withoutFeedback.state);
    expect(withFeedback.actions.length).toBeGreaterThan(0);
    expect(withoutFeedback.actions).toHaveLength(0);
  });
});
