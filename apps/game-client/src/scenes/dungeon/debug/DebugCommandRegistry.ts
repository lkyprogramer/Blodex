import Phaser from "phaser";
import {
  addRunObols,
  advanceEndlessFloor,
  appendReplayInput,
  applyXpGain,
  chooseChallengeRoom,
  CONSUMABLE_DEFS,
  createChallengeRoomState,
  endlessFloorClearBonus,
  enterNextFloor,
  grantConsumable,
  markRoomAsChallenge,
  rollItemDrop,
  type ItemDef,
  type ItemInstance,
  type RandomEventDef
} from "@blodex/core";
import { GAME_CONFIG, ITEM_DEF_MAP, LOOT_TABLE_MAP, RANDOM_EVENT_DEFS } from "@blodex/content";
import { t } from "../../../i18n";
import type { MessageParams } from "../../../i18n/types";
import { describeDebugCommands, type DebugLogLevel } from "./types";
import type { DebugCommandHost } from "./ports";

export class DebugCommandRegistry {
  constructor(private readonly host: DebugCommandHost) {}

  help(): string[] {
    return describeDebugCommands();
  }

  showHelp(): void {
    for (const line of this.help()) {
      this.debugLog(line);
    }
  }

  diagnostics(): Record<string, unknown> {
    const snapshot = this.host.collectDiagnosticsSnapshot();
    console.info(t("log.debug.console_diagnostics_snapshot"), snapshot);
    const entity = this.host.entityManager.getDiagnostics();
    this.debugLogKey(
      "log.debug.diagnostics_summary",
      {
        listeners: this.host.eventBus.listenerCount(),
        monsters: entity.monsters,
        livingMonsters: entity.livingMonsters,
        loot: entity.loot
      },
      "info"
    );
    return snapshot;
  }

  stressRuns(iterations: number): Record<string, unknown> {
    const count = Math.max(1, Math.min(50, Math.floor(iterations)));
    const before = this.host.collectDiagnosticsSnapshot();
    for (let i = 0; i < count; i += 1) {
      this.host.bootstrapRun(`stress-${this.host.time.now}-${i}`, this.host.selectedDifficulty);
    }
    this.host.hudDirty = true;
    const after = this.host.collectDiagnosticsSnapshot();
    const summary = {
      iterations: count,
      before,
      after
    };
    console.info(t("log.debug.console_lifecycle_summary"), summary);
    this.debugLogKey("log.debug.lifecycle_stress_finished", { count }, "success");
    return summary;
  }

  addObols(amount: number): void {
    if (!this.ensureRunActive()) {
      return;
    }
    const normalized = Math.max(1, Math.floor(amount));
    this.host.run = addRunObols(this.host.run, normalized);
    this.host.hudDirty = true;
    this.debugLogKey(
      "log.debug.obols_added",
      {
        added: normalized,
        current: this.host.run.runEconomy.obols
      },
      "success"
    );
  }

  grantConsumables(charges: number): void {
    if (!this.ensureRunActive()) {
      return;
    }
    const normalized = Math.max(1, Math.floor(charges));
    for (const def of CONSUMABLE_DEFS) {
      this.host.consumables = grantConsumable(this.host.consumables, def.id, normalized);
    }
    this.host.hudDirty = true;
    this.debugLogKey("log.debug.consumables_granted", { charges: normalized }, "success");
  }

  spawnEvent(eventId?: string): void {
    if (!this.ensureRunActive()) {
      return;
    }
    if (this.host.floorConfig.isBossFloor) {
      this.debugLogKey("log.debug.event_boss_floor_blocked", undefined, "warn");
      return;
    }

    const eventDef = this.pickDebugEvent(eventId);
    if (eventDef === null) {
      this.debugLogKey("log.debug.event_definition_missing", undefined, "warn");
      return;
    }
    const position = this.resolveDebugEventPosition();
    if (position === null) {
      this.debugLogKey("log.debug.event_position_missing", undefined, "warn");
      return;
    }

    this.host.eventRuntimeModule.consumeCurrentEvent();
    this.host.eventRuntimeModule.createEventNode(eventDef, position, this.host.time.now);
    this.host.eventRuntimeModule.openEventPanel(this.host.time.now);
    this.host.hudDirty = true;
    this.debugLogKey("log.debug.event_spawned", { eventId: eventDef.id });
  }

  openMerchant(): void {
    if (!this.ensureRunActive()) {
      return;
    }
    if (this.host.floorConfig.isBossFloor) {
      this.debugLogKey("log.debug.merchant_boss_floor_blocked", undefined, "warn");
      return;
    }
    const merchantEvent = RANDOM_EVENT_DEFS.find((entry) => entry.id === "wandering_merchant");
    if (merchantEvent === undefined) {
      this.debugLogKey("log.debug.merchant_definition_missing", { eventId: "wandering_merchant" }, "warn");
      return;
    }
    const position = this.resolveDebugEventPosition();
    if (position === null) {
      this.debugLogKey("log.debug.merchant_position_missing", undefined, "warn");
      return;
    }

    this.host.eventRuntimeModule.consumeCurrentEvent();
    this.host.eventRuntimeModule.createEventNode(merchantEvent, position, this.host.time.now);
    this.host.eventRuntimeModule.openMerchantPanel(this.host.time.now);
    this.host.hudDirty = true;
    this.debugLogKey("log.debug.merchant_opened_panel");
  }

  forceChallenge(): boolean {
    if (!this.ensureRunActive()) {
      return false;
    }
    if (this.host.floorConfig.isBossFloor) {
      this.debugLogKey("log.debug.challenge_boss_floor_blocked", undefined, "warn");
      return false;
    }
    if (this.host.eventPanelOpen) {
      this.host.eventRuntimeModule.consumeCurrentEvent();
    }

    let challengeRoom = this.host.dungeon.rooms.find((room) => room.roomType === "challenge");
    if (challengeRoom === undefined) {
      const picked = chooseChallengeRoom(this.host.dungeon, this.host.eventRng);
      if (picked === null) {
        this.debugLogKey("log.debug.challenge_room_unavailable", undefined, "warn");
        return false;
      }
      this.host.dungeon = markRoomAsChallenge(this.host.dungeon, picked.id);
      challengeRoom = this.host.dungeon.rooms.find((room) => room.id === picked.id);
    }
    if (challengeRoom === undefined) {
      this.debugLogKey("log.debug.challenge_injection_failed", undefined, "warn");
      return false;
    }

    this.host.progressionRuntimeModule.removeChallengeMonsters();
    this.host.progressionRuntimeModule.clearChallengeState();
    this.host.challengeRoomState = createChallengeRoomState(challengeRoom.id);
    this.host.challengeWaveTotal = this.host.progressionRuntimeModule.resolveChallengeWaveTotal(challengeRoom.id);
    const center = this.host.progressionRuntimeModule.challengeRoomCenter(challengeRoom.id);
    if (center !== null) {
      this.host.challengeMarker = this.host.renderSystem.spawnTelegraphCircle(center, 0.95, this.host.origin);
      this.host.challengeMarker.setAlpha(0.2);
      if (this.host.challengeMarker instanceof Phaser.GameObjects.Image) {
        this.host.challengeMarker.setTint(0x9c6ac4);
      }
    }
    this.host.hudDirty = true;
    this.host.scheduleRunSave();
    this.debugLogKey("log.debug.challenge_ready", { waves: this.host.challengeWaveTotal }, "success");
    return true;
  }

  startChallenge(): boolean {
    if (!this.ensureRunActive()) {
      return false;
    }
    if (this.host.challengeRoomState === null && !this.forceChallenge()) {
      return false;
    }
    if (this.host.challengeRoomState === null) {
      return false;
    }
    if (this.host.challengeRoomState.finished) {
      this.debugLogKey("log.debug.challenge_finished", undefined, "warn");
      return false;
    }
    if (!this.host.challengeRoomState.started) {
      this.host.progressionRuntimeModule.startChallengeEncounter(this.host.time.now);
      this.debugLogKey("log.debug.challenge_started", undefined, "success");
    } else {
      this.debugLogKey("log.debug.challenge_active");
    }
    return true;
  }

  settleChallenge(success: boolean): boolean {
    if (!this.startChallenge() || this.host.challengeRoomState === null) {
      return false;
    }
    if (this.host.challengeRoomState.finished) {
      this.debugLogKey("log.debug.challenge_settled", undefined, "warn");
      return false;
    }
    this.host.progressionRuntimeModule.finishChallengeEncounter(success, this.host.time.now);
    this.debugLogKey(
      "log.debug.challenge_forced",
      {
        result: t(success ? "log.debug.challenge_result.success" : "log.debug.challenge_result.failure")
      },
      success ? "success" : "warn"
    );
    return true;
  }

  openBossVictory(): boolean {
    if (!this.ensureRunActive()) {
      return false;
    }
    if (!this.host.floorConfig.isBossFloor) {
      this.debugLogKey("log.debug.boss_victory_requires_boss_floor", undefined, "warn");
      return false;
    }
    if (this.host.bossState !== null && this.host.bossState.health > 0) {
      this.host.bossState = {
        ...this.host.bossState,
        health: 0
      };
    }
    this.host.bossRuntimeModule.openVictoryChoice(this.host.time.now);
    this.host.hudDirty = true;
    this.debugLogKey("log.debug.boss_victory_opened", undefined, "success");
    return true;
  }

  enterAbyss(): boolean {
    if (!this.ensureRunActive()) {
      return false;
    }
    if (this.host.run.runMode === "daily") {
      this.debugLogKey("log.debug.daily_cannot_enter_abyss", undefined, "warn");
      return false;
    }
    if (this.host.run.inEndless) {
      this.debugLogKey("log.debug.already_in_abyss");
      return true;
    }
    if (this.host.run.currentFloor < 5) {
      this.debugLogKey("log.debug.abyss_requires_floor_five", undefined, "warn");
      return false;
    }
    if (this.host.floorConfig.isBossFloor && this.host.bossState !== null && this.host.bossState.health > 0) {
      this.host.bossState = {
        ...this.host.bossState,
        health: 0
      };
    }
    this.host.runCompletionModule.enterAbyss(this.host.time.now);
    this.debugLogKey("log.debug.abyss_entered", { floor: this.host.run.currentFloor }, "success");
    return true;
  }

  nextFloor(): boolean {
    if (!this.ensureRunActive()) {
      return false;
    }
    if (this.host.floorConfig.isBossFloor && !this.host.run.inEndless) {
      return this.openBossVictory();
    }
    const fromFloor = this.host.run.currentFloor;
    this.host.run = appendReplayInput(this.host.run, {
      type: "floor_transition",
      atMs: this.host.getRunRelativeNowMs(),
      fromFloor,
      toFloor: fromFloor + 1
    });
    this.host.run = enterNextFloor(this.host.run);
    if (this.host.run.inEndless) {
      this.host.run = advanceEndlessFloor(this.host.run);
      this.host.syncEndlessMutators(this.host.time.now);
      this.host.run = addRunObols(
        this.host.run,
        endlessFloorClearBonus(this.host.run.currentFloor, this.host.run.mutatorActiveIds ?? [])
      );
    } else {
      this.host.run = addRunObols(this.host.run, 5);
    }
    this.host.progressionRuntimeModule.setupFloor(this.host.run.currentFloor, false);
    this.host.deferredOutcomeRuntime.settle("floor_reached", this.host.time.now);
    this.host.flushRunSave();
    this.debugLogKey(
      this.host.run.inEndless ? "log.debug.floor_advanced_endless" : "log.debug.floor_advanced",
      {
        floor: this.host.run.currentFloor,
        endlessFloor: this.host.run.endlessFloor ?? 0
      },
      "success"
    );
    return true;
  }

  forceSynergy(synergyId: string): string[] {
    if (!this.ensureRunActive()) {
      return [];
    }
    if (synergyId !== "syn_staff_chain_lightning_overload") {
      this.debugLogKey("log.debug.unsupported_synergy_preset", { synergyId }, "warn");
      return [...this.host.synergyRuntime.activeSynergyIds];
    }

    const nowMs = this.host.time.now;
    const existingSkills = this.host.player.skills;
    if (existingSkills === undefined) {
      this.debugLogKey("log.debug.synergy_skills_unavailable", undefined, "warn");
      return [...this.host.synergyRuntime.activeSynergyIds];
    }
    const slots = [...existingSkills.skillSlots];
    slots[0] = { defId: "chain_lightning", level: 1 };
    const staffItem: ItemInstance = {
      id: `debug_synergy_staff_${Math.floor(nowMs)}`,
      defId: "sovereign_requiem",
      name: t("ui.debug.item.sovereign_requiem"),
      kind: "unique",
      slot: "weapon",
      weaponType: "staff",
      rarity: "rare",
      requiredLevel: 1,
      iconId: "item_weapon_03",
      seed: `debug-synergy-${this.host.runSeed}`,
      rolledAffixes: {
        attackPower: 22,
        critChance: 0.04,
        attackSpeed: 4
      },
      rolledSpecialAffixes: {
        lifesteal: 0.06,
        critDamage: 0.22
      }
    };
    this.host.player = this.host.refreshPlayerStatsFromEquipment({
      ...this.host.player,
      equipment: {
        ...this.host.player.equipment,
        weapon: staffItem
      },
      skills: {
        ...existingSkills,
        skillSlots: slots,
        cooldowns: {
          ...existingSkills.cooldowns,
          chain_lightning: 0
        }
      }
    });
    this.host.refreshSynergyRuntime();
    this.host.hudDirty = true;
    this.host.scheduleRunSave();
    const activeSynergyIds = [...this.host.synergyRuntime.activeSynergyIds];
    this.debugLogKey(
      "log.debug.synergy_forced",
      {
        synergyId,
        activeList: this.activeListLabel(activeSynergyIds)
      },
      "success"
    );
    return activeSynergyIds;
  }

  clearFloor(): void {
    if (!this.ensureRunActive()) {
      return;
    }
    const nowMs = this.host.time.now;

    if (this.host.floorConfig.isBossFloor) {
      if (this.host.bossState === null) {
        this.debugLogKey("log.debug.boss_runtime_not_ready", undefined, "warn");
        return;
      }
      this.host.bossState = {
        ...this.host.bossState,
        health: 0
      };
      this.host.hudDirty = true;
      this.debugLogKey("log.debug.boss_health_zero_victory", undefined, "success");
      this.host.runCompletionModule.finishRun(true);
      return;
    }

    let removed = 0;
    let simulatedDrops = 0;
    let simulatedLevelUps = 0;
    while (true) {
      const living = [...this.host.entityManager.listLivingMonsters()];
      if (living.length === 0) {
        break;
      }
      let removedThisPass = 0;
      for (const monster of living) {
        const dead = this.host.entityManager.removeMonsterById(monster.state.id);
        if (dead === null) {
          continue;
        }
        this.host.progressionRuntimeModule.onMonsterDefeated(dead.state, nowMs);
        const xpResult = applyXpGain(this.host.player, dead.state.xpValue, "manual");
        this.host.player = this.host.refreshPlayerStatsFromEquipment(xpResult.player);
        if (xpResult.leveledUp) {
          simulatedLevelUps += xpResult.levelsGained;
          this.host.handleLevelUpGain(xpResult.levelsGained, nowMs, "debug_clear");
        }
        const lootTable = LOOT_TABLE_MAP[dead.state.dropTableId];
        if (lootTable !== undefined) {
          const droppedItem = rollItemDrop(
            lootTable,
            ITEM_DEF_MAP,
            this.host.run.currentFloor,
            this.host.lootRng,
            `debug-clear-${this.host.run.currentFloor}-${dead.state.id}-${Math.floor(nowMs)}`,
            this.host.resolveLootRollOptions({
              isItemEligible: (itemDef: ItemDef) => this.host.isItemDefUnlocked(itemDef)
            })
          );
          if (droppedItem !== null) {
            simulatedDrops += 1;
            this.host.spawnLootDrop(droppedItem, dead.state.position);
            this.host.eventBus.emit("loot:drop", {
              sourceId: dead.state.id,
              item: droppedItem,
              position: dead.state.position,
              timestampMs: nowMs
            });
          }
        }
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();
        dead.affixMarker?.destroy();
        removed += 1;
        removedThisPass += 1;
      }
      if (removedThisPass === 0) {
        break;
      }
    }

    const revealThreshold = Math.ceil(this.host.floorConfig.monsterCount * this.host.floorConfig.clearThreshold);
    const nextKills = Math.max(this.host.run.kills + removed, revealThreshold);
    this.host.run = addRunObols(
      {
        ...this.host.run,
        kills: nextKills,
        totalKills: this.host.run.totalKills + removed,
        endlessKills: (this.host.run.endlessKills ?? 0) + (this.host.run.inEndless ? removed : 0)
      },
      removed
    );

    if (!this.host.staircaseState.visible) {
      this.host.staircaseState = {
        ...this.host.staircaseState,
        visible: true
      };
      this.host.progressionRuntimeModule.renderStaircases();
      this.host.eventBus.emit("floor:clear", {
        floor: this.host.run.currentFloor,
        kills: this.host.run.kills,
        staircase: this.host.staircaseState,
        timestampMs: nowMs
      });
      this.host.tryDiscoverBlueprints("floor_clear", nowMs);
    }

    this.host.hudDirty = true;
    this.debugLogKey(
      "log.debug.floor_cleared_instantly",
      {
        monstersRemoved: removed,
        drops: simulatedDrops,
        levelsGained: simulatedLevelUps
      },
      "success"
    );
  }

  jumpFloor(targetFloor: number): void {
    const maxFloors = GAME_CONFIG.maxFloors ?? 5;
    const normalized = Math.max(1, Math.min(maxFloors, Math.floor(targetFloor)));
    if (!Number.isFinite(normalized)) {
      this.debugLogKey("log.debug.floor_invalid_index", { floor: targetFloor }, "warn");
      return;
    }

    if (this.host.runEnded) {
      this.host.uiManager.clearSummary();
      this.host.uiManager.hideDeathOverlay();
      this.host.runEnded = false;
    }
    if (this.host.run.currentFloor === normalized) {
      this.debugLogKey("log.debug.floor_already_current", { floor: normalized });
      return;
    }

    this.host.run = appendReplayInput(this.host.run, {
      type: "floor_transition",
      atMs: this.host.getRunRelativeNowMs(),
      fromFloor: this.host.run.currentFloor,
      toFloor: normalized
    });
    this.host.run = {
      ...this.host.run,
      currentFloor: normalized,
      floor: normalized
    };
    this.host.progressionRuntimeModule.setupFloor(normalized, false);
    this.host.hudDirty = true;
    this.debugLogKey("log.debug.floor_jumped", { floor: normalized }, "success");
  }

  killPlayer(): void {
    if (this.host.runEnded) {
      this.debugLogKey("log.debug.run_ended", undefined, "warn");
      return;
    }
    this.host.lastDeathReason = t("log.debug.kill_player.death_reason");
    this.host.player = {
      ...this.host.player,
      health: 0
    };
    this.host.hudDirty = true;
    this.debugLog(t("log.debug.forced_player_death"), "danger");
    this.host.runCompletionModule.finishRun(false);
  }

  setHealth(value: number): number {
    if (!this.ensureRunActive()) {
      return this.host.player.health;
    }
    const normalized = Math.max(0, Math.min(this.host.player.derivedStats.maxHealth, Math.floor(value)));
    this.host.player = {
      ...this.host.player,
      health: normalized
    };
    this.host.hudDirty = true;
    this.debugLogKey(
      "log.debug.health_set",
      {
        current: normalized,
        max: Math.floor(this.host.player.derivedStats.maxHealth)
      },
      "info"
    );
    return normalized;
  }

  private debugLog(message: string, level: DebugLogLevel = "info"): void {
    this.host.runLog.debug(message, level, this.host.time.now);
  }

  private debugLogKey(key: string, params?: MessageParams, level: DebugLogLevel = "info"): void {
    this.debugLog(t(key, params), level);
  }

  private ensureRunActive(): boolean {
    if (!this.host.runEnded) {
      return true;
    }
    this.debugLogKey("log.debug.run_ended_start_new", undefined, "warn");
    return false;
  }

  private activeListLabel(values: readonly string[]): string {
    return values.length > 0 ? values.join(", ") : t("log.debug.none");
  }

  private isWalkableGridPoint(point: { x: number; y: number }): boolean {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x < 0 || y < 0 || x >= this.host.dungeon.width || y >= this.host.dungeon.height) {
      return false;
    }
    return this.host.dungeon.walkable[y]?.[x] === true;
  }

  private resolveDebugEventPosition(): { x: number; y: number } | null {
    const offsets = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 }
    ];
    for (const offset of offsets) {
      const candidate = {
        x: Math.round(this.host.player.position.x + offset.x),
        y: Math.round(this.host.player.position.y + offset.y)
      };
      if (this.isWalkableGridPoint(candidate)) {
        return candidate;
      }
    }
    return this.host.pickFloorEventPosition();
  }

  private pickDebugEvent(eventId?: string): RandomEventDef | null {
    if (eventId !== undefined) {
      return RANDOM_EVENT_DEFS.find((entry) => entry.id === eventId) ?? null;
    }
    const eligible = RANDOM_EVENT_DEFS.filter((entry) => {
      const floorOk = this.host.run.currentFloor >= entry.floorRange.min && this.host.run.currentFloor <= entry.floorRange.max;
      const biomeOk = entry.biomeIds === undefined || entry.biomeIds.includes(this.host.currentBiome.id);
      return floorOk && biomeOk;
    });
    if (eligible.length === 0) {
      return null;
    }
    const sorted = [...eligible].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[0] ?? null;
  }
}
