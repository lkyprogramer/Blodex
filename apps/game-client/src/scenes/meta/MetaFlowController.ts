import {
  applyRunSummaryToMeta,
  calculateSoulShardReward,
  buildMutationDefMap,
  canStartDailyScoredAttempt,
  collectUnlockedMutationIds,
  createDailySeed,
  endRun,
  forgeBlueprint,
  mergeFoundBlueprints,
  normalizeMutationMetaState,
  purchaseTalent,
  purchaseUnlock,
  setSelectedDifficulty,
  unlockEchoMutation,
  validateMutationSelection,
  type DifficultyMode,
  type MetaProgression,
  type RunSaveDataV2,
  type TalentNodeDef
} from "@blodex/core";
import {
  BLUEPRINT_DEF_MAP,
  MUTATION_DEFS,
  TALENT_DEFS,
  UNLOCK_DEFS
} from "@blodex/content";
import { getLocale, setLocale, t } from "../../i18n";
import { difficultyLabel } from "../../i18n/labelResolvers";
import type { LocaleCode } from "../../i18n/types";
import type { SaveManager } from "../../systems/SaveManager";
import { playSceneTransition } from "../../ui/SceneTransitionOverlay";

const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);

export interface MetaFlowControllerHost {
  getMeta(): MetaProgression;
  setMeta(meta: MetaProgression): void;
  getRunSave(): RunSaveDataV2 | null;
  getLanguageGateActive(): boolean;
  saveMeta(meta: MetaProgression): boolean;
  hideDomMenu(): void;
  restartScene(): void;
  startDungeonScene(data: Record<string, unknown>): void;
  readSave(): RunSaveDataV2 | null;
  acquireLease(save: RunSaveDataV2): { ok: boolean; save: RunSaveDataV2 | null };
  hasForeignLease(save: RunSaveDataV2): boolean;
  isRunSettled(runId: string): boolean;
  markRunSettled(runId: string): void;
  deleteSave(): void;
  resolveDailyDate(): string;
}

export class MetaFlowController {
  constructor(private readonly host: MetaFlowControllerHost) {}

  private estimateAbandonNowMs(save: RunSaveDataV2): number {
    const inputs = save.run.replay?.inputs ?? [];
    let elapsedMs = 0;
    for (const input of inputs) {
      if (Number.isFinite(input.atMs) && input.atMs > elapsedMs) {
        elapsedMs = input.atMs;
      }
    }
    return save.run.startedAtMs + elapsedMs;
  }

  switchLocale(locale: LocaleCode): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const meta = this.host.getMeta();
    if (meta.preferredLocale === locale && getLocale() === locale) {
      return;
    }
    setLocale(locale);
    const next = {
      ...meta,
      preferredLocale: locale
    };
    this.host.setMeta(next);
    this.host.saveMeta(next);
    this.host.restartScene();
  }

  tryPurchase(index: number): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const unlock = UNLOCK_DEFS[index];
    if (unlock === undefined) {
      return;
    }
    const meta = this.host.getMeta();
    const next = purchaseUnlock(meta, unlock);
    if (next === meta) {
      return;
    }
    this.host.setMeta(next);
    this.host.saveMeta(next);
    this.host.restartScene();
  }

  tryForgeBlueprint(blueprintId: string): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const blueprint = BLUEPRINT_DEF_MAP[blueprintId];
    if (blueprint === undefined) {
      return;
    }
    const meta = this.host.getMeta();
    const next = forgeBlueprint(meta, blueprint);
    if (next === meta) {
      return;
    }
    const normalized = normalizeMutationMetaState(next, MUTATION_DEFS);
    this.host.setMeta(normalized);
    this.host.saveMeta(normalized);
    this.host.restartScene();
  }

  tryUnlockEchoMutation(mutationId: string): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const mutation = MUTATION_DEF_BY_ID[mutationId];
    if (mutation === undefined) {
      return;
    }
    const result = unlockEchoMutation(this.host.getMeta(), mutation);
    if (!result.ok) {
      return;
    }
    const normalized = normalizeMutationMetaState(result.meta, MUTATION_DEFS);
    this.host.setMeta(normalized);
    this.host.saveMeta(normalized);
    this.host.restartScene();
  }

  tryToggleMutationSelection(mutationId: string): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const mutation = MUTATION_DEF_BY_ID[mutationId];
    if (mutation === undefined) {
      return;
    }
    const meta = this.host.getMeta();
    const unlockedMutationIds = collectUnlockedMutationIds(meta, MUTATION_DEFS);
    const selected = [...meta.selectedMutationIds];
    const nextSelection = selected.includes(mutationId)
      ? selected.filter((selectedId) => selectedId !== mutationId)
      : [...selected, mutationId];
    const validation = validateMutationSelection(
      nextSelection,
      MUTATION_DEF_BY_ID,
      meta.mutationSlots,
      unlockedMutationIds
    );
    if (!validation.ok) {
      return;
    }
    const normalized = normalizeMutationMetaState(
      {
        ...meta,
        selectedMutationIds: validation.selected
      },
      MUTATION_DEFS
    );
    this.host.setMeta(normalized);
    this.host.saveMeta(normalized);
    this.host.restartScene();
  }

  tryPurchaseTalent(talentId: string): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const talent = TALENT_DEFS.find((entry) => entry.id === talentId);
    if (talent === undefined) {
      return;
    }
    const meta = this.host.getMeta();
    const next = purchaseTalent(meta, talent as TalentNodeDef);
    if (next === meta) {
      return;
    }
    this.host.setMeta(next);
    this.host.saveMeta(next);
    this.host.restartScene();
  }

  selectDifficulty(mode: DifficultyMode): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const meta = this.host.getMeta();
    const next = setSelectedDifficulty(meta, mode);
    if (next === meta) {
      return;
    }
    this.host.setMeta(next);
    this.host.saveMeta(next);
    this.host.restartScene();
  }

  startRun(): void {
    if (this.host.getLanguageGateActive() || this.host.getRunSave() !== null) {
      return;
    }
    const difficulty = this.host.getMeta().selectedDifficulty;
    playSceneTransition({
      title: t("ui.transition.enter_dungeon.title"),
      subtitle: t("ui.transition.enter_dungeon.subtitle", {
        difficulty: difficultyLabel(difficulty)
      }),
      mode: "scene",
      durationMs: 620
    });
    this.host.hideDomMenu();
    this.host.startDungeonScene({
      difficulty,
      runMode: "normal"
    });
  }

  startDailyRun(): void {
    if (this.host.getLanguageGateActive() || this.host.getRunSave() !== null) {
      return;
    }
    const dailyDate = this.host.resolveDailyDate();
    const runSeed = createDailySeed(dailyDate);
    const canScore = canStartDailyScoredAttempt(this.host.getMeta(), dailyDate);
    playSceneTransition({
      title: t("ui.transition.daily.title"),
      subtitle: t("ui.transition.daily.subtitle", {
        date: dailyDate
      }),
      mode: "scene",
      durationMs: 620
    });
    this.host.hideDomMenu();
    this.host.startDungeonScene({
      difficulty: "hard",
      runMode: "daily",
      dailyDate,
      dailyPractice: !canScore,
      runSeed
    });
  }

  continueRun(): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const save = this.host.readSave();
    if (save === null) {
      this.host.restartScene();
      return;
    }
    const lease = this.host.acquireLease(save);
    if (!lease.ok || lease.save === null) {
      this.host.restartScene();
      return;
    }
    playSceneTransition({
      title: t("ui.transition.resume.title"),
      subtitle: t("ui.transition.resume.subtitle", {
        floor: lease.save.run.currentFloor,
        difficulty: difficultyLabel(lease.save.run.difficulty)
      }),
      mode: "scene",
      durationMs: 620
    });
    this.host.hideDomMenu();
    this.host.startDungeonScene({
      difficulty: lease.save.run.difficulty,
      resumeSave: lease.save,
      resumedFromSave: true
    });
  }

  abandonRun(): void {
    if (this.host.getLanguageGateActive()) {
      return;
    }
    const save = this.host.readSave();
    if (save === null) {
      this.host.restartScene();
      return;
    }
    if (this.host.hasForeignLease(save)) {
      this.host.restartScene();
      return;
    }
    if (this.host.isRunSettled(save.runId)) {
      this.host.deleteSave();
      this.host.restartScene();
      return;
    }
    const failedRun = {
      ...save.run,
      isVictory: false
    };
    const meta = this.host.getMeta();
    const { summary: baseSummary, meta: nextMeta } = endRun(
      failedRun,
      save.player,
      this.estimateAbandonNowMs(save),
      meta
    );
    const soulShards = calculateSoulShardReward(failedRun, false);
    const summary = {
      ...baseSummary,
      isVictory: false,
      soulShardsEarned: soulShards,
      obolsEarned: failedRun.runEconomy.obols
    };
    const mergedMeta = mergeFoundBlueprints(nextMeta, save.blueprintFoundIdsInRun ?? []);
    const normalized = normalizeMutationMetaState(
      applyRunSummaryToMeta(mergedMeta, summary),
      MUTATION_DEFS
    );
    this.host.setMeta(normalized);
    if (this.host.saveMeta(normalized)) {
      this.host.markRunSettled(save.runId);
      this.host.deleteSave();
    }
    this.host.restartScene();
  }
}
