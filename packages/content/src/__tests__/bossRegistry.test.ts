import { describe, expect, it } from "vitest";
import {
  BOSS_DEF_MAP,
  BOSS_ENCOUNTERS,
  BOSS_REWARD_POLICY_MAP,
  BOSS_TELEGRAPH_PROFILE_MAP
} from "../index";

describe("boss registry", () => {
  it("keeps encounter bindings resolvable", () => {
    expect(BOSS_ENCOUNTERS.length).toBeGreaterThanOrEqual(3);

    for (const encounter of BOSS_ENCOUNTERS) {
      expect(BOSS_DEF_MAP[encounter.bossId]).toBeDefined();
      expect(BOSS_REWARD_POLICY_MAP[encounter.rewardPolicyId]).toBeDefined();
      expect(BOSS_TELEGRAPH_PROFILE_MAP[encounter.telegraphProfileId]).toBeDefined();
    }
  });

  it("covers story, branch, and challenge encounter types", () => {
    const encounterTypes = new Set(BOSS_ENCOUNTERS.map((entry) => entry.encounterType));
    expect(encounterTypes.has("story")).toBe(true);
    expect(encounterTypes.has("branch")).toBe(true);
    expect(encounterTypes.has("challenge")).toBe(true);
  });
});
