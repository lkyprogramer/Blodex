import type { BossDef, ChallengeRoomState, RunMode, RunState } from "@blodex/core";
import {
  BOSS_DEF_MAP,
  BOSS_ENCOUNTERS,
  BOSS_ENCOUNTER_MAP,
  BOSS_REWARD_POLICY_MAP,
  BOSS_TELEGRAPH_PROFILE_MAP,
  type BossEncounterDef,
  type BossRewardPolicyDef,
  type BossTelegraphProfileDef
} from "@blodex/content";

export interface ResolvedBossEncounter {
  encounter: BossEncounterDef;
  bossDef: BossDef;
  rewardPolicy: BossRewardPolicyDef;
  telegraphProfile: BossTelegraphProfileDef;
}

export interface BossEncounterRewardBinding {
  encounterId: string;
  rewardSource: BossRewardPolicyDef["rewardSource"];
  compareBinding: BossRewardPolicyDef["compareBinding"];
  flow: BossRewardPolicyDef["flow"];
  rareDropTableId: string;
  exclusiveDropTableId?: string;
}

export interface BossEncounterDispatcherHost {
  run: Pick<RunState, "currentFloor" | "branchChoice" | "runMode">;
  bossDef: BossDef;
  currentBossEncounterId: string | null;
  challengeRoomState?: Pick<ChallengeRoomState, "challengeId" | "started" | "finished"> | null;
}

export interface BossEncounterResolveContext {
  floor?: number;
  branchChoice?: RunState["branchChoice"];
  encounterId?: string | null;
  bossId?: string | null;
  challengeEncounterId?: string | null;
  challengeId?: string | null;
}

export class BossEncounterDispatcher {
  constructor(private readonly host: BossEncounterDispatcherHost) {}

  listEncounters(): ResolvedBossEncounter[] {
    return BOSS_ENCOUNTERS.map((entry) => this.inflateEncounter(entry));
  }

  resolveEncounter(context: BossEncounterResolveContext = {}): ResolvedBossEncounter {
    const encounter =
      this.resolveByEncounterId(context.encounterId) ??
      this.resolveByChallengeId(context.challengeId, context.floor) ??
      this.resolveByEncounterId(context.challengeEncounterId) ??
      this.resolveExplicitFloorContext(context) ??
      this.resolveActiveChallenge() ??
      this.resolveByBossId(context.bossId) ??
      this.resolveByFloorAndRoute(this.host.run.currentFloor, this.host.run.branchChoice) ??
      this.resolveStoryFallback();
    return this.inflateEncounter(encounter);
  }

  prepareEncounter(context: BossEncounterResolveContext = {}): ResolvedBossEncounter {
    const resolved = this.resolveEncounter(context);
    this.host.currentBossEncounterId = resolved.encounter.id;
    this.host.bossDef = resolved.bossDef;
    return resolved;
  }

  resolveActiveEncounter(): ResolvedBossEncounter {
    return this.prepareEncounter({
      encounterId: this.host.currentBossEncounterId
    });
  }

  resolveRewardBinding(encounter: ResolvedBossEncounter = this.resolveActiveEncounter()): BossEncounterRewardBinding {
    return {
      encounterId: encounter.encounter.id,
      rewardSource: encounter.rewardPolicy.rewardSource,
      compareBinding: encounter.rewardPolicy.compareBinding,
      flow: encounter.rewardPolicy.flow,
      rareDropTableId: encounter.rewardPolicy.rareDropTableId ?? encounter.bossDef.dropTableId,
      ...(encounter.rewardPolicy.exclusiveDropTableId === undefined
        ? {}
        : { exclusiveDropTableId: encounter.rewardPolicy.exclusiveDropTableId })
    };
  }

  allowsEnterAbyss(encounter: ResolvedBossEncounter = this.resolveActiveEncounter(), runMode: RunMode): boolean {
    return encounter.rewardPolicy.flow === "enter_abyss_or_finish_run" && runMode !== "daily";
  }

  resolveChoiceAction(
    choiceId: string,
    encounter: ResolvedBossEncounter = this.resolveActiveEncounter(),
    runMode: RunMode = this.host.run.runMode
  ): "finish_run" | "enter_abyss" | "resume_run" {
    if (choiceId === "dismiss") {
      return encounter.rewardPolicy.flow === "resume_run" ? "resume_run" : "finish_run";
    }
    if (choiceId === "enter_abyss" && this.allowsEnterAbyss(encounter, runMode)) {
      return "enter_abyss";
    }
    if (encounter.rewardPolicy.flow === "resume_run") {
      return "resume_run";
    }
    return "finish_run";
  }

  private inflateEncounter(encounter: BossEncounterDef): ResolvedBossEncounter {
    const bossDef = BOSS_DEF_MAP[encounter.bossId];
    const rewardPolicy = BOSS_REWARD_POLICY_MAP[encounter.rewardPolicyId];
    const telegraphProfile = BOSS_TELEGRAPH_PROFILE_MAP[encounter.telegraphProfileId];
    if (bossDef === undefined) {
      throw new Error(`Boss encounter ${encounter.id} references unknown boss ${encounter.bossId}.`);
    }
    if (rewardPolicy === undefined) {
      throw new Error(`Boss encounter ${encounter.id} references unknown reward policy ${encounter.rewardPolicyId}.`);
    }
    if (telegraphProfile === undefined) {
      throw new Error(
        `Boss encounter ${encounter.id} references unknown telegraph profile ${encounter.telegraphProfileId}.`
      );
    }
    return {
      encounter,
      bossDef,
      rewardPolicy,
      telegraphProfile
    };
  }

  private resolveByEncounterId(encounterId: string | null | undefined): BossEncounterDef | null {
    if (encounterId === undefined || encounterId === null) {
      return null;
    }
    return BOSS_ENCOUNTER_MAP[encounterId] ?? null;
  }

  private resolveByChallengeId(challengeId: string | null | undefined, floor?: number): BossEncounterDef | null {
    if (challengeId === undefined || challengeId === null) {
      return null;
    }
    const targetFloor = floor ?? this.host.run.currentFloor;
    return (
      BOSS_ENCOUNTERS.find(
        (entry) =>
          entry.selector.kind === "challenge" &&
          entry.selector.challengeId === challengeId &&
          (entry.selector.floor === undefined || entry.selector.floor === targetFloor)
      ) ?? null
    );
  }

  private resolveByBossId(bossId: string | null | undefined): BossEncounterDef | null {
    if (bossId === undefined || bossId === null) {
      return null;
    }
    return BOSS_ENCOUNTERS.find((entry) => entry.bossId === bossId && entry.encounterType === "story") ?? null;
  }

  private resolveByFloorAndRoute(
    floor: number | undefined,
    branchChoice: RunState["branchChoice"] | undefined
  ): BossEncounterDef | null {
    const targetFloor = floor ?? this.host.run.currentFloor;
    if (branchChoice !== undefined) {
      const branchEncounter =
        BOSS_ENCOUNTERS.find(
          (entry) =>
            entry.selector.kind === "branch_route" &&
            entry.selector.floor === targetFloor &&
            entry.selector.route === branchChoice
        ) ?? null;
      if (branchEncounter !== null) {
        return branchEncounter;
      }
    }
    return (
      BOSS_ENCOUNTERS.find(
        (entry) => entry.selector.kind === "story_floor" && entry.selector.floor === targetFloor
      ) ?? null
    );
  }

  private resolveExplicitFloorContext(context: BossEncounterResolveContext): BossEncounterDef | null {
    if (context.floor === undefined && context.branchChoice === undefined) {
      return null;
    }
    return this.resolveByFloorAndRoute(context.floor, context.branchChoice);
  }

  private resolveActiveChallenge(): BossEncounterDef | null {
    const state = this.host.challengeRoomState;
    if (state === undefined || state === null) {
      return null;
    }
    if (!state.started && !state.finished) {
      return null;
    }
    return this.resolveByChallengeId(state.challengeId, this.host.run.currentFloor);
  }

  private resolveStoryFallback(): BossEncounterDef {
    const fallback = BOSS_ENCOUNTERS.find((entry) => entry.encounterType === "story");
    if (fallback === undefined) {
      throw new Error("Boss encounter registry must include at least one story encounter.");
    }
    return fallback;
  }
}
