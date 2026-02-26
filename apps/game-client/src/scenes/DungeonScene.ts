import Phaser from "phaser";
import {
  addRunObols,
  appendReplayInput,
  applyDamageToBoss,
  applyRunSummaryToMeta,
  applyXpGain,
  canUseSkill,
  collectLoot,
  createEventBus,
  createInitialMeta,
  createRunSeed,
  createRunState,
  createStaircaseState,
  defaultBaseStats,
  deriveFloorSeed,
  deriveStats,
  endRun,
  enterNextFloor,
  equipItem,
  findStaircasePosition,
  generateBossRoom,
  generateDungeon,
  initBossState,
  isPlayerOnStaircase,
  markBossAttackUsed,
  markSkillUsed,
  migrateMeta,
  pickSkillChoices,
  calculateSoulShardReward,
  resolveMonsterAttack,
  SeededRng,
  selectBossAttack,
  resolveBossAttack,
  type CombatEvent,
  type BossDef,
  type BossRuntimeState,
  type DungeonLayout,
  type GameEventMap,
  type GridNode,
  type ItemInstance,
  type MetaProgression,
  type MonsterState,
  type PlayerState,
  type RunState,
  type SkillDef
} from "@blodex/core";
import {
  BONE_SOVEREIGN,
  GAME_CONFIG,
  getFloorConfig,
  ITEM_DEF_MAP,
  LOOT_TABLE_MAP,
  MONSTER_ARCHETYPES,
  SKILL_DEFS,
  type FloorConfig
} from "@blodex/content";
import { AISystem } from "../systems/AISystem";
import { CombatSystem } from "../systems/CombatSystem";
import { EntityManager } from "../systems/EntityManager";
import { gridToIso, isoToGrid } from "../systems/iso";
import { MonsterSpawnSystem } from "../systems/MonsterSpawnSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { Hud } from "../ui/Hud";
import {
  detectPreferredImageFormat,
  resolveGeneratedAssetUrl,
  resolveGeneratedPngFallback,
  type PreferredImageFormat
} from "../assets/imageAsset";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const DUNGEON_IMAGE_ASSET_IDS = [
  "player_vanguard",
  "monster_melee_01",
  "monster_ranged_01",
  "monster_elite_01",
  "tile_floor_01",
  "item_weapon_01",
  "item_weapon_02",
  "item_weapon_03",
  "item_helm_01",
  "item_helm_02",
  "item_chest_01",
  "item_chest_02",
  "item_boots_01",
  "item_boots_02",
  "item_ring_01",
  "item_ring_02",
  "boss_bone_sovereign",
  "telegraph_circle_red",
  "staircase_floor_exit",
  "skill_cleave",
  "skill_shadow_step",
  "skill_blood_drain",
  "skill_frost_nova",
  "skill_war_cry"
] as const;
const DUNGEON_IMAGE_ASSET_KEY_SET = new Set<string>(DUNGEON_IMAGE_ASSET_IDS);

export class DungeonScene extends Phaser.Scene {
  private static readonly ENTITY_DEPTH_OFFSET = 10_000;

  private readonly entityManager = new EntityManager();
  private readonly movementSystem = new MovementSystem();
  private readonly aiSystem = new AISystem();
  private readonly combatSystem = new CombatSystem();
  private readonly monsterSpawnSystem = new MonsterSpawnSystem();
  private readonly eventBus = createEventBus<GameEventMap>();
  private readonly renderSystem: RenderSystem;
  private preferredImageFormat: PreferredImageFormat = "png";
  private readonly imageFallbackRetried = new Set<string>();

  private hud!: Hud;
  private meta: MetaProgression = createInitialMeta();
  private run!: RunState;
  private runSeed = "";

  private spawnRng!: SeededRng;
  private combatRng!: SeededRng;
  private lootRng!: SeededRng;
  private skillRng!: SeededRng;
  private bossRng!: SeededRng;

  private floorConfig: FloorConfig = getFloorConfig(1);

  private dungeon: DungeonLayout = {
    width: 1,
    height: 1,
    walkable: [[true]],
    rooms: [],
    corridors: [],
    spawnPoints: [],
    playerSpawn: { x: 0, y: 0 },
    layoutHash: "bootstrap"
  };

  private player!: PlayerState;
  private playerSprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

  private bossDef: BossDef = BONE_SOVEREIGN;
  private bossState: BossRuntimeState | null = null;
  private bossSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null = null;

  private staircaseState = {
    position: { x: 0, y: 0 },
    visible: false
  };

  private path: GridNode[] = [];
  private attackTargetId: string | null = null;

  private origin = { x: 0, y: 0 };
  private worldBounds = { x: -2000, y: -2000, width: 4000, height: 4000 };
  private readonly tileWidth = GAME_CONFIG.tileWidth;
  private readonly tileHeight = GAME_CONFIG.tileHeight;
  private playerYOffset = 16;
  private nextPlayerAttackAt = 0;
  private nextBossAttackAt = 0;
  private hudDirty = true;
  private runEnded = false;

  constructor() {
    super("dungeon");
    this.renderSystem = new RenderSystem(
      this,
      GAME_CONFIG.tileWidth,
      GAME_CONFIG.tileHeight,
      DungeonScene.ENTITY_DEPTH_OFFSET
    );
  }

  preload(): void {
    this.preferredImageFormat = detectPreferredImageFormat();
    this.imageFallbackRetried.clear();

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleImageLoadError, this);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleImageLoadError, this);
    });

    for (const assetId of DUNGEON_IMAGE_ASSET_IDS) {
      this.load.image(assetId, resolveGeneratedAssetUrl(assetId, this.preferredImageFormat));
    }
  }

  private handleImageLoadError(file: Phaser.Loader.File): void {
    if (this.preferredImageFormat !== "webp") {
      return;
    }

    const key = String(file.key);
    if (!DUNGEON_IMAGE_ASSET_KEY_SET.has(key)) {
      return;
    }

    if (this.imageFallbackRetried.has(key)) {
      return;
    }

    this.imageFallbackRetried.add(key);
    this.load.image(key, resolveGeneratedPngFallback(key));

    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#11161d");
    this.meta = this.loadMeta();
    this.bindDomainEventEffects();
    this.bootstrapRun(this.resolveInitialRunSeed());

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.bindSkillKeys();

    this.hud = new Hud(
      (itemId) => {
        const item = this.player.inventory.find((candidate) => candidate.id === itemId);
        if (item === undefined) {
          return;
        }

        this.player = equipItem(this.player, itemId);
        const equipped = this.player.equipment[item.slot];
        if (equipped?.id === item.id) {
          this.eventBus.emit("item:equip", {
            playerId: this.player.id,
            slot: item.slot,
            item: equipped,
            timestampMs: this.time.now
          });
        }
      },
      (slot) => {
        const equipped = this.player.equipment[slot];
        const unequippedPlayer: PlayerState = {
          ...this.player,
          inventory: equipped === undefined ? this.player.inventory : [...this.player.inventory, equipped],
          equipment: {
            ...this.player.equipment,
            [slot]: undefined
          }
        };
        this.player = this.refreshPlayerStatsFromEquipment(unequippedPlayer);
        if (equipped !== undefined) {
          this.eventBus.emit("item:unequip", {
            playerId: this.player.id,
            slot,
            item: equipped,
            timestampMs: this.time.now
          });
        }
      },
      () => {
        this.hud.clearSummary();
        this.scene.start("meta-menu");
      }
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());
    this.hudDirty = true;
  }

  update(_: number, deltaMs: number): void {
    if (this.runEnded) {
      return;
    }

    const nowMs = this.time.now;

    this.updatePlayerMovement(deltaMs / 1000, nowMs);
    this.updateCombat(nowMs);
    this.updateMonsters(deltaMs / 1000, nowMs);
    this.updateMonsterCombat(nowMs);
    this.updateBossCombat(nowMs);
    this.collectNearbyLoot(nowMs);

    this.renderSystem.syncPlayerSprite(this.playerSprite, this.player.position, this.playerYOffset, this.origin);
    this.renderSystem.syncMonsterSprites(this.entityManager.listMonsters(), this.origin);
    this.syncBossSprite();

    if (this.player.health <= 0) {
      this.finishRun(false);
      return;
    }

    if (this.floorConfig.isBossFloor && this.bossState !== null && this.bossState.health <= 0) {
      this.finishRun(true);
      return;
    }

    this.updateFloorProgress(nowMs);

    if (this.hudDirty) {
      this.renderHud();
      this.hudDirty = false;
    }
  }

  private bindDomainEventEffects(): void {
    this.eventBus.on("loot:drop", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("loot:pickup", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("player:levelup", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("item:equip", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("item:unequip", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("run:end", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("floor:enter", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("floor:clear", () => {
      this.hudDirty = true;
    });
    this.eventBus.on("boss:phaseChange", () => {
      this.hudDirty = true;
    });
  }

  private bindSkillKeys(): void {
    const bind = (code: string, slotIndex: number) => {
      this.input.keyboard?.on(`keydown-${code}`, () => {
        this.tryUseSkill(slotIndex);
      });
    };

    bind("ONE", 0);
    bind("TWO", 1);
    bind("THREE", 2);
    bind("FOUR", 3);
    bind("Q", 0);
  }

  private resolveInitialRunSeed(): string {
    const requested = new URLSearchParams(window.location.search).get("seed");
    if (requested !== null && requested.trim().length > 0) {
      return requested.trim();
    }
    return createRunSeed();
  }

  private bootstrapRun(runSeed: string): void {
    this.runSeed = runSeed;
    this.run = createRunState(runSeed, this.time.now);
    this.setupFloor(1, true);

    this.eventBus.emit("run:start", {
      runSeed: this.runSeed,
      floor: this.run.currentFloor,
      startedAtMs: this.run.startedAtMs,
      replayVersion: this.run.replay?.version ?? "unknown"
    });
  }

  private configureRngStreams(floor: number): void {
    this.spawnRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "spawn"));
    this.combatRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "combat"));
    this.lootRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "loot"));
    this.skillRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "skill"));
    this.bossRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "boss"));
  }

  private setupFloor(floor: number, initial: boolean): void {
    this.children.removeAll(true);
    this.entityManager.clear();

    this.floorConfig = getFloorConfig(floor);
    this.configureRngStreams(floor);

    this.dungeon = this.floorConfig.isBossFloor
      ? this.renderBossFloor(floor)
      : this.renderNormalFloor(floor);

    this.player = initial ? this.makeInitialPlayer() : this.reusePlayerForNewFloor(this.player);
    this.player = {
      ...this.player,
      position: { ...this.dungeon.playerSpawn }
    };

    this.path = [];
    this.attackTargetId = null;
    this.nextPlayerAttackAt = 0;
    this.nextBossAttackAt = 0;
    this.bossState = null;
    this.bossSprite = null;
    this.staircaseState = createStaircaseState(this.dungeon, this.dungeon.playerSpawn);

    const world = this.renderSystem.computeWorldBounds(this.dungeon);
    this.origin = world.origin;
    this.worldBounds = world.worldBounds;
    this.renderSystem.drawDungeon(this.dungeon, this.origin);

    const playerRender = this.renderSystem.spawnPlayer(this.player.position, this.origin);
    this.playerSprite = playerRender.sprite;
    this.playerYOffset = playerRender.yOffset;

    if (this.floorConfig.isBossFloor) {
      this.spawnBoss();
    } else {
      this.spawnMonsters();
    }

    this.renderSystem.configureCamera(this.cameras.main, this.worldBounds, this.playerSprite);

    this.run = {
      ...this.run,
      currentFloor: floor,
      floor,
      kills: 0
    };

    this.hudDirty = true;
    this.runEnded = false;

    if (!initial) {
      this.eventBus.emit("floor:enter", {
        floor,
        timestampMs: this.time.now
      });
    }
  }

  private renderNormalFloor(floor: number) {
    return generateDungeon({
      width: 46,
      height: 46,
      minRoomSize: 4,
      maxRoomSize: 9,
      floorNumber: floor,
      seed: deriveFloorSeed(this.runSeed, floor, "procgen")
    });
  }

  private renderBossFloor(floor: number) {
    return generateBossRoom(deriveFloorSeed(this.runSeed, floor, "procgen"), 46, 46);
  }

  private makeInitialPlayer(): PlayerState {
    const baseStats = defaultBaseStats();
    const derivedStats = deriveStats(baseStats, [], undefined, this.meta.permanentUpgrades);

    const startingSkillIds = this.pickStartingSkillIds();

    return {
      id: "player",
      position: { ...this.dungeon.playerSpawn },
      level: 1,
      xp: 0,
      xpToNextLevel: 98,
      health: derivedStats.maxHealth,
      mana: derivedStats.maxMana,
      baseStats,
      derivedStats,
      inventory: [],
      equipment: {},
      gold: 0,
      skills: {
        skillSlots: Array.from({ length: Math.min(4, Math.max(2, this.meta.permanentUpgrades.skillSlots)) }, (_, idx) => {
          const id = startingSkillIds[idx];
          return id === undefined ? null : { defId: id, level: 1 };
        }),
        cooldowns: {}
      },
      activeBuffs: []
    };
  }

  private reusePlayerForNewFloor(player: PlayerState): PlayerState {
    return this.refreshPlayerStatsFromEquipment(player);
  }

  private refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState {
    const equipped = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
    const derivedStats = deriveStats(player.baseStats, equipped, undefined, this.meta.permanentUpgrades);

    return {
      ...player,
      derivedStats,
      health: Math.min(player.health, derivedStats.maxHealth),
      mana: Math.min(player.mana, derivedStats.maxMana)
    };
  }

  private pickStartingSkillIds(): string[] {
    const pool = SKILL_DEFS.filter((skill) => {
      if (skill.unlockCondition === undefined) {
        return true;
      }
      return this.meta.unlocks.includes(skill.unlockCondition);
    });

    const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    return sorted.slice(0, 2).map((entry) => entry.id);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.runEnded) {
      return;
    }

    const clickedGrid = isoToGrid(
      pointer.worldX,
      pointer.worldY,
      this.tileWidth,
      this.tileHeight,
      this.origin.x,
      this.origin.y
    );
    const targetTile = {
      x: Math.round(clickedGrid.x),
      y: Math.round(clickedGrid.y)
    };

    const clickedMonster = this.entityManager.pickMonsterAt(targetTile);
    if (clickedMonster !== null) {
      this.attackTargetId = clickedMonster.state.id;
      this.run = appendReplayInput(this.run, {
        type: "attack_target",
        atMs: this.getRunRelativeNowMs(),
        targetId: clickedMonster.state.id
      });
      return;
    }

    this.attackTargetId = null;
    this.path = this.computePathTo(targetTile);
    this.run = appendReplayInput(this.run, {
      type: "move_target",
      atMs: this.getRunRelativeNowMs(),
      target: targetTile
    });
  }

  private getRunRelativeNowMs(): number {
    return Math.max(0, this.time.now - this.run.startedAtMs);
  }

  private updatePlayerMovement(dt: number, nowMs: number): void {
    const result = this.movementSystem.updatePlayerMovement(this.player, this.path, dt);
    this.player = result.player;
    this.path = result.path;
    if (result.moved && result.from !== undefined && result.to !== undefined) {
      this.eventBus.emit("player:move", {
        playerId: this.player.id,
        from: result.from,
        to: result.to,
        timestampMs: nowMs
      });
    }
  }

  private updateCombat(nowMs: number): void {
    if (this.floorConfig.isBossFloor) {
      return;
    }

    const playerCombat = this.combatSystem.updatePlayerAttack({
      player: this.player,
      run: this.run,
      monsters: this.entityManager.listMonsters(),
      attackTargetId: this.attackTargetId,
      nextPlayerAttackAt: this.nextPlayerAttackAt,
      nowMs,
      combatRng: this.combatRng,
      lootRng: this.lootRng,
      itemDefs: ITEM_DEF_MAP,
      lootTables: LOOT_TABLE_MAP
    });

    this.player = playerCombat.player;
    this.run = playerCombat.run;
    this.attackTargetId = playerCombat.attackTargetId;
    this.nextPlayerAttackAt = playerCombat.nextPlayerAttackAt;

    if (playerCombat.requestPathTarget !== undefined) {
      this.path = this.computePathTo(playerCombat.requestPathTarget);
    }

    this.emitCombatEvents(playerCombat.combatEvents);
    if (playerCombat.combatEvents.length > 0) {
      this.hudDirty = true;
    }

    if (playerCombat.leveledUp) {
      this.eventBus.emit("player:levelup", {
        playerId: this.player.id,
        level: this.player.level,
        timestampMs: nowMs
      });
      this.offerLevelupSkill();
    }

    if (playerCombat.killedMonsterId !== undefined) {
      const dead = this.entityManager.removeMonsterById(playerCombat.killedMonsterId);
      if (dead !== null) {
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();
      }
    }

    if (playerCombat.droppedItem !== undefined) {
      this.spawnLootDrop(playerCombat.droppedItem.item, playerCombat.droppedItem.position);
      this.eventBus.emit("loot:drop", {
        sourceId: playerCombat.droppedItem.sourceId,
        item: playerCombat.droppedItem.item,
        position: playerCombat.droppedItem.position,
        timestampMs: nowMs
      });
    }
  }

  private offerLevelupSkill(): void {
    if (this.player.skills === undefined) {
      return;
    }

    const pool = SKILL_DEFS.filter((skill) => {
      if (skill.unlockCondition === undefined) {
        return true;
      }
      return this.meta.unlocks.includes(skill.unlockCondition);
    });
    const choices = pickSkillChoices(pool, this.skillRng, 3);
    if (choices.length === 0) {
      return;
    }

    const pick = choices[0]!;
    const slots = [...this.player.skills.skillSlots];
    const firstEmpty = slots.findIndex((entry) => entry === null);
    if (firstEmpty >= 0) {
      slots[firstEmpty] = { defId: pick.id, level: 1 };
    } else {
      slots[0] = { defId: pick.id, level: 1 };
    }

    this.player = {
      ...this.player,
      skills: {
        ...this.player.skills,
        skillSlots: slots
      }
    };
  }

  private emitCombatEvents(events: CombatEvent[]): void {
    for (const combat of events) {
      if (combat.kind === "dodge") {
        this.eventBus.emit("combat:dodge", { combat });
        continue;
      }
      if (combat.kind === "death") {
        this.eventBus.emit("combat:death", { combat });
        continue;
      }
      this.eventBus.emit("combat:hit", { combat });
    }
  }

  private updateMonsters(dt: number, nowMs: number): void {
    const transitions = this.aiSystem.updateMonsters(
      this.entityManager.listLivingMonsters(),
      this.player,
      dt,
      nowMs
    );

    for (const transition of transitions) {
      this.eventBus.emit("monster:stateChange", transition);
    }
  }

  private updateMonsterCombat(nowMs: number): void {
    const monsterCombat = this.combatSystem.updateMonsterAttacks(
      this.entityManager.listLivingMonsters(),
      this.player,
      nowMs,
      this.combatRng
    );

    this.player = monsterCombat.player;
    this.emitCombatEvents(monsterCombat.combatEvents);
    if (monsterCombat.combatEvents.length > 0) {
      this.hudDirty = true;
    }
  }

  private updateBossCombat(nowMs: number): void {
    if (!this.floorConfig.isBossFloor || this.bossState === null) {
      return;
    }

    const distanceToBoss = Math.hypot(
      this.player.position.x - this.bossState.position.x,
      this.player.position.y - this.bossState.position.y
    );

    if (distanceToBoss <= 1.8 && nowMs >= this.nextPlayerAttackAt) {
      const crit = this.combatRng.next() < this.player.derivedStats.critChance;
      const damage = Math.max(1, Math.floor(this.player.derivedStats.attackPower * (crit ? 1.7 : 1)));
      const previousPhase = this.bossState.currentPhaseIndex;
      this.bossState = applyDamageToBoss(this.bossState, damage);
      this.bossState = {
        ...this.bossState,
        ...(
          this.bossState.health <= this.bossState.maxHealth * 0.5 && this.bossState.currentPhaseIndex === 0
            ? { currentPhaseIndex: 1 }
            : {}
        )
      };
      this.nextPlayerAttackAt = nowMs + 1000 / Math.max(0.6, this.player.derivedStats.attackSpeed);

      if (this.bossState.currentPhaseIndex !== previousPhase) {
        this.eventBus.emit("boss:phaseChange", {
          bossId: this.bossDef.id,
          fromPhase: previousPhase,
          toPhase: this.bossState.currentPhaseIndex,
          hpRatio: this.bossState.health / this.bossState.maxHealth,
          timestampMs: nowMs
        });
      }

      this.hudDirty = true;
    }

    if (nowMs < this.nextBossAttackAt) {
      return;
    }

    const attack = selectBossAttack(this.bossState, this.bossDef, nowMs, this.bossRng);
    if (attack === null) {
      return;
    }

    const attackResult = resolveBossAttack(attack, this.bossState, this.player, this.bossRng, nowMs);
    this.player = attackResult.player;
    this.emitCombatEvents(attackResult.events);

    if (attack.type === "summon") {
      this.eventBus.emit("boss:summon", {
        bossId: this.bossDef.id,
        attack,
        count: attackResult.summonCount ?? 2,
        timestampMs: nowMs
      });
      this.spawnSummonedMonsters(attackResult.summonCount ?? 2);
    }

    this.bossState = markBossAttackUsed(this.bossState, attack, nowMs);
    this.nextBossAttackAt = nowMs + Math.max(800, attack.cooldownMs * 0.4);
    this.hudDirty = true;
  }

  private spawnSummonedMonsters(count: number): void {
    const archetype = MONSTER_ARCHETYPES[0];
    if (archetype === undefined || this.bossState === null) {
      return;
    }

    const existing = this.entityManager.listMonsters().length;
    for (let i = 0; i < count; i += 1) {
      const idx = existing + i;
      const angle = (Math.PI * 2 * i) / Math.max(1, count);
      const position = {
        x: this.bossState.position.x + Math.cos(angle) * 2,
        y: this.bossState.position.y + Math.sin(angle) * 2
      };
      const state: MonsterState = {
        id: `summon-${idx}-${Math.floor(this.time.now)}`,
        archetypeId: archetype.id,
        level: this.run.currentFloor,
        health: Math.floor(65 * this.floorConfig.monsterHpMultiplier),
        maxHealth: Math.floor(65 * this.floorConfig.monsterHpMultiplier),
        damage: Math.floor(8 * this.floorConfig.monsterDmgMultiplier),
        attackRange: archetype.attackRange,
        moveSpeed: archetype.moveSpeed,
        xpValue: archetype.xpValue,
        dropTableId: archetype.dropTableId,
        position,
        aiState: "chase"
      };
      const runtime = this.renderSystem.spawnMonster(state, archetype, this.origin);
      this.entityManager.listMonsters().push(runtime);
    }
  }

  private collectNearbyLoot(nowMs: number): void {
    const picked = this.entityManager.consumeLootNear(this.player.position, 0.7);
    if (picked.length === 0) {
      return;
    }

    for (const drop of picked) {
      this.player = collectLoot(this.player, drop.item);
      this.run = {
        ...this.run,
        lootCollected: this.run.lootCollected + 1
      };
      drop.sprite.destroy();
      this.eventBus.emit("loot:pickup", {
        playerId: this.player.id,
        item: drop.item,
        position: drop.position,
        timestampMs: nowMs
      });
    }
  }

  private computePathTo(target: { x: number; y: number }): GridNode[] {
    return this.movementSystem.computePathTo(
      this.dungeon.walkable,
      { width: this.dungeon.width, height: this.dungeon.height },
      this.player.position,
      target
    );
  }

  private spawnMonsters(): void {
    const monsters = this.monsterSpawnSystem.createMonsters({
      dungeon: this.dungeon,
      playerPosition: this.player.position,
      floor: this.run.currentFloor,
      floorConfig: this.floorConfig,
      enemyBaseHealth: GAME_CONFIG.enemyBaseHealth,
      enemyBaseDamage: GAME_CONFIG.enemyBaseDamage,
      archetypes: MONSTER_ARCHETYPES,
      rng: this.spawnRng
    });

    this.entityManager.setMonsters(
      monsters.map((monster) => this.renderSystem.spawnMonster(monster.state, monster.archetype, this.origin))
    );
  }

  private spawnBoss(): void {
    const roomCenter = findStaircasePosition(this.dungeon, this.dungeon.playerSpawn);
    this.bossState = initBossState(this.bossDef, roomCenter);
    this.bossSprite = this.renderSystem.spawnBoss(roomCenter, this.origin, this.bossDef.spriteKey);
    this.entityManager.setBoss({
      state: this.bossState,
      sprite: this.bossSprite
    });
  }

  private spawnLootDrop(item: ItemInstance, position: { x: number; y: number }): void {
    this.entityManager.addLoot({
      item,
      sprite: this.renderSystem.spawnLootSprite(item, position, this.origin),
      position: { ...position }
    });
  }

  private syncBossSprite(): void {
    if (this.bossState === null || this.bossSprite === null) {
      return;
    }

    const mapped = gridToIso(
      this.bossState.position.x,
      this.bossState.position.y,
      this.tileWidth,
      this.tileHeight,
      this.origin.x,
      this.origin.y
    );

    this.bossSprite.setPosition(mapped.x, mapped.y);
    this.bossSprite.setVisible(this.bossState.health > 0);
  }

  private updateFloorProgress(nowMs: number): void {
    if (this.floorConfig.isBossFloor) {
      return;
    }

    const revealThreshold = Math.ceil(this.floorConfig.monsterCount * this.floorConfig.clearThreshold);
    if (!this.staircaseState.visible && this.run.kills >= revealThreshold) {
      this.staircaseState = {
        ...this.staircaseState,
        visible: true
      };
      this.entityManager.setStaircase(this.renderSystem.spawnStaircase(this.staircaseState.position, this.origin));
      this.eventBus.emit("floor:clear", {
        floor: this.run.currentFloor,
        kills: this.run.kills,
        staircase: this.staircaseState,
        timestampMs: nowMs
      });
    }

    if (!isPlayerOnStaircase(this.player.position, this.staircaseState, 0.85)) {
      return;
    }

    if (this.run.currentFloor >= (GAME_CONFIG.maxFloors ?? 5)) {
      return;
    }

    const fromFloor = this.run.currentFloor;
    this.run = appendReplayInput(this.run, {
      type: "floor_transition",
      atMs: this.getRunRelativeNowMs(),
      fromFloor,
      toFloor: fromFloor + 1
    });
    this.run = enterNextFloor(this.run);
    this.run = addRunObols(this.run, 5);
    this.setupFloor(this.run.currentFloor, false);
  }

  private finishRun(isVictory: boolean): void {
    if (this.runEnded) {
      return;
    }
    this.runEnded = true;
    this.run = {
      ...this.run,
      isVictory
    };

    const { summary: baseSummary, meta: nextMeta, replay } = endRun(this.run, this.player, this.time.now, this.meta);
    const soulShards = calculateSoulShardReward(this.run, isVictory);
    const summary = {
      ...baseSummary,
      isVictory,
      soulShardsEarned: soulShards,
      obolsEarned: this.run.runEconomy.obols
    };

    this.meta = applyRunSummaryToMeta(nextMeta, summary);
    this.saveMeta(this.meta);
    this.hud.showSummary(summary);

    const runEndPayload: GameEventMap["run:end"] = {
      summary,
      inputs: replay?.inputs ?? [],
      finishedAtMs: this.time.now,
      ...(summary.replayChecksum === undefined ? {} : { checksum: summary.replayChecksum })
    };
    this.eventBus.emit("run:end", runEndPayload);
  }

  private resetRun(): void {
    this.hud.clearSummary();
    this.bootstrapRun(this.resolveInitialRunSeed());
    this.hudDirty = true;
  }

  private tryUseSkill(slotIndex: number): void {
    if (this.player.skills === undefined || this.runEnded) {
      return;
    }

    const slot = this.player.skills.skillSlots[slotIndex];
    if (slot === null || slot === undefined) {
      return;
    }

    const def = SKILL_DEFS.find((entry) => entry.id === slot.defId);
    if (def === undefined) {
      return;
    }

    if (!canUseSkill(this.player, this.player.skills, def, this.time.now)) {
      return;
    }

    const monsters = this.entityManager.listMonsters();
    const resolution = this.combatSystem.useSkill(this.player, monsters, def as SkillDef, this.skillRng, this.time.now);
    this.player = {
      ...resolution.player,
      skills: markSkillUsed(this.player.skills, def as SkillDef, this.time.now)
    };

    let kills = 0;
    for (const event of resolution.events) {
      if (event.kind !== "death") {
        continue;
      }
      const dead = this.entityManager.removeMonsterById(event.targetId);
      if (dead !== null) {
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();

        const xpResult = applyXpGain(this.player, dead.state.xpValue, "strength");
        this.player = {
          ...xpResult.player,
          derivedStats: deriveStats(
            xpResult.player.baseStats,
            Object.values(xpResult.player.equipment).filter((item): item is ItemInstance => item !== undefined),
            undefined,
            this.meta.permanentUpgrades
          )
        };
      }
      kills += 1;
    }

    if (kills > 0) {
      this.run = addRunObols(
        {
          ...this.run,
          kills: this.run.kills + kills,
          totalKills: this.run.totalKills + kills
        },
        kills
      );
    }

    this.eventBus.emit("skill:use", {
      playerId: this.player.id,
      skillId: def.id,
      timestampMs: this.time.now,
      resolution
    });
    this.eventBus.emit("skill:cooldown", {
      playerId: this.player.id,
      skillId: def.id,
      readyAtMs: this.player.skills?.cooldowns[def.id] ?? this.time.now
    });
    this.hudDirty = true;
  }

  private renderHud(): void {
    const runState = {
      floor: this.run.currentFloor,
      kills: this.run.kills,
      lootCollected: this.run.lootCollected,
      targetKills: this.floorConfig.monsterCount,
      obols: this.run.runEconomy.obols,
      floorGoalReached: this.staircaseState.visible,
      isBossFloor: this.floorConfig.isBossFloor,
      bossPhase: this.bossState?.currentPhaseIndex ?? 0,
      ...(this.bossState === null
        ? {}
        : {
            bossHealth: this.bossState.health,
            bossMaxHealth: this.bossState.maxHealth
          })
    };

    this.hud.render({
      player: this.player,
      run: runState,
      meta: this.meta
    });
  }

  private cleanupScene(): void {
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.handleImageLoadError, this);
    this.imageFallbackRetried.clear();
    this.eventBus.removeAll();
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.entityManager.clear();
  }

  private loadMeta(): MetaProgression {
    const rawV2 = window.localStorage.getItem(META_STORAGE_KEY_V2);
    if (rawV2 !== null) {
      try {
        return migrateMeta(JSON.parse(rawV2));
      } catch {
        return createInitialMeta();
      }
    }

    const rawV1 = window.localStorage.getItem(META_STORAGE_KEY_V1);
    if (rawV1 !== null) {
      try {
        const migrated = migrateMeta(JSON.parse(rawV1));
        window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(migrated));
        return migrated;
      } catch {
        return createInitialMeta();
      }
    }

    return createInitialMeta();
  }

  private saveMeta(meta: MetaProgression): void {
    window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(meta));
  }
}
