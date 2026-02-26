import type Phaser from "phaser";
import type { ItemInstance, MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";
export interface MonsterRuntime {
    state: MonsterState;
    archetype: MonsterArchetypeDef;
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    healthBarBg: Phaser.GameObjects.Rectangle;
    healthBarFg: Phaser.GameObjects.Rectangle;
    healthBarYOffset: number;
    yOffset: number;
    nextAttackAt: number;
}
export interface LootRuntime {
    item: ItemInstance;
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
    position: {
        x: number;
        y: number;
    };
}
export declare class EntityManager {
    private monsters;
    private loot;
    clear(): void;
    setMonsters(monsters: MonsterRuntime[]): void;
    listMonsters(): MonsterRuntime[];
    listLivingMonsters(): MonsterRuntime[];
    findMonsterById(monsterId: string): MonsterRuntime | undefined;
    removeMonsterById(monsterId: string): MonsterRuntime | null;
    pickMonsterAt(position: {
        x: number;
        y: number;
    }, pickRadius?: number): MonsterRuntime | null;
    addLoot(drop: LootRuntime): void;
    listLoot(): LootRuntime[];
    consumeLootNear(position: {
        x: number;
        y: number;
    }, radius?: number): LootRuntime[];
}
//# sourceMappingURL=EntityManager.d.ts.map