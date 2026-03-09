import type {
  BossEncounterDef,
  BossRewardPolicyDef,
  BossTelegraphProfileDef
} from "./types";
import { STORY_MAX_FLOOR } from "./config";

export const BOSS_REWARD_POLICIES: BossRewardPolicyDef[] = [
  {
    id: "story_victory_default",
    flow: "enter_abyss_or_finish_run",
    rewardSource: "boss_reward",
    exclusiveDropTableId: "boss_bone_sovereign_exclusive",
    compareBinding: "immediate"
  },
  {
    id: "branch_molten_ember_warden",
    flow: "finish_run",
    rewardSource: "boss_reward",
    rareDropTableId: "boss_ember_warden_rare",
    exclusiveDropTableId: "boss_ember_warden_exclusive",
    compareBinding: "immediate"
  },
  {
    id: "branch_frozen_cathedral_judge",
    flow: "finish_run",
    rewardSource: "boss_reward",
    rareDropTableId: "boss_cathedral_judge_rare",
    exclusiveDropTableId: "boss_cathedral_judge_exclusive",
    compareBinding: "immediate"
  },
  {
    id: "challenge_ossuary_keeper_default",
    flow: "resume_run",
    rewardSource: "challenge_reward",
    rareDropTableId: "boss_ossuary_keeper_rare",
    exclusiveDropTableId: "boss_ossuary_keeper_exclusive",
    compareBinding: "deferred"
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
    id: "ember_warden_default",
    tintColor: 0xd86a42,
    alpha: 0.54,
    pulseDurationMs: 140,
    radiusScale: 1.08
  },
  {
    id: "cathedral_judge_default",
    tintColor: 0xc8d9ee,
    alpha: 0.48,
    pulseDurationMs: 155,
    radiusScale: 0.96
  },
  {
    id: "ossuary_keeper_default",
    tintColor: 0x73b6a3,
    alpha: 0.46,
    pulseDurationMs: 180,
    radiusScale: 1.04
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
      floor: STORY_MAX_FLOOR
    },
    rewardPolicyId: "story_victory_default",
    telegraphProfileId: "bone_throne_default",
    summaryKey: "boss.story.bone_throne_finale",
    portraitAssetId: "boss_bone_sovereign"
  },
  {
    id: "branch_molten_trial",
    bossId: "ember_warden",
    encounterType: "branch",
    selector: {
      kind: "branch_route",
      floor: STORY_MAX_FLOOR,
      route: "molten_route"
    },
    rewardPolicyId: "branch_molten_ember_warden",
    telegraphProfileId: "ember_warden_default",
    summaryKey: "boss.branch.ember_warden_trial",
    portraitAssetId: "boss_portrait_ember_warden",
    rewardBadgeAssetId: "boss_reward_badge_ember_warden"
  },
  {
    id: "branch_frozen_trial",
    bossId: "cathedral_judge",
    encounterType: "branch",
    selector: {
      kind: "branch_route",
      floor: STORY_MAX_FLOOR,
      route: "frozen_route"
    },
    rewardPolicyId: "branch_frozen_cathedral_judge",
    telegraphProfileId: "cathedral_judge_default",
    summaryKey: "boss.branch.cathedral_judge_trial",
    portraitAssetId: "boss_portrait_cathedral_judge",
    rewardBadgeAssetId: "boss_reward_badge_cathedral_judge"
  },
  {
    id: "challenge_ossuary_trial",
    bossId: "ossuary_keeper",
    encounterType: "challenge",
    selector: {
      kind: "challenge",
      challengeId: "ossuary_trial",
      floor: STORY_MAX_FLOOR - 1
    },
    rewardPolicyId: "challenge_ossuary_keeper_default",
    telegraphProfileId: "ossuary_keeper_default",
    summaryKey: "boss.challenge.ossuary_keeper_trial",
    portraitAssetId: "boss_portrait_ossuary_keeper",
    rewardBadgeAssetId: "boss_reward_badge_ossuary_keeper"
  }
];

export const BOSS_ENCOUNTER_MAP = Object.fromEntries(BOSS_ENCOUNTERS.map((entry) => [entry.id, entry])) as Record<
  string,
  BossEncounterDef
>;

export function listChallengeEncounterIdsForFloor(floor: number): string[] {
  return BOSS_ENCOUNTERS.flatMap((entry) => {
    if (entry.selector.kind !== "challenge") {
      return [];
    }
    if (entry.selector.floor !== undefined && entry.selector.floor !== floor) {
      return [];
    }
    return [entry.selector.challengeId];
  });
}
