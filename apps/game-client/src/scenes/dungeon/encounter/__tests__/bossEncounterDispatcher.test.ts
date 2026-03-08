import { describe, expect, it } from "vitest";
import { BONE_SOVEREIGN } from "@blodex/content";
import { BossEncounterDispatcher } from "../BossEncounterDispatcher";

function createDispatcher(
  floor = 5,
  branchChoice?: "molten_route" | "frozen_route",
  challengeRoomState?: { challengeId?: string; started: boolean; finished: boolean } | null
) {
  return new BossEncounterDispatcher({
    run: {
      currentFloor: floor,
      ...(branchChoice === undefined ? {} : { branchChoice }),
      runMode: "normal"
    },
    bossDef: BONE_SOVEREIGN,
    currentBossEncounterId: null,
    ...(challengeRoomState === undefined ? {} : { challengeRoomState })
  });
}

describe("BossEncounterDispatcher", () => {
  it("resolves the story encounter for the story floor by default", () => {
    const dispatcher = createDispatcher();

    const resolved = dispatcher.prepareEncounter();

    expect(resolved.encounter.id).toBe("story_bone_throne_finale");
    expect(resolved.bossDef.id).toBe("bone_sovereign");
    expect(dispatcher.resolveRewardBinding(resolved)).toEqual(
      expect.objectContaining({
        encounterId: "story_bone_throne_finale",
        flow: "enter_abyss_or_finish_run",
        rewardSource: "boss_reward"
      })
    );
  });

  it("prefers branch encounters when a route-specific entry exists", () => {
    const dispatcher = createDispatcher(5, "molten_route");

    const resolved = dispatcher.prepareEncounter();

    expect(resolved.encounter.id).toBe("branch_molten_trial");
    expect(resolved.rewardPolicy.flow).toBe("finish_run");
    expect(resolved.telegraphProfile.id).toBe("route_trial_default");
  });

  it("can restore an explicit challenge encounter independently of the run route", () => {
    const dispatcher = createDispatcher(5, "frozen_route");

    const resolved = dispatcher.resolveEncounter({
      encounterId: "challenge_ossuary_trial"
    });

    expect(resolved.encounter.encounterType).toBe("challenge");
    expect(resolved.rewardPolicy.flow).toBe("resume_run");
    expect(dispatcher.resolveChoiceAction("claim_victory", resolved)).toBe("resume_run");
  });

  it("resolves an active challenge encounter from runtime challenge state", () => {
    const dispatcher = createDispatcher(5, undefined, {
      challengeId: "ossuary_trial",
      started: true,
      finished: false
    });

    const resolved = dispatcher.resolveEncounter();

    expect(resolved.encounter.id).toBe("challenge_ossuary_trial");
    expect(resolved.encounter.encounterType).toBe("challenge");
    expect(resolved.rewardPolicy.rewardSource).toBe("challenge_reward");
  });

  it("does not resolve a floor-bound challenge encounter when the floor does not match", () => {
    const dispatcher = createDispatcher(3, undefined, {
      challengeId: "ossuary_trial",
      started: true,
      finished: false
    });

    const resolved = dispatcher.resolveEncounter();

    expect(resolved.encounter.id).toBe("story_bone_throne_finale");
    expect(resolved.encounter.encounterType).toBe("story");
  });
});
