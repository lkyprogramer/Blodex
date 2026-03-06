import type { BiomeId, CombatEvent, ConsumableId, HazardType, WeaponType } from "@blodex/core";

export type FeedbackAction =
  | {
      channel: "sfx";
      cue: "combat_hit";
      critical: boolean;
      weaponType?: WeaponType;
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
      channel: "sfx";
      cue: "level_up";
      level: number;
    }
  | {
      channel: "sfx";
      cue: "rare_drop";
      rarity: "rare" | "unique";
    }
  | {
      channel: "sfx";
      cue: "build_formed";
    }
  | {
      channel: "sfx";
      cue: "boss_reward";
    }
  | {
      channel: "sfx";
      cue: "equipment_compare";
    }
  | {
      channel: "sfx";
      cue: "synergy_activated";
    }
  | {
      channel: "sfx";
      cue: "power_spike";
      major: boolean;
    }
  | {
      channel: "vfx";
      cue: "combat_hit";
      targetId: string;
      amount: number;
      critical: boolean;
      weaponType?: WeaponType;
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
    }
  | {
      channel: "vfx";
      cue: "level_up";
      playerId: string;
      level: number;
    }
  | {
      channel: "vfx";
      cue: "rare_drop";
      rarity: "rare" | "unique";
    }
  | {
      channel: "vfx";
      cue: "build_formed";
    }
  | {
      channel: "vfx";
      cue: "boss_reward";
    }
  | {
      channel: "vfx";
      cue: "synergy_activated";
    }
  | {
      channel: "vfx";
      cue: "power_spike";
      major: boolean;
    };

export type FeedbackRouterInput =
  | {
      type: "combat:hit";
      combat: CombatEvent;
      weaponType?: WeaponType;
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
    }
  | {
      type: "player:levelup";
      playerId: string;
      level: number;
    }
  | {
      type: "loot:rare_drop";
      rarity: "rare" | "unique";
    }
  | {
      type: "build:formed";
    }
  | {
      type: "boss:reward";
    }
  | {
      type: "equipment:compare";
    }
  | {
      type: "synergy:activated";
    }
  | {
      type: "power_spike";
      major: boolean;
    };

function unreachableFeedbackAction(action: never): never {
  throw new Error(`Unreachable feedback action branch: ${JSON.stringify(action)}`);
}

export function feedbackActionKey(action: FeedbackAction): string {
  if (action.channel === "sfx") {
    switch (action.cue) {
      case "combat_hit":
        return `sfx:${action.cue}:${action.critical ? "crit" : "normal"}:${action.weaponType ?? "none"}`;
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
      case "level_up":
        return `sfx:${action.cue}:${action.level}`;
      case "rare_drop":
        return `sfx:${action.cue}:${action.rarity}`;
      case "power_spike":
        return `sfx:${action.cue}:${action.major ? "major" : "minor"}`;
      default:
        return `sfx:${action.cue}`;
    }
  }

  switch (action.cue) {
    case "combat_hit":
      return `vfx:${action.cue}:${action.targetId}:${action.amount}:${action.critical ? "crit" : "normal"}:${action.weaponType ?? "none"}`;
    case "combat_dodge":
    case "combat_death":
      return `vfx:${action.cue}:${action.targetId}`;
    case "skill_cast":
      return `vfx:${action.cue}:${action.casterId}:${action.skillId}`;
    case "boss_phase":
      return `vfx:${action.cue}:${action.bossId}`;
    case "hazard_trigger":
      return `vfx:${action.cue}:${action.hazardType}:${action.position.x},${action.position.y}`;
    case "level_up":
      return `vfx:${action.cue}:${action.playerId}:${action.level}`;
    case "rare_drop":
      return `vfx:${action.cue}:${action.rarity}`;
    case "power_spike":
      return `vfx:${action.cue}:${action.major ? "major" : "minor"}`;
    case "build_formed":
    case "boss_reward":
    case "synergy_activated":
      return `vfx:${action.cue}`;
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
          critical: input.combat.kind === "crit",
          ...(input.weaponType === undefined ? {} : { weaponType: input.weaponType })
        },
        {
          channel: "vfx",
          cue: "combat_hit",
          targetId: input.combat.targetId,
          amount: input.combat.amount,
          critical: input.combat.kind === "crit",
          ...(input.weaponType === undefined ? {} : { weaponType: input.weaponType })
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
    case "player:levelup":
      return [
        {
          channel: "sfx",
          cue: "level_up",
          level: input.level
        },
        {
          channel: "vfx",
          cue: "level_up",
          playerId: input.playerId,
          level: input.level
        }
      ];
    case "loot:rare_drop":
      return [
        {
          channel: "sfx",
          cue: "rare_drop",
          rarity: input.rarity
        },
        {
          channel: "vfx",
          cue: "rare_drop",
          rarity: input.rarity
        }
      ];
    case "build:formed":
      return [
        {
          channel: "sfx",
          cue: "build_formed"
        },
        {
          channel: "vfx",
          cue: "build_formed"
        }
      ];
    case "boss:reward":
      return [
        {
          channel: "sfx",
          cue: "boss_reward"
        },
        {
          channel: "vfx",
          cue: "boss_reward"
        }
      ];
    case "equipment:compare":
      return [
        {
          channel: "sfx",
          cue: "equipment_compare"
        }
      ];
    case "synergy:activated":
      return [
        {
          channel: "sfx",
          cue: "synergy_activated"
        },
        {
          channel: "vfx",
          cue: "synergy_activated"
        }
      ];
    case "power_spike":
      return [
        {
          channel: "sfx",
          cue: "power_spike",
          major: input.major
        },
        {
          channel: "vfx",
          cue: "power_spike",
          major: input.major
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
