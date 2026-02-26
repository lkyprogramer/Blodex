import Phaser from "phaser";
import type { DungeonLayout, ItemInstance, MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";
import type { MonsterRuntime } from "./EntityManager";
import { gridToIso } from "./iso";

export interface WorldBoundsConfig {
  origin: { x: number; y: number };
  worldBounds: { x: number; y: number; width: number; height: number };
}

export class RenderSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileWidth: number,
    private readonly tileHeight: number,
    private readonly entityDepthOffset: number
  ) {}

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

  drawDungeon(dungeon: DungeonLayout, origin: { x: number; y: number }): void {
    if (this.scene.textures.exists("tile_floor_01")) {
      for (let y = 0; y < dungeon.height; y += 1) {
        for (let x = 0; x < dungeon.width; x += 1) {
          if (!dungeon.walkable[y]?.[x]) {
            continue;
          }
          const iso = gridToIso(x, y, this.tileWidth, this.tileHeight, origin.x, origin.y);
          this.scene.add
            .image(iso.x, iso.y, "tile_floor_01")
            .setDisplaySize(this.tileWidth, this.tileHeight)
            .setDepth(iso.y);
        }
      }
      return;
    }

    const graphics = this.scene.add.graphics();
    for (let y = 0; y < dungeon.height; y += 1) {
      for (let x = 0; x < dungeon.width; x += 1) {
        if (!dungeon.walkable[y]?.[x]) {
          continue;
        }

        const iso = gridToIso(x, y, this.tileWidth, this.tileHeight, origin.x, origin.y);
        const color = (x + y) % 2 === 0 ? 0x2f3f45 : 0x25343a;
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
      }
    }
    graphics.setDepth(0);
  }

  spawnPlayer(position: { x: number; y: number }, origin: { x: number; y: number }): {
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    yOffset: number;
  } {
    const iso = gridToIso(position.x, position.y, this.tileWidth, this.tileHeight, origin.x, origin.y);
    if (this.scene.textures.exists("player_vanguard")) {
      return {
        sprite: this.scene.add
          .image(iso.x, iso.y, "player_vanguard")
          .setOrigin(0.5, 1)
          .setDisplaySize(48, 64)
          .setDepth(iso.y + this.entityDepthOffset),
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
      ? this.scene.add
          .image(iso.x, iso.y, archetype.spriteId)
          .setOrigin(0.5, 1)
          .setDisplaySize(40, 52)
          .setDepth(iso.y + this.entityDepthOffset)
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

    return {
      state,
      archetype,
      sprite,
      healthBarBg,
      healthBarFg,
      healthBarYOffset: this.scene.textures.exists(archetype.spriteId) ? 36 : 30,
      yOffset: 0,
      nextAttackAt: 0
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
      monster.sprite.setVisible(monster.state.health > 0);

      const wasDamaged = monster.state.health < monster.state.maxHealth;
      monster.healthBarBg.setPosition(iso.x, iso.y - monster.healthBarYOffset);
      monster.healthBarFg.setPosition(iso.x, iso.y - monster.healthBarYOffset);
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
  }
}
