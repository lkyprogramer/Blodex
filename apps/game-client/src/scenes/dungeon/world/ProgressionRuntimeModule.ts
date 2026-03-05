import Phaser from "phaser";
import {
  addRunObols,
  advanceChallengeRoomWave,
  applyAffixesToMonsterState,
  chooseChallengeRoom,
  createChallengeRoomState,
  createStaircaseState,
  defaultBaseStats,
  deriveFloorSeed,
  deriveStats,
  failChallengeRoom,
  generateBossRoom,
  generateDungeon,
  markRoomAsChallenge,
  resolveBiomeForFloorBySeed,
  resolveEndlessAffixBonusCount,
  rollItemDrop,
  rollMonsterAffixes,
  shouldFailChallengeRoomByTimeout,
  shouldSpawnChallengeRoom,
  startChallengeRoom,
  type ItemDef,
  type MonsterState,
  type PlayerState,
  type RandomEventDef
} from "@blodex/core";
import {
  BIOME_MAP,
  BLUEPRINT_DEF_MAP,
  GAME_CONFIG,
  getFloorConfig,
  ITEM_DEF_MAP,
  MONSTER_ARCHETYPES,
  SKILL_DEFS
} from "@blodex/content";
import { t } from "../../../i18n";
import { gridToIso } from "../../../systems/iso";
import { playSceneTransition } from "../../../ui/SceneTransitionOverlay";
import { resolveDebugLockedEquipEnabled } from "../debug/debugFlags";
import { injectDebugLockedEquipment } from "../debug/injectDebugLockedEquipment";
import { resolveBiomeVisualTheme } from "../presentation/BiomeVisualThemeRegistry";

export interface ProgressionRuntimeHost {
  [key: string]: any;
}

export interface ProgressionRuntimeModuleOptions {
  host: ProgressionRuntimeHost;
}

export class ProgressionRuntimeModule {
  constructor(private readonly options: ProgressionRuntimeModuleOptions) {}

  setupFloor(floor: number, initial: boolean): void {
    const host = this.options.host;
    host.children.removeAll(true);
    host.entityManager.clear();
    host.hazardRuntimeModule.clearHazards();
    this.clearHiddenRoomMarkers();
    this.clearChallengeState();
    host.movementSystem.clearPathCache();

    host.floorConfig = getFloorConfig(floor, host.run.difficultyModifier);
    host.configureRngStreams(floor);
    const rolledBiomeId = resolveBiomeForFloorBySeed(floor, host.runSeed, host.run.branchChoice);
    const biomeId = host.unlockedBiomeIds.has(rolledBiomeId) ? rolledBiomeId : "forgotten_catacombs";
    host.currentBiome = BIOME_MAP[biomeId] ?? BIOME_MAP.forgotten_catacombs;
    host.mapRevealActive = false;
    host.eventPanelOpen = false;
    host.merchantOffers = [];
    host.uiManager.hideEventPanel();
    host.eventRuntimeModule.destroyEventNode();

    host.dungeon = host.floorConfig.isBossFloor ? this.renderBossFloor(floor) : this.renderNormalFloor(floor);

    host.player = initial ? this.makeInitialPlayer() : host.refreshPlayerStatsFromEquipment(host.player);
    host.player = {
      ...host.player,
      position: { ...host.dungeon.playerSpawn }
    };
    if (initial && host.run.runMode === "daily") {
      host.player = host.applyDailyLoadout(host.player, host.time.now);
    }
    if (
      initial &&
      resolveDebugLockedEquipEnabled({
        debugCheatsEnabled: host.debugCheatsEnabled,
        queryKey: host.debugLockedEquipQuery
      })
    ) {
      host.player = injectDebugLockedEquipment({
        player: host.player,
        nowMs: host.time.now,
        runSeed: host.runSeed,
        iconId: host.debugLockedEquipIconId,
        runLog: host.runLog
      });
    }
    host.entityLabelById.set(host.player.id, t("ui.hud.player.title"));

    host.path = [];
    host.attackTargetId = null;
    host.manualMoveTarget = null;
    host.manualMoveTargetFailures = 0;
    host.nextManualPathReplanAt = 0;
    host.nextPlayerAttackAt = 0;
    host.nextBossAttackAt = 0;
    host.bossState = null;
    host.bossSprite = null;
    host.staircaseState = createStaircaseState(host.dungeon, host.dungeon.playerSpawn, floor);

    const world = host.renderSystem.computeWorldBounds(host.dungeon);
    host.origin = world.origin;
    host.worldBounds = world.worldBounds;
    const biomeVisualTheme = resolveBiomeVisualTheme(host.currentBiome);
    host.cameras.main.setBackgroundColor(Phaser.Display.Color.IntegerToColor(host.currentBiome.ambientColor).rgba);
    host.renderSystem.drawDungeon(host.dungeon, host.origin, {
      tileKey: biomeVisualTheme.floorTileKey,
      tintColor: biomeVisualTheme.tileTint
    });
    this.renderHiddenRoomMarkers();

    const playerRender = host.renderSystem.spawnPlayer(host.player.position, host.origin);
    host.playerSprite = playerRender.sprite;
    host.playerYOffset = playerRender.yOffset;
    host.hazardRuntimeModule.initializeHazards(host.time.now);

    if (host.floorConfig.isBossFloor) {
      host.bossRuntimeModule.spawn();
    } else {
      host.spawnMonsters();
      host.eventRuntimeModule.setupFloorEvent(host.time.now);
      this.initializeChallengeRoom(host.time.now);
    }

    host.renderSystem.configureCamera(host.cameras.main, host.worldBounds, host.playerSprite);

    host.run = {
      ...host.run,
      currentFloor: floor,
      currentBiomeId: host.currentBiome.id,
      floor,
      kills: 0
    };
    host.resetFloorChoiceBudget(floor, host.time.now);
    host.uiManager.configureMinimap({
      width: host.dungeon.width,
      height: host.dungeon.height,
      walkable: host.dungeon.walkable,
      layoutHash: host.dungeon.layoutHash
    });
    host.uiManager.resetMinimap();
    host.lastMinimapRefreshAt = 0;
    host.updateMinimap(host.time.now);
    host.refreshSynergyRuntime();

    host.hudDirty = true;
    host.runEnded = false;

    if (!initial) {
      playSceneTransition({
        title: `Floor ${floor}`,
        subtitle: host.currentBiome.name,
        mode: "floor",
        durationMs: 420
      });
    }

    if (!initial) {
      host.eventBus.emit("floor:enter", {
        floor,
        biomeId: host.currentBiome.id,
        timestampMs: host.time.now
      });
    }
  }

  private makeInitialPlayer(): PlayerState {
    const host = this.options.host;
    const baseStatsSeed = defaultBaseStats();
    const baseStats = {
      strength: baseStatsSeed.strength + (host.talentEffects.baseStats.strength ?? 0),
      dexterity: baseStatsSeed.dexterity + (host.talentEffects.baseStats.dexterity ?? 0),
      vitality: baseStatsSeed.vitality + (host.talentEffects.baseStats.vitality ?? 0),
      intelligence: baseStatsSeed.intelligence + (host.talentEffects.baseStats.intelligence ?? 0)
    };
    const derivedStats = deriveStats(
      baseStats,
      [],
      undefined,
      host.meta.permanentUpgrades,
      host.talentEffects
    );
    const startingSkillIds = this.pickStartingSkillIds();
    return {
      id: "player",
      position: { ...host.dungeon.playerSpawn },
      level: 1,
      xp: 0,
      xpToNextLevel: 98,
      pendingLevelUpChoices: 0,
      health: derivedStats.maxHealth,
      mana: derivedStats.maxMana,
      baseStats,
      derivedStats,
      inventory: [],
      equipment: {},
      gold: 0,
      skills: {
        skillSlots: Array.from({ length: Math.min(4, Math.max(2, host.meta.permanentUpgrades.skillSlots)) }, (_, idx) => {
          const id = startingSkillIds[idx];
          return id === undefined ? null : { defId: id, level: 1 };
        }),
        cooldowns: {}
      },
      activeBuffs: []
    };
  }

  private pickStartingSkillIds(): string[] {
    const host = this.options.host;
    const forgedSkillUnlocks = new Set(
      host.meta.blueprintForgedIds
        .map((blueprintId: string) => BLUEPRINT_DEF_MAP[blueprintId])
        .filter((blueprint: { category?: string } | undefined) => blueprint?.category === "skill")
        .map((blueprint: { unlockTargetId?: string } | undefined) => blueprint?.unlockTargetId)
        .filter((skillId: string | undefined): skillId is string => typeof skillId === "string")
    );
    const pool = SKILL_DEFS.filter((skill) => {
      if (skill.unlockCondition === undefined) {
        return true;
      }
      return host.meta.unlocks.includes(skill.unlockCondition) || forgedSkillUnlocks.has(skill.unlockCondition);
    });
    return [...pool]
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 2)
      .map((entry) => entry.id);
  }

  renderStaircases(): void {
    const host = this.options.host;
    if (!host.staircaseState.visible) {
      host.entityManager.setStaircases([]);
      return;
    }
    if (host.staircaseState.kind === "branch" && host.staircaseState.options !== undefined) {
      host.entityManager.setStaircases(
        host.staircaseState.options.map((option: { position: { x: number; y: number } }) =>
          host.renderSystem.spawnStaircase(option.position, host.origin)
        )
      );
      return;
    }
    host.entityManager.setStaircase(host.renderSystem.spawnStaircase(host.staircaseState.position, host.origin));
  }

  revealHiddenRoom(roomId: string, nowMs: number, source: "click" | "mutation"): boolean {
    const host = this.options.host;
    const hiddenRooms = host.dungeon.hiddenRooms ?? [];
    const target = hiddenRooms.find((entry: { roomId: string }) => entry.roomId === roomId);
    if (target === undefined || target.revealed) {
      return false;
    }

    target.revealed = true;
    const row = host.dungeon.walkable[target.entrance.y];
    if (row !== undefined) {
      row[target.entrance.x] = true;
    }
    host.movementSystem.clearPathCache();
    host.path = [];
    host.manualMoveTarget = null;
    host.manualMoveTargetFailures = 0;

    host.hiddenEntranceMarkers.get(roomId)?.destroy();
    host.hiddenEntranceMarkers.delete(roomId);
    host.uiManager.configureMinimap({
      width: host.dungeon.width,
      height: host.dungeon.height,
      walkable: host.dungeon.walkable,
      layoutHash: host.dungeon.layoutHash
    });

    host.runLog.appendKey(
      source === "click" ? "log.hidden_room.revealed_click" : "log.hidden_room.revealed_mutation",
      undefined,
      "success",
      nowMs
    );

    if (!target.rewardsClaimed) {
      const rewardTable = host.resolveProgressionLootTable(host.run.currentFloor);
      if (rewardTable !== undefined) {
        const reward = rollItemDrop(
          rewardTable,
          ITEM_DEF_MAP,
          host.run.currentFloor,
          host.lootRng,
          `hidden-room-${roomId}-${Math.floor(nowMs)}`,
          host.resolveLootRollOptions({
            isItemEligible: (itemDef: ItemDef) => host.isItemDefUnlocked(itemDef)
          })
        );
        if (reward !== null) {
          host.spawnLootDrop(reward, target.entrance);
        }
      }
      target.rewardsClaimed = true;
      host.tryDiscoverBlueprints("hidden_room", nowMs, roomId);
    }

    host.scheduleRunSave();
    return true;
  }

  revealNearbyHiddenRoomsByMutation(nowMs: number): void {
    const host = this.options.host;
    const radius = host.resolveHiddenRoomRevealRadius();
    if (radius <= 0) {
      return;
    }
    for (const hiddenRoom of host.dungeon.hiddenRooms ?? []) {
      if (hiddenRoom.revealed) {
        continue;
      }
      if (Math.hypot(host.player.position.x - hiddenRoom.entrance.x, host.player.position.y - hiddenRoom.entrance.y) > radius) {
        continue;
      }
      this.revealHiddenRoom(hiddenRoom.roomId, nowMs, "mutation");
    }
  }

  clearChallengeState(): void {
    const host = this.options.host;
    host.challengeMarker?.destroy();
    host.challengeMarker = null;
    host.challengeRoomState = null;
    host.challengeWaveTotal = 0;
    host.challengeMonsterIds.clear();
  }

  resolveChallengeWaveTotal(roomId: string): number {
    const host = this.options.host;
    const seed = `${host.runSeed}:${host.run.currentFloor}:${roomId}`;
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 2 === 0 ? 2 : 3;
  }

  inferChallengeWaveFromMonsterId(monsterId: string): number | null {
    const host = this.options.host;
    const match = /^challenge-(\d+)-(\d+)-/.exec(monsterId);
    if (match === null) {
      return null;
    }
    const floor = Number.parseInt(match[1] ?? "", 10);
    const wave = Number.parseInt(match[2] ?? "", 10);
    if (!Number.isFinite(floor) || !Number.isFinite(wave) || floor !== host.run.currentFloor || wave < 1) {
      return null;
    }
    return wave;
  }

  removeChallengeMonsters(): void {
    const host = this.options.host;
    if (host.challengeMonsterIds.size === 0) {
      return;
    }
    const trackedIds = [...host.challengeMonsterIds];
    for (const monsterId of trackedIds) {
      const dead = host.entityManager.removeMonsterById(monsterId);
      if (dead === null) {
        continue;
      }
      dead.sprite.destroy();
      dead.healthBarBg.destroy();
      dead.healthBarFg.destroy();
      dead.affixMarker?.destroy();
    }
  }

  challengeRoomCenter(roomId: string): { x: number; y: number } | null {
    const room = this.findChallengeRoomById(roomId);
    if (room === undefined) {
      return null;
    }
    return {
      x: Math.floor(room.x + room.width / 2),
      y: Math.floor(room.y + room.height / 2)
    };
  }

  initializeChallengeRoom(nowMs: number): void {
    const host = this.options.host;
    if (host.floorConfig.isBossFloor || host.run.currentFloor < 2) {
      return;
    }
    const existing = host.dungeon.rooms.find((room: { roomType: string }) => room.roomType === "challenge");
    let selected = existing;
    if (selected === undefined && shouldSpawnChallengeRoom(host.run.currentFloor, host.eventRng)) {
      const chosen = chooseChallengeRoom(host.dungeon, host.eventRng);
      if (chosen !== null) {
        host.dungeon = markRoomAsChallenge(host.dungeon, chosen.id);
        selected = host.dungeon.rooms.find((room: { id: string }) => room.id === chosen.id);
      }
    }
    if (selected === undefined) {
      return;
    }
    host.challengeRoomState = createChallengeRoomState(selected.id);
    host.challengeWaveTotal = this.resolveChallengeWaveTotal(selected.id);
    const center = this.challengeRoomCenter(selected.id);
    if (center === null) {
      return;
    }
    host.challengeMarker = host.renderSystem.spawnTelegraphCircle(center, 0.95, host.origin);
    host.challengeMarker.setAlpha(0.2);
    if (host.challengeMarker instanceof Phaser.GameObjects.Image) {
      host.challengeMarker.setTint(0x9c6ac4);
    }
    host.runLog.appendKey(
      "log.challenge.discovered",
      {
        waves: host.challengeWaveTotal
      },
      "info",
      nowMs
    );
  }

  openChallengeRoomPanel(nowMs: number): void {
    const host = this.options.host;
    if (
      host.challengeRoomState === null ||
      host.challengeRoomState.started ||
      host.challengeRoomState.finished ||
      host.eventPanelOpen
    ) {
      return;
    }
    const eventDef: RandomEventDef = {
      id: `challenge_${host.challengeRoomState.roomId}`,
      name: "Challenge Room",
      description: "Seal the room and survive timed waves for bonus rewards.",
      floorRange: { min: host.run.currentFloor, max: host.run.currentFloor },
      spawnWeight: 1,
      choices: [
        {
          id: "enter",
          name: "Enter Challenge",
          description: "Begin timed waves immediately.",
          rewards: []
        },
        {
          id: "skip",
          name: "Leave",
          description: "Keep exploring this floor.",
          rewards: []
        }
      ]
    };
    const choices = eventDef.choices.map((choice) => ({
      choice,
      enabled: true as const
    }));
    host.eventPanelOpen = true;
    host.uiManager.showEventDialog(
      eventDef,
      choices,
      (choiceId: string) => {
        host.eventRuntimeModule.consumeCurrentEvent();
        if (choiceId === "enter") {
          this.startChallengeEncounter(host.time.now);
        }
      },
      () => host.eventRuntimeModule.consumeCurrentEvent()
    );
    host.runLog.appendKey("log.challenge.ready_confirm", undefined, "warn", nowMs);
  }

  startChallengeEncounter(nowMs: number): void {
    const host = this.options.host;
    if (host.challengeRoomState === null || host.challengeRoomState.started || host.challengeRoomState.finished) {
      return;
    }
    host.challengeRoomState = startChallengeRoom(host.challengeRoomState, nowMs);
    host.challengeMonsterIds.clear();
    this.spawnChallengeWave(nowMs);
    host.scheduleRunSave();
    host.hudDirty = true;
  }

  finishChallengeEncounter(success: boolean, nowMs: number): void {
    const host = this.options.host;
    if (host.challengeRoomState === null || host.challengeRoomState.finished) {
      return;
    }
    host.challengeRoomState = success
      ? { ...host.challengeRoomState, finished: true, success: true }
      : failChallengeRoom(host.challengeRoomState);
    this.removeChallengeMonsters();
    host.challengeMonsterIds.clear();
    if (success) {
      host.run = addRunObols(
        {
          ...host.run,
          challengeSuccessCount: host.run.challengeSuccessCount + 1
        },
        12
      );
      const rewardTable = host.resolveProgressionLootTable(host.run.currentFloor + 1);
      const reward =
        rewardTable === undefined
          ? null
          : rollItemDrop(
              rewardTable,
              ITEM_DEF_MAP,
              Math.max(3, host.run.currentFloor),
              host.lootRng,
              `challenge-reward-${host.run.currentFloor}-${Math.floor(nowMs)}`,
              host.resolveLootRollOptions({
                isItemEligible: (itemDef: ItemDef) => host.isItemDefUnlocked(itemDef)
              })
            );
      const center = this.challengeRoomCenter(host.challengeRoomState.roomId);
      if (reward !== null && center !== null) {
        host.spawnLootDrop(reward, center);
      }
      host.tryDiscoverBlueprints("challenge_room", nowMs, host.challengeRoomState.roomId);
      host.runLog.appendKey("log.challenge.cleared_rewards", undefined, "success", nowMs);
      if (host.challengeMarker instanceof Phaser.GameObjects.Image) {
        host.challengeMarker.setTint(0x5abf8a);
      }
      host.challengeMarker?.setAlpha(0.12);
    } else {
      const hpPenalty = Math.max(1, Math.floor(host.player.derivedStats.maxHealth * 0.2));
      host.player = {
        ...host.player,
        health: Math.max(1, host.player.health - hpPenalty),
        position: { ...host.dungeon.playerSpawn }
      };
      host.path = [];
      host.manualMoveTarget = null;
      host.manualMoveTargetFailures = 0;
      host.runLog.appendKey(
        "log.challenge.failed_lost_hp",
        {
          hpPenalty
        },
        "danger",
        nowMs
      );
      if (host.challengeMarker instanceof Phaser.GameObjects.Image) {
        host.challengeMarker.setTint(0xc66767);
      }
      host.challengeMarker?.setAlpha(0.16);
    }
    host.scheduleRunSave();
    host.hudDirty = true;
  }

  onMonsterDefeated(monsterState: MonsterState, nowMs: number): void {
    const host = this.options.host;
    if (
      host.challengeRoomState === null ||
      !host.challengeRoomState.started ||
      host.challengeRoomState.finished ||
      !host.challengeMonsterIds.delete(monsterState.id)
    ) {
      return;
    }
    if (host.challengeMonsterIds.size > 0) {
      return;
    }
    const advanced = advanceChallengeRoomWave(host.challengeRoomState, host.challengeWaveTotal);
    if (advanced.finished && advanced.success) {
      this.finishChallengeEncounter(true, nowMs);
      return;
    }
    host.challengeRoomState = advanced;
    this.spawnChallengeWave(nowMs);
  }

  restoreChallengeRoom(nowMs: number): void {
    const host = this.options.host;
    if (host.floorConfig.isBossFloor || host.run.currentFloor < 2) {
      return;
    }
    const challengeRoom = host.dungeon.rooms.find((room: { roomType: string }) => room.roomType === "challenge");
    if (challengeRoom === undefined) {
      return;
    }
    host.challengeRoomState = createChallengeRoomState(challengeRoom.id);
    host.challengeWaveTotal = this.resolveChallengeWaveTotal(challengeRoom.id);
    const center = this.challengeRoomCenter(challengeRoom.id);
    if (center !== null) {
      host.challengeMarker = host.renderSystem.spawnTelegraphCircle(center, 0.95, host.origin);
      host.challengeMarker.setAlpha(0.2);
      if (host.challengeMarker instanceof Phaser.GameObjects.Image) {
        host.challengeMarker.setTint(0x9c6ac4);
      }
    }

    const floorPrefix = `challenge-${host.run.currentFloor}-`;
    const challengeMonsters = host.entityManager
      .listMonsters()
      .filter((monster: { state: { id: string } }) => monster.state.id.startsWith(floorPrefix));
    if (challengeMonsters.length === 0) {
      return;
    }

    let maxWave = 1;
    for (const monster of challengeMonsters) {
      host.challengeMonsterIds.add(monster.state.id);
      const inferredWave = this.inferChallengeWaveFromMonsterId(monster.state.id);
      if (inferredWave !== null) {
        maxWave = Math.max(maxWave, inferredWave);
      }
    }

    const startedAtMs = Math.max(0, nowMs - 1_000);
    host.challengeRoomState = {
      ...host.challengeRoomState,
      started: true,
      waveIndex: Math.max(0, maxWave - 1),
      startedAtMs,
      deadlineAtMs: startedAtMs + 30_000
    };
    host.runLog.appendKey("log.challenge.resumed", undefined, "info", nowMs);
  }

  updateChallengeRoom(nowMs: number): void {
    const host = this.options.host;
    if (host.challengeRoomState === null || host.challengeRoomState.finished) {
      return;
    }
    if (!host.challengeRoomState.started) {
      const center = this.challengeRoomCenter(host.challengeRoomState.roomId);
      if (center === null) {
        return;
      }
      const distance = Math.hypot(host.player.position.x - center.x, host.player.position.y - center.y);
      if (distance <= 1.1) {
        this.openChallengeRoomPanel(nowMs);
      }
      return;
    }
    if (shouldFailChallengeRoomByTimeout(host.challengeRoomState, nowMs)) {
      this.finishChallengeEncounter(false, nowMs);
    }
  }

  private renderNormalFloor(floor: number) {
    const host = this.options.host;
    return generateDungeon({
      width: 46,
      height: 46,
      minRoomSize: 4,
      maxRoomSize: 9,
      floorNumber: floor,
      seed: deriveFloorSeed(host.runSeed, floor, "procgen")
    });
  }

  private renderBossFloor(floor: number) {
    const host = this.options.host;
    return generateBossRoom(deriveFloorSeed(host.runSeed, floor, "procgen"), 46, 46);
  }

  clearHiddenRoomMarkers(): void {
    const host = this.options.host;
    for (const marker of host.hiddenEntranceMarkers.values()) {
      marker.destroy();
    }
    host.hiddenEntranceMarkers.clear();
  }

  renderHiddenRoomMarkers(): void {
    const host = this.options.host;
    this.clearHiddenRoomMarkers();
    for (const hiddenRoom of host.dungeon.hiddenRooms ?? []) {
      if (hiddenRoom.revealed) {
        continue;
      }
      const iso = gridToIso(
        hiddenRoom.entrance.x,
        hiddenRoom.entrance.y,
        host.tileWidth,
        host.tileHeight,
        host.origin.x,
        host.origin.y
      );
      const marker = host.add
        .ellipse(iso.x, iso.y - 4, 18, 10, 0xd1b06e, 0.32)
        .setStrokeStyle(1, 0x614420, 0.9)
        .setDepth(iso.y + host.entityDepthOffset - 6);
      host.hiddenEntranceMarkers.set(hiddenRoom.roomId, marker);
    }
  }

  private findChallengeRoomById(roomId: string) {
    const host = this.options.host;
    return host.dungeon.rooms.find((room: { id: string }) => room.id === roomId);
  }

  private spawnChallengeWave(nowMs: number): void {
    const host = this.options.host;
    if (host.challengeRoomState === null || !host.challengeRoomState.started || host.challengeRoomState.finished) {
      return;
    }
    const room = this.findChallengeRoomById(host.challengeRoomState.roomId);
    if (room === undefined) {
      this.finishChallengeEncounter(false, nowMs);
      return;
    }
    const walkableTiles: Array<{ x: number; y: number }> = [];
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        if (!host.dungeon.walkable[y]?.[x]) {
          continue;
        }
        walkableTiles.push({ x, y });
      }
    }
    if (walkableTiles.length === 0) {
      this.finishChallengeEncounter(false, nowMs);
      return;
    }

    const waveNumber = host.challengeRoomState.waveIndex + 1;
    const spawnCount = Math.max(2, 1 + waveNumber);
    const archetypeById = new Map(MONSTER_ARCHETYPES.map((entry) => [entry.id, entry]));
    const pooled = host.currentBiome.monsterPool
      .map((id: string) => archetypeById.get(id))
      .filter(
        (
          entry: (typeof MONSTER_ARCHETYPES)[number] | undefined
        ): entry is (typeof MONSTER_ARCHETYPES)[number] => entry !== undefined
      );
    const spawnPool = pooled.length > 0 ? pooled : MONSTER_ARCHETYPES;
    const endlessAffixBonus = host.run.inEndless
      ? resolveEndlessAffixBonusCount(host.run.currentFloor, host.run.mutatorActiveIds ?? [])
      : 0;
    const monsters = host.entityManager.listMonsters();
    for (let idx = 0; idx < spawnCount; idx += 1) {
      const tile = host.spawnRng.pick(walkableTiles);
      const archetype = host.spawnRng.pick(spawnPool);
      if (tile === undefined || archetype === undefined) {
        continue;
      }
      const baseAffixes = rollMonsterAffixes({
        floor: host.run.currentFloor,
        isBoss: false,
        ...(host.run.difficultyModifier.affixPolicy === undefined
          ? {}
          : { policy: host.run.difficultyModifier.affixPolicy }),
        availableAffixes: host.unlockedAffixIds,
        rng: host.spawnRng
      });
      const affixes = [...baseAffixes];
      if (endlessAffixBonus > 0) {
        const pool = [...host.unlockedAffixIds].filter((affixId) => !affixes.includes(affixId));
        while (pool.length > 0 && affixes.length < baseAffixes.length + endlessAffixBonus) {
          const pickedIndex = host.spawnRng.nextInt(0, pool.length - 1);
          const [pickedAffix] = pool.splice(pickedIndex, 1);
          if (pickedAffix !== undefined) {
            affixes.push(pickedAffix);
          }
        }
      }
      const state = applyAffixesToMonsterState({
        id: `challenge-${host.run.currentFloor}-${waveNumber}-${idx}-${Math.floor(nowMs)}`,
        archetypeId: archetype.id,
        level: host.run.currentFloor,
        health: Math.floor(GAME_CONFIG.enemyBaseHealth * archetype.healthMultiplier * host.floorConfig.monsterHpMultiplier),
        maxHealth: Math.floor(GAME_CONFIG.enemyBaseHealth * archetype.healthMultiplier * host.floorConfig.monsterHpMultiplier),
        damage: Math.floor(GAME_CONFIG.enemyBaseDamage * archetype.damageMultiplier * host.floorConfig.monsterDmgMultiplier),
        attackRange: archetype.attackRange,
        moveSpeed: archetype.moveSpeed,
        xpValue: archetype.xpValue,
        dropTableId: archetype.dropTableId,
        position: { x: tile.x, y: tile.y },
        aiState: archetype.aiConfig.behavior === "ambush" ? "ambush" : "idle",
        aiBehavior: archetype.aiConfig.behavior,
        ...(affixes.length === 0 ? {} : { affixes })
      });
      const runtime = host.renderSystem.spawnMonster(state, archetype, host.origin);
      monsters.push(runtime);
      host.challengeMonsterIds.add(runtime.state.id);
      host.entityLabelById.set(runtime.state.id, `${archetype.name} (Challenge)`);
      for (const affix of runtime.state.affixes ?? []) {
        host.eventBus.emit("monster:affixApplied", {
          monsterId: runtime.state.id,
          affixId: affix,
          timestampMs: nowMs
        });
      }
    }
    host.entityManager.rebuildMonsterSpatialIndex();
    host.runLog.appendKey(
      "log.challenge.wave_started",
      {
        waveNumber,
        waveTotal: host.challengeWaveTotal
      },
      "warn",
      nowMs
    );
  }
}
