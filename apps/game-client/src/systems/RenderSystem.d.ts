import Phaser from "phaser";
import type { DungeonLayout, ItemInstance, MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";
import type { MonsterRuntime } from "./EntityManager";
export interface WorldBoundsConfig {
    origin: {
        x: number;
        y: number;
    };
    worldBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export declare class RenderSystem {
    private readonly scene;
    private readonly tileWidth;
    private readonly tileHeight;
    private readonly entityDepthOffset;
    constructor(scene: Phaser.Scene, tileWidth: number, tileHeight: number, entityDepthOffset: number);
    computeWorldBounds(dungeon: DungeonLayout): WorldBoundsConfig;
    configureCamera(camera: Phaser.Cameras.Scene2D.Camera, worldBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, follow: Phaser.GameObjects.GameObject): void;
    drawDungeon(dungeon: DungeonLayout, origin: {
        x: number;
        y: number;
    }): void;
    spawnPlayer(position: {
        x: number;
        y: number;
    }, origin: {
        x: number;
        y: number;
    }): {
        sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
        yOffset: number;
    };
    spawnMonster(state: MonsterState, archetype: MonsterArchetypeDef, origin: {
        x: number;
        y: number;
    }): MonsterRuntime;
    spawnLootSprite(item: ItemInstance, position: {
        x: number;
        y: number;
    }, origin: {
        x: number;
        y: number;
    }): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
    syncPlayerSprite(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, position: {
        x: number;
        y: number;
    }, yOffset: number, origin: {
        x: number;
        y: number;
    }): void;
    syncMonsterSprites(monsters: MonsterRuntime[], origin: {
        x: number;
        y: number;
    }): void;
}
//# sourceMappingURL=RenderSystem.d.ts.map