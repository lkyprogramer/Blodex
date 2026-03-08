import type {
  BossEncounterDef,
  BossRewardPolicyDef,
  BossTelegraphProfileDef
} from "./types";

export const BOSS_REWARD_POLICIES: BossRewardPolicyDef[] = [
  {
    id: "story_victory_default",
    flow: "enter_abyss_or_finish_run",
    rewardSource: "boss_reward",
    exclusiveDropTableId: "boss_bone_sovereign_exclusive",
    compareBinding: "immediate"
  },
  {
    id: "branch_victory_default",
    flow: "finish_run",
    rewardSource: "boss_reward",
    exclusiveDropTableId: "boss_bone_sovereign_exclusive",
    compareBinding: "immediate"
  },
  {
    id: "challenge_boss_default",
    flow: "resume_run",
    rewardSource: "challenge_reward",
    compareBinding: "immediate"
  }
];

export const BOSS_REWARD_POLICY_MAP = Object.fromEntries(
  BOSS_REWARD_POLICIES.map((entry) => [entry.id, entry])
) as Record<string, BossRewardPolicyDef>;

export const BOSS_TELEGRAPH_PROFILES: BossTelegraphProfileDef[] = [
  {
    id: "bone_throne_default",
    tintColor: 0xb74f4f,
    alpha: 0.52,
    pulseDurationMs: 160,
    radiusScale: 1
  },
  {
    id: "route_trial_default",
    tintColor: 0x9071c2,
    alpha: 0.48,
    pulseDurationMs: 170,
    radiusScale: 1
  },
  {
    id: "challenge_default",
    tintColor: 0x5aa0d6,
    alpha: 0.46,
    pulseDurationMs: 180,
    radiusScale: 1
  }
];

export const BOSS_TELEGRAPH_PROFILE_MAP = Object.fromEntries(
  BOSS_TELEGRAPH_PROFILES.map((entry) => [entry.id, entry])
) as Record<string, BossTelegraphProfileDef>;

export const BOSS_ENCOUNTERS: BossEncounterDef[] = [
  {
    id: "story_bone_throne_finale",
    bossId: "bone_sovereign",
    encounterType: "story",
    selector: {
      kind: "story_floor",
      floor: 5
    },
    rewardPolicyId: "story_victory_default",
    telegraphProfileId: "bone_throne_default",
    summaryKey: "boss.story.bone_throne_finale"
  },
  {
    id: "branch_molten_trial",
    bossId: "bone_sovereign",
    encounterType: "branch",
    selector: {
      kind: "branch_route",
      floor: 5,
      route: "molten_route"
    },
    rewardPolicyId: "branch_victory_default",
    telegraphProfileId: "route_trial_default",
    summaryKey: "boss.branch.molten_trial"
  },
  {
    id: "branch_frozen_trial",
    bossId: "bone_sovereign",
    encounterType: "branch",
    selector: {
      kind: "branch_route",
      floor: 5,
      route: "frozen_route"
    },
    rewardPolicyId: "branch_victory_default",
    telegraphProfileId: "route_trial_default",
    summaryKey: "boss.branch.frozen_trial"
  },
  {
    id: "challenge_ossuary_trial",
    bossId: "bone_sovereign",
    encounterType: "challenge",
    selector: {
      kind: "challenge",
      challengeId: "ossuary_trial",
      floor: 5
    },
    rewardPolicyId: "challenge_boss_default",
    telegraphProfileId: "challenge_default",
    summaryKey: "boss.challenge.ossuary_trial"
  }
];

export const BOSS_ENCOUNTER_MAP = Object.fromEntries(BOSS_ENCOUNTERS.map((entry) => [entry.id, entry])) as Record<
  string,
  BossEncounterDef
>;

export function resolveChallengeEncounterIdForFloor(floor: number): string | null {
  const encounter = BOSS_ENCOUNTERS.find(
    (entry) => entry.selector.kind === "challenge" && (entry.selector.floor === undefined || entry.selector.floor === floor)
  );
  if (encounter === undefined || encounter.selector.kind !== "challenge") {
    return null;
  }
  return encounter.selector.challengeId;
}
