import type { PlayerState } from "@blodex/core";
import type { MonsterRuntime } from "./EntityManager";
export interface MonsterStateTransition {
    monsterId: string;
    from: MonsterRuntime["state"]["aiState"];
    to: MonsterRuntime["state"]["aiState"];
    timestampMs: number;
}
export declare class AISystem {
    updateMonsters(monsters: MonsterRuntime[], player: PlayerState, dt: number, nowMs: number): MonsterStateTransition[];
}
//# sourceMappingURL=AISystem.d.ts.map