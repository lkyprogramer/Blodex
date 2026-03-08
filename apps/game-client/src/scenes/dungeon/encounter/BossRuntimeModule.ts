import type { ItemInstance, RandomEventDef, RunState } from "@blodex/core";
import { t } from "../../../i18n";
import type { LogLevel } from "../../../ui/Hud";
import { gridToIso } from "../../../systems/iso";
import { BossCombatService } from "./BossCombatService";
import {
  BossEncounterDispatcher,
  type BossEncounterResolveContext,
  type BossEncounterRewardBinding,
  type ResolvedBossEncounter
} from "./BossEncounterDispatcher";
import { BossSpawnService } from "./BossSpawnService";

interface BossRuntimeUiManager {
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
}

interface BossRuntimeRunLog {
  appendKey(key: string, params: Record<string, unknown> | undefined, level: LogLevel, timestampMs: number): void;
}

export interface BossRuntimeHost {
  bossState: { position: { x: number; y: number }; health: number } | null;
  bossSprite: { setPosition(x: number, y: number): void; setVisible(visible: boolean): void } | null;
  tileWidth: number;
  tileHeight: number;
  origin: { x: number; y: number };
  eventPanelOpen: boolean;
  runEnded: boolean;
  run: RunState;
  uiManager: BossRuntimeUiManager;
  eventRuntimeModule: {
    consumeCurrentEvent(): void;
  };
  runCompletionModule: {
    enterAbyss(nowMs: number): void;
    finishRun(isVictory: boolean): void;
  };
  grantBossEncounterReward(binding: BossEncounterRewardBinding, nowMs: number): ItemInstance[];
  queueBossEncounterCompare(item: ItemInstance, binding: BossEncounterRewardBinding): void;
  flushBossRewardComparePrompts?(onDrained: () => void): boolean;
  describeItem(item: ItemInstance): string;
  recordBossRewardClosed?(choiceId: string, nowMs: number): void;
  time: {
    now: number;
  };
  runLog: BossRuntimeRunLog;
}

const ABYSS_VICTORY_EVENT_ID = "boss_victory_choice";

export interface BossRuntimeModuleOptions {
  host: BossRuntimeHost;
  combatService: BossCombatService;
  spawnService: BossSpawnService;
  dispatcher: BossEncounterDispatcher;
}

export class BossRuntimeModule {
  constructor(private readonly options: BossRuntimeModuleOptions) {}

  updateCombat(nowMs: number): void {
    this.options.combatService.updateCombat(nowMs);
  }

  spawn(): void {
    this.options.dispatcher.prepareEncounter();
    this.options.spawnService.spawnBoss();
  }

  syncSprite(): void {
    const host = this.options.host;
    if (host.bossState === null || host.bossSprite === null) {
      return;
    }

    const mapped = gridToIso(
      host.bossState.position.x,
      host.bossState.position.y,
      host.tileWidth,
      host.tileHeight,
      host.origin.x,
      host.origin.y
    );

    host.bossSprite.setPosition(mapped.x, mapped.y);
    host.bossSprite.setVisible(host.bossState.health > 0);
  }

  openVictoryChoice(nowMs: number, context?: BossEncounterResolveContext): void {
    const host = this.options.host;
    if (host.eventPanelOpen || host.runEnded) {
      return;
    }

    host.eventPanelOpen = true;
    const encounter =
      context === undefined ? this.options.dispatcher.resolveActiveEncounter() : this.options.dispatcher.resolveEncounter(context);
    const rewardBinding = this.options.dispatcher.resolveRewardBinding(encounter);
    const rewards = host.grantBossEncounterReward(rewardBinding, nowMs);
    for (const item of rewards) {
      host.queueBossEncounterCompare(item, rewardBinding);
    }
    const canEnterAbyss = this.options.dispatcher.allowsEnterAbyss(encounter, host.run.runMode);
    const rewardSummary =
      rewards.length === 0 ? "" : ` ${rewards.map((item) => host.describeItem(item)).join(" / ")}.`;
    const eventDef = this.buildVictoryEvent(encounter, rewardSummary, canEnterAbyss, host.run.currentFloor, rewards);

    const choices = eventDef.choices.map((choice) => {
      if (choice.id === "enter_abyss" && !canEnterAbyss) {
        return {
          choice,
          enabled: false as const,
          disabledReason: t("ui.boss.victory.choice.enter_abyss.disabled_daily")
        };
      }
      return {
        choice,
        enabled: true as const
      };
    });

    host.eventPanelOpen = true;
    host.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId: string) => {
        host.eventRuntimeModule.consumeCurrentEvent();
        if (typeof host.recordBossRewardClosed === "function") {
          host.recordBossRewardClosed(choiceId, host.time.now);
        }
        const resolveChoice = () => {
          const action = this.options.dispatcher.resolveChoiceAction(choiceId, encounter, host.run.runMode);
          if (action === "enter_abyss") {
            host.runCompletionModule.enterAbyss(host.time.now);
            return;
          }
          if (action === "resume_run") {
            return;
          }
          host.runCompletionModule.finishRun(true);
        };
        if (host.flushBossRewardComparePrompts?.(resolveChoice) === true) {
          return;
        }
        resolveChoice();
      },
      () => {
        host.eventRuntimeModule.consumeCurrentEvent();
        if (typeof host.recordBossRewardClosed === "function") {
          host.recordBossRewardClosed("dismiss", host.time.now);
        }
        const resolveChoice = () => {
          const action = this.options.dispatcher.resolveChoiceAction("dismiss", encounter, host.run.runMode);
          if (action === "resume_run") {
            return;
          }
          host.runCompletionModule.finishRun(true);
        };
        if (host.flushBossRewardComparePrompts?.(resolveChoice) === true) {
          return;
        }
        resolveChoice();
      }
    );
    host.runLog.appendKey(this.resolveEncounterLogKey(encounter), undefined, "success", nowMs);
  }

  private buildVictoryEvent(
    encounter: ResolvedBossEncounter,
    rewardSummary: string,
    canEnterAbyss: boolean,
    currentFloor: number,
    rewards: ItemInstance[]
  ): RandomEventDef {
    const description = `${t(this.resolveEncounterDescriptionKey(encounter, canEnterAbyss))}${rewardSummary}`;
    const choices: RandomEventDef["choices"] = [
      {
        id: "claim_victory",
        name: t("ui.boss.victory.choice.claim.name"),
        description:
          rewards.length === 0
            ? t("ui.boss.victory.choice.claim.description")
            : `${t("ui.boss.victory.choice.claim.description")} ${rewardSummary.trim()}`,
        rewards: []
      }
    ];
    if (encounter.rewardPolicy.flow === "enter_abyss_or_finish_run") {
      choices.push({
        id: "enter_abyss",
        name: t("ui.boss.victory.choice.enter_abyss.name"),
        description:
          rewards.length === 0
            ? t("ui.boss.victory.choice.enter_abyss.description")
            : `${t("ui.boss.victory.choice.enter_abyss.description")} ${rewardSummary.trim()}`,
        rewards: []
      });
    }
    return {
      id: ABYSS_VICTORY_EVENT_ID,
      name: t(this.resolveEncounterTitleKey(encounter)),
      description,
      floorRange: { min: currentFloor, max: currentFloor },
      spawnWeight: 1,
      choices
    };
  }

  private resolveEncounterTitleKey(encounter: ResolvedBossEncounter): string {
    return `${encounter.encounter.summaryKey}.title`;
  }

  private resolveEncounterDescriptionKey(encounter: ResolvedBossEncounter, canEnterAbyss: boolean): string {
    if (canEnterAbyss) {
      return `${encounter.encounter.summaryKey}.description_abyss`;
    }
    if (this.options.host.run.runMode === "daily") {
      return `${encounter.encounter.summaryKey}.description_daily`;
    }
    return `${encounter.encounter.summaryKey}.description`;
  }

  private resolveEncounterLogKey(encounter: ResolvedBossEncounter): string {
    return `${encounter.encounter.summaryKey}.log_defeated`;
  }
}
