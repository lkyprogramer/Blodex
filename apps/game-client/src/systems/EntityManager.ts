import type Phaser from "phaser";
import type { BossRuntimeState, ItemInstance, MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";

export interface MonsterRuntime {
  state: MonsterState;
  archetype: MonsterArchetypeDef;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  healthBarBg: Phaser.GameObjects.Rectangle;
  healthBarFg: Phaser.GameObjects.Rectangle;
  affixMarker: Phaser.GameObjects.Ellipse | undefined;
  healthBarYOffset: number;
  yOffset: number;
  nextAttackAt: number;
  nextSupportAt: number;
}

export interface LootRuntime {
  item: ItemInstance;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  position: { x: number; y: number };
}

export interface BossRuntime {
  state: BossRuntimeState;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class EntityManager {
  private monsters: MonsterRuntime[] = [];
  private loot: LootRuntime[] = [];
  private boss: BossRuntime | null = null;
  private staircase: (Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse) | null = null;
  private telegraphs: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse> = [];

  clear(): void {
    this.destroyAll();
    this.monsters = [];
    this.loot = [];
    this.boss = null;
    this.staircase = null;
    this.telegraphs = [];
  }

  destroyAll(): void {
    for (const monster of this.monsters) {
      monster.sprite.destroy();
      monster.healthBarBg.destroy();
      monster.healthBarFg.destroy();
      monster.affixMarker?.destroy();
    }
    for (const drop of this.loot) {
      drop.sprite.destroy();
    }
    this.boss?.sprite.destroy();
    this.staircase?.destroy();
    for (const telegraph of this.telegraphs) {
      telegraph.destroy();
    }
  }

  setMonsters(monsters: MonsterRuntime[]): void {
    this.monsters = monsters;
  }

  listMonsters(): MonsterRuntime[] {
    return this.monsters;
  }

  listLivingMonsters(): MonsterRuntime[] {
    return this.monsters.filter((monster) => monster.state.health > 0);
  }

  findMonsterById(monsterId: string): MonsterRuntime | undefined {
    return this.monsters.find((monster) => monster.state.id === monsterId);
  }

  removeMonsterById(monsterId: string): MonsterRuntime | null {
    const index = this.monsters.findIndex((monster) => monster.state.id === monsterId);
    if (index < 0) {
      return null;
    }

    const [removed] = this.monsters.splice(index, 1);
    return removed ?? null;
  }

  pickMonsterAt(position: { x: number; y: number }, pickRadius = 1.1): MonsterRuntime | null {
    let picked: MonsterRuntime | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const monster of this.monsters) {
      if (monster.state.health <= 0) {
        continue;
      }
      const dist = distance(monster.state.position, position);
      if (dist < pickRadius && dist < bestDistance) {
        bestDistance = dist;
        picked = monster;
      }
    }

    return picked;
  }

  addLoot(drop: LootRuntime): void {
    this.loot.push(drop);
  }

  listLoot(): LootRuntime[] {
    return this.loot;
  }

  consumeLootNear(position: { x: number; y: number }, radius = 0.7): LootRuntime[] {
    const picked: LootRuntime[] = [];
    const remaining: LootRuntime[] = [];

    for (const drop of this.loot) {
      if (distance(position, drop.position) <= radius) {
        picked.push(drop);
      } else {
        remaining.push(drop);
      }
    }

    this.loot = remaining;
    return picked;
  }

  setBoss(boss: BossRuntime | null): void {
    this.boss?.sprite.destroy();
    this.boss = boss;
  }

  getBoss(): BossRuntime | null {
    return this.boss;
  }

  setStaircase(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null): void {
    this.staircase?.destroy();
    this.staircase = sprite;
  }

  getStaircase(): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null {
    return this.staircase;
  }

  addTelegraph(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse): void {
    this.telegraphs.push(sprite);
  }

  clearTelegraphs(): void {
    for (const telegraph of this.telegraphs) {
      telegraph.destroy();
    }
    this.telegraphs = [];
  }
}
