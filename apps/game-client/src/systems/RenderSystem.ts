import Phaser from "phaser";
import type { DungeonLayout, ItemInstance, MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";
import type { MonsterRuntime } from "./EntityManager";
import { gridToIso } from "./iso";
import { renderDungeonProps } from "./renderDungeonProps";

export interface WorldBoundsConfig {
  origin: { x: number; y: number };
  worldBounds: { x: number; y: number; width: number; height: number };
}

export interface RenderSyncStats {
  monstersVisible: number;
  monstersCulled: number;
}

export interface ProjectileSpriteHandle {
  active: boolean;
  setPosition(x: number, y: number): this;
  setDepth(value: number): this;
  destroy(): void;
}

interface DungeonRenderOptions {
  tileKey?: string;
  wallKey?: string;
  tintColor?: number;
  accentColor?: number;
  variantSeed?: string;
  pacingKind?: "combat" | "recovery" | "preparation" | "boss";
}

export class RenderSystem {
  private readonly multiplyBlendFallbackKeys = new Set<string>();
  private lastSyncStats: RenderSyncStats = {
    monstersVisible: 0,
    monstersCulled: 0
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileWidth: number,
    private readonly tileHeight: number,
    private readonly entityDepthOffset: number
  ) {}

  setMultiplyBlendFallbackKeys(keys: Iterable<string>): void {
    this.multiplyBlendFallbackKeys.clear();
    for (const key of keys) {
      this.multiplyBlendFallbackKeys.add(key);
    }
  }

  private applyEntityBlendFallback(
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
    textureKey: string
  ): void {
    if (!(sprite instanceof Phaser.GameObjects.Image)) {
      return;
    }
    if (!this.multiplyBlendFallbackKeys.has(textureKey)) {
      return;
    }
    sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private mixColor(baseColor: number, targetColor: number, ratio: number): number {
    const base = Phaser.Display.Color.IntegerToRGB(baseColor);
    const target = Phaser.Display.Color.IntegerToRGB(targetColor);
    const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
    return Phaser.Display.Color.GetColor(
      Math.round(base.r + (target.r - base.r) * clampedRatio),
      Math.round(base.g + (target.g - base.g) * clampedRatio),
      Math.round(base.b + (target.b - base.b) * clampedRatio)
    );
  }

  private tileVariantHash(seed: string, x: number, y: number): number {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= x + 1;
    hash = Math.imul(hash, 16777619);
    hash ^= y + 1;
    hash = Math.imul(hash, 16777619);
    return hash >>> 0;
  }

  private pacingOverlayTint(pacingKind: DungeonRenderOptions["pacingKind"], accentColor: number): number {
    if (pacingKind === "recovery") {
      return 0xd9c48c;
    }
    if (pacingKind === "preparation") {
      return 0xc9d6e8;
    }
    if (pacingKind === "boss") {
      return 0xd9b0b0;
    }
    return accentColor;
  }

  private shouldRenderWall(dungeon: DungeonLayout, x: number, y: number): boolean {
    if (dungeon.walkable[y]?.[x]) {
      return false;
    }
    return (
      dungeon.walkable[y - 1]?.[x] === true ||
      dungeon.walkable[y + 1]?.[x] === true ||
      dungeon.walkable[y]?.[x - 1] === true ||
      dungeon.walkable[y]?.[x + 1] === true
    );
  }

  computeWorldBounds(dungeon: DungeonLayout): WorldBoundsConfig {
    const corners = [
      gridToIso(0, 0, this.tileWidth, this.tileHeight, 0, 0),
      gridToIso(dungeon.width - 1, 0, this.tileWidth, this.tileHeight, 0, 0),
      gridToIso(0, dungeon.height - 1, this.tileWidth, this.tileHeight, 0, 0),
      gridToIso(dungeon.width - 1, dungeon.height - 1, this.tileWidth, this.tileHeight, 0, 0)
    ];

    const minX = Math.min(...corners.map((point) => point.x));
    const maxX = Math.max(...corners.map((point) => point.x));
    const minY = Math.min(...corners.map((point) => point.y));
    const maxY = Math.max(...corners.map((point) => point.y));
    const padding = 280;

    const origin = {
      x: padding - minX,
      y: padding - minY
    };
    const worldBounds = {
      x: minX + origin.x - padding,
      y: minY + origin.y - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };

    return {
      origin,
      worldBounds
    };
  }

  configureCamera(
    camera: Phaser.Cameras.Scene2D.Camera,
    worldBounds: { x: number; y: number; width: number; height: number },
    follow: Phaser.GameObjects.GameObject
  ): void {
    camera.setBounds(worldBounds.x, worldBounds.y, worldBounds.width, worldBounds.height);
    camera.startFollow(follow, true, 0.12, 0.12);
    camera.setZoom(1);
    camera.roundPixels = true;
  }

  drawDungeon(
    dungeon: DungeonLayout,
    origin: { x: number; y: number },
    tintOrOptions?: number | DungeonRenderOptions
  ): void {
    const options =
      typeof tintOrOptions === "number"
        ? { tintColor: tintOrOptions }
        : (tintOrOptions ?? {});
    const preferredTileKey = options.tileKey ?? "tile_floor_01";
    const tileTextureKey = this.scene.textures.exists(preferredTileKey)
      ? preferredTileKey
      : this.scene.textures.exists("tile_floor_01")
        ? "tile_floor_01"
        : null;
    const wallTextureKey =
      options.wallKey !== undefined && this.scene.textures.exists(options.wallKey) ? options.wallKey : null;
    const crackGraphics = this.scene.add.graphics().setDepth(2);
    const accentColor = options.accentColor ?? 0xcfb990;
    const pacingTint = this.pacingOverlayTint(options.pacingKind, accentColor);
    const variantSeed = options.variantSeed ?? dungeon.layoutHash;

    if (tileTextureKey !== null) {
      for (let y = 0; y < dungeon.height; y += 1) {
        for (let x = 0; x < dungeon.width; x += 1) {
          if (!dungeon.walkable[y]?.[x]) {
            continue;
          }
          const iso = gridToIso(x, y, this.tileWidth, this.tileHeight, origin.x, origin.y);
          const variantHash = this.tileVariantHash(variantSeed, x, y);
          const tile = this.scene.add
            .image(iso.x, iso.y, tileTextureKey)
            .setDisplaySize(this.tileWidth, this.tileHeight)
            .setDepth(iso.y);
          const baseTint = options.tintColor ?? 0xffffff;
          const overlayRatio =
            variantHash % 11 === 0
              ? 0.16
              : variantHash % 7 === 0
                ? 0.11
                : variantHash % 5 === 0
                  ? 0.07
                  : 0;
          tile.setTint(overlayRatio > 0 ? this.mixColor(baseTint, pacingTint, overlayRatio) : baseTint);
          if (variantHash % 17 === 0 || (options.pacingKind !== "combat" && variantHash % 13 === 0)) {
            crackGraphics.lineStyle(1, this.mixColor(0x1a2328, pacingTint, 0.22), 0.28);
            crackGraphics.beginPath();
            crackGraphics.moveTo(iso.x - this.tileWidth * 0.18, iso.y - this.tileHeight * 0.08);
            crackGraphics.lineTo(iso.x - this.tileWidth * 0.02, iso.y + this.tileHeight * 0.02);
            crackGraphics.lineTo(iso.x + this.tileWidth * 0.16, iso.y - this.tileHeight * 0.12);
            crackGraphics.strokePath();
          }
        }
      }
      if (wallTextureKey !== null) {
        for (let y = 0; y < dungeon.height; y += 1) {
          for (let x = 0; x < dungeon.width; x += 1) {
            if (!this.shouldRenderWall(dungeon, x, y)) {
              continue;
            }
            const iso = gridToIso(x, y, this.tileWidth, this.tileHeight, origin.x, origin.y);
            this.scene.add
              .image(iso.x, iso.y - this.tileHeight * 0.5, wallTextureKey)
              .setOrigin(0.5, 1)
              .setDisplaySize(this.tileWidth, this.tileHeight * 1.35)
              .setDepth(iso.y + 1);
          }
        }
      }
      renderDungeonProps({
        scene: this.scene,
        props: dungeon.props,
        origin,
        tileWidth: this.tileWidth,
        tileHeight: this.tileHeight,
        entityDepthOffset: this.entityDepthOffset
      });
      return;
    }

    const graphics = this.scene.add.graphics();
    for (let y = 0; y < dungeon.height; y += 1) {
      for (let x = 0; x < dungeon.width; x += 1) {
        if (!dungeon.walkable[y]?.[x]) {
          continue;
        }

        const iso = gridToIso(x, y, this.tileWidth, this.tileHeight, origin.x, origin.y);
        const variantHash = this.tileVariantHash(variantSeed, x, y);
        const baseColor = (x + y) % 2 === 0 ? 0x2f3f45 : 0x25343a;
        const color =
          variantHash % 11 === 0
            ? this.mixColor(baseColor, pacingTint, 0.22)
            : variantHash % 5 === 0
              ? this.mixColor(baseColor, pacingTint, 0.1)
              : baseColor;
        graphics.fillStyle(color, 1);
        graphics.lineStyle(1, 0x1a2328, 0.7);
        graphics.beginPath();
        graphics.moveTo(iso.x, iso.y - this.tileHeight / 2);
        graphics.lineTo(iso.x + this.tileWidth / 2, iso.y);
        graphics.lineTo(iso.x, iso.y + this.tileHeight / 2);
        graphics.lineTo(iso.x - this.tileWidth / 2, iso.y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        if (variantHash % 17 === 0) {
          crackGraphics.lineStyle(1, this.mixColor(0x1a2328, pacingTint, 0.2), 0.28);
          crackGraphics.beginPath();
          crackGraphics.moveTo(iso.x - this.tileWidth * 0.18, iso.y - this.tileHeight * 0.08);
          crackGraphics.lineTo(iso.x + this.tileWidth * 0.14, iso.y + this.tileHeight * 0.1);
          crackGraphics.strokePath();
        }
      }
    }
    graphics.setDepth(0);
    renderDungeonProps({
      scene: this.scene,
      props: dungeon.props,
      origin,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
      entityDepthOffset: this.entityDepthOffset
    });
  }

  spawnPlayer(position: { x: number; y: number }, origin: { x: number; y: number }): {
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    yOffset: number;
  } {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    if (this.scene.textures.exists("player_vanguard")) {
      const sprite = this.scene.add
        .image(iso.x, iso.y, "player_vanguard")
        .setOrigin(0.5, 1)
        .setDisplaySize(48, 64)
        .setDepth(iso.y + this.entityDepthOffset);
      this.applyEntityBlendFallback(sprite, "player_vanguard");
      return {
        sprite,
        yOffset: 0
      };
    }

    return {
      sprite: this.scene.add
        .rectangle(iso.x, iso.y, 20, 30, 0xd2bb93)
        .setOrigin(0.5, 1)
        .setStrokeStyle(2, 0x674e2f)
        .setDepth(iso.y + this.entityDepthOffset),
      yOffset: 0
    };
  }

  spawnMonster(
    state: MonsterState,
    archetype: MonsterArchetypeDef,
    origin: { x: number; y: number }
  ): MonsterRuntime {
    const iso = gridToIso(state.position.x, state.position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    const sprite = this.scene.textures.exists(archetype.spriteId)
      ? (() => {
          const image = this.scene.add
            .image(iso.x, iso.y, archetype.spriteId)
            .setOrigin(0.5, 1)
            .setDisplaySize(40, 52)
            .setDepth(iso.y + this.entityDepthOffset);
          this.applyEntityBlendFallback(image, archetype.spriteId);
          return image;
        })()
      : this.scene.add
          .rectangle(
            iso.x,
            iso.y,
            18,
            26,
            archetype.id === "melee_grunt"
              ? 0x7b5b52
              : archetype.id === "ranged_caster"
                ? 0x5a4f7d
                : 0x835132
          )
          .setOrigin(0.5, 1)
          .setStrokeStyle(2, 0x1d1616)
          .setDepth(iso.y + this.entityDepthOffset);

    const healthBarBg = this.scene.add
      .rectangle(iso.x, iso.y - 36, 30, 5, 0x201316, 0.8)
      .setDepth(iso.y + this.entityDepthOffset + 2)
      .setVisible(false);
    const healthBarFg = this.scene.add
      .rectangle(iso.x, iso.y - 36, 28, 3, 0xd75959, 0.95)
      .setDepth(iso.y + this.entityDepthOffset + 3)
      .setVisible(false);
    const affixId = state.affixes?.[0];
    const affixMarkerAssetId =
      affixId === "frenzied"
        ? "affix_badge_frenzied"
        : affixId === "armored"
          ? "affix_badge_armored"
          : affixId === "vampiric"
            ? "affix_badge_vampiric"
            : affixId === "splitting"
              ? "affix_badge_splitting"
              : affixId === "hulking"
                ? "affix_badge_hulking"
                : affixId === "warded"
                  ? "affix_badge_warded"
                  : affixId === "skirmisher"
                    ? "affix_badge_skirmisher"
                    : affixId === "manaburn"
                      ? "affix_badge_manaburn"
                      : undefined;
    const affixColor =
      affixId === "frenzied"
        ? 0xea5d4b
        : affixId === "armored"
          ? 0x7f9ac7
          : affixId === "vampiric"
            ? 0x9a4bd2
            : affixId === "splitting"
              ? 0xd8b45f
              : affixId === "hulking"
                ? 0x6d8b4f
                : affixId === "warded"
                  ? 0x5aa4c8
                  : affixId === "skirmisher"
                    ? 0xd4b764
                    : affixId === "manaburn"
                      ? 0x6d60d8
              : null;
    const affixMarker =
      affixMarkerAssetId !== undefined && this.scene.textures.exists(affixMarkerAssetId)
        ? this.scene.add
            .image(iso.x + 14, iso.y - 45, affixMarkerAssetId)
            .setDisplaySize(14, 14)
            .setDepth(iso.y + this.entityDepthOffset + 4)
        : affixColor === null
        ? undefined
        : this.scene.add
            .ellipse(iso.x + 14, iso.y - 45, 8, 8, affixColor, 0.95)
            .setStrokeStyle(1, 0x131820, 0.9)
            .setDepth(iso.y + this.entityDepthOffset + 4);

    return {
      state,
      archetype,
      baseMoveSpeed: state.moveSpeed,
      sprite,
      healthBarBg,
      healthBarFg,
      affixMarker,
      healthBarYOffset: this.scene.textures.exists(archetype.spriteId) ? 36 : 30,
      yOffset: 0,
      nextAttackAt: 0,
      nextSupportAt: 0
    };
  }

  spawnLootSprite(
    item: ItemInstance,
    position: { x: number; y: number },
    origin: { x: number; y: number }
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    if (this.scene.textures.exists(item.iconId)) {
      return this.scene.add
        .image(iso.x, iso.y - 2, item.iconId)
        .setDisplaySize(24, 24)
        .setDepth(iso.y + this.entityDepthOffset - 10);
    }

    return this.scene.add
      .ellipse(iso.x, iso.y - 2, 10, 8, 0xd0a86f)
      .setStrokeStyle(1, 0x3f301b)
      .setDepth(iso.y + this.entityDepthOffset - 10);
  }

  spawnProjectile(
    position: { x: number; y: number },
    origin: { x: number; y: number },
    options?: {
      tint?: number;
      width?: number;
      height?: number;
    }
  ): ProjectileSpriteHandle {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    return this.scene.add
      .ellipse(
        iso.x,
        iso.y - 10,
        options?.width ?? 12,
        options?.height ?? 8,
        options?.tint ?? 0xd8c17a,
        0.92
      )
      .setStrokeStyle(1, 0x11161d, 0.8)
      .setDepth(iso.y + this.entityDepthOffset + 10);
  }

  spawnStaircase(
    position: { x: number; y: number },
    origin: { x: number; y: number },
    textureKey = "staircase_floor_exit"
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    if (this.scene.textures.exists(textureKey)) {
      return this.scene.add
        .image(iso.x, iso.y - 6, textureKey)
        .setDisplaySize(42, 42)
        .setDepth(iso.y + this.entityDepthOffset - 5);
    }
    return this.scene.add
      .ellipse(iso.x, iso.y - 4, 24, 12, 0x9ea7b8, 0.9)
      .setStrokeStyle(1, 0x20252c)
      .setDepth(iso.y + this.entityDepthOffset - 5);
  }

  spawnBoss(
    position: { x: number; y: number },
    origin: { x: number; y: number },
    textureKey = "boss_bone_sovereign"
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    if (this.scene.textures.exists(textureKey)) {
      const sprite = this.scene.add
        .image(iso.x, iso.y, textureKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(64, 80)
        .setDepth(iso.y + this.entityDepthOffset + 20);
      this.applyEntityBlendFallback(sprite, textureKey);
      return sprite;
    }
    return this.scene.add
      .rectangle(iso.x, iso.y, 38, 56, 0x6d5953)
      .setOrigin(0.5, 1)
      .setStrokeStyle(2, 0x241b18)
      .setDepth(iso.y + this.entityDepthOffset + 20);
  }

  spawnTelegraphCircle(
    position: { x: number; y: number },
    radiusTiles: number,
    origin: { x: number; y: number },
    textureKey = "telegraph_circle_red"
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    const width = Math.max(12, radiusTiles * this.tileWidth * 0.7);
    const height = Math.max(10, radiusTiles * this.tileHeight * 0.7);
    if (this.scene.textures.exists(textureKey)) {
      return this.scene.add
        .image(iso.x, iso.y, textureKey)
        .setDisplaySize(width, height)
        .setAlpha(0.45)
        .setDepth(iso.y + this.entityDepthOffset - 8);
    }
    return this.scene.add
      .ellipse(iso.x, iso.y, width, height, 0xd45757, 0.35)
      .setStrokeStyle(2, 0x7f1f1f, 0.7)
      .setDepth(iso.y + this.entityDepthOffset - 8);
  }

  spawnWorldMarker(
    position: { x: number; y: number },
    textureKey: string,
    origin: { x: number; y: number },
    displaySize: { width: number; height: number } = { width: 32, height: 32 }
  ): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.exists(textureKey)) {
      return null;
    }
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    return this.scene.add
      .image(iso.x, iso.y - 10, textureKey)
      .setDisplaySize(displaySize.width, displaySize.height)
      .setDepth(iso.y + this.entityDepthOffset + 6);
  }

  syncPlayerSprite(
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
    position: { x: number; y: number },
    yOffset: number,
    origin: { x: number; y: number }
  ): void {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    sprite.setPosition(iso.x, iso.y - yOffset);
    sprite.setDepth(iso.y + this.entityDepthOffset);
  }

  syncMonsterSprites(monsters: MonsterRuntime[], origin: { x: number; y: number }): void {
    let monstersVisible = 0;
    let monstersCulled = 0;
    for (const monster of monsters) {
      const iso = gridToIso(
        monster.state.position.x,
        monster.state.position.y,
        this.tileWidth,
        this.tileHeight,
        origin.x,
        origin.y
      );

      monster.sprite.setPosition(iso.x, iso.y - monster.yOffset);
      monster.sprite.setDepth(iso.y + this.entityDepthOffset);
      const visible = this.isPositionVisible(iso.x, iso.y, 120) && monster.state.health > 0;
      monster.sprite.setVisible(visible);
      if (!visible) {
        monstersCulled += 1;
        monster.healthBarBg.setVisible(false);
        monster.healthBarFg.setVisible(false);
        monster.affixMarker?.setVisible(false);
        continue;
      }
      monstersVisible += 1;

      const wasDamaged = monster.state.health < monster.state.maxHealth;
      monster.healthBarBg.setPosition(iso.x, iso.y - monster.healthBarYOffset);
      monster.healthBarFg.setPosition(iso.x, iso.y - monster.healthBarYOffset);
      if (monster.affixMarker !== undefined) {
        monster.affixMarker
          .setPosition(iso.x + 14, iso.y - monster.healthBarYOffset - 8)
          .setVisible(monster.state.health > 0)
          .setDepth(iso.y + this.entityDepthOffset + 4);
      }
      if (!wasDamaged) {
        monster.healthBarBg.setVisible(false);
        monster.healthBarFg.setVisible(false);
        continue;
      }

      const width = Phaser.Math.Clamp((monster.state.health / monster.state.maxHealth) * 28, 0, 28);
      monster.healthBarBg
        .setVisible(true)
        .setDepth(iso.y + this.entityDepthOffset + 2);
      monster.healthBarFg
        .setVisible(true)
        .setDisplaySize(width, 3)
        .setDepth(iso.y + this.entityDepthOffset + 3);
    }
    this.lastSyncStats = {
      monstersVisible,
      monstersCulled
    };
  }

  syncProjectileSprite(
    sprite: ProjectileSpriteHandle,
    position: { x: number; y: number },
    origin: { x: number; y: number }
  ): void {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    sprite.setPosition(iso.x, iso.y - 10);
    sprite.setDepth(iso.y + this.entityDepthOffset + 10);
  }

  getLastSyncStats(): RenderSyncStats {
    return this.lastSyncStats;
  }

  private isPositionVisible(x: number, y: number, padding: number): boolean {
    const view = this.scene.cameras.main.worldView;
    return (
      x >= view.x - padding &&
      x <= view.right + padding &&
      y >= view.y - padding &&
      y <= view.bottom + padding
    );
  }
}
