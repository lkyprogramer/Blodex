import type { DungeonLayout, MonsterState } from "@blodex/core";
import type { MonsterArchetypeDef } from "@blodex/content";
import type { RngLike } from "@blodex/core";
export interface MonsterSpawnCandidate {
    state: MonsterState;
    archetype: MonsterArchetypeDef;
}
export interface MonsterSpawnOptions {
    dungeon: DungeonLayout;
    playerPosition: {
        x: number;
        y: number;
    };
    floor: number;
    count: number;
    enemyBaseHealth: number;
    enemyBaseDamage: number;
    archetypes: MonsterArchetypeDef[];
    rng: RngLike;
}
export declare class MonsterSpawnSystem {
    private generateSpawnPoints;
    createMonsters(options: MonsterSpawnOptions): MonsterSpawnCandidate[];
}
//# sourceMappingURL=MonsterSpawnSystem.d.ts.map