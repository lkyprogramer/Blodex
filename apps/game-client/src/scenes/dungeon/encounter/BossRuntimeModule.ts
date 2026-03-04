import type { RandomEventDef } from "@blodex/core";
import { gridToIso } from "../../../systems/iso";
import { BossCombatService } from "./BossCombatService";
import { BossSpawnService } from "./BossSpawnService";

type BossHost = Record<string, any>;

const ABYSS_VICTORY_EVENT_ID = "boss_victory_choice";

export interface BossRuntimeModuleOptions {
  host: BossHost;
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
      name: "Bone Throne Cleared",
      description: canEnterAbyss
        ? "Claim victory now or descend into the Abyss for endless escalation."
        : "Daily mode only allows Claim Victory.",
      floorRange: { min: host.run.currentFloor, max: host.run.currentFloor },
      spawnWeight: 1,
      choices: [
        {
          id: "claim_victory",
          name: "Claim Victory",
          description: "End run and secure rewards.",
          rewards: []
        },
        {
          id: "enter_abyss",
          name: "Enter Abyss",
          description: "Continue to endless floors with escalating danger.",
          rewards: []
        }
      ]
    };

    const choices = eventDef.choices.map((choice) => {
      if (choice.id === "enter_abyss" && !canEnterAbyss) {
        return {
          choice,
          enabled: false as const,
          disabledReason: "Daily mode does not support Abyss."
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
        if (choiceId === "enter_abyss" && canEnterAbyss) {
          host.runCompletionModule.enterAbyss(host.time.now);
          return;
        }
        host.runCompletionModule.finishRun(true);
      },
      () => {
        host.eventRuntimeModule.consumeCurrentEvent();
        host.runCompletionModule.finishRun(true);
      }
    );
    host.runLog.appendKey("log.boss.bone_sovereign_defeated", undefined, "success", nowMs);
  }
}
