import { gridToIso } from "../../../systems/iso";
import type { FeedbackAction, FeedbackRouterInput } from "../../../systems/feedbackEventRouter";
import type { UIManager } from "../../../ui/UIManager";

const AUTO_SAVE_INTERVAL_MS = 60_000;
const MINIMAP_REFRESH_INTERVAL_MS = 120;

export interface DungeonFrameSource {
  hudDirty: boolean;
  nextTransientHudRefreshAt: number;
  time: { now: number };
  player: { id: string; health: number; mana: number; position: { x: number; y: number } };
  progressionChoiceRuntime: { maybePromptLevelUpChoice(nowMs: number, source: string): void };
  hazardRuntimeModule: { resolvePlayerHazardMovementMultiplier(): number };
  resolveMutationMoveSpeedMultiplier(): number;
  updateKeyboardMoveIntent(nowMs: number): void;
  updatePlayerMovement(delta: number, nowMs: number): void;
  playerActionModule: {
    applySpecialAffixHealthRegen(deltaMs: number): void;
    applyPassiveManaRegen(deltaMs: number): void;
  };
  updateRuntimeBuffs(nowMs: number): void;
  phase6Telemetry: { sampleManaDryWindow(mana: number, minMana: number | null, deltaMs: number): void };
  resolveMinimumActiveSkillManaCost(): number | null;
  progressionRuntimeModule: { revealNearbyHiddenRoomsByMutation(nowMs: number): void };
  encounterController: { updateFrame(args: { deltaSeconds: number; nowMs: number }): void; updateChallenge(nowMs: number): void };
  worldEventController: { updatePreResolution(nowMs: number): void; updatePostResolution(nowMs: number): void };
  combatRuntime: { updatePressurePeakRuntime(nowMs: number): void };
  renderSystem: {
    syncPlayerSprite(sprite: unknown, position: { x: number; y: number }, yOffset: number, origin: { x: number; y: number }): void;
    syncMonsterSprites(monsters: unknown[], origin: { x: number; y: number }): void;
  };
  playerSprite: unknown;
  playerYOffset: number;
  entityManager: {
    listMonsters(): unknown[];
    listLivingMonsters(): Array<{ state: { position: { x: number; y: number } } }>;
    listLoot(): Array<{ position: { x: number; y: number } }>;
    findMonsterById(entityId: string): { sprite: unknown } | undefined;
  };
  origin: { x: number; y: number };
  bossRuntimeModule: {
    syncSprite(): void;
    openVictoryChoice(nowMs: number): void;
  };
  floorConfig: { isBossFloor: boolean };
  bossState: { health: number; currentPhaseIndex: number; maxHealth: number } | null;
  bossSprite: unknown;
  tasteRuntime: { recordKeyKill(kind: string, floor: number, source: string, nowMs: number): void };
  run: { currentFloor: number; inEndless: boolean };
  deferredOutcomeRuntime: { settle(reason: string, nowMs: number): void };
  runCompletionModule: { finishRun(victory: boolean): void };
  lastAutoSaveAt: number;
  flushRunSave(): void;
  renderDiagnosticsPanel(nowMs: number): void;
  uiManager: Pick<UIManager, "renderMinimap">;
  lastMinimapRefreshAt: number;
  staircaseState: { visible: boolean; position: { x: number; y: number } };
  eventNode:
    | { resolved: boolean; position: { x: number; y: number } }
    | null;
  mapRevealActive: boolean;
  currentBiome: { id: string };
  feedbackRouter: { route(input: FeedbackRouterInput): void };
  sfxSystem: { dispatch(action: FeedbackAction): void };
  vfxSystem: {
    playCombatHit(target: unknown, amount: number, critical: boolean, weaponType: string | undefined): void;
    playCombatDodge(target: unknown): void;
    playCombatDeath(target: unknown): void;
    playSkillCast(caster: unknown, skillId: string): void;
    playBossPhaseChange(target: unknown): void;
    playRareDrop(rarity: string): void;
    playBuildFormed(): void;
    playBossReward(): void;
    playSynergyActivated(): void;
    playPowerSpike(major: boolean): void;
    playHazardTrigger(x: number, y: number, hazardType: string): void;
    playLevelUp(target: unknown, level: number): void;
  };
  bossDef: { id: string };
  tileWidth: number;
  tileHeight: number;
  isBlockingOverlayOpen(): boolean;
}

export class DungeonFrameRuntime {
  constructor(private readonly resolveSource: () => DungeonFrameSource) {}

  private get source(): DungeonFrameSource {
    return this.resolveSource();
  }

  runEventPanelFrame(nowMs: number, renderHud: () => void): void {
    const source = this.source;
    if (!source.hudDirty && nowMs >= source.nextTransientHudRefreshAt) {
      source.hudDirty = true;
    }
    if (source.hudDirty) {
      renderHud();
      source.hudDirty = false;
    }
    this.updateMinimap(nowMs);
    source.renderDiagnosticsPanel(nowMs);
  }

  runActiveFrame(nowMs: number, deltaMs: number, renderHud: () => void): void {
    const source = this.source;
    source.progressionChoiceRuntime.maybePromptLevelUpChoice(nowMs, "runtime_tick");
    if (source.isBlockingOverlayOpen()) {
      this.runEventPanelFrame(nowMs, renderHud);
      return;
    }

    const playerHazardMovementMultiplier = source.hazardRuntimeModule.resolvePlayerHazardMovementMultiplier();
    const mutationMoveMultiplier = source.resolveMutationMoveSpeedMultiplier();

    source.updateKeyboardMoveIntent(nowMs);
    source.updatePlayerMovement((deltaMs / 1000) * playerHazardMovementMultiplier * mutationMoveMultiplier, nowMs);
    source.playerActionModule.applySpecialAffixHealthRegen(deltaMs);
    source.playerActionModule.applyPassiveManaRegen(deltaMs);
    source.updateRuntimeBuffs(nowMs);
    source.phase6Telemetry.sampleManaDryWindow(
      source.player.mana,
      source.resolveMinimumActiveSkillManaCost(),
      deltaMs
    );
    source.progressionRuntimeModule.revealNearbyHiddenRoomsByMutation(nowMs);
    source.encounterController.updateFrame({
      deltaSeconds: deltaMs / 1000,
      nowMs
    });
    source.worldEventController.updatePreResolution(nowMs);
    source.encounterController.updateChallenge(nowMs);

    source.renderSystem.syncPlayerSprite(source.playerSprite, source.player.position, source.playerYOffset, source.origin);
    source.renderSystem.syncMonsterSprites(source.entityManager.listMonsters(), source.origin);
    source.bossRuntimeModule.syncSprite();

    if (source.player.health <= 0) {
      source.runCompletionModule.finishRun(false);
      return;
    }

    if (source.floorConfig.isBossFloor && source.bossState !== null && source.bossState.health <= 0) {
      source.tasteRuntime.recordKeyKill("boss", source.run.currentFloor, "boss_kill", nowMs);
      source.deferredOutcomeRuntime.settle("boss_kill", nowMs);
      if (source.run.inEndless) {
        source.runCompletionModule.finishRun(true);
      } else {
        source.bossRuntimeModule.openVictoryChoice(nowMs);
      }
      return;
    }

    source.combatRuntime.updatePressurePeakRuntime(nowMs);
    source.worldEventController.updatePostResolution(nowMs);
    if (nowMs - source.lastAutoSaveAt >= AUTO_SAVE_INTERVAL_MS) {
      source.flushRunSave();
    }

    if (!source.hudDirty && nowMs >= source.nextTransientHudRefreshAt) {
      source.hudDirty = true;
    }
    if (source.hudDirty) {
      renderHud();
      source.hudDirty = false;
    }
    source.renderDiagnosticsPanel(nowMs);
  }

  updateMinimap(nowMs: number): void {
    const source = this.source;
    if (nowMs - source.lastMinimapRefreshAt < MINIMAP_REFRESH_INTERVAL_MS) {
      return;
    }
    source.lastMinimapRefreshAt = nowMs;

    const monsters = source.entityManager.listLivingMonsters().map((monster) => ({
      x: Math.round(monster.state.position.x),
      y: Math.round(monster.state.position.y)
    }));
    const loot = source.entityManager.listLoot().map((drop) => ({
      x: Math.round(drop.position.x),
      y: Math.round(drop.position.y)
    }));
    const staircase =
      source.staircaseState.visible === true
        ? {
            x: Math.round(source.staircaseState.position.x),
            y: Math.round(source.staircaseState.position.y)
          }
        : undefined;
    const eventNode =
      source.eventNode === null || source.eventNode.resolved
        ? undefined
        : {
            x: Math.round(source.eventNode.position.x),
            y: Math.round(source.eventNode.position.y)
          };

    source.uiManager.renderMinimap({
      player: {
        x: Math.round(source.player.position.x),
        y: Math.round(source.player.position.y)
      },
      monsters,
      loot,
      ...(staircase === undefined ? {} : { staircase }),
      ...(eventNode === undefined ? {} : { eventNode }),
      revealAll: source.mapRevealActive
    });
  }

  routeFeedback(input: FeedbackRouterInput): void {
    this.source.feedbackRouter.route(input);
  }

  dispatchFeedbackAction(action: FeedbackAction): void {
    const source = this.source;
    if (action.channel === "sfx") {
      source.sfxSystem.dispatch(action);
      return;
    }

    switch (action.cue) {
      case "combat_hit":
        source.vfxSystem.playCombatHit(this.resolveEntitySprite(action.targetId), action.amount, action.critical, action.weaponType);
        return;
      case "combat_dodge":
        source.vfxSystem.playCombatDodge(this.resolveEntitySprite(action.targetId));
        return;
      case "combat_death":
        source.vfxSystem.playCombatDeath(this.resolveEntitySprite(action.targetId));
        return;
      case "skill_cast":
        source.vfxSystem.playSkillCast(this.resolveEntitySprite(action.casterId), action.skillId);
        return;
      case "boss_phase":
        source.vfxSystem.playBossPhaseChange(this.resolveEntitySprite(action.bossId));
        return;
      case "rare_drop":
        source.vfxSystem.playRareDrop(action.rarity);
        return;
      case "build_formed":
        source.vfxSystem.playBuildFormed();
        return;
      case "boss_reward":
        source.vfxSystem.playBossReward();
        return;
      case "synergy_activated":
        source.vfxSystem.playSynergyActivated();
        return;
      case "power_spike":
        source.vfxSystem.playPowerSpike(action.major);
        return;
      case "hazard_trigger": {
        const mapped = gridToIso(
          action.position.x,
          action.position.y,
          source.tileWidth,
          source.tileHeight,
          source.origin.x,
          source.origin.y
        );
        source.vfxSystem.playHazardTrigger(mapped.x, mapped.y, action.hazardType);
        return;
      }
      case "level_up":
        source.vfxSystem.playLevelUp(this.resolveEntitySprite(action.playerId), action.level);
        return;
      default:
        return;
    }
  }

  private resolveEntitySprite(entityId: string): unknown {
    const source = this.source;
    if (entityId === source.player.id) {
      return source.playerSprite ?? null;
    }
    if (entityId === source.bossDef.id) {
      return source.bossSprite;
    }
    const monster = source.entityManager.findMonsterById(entityId);
    return monster?.sprite ?? null;
  }
}
