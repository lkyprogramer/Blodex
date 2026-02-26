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
  position: { x: number; y: number };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class EntityManager {
  private monsters: MonsterRuntime[] = [];
  private loot: LootRuntime[] = [];

  clear(): void {
    this.monsters = [];
    this.loot = [];
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
}
