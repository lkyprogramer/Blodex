import type {
  BuffInstance,
  CombatEvent,
  DamageType,
  ItemInstance,
  Phase6TelemetryRuntimeState,
  Phase6TelemetrySnapshot,
  SkillResolution
} from "@blodex/core";
import type { BuildIdentitySnapshot } from "./TasteRuntimePorts";

type DamageTotals = Partial<Record<DamageType, number>>;

function incrementRecord(target: Record<string, number>, key: string, amount = 1): void {
  target[key] = (target[key] ?? 0) + amount;
}

function incrementDamage(target: DamageTotals, key: DamageType, amount: number): void {
  target[key] = (target[key] ?? 0) + amount;
}

function shouldTreatAsRareDrop(item: ItemInstance): boolean {
  return item.rarity === "rare" || item.kind === "unique";
}

function hasBuildAxis(snapshot: BuildIdentitySnapshot): boolean {
  return snapshot.tags.some((tag) => tag === "build:offense" || tag === "build:defense" || tag === "build:utility");
}

function isBuildFormed(snapshot: BuildIdentitySnapshot): boolean {
  const keyItemCount = snapshot.keyItemDefIds.length;
  const pivotCount = snapshot.pivots.length;
  const buildTagCount = snapshot.tags.filter((tag) => tag.startsWith("build:") || tag.startsWith("stat:")).length;
  return hasBuildAxis(snapshot) && buildTagCount >= 2 && (keyItemCount >= 1 || pivotCount >= 3);
}

export class Phase6TelemetryTracker {
  private startedAtMs = 0;
  private playerFacingChoices = 0;
  private powerSpikes = 0;
  private majorPowerSpikes = 0;
  private buildFormedCount = 0;
  private rareDropsPresented = 0;
  private bossRewardClosed = 0;
  private skillUses = 0;
  private skillDamage = 0;
  private autoAttackDamage = 0;
  private manaDryWindowMs = 0;
  private buildFormed = false;
  private readonly choiceCountByFloor: Record<string, number> = {};
  private readonly buffApplyCountById: Record<string, number> = {};
  private readonly buffUptimeMsById: Record<string, number> = {};
  private readonly damageDealtByType: DamageTotals = {};
  private readonly damageTakenByType: DamageTotals = {};
  private readonly resolvedHitCountByType: DamageTotals = {};
  private readonly synergyActivationCountById: Record<string, number> = {};
  private readonly synergyFirstActivatedFloorById: Record<string, number> = {};
  private readonly inputTimestampsMs: number[] = [];

  resetRun(startedAtMs: number): void {
    this.startedAtMs = startedAtMs;
    this.playerFacingChoices = 0;
    this.powerSpikes = 0;
    this.majorPowerSpikes = 0;
    this.buildFormedCount = 0;
    this.rareDropsPresented = 0;
    this.bossRewardClosed = 0;
    this.skillUses = 0;
    this.skillDamage = 0;
    this.autoAttackDamage = 0;
    this.manaDryWindowMs = 0;
    this.buildFormed = false;
    this.inputTimestampsMs.length = 0;
    for (const key of Object.keys(this.choiceCountByFloor)) {
      delete this.choiceCountByFloor[key];
    }
    for (const key of Object.keys(this.buffApplyCountById)) {
      delete this.buffApplyCountById[key];
    }
    for (const key of Object.keys(this.buffUptimeMsById)) {
      delete this.buffUptimeMsById[key];
    }
    for (const key of Object.keys(this.damageDealtByType)) {
      delete this.damageDealtByType[key as DamageType];
    }
    for (const key of Object.keys(this.damageTakenByType)) {
      delete this.damageTakenByType[key as DamageType];
    }
    for (const key of Object.keys(this.resolvedHitCountByType)) {
      delete this.resolvedHitCountByType[key as DamageType];
    }
    for (const key of Object.keys(this.synergyActivationCountById)) {
      delete this.synergyActivationCountById[key];
    }
    for (const key of Object.keys(this.synergyFirstActivatedFloorById)) {
      delete this.synergyFirstActivatedFloorById[key];
    }
  }

  recordPlayerInput(nowMs: number): void {
    const last = this.inputTimestampsMs.at(-1);
    if (last === nowMs) {
      return;
    }
    this.inputTimestampsMs.push(nowMs);
  }

  recordPlayerFacingChoice(floor: number): void {
    this.playerFacingChoices += 1;
    incrementRecord(this.choiceCountByFloor, String(Math.max(1, Math.floor(floor))));
  }

  recordRareDropPresented(item: ItemInstance): void {
    if (!shouldTreatAsRareDrop(item)) {
      return;
    }
    this.rareDropsPresented += 1;
  }

  recordPowerSpike(major = false): void {
    this.powerSpikes += 1;
    if (major) {
      this.majorPowerSpikes += 1;
    }
  }

  recordBossRewardClosed(): void {
    this.bossRewardClosed += 1;
  }

  recordSkillResolution(playerId: string, resolution: SkillResolution): void {
    this.skillUses += 1;
    this.recordCombatEvents(playerId, resolution.events, "skill");
    this.recordBuffs(resolution.buffsApplied);
  }

  recordCombatEvents(playerId: string, events: CombatEvent[], sourceKind: "auto" | "skill" | "other"): void {
    for (const combat of events) {
      if ((combat.kind !== "damage" && combat.kind !== "crit") || combat.amount <= 0) {
        continue;
      }
      incrementDamage(this.resolvedHitCountByType, combat.damageType, 1);
      if (combat.sourceId === playerId) {
        incrementDamage(this.damageDealtByType, combat.damageType, combat.amount);
        if (sourceKind === "skill") {
          this.skillDamage += combat.amount;
        } else if (sourceKind === "auto") {
          this.autoAttackDamage += combat.amount;
        }
      }
      if (combat.targetId === playerId) {
        incrementDamage(this.damageTakenByType, combat.damageType, combat.amount);
      }
    }
  }

  sampleManaDryWindow(currentMana: number, minimumSkillManaCost: number | null, deltaMs: number): void {
    if (minimumSkillManaCost === null) {
      return;
    }
    if (currentMana < minimumSkillManaCost) {
      this.manaDryWindowMs += Math.max(0, deltaMs);
    }
  }

  syncBuildIdentity(snapshot: BuildIdentitySnapshot): boolean {
    if (this.buildFormed || !isBuildFormed(snapshot)) {
      return false;
    }
    this.buildFormed = true;
    this.buildFormedCount += 1;
    return true;
  }

  recordSynergyActivated(synergyId: string, floor: number): void {
    incrementRecord(this.synergyActivationCountById, synergyId);
    if (this.synergyFirstActivatedFloorById[synergyId] === undefined) {
      this.synergyFirstActivatedFloorById[synergyId] = Math.max(1, Math.floor(floor));
    }
  }

  snapshot(elapsedMs: number): Phase6TelemetrySnapshot {
    const runDurationMs = Math.max(1, Math.floor(elapsedMs));
    const totalPlayerDamage = this.skillDamage + this.autoAttackDamage;
    const normalizedDuration = runDurationMs / 30_000;
    const { averageGapMs, maxGapMs } = this.computeInputGaps(runDurationMs);
    return {
      story: {
        playerFacingChoices: this.playerFacingChoices,
        choiceCountByFloor: { ...this.choiceCountByFloor },
        powerSpikes: this.powerSpikes,
        majorPowerSpikes: this.majorPowerSpikes,
        buildFormed: this.buildFormedCount,
        rareDropsPresented: this.rareDropsPresented,
        bossRewardClosed: this.bossRewardClosed
      },
      combat: {
        skillUses: this.skillUses,
        skillCastsPer30s: normalizedDuration <= 0 ? 0 : Number((this.skillUses / normalizedDuration).toFixed(2)),
        skillDamage: this.skillDamage,
        autoAttackDamage: this.autoAttackDamage,
        skillDamageShare: totalPlayerDamage <= 0 ? 0 : Number((this.skillDamage / totalPlayerDamage).toFixed(4)),
        autoAttackDamageShare:
          totalPlayerDamage <= 0 ? 0 : Number((this.autoAttackDamage / totalPlayerDamage).toFixed(4)),
        manaDryWindowMs: this.manaDryWindowMs,
        averageNoInputGapMs: averageGapMs,
        maxNoInputGapMs: maxGapMs
      },
      runtimeEffects: {
        buffApplyCountById: { ...this.buffApplyCountById },
        buffUptimeMsById: { ...this.buffUptimeMsById },
        damageDealtByType: { ...this.damageDealtByType },
        damageTakenByType: { ...this.damageTakenByType },
        resolvedHitCountByType: { ...this.resolvedHitCountByType },
        synergyActivationCountById: { ...this.synergyActivationCountById },
        synergyFirstActivatedFloorById: { ...this.synergyFirstActivatedFloorById }
      }
    };
  }

  exportRuntimeState(elapsedMs: number): Phase6TelemetryRuntimeState {
    const snapshot = this.snapshot(elapsedMs);
    return {
      ...snapshot,
      startedAtMs: this.startedAtMs,
      buildFormedState: this.buildFormed,
      inputTimestampsMs: [...this.inputTimestampsMs]
    };
  }

  restoreRuntimeState(state: Phase6TelemetryRuntimeState): void {
    this.startedAtMs = state.startedAtMs;
    this.playerFacingChoices = state.story.playerFacingChoices;
    this.powerSpikes = state.story.powerSpikes;
    this.majorPowerSpikes = state.story.majorPowerSpikes;
    this.buildFormedCount = state.story.buildFormed;
    this.rareDropsPresented = state.story.rareDropsPresented;
    this.bossRewardClosed = state.story.bossRewardClosed;
    this.skillUses = state.combat.skillUses;
    this.skillDamage = state.combat.skillDamage;
    this.autoAttackDamage = state.combat.autoAttackDamage;
    this.manaDryWindowMs = state.combat.manaDryWindowMs;
    this.buildFormed = state.buildFormedState;
    this.inputTimestampsMs.splice(0, this.inputTimestampsMs.length, ...state.inputTimestampsMs);
    this.replaceRecord(this.choiceCountByFloor, state.story.choiceCountByFloor);
    this.replaceRecord(this.buffApplyCountById, state.runtimeEffects.buffApplyCountById);
    this.replaceRecord(this.buffUptimeMsById, state.runtimeEffects.buffUptimeMsById);
    this.replaceRecord(this.damageDealtByType, state.runtimeEffects.damageDealtByType);
    this.replaceRecord(this.damageTakenByType, state.runtimeEffects.damageTakenByType);
    this.replaceRecord(this.resolvedHitCountByType, state.runtimeEffects.resolvedHitCountByType);
    this.replaceRecord(this.synergyActivationCountById, state.runtimeEffects.synergyActivationCountById);
    this.replaceRecord(this.synergyFirstActivatedFloorById, state.runtimeEffects.synergyFirstActivatedFloorById);
  }

  private recordBuffs(buffsApplied: BuffInstance[]): void {
    for (const buff of buffsApplied) {
      incrementRecord(this.buffApplyCountById, buff.defId);
      incrementRecord(this.buffUptimeMsById, buff.defId, Math.max(0, buff.expiresAtMs - buff.appliedAtMs));
    }
  }

  private computeInputGaps(runDurationMs: number): { averageGapMs: number; maxGapMs: number } {
    if (this.inputTimestampsMs.length === 0) {
      return {
        averageGapMs: runDurationMs,
        maxGapMs: runDurationMs
      };
    }

    const endAtMs = this.startedAtMs + runDurationMs;
    const boundaries = [this.startedAtMs, ...this.inputTimestampsMs, endAtMs];
    const gaps: number[] = [];
    for (let index = 1; index < boundaries.length; index += 1) {
      gaps.push(Math.max(0, boundaries[index]! - boundaries[index - 1]!));
    }
    const totalGapMs = gaps.reduce((sum, gap) => sum + gap, 0);
    return {
      averageGapMs: Number((totalGapMs / Math.max(1, gaps.length)).toFixed(1)),
      maxGapMs: Math.max(0, ...gaps)
    };
  }

  private replaceRecord(
    target: Record<string, number>,
    source: Record<string, number> | Partial<Record<DamageType, number>>
  ): void {
    for (const key of Object.keys(target)) {
      delete target[key];
    }
    for (const [key, value] of Object.entries(source)) {
      if (!Number.isFinite(value)) {
        continue;
      }
      target[key] = value;
    }
  }
}
