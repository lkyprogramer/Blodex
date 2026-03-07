import {
  aggregateBuffEffects,
  canStartDailyScoredAttempt,
  collectUnlockedAffixIds,
  collectUnlockedBiomeIds,
  collectUnlockedEventIds,
  collectUnlockedWeaponTypes,
  createInitialConsumableState,
  createRunState,
  deriveFloorSeed,
  deriveStats,
  isItemDefUnlockedByWeaponType,
  mergeSynergyDiscoveries,
  resolveDailyDate,
  normalizeMutationMetaState,
  resolveEquippedWeaponType,
  resolveSynergyRuntimeEffects,
  rollBlueprintDiscoveries,
  SeededRng,
  syncEndlessMutatorState,
  updateBuffs,
  type ConsumableState,
  type DifficultyMode,
  type ItemDef,
  type MetaProgression,
  type MonsterAffixId,
  type MonsterState,
  type MutationEffect,
  type PlayerState,
  type RunMode,
  type RunRngStreamName,
  type RunState,
  type SynergyRuntimeEffects,
  type TalentEffectTotals,
  type WeaponType
} from "@blodex/core";
import {
  BLUEPRINT_DEFS,
  BLUEPRINT_DEF_MAP,
  BUFF_DEF_MAP,
  MUTATION_DEFS,
  MUTATION_DEF_MAP,
  SYNERGY_DEFS,
  UNLOCK_DEFS,
  WEAPON_TYPE_DEF_MAP
} from "@blodex/content";
import type { MonsterRuntime } from "../../../systems/EntityManager";
import { setLocale, resolveInitialLocale, t } from "../../../i18n";
import type { RunLogService } from "../logging/RunLogService";

interface MutationRuntimeStateView {
  activeIds: string[];
  activeEffects: MutationEffect[];
  killAttackSpeedStacks: number;
  killAttackSpeedUntilMs: number;
  onHitInvulnUntilMs: number;
  onHitInvulnCooldownUntilMs: number;
  lethalGuardUsedFloors: Set<number>;
}

export interface DungeonSessionSource {
  time: { now: number };
  debugCheatsEnabled: boolean;
  meta: MetaProgression;
  talentEffects: TalentEffectTotals;
  player: PlayerState;
  run: RunState;
  runSeed: string;
  selectedDifficulty: DifficultyMode;
  resumedFromSave: boolean;
  runEnded: boolean;
  dailyPracticeMode: boolean;
  dailyFixedWeaponType: WeaponType | null;
  lastDeathReason: string;
  manualMoveTarget: { x: number; y: number } | null;
  manualMoveTargetFailures: number;
  nextManualPathReplanAt: number;
  nextKeyboardMoveInputAt: number;
  entityLabelById: Map<string, string>;
  newlyAcquiredItemUntilMs: Map<string, number>;
  previousSkillCooldownLeftById: Map<string, number>;
  skillReadyFlashUntilMsById: Map<string, number>;
  statHighlightEntries: Array<unknown>;
  levelUpPulseUntilMs: number;
  levelUpPulseLevel: number | null;
  nextTransientHudRefreshAt: number;
  lastAiNearCount: number;
  lastAiFarCount: number;
  blueprintFoundIdsInRun: string[];
  mutationRuntime: MutationRuntimeStateView;
  synergyRuntime: SynergyRuntimeEffects;
  unlockedBiomeIds: Set<string>;
  unlockedAffixIds: MonsterAffixId[];
  unlockedEventIds: string[];
  unlockedWeaponTypes: Set<WeaponType>;
  consumables: ConsumableState;
  mapRevealActive: boolean;
  eventPanelOpen: boolean;
  comparePromptOpen: boolean;
  nearDeathWindowArmedAtMs: number | null;
  nearDeathFeedbackCooldownUntilMs: number;
  merchantOffers: Array<unknown>;
  deferredOutcomes: Array<unknown>;
  pendingRunMode: "normal" | "daily";
  pendingDailyDate: string | undefined;
  pendingDailyPractice: boolean;
  pendingRunSeed: string | undefined;
  lastAutoSaveAt: number;
  hudDirty: boolean;
  lootRng: SeededRng;
  spawnRng: SeededRng;
  combatRng: SeededRng;
  skillRng: SeededRng;
  bossRng: SeededRng;
  biomeRng: SeededRng;
  hazardRng: SeededRng;
  eventRng: SeededRng;
  merchantRng: SeededRng;
  eventRuntimeModule: { destroyEventNode(): void };
  progressionRuntimeModule: {
    setupFloor(floor: number, freshFloor: boolean): void;
    onMonsterDefeated(monster: MonsterState, nowMs: number): void;
  };
  progressionChoiceRuntime: {
    resetRuntime(nowMs: number, floor: number): void;
  };
  playerActionModule: {
    resetRuntimeState(): void;
  };
  phase6Telemetry: {
    resetRun(startedAtMs: number): void;
    recordSynergyActivated(synergyId: string, floor: number): void;
    recordPlayerFacingChoice(floor: number): void;
  };
  tasteRuntime: {
    resetRunState(): void;
    recordHeartbeat(heartbeat: {
      type: string;
      floor: number;
      source: string;
      timestampMs: number;
      detail?: string;
    }): void;
    recordBranch(source: string, floor: number, nowMs: number): void;
  };
  contentLocalizer: {
    blueprintName(id: string, fallback: string): string;
  };
  runLog: Pick<RunLogService, "appendKey" | "append" | "debug">;
  entityManager: {
    listMonsters(): MonsterRuntime[];
  };
  metaRuntime: {
    resolveDailyWeaponType(runSeed: string): WeaponType;
    resolveDailyMutationIds(runSeed: string): string[];
    saveMeta(meta: MetaProgression): boolean;
  };
  scheduleRunSave(): void;
}

export class DungeonSessionFacade {
  constructor(private readonly resolveSource: () => DungeonSessionSource) {}

  private get source(): DungeonSessionSource {
    return this.resolveSource();
  }

  bootstrapRun(runSeed: string, difficulty: DifficultyMode): void {
    const source = this.source;
    source.tasteRuntime.resetRunState();
    source.runSeed = runSeed;
    const requestedMode: RunMode = source.pendingRunMode === "daily" ? "daily" : "normal";
    const selectedRunMode: RunMode = requestedMode;
    const resolvedDailyDate = selectedRunMode === "daily" ? source.pendingDailyDate ?? resolveDailyDate() : undefined;
    const canScoreDaily =
      selectedRunMode === "daily" && resolvedDailyDate !== undefined
        ? canStartDailyScoredAttempt(source.meta, resolvedDailyDate)
        : false;
    source.dailyPracticeMode = selectedRunMode === "daily" ? source.pendingDailyPractice || !canScoreDaily : false;
    if (selectedRunMode === "daily" && source.pendingDailyPractice !== source.dailyPracticeMode) {
      source.runLog.appendKey(
        source.dailyPracticeMode ? "log.run.daily_practice_switched" : "log.run.daily_scored_unlocked",
        undefined,
        "info",
        source.time.now
      );
    }
    source.dailyFixedWeaponType = selectedRunMode === "daily" ? source.metaRuntime.resolveDailyWeaponType(runSeed) : null;
    source.selectedDifficulty = selectedRunMode === "daily" ? "hard" : difficulty;
    source.resumedFromSave = false;
    source.runEnded = false;
    source.lastDeathReason = "Unknown cause.";
    source.manualMoveTarget = null;
    source.manualMoveTargetFailures = 0;
    source.nextManualPathReplanAt = 0;
    source.nextKeyboardMoveInputAt = 0;
    source.entityLabelById.clear();
    source.newlyAcquiredItemUntilMs.clear();
    source.previousSkillCooldownLeftById.clear();
    source.skillReadyFlashUntilMsById.clear();
    source.statHighlightEntries = [];
    source.levelUpPulseUntilMs = 0;
    source.levelUpPulseLevel = null;
    source.nextTransientHudRefreshAt = Number.POSITIVE_INFINITY;
    source.playerActionModule.resetRuntimeState();
    source.lastAiNearCount = 0;
    source.lastAiFarCount = 0;
    source.blueprintFoundIdsInRun = [];
    this.refreshUnlockSnapshots();
    if (selectedRunMode === "daily") {
      this.resetMutationRuntimeState(source.metaRuntime.resolveDailyMutationIds(runSeed));
    } else {
      this.resetMutationRuntimeState(source.meta.selectedMutationIds);
    }
    source.consumables = createInitialConsumableState(source.meta.permanentUpgrades.potionCharges);
    source.mapRevealActive = false;
    source.eventPanelOpen = false;
    source.comparePromptOpen = false;
    source.nearDeathWindowArmedAtMs = null;
    source.nearDeathFeedbackCooldownUntilMs = 0;
    source.merchantOffers = [];
    source.deferredOutcomes = [];
    source.eventRuntimeModule.destroyEventNode();
    const run = createRunState(runSeed, source.time.now, source.selectedDifficulty);
    source.run =
      selectedRunMode === "daily"
        ? {
            ...run,
            runMode: "daily",
            ...(resolvedDailyDate === undefined ? {} : { dailyDate: resolvedDailyDate })
          }
        : run;
    source.phase6Telemetry.resetRun(source.run.startedAtMs);
    source.progressionChoiceRuntime.resetRuntime(source.time.now, source.run.currentFloor);
    source.progressionRuntimeModule.setupFloor(1, true);
    if (source.debugCheatsEnabled) {
      source.runLog.debug(t("log.debug.cheats_enabled"), "info", source.time.now);
    }
    source.pendingRunMode = "normal";
    source.pendingDailyDate = undefined;
    source.pendingDailyPractice = false;
    source.pendingRunSeed = undefined;
    source.lastAutoSaveAt = source.time.now;
  }

  refreshUnlockSnapshots(): void {
    const source = this.source;
    source.unlockedBiomeIds = new Set(collectUnlockedBiomeIds(source.meta, UNLOCK_DEFS));
    source.unlockedAffixIds = collectUnlockedAffixIds(source.meta, UNLOCK_DEFS) as MonsterAffixId[];
    const unlockedEvents = new Set<string>(collectUnlockedEventIds(source.meta, UNLOCK_DEFS));
    for (const blueprintId of source.meta.blueprintForgedIds) {
      const blueprint = BLUEPRINT_DEF_MAP[blueprintId];
      if (blueprint?.category === "event") {
        unlockedEvents.add(blueprint.unlockTargetId);
      }
    }
    source.unlockedEventIds = [...unlockedEvents.values()];
    source.unlockedWeaponTypes = collectUnlockedWeaponTypes(source.meta, WEAPON_TYPE_DEF_MAP);
  }

  normalizeMetaForPhase4B(): void {
    const source = this.source;
    const normalized = normalizeMutationMetaState(source.meta, MUTATION_DEFS);
    if (JSON.stringify(normalized) !== JSON.stringify(source.meta)) {
      source.meta = normalized;
      source.metaRuntime.saveMeta(normalized);
      return;
    }
    source.meta = normalized;
  }

  resolveLocalePreference(): void {
    const source = this.source;
    const locale = resolveInitialLocale({
      preferredLocale: source.meta.preferredLocale,
      defaultLocale: "en-US"
    });
    setLocale(locale, { persist: source.meta.preferredLocale !== null });
    if (source.meta.preferredLocale !== null && source.meta.preferredLocale !== locale) {
      source.meta = {
        ...source.meta,
        preferredLocale: locale
      };
      source.metaRuntime.saveMeta(source.meta);
    }
  }

  resetMutationRuntimeState(selectedMutationIds: string[]): void {
    const source = this.source;
    const activeEffects = selectedMutationIds
      .map((mutationId) => MUTATION_DEF_MAP[mutationId])
      .filter((mutationDef): mutationDef is NonNullable<typeof mutationDef> => mutationDef !== undefined)
      .flatMap((mutationDef) => mutationDef.effects);
    source.mutationRuntime = {
      activeIds: [...selectedMutationIds],
      activeEffects,
      killAttackSpeedStacks: 0,
      killAttackSpeedUntilMs: 0,
      onHitInvulnUntilMs: 0,
      onHitInvulnCooldownUntilMs: 0,
      lethalGuardUsedFloors: new Set<number>()
    };
  }

  applySynergyDerivedStatPercents(player: PlayerState): PlayerState {
    const source = this.source;
    const baseline = this.refreshPlayerStatsFromEquipment(player);
    const nextDerived = { ...baseline.derivedStats };
    for (const [stat, percent] of Object.entries(source.synergyRuntime.statPercent)) {
      if (!(stat in nextDerived)) {
        continue;
      }
      const key = stat as keyof typeof nextDerived;
      const baseValue = nextDerived[key];
      const scaled = baseValue * (1 + percent);
      nextDerived[key] =
        key === "critChance" || key === "attackSpeed" || key === "moveSpeed"
          ? Math.max(0, scaled)
          : Math.max(0, Math.floor(scaled));
    }
    return {
      ...baseline,
      derivedStats: nextDerived,
      health: Math.min(baseline.health, nextDerived.maxHealth),
      mana: Math.min(baseline.mana, nextDerived.maxMana)
    };
  }

  refreshSynergyRuntime(
    persistDiscovery = true,
    options: {
      emitActivationEvents?: boolean;
      recordTelemetry?: boolean;
    } = {}
  ): void {
    const source = this.source;
    if (source.player === undefined) {
      source.synergyRuntime = {
        activeSynergyIds: [],
        skillDamagePercent: {},
        skillModifiers: {},
        statPercent: {},
        cooldownOverridesMs: {}
      };
      return;
    }
    const emitActivationEvents = options.emitActivationEvents ?? true;
    const recordTelemetry = options.recordTelemetry ?? emitActivationEvents;
    const previousSynergyIds = new Set(source.synergyRuntime.activeSynergyIds);
    const activeSkills =
      source.player.skills?.skillSlots
        .filter((slot): slot is NonNullable<(typeof source.player.skills.skillSlots)[number]> => slot !== null)
        .map((slot) => ({
          id: slot.defId,
          level: slot.level
        })) ?? [];

    source.synergyRuntime = resolveSynergyRuntimeEffects(SYNERGY_DEFS, {
      weaponType: resolveEquippedWeaponType(source.player),
      activeSkills,
      talentPoints: source.meta.talentPoints,
      selectedMutationIds: source.mutationRuntime.activeIds,
      equipment: Object.values(source.player.equipment)
    });
    source.player = this.applySynergyDerivedStatPercents(source.player);

    const discoveredMeta = mergeSynergyDiscoveries(source.meta, source.synergyRuntime.activeSynergyIds);
    if (discoveredMeta !== source.meta) {
      source.meta = discoveredMeta;
      if (persistDiscovery) {
        source.metaRuntime.saveMeta(discoveredMeta);
      }
    }
    for (const synergyId of source.synergyRuntime.activeSynergyIds) {
      if (previousSynergyIds.has(synergyId)) {
        continue;
      }
      if (recordTelemetry) {
        source.phase6Telemetry.recordSynergyActivated(synergyId, source.run.currentFloor);
      }
      if (!emitActivationEvents) {
        continue;
      }
      source.tasteRuntime.recordHeartbeat({
        type: "synergy_activated",
        floor: source.run.currentFloor,
        source: "synergy_runtime",
        timestampMs: source.time.now,
        detail: synergyId
      });
    }
    source.hudDirty = true;
  }

  collectKnownBlueprintIds(): string[] {
    const source = this.source;
    const known = new Set<string>(source.meta.blueprintFoundIds);
    for (const blueprintId of source.blueprintFoundIdsInRun) {
      known.add(blueprintId);
    }
    return [...known.values()];
  }

  addRunBlueprintDiscoveries(blueprintIds: string[], nowMs: number, sourceLabel: string): void {
    const source = this.source;
    if (blueprintIds.length === 0) {
      return;
    }
    const known = new Set(source.blueprintFoundIdsInRun);
    const discovered: string[] = [];
    for (const blueprintId of blueprintIds) {
      if (known.has(blueprintId)) {
        continue;
      }
      known.add(blueprintId);
      discovered.push(blueprintId);
      source.blueprintFoundIdsInRun.push(blueprintId);
    }
    if (discovered.length === 0) {
      return;
    }
    for (const blueprintId of discovered) {
      const blueprint = BLUEPRINT_DEF_MAP[blueprintId];
      const label =
        blueprint === undefined ? blueprintId : source.contentLocalizer.blueprintName(blueprint.id, blueprint.name);
      source.runLog.appendKey(
        "log.blueprint.discovered",
        {
          sourceLabel,
          blueprintName: label
        },
        "success",
        nowMs
      );
    }
    source.scheduleRunSave();
  }

  tryDiscoverBlueprints(
    sourceType:
      | "monster_affix"
      | "boss_kill"
      | "boss_first_kill"
      | "challenge_room"
      | "hidden_room"
      | "random_event"
      | "floor_clear",
    nowMs: number,
    sourceId?: string
  ): void {
    const source = this.source;
    const discovered = rollBlueprintDiscoveries(
      BLUEPRINT_DEFS,
      sourceId === undefined
        ? { sourceType, floor: source.run.currentFloor }
        : { sourceType, sourceId, floor: source.run.currentFloor },
      source.lootRng,
      this.collectKnownBlueprintIds()
    );
    this.addRunBlueprintDiscoveries(discovered, nowMs, sourceType);
  }

  isItemDefUnlocked(itemDef: ItemDef): boolean {
    return isItemDefUnlockedByWeaponType(itemDef, this.source.unlockedWeaponTypes);
  }

  collectMutationEffects<T extends MutationEffect["type"]>(
    type: T
  ): Array<Extract<MutationEffect, { type: T }>> {
    return this.source.mutationRuntime.activeEffects.filter(
      (effect): effect is Extract<MutationEffect, { type: T }> => effect.type === type
    );
  }

  resolveMutationMoveSpeedMultiplier(): number {
    return this.collectMutationEffects("move_speed_multiplier").reduce((multiplier, effect) => {
      return multiplier * Math.max(0.1, effect.value);
    }, 1);
  }

  resolveMutationAttackSpeedMultiplier(nowMs: number): number {
    const source = this.source;
    const killBuffs = this.collectMutationEffects("on_kill_attack_speed");
    if (killBuffs.length === 0 || nowMs > source.mutationRuntime.killAttackSpeedUntilMs) {
      if (source.mutationRuntime.killAttackSpeedStacks !== 0) {
        source.mutationRuntime.killAttackSpeedStacks = 0;
      }
      return 1;
    }
    const bonusPerStack = Math.max(...killBuffs.map((effect) => effect.value));
    return 1 + source.mutationRuntime.killAttackSpeedStacks * bonusPerStack;
  }

  resolveMutationDropBonus(): { obolMultiplier: number; soulShardMultiplier: number } {
    const bonus = this.collectMutationEffects("drop_bonus").reduce(
      (accumulator, effect) => ({
        obol: accumulator.obol + effect.obolPercent,
        soul: accumulator.soul + effect.soulShardPercent
      }),
      { obol: 0, soul: 0 }
    );
    return {
      obolMultiplier: Math.max(0, 1 + bonus.obol),
      soulShardMultiplier: Math.max(0, 1 + bonus.soul)
    };
  }

  syncEndlessMutators(nowMs: number): void {
    const source = this.source;
    const synced = syncEndlessMutatorState(source.run);
    source.run = synced.run;
    if (synced.activatedIds.length === 0) {
      return;
    }
    for (const mutatorId of synced.activatedIds) {
      source.runLog.append(`Endless mutator activated: ${mutatorId}.`, "warn", nowMs);
    }
    source.hudDirty = true;
    source.scheduleRunSave();
  }

  resolveHiddenRoomRevealRadius(): number {
    return this.collectMutationEffects("hidden_room_reveal_radius").reduce((radius, effect) => {
      return Math.max(radius, effect.value);
    }, 0);
  }

  applyOnKillMutationEffects(nowMs: number): void {
    const source = this.source;
    const healEffects = this.collectMutationEffects("on_kill_heal_percent");
    if (healEffects.length > 0) {
      const healPercent = healEffects.reduce((sum, effect) => sum + effect.value, 0);
      const healAmount = Math.max(1, Math.floor(source.player.derivedStats.maxHealth * healPercent));
      source.player = {
        ...source.player,
        health: Math.min(source.player.derivedStats.maxHealth, source.player.health + healAmount)
      };
    }

    const speedEffects = this.collectMutationEffects("on_kill_attack_speed");
    if (speedEffects.length > 0) {
      const maxStacks = Math.max(...speedEffects.map((effect) => effect.maxStacks));
      const durationMs = Math.max(...speedEffects.map((effect) => effect.durationMs));
      source.mutationRuntime.killAttackSpeedStacks = Math.min(
        maxStacks,
        source.mutationRuntime.killAttackSpeedStacks + 1
      );
      source.mutationRuntime.killAttackSpeedUntilMs = nowMs + durationMs;
    }
  }

  configureRngStreams(
    floor: number,
    cursor?: Partial<Record<RunRngStreamName, number>>
  ): void {
    const source = this.source;
    source.spawnRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "spawn"), cursor?.spawn ?? 0);
    source.combatRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "combat"), cursor?.combat ?? 0);
    source.lootRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "loot"), cursor?.loot ?? 0);
    source.skillRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "skill"), cursor?.skill ?? 0);
    source.bossRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "boss"), cursor?.boss ?? 0);
    source.biomeRng = new SeededRng(deriveFloorSeed(source.runSeed, 0, "biome"), cursor?.biome ?? 0);
    source.hazardRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "hazard"), cursor?.hazard ?? 0);
    source.eventRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "event"), cursor?.event ?? 0);
    source.merchantRng = new SeededRng(deriveFloorSeed(source.runSeed, floor, "merchant"), cursor?.merchant ?? 0);
  }

  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState {
    const source = this.source;
    const equipped = Object.values(player.equipment).filter((item): item is NonNullable<typeof item> => item !== undefined);
    const buffEffects = aggregateBuffEffects(player.activeBuffs ?? [], BUFF_DEF_MAP);
    const derivedStats = deriveStats(
      player.baseStats,
      equipped,
      buffEffects,
      source.meta.permanentUpgrades,
      source.talentEffects
    );

    return {
      ...player,
      derivedStats,
      health: Math.min(player.health, derivedStats.maxHealth),
      mana: Math.min(player.mana, derivedStats.maxMana)
    };
  }

  updateRuntimeBuffs(nowMs: number): void {
    this.updatePlayerBuffs(nowMs);
    for (const monster of this.source.entityManager.listMonsters()) {
      this.updateMonsterBuffs(monster, nowMs);
    }
  }

  updatePlayerBuffs(nowMs: number): void {
    const source = this.source;
    const activeBuffs = source.player.activeBuffs ?? [];
    if (activeBuffs.length === 0) {
      return;
    }
    const updated = updateBuffs(activeBuffs, nowMs);
    if (updated.expired.length === 0 && updated.active.length === activeBuffs.length) {
      return;
    }
    source.player = this.refreshPlayerStatsFromEquipment({
      ...source.player,
      activeBuffs: updated.active
    });
  }

  updateMonsterBuffs(monster: MonsterRuntime, nowMs: number): void {
    const activeBuffs = monster.state.activeBuffs ?? [];
    if (activeBuffs.length === 0) {
      return;
    }
    const updated = updateBuffs(activeBuffs, nowMs);
    if (updated.expired.length === 0 && updated.active.length === activeBuffs.length) {
      return;
    }
    monster.state = {
      ...monster.state,
      activeBuffs: updated.active
    };
    this.refreshMonsterBuffRuntime(monster);
  }

  refreshMonsterBuffRuntime(monster: MonsterRuntime): void {
    const buffEffects = aggregateBuffEffects(monster.state.activeBuffs ?? [], BUFF_DEF_MAP);
    monster.state = {
      ...monster.state,
      moveSpeed: Number(
        ((monster.baseMoveSpeed ?? monster.state.moveSpeed) * (buffEffects.slowMultiplier ?? 1)).toFixed(2)
      )
    };
  }
}
