import Phaser from "phaser";
import { appendReplayInput, collectLoot, createEventBus, createInitialMeta, createReplay, createRunSeed, defaultBaseStats, deriveFloorSeed, deriveStats, endRun, equipItem, generateDungeon, SeededRng, unequipItem } from "@blodex/core";
import { GAME_CONFIG, ITEM_DEF_MAP, LOOT_TABLE_MAP, MONSTER_ARCHETYPES } from "@blodex/content";
import { AISystem } from "../systems/AISystem";
import { CombatSystem } from "../systems/CombatSystem";
import { EntityManager } from "../systems/EntityManager";
import { isoToGrid } from "../systems/iso";
import { MonsterSpawnSystem } from "../systems/MonsterSpawnSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { RenderSystem } from "../systems/RenderSystem";
import { Hud } from "../ui/Hud";
const META_STORAGE_KEY = "blodex_meta_v1";
export class DungeonScene extends Phaser.Scene {
    static ENTITY_DEPTH_OFFSET = 10_000;
    entityManager = new EntityManager();
    movementSystem = new MovementSystem();
    aiSystem = new AISystem();
    combatSystem = new CombatSystem();
    monsterSpawnSystem = new MonsterSpawnSystem();
    eventBus = createEventBus();
    renderSystem;
    hud;
    meta = createInitialMeta();
    run;
    runSeed = "";
    spawnRng;
    combatRng;
    lootRng;
    dungeon = generateDungeon({
        width: 46,
        height: 46,
        roomCount: 12,
        minRoomSize: 4,
        maxRoomSize: 9,
        seed: "bootstrap"
    });
    player;
    playerSprite;
    path = [];
    attackTargetId = null;
    origin = { x: 0, y: 0 };
    worldBounds = { x: -2000, y: -2000, width: 4000, height: 4000 };
    tileWidth = GAME_CONFIG.tileWidth;
    tileHeight = GAME_CONFIG.tileHeight;
    playerYOffset = 16;
    nextPlayerAttackAt = 0;
    hudDirty = true;
    runEnded = false;
    constructor() {
        super("dungeon");
        this.renderSystem = new RenderSystem(this, GAME_CONFIG.tileWidth, GAME_CONFIG.tileHeight, DungeonScene.ENTITY_DEPTH_OFFSET);
    }
    preload() {
        this.load.image("player_vanguard", "/generated/player_vanguard.png");
        this.load.image("monster_melee_01", "/generated/monster_melee_01.png");
        this.load.image("monster_ranged_01", "/generated/monster_ranged_01.png");
        this.load.image("monster_elite_01", "/generated/monster_elite_01.png");
        this.load.image("tile_floor_01", "/generated/tile_floor_01.png");
        this.load.image("item_weapon_01", "/generated/item_weapon_01.png");
        this.load.image("item_weapon_02", "/generated/item_weapon_02.png");
        this.load.image("item_weapon_03", "/generated/item_weapon_03.png");
        this.load.image("item_helm_01", "/generated/item_helm_01.png");
        this.load.image("item_helm_02", "/generated/item_helm_02.png");
        this.load.image("item_chest_01", "/generated/item_chest_01.png");
        this.load.image("item_chest_02", "/generated/item_chest_02.png");
        this.load.image("item_boots_01", "/generated/item_boots_01.png");
        this.load.image("item_boots_02", "/generated/item_boots_02.png");
        this.load.image("item_ring_01", "/generated/item_ring_01.png");
        this.load.image("item_ring_02", "/generated/item_ring_02.png");
    }
    create() {
        this.cameras.main.setBackgroundColor("#11161d");
        this.meta = this.loadMeta();
        this.bindDomainEventEffects();
        this.bootstrapRun(this.resolveInitialRunSeed());
        this.input.on("pointerdown", this.handlePointerDown, this);
        this.hud = new Hud((itemId) => {
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
        }, (slot) => {
            const equipped = this.player.equipment[slot];
            this.player = unequipItem(this.player, slot);
            if (equipped !== undefined) {
                this.eventBus.emit("item:unequip", {
                    playerId: this.player.id,
                    slot,
                    item: equipped,
                    timestampMs: this.time.now
                });
            }
        }, () => this.resetRun());
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
        this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());
        this.hudDirty = true;
    }
    update(_, deltaMs) {
        if (this.runEnded) {
            return;
        }
        const nowMs = this.time.now;
        this.updatePlayerMovement(deltaMs / 1000, nowMs);
        this.updateCombat(nowMs);
        this.updateMonsters(deltaMs / 1000, nowMs);
        this.updateMonsterCombat(nowMs);
        this.collectNearbyLoot(nowMs);
        this.renderSystem.syncPlayerSprite(this.playerSprite, this.player.position, this.playerYOffset, this.origin);
        this.renderSystem.syncMonsterSprites(this.entityManager.listMonsters(), this.origin);
        if (this.player.health <= 0 || this.run.kills >= GAME_CONFIG.floorClearKillTarget) {
            this.finishRun();
            return;
        }
        if (this.hudDirty) {
            this.renderHud();
            this.hudDirty = false;
        }
    }
    bindDomainEventEffects() {
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
    }
    resolveInitialRunSeed() {
        const requested = new URLSearchParams(window.location.search).get("seed");
        if (requested !== null && requested.trim().length > 0) {
            return requested.trim();
        }
        return createRunSeed();
    }
    bootstrapRun(runSeed) {
        this.children.removeAll(true);
        this.entityManager.clear();
        this.runSeed = runSeed;
        this.configureRngStreams(1);
        this.dungeon = generateDungeon({
            width: 46,
            height: 46,
            roomCount: 12,
            minRoomSize: 4,
            maxRoomSize: 9,
            seed: deriveFloorSeed(this.runSeed, 1, "procgen")
        });
        this.player = this.makeInitialPlayer();
        this.run = {
            startedAtMs: this.time.now,
            floor: 1,
            kills: 0,
            lootCollected: 0,
            runSeed: this.runSeed,
            replay: createReplay(this.runSeed, 1)
        };
        this.path = [];
        this.attackTargetId = null;
        this.nextPlayerAttackAt = 0;
        this.hudDirty = true;
        this.runEnded = false;
        const world = this.renderSystem.computeWorldBounds(this.dungeon);
        this.origin = world.origin;
        this.worldBounds = world.worldBounds;
        this.renderSystem.drawDungeon(this.dungeon, this.origin);
        const playerRender = this.renderSystem.spawnPlayer(this.player.position, this.origin);
        this.playerSprite = playerRender.sprite;
        this.playerYOffset = playerRender.yOffset;
        this.spawnMonsters();
        this.renderSystem.configureCamera(this.cameras.main, this.worldBounds, this.playerSprite);
        this.eventBus.emit("run:start", {
            runSeed: this.runSeed,
            floor: this.run.floor,
            startedAtMs: this.run.startedAtMs,
            replayVersion: this.run.replay?.version ?? "unknown"
        });
    }
    configureRngStreams(floor) {
        this.spawnRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "spawn"));
        this.combatRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "combat"));
        this.lootRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "loot"));
    }
    makeInitialPlayer() {
        const baseStats = defaultBaseStats();
        const derivedStats = deriveStats(baseStats, []);
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
            gold: 0
        };
    }
    handlePointerDown(pointer) {
        if (this.runEnded) {
            return;
        }
        const clickedGrid = isoToGrid(pointer.worldX, pointer.worldY, this.tileWidth, this.tileHeight, this.origin.x, this.origin.y);
        const targetTile = {
            x: Math.round(clickedGrid.x),
            y: Math.round(clickedGrid.y)
        };
        const clickedMonster = this.entityManager.pickMonsterAt(targetTile);
        if (clickedMonster !== null) {
            this.attackTargetId = clickedMonster.state.id;
            this.run = appendReplayInput(this.run, {
                type: "attack_target",
                atMs: this.time.now,
                targetId: clickedMonster.state.id
            });
            return;
        }
        this.attackTargetId = null;
        this.path = this.computePathTo(targetTile);
        this.run = appendReplayInput(this.run, {
            type: "move_target",
            atMs: this.time.now,
            target: targetTile
        });
    }
    updatePlayerMovement(dt, nowMs) {
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
    updateCombat(nowMs) {
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
    emitCombatEvents(events) {
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
    updateMonsters(dt, nowMs) {
        const transitions = this.aiSystem.updateMonsters(this.entityManager.listLivingMonsters(), this.player, dt, nowMs);
        for (const transition of transitions) {
            this.eventBus.emit("monster:stateChange", transition);
        }
    }
    updateMonsterCombat(nowMs) {
        const monsterCombat = this.combatSystem.updateMonsterAttacks(this.entityManager.listLivingMonsters(), this.player, nowMs, this.combatRng);
        this.player = monsterCombat.player;
        this.emitCombatEvents(monsterCombat.combatEvents);
        if (monsterCombat.combatEvents.length > 0) {
            this.hudDirty = true;
        }
    }
    collectNearbyLoot(nowMs) {
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
    computePathTo(target) {
        return this.movementSystem.computePathTo(this.dungeon.walkable, { width: this.dungeon.width, height: this.dungeon.height }, this.player.position, target);
    }
    spawnMonsters() {
        const monsters = this.monsterSpawnSystem.createMonsters({
            dungeon: this.dungeon,
            playerPosition: this.player.position,
            floor: this.run.floor,
            count: GAME_CONFIG.floorClearKillTarget + 1,
            enemyBaseHealth: GAME_CONFIG.enemyBaseHealth,
            enemyBaseDamage: GAME_CONFIG.enemyBaseDamage,
            archetypes: MONSTER_ARCHETYPES,
            rng: this.spawnRng
        });
        this.entityManager.setMonsters(monsters.map((monster) => this.renderSystem.spawnMonster(monster.state, monster.archetype, this.origin)));
    }
    spawnLootDrop(item, position) {
        this.entityManager.addLoot({
            item,
            sprite: this.renderSystem.spawnLootSprite(item, position, this.origin),
            position: { ...position }
        });
    }
    finishRun() {
        if (this.runEnded) {
            return;
        }
        this.runEnded = true;
        const { summary, meta, replay } = endRun(this.run, this.player, this.time.now, this.meta);
        this.meta = meta;
        this.saveMeta(meta);
        this.hud.showSummary(summary);
        const runEndPayload = {
            summary,
            inputs: replay?.inputs ?? [],
            finishedAtMs: this.time.now,
            ...(summary.replayChecksum === undefined ? {} : { checksum: summary.replayChecksum })
        };
        this.eventBus.emit("run:end", runEndPayload);
    }
    resetRun() {
        this.hud.clearSummary();
        this.bootstrapRun(this.resolveInitialRunSeed());
        this.hudDirty = true;
    }
    renderHud() {
        this.hud.render({
            player: this.player,
            run: {
                floor: this.run.floor,
                kills: this.run.kills,
                lootCollected: this.run.lootCollected,
                targetKills: GAME_CONFIG.floorClearKillTarget
            },
            meta: this.meta
        });
    }
    cleanupScene() {
        this.eventBus.removeAll();
        this.input.off("pointerdown", this.handlePointerDown, this);
        this.entityManager.clear();
    }
    loadMeta() {
        const raw = window.localStorage.getItem(META_STORAGE_KEY);
        if (raw === null) {
            return createInitialMeta();
        }
        try {
            const parsed = JSON.parse(raw);
            return {
                runsPlayed: parsed.runsPlayed ?? 0,
                bestFloor: parsed.bestFloor ?? 0,
                bestTimeMs: parsed.bestTimeMs ?? 0
            };
        }
        catch {
            return createInitialMeta();
        }
    }
    saveMeta(meta) {
        window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    }
}
//# sourceMappingURL=DungeonScene.js.map