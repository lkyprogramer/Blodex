import type { CombatEvent } from "@blodex/core";
import { describe, expect, it, vi } from "vitest";
import {
  collapseDuplicateActions,
  deriveFeedbackActions,
  FeedbackEventRouter,
  type FeedbackAction
} from "../feedbackEventRouter";

function makeCombatEvent(partial?: Partial<CombatEvent>): CombatEvent {
  return {
    kind: "damage",
    sourceId: "player",
    targetId: "monster-a",
    amount: 12,
    damageType: "physical",
    timestampMs: 1000,
    ...(partial ?? {})
  };
}

describe("feedbackEventRouter", () => {
  it("maps combat:hit to both sfx and vfx channels", () => {
    const actions = deriveFeedbackActions({
      type: "combat:hit",
      combat: makeCombatEvent({ kind: "crit" }),
      weaponType: "dagger"
    });

    expect(actions).toEqual([
      {
        channel: "sfx",
        cue: "combat_hit",
        critical: true,
        weaponType: "dagger"
      },
      {
        channel: "vfx",
        cue: "combat_hit",
        targetId: "monster-a",
        amount: 12,
        critical: true,
        weaponType: "dagger"
      }
    ]);
  });

  it("maps player:levelup to sfx and vfx channels", () => {
    const actions = deriveFeedbackActions({
      type: "player:levelup",
      playerId: "player",
      level: 8
    });

    expect(actions).toEqual([
      {
        channel: "sfx",
        cue: "level_up",
        level: 8
      },
      {
        channel: "vfx",
        cue: "level_up",
        playerId: "player",
        level: 8
      }
    ]);
  });

  it("maps heartbeat cues to dedicated channels", () => {
    expect(
      deriveFeedbackActions({
        type: "loot:rare_drop",
        rarity: "rare"
      })
    ).toEqual([
      {
        channel: "sfx",
        cue: "rare_drop",
        rarity: "rare"
      },
      {
        channel: "vfx",
        cue: "rare_drop",
        rarity: "rare"
      }
    ]);

    expect(
      deriveFeedbackActions({
        type: "loot:rare_drop",
        rarity: "unique"
      })
    ).toEqual([
      {
        channel: "sfx",
        cue: "rare_drop",
        rarity: "unique"
      },
      {
        channel: "vfx",
        cue: "rare_drop",
        rarity: "unique"
      }
    ]);

    expect(
      deriveFeedbackActions({
        type: "equipment:compare"
      })
    ).toEqual([
      {
        channel: "sfx",
        cue: "equipment_compare"
      }
    ]);
  });

  it("deduplicates equivalent feedback actions", () => {
    const duplicateAction: FeedbackAction = {
      channel: "sfx",
      cue: "merchant_offer"
    };
    const deduped = collapseDuplicateActions([
      duplicateAction,
      { ...duplicateAction },
      { channel: "sfx", cue: "merchant_fail" }
    ]);

    expect(deduped).toEqual([
      { channel: "sfx", cue: "merchant_offer" },
      { channel: "sfx", cue: "merchant_fail" }
    ]);
  });

  it("swallows dispatch failures and continues the remaining actions", () => {
    const dispatched: FeedbackAction[] = [];
    const onDispatchError = vi.fn();
    const router = new FeedbackEventRouter(
      (action) => {
        if (action.channel === "sfx") {
          throw new Error("boom");
        }
        dispatched.push(action);
      },
      { onDispatchError }
    );

    router.route({
      type: "combat:hit",
      combat: makeCombatEvent()
    });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      channel: "vfx",
      cue: "combat_hit"
    });
    expect(onDispatchError).toHaveBeenCalledTimes(1);
  });
});
