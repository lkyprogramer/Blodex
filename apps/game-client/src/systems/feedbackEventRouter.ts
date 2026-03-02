import type { BiomeId, CombatEvent, ConsumableId, HazardType } from "@blodex/core";

export type FeedbackAction =
  | {
      channel: "sfx";
      cue: "combat_hit";
      critical: boolean;
    }
  | {
      channel: "sfx";
      cue: "combat_dodge";
    }
  | {
      channel: "sfx";
      cue: "combat_death";
    }
  | {
      channel: "sfx";
      cue: "skill_use";
      skillId: string;
    }
  | {
      channel: "sfx";
      cue: "consumable_use";
      consumableId: ConsumableId;
    }
  | {
      channel: "sfx";
      cue: "event_spawn";
      eventId: string;
    }
  | {
      channel: "sfx";
      cue: "merchant_offer";
    }
  | {
      channel: "sfx";
      cue: "merchant_purchase";
    }
  | {
      channel: "sfx";
      cue: "merchant_fail";
    }
  | {
      channel: "sfx";
      cue: "floor_enter";
    }
  | {
      channel: "sfx";
      cue: "biome_enter";
    }
  | {
      channel: "sfx";
      cue: "ambient_biome";
      biomeId: BiomeId;
    }
  | {
      channel: "sfx";
      cue: "boss_phase";
    }
  | {
      channel: "sfx";
      cue: "hazard_trigger";
      hazardType: HazardType;
    }
  | {
      channel: "vfx";
      cue: "combat_hit";
      targetId: string;
      amount: number;
      critical: boolean;
    }
  | {
      channel: "vfx";
      cue: "combat_dodge";
      targetId: string;
    }
  | {
      channel: "vfx";
      cue: "combat_death";
      targetId: string;
    }
  | {
      channel: "vfx";
      cue: "skill_cast";
      casterId: string;
      skillId: string;
    }
  | {
      channel: "vfx";
      cue: "boss_phase";
      bossId: string;
    }
  | {
      channel: "vfx";
      cue: "hazard_trigger";
      hazardType: HazardType;
      position: { x: number; y: number };
    };

export type FeedbackRouterInput =
  | {
      type: "combat:hit";
      combat: CombatEvent;
    }
  | {
      type: "combat:dodge";
      combat: CombatEvent;
    }
  | {
      type: "combat:death";
      combat: CombatEvent;
    }
  | {
      type: "skill:use";
      skillId: string;
      playerId: string;
    }
  | {
      type: "consumable:use";
      consumableId: ConsumableId;
    }
  | {
      type: "event:spawn";
      eventId: string;
    }
  | {
      type: "merchant:offer";
    }
  | {
      type: "merchant:purchase";
    }
  | {
      type: "merchant:fail";
    }
  | {
      type: "run:start";
      biomeId: BiomeId;
    }
  | {
      type: "floor:enter";
      biomeId?: BiomeId;
    }
  | {
      type: "boss:phaseChange";
      bossId: string;
    }
  | {
      type: "hazard:trigger";
      hazardType: HazardType;
      position: { x: number; y: number };
    };

function unreachableFeedbackAction(action: never): never {
  throw new Error(`Unreachable feedback action branch: ${JSON.stringify(action)}`);
}

export function feedbackActionKey(action: FeedbackAction): string {
  if (action.channel === "sfx") {
    switch (action.cue) {
      case "combat_hit":
        return `sfx:${action.cue}:${action.critical ? "crit" : "normal"}`;
      case "skill_use":
        return `sfx:${action.cue}:${action.skillId}`;
      case "consumable_use":
        return `sfx:${action.cue}:${action.consumableId}`;
      case "event_spawn":
        return `sfx:${action.cue}:${action.eventId}`;
      case "ambient_biome":
        return `sfx:${action.cue}:${action.biomeId}`;
      case "hazard_trigger":
        return `sfx:${action.cue}:${action.hazardType}`;
      default:
        return `sfx:${action.cue}`;
    }
  }

  switch (action.cue) {
    case "combat_hit":
      return `vfx:${action.cue}:${action.targetId}:${action.amount}:${action.critical ? "crit" : "normal"}`;
    case "combat_dodge":
    case "combat_death":
      return `vfx:${action.cue}:${action.targetId}`;
    case "skill_cast":
      return `vfx:${action.cue}:${action.casterId}:${action.skillId}`;
    case "boss_phase":
      return `vfx:${action.cue}:${action.bossId}`;
    case "hazard_trigger":
      return `vfx:${action.cue}:${action.hazardType}:${action.position.x},${action.position.y}`;
    default:
      return unreachableFeedbackAction(action);
  }
}

export function collapseDuplicateActions(actions: readonly FeedbackAction[]): FeedbackAction[] {
  const seen = new Set<string>();
  const deduped: FeedbackAction[] = [];
  for (const action of actions) {
    const key = feedbackActionKey(action);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(action);
  }
  return deduped;
}

export function deriveFeedbackActions(input: FeedbackRouterInput): FeedbackAction[] {
  switch (input.type) {
    case "combat:hit":
      return [
        {
          channel: "sfx",
          cue: "combat_hit",
          critical: input.combat.kind === "crit"
        },
        {
          channel: "vfx",
          cue: "combat_hit",
          targetId: input.combat.targetId,
          amount: input.combat.amount,
          critical: input.combat.kind === "crit"
        }
      ];
    case "combat:dodge":
      return [
        {
          channel: "sfx",
          cue: "combat_dodge"
        },
        {
          channel: "vfx",
          cue: "combat_dodge",
          targetId: input.combat.targetId
        }
      ];
    case "combat:death":
      return [
        {
          channel: "sfx",
          cue: "combat_death"
        },
        {
          channel: "vfx",
          cue: "combat_death",
          targetId: input.combat.targetId
        }
      ];
    case "skill:use":
      return [
        {
          channel: "sfx",
          cue: "skill_use",
          skillId: input.skillId
        },
        {
          channel: "vfx",
          cue: "skill_cast",
          casterId: input.playerId,
          skillId: input.skillId
        }
      ];
    case "consumable:use":
      return [
        {
          channel: "sfx",
          cue: "consumable_use",
          consumableId: input.consumableId
        }
      ];
    case "event:spawn":
      return [
        {
          channel: "sfx",
          cue: "event_spawn",
          eventId: input.eventId
        }
      ];
    case "merchant:offer":
      return [{ channel: "sfx", cue: "merchant_offer" }];
    case "merchant:purchase":
      return [{ channel: "sfx", cue: "merchant_purchase" }];
    case "merchant:fail":
      return [{ channel: "sfx", cue: "merchant_fail" }];
    case "run:start":
      return [
        { channel: "sfx", cue: "floor_enter" },
        { channel: "sfx", cue: "biome_enter" },
        {
          channel: "sfx",
          cue: "ambient_biome",
          biomeId: input.biomeId
        }
      ];
    case "floor:enter":
      return [
        { channel: "sfx", cue: "floor_enter" },
        ...(input.biomeId === undefined
          ? []
          : [
              { channel: "sfx" as const, cue: "biome_enter" as const },
              {
                channel: "sfx" as const,
                cue: "ambient_biome" as const,
                biomeId: input.biomeId
              }
            ])
      ];
    case "boss:phaseChange":
      return [
        {
          channel: "sfx",
          cue: "boss_phase"
        },
        {
          channel: "vfx",
          cue: "boss_phase",
          bossId: input.bossId
        }
      ];
    case "hazard:trigger":
      return [
        {
          channel: "sfx",
          cue: "hazard_trigger",
          hazardType: input.hazardType
        },
        {
          channel: "vfx",
          cue: "hazard_trigger",
          hazardType: input.hazardType,
          position: input.position
        }
      ];
    default:
      return [];
  }
}

export interface FeedbackRouterErrorContext {
  input: FeedbackRouterInput;
  action: FeedbackAction;
  error: unknown;
}

export interface FeedbackEventRouterOptions {
  onDispatchError?: (context: FeedbackRouterErrorContext) => void;
}

export class FeedbackEventRouter {
  constructor(
    private readonly dispatchAction: (action: FeedbackAction) => void,
    private readonly options: FeedbackEventRouterOptions = {}
  ) {}

  route(input: FeedbackRouterInput): void {
    const actions = collapseDuplicateActions(deriveFeedbackActions(input));
    for (const action of actions) {
      try {
        this.dispatchAction(action);
      } catch (error) {
        this.options.onDispatchError?.({
          input,
          action,
          error
        });
      }
    }
  }
}
