import Phaser from "phaser";
import {
  applyHazardDamage,
  addRunObols,
  canPayEventCost,
  canUseConsumable,
  collectUnlockedAffixIds,
  collectUnlockedBiomeIds,
  collectUnlockedEventIds,
  CONSUMABLE_DEFS,
  createInitialConsumableState,
  createMerchantOffers,
  createHazardRuntimeState,
  appendReplayInput,
  applyDamageToBoss,
  applyRunSummaryToMeta,
  applyXpGain,
  canEquip,
  canUseSkill,
  collectLoot,
  grantConsumable,
  hasMonsterAffix,
  isInsideHazard,
  multiplyMovementModifiers,
  nextHazardTickAt,
  nextHazardTriggerAt,
  pickRandomEvent,
  resolveBiomeForFloor,
  resolveMidBiomeOrder,
  rollEventRisk,
  rollItemDrop,
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
  spendRunObols,
  shouldRunHazardTick,
  shouldTriggerPeriodicHazard,
  calculateSoulShardReward,
  resolveMonsterAttack,
  SeededRng,
  selectBossAttack,
  resolveBossAttack,
  useConsumable,
  type CombatEvent,
  type BossDef,
  type BossRuntimeState,
  type ConsumableId,
  type ConsumableState,
  type DungeonLayout,
  type EventReward,
  type GameEventMap,
  type GridNode,
  type HazardRuntimeState,
  type ItemInstance,
  type MerchantOffer,
  type MetaProgression,
  type MonsterAffixId,
  type MonsterState,
  type PlayerState,
  type RandomEventDef,
  type RunState,
  type SkillDef
} from "@blodex/core";
import {
  BIOME_MAP,
  BONE_SOVEREIGN,
  GAME_CONFIG,
  HAZARD_MAP,
  RANDOM_EVENT_DEFS,
  UNLOCK_DEFS,
  getFloorConfig,
  ITEM_DEF_MAP,
  LOOT_TABLE_MAP,
  MONSTER_ARCHETYPES,
  SKILL_DEFS,
  type BiomeDef,
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
import { removeConnectedBackgroundFromTexture } from "../assets/removeBackground";

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
const ENTITY_ASSET_KEYS_FOR_BACKGROUND_REMOVAL = [
  "player_vanguard",
  "monster_melee_01",
  "monster_ranged_01",
  "monster_elite_01",
  "boss_bone_sovereign"
] as const;
const FLOOR_EVENT_SPAWN_CHANCE = 0.62;

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
  private biomeRng!: SeededRng;
  private hazardRng!: SeededRng;
  private eventRng!: SeededRng;
  private merchantRng!: SeededRng;

  private floorConfig: FloorConfig = getFloorConfig(1);
  private currentBiome: BiomeDef = BIOME_MAP.forgotten_catacombs;
  private hazards: HazardRuntimeState[] = [];
  private hazardVisuals: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse> = [];
  private readonly playerHazardContact = new Map<string, boolean>();
  private unlockedBiomeIds = new Set<string>();
  private unlockedAffixIds: MonsterAffixId[] = [];
  private unlockedEventIds: string[] = [];

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
  private lastDeathReason = "Unknown cause.";
  private readonly entityLabelById = new Map<string, string>();
  private consumables: ConsumableState = createInitialConsumableState(0);
  private eventNode: {
    eventDef: RandomEventDef;
    position: { x: number; y: number };
    marker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
    resolved: boolean;
  } | null = null;
  private merchantOffers: MerchantOffer[] = [];
  private eventPanelOpen = false;
  private mapRevealActive = false;

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

  private applyRuntimeBackgroundRemoval(): void {
    for (const textureKey of ENTITY_ASSET_KEYS_FOR_BACKGROUND_REMOVAL) {
      removeConnectedBackgroundFromTexture(this, textureKey, {
        seedTolerance: 64,
        growTolerance: 88,
        localTolerance: 30,
        minSeedCoverage: 0.58
      });
    }
    this.renderSystem.setMultiplyBlendFallbackKeys([]);
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#11161d");
    this.meta = this.loadMeta();
    this.hud = new Hud(
      (itemId) => {
        const item = this.player.inventory.find((candidate) => candidate.id === itemId);
        if (item === undefined) {
          this.hud.appendLog(`Equip failed: item ${itemId} not found in backpack.`, "warn", this.time.now);
          return;
        }

        if (!canEquip(this.player, item)) {
          this.hud.appendLog(
            `Cannot equip ${item.name}: Need Lv${item.requiredLevel}, current Lv${this.player.level}.`,
            "warn",
            this.time.now
          );
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
          return;
        }

        this.hud.appendLog(`Equip failed: ${item.name} could not be equipped.`, "warn", this.time.now);
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
      (consumableId) => {
        this.tryUseConsumable(consumableId);
      },
      () => {
        this.hud.clearSummary();
        this.hud.clearLogs();
        this.hud.hideDeathOverlay();
        this.hud.hideEventPanel();
        this.scene.start("meta-menu");
      }
    );
    this.applyRuntimeBackgroundRemoval();
    this.hud.hideDeathOverlay();
    this.hud.clearLogs();
    this.hud.hideEventPanel();
    this.bindDomainEventEffects();
    this.bootstrapRun(this.resolveInitialRunSeed());

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.bindSkillKeys();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupScene());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupScene());
    this.hudDirty = true;
  }

  update(_: number, deltaMs: number): void {
    if (this.runEnded) {
      return;
    }

    if (this.eventPanelOpen) {
      if (this.hudDirty) {
        this.renderHud();
        this.hudDirty = false;
      }
      return;
    }

    const nowMs = this.time.now;
    const playerHazardMovementMultiplier = this.resolvePlayerHazardMovementMultiplier();

    this.updatePlayerMovement((deltaMs / 1000) * playerHazardMovementMultiplier, nowMs);
    this.updateCombat(nowMs);
    this.updateMonsters(deltaMs / 1000, nowMs);
    this.updateMonsterCombat(nowMs);
    this.updateBossCombat(nowMs);
    this.updateHazards(nowMs);
    this.collectNearbyLoot(nowMs);
    this.updateEventInteraction(nowMs);

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
    this.eventBus.on("combat:hit", ({ combat }) => {
      this.hudDirty = true;
      const source = this.resolveEntityLabel(combat.sourceId);
      const target = this.resolveEntityLabel(combat.targetId);
      if (combat.targetId === this.player.id) {
        this.hud.appendLog(
          `${source} hit ${target} for ${combat.amount} damage.`,
          combat.kind === "crit" ? "danger" : "warn",
          combat.timestampMs
        );
        return;
      }
      this.hud.appendLog(
        `${source} ${combat.kind === "crit" ? "critically hit" : "hit"} ${target} for ${combat.amount} damage.`,
        combat.kind === "crit" ? "success" : "info",
        combat.timestampMs
      );
    });

    this.eventBus.on("combat:dodge", ({ combat }) => {
      this.hudDirty = true;
      const source = this.resolveEntityLabel(combat.sourceId);
      const target = this.resolveEntityLabel(combat.targetId);
      this.hud.appendLog(
        `${target} dodged ${source}'s attack.`,
        combat.targetId === this.player.id ? "success" : "info",
        combat.timestampMs
      );
    });

    this.eventBus.on("combat:death", ({ combat }) => {
      this.hudDirty = true;
      const source = this.resolveEntityLabel(combat.sourceId);
      const target = this.resolveEntityLabel(combat.targetId);
      if (combat.targetId === this.player.id) {
        this.lastDeathReason = `Slain by ${source} (${combat.amount} ${combat.damageType} damage).`;
        this.hud.appendLog(`${target} was slain by ${source}.`, "danger", combat.timestampMs);
        return;
      }
      this.hud.appendLog(`${target} was slain by ${source}.`, "success", combat.timestampMs);
    });

    this.eventBus.on("loot:drop", ({ sourceId, item, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(
        `${this.resolveEntityLabel(sourceId)} dropped ${item.name}.`,
        "info",
        timestampMs
      );
    });

    this.eventBus.on("loot:pickup", ({ item, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Picked up ${item.name}.`, "success", timestampMs);
    });

    this.eventBus.on("player:levelup", ({ level, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Level up! Vanguard reached Lv${level}.`, "success", timestampMs);
    });

    this.eventBus.on("item:equip", ({ item, slot, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Equipped ${item.name} (${slot}).`, "success", timestampMs);
    });

    this.eventBus.on("item:unequip", ({ item, slot, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Unequipped ${item.name} (${slot}).`, "info", timestampMs);
    });

    this.eventBus.on("skill:use", ({ skillId, timestampMs }) => {
      this.hud.appendLog(`Skill used: ${skillId}.`, "info", timestampMs);
    });

    this.eventBus.on("skill:cooldown", ({ skillId, readyAtMs }) => {
      const cooldownMs = Math.max(0, readyAtMs - this.time.now);
      this.hud.appendLog(
        `${skillId} cooldown ${(cooldownMs / 1000).toFixed(1)}s.`,
        "info",
        this.time.now
      );
    });

    this.eventBus.on("consumable:use", ({ consumableId, amountApplied, remainingCharges, timestampMs }) => {
      this.hudDirty = true;
      const label =
        consumableId === "health_potion"
          ? `Health potion restored ${amountApplied} HP`
          : consumableId === "mana_potion"
            ? `Mana potion restored ${amountApplied} mana`
            : "Scroll of Mapping revealed objective";
      this.hud.appendLog(`${label}. Charges left: ${remainingCharges}.`, "success", timestampMs);
    });

    this.eventBus.on("consumable:failed", ({ consumableId, reason, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Cannot use ${consumableId}: ${reason}`, "warn", timestampMs);
    });

    this.eventBus.on("event:spawn", ({ eventName, floor, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Event discovered on floor ${floor}: ${eventName}.`, "info", timestampMs);
    });

    this.eventBus.on("event:choice", ({ eventId, choiceId, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Event choice selected: ${eventId} -> ${choiceId}.`, "info", timestampMs);
    });

    this.eventBus.on("merchant:offer", ({ floor, offerCount, timestampMs }) => {
      this.hud.appendLog(`Merchant opened on floor ${floor} with ${offerCount} offers.`, "info", timestampMs);
    });

    this.eventBus.on("merchant:purchase", ({ itemName, priceObol, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Purchased ${itemName} for ${priceObol} Obol.`, "success", timestampMs);
    });

    this.eventBus.on("monster:stateChange", ({ monsterId, from, to, timestampMs }) => {
      this.hud.appendLog(
        `${this.resolveEntityLabel(monsterId)} state: ${from} -> ${to}.`,
        "info",
        timestampMs
      );
    });

    this.eventBus.on("monster:affixApplied", ({ monsterId, affixId, timestampMs }) => {
      this.hud.appendLog(
        `${this.resolveEntityLabel(monsterId)} gained affix: ${affixId}.`,
        "warn",
        timestampMs
      );
    });

    this.eventBus.on("monster:split", ({ sourceMonsterId, spawnedIds, timestampMs }) => {
      this.hud.appendLog(
        `${this.resolveEntityLabel(sourceMonsterId)} split into ${spawnedIds.length} fragments.`,
        "warn",
        timestampMs
      );
    });

    this.eventBus.on("monster:leech", ({ monsterId, amount, targetId, timestampMs }) => {
      this.hud.appendLog(
        `${this.resolveEntityLabel(monsterId)} leeched ${amount} HP from ${this.resolveEntityLabel(targetId)}.`,
        "danger",
        timestampMs
      );
    });

    this.eventBus.on("run:start", ({ floor, runSeed, startedAtMs }) => {
      this.hud.appendLog(`Run started on floor ${floor} (seed ${runSeed}).`, "info", startedAtMs);
    });

    this.eventBus.on("run:end", ({ summary, finishedAtMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(
        summary.isVictory
          ? `Run complete! Floor ${summary.floorReached}, level ${summary.leveledTo}.`
          : `Run ended on floor ${summary.floorReached}, level ${summary.leveledTo}.`,
        summary.isVictory ? "success" : "danger",
        finishedAtMs
      );
    });

    this.eventBus.on("floor:enter", ({ floor, biomeId, timestampMs }) => {
      this.hudDirty = true;
      const biomeName =
        biomeId === undefined ? "" : ` (${BIOME_MAP[biomeId]?.name ?? biomeId})`;
      this.hud.appendLog(`Entered floor ${floor}${biomeName}.`, "info", timestampMs);
    });

    this.eventBus.on("floor:clear", ({ floor, kills, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(`Floor ${floor} cleared with ${kills} kills.`, "success", timestampMs);
    });

    this.eventBus.on("boss:phaseChange", ({ toPhase, hpRatio, timestampMs }) => {
      this.hudDirty = true;
      this.hud.appendLog(
        `Boss shifted to phase ${toPhase + 1} (${Math.floor(hpRatio * 100)}% HP).`,
        "warn",
        timestampMs
      );
    });

    this.eventBus.on("boss:summon", ({ count, timestampMs }) => {
      this.hud.appendLog(`Boss summoned ${count} minions.`, "warn", timestampMs);
    });

    this.eventBus.on("hazard:enter", ({ hazardType, targetId, timestampMs }) => {
      if (targetId !== this.player.id) {
        return;
      }
      this.hud.appendLog(`Entered ${hazardType} zone.`, "warn", timestampMs);
    });

    this.eventBus.on("hazard:exit", ({ hazardType, targetId, timestampMs }) => {
      if (targetId !== this.player.id) {
        return;
      }
      this.hud.appendLog(`Left ${hazardType} zone.`, "info", timestampMs);
    });

    this.eventBus.on("hazard:trigger", ({ hazardType, timestampMs }) => {
      this.hud.appendLog(`${hazardType} triggered.`, "warn", timestampMs);
    });

    this.eventBus.on("hazard:damage", ({ hazardType, targetId, amount, remainingHealth, timestampMs }) => {
      const label = this.resolveEntityLabel(targetId);
      const level = targetId === this.player.id ? "danger" : "info";
      this.hud.appendLog(
        `${label} took ${amount} damage from ${hazardType} (${Math.floor(remainingHealth)} HP left).`,
        level,
        timestampMs
      );
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
    this.input.keyboard?.on("keydown-R", () => this.tryUseConsumable("health_potion"));
    this.input.keyboard?.on("keydown-F", () => this.tryUseConsumable("mana_potion"));
    this.input.keyboard?.on("keydown-G", () => this.tryUseConsumable("scroll_of_mapping"));
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
    this.lastDeathReason = "Unknown cause.";
    this.entityLabelById.clear();
    this.hud.clearLogs();
    this.hud.hideDeathOverlay();
    this.hud.hideEventPanel();
    this.refreshUnlockSnapshots();
    this.consumables = createInitialConsumableState(this.meta.permanentUpgrades.potionCharges);
    this.mapRevealActive = false;
    this.eventPanelOpen = false;
    this.merchantOffers = [];
    this.destroyEventNode();
    this.run = createRunState(runSeed, this.time.now);
    this.setupFloor(1, true);

    this.eventBus.emit("run:start", {
      runSeed: this.runSeed,
      floor: this.run.currentFloor,
      startedAtMs: this.run.startedAtMs,
      replayVersion: this.run.replay?.version ?? "unknown"
    });
  }

  private refreshUnlockSnapshots(): void {
    this.unlockedBiomeIds = new Set(collectUnlockedBiomeIds(this.meta, UNLOCK_DEFS));
    this.unlockedAffixIds = collectUnlockedAffixIds(this.meta, UNLOCK_DEFS) as MonsterAffixId[];
    this.unlockedEventIds = collectUnlockedEventIds(this.meta, UNLOCK_DEFS);
  }

  private configureRngStreams(floor: number): void {
    this.spawnRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "spawn"));
    this.combatRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "combat"));
    this.lootRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "loot"));
    this.skillRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "skill"));
    this.bossRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "boss"));
    this.biomeRng = new SeededRng(deriveFloorSeed(this.runSeed, 0, "biome"));
    this.hazardRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "hazard"));
    this.eventRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "event"));
    this.merchantRng = new SeededRng(deriveFloorSeed(this.runSeed, floor, "merchant"));
  }

  private setupFloor(floor: number, initial: boolean): void {
    this.children.removeAll(true);
    this.entityManager.clear();
    this.clearHazards();

    this.floorConfig = getFloorConfig(floor);
    this.configureRngStreams(floor);
    const midBiomeOrder = resolveMidBiomeOrder(this.biomeRng);
    const rolledBiomeId = resolveBiomeForFloor(floor, midBiomeOrder);
    const biomeId = this.unlockedBiomeIds.has(rolledBiomeId) ? rolledBiomeId : "forgotten_catacombs";
    this.currentBiome = BIOME_MAP[biomeId] ?? BIOME_MAP.forgotten_catacombs;
    this.mapRevealActive = false;
    this.eventPanelOpen = false;
    this.merchantOffers = [];
    this.hud.hideEventPanel();
    this.destroyEventNode();

    this.dungeon = this.floorConfig.isBossFloor
      ? this.renderBossFloor(floor)
      : this.renderNormalFloor(floor);

    this.player = initial ? this.makeInitialPlayer() : this.reusePlayerForNewFloor(this.player);
    this.player = {
      ...this.player,
      position: { ...this.dungeon.playerSpawn }
    };
    this.entityLabelById.set(this.player.id, "Vanguard");

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
    this.cameras.main.setBackgroundColor(
      Phaser.Display.Color.IntegerToColor(this.currentBiome.ambientColor).rgba
    );
    this.renderSystem.drawDungeon(
      this.dungeon,
      this.origin,
      this.resolveBiomeTileTint(this.currentBiome.id)
    );

    const playerRender = this.renderSystem.spawnPlayer(this.player.position, this.origin);
    this.playerSprite = playerRender.sprite;
    this.playerYOffset = playerRender.yOffset;
    this.initializeHazards(this.time.now);

    if (this.floorConfig.isBossFloor) {
      this.spawnBoss();
    } else {
      this.spawnMonsters();
      this.setupFloorEvent(this.time.now);
    }

    this.renderSystem.configureCamera(this.cameras.main, this.worldBounds, this.playerSprite);

    this.run = {
      ...this.run,
      currentFloor: floor,
      currentBiomeId: this.currentBiome.id,
      floor,
      kills: 0
    };

    this.hudDirty = true;
    this.runEnded = false;

    if (!initial) {
      this.eventBus.emit("floor:enter", {
        floor,
        biomeId: this.currentBiome.id,
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

  private resolveBiomeTileTint(biomeId: BiomeDef["id"]): number | undefined {
    switch (biomeId) {
      case "molten_caverns":
        return 0xf4d2bc;
      case "frozen_halls":
        return 0xcfe2f0;
      case "bone_throne":
        return 0xe4d6d6;
      case "forgotten_catacombs":
      default:
        return undefined;
    }
  }

  private clearHazards(): void {
    for (const visual of this.hazardVisuals) {
      visual.destroy();
    }
    this.hazardVisuals = [];
    this.hazards = [];
    this.playerHazardContact.clear();
  }

  private pickHazardPositions(count: number): Array<{ x: number; y: number }> {
    const candidates = this.dungeon.spawnPoints.filter(
      (point) => Math.hypot(point.x - this.player.position.x, point.y - this.player.position.y) >= 4
    );
    const picked: Array<{ x: number; y: number }> = [];
    const mutable = [...candidates];

    while (picked.length < count && mutable.length > 0) {
      const idx = this.hazardRng.nextInt(0, mutable.length - 1);
      const candidate = mutable.splice(idx, 1)[0];
      if (candidate === undefined) {
        break;
      }
      const tooClose = picked.some((entry) => Math.hypot(entry.x - candidate.x, entry.y - candidate.y) < 3);
      if (!tooClose) {
        picked.push({ ...candidate });
      }
    }

    return picked;
  }

  private initializeHazards(nowMs: number): void {
    if (this.floorConfig.isBossFloor) {
      return;
    }

    const hazardIds = this.currentBiome.hazardPool;
    if (hazardIds.length === 0) {
      return;
    }

    const count = this.run.currentFloor <= 2 ? 1 : this.run.currentFloor <= 4 ? 2 : 3;
    const positions = this.pickHazardPositions(count);
    for (let i = 0; i < positions.length; i += 1) {
      const position = positions[i]!;
      const hazardId = this.hazardRng.pick(hazardIds);
      const def = HAZARD_MAP[hazardId];
      if (def === undefined) {
        continue;
      }
      const runtime = createHazardRuntimeState(
        def,
        `hazard-${this.run.currentFloor}-${i}`,
        position,
        nowMs
      );
      this.hazards.push(runtime);

      const visual = this.renderSystem.spawnTelegraphCircle(position, runtime.radiusTiles, this.origin);
      const baseAlpha =
        runtime.type === "damage_zone"
          ? 0.22
          : runtime.type === "movement_modifier"
            ? 0.16
            : 0.12;
      visual.setAlpha(baseAlpha);
      if (visual instanceof Phaser.GameObjects.Image) {
        const tint =
          runtime.type === "damage_zone"
            ? 0xdb694d
            : runtime.type === "movement_modifier"
              ? 0x6aa7cf
              : 0xbfa4d9;
        visual.setTint(tint);
      } else if (visual instanceof Phaser.GameObjects.Ellipse) {
        const fill =
          runtime.type === "damage_zone"
            ? 0xdb694d
            : runtime.type === "movement_modifier"
              ? 0x6aa7cf
              : 0xbfa4d9;
        visual.setFillStyle(fill, baseAlpha);
      }
      this.hazardVisuals.push(visual);
    }
  }

  private destroyEventNode(): void {
    if (this.eventNode !== null) {
      this.eventNode.marker.destroy();
    }
    this.eventNode = null;
    this.merchantOffers = [];
    this.eventPanelOpen = false;
  }

  private pickFloorEventPosition(): { x: number; y: number } | null {
    const candidates = this.dungeon.spawnPoints.filter((point) => {
      if (Math.hypot(point.x - this.player.position.x, point.y - this.player.position.y) < 6) {
        return false;
      }
      if (Math.hypot(point.x - this.staircaseState.position.x, point.y - this.staircaseState.position.y) < 2) {
        return false;
      }
      for (const hazard of this.hazards) {
        if (Math.hypot(point.x - hazard.position.x, point.y - hazard.position.y) < hazard.radiusTiles + 1) {
          return false;
        }
      }
      return true;
    });

    if (candidates.length === 0) {
      return null;
    }
    const picked = this.eventRng.pick(candidates);
    return { x: picked.x, y: picked.y };
  }

  private setupFloorEvent(nowMs: number): void {
    this.destroyEventNode();
    if (this.floorConfig.isBossFloor) {
      return;
    }
    if (this.eventRng.next() > FLOOR_EVENT_SPAWN_CHANCE) {
      return;
    }

    const eventDef = pickRandomEvent(
      RANDOM_EVENT_DEFS,
      this.run.currentFloor,
      this.currentBiome.id,
      this.unlockedEventIds,
      this.eventRng
    );
    if (eventDef === null) {
      return;
    }
    const position = this.pickFloorEventPosition();
    if (position === null) {
      return;
    }

    const marker = this.renderSystem.spawnTelegraphCircle(position, 0.8, this.origin);
    marker.setAlpha(0.18);
    if (marker instanceof Phaser.GameObjects.Image) {
      marker.setTint(0xd0a86f);
    }

    this.eventNode = {
      eventDef,
      position,
      marker,
      resolved: false
    };
    this.eventBus.emit("event:spawn", {
      eventId: eventDef.id,
      eventName: eventDef.name,
      floor: this.run.currentFloor,
      timestampMs: nowMs
    });
  }

  private updateEventInteraction(nowMs: number): void {
    if (this.eventNode === null || this.eventNode.resolved || this.eventPanelOpen) {
      return;
    }
    const distance = Math.hypot(
      this.player.position.x - this.eventNode.position.x,
      this.player.position.y - this.eventNode.position.y
    );
    if (distance > 0.9) {
      return;
    }
    this.openEventPanel(nowMs);
  }

  private openEventPanel(nowMs: number): void {
    if (this.eventNode === null || this.eventNode.resolved) {
      return;
    }
    this.eventPanelOpen = true;
    const eventDef = this.eventNode.eventDef;
    const choices = eventDef.choices.map((choice) => {
      if (canPayEventCost(choice.cost, this.player.health, this.player.mana, this.run.runEconomy.obols)) {
        return { choice, enabled: true as const };
      }
      const reason = choice.cost === undefined ? "Unavailable." : `Need ${choice.cost.amount} ${choice.cost.type}.`;
      return { choice, enabled: false as const, disabledReason: reason };
    });

    this.hud.showEventPanel(
      eventDef,
      choices,
      (choiceId) => this.resolveEventChoice(choiceId, this.time.now),
      () => this.dismissCurrentEvent(this.time.now)
    );
    this.hud.appendLog(`Event encountered: ${eventDef.name}.`, "info", nowMs);
  }

  private dismissCurrentEvent(nowMs: number): void {
    if (this.eventNode === null) {
      return;
    }
    this.hud.appendLog(`Left event ${this.eventNode.eventDef.name} without interaction.`, "info", nowMs);
    this.consumeCurrentEvent();
  }

  private applyEventCost(nowMs: number, eventId: string, choiceId: string): boolean {
    if (this.eventNode === null) {
      return false;
    }
    const choice = this.eventNode.eventDef.choices.find((entry) => entry.id === choiceId);
    if (choice === undefined) {
      return false;
    }
    const cost = choice.cost;
    if (!canPayEventCost(cost, this.player.health, this.player.mana, this.run.runEconomy.obols)) {
      const reason = cost === undefined ? "invalid cost" : `need ${cost.amount} ${cost.type}`;
      this.hud.appendLog(`Cannot choose ${choice.name}: ${reason}.`, "warn", nowMs);
      this.openEventPanel(nowMs);
      return false;
    }

    if (cost !== undefined) {
      if (cost.type === "health") {
        this.player = {
          ...this.player,
          health: Math.max(1, this.player.health - cost.amount)
        };
      } else if (cost.type === "mana") {
        this.player = {
          ...this.player,
          mana: Math.max(0, this.player.mana - cost.amount)
        };
      } else {
        this.run = spendRunObols(this.run, cost.amount);
      }
      this.hud.appendLog(
        `Event cost paid (${eventId}/${choiceId}): ${cost.amount} ${cost.type}.`,
        "warn",
        nowMs
      );
    }

    return true;
  }

  private applyEventReward(reward: EventReward, nowMs: number, source: string): void {
    if (reward.type === "health") {
      this.player = {
        ...this.player,
        health: Math.min(this.player.derivedStats.maxHealth, this.player.health + reward.amount)
      };
      this.hud.appendLog(`${source}: restored ${reward.amount} HP.`, "success", nowMs);
      return;
    }
    if (reward.type === "mana") {
      this.player = {
        ...this.player,
        mana: Math.min(this.player.derivedStats.maxMana, this.player.mana + reward.amount)
      };
      this.hud.appendLog(`${source}: restored ${reward.amount} mana.`, "success", nowMs);
      return;
    }
    if (reward.type === "obol") {
      this.run = addRunObols(this.run, reward.amount);
      this.hud.appendLog(`${source}: gained ${reward.amount} Obol.`, "success", nowMs);
      return;
    }
    if (reward.type === "xp") {
      const xpResult = applyXpGain(this.player, reward.amount, "intelligence");
      this.player = this.refreshPlayerStatsFromEquipment(xpResult.player);
      this.hud.appendLog(`${source}: gained ${reward.amount} XP.`, "success", nowMs);
      if (xpResult.leveledUp) {
        this.eventBus.emit("player:levelup", {
          playerId: this.player.id,
          level: this.player.level,
          timestampMs: nowMs
        });
        this.offerLevelupSkill();
      }
      return;
    }
    if (reward.type === "mapping") {
      this.mapRevealActive = true;
      this.hud.appendLog(`${source}: mapping scroll revealed objective.`, "info", nowMs);
      return;
    }
    if (reward.type === "consumable") {
      this.consumables = grantConsumable(this.consumables, reward.consumableId, reward.amount);
      this.hud.appendLog(
        `${source}: gained ${reward.amount}x ${reward.consumableId}.`,
        "success",
        nowMs
      );
      return;
    }
    const lootTableId = reward.lootTableId;
    const table =
      reward.itemDefId === undefined
        ? lootTableId === undefined
          ? undefined
          : LOOT_TABLE_MAP[lootTableId]
        : {
            id: `event-${reward.itemDefId}`,
            entries: [{ itemDefId: reward.itemDefId, weight: 1, minFloor: 1 }]
          };
    if (table === undefined) {
      this.hud.appendLog(`${source}: no valid item reward table.`, "warn", nowMs);
      return;
    }
    const item = rollItemDrop(
      table,
      ITEM_DEF_MAP,
      this.run.currentFloor,
      this.lootRng,
      `event-${Math.floor(nowMs)}-${this.run.currentFloor}`
    );
    if (item === null) {
      this.hud.appendLog(`${source}: item roll failed.`, "warn", nowMs);
      return;
    }
    this.player = collectLoot(this.player, item);
    this.run = {
      ...this.run,
      lootCollected: this.run.lootCollected + 1
    };
    this.hud.appendLog(`${source}: acquired ${item.name}.`, "success", nowMs);
  }

  private applyEventPenalty(reward: EventReward, nowMs: number, source: string): void {
    if (reward.type === "health") {
      this.player = {
        ...this.player,
        health: Math.max(0, this.player.health - reward.amount)
      };
      this.hud.appendLog(`${source}: lost ${reward.amount} HP.`, "danger", nowMs);
      if (this.player.health <= 0) {
        this.lastDeathReason = `Fell to event penalty (${reward.amount} health).`;
      }
      return;
    }
    if (reward.type === "mana") {
      this.player = {
        ...this.player,
        mana: Math.max(0, this.player.mana - reward.amount)
      };
      this.hud.appendLog(`${source}: lost ${reward.amount} mana.`, "warn", nowMs);
      return;
    }
    if (reward.type === "obol") {
      const spent = Math.min(this.run.runEconomy.obols, reward.amount);
      this.run = spendRunObols(this.run, spent);
      this.hud.appendLog(`${source}: lost ${spent} Obol.`, "warn", nowMs);
      return;
    }
    this.hud.appendLog(`${source}: penalty ignored (${reward.type}).`, "warn", nowMs);
  }

  private resolveEventChoice(choiceId: string, nowMs: number): void {
    if (this.eventNode === null || this.eventNode.resolved) {
      return;
    }
    const { eventDef } = this.eventNode;
    const choice = eventDef.choices.find((entry) => entry.id === choiceId);
    if (choice === undefined) {
      this.hud.appendLog(`Event choice ${choiceId} not found.`, "warn", nowMs);
      return;
    }
    if (!this.applyEventCost(nowMs, eventDef.id, choice.id)) {
      this.hudDirty = true;
      return;
    }

    this.eventBus.emit("event:choice", {
      eventId: eventDef.id,
      choiceId: choice.id,
      timestampMs: nowMs
    });

    for (const reward of choice.rewards) {
      this.applyEventReward(reward, nowMs, `Event ${eventDef.name}`);
    }

    if (rollEventRisk(choice, this.eventRng) && choice.risk !== undefined) {
      this.applyEventPenalty(choice.risk.penalty, nowMs, `${eventDef.name} backlash`);
    }

    if (eventDef.id === "wandering_merchant" && choice.id === "browse") {
      this.openMerchantPanel(nowMs);
      this.hudDirty = true;
      return;
    }

    this.consumeCurrentEvent();
    this.hudDirty = true;
    if (this.player.health <= 0) {
      this.finishRun(false);
    }
  }

  private openMerchantPanel(nowMs: number): void {
    const merchantPool = LOOT_TABLE_MAP.merchant_pool;
    if (merchantPool === undefined) {
      this.hud.appendLog("Merchant pool missing.", "warn", nowMs);
      this.consumeCurrentEvent();
      return;
    }
    if (this.merchantOffers.length === 0) {
      this.merchantOffers = createMerchantOffers(
        merchantPool.entries,
        this.run.currentFloor,
        this.merchantRng,
        3
      );
      this.eventBus.emit("merchant:offer", {
        floor: this.run.currentFloor,
        offerCount: this.merchantOffers.length,
        timestampMs: nowMs
      });
    }

    const view = this.merchantOffers.map((offer) => {
      const itemDef = ITEM_DEF_MAP[offer.itemDefId];
      return {
        ...offer,
        itemName: itemDef?.name ?? offer.itemDefId,
        rarity: itemDef?.rarity ?? "common"
      };
    });
    this.eventPanelOpen = true;
    this.hud.showMerchantPanel(
      view,
      (offerId) => this.tryBuyMerchantOffer(offerId, this.time.now),
      () => this.consumeCurrentEvent()
    );
  }

  private tryBuyMerchantOffer(offerId: string, nowMs: number): void {
    const offer = this.merchantOffers.find((entry) => entry.offerId === offerId);
    if (offer === undefined) {
      this.hud.appendLog(`Offer ${offerId} unavailable.`, "warn", nowMs);
      return;
    }
    if (this.run.runEconomy.obols < offer.priceObol) {
      this.hud.appendLog(`Not enough Obol for ${offer.itemDefId}.`, "warn", nowMs);
      return;
    }

    const item = rollItemDrop(
      {
        id: `merchant-${offer.itemDefId}`,
        entries: [{ itemDefId: offer.itemDefId, weight: 1, minFloor: 1 }]
      },
      ITEM_DEF_MAP,
      this.run.currentFloor,
      this.lootRng,
      `merchant-${offer.offerId}-${Math.floor(nowMs)}`
    );
    if (item === null) {
      this.hud.appendLog(`Merchant failed to deliver ${offer.itemDefId}.`, "warn", nowMs);
      return;
    }

    this.run = spendRunObols(this.run, offer.priceObol);
    this.player = collectLoot(this.player, item);
    this.run = {
      ...this.run,
      lootCollected: this.run.lootCollected + 1
    };
    this.eventBus.emit("merchant:purchase", {
      offerId: offer.offerId,
      itemId: item.id,
      itemName: item.name,
      priceObol: offer.priceObol,
      timestampMs: nowMs
    });
    this.merchantOffers = this.merchantOffers.filter((entry) => entry.offerId !== offer.offerId);
    if (this.merchantOffers.length === 0) {
      this.hud.appendLog("Merchant sold out.", "info", nowMs);
      this.consumeCurrentEvent();
    } else {
      this.openMerchantPanel(nowMs);
    }
    this.hudDirty = true;
  }

  private consumeCurrentEvent(): void {
    if (this.eventNode !== null) {
      this.eventNode.resolved = true;
    }
    this.destroyEventNode();
    this.hud.hideEventPanel();
    this.eventPanelOpen = false;
    this.hudDirty = true;
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
    if (this.runEnded || this.eventPanelOpen) {
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

  private resolvePlayerHazardMovementMultiplier(): number {
    const modifiers: number[] = [];
    for (const hazard of this.hazards) {
      if (hazard.type !== "movement_modifier" || hazard.movementMultiplier === undefined) {
        continue;
      }
      if (isInsideHazard(this.player.position, hazard)) {
        modifiers.push(hazard.movementMultiplier);
      }
    }
    return multiplyMovementModifiers(modifiers);
  }

  private updateHazardContactEvents(nowMs: number): void {
    for (const hazard of this.hazards) {
      const inside = isInsideHazard(this.player.position, hazard);
      const previous = this.playerHazardContact.get(hazard.id) === true;
      if (inside && !previous) {
        this.playerHazardContact.set(hazard.id, true);
        this.eventBus.emit("hazard:enter", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          targetId: this.player.id,
          timestampMs: nowMs
        });
      } else if (!inside && previous) {
        this.playerHazardContact.delete(hazard.id);
        this.eventBus.emit("hazard:exit", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          targetId: this.player.id,
          timestampMs: nowMs
        });
      }
    }
  }

  private applyHazardDamageToPlayer(
    hazard: HazardRuntimeState,
    amount: number,
    nowMs: number
  ): void {
    const nextHealth = applyHazardDamage(this.player.health, amount);
    this.player = {
      ...this.player,
      health: nextHealth
    };
    this.eventBus.emit("hazard:damage", {
      hazardId: hazard.id,
      hazardType: hazard.type,
      targetId: this.player.id,
      amount,
      remainingHealth: nextHealth,
      timestampMs: nowMs
    });
    if (nextHealth <= 0) {
      this.lastDeathReason = `Fatal ${hazard.type} damage from ${hazard.defId} (${amount}).`;
    }
    this.hudDirty = true;
  }

  private applyHazardDamageToMonsters(
    hazard: HazardRuntimeState,
    amount: number,
    nowMs: number
  ): void {
    const deadIds: string[] = [];
    for (const monster of this.entityManager.listLivingMonsters()) {
      if (!isInsideHazard(monster.state.position, hazard)) {
        continue;
      }
      const nextHealth = applyHazardDamage(monster.state.health, amount);
      monster.state.health = nextHealth;
      this.eventBus.emit("hazard:damage", {
        hazardId: hazard.id,
        hazardType: hazard.type,
        targetId: monster.state.id,
        amount,
        remainingHealth: nextHealth,
        timestampMs: nowMs
      });
      if (nextHealth <= 0) {
        deadIds.push(monster.state.id);
      }
    }

    if (deadIds.length === 0) {
      return;
    }

    for (const monsterId of deadIds) {
      const dead = this.entityManager.removeMonsterById(monsterId);
      if (dead === null) {
        continue;
      }
      dead.sprite.destroy();
      dead.healthBarBg.destroy();
      dead.healthBarFg.destroy();
      dead.affixMarker?.destroy();
      this.run = addRunObols(
        {
          ...this.run,
          kills: this.run.kills + 1,
          totalKills: this.run.totalKills + 1
        },
        1
      );
    }
    this.hudDirty = true;
  }

  private updateHazards(nowMs: number): void {
    if (this.hazards.length === 0) {
      return;
    }

    this.updateHazardContactEvents(nowMs);
    for (let i = 0; i < this.hazards.length; i += 1) {
      const hazard = this.hazards[i]!;
      const visual = this.hazardVisuals[i];
      const damage = hazard.damagePerTick ?? 0;
      if (hazard.type === "damage_zone") {
        if (!shouldRunHazardTick(nowMs, hazard.nextTickAtMs)) {
          continue;
        }
        hazard.nextTickAtMs = nextHazardTickAt(nowMs, hazard.tickIntervalMs);
        if (isInsideHazard(this.player.position, hazard)) {
          this.applyHazardDamageToPlayer(hazard, damage, nowMs);
        }
        this.applyHazardDamageToMonsters(hazard, damage, nowMs);
        continue;
      }

      if (hazard.type === "periodic_trap") {
        if (visual !== undefined && hazard.nextTriggerAtMs !== undefined && hazard.telegraphMs !== undefined) {
          const telegraphStartsAt = hazard.nextTriggerAtMs - hazard.telegraphMs;
          if (nowMs >= telegraphStartsAt) {
            visual.setAlpha(Math.max(0.26, visual.alpha));
          }
        }

        if (!shouldTriggerPeriodicHazard(nowMs, hazard.nextTriggerAtMs)) {
          continue;
        }
        this.eventBus.emit("hazard:trigger", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          position: { ...hazard.position },
          radiusTiles: hazard.radiusTiles,
          timestampMs: nowMs
        });
        if (isInsideHazard(this.player.position, hazard)) {
          this.applyHazardDamageToPlayer(hazard, damage, nowMs);
        }
        this.applyHazardDamageToMonsters(hazard, damage, nowMs);
        hazard.nextTriggerAtMs = nextHazardTriggerAt(nowMs, hazard.triggerIntervalMs);
        if (visual !== undefined) {
          visual.setAlpha(0.12);
        }
      }
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
        dead.affixMarker?.destroy();
        if (hasMonsterAffix(dead.state, "splitting")) {
          this.spawnSplitChildren(dead.state, dead.archetype, nowMs);
        }
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

  private resolveEntityLabel(entityId: string): string {
    const cached = this.entityLabelById.get(entityId);
    if (cached !== undefined) {
      return cached;
    }

    if (entityId === this.player.id) {
      return "Vanguard";
    }

    if (entityId === this.bossDef.id) {
      return this.bossDef.name;
    }

    const monster = this.entityManager.findMonsterById(entityId);
    if (monster !== undefined) {
      const name = monster.archetype.name;
      this.entityLabelById.set(entityId, name);
      return name;
    }

    return entityId;
  }

  private updateMonsters(dt: number, nowMs: number): void {
    const aiResult = this.aiSystem.updateMonsters(
      this.entityManager.listLivingMonsters(),
      this.player,
      dt,
      nowMs
    );

    for (const transition of aiResult.transitions) {
      this.eventBus.emit("monster:stateChange", transition);
    }

    for (const action of aiResult.supportActions) {
      const target = this.entityManager.findMonsterById(action.targetMonsterId);
      const source = this.entityManager.findMonsterById(action.sourceMonsterId);
      if (target === undefined || source === undefined || target.state.health <= 0) {
        continue;
      }
      const before = target.state.health;
      target.state.health = Math.min(target.state.maxHealth, target.state.health + action.amount);
      if (target.state.health > before) {
        this.hud.appendLog(
          `${source.archetype.name} healed ${target.archetype.name} for ${target.state.health - before}.`,
          "info",
          action.timestampMs
        );
        this.hudDirty = true;
      }
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
    for (const event of monsterCombat.combatEvents) {
      if (event.kind === "dodge" || event.amount <= 0) {
        continue;
      }
      const source = this.entityManager.findMonsterById(event.sourceId);
      if (source === undefined || !hasMonsterAffix(source.state, "vampiric")) {
        continue;
      }
      const heal = Math.max(1, Math.floor(event.amount * 0.35));
      const before = source.state.health;
      source.state.health = Math.min(source.state.maxHealth, source.state.health + heal);
      const actual = source.state.health - before;
      if (actual <= 0) {
        continue;
      }
      this.eventBus.emit("monster:leech", {
        monsterId: source.state.id,
        targetId: event.targetId,
        amount: actual,
        timestampMs: nowMs
      });
    }
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
        aiState: "chase",
        aiBehavior: "chase",
        affixes: []
      };
      const runtime = this.renderSystem.spawnMonster(state, archetype, this.origin);
      this.entityLabelById.set(runtime.state.id, runtime.archetype.name);
      this.entityManager.listMonsters().push(runtime);
    }
  }

  private spawnSplitChildren(
    sourceState: MonsterState,
    archetype: (typeof MONSTER_ARCHETYPES)[number],
    nowMs: number
  ): void {
    const spawnedIds: string[] = [];
    const sourceAffixes = sourceState.affixes ?? [];
    const childAffixes = sourceAffixes.filter((affix) => affix !== "splitting");

    for (let i = 0; i < 2; i += 1) {
      const angle = (Math.PI * 2 * i) / 2;
      const childState: MonsterState = {
        ...sourceState,
        id: `split-${sourceState.id}-${i}-${Math.floor(nowMs)}`,
        health: Math.max(1, Math.floor(sourceState.maxHealth * 0.42)),
        maxHealth: Math.max(1, Math.floor(sourceState.maxHealth * 0.42)),
        damage: Math.max(1, Math.floor(sourceState.damage * 0.68)),
        xpValue: Math.max(1, Math.floor(sourceState.xpValue * 0.45)),
        dropTableId: "",
        position: {
          x: sourceState.position.x + Math.cos(angle) * 0.7,
          y: sourceState.position.y + Math.sin(angle) * 0.7
        },
        aiState: "idle",
        affixes: childAffixes
      };
      const runtime = this.renderSystem.spawnMonster(childState, archetype, this.origin);
      this.entityManager.listMonsters().push(runtime);
      this.entityLabelById.set(childState.id, `${archetype.name} Fragment`);
      spawnedIds.push(childState.id);
      for (const affix of childAffixes) {
        this.eventBus.emit("monster:affixApplied", {
          monsterId: childState.id,
          affixId: affix,
          timestampMs: nowMs
        });
      }
    }

    if (spawnedIds.length > 0) {
      this.eventBus.emit("monster:split", {
        sourceMonsterId: sourceState.id,
        spawnedIds,
        timestampMs: nowMs
      });
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
      biomeMonsterPool: this.currentBiome.monsterPool,
      blockedPositions: this.hazards.map((hazard) => hazard.position),
      unlockedAffixes: this.unlockedAffixIds,
      rng: this.spawnRng
    });

    const runtimes = monsters.map((monster) => this.renderSystem.spawnMonster(monster.state, monster.archetype, this.origin));
    for (const runtime of runtimes) {
      this.entityLabelById.set(runtime.state.id, runtime.archetype.name);
      for (const affix of runtime.state.affixes ?? []) {
        this.eventBus.emit("monster:affixApplied", {
          monsterId: runtime.state.id,
          affixId: affix,
          timestampMs: this.time.now
        });
      }
    }
    this.entityManager.setMonsters(runtimes);
  }

  private spawnBoss(): void {
    const roomCenter = findStaircasePosition(this.dungeon, this.dungeon.playerSpawn);
    this.bossState = initBossState(this.bossDef, roomCenter);
    this.entityLabelById.set(this.bossDef.id, this.bossDef.name);
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

    if (!this.staircaseState.visible) {
      return;
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
    this.consumeCurrentEvent();
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
    this.renderHud();
    this.hudDirty = false;
    if (isVictory) {
      this.hud.hideDeathOverlay();
    } else {
      this.hud.showDeathOverlay(this.lastDeathReason);
    }
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
    if (this.player.skills === undefined || this.runEnded || this.eventPanelOpen) {
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
        dead.affixMarker?.destroy();
        if (hasMonsterAffix(dead.state, "splitting")) {
          this.spawnSplitChildren(dead.state, dead.archetype, this.time.now);
        }

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

  private tryUseConsumable(consumableId: ConsumableId): void {
    if (this.runEnded || this.eventPanelOpen) {
      return;
    }
    const nowMs = this.time.now;
    const availability = canUseConsumable(this.player, this.consumables, consumableId, nowMs);
    if (!availability.ok) {
      this.eventBus.emit("consumable:failed", {
        playerId: this.player.id,
        consumableId,
        reason: availability.reason,
        timestampMs: nowMs
      });
      return;
    }

    const result = useConsumable(this.player, this.consumables, consumableId, nowMs);
    this.player = result.player;
    this.consumables = result.consumables;
    if (result.mappingRevealed) {
      this.mapRevealActive = true;
      this.hud.appendLog("Objective mapped on HUD.", "info", nowMs);
    }
    this.eventBus.emit("consumable:use", {
      playerId: this.player.id,
      consumableId,
      amountApplied: result.amountApplied,
      remainingCharges: this.consumables.charges[consumableId] ?? 0,
      timestampMs: nowMs
    });
    this.hudDirty = true;
  }

  private renderHud(): void {
    const nowMs = this.time.now;
    const consumables = CONSUMABLE_DEFS.map((def) => {
      const cooldownLeftMs = Math.max(0, (this.consumables.cooldowns[def.id] ?? 0) - nowMs);
      const availability = canUseConsumable(this.player, this.consumables, def.id, nowMs);
      return {
        id: def.id,
        name: def.name,
        hotkey: def.hotkey ?? "-",
        charges: this.consumables.charges[def.id] ?? 0,
        cooldownLeftMs,
        ...(availability.ok ? {} : { disabledReason: availability.reason })
      };
    });

    const runState = {
      floor: this.run.currentFloor,
      biome: this.currentBiome.name,
      kills: this.run.kills,
      lootCollected: this.run.lootCollected,
      targetKills: this.floorConfig.monsterCount,
      obols: this.run.runEconomy.obols,
      floorGoalReached: this.staircaseState.visible || this.mapRevealActive,
      mappingRevealed: this.mapRevealActive,
      consumables,
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
    this.hud.hideDeathOverlay();
    this.hud.hideEventPanel();
    this.destroyEventNode();
    this.clearHazards();
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
