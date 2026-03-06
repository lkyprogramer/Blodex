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
import { DEBUG_COMMANDS, type DebugLogLevel } from "./types";

export interface DebugCommandHost {
  [key: string]: any;
}

export class DebugCommandRegistry {
  constructor(private readonly host: DebugCommandHost) {}

  help(): string[] {
    return DEBUG_COMMANDS.map((entry) => `${entry.combo}: ${entry.description}`);
  }

  showHelp(): void {
    for (const line of this.help()) {
      this.debugLog(line);
    }
  }

  diagnostics(): Record<string, unknown> {
    const snapshot = this.host.collectDiagnosticsSnapshot();
    console.info("[Blodex] diagnostics snapshot", snapshot);
    const entity = this.host.entityManager.getDiagnostics();
    this.debugLog(
      `Diag listeners=${this.host.eventBus.listenerCount()} monsters=${entity.monsters}/${entity.livingMonsters} loot=${entity.loot}`,
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
    console.info("[Blodex] lifecycle stress summary", summary);
    this.debugLog(`Lifecycle stress finished (${count} resets).`, "success");
    return summary;
  }

  addObols(amount: number): void {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    const normalized = Math.max(1, Math.floor(amount));
    this.host.run = addRunObols(this.host.run, normalized);
    this.host.hudDirty = true;
    this.debugLog(`Added ${normalized} Obol. Current: ${this.host.run.runEconomy.obols}.`, "success");
  }

  grantConsumables(charges: number): void {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    const normalized = Math.max(1, Math.floor(charges));
    for (const def of CONSUMABLE_DEFS) {
      this.host.consumables = grantConsumable(this.host.consumables, def.id, normalized);
    }
    this.host.hudDirty = true;
    this.debugLog(`Granted ${normalized} charges to all consumables.`, "success");
  }

  spawnEvent(eventId?: string): void {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    if (this.host.floorConfig.isBossFloor) {
      this.debugLog("Cannot spawn floor event on boss floor.", "warn");
      return;
    }

    const eventDef = this.pickDebugEvent(eventId);
    if (eventDef === null) {
      this.debugLog("No matching event definition found for this floor/biome.", "warn");
      return;
    }
    const position = this.resolveDebugEventPosition();
    if (position === null) {
      this.debugLog("No valid position to place debug event.", "warn");
      return;
    }

    this.host.eventRuntimeModule.consumeCurrentEvent();
    this.host.eventRuntimeModule.createEventNode(eventDef, position, this.host.time.now);
    this.host.eventRuntimeModule.openEventPanel(this.host.time.now);
    this.host.hudDirty = true;
    this.debugLog(`Spawned event ${eventDef.id}.`);
  }

  openMerchant(): void {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    if (this.host.floorConfig.isBossFloor) {
      this.debugLog("Merchant is unavailable on boss floor.", "warn");
      return;
    }
    const merchantEvent = RANDOM_EVENT_DEFS.find((entry) => entry.id === "wandering_merchant");
    if (merchantEvent === undefined) {
      this.debugLog("wandering_merchant event definition not found.", "warn");
      return;
    }
    const position = this.resolveDebugEventPosition();
    if (position === null) {
      this.debugLog("No valid position to open merchant.", "warn");
      return;
    }

    this.host.eventRuntimeModule.consumeCurrentEvent();
    this.host.eventRuntimeModule.createEventNode(merchantEvent, position, this.host.time.now);
    this.host.eventRuntimeModule.openMerchantPanel(this.host.time.now);
    this.host.hudDirty = true;
    this.debugLog("Opened wandering merchant panel.");
  }

  forceChallenge(): boolean {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (this.host.floorConfig.isBossFloor) {
      this.debugLog("Challenge room is unavailable on boss floor.", "warn");
      return false;
    }
    if (this.host.eventPanelOpen) {
      this.host.eventRuntimeModule.consumeCurrentEvent();
    }

    let challengeRoom = this.host.dungeon.rooms.find((room: { roomType: string }) => room.roomType === "challenge");
    if (challengeRoom === undefined) {
      const picked = chooseChallengeRoom(this.host.dungeon, this.host.eventRng);
      if (picked === null) {
        this.debugLog("No room available for challenge injection.", "warn");
        return false;
      }
      this.host.dungeon = markRoomAsChallenge(this.host.dungeon, picked.id);
      challengeRoom = this.host.dungeon.rooms.find((room: { id: string }) => room.id === picked.id);
    }
    if (challengeRoom === undefined) {
      this.debugLog("Challenge room injection failed.", "warn");
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
    this.debugLog(`Challenge room ready (${this.host.challengeWaveTotal} waves).`, "success");
    return true;
  }

  startChallenge(): boolean {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (this.host.challengeRoomState === null && !this.forceChallenge()) {
      return false;
    }
    if (this.host.challengeRoomState === null) {
      return false;
    }
    if (this.host.challengeRoomState.finished) {
      this.debugLog("Challenge already finished on this floor.", "warn");
      return false;
    }
    if (!this.host.challengeRoomState.started) {
      this.host.progressionRuntimeModule.startChallengeEncounter(this.host.time.now);
      this.debugLog("Challenge encounter started.", "success");
    } else {
      this.debugLog("Challenge encounter already active.", "info");
    }
    return true;
  }

  settleChallenge(success: boolean): boolean {
    if (!this.startChallenge() || this.host.challengeRoomState === null) {
      return false;
    }
    if (this.host.challengeRoomState.finished) {
      this.debugLog("Challenge already settled.", "warn");
      return false;
    }
    this.host.progressionRuntimeModule.finishChallengeEncounter(success, this.host.time.now);
    this.debugLog(`Challenge forced to ${success ? "success" : "failure"}.`, success ? "success" : "warn");
    return true;
  }

  openBossVictory(): boolean {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (!this.host.floorConfig.isBossFloor) {
      this.debugLog("Boss victory choice is only available on boss floor.", "warn");
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
    this.debugLog("Boss victory choice opened.", "success");
    return true;
  }

  enterAbyss(): boolean {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return false;
    }
    if (this.host.run.runMode === "daily") {
      this.debugLog("Daily mode cannot enter abyss.", "warn");
      return false;
    }
    if (this.host.run.inEndless) {
      this.debugLog("Already in abyss/endless.", "info");
      return true;
    }
    if (this.host.run.currentFloor < 5) {
      this.debugLog("Abyss entry requires reaching floor 5.", "warn");
      return false;
    }
    if (this.host.floorConfig.isBossFloor && this.host.bossState !== null && this.host.bossState.health > 0) {
      this.host.bossState = {
        ...this.host.bossState,
        health: 0
      };
    }
    this.host.runCompletionModule.enterAbyss(this.host.time.now);
    this.debugLog(`Forced abyss entry at floor ${this.host.run.currentFloor}.`, "success");
    return true;
  }

  nextFloor(): boolean {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
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
    this.debugLog(
      `Advanced to floor ${this.host.run.currentFloor}${this.host.run.inEndless ? ` (endless ${this.host.run.endlessFloor})` : ""}.`,
      "success"
    );
    return true;
  }

  forceSynergy(synergyId: string): string[] {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return [];
    }
    if (synergyId !== "syn_staff_chain_lightning_overload") {
      this.debugLog(`Unsupported synergy preset: ${synergyId}.`, "warn");
      return [...this.host.synergyRuntime.activeSynergyIds];
    }

    const nowMs = this.host.time.now;
    const existingSkills = this.host.player.skills;
    if (existingSkills === undefined) {
      this.debugLog("Player skills are unavailable; cannot inject synergy preset.", "warn");
      return [...this.host.synergyRuntime.activeSynergyIds];
    }
    const slots = [...existingSkills.skillSlots];
    slots[0] = { defId: "chain_lightning", level: 1 };
    const staffItem: ItemInstance = {
      id: `debug_synergy_staff_${Math.floor(nowMs)}`,
      defId: "sovereign_requiem",
      name: "Debug Sovereign Requiem",
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
    this.debugLog(`Forced synergy preset ${synergyId}. Active: ${activeSynergyIds.join(", ") || "none"}.`, "success");
    return activeSynergyIds;
  }

  clearFloor(): void {
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return;
    }
    const nowMs = this.host.time.now;

    if (this.host.floorConfig.isBossFloor) {
      if (this.host.bossState === null) {
        this.debugLog("Boss runtime not ready.", "warn");
        return;
      }
      this.host.bossState = {
        ...this.host.bossState,
        health: 0
      };
      this.host.hudDirty = true;
      this.debugLog("Boss health set to 0. Triggering victory summary.", "success");
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
    this.debugLog(
      `Cleared floor instantly (${removed} monsters removed, ${simulatedDrops} drops, +${simulatedLevelUps} levels).`,
      "success"
    );
  }

  jumpFloor(targetFloor: number): void {
    const maxFloors = GAME_CONFIG.maxFloors ?? 5;
    const normalized = Math.max(1, Math.min(maxFloors, Math.floor(targetFloor)));
    if (!Number.isFinite(normalized)) {
      this.debugLog(`Invalid floor index: ${targetFloor}`, "warn");
      return;
    }

    if (this.host.runEnded) {
      this.host.uiManager.clearSummary();
      this.host.uiManager.hideDeathOverlay();
      this.host.runEnded = false;
    }
    if (this.host.run.currentFloor === normalized) {
      this.debugLog(`Already on floor ${normalized}.`);
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
    this.debugLog(`Jumped to floor ${normalized}.`, "success");
  }

  killPlayer(): void {
    if (this.host.runEnded) {
      this.debugLog("Run already ended.", "warn");
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
    if (this.host.runEnded) {
      this.debugLog("Run already ended; start a new run first.", "warn");
      return this.host.player.health;
    }
    const normalized = Math.max(0, Math.min(this.host.player.derivedStats.maxHealth, Math.floor(value)));
    this.host.player = {
      ...this.host.player,
      health: normalized
    };
    this.host.hudDirty = true;
    this.debugLog(`Set HP to ${normalized}/${Math.floor(this.host.player.derivedStats.maxHealth)}.`, "info");
    return normalized;
  }

  private debugLog(message: string, level: DebugLogLevel = "info"): void {
    this.host.runLog.debug(message, level, this.host.time.now);
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
