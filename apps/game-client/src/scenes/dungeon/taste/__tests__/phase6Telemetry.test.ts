import { describe, expect, it } from "vitest";
import type { SkillResolution } from "@blodex/core";
import { Phase6TelemetryTracker } from "../Phase6Telemetry";

describe("Phase6TelemetryTracker", () => {
  it("captures choice, spike, rhythm, and runtime-effect baselines", () => {
    const tracker = new Phase6TelemetryTracker();
    tracker.resetRun(1_000);

    tracker.recordPlayerInput(1_500);
    tracker.recordPlayerFacingChoice(1);
    tracker.recordRareDropPresented({
      id: "loot-1",
      defId: "rare_sword",
      name: "Rare Sword",
      slot: "weapon",
      kind: "equipment",
      rarity: "rare",
      requiredLevel: 1,
      iconId: "item_weapon_01",
      seed: "test-seed",
      rolledAffixes: {}
    });
    tracker.recordPowerSpike(true);
    const resolution: SkillResolution = {
      player: {} as SkillResolution["player"],
      affectedMonsters: [],
      events: [
        {
          kind: "damage",
          sourceId: "player",
          targetId: "monster-1",
          amount: 32,
          damageType: "arcane",
          timestampMs: 2_000
        },
        {
          kind: "damage",
          sourceId: "monster-2",
          targetId: "player",
          amount: 9,
          damageType: "physical",
          timestampMs: 2_100
        }
      ],
      buffsApplied: [
        {
          defId: "war_cry_buff",
          sourceId: "player",
          targetId: "player",
          appliedAtMs: 2_000,
          expiresAtMs: 5_000
        }
      ]
    };
    tracker.recordSkillResolution("player", resolution);
    tracker.recordCombatEvents("player", [
      {
        kind: "damage",
        sourceId: "player",
        targetId: "monster-1",
        amount: 18,
        damageType: "physical",
        timestampMs: 2_200
      }
    ], "auto");
    tracker.sampleManaDryWindow(3, 5, 600);
    tracker.recordSynergyActivated("crit_chain", 3);
    expect(
      tracker.syncBuildIdentity({
        tags: ["build:offense", "stat:dexterity"],
        keyItemDefIds: ["rare_sword"],
        pivots: [
          {
            type: "item",
            floor: 2,
            source: "pickup",
            timestampMs: 2_300,
            detail: "rare_sword"
          }
        ]
      })
    ).toBe(true);

    const snapshot = tracker.snapshot(9_000);

    expect(snapshot.story.playerFacingChoices).toBe(1);
    expect(snapshot.story.powerSpikes).toBe(1);
    expect(snapshot.story.majorPowerSpikes).toBe(1);
    expect(snapshot.story.buildFormed).toBe(1);
    expect(snapshot.combat.skillUses).toBe(1);
    expect(snapshot.combat.skillDamage).toBe(32);
    expect(snapshot.combat.autoAttackDamage).toBe(18);
    expect(snapshot.combat.manaDryWindowMs).toBe(600);
    expect(snapshot.runtimeEffects.buffApplyCountById.war_cry_buff).toBe(1);
    expect(snapshot.runtimeEffects.buffUptimeMsById.war_cry_buff).toBe(3_000);
    expect(snapshot.runtimeEffects.damageDealtByType.arcane).toBe(32);
    expect(snapshot.runtimeEffects.damageTakenByType.physical).toBe(9);
    expect(snapshot.runtimeEffects.synergyActivationCountById.crit_chain).toBe(1);
    expect(snapshot.runtimeEffects.synergyFirstActivatedFloorById.crit_chain).toBe(3);
  });

  it("restores exported runtime state without losing accumulated baselines", () => {
    const tracker = new Phase6TelemetryTracker();
    tracker.resetRun(500);
    tracker.recordPlayerInput(900);
    tracker.recordPlayerFacingChoice(2);

    const exported = tracker.exportRuntimeState(5_000);
    const restored = new Phase6TelemetryTracker();
    restored.restoreRuntimeState(exported);

    expect(restored.exportRuntimeState(5_000)).toEqual(exported);
  });
});
