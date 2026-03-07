import type { ItemInstance, RandomEventDef, RunState } from "@blodex/core";
import { t } from "../../../i18n";
import type { LogLevel } from "../../../ui/Hud";
import { gridToIso } from "../../../systems/iso";
import { BossCombatService } from "./BossCombatService";
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
  grantStoryBossReward(nowMs: number): ItemInstance[];
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
}

export class BossRuntimeModule {
  constructor(private readonly options: BossRuntimeModuleOptions) {}

  updateCombat(nowMs: number): void {
    this.options.combatService.updateCombat(nowMs);
  }

  spawn(): void {
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

  openVictoryChoice(nowMs: number): void {
    const host = this.options.host;
    if (host.eventPanelOpen || host.runEnded) {
      return;
    }

    host.eventPanelOpen = true;
    const rewards = host.grantStoryBossReward(nowMs);
    const canEnterAbyss = host.run.runMode !== "daily";
    const rewardSummary =
      rewards.length === 0 ? "" : ` ${rewards.map((item) => host.describeItem(item)).join(" / ")}.`;
    const eventDef: RandomEventDef = {
      id: ABYSS_VICTORY_EVENT_ID,
      name: t("ui.boss.victory.title"),
      description: canEnterAbyss
        ? `${t("ui.boss.victory.description.normal")}${rewardSummary}`
        : `${t("ui.boss.victory.description.daily")}${rewardSummary}`,
      floorRange: { min: host.run.currentFloor, max: host.run.currentFloor },
      spawnWeight: 1,
      choices: [
        {
          id: "claim_victory",
          name: t("ui.boss.victory.choice.claim.name"),
          description:
            rewards.length === 0
              ? t("ui.boss.victory.choice.claim.description")
              : `${t("ui.boss.victory.choice.claim.description")} ${rewardSummary.trim()}`,
          rewards: []
        },
        {
          id: "enter_abyss",
          name: t("ui.boss.victory.choice.enter_abyss.name"),
          description:
            rewards.length === 0
              ? t("ui.boss.victory.choice.enter_abyss.description")
              : `${t("ui.boss.victory.choice.enter_abyss.description")} ${rewardSummary.trim()}`,
          rewards: []
        }
      ]
    };

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
          if (choiceId === "enter_abyss" && canEnterAbyss) {
            host.runCompletionModule.enterAbyss(host.time.now);
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
          host.runCompletionModule.finishRun(true);
        };
        if (host.flushBossRewardComparePrompts?.(resolveChoice) === true) {
          return;
        }
        resolveChoice();
      }
    );
    host.runLog.appendKey("log.boss.bone_sovereign_defeated", undefined, "success", nowMs);
  }
}
