import {
  applyLevelUpChoice,
  type BaseStats,
  type FloorChoiceBudgetState,
  type LootTableDef,
  type RandomEventDef,
  type RollItemDropOptions
} from "@blodex/core";
import { LOOT_TABLE_MAP } from "@blodex/content";

type ProgressionChoiceHost = Record<string, any>;

export interface ProgressionChoiceRuntimeOptions {
  host: ProgressionChoiceHost;
}

export class ProgressionChoiceRuntime {
  private nextLevelUpPromptAt = 0;
  private floorChoiceBudgetFloor = 1;
  private floorChoiceBudgetSatisfied = false;
  private floorChoiceBudgetSource: string | null = null;

  constructor(private readonly options: ProgressionChoiceRuntimeOptions) {}

  resetRuntime(nowMs: number, floor: number): void {
    this.nextLevelUpPromptAt = nowMs;
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
    host.playerActionModule.offerLevelupSkill();
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
    host.runLog.append(
      `Floor ${host.run.currentFloor} build branch unlocked via ${source}.`,
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
    host.runLog.append(
      `Floor ${host.run.currentFloor} lacked major branching; injected 1 bonus stat choice.`,
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
      name: "Level Up - Attribute Allocation",
      description: `Choose 1 attribute point. Pending points: ${pendingPoints}.`,
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
    host.runLog.append(
      `Level-up choice panel opened (${pendingPoints} pending).`,
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

    const labels: Record<keyof BaseStats, { name: string; description: string }> = {
      strength: {
        name: "Power Drill (+1 STR)",
        description: "Raise attack scaling and stabilize close-range kill pace."
      },
      dexterity: {
        name: "Tempo Edge (+1 DEX)",
        description: "Raise crit consistency, attack speed, and movement tempo."
      },
      vitality: {
        name: "Iron Blood (+1 VIT)",
        description: "Raise max health and reinforce sustained survivability."
      },
      intelligence: {
        name: "Arcane Focus (+1 INT)",
        description: "Raise mana ceiling and improve skill-rotation uptime."
      }
    };

    return picks.slice(0, 3).map((stat) => ({
      stat,
      name: labels[stat].name,
      description: labels[stat].description
    }));
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
    host.runLog.append(
      `Level-up choice: +1 ${stat.toUpperCase()} (${Math.max(0, host.player.pendingLevelUpChoices ?? 0)} pending).`,
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
}
