import type { RandomEventDef, RunState } from "@blodex/core";
import { t } from "../../../i18n";
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
  appendKey(key: string, params: Record<string, unknown> | undefined, level: string, timestampMs: number): void;
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

    const canEnterAbyss = host.run.runMode !== "daily";
    const eventDef: RandomEventDef = {
      id: ABYSS_VICTORY_EVENT_ID,
      name: t("ui.boss.victory.title"),
      description: canEnterAbyss
        ? t("ui.boss.victory.description.normal")
        : t("ui.boss.victory.description.daily"),
      floorRange: { min: host.run.currentFloor, max: host.run.currentFloor },
      spawnWeight: 1,
      choices: [
        {
          id: "claim_victory",
          name: t("ui.boss.victory.choice.claim.name"),
          description: t("ui.boss.victory.choice.claim.description"),
          rewards: []
        },
        {
          id: "enter_abyss",
          name: t("ui.boss.victory.choice.enter_abyss.name"),
          description: t("ui.boss.victory.choice.enter_abyss.description"),
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
        if (choiceId === "enter_abyss" && canEnterAbyss) {
          host.runCompletionModule.enterAbyss(host.time.now);
          return;
        }
        host.runCompletionModule.finishRun(true);
      },
      () => {
        host.eventRuntimeModule.consumeCurrentEvent();
        if (typeof host.recordBossRewardClosed === "function") {
          host.recordBossRewardClosed("dismiss", host.time.now);
        }
        host.runCompletionModule.finishRun(true);
      }
    );
    host.runLog.appendKey("log.boss.bone_sovereign_defeated", undefined, "success", nowMs);
  }
}
