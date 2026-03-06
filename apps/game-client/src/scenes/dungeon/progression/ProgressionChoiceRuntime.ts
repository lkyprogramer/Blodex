import {
  applyLevelUpChoice,
  type BaseStats,
  type FloorChoiceBudgetState,
  type GameEventMap,
  type LootTableDef,
  type PlayerState,
  type ProgressionPromptState,
  type RandomEventDef,
  type RollItemDropOptions,
  type RunState,
  type TypedEventBus
} from "@blodex/core";
import { LOOT_TABLE_MAP } from "@blodex/content";
import { getContentLocalizer, t } from "../../../i18n";
import {
  levelUpDialogDescription,
  levelUpDialogTitle,
  levelUpStatChoiceLabel,
  progressionChoiceSourceLabel
} from "../../../i18n/labelResolvers";
import type { LevelupSkillChoice } from "../encounter/PlayerActionModule";

interface ProgressionChoiceUiManager {
  showEventDialog(
    eventDef: RandomEventDef,
    choices: Array<{
      choice: RandomEventDef["choices"][number];
      enabled: boolean;
      disabledReason?: string;
    }>,
    onSelect: (choiceId: string) => void,
    onClose: () => void
  ): void;
  hideEventPanel(): void;
}

interface ProgressionChoiceRunLog {
  appendKey(key: string, params: Record<string, unknown> | undefined, level: string, timestampMs: number): void;
}

interface ProgressionChoicePlayerActionPort {
  resolveLevelupSkillChoices(): LevelupSkillChoice[];
  resolveLevelupSkillChoiceById(skillId: string): LevelupSkillChoice | null;
  applyLevelupSkillChoice(skillId: string): boolean;
}

export interface ProgressionChoiceHost {
  player: PlayerState;
  run: RunState;
  eventBus: TypedEventBus<GameEventMap>;
  refreshSynergyRuntime(persistDiscovery?: boolean): void;
  playerActionModule: ProgressionChoicePlayerActionPort;
  runEnded: boolean;
  eventPanelOpen: boolean;
  uiManager: ProgressionChoiceUiManager;
  runLog: ProgressionChoiceRunLog;
  time: { now: number };
  hudDirty: boolean;
  currentBiome: {
    lootBias?: RollItemDropOptions["slotWeightMultiplier"];
  };
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
  registerStatDeltaHighlights(
    before: PlayerState["derivedStats"],
    after: PlayerState["derivedStats"],
    nowMs: number
  ): void;
  scheduleRunSave(): void;
  recordBuildLevelUpChoice?(stat: keyof BaseStats, source: string, nowMs: number): void;
  recordPlayerFacingChoice?(source: string, nowMs: number): void;
}

export interface ProgressionChoiceRuntimeOptions {
  host: ProgressionChoiceHost;
}

export class ProgressionChoiceRuntime {
  private readonly contentLocalizer = getContentLocalizer();
  private nextLevelUpPromptAt = 0;
  private floorChoiceBudgetFloor = 1;
  private floorChoiceBudgetSatisfied = false;
  private floorChoiceBudgetSource: string | null = null;
  private pendingLevelUpSkillOffers: LevelupSkillChoice[] = [];

  constructor(private readonly options: ProgressionChoiceRuntimeOptions) {}

  resetRuntime(nowMs: number, floor: number): void {
    this.nextLevelUpPromptAt = nowMs;
    this.pendingLevelUpSkillOffers = [];
    this.resetFloorChoiceBudget(floor, nowMs);
  }

  handleLevelUpGain(levelsGained: number, nowMs: number, source: string): void {
    const host = this.options.host;
    if (!Number.isFinite(levelsGained) || levelsGained <= 0) {
      return;
    }
    const normalizedLevels = Math.max(1, Math.floor(levelsGained));
    const firstLeveledTo = Math.max(1, host.player.level - normalizedLevels + 1);
    for (let level = firstLeveledTo; level <= host.player.level; level += 1) {
      host.eventBus.emit("player:levelup", {
        playerId: host.player.id,
        level,
        timestampMs: nowMs
      });
    }
    host.refreshSynergyRuntime(false);
    this.nextLevelUpPromptAt = Math.min(this.nextLevelUpPromptAt, nowMs);
    this.maybePromptLevelUpChoice(nowMs, source);
  }

  resetFloorChoiceBudget(floor: number, nowMs: number): void {
    this.floorChoiceBudgetFloor = floor;
    this.floorChoiceBudgetSatisfied = false;
    this.floorChoiceBudgetSource = null;
    this.nextLevelUpPromptAt = Math.min(this.nextLevelUpPromptAt, nowMs);
  }

  captureFloorChoiceBudgetSnapshot(): FloorChoiceBudgetState {
    return {
      floor: this.floorChoiceBudgetFloor,
      satisfied: this.floorChoiceBudgetSatisfied,
      ...(this.floorChoiceBudgetSource === null ? {} : { source: this.floorChoiceBudgetSource })
    };
  }

  capturePromptState(nowMs: number): ProgressionPromptState | undefined {
    const pendingLevelUpSkillOfferIds = this.pendingLevelUpSkillOffers.map((offer) => offer.skillId);
    if (pendingLevelUpSkillOfferIds.length === 0) {
      return undefined;
    }
    return {
      nextPromptDelayMs: Math.max(0, Math.floor(this.nextLevelUpPromptAt - nowMs)),
      pendingLevelUpSkillOfferIds
    };
  }

  restorePromptState(snapshot: ProgressionPromptState | null | undefined, nowMs: number): void {
    if (snapshot === null || snapshot === undefined) {
      this.pendingLevelUpSkillOffers = [];
      return;
    }
    this.pendingLevelUpSkillOffers = snapshot.pendingLevelUpSkillOfferIds
      .map((skillId) => this.options.host.playerActionModule.resolveLevelupSkillChoiceById(skillId))
      .filter((choice): choice is LevelupSkillChoice => choice !== null);
    this.nextLevelUpPromptAt = nowMs + Math.max(0, Math.floor(snapshot.nextPromptDelayMs));
  }

  restoreFloorChoiceBudgetSnapshot(snapshot: FloorChoiceBudgetState | null | undefined, fallbackFloor: number, nowMs: number): void {
    if (snapshot === null || snapshot === undefined) {
      this.resetFloorChoiceBudget(fallbackFloor, nowMs);
      return;
    }
    this.floorChoiceBudgetFloor = Math.max(1, Math.floor(snapshot.floor));
    this.floorChoiceBudgetSatisfied = snapshot.satisfied === true;
    this.floorChoiceBudgetSource =
      this.floorChoiceBudgetSatisfied && typeof snapshot.source === "string" && snapshot.source.length > 0
        ? snapshot.source
        : null;
    this.nextLevelUpPromptAt = Math.min(this.nextLevelUpPromptAt, nowMs);
  }

  markHighValueChoice(source: string, nowMs: number): void {
    const host = this.options.host;
    if (this.floorChoiceBudgetFloor !== host.run.currentFloor) {
      this.resetFloorChoiceBudget(host.run.currentFloor, nowMs);
    }
    if (this.floorChoiceBudgetSatisfied) {
      return;
    }
    this.floorChoiceBudgetSatisfied = true;
    this.floorChoiceBudgetSource = source;
    host.runLog.appendKey(
      "log.progression.branch_unlocked",
      {
        floor: host.run.currentFloor,
        source: progressionChoiceSourceLabel(source)
      },
      "info",
      nowMs
    );
  }

  ensureFloorChoiceBudget(nowMs: number): void {
    const host = this.options.host;
    if (this.floorChoiceBudgetFloor !== host.run.currentFloor) {
      this.resetFloorChoiceBudget(host.run.currentFloor, nowMs);
    }
    if (this.floorChoiceBudgetSatisfied) {
      return;
    }
    host.player = {
      ...host.player,
      pendingLevelUpChoices: Math.max(0, Math.floor(host.player.pendingLevelUpChoices ?? 0)) + 1
    };
    this.markHighValueChoice("budget_fallback", nowMs);
    host.runLog.appendKey(
      "log.progression.branch_fallback_injected",
      {
        floor: host.run.currentFloor
      },
      "warn",
      nowMs
    );
    this.nextLevelUpPromptAt = nowMs;
    host.hudDirty = true;
    host.scheduleRunSave();
    this.maybePromptLevelUpChoice(nowMs, "budget_fallback");
  }

  resolveProgressionLootTable(floor: number): LootTableDef | undefined {
    if (floor >= 5) {
      return LOOT_TABLE_MAP.catacomb_elite;
    }
    if (floor >= 3) {
      return LOOT_TABLE_MAP.cathedral_depths;
    }
    return LOOT_TABLE_MAP.starter_floor;
  }

  resolveLootRollOptions(options: RollItemDropOptions = {}): RollItemDropOptions {
    const host = this.options.host;
    const slotWeightMultiplier = {
      ...(host.currentBiome.lootBias ?? {}),
      ...(options.slotWeightMultiplier ?? {})
    };
    return {
      ...options,
      ...(Object.keys(slotWeightMultiplier).length === 0 ? {} : { slotWeightMultiplier })
    };
  }

  maybePromptLevelUpChoice(nowMs: number, source: string): void {
    const host = this.options.host;
    if (host.runEnded || host.eventPanelOpen || host.player.health <= 0) {
      return;
    }
    if ((host.player.pendingSkillChoices ?? 0) > 0) {
      if (this.maybePromptLevelUpSkillChoice(nowMs, source)) {
        return;
      }
    }
    if ((host.player.pendingLevelUpChoices ?? 0) <= 0) {
      return;
    }
    if (nowMs < this.nextLevelUpPromptAt) {
      return;
    }

    const pendingPoints = Math.max(0, Math.floor(host.player.pendingLevelUpChoices ?? 0));
    const choices = this.resolveLevelUpStatChoices().map((entry) => ({
      choice: {
        id: entry.stat,
        name: entry.name,
        description: entry.description,
        rewards: []
      },
      enabled: true as const
    }));
    if (choices.length === 0) {
      return;
    }

    const eventDef: RandomEventDef = {
      id: "levelup_stat_choice",
      name: levelUpDialogTitle(),
      description: levelUpDialogDescription(pendingPoints),
      floorRange: {
        min: host.run.currentFloor,
        max: host.run.currentFloor
      },
      spawnWeight: 1,
      choices: choices.map((entry) => entry.choice)
    };

    host.eventPanelOpen = true;
    host.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId: string) => this.applyLevelUpChoiceSelection(choiceId, host.time.now, source),
      () => {
        host.eventPanelOpen = false;
        host.uiManager.hideEventPanel();
        this.nextLevelUpPromptAt = host.time.now + 2_500;
        host.hudDirty = true;
      }
    );
    host.runLog.appendKey(
      "log.progression.levelup_panel_opened",
      {
        pendingPoints
      },
      "info",
      nowMs
    );
  }

  private resolveLevelUpStatChoices(): Array<{
    stat: keyof BaseStats;
    name: string;
    description: string;
  }> {
    const host = this.options.host;
    const base = host.player.baseStats;
    const strongestPrimary = (["strength", "dexterity", "intelligence"] as const).reduce((best, stat) =>
      base[stat] > base[best] ? stat : best
    );
    const hpRatio = host.player.health / Math.max(1, host.player.derivedStats.maxHealth);
    const shouldOfferVitality =
      hpRatio < 0.6 || base.vitality < Math.min(base.strength, base.dexterity, base.intelligence);

    const picks: Array<keyof BaseStats> = [strongestPrimary];
    for (const stat of ["strength", "dexterity", "intelligence"] as const) {
      if (picks.includes(stat)) {
        continue;
      }
      picks.push(stat);
      if (picks.length >= 3) {
        break;
      }
    }
    if (shouldOfferVitality && !picks.includes("vitality")) {
      picks[picks.length - 1] = "vitality";
    }

    return picks.slice(0, 3).map((stat) => ({
      stat,
      name: levelUpStatChoiceLabel(stat).name,
      description: this.resolveLevelUpStatDescription(stat)
    }));
  }

  private maybePromptLevelUpSkillChoice(nowMs: number, source: string): boolean {
    const host = this.options.host;
    if ((host.player.pendingSkillChoices ?? 0) <= 0) {
      this.pendingLevelUpSkillOffers = [];
      return false;
    }
    if (nowMs < this.nextLevelUpPromptAt) {
      return false;
    }

    const pendingChoices = Math.max(0, Math.floor(host.player.pendingSkillChoices ?? 0));
    if (this.pendingLevelUpSkillOffers.length === 0) {
      this.pendingLevelUpSkillOffers = host.playerActionModule.resolveLevelupSkillChoices();
    }
    const choices = this.pendingLevelUpSkillOffers.map((entry) => ({
      choice: {
        id: entry.skillId,
        name: this.resolveSkillChoiceName(entry),
        description: this.resolveSkillChoiceDescription(entry),
        rewards: []
      },
      enabled: true as const
    }));
    if (choices.length === 0) {
      return false;
    }

    const eventDef: RandomEventDef = {
      id: "levelup_skill_choice",
      name: t("ui.progression.levelup_skill.title"),
      description: t("ui.progression.levelup_skill.description", {
        pendingChoices
      }),
      floorRange: {
        min: host.run.currentFloor,
        max: host.run.currentFloor
      },
      spawnWeight: 1,
      choices: choices.map((entry) => entry.choice)
    };

    host.eventPanelOpen = true;
    host.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId: string) => this.applyLevelUpSkillSelection(choiceId, host.time.now, source),
      () => {
        host.eventPanelOpen = false;
        host.uiManager.hideEventPanel();
        this.nextLevelUpPromptAt = host.time.now + 2_500;
        host.hudDirty = true;
      }
    );
    host.runLog.appendKey(
      "log.progression.levelup_skill_panel_opened",
      {
        pendingChoices
      },
      "info",
      nowMs
    );
    return true;
  }

  private applyLevelUpChoiceSelection(choiceId: string, nowMs: number, source: string): void {
    const host = this.options.host;
    const stat = (["strength", "dexterity", "vitality", "intelligence"] as const).find((entry) => entry === choiceId);
    if (stat === undefined) {
      return;
    }
    const before = host.player.derivedStats;
    const nextPlayer = applyLevelUpChoice(host.player, stat);
    if (nextPlayer === host.player) {
      host.eventPanelOpen = false;
      host.uiManager.hideEventPanel();
      return;
    }

    host.player = host.refreshPlayerStatsFromEquipment(nextPlayer);
    host.registerStatDeltaHighlights(before, host.player.derivedStats, nowMs);
    host.refreshSynergyRuntime();
    this.markHighValueChoice("levelup", nowMs);
    if (typeof host.recordBuildLevelUpChoice === "function") {
      host.recordBuildLevelUpChoice(stat, source, nowMs);
    }
    host.runLog.appendKey(
      "log.progression.levelup_choice",
      {
        choiceName: levelUpStatChoiceLabel(stat).name,
        pendingPoints: Math.max(0, host.player.pendingLevelUpChoices ?? 0)
      },
      "success",
      nowMs
    );

    host.eventPanelOpen = false;
    host.uiManager.hideEventPanel();
    this.nextLevelUpPromptAt = nowMs + 90;
    host.hudDirty = true;
    host.scheduleRunSave();

    if ((host.player.pendingLevelUpChoices ?? 0) > 0) {
      this.maybePromptLevelUpChoice(nowMs + 1, source);
    }
  }

  private applyLevelUpSkillSelection(choiceId: string, nowMs: number, source: string): void {
    const host = this.options.host;
    const activeOfferIds = new Set(this.pendingLevelUpSkillOffers.map((offer) => offer.skillId));
    if (!activeOfferIds.has(choiceId)) {
      return;
    }
    if (!host.playerActionModule.applyLevelupSkillChoice(choiceId)) {
      host.eventPanelOpen = false;
      host.uiManager.hideEventPanel();
      return;
    }

    if (typeof host.recordPlayerFacingChoice === "function") {
      host.recordPlayerFacingChoice("levelup_skill", nowMs);
    } else {
      this.markHighValueChoice("levelup", nowMs);
    }
    host.runLog.appendKey(
      "log.progression.levelup_skill_choice",
      {
        skillId: choiceId,
        pendingChoices: Math.max(0, host.player.pendingSkillChoices ?? 0)
      },
      "success",
      nowMs
    );

    host.eventPanelOpen = false;
    host.uiManager.hideEventPanel();
    this.pendingLevelUpSkillOffers = [];
    this.nextLevelUpPromptAt = nowMs + 90;
    host.hudDirty = true;

    if ((host.player.pendingSkillChoices ?? 0) > 0 || (host.player.pendingLevelUpChoices ?? 0) > 0) {
      this.maybePromptLevelUpChoice(nowMs + 1, source);
    }
  }

  private resolveLevelUpStatDescription(stat: keyof BaseStats): string {
    const baseDescription = levelUpStatChoiceLabel(stat).description;
    const preview = this.resolveStatDeltaPreview(stat);
    return preview.length > 0 ? `${baseDescription} ${preview}` : baseDescription;
  }

  private resolveStatDeltaPreview(stat: keyof BaseStats): string {
    const host = this.options.host;
    const simulated = host.refreshPlayerStatsFromEquipment({
      ...host.player,
      baseStats: {
        ...host.player.baseStats,
        [stat]: host.player.baseStats[stat] + 1
      }
    });
    const before = host.player.derivedStats;
    const after = simulated.derivedStats;
    const deltas: string[] = [];

    const pushDelta = (key: string, delta: number, format: (value: number) => string = (value) => value.toFixed(1)) => {
      if (Math.abs(delta) < 0.001) {
        return;
      }
      deltas.push(t(key, { delta: `${delta >= 0 ? "+" : ""}${format(delta)}` }));
    };

    pushDelta("ui.progression.levelup.preview.attack_power", after.attackPower - before.attackPower);
    pushDelta("ui.progression.levelup.preview.crit_chance", (after.critChance - before.critChance) * 100, (value) =>
      `${value.toFixed(2)}%`
    );
    pushDelta("ui.progression.levelup.preview.attack_speed", after.attackSpeed - before.attackSpeed, (value) =>
      value.toFixed(3)
    );
    pushDelta("ui.progression.levelup.preview.max_health", after.maxHealth - before.maxHealth, (value) =>
      value.toFixed(0)
    );
    pushDelta("ui.progression.levelup.preview.armor", after.armor - before.armor);
    pushDelta("ui.progression.levelup.preview.max_mana", after.maxMana - before.maxMana, (value) =>
      value.toFixed(0)
    );
    pushDelta("ui.progression.levelup.preview.move_speed", after.moveSpeed - before.moveSpeed);

    return deltas.length > 0 ? `(${deltas.slice(0, 3).join(" · ")})` : "";
  }

  private resolveSkillChoiceName(choice: LevelupSkillChoice): string {
    const name = this.contentLocalizer.skillName(choice.skillId, choice.name);
    return choice.nextLevel > 1
      ? t("ui.progression.levelup_skill.choice.upgrade", {
          skillName: name,
          level: choice.nextLevel
        })
      : t("ui.progression.levelup_skill.choice.new", {
          skillName: name
        });
  }

  private resolveSkillChoiceDescription(choice: LevelupSkillChoice): string {
    const localizedDescription = this.contentLocalizer.skillDescription(choice.skillId, choice.description);
    return `${localizedDescription} ${t("ui.progression.levelup_skill.choice.meta", {
      cooldown: (choice.cooldownMs / 1000).toFixed(1),
      mana: choice.manaCost
    })}`;
  }
}
