function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
export class EntityManager {
    monsters = [];
    loot = [];
    clear() {
        this.monsters = [];
        this.loot = [];
    }
    setMonsters(monsters) {
        this.monsters = monsters;
    }
    listMonsters() {
        return this.monsters;
    }
    listLivingMonsters() {
        return this.monsters.filter((monster) => monster.state.health > 0);
    }
    findMonsterById(monsterId) {
        return this.monsters.find((monster) => monster.state.id === monsterId);
    }
    removeMonsterById(monsterId) {
        const index = this.monsters.findIndex((monster) => monster.state.id === monsterId);
        if (index < 0) {
            return null;
        }
        const [removed] = this.monsters.splice(index, 1);
        return removed ?? null;
    }
    pickMonsterAt(position, pickRadius = 1.1) {
        let picked = null;
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
    addLoot(drop) {
        this.loot.push(drop);
    }
    listLoot() {
        return this.loot;
    }
    consumeLootNear(position, radius = 0.7) {
        const picked = [];
        const remaining = [];
        for (const drop of this.loot) {
            if (distance(position, drop.position) <= radius) {
                picked.push(drop);
            }
            else {
                remaining.push(drop);
            }
        }
        this.loot = remaining;
        return picked;
    }
}
//# sourceMappingURL=EntityManager.js.map