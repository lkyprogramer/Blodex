import { type CombatEvent, type ItemDef, type ItemInstance, type LootTableDef, type RngLike, type PlayerState, type RunState } from "@blodex/core";
import type { MonsterRuntime } from "./EntityManager";
interface PlayerCombatContext {
    player: PlayerState;
    run: RunState;
    monsters: MonsterRuntime[];
    attackTargetId: string | null;
    nextPlayerAttackAt: number;
    nowMs: number;
    combatRng: RngLike;
    lootRng: RngLike;
    itemDefs: Record<string, ItemDef>;
    lootTables: Record<string, LootTableDef>;
}
export interface PlayerCombatResult {
    player: PlayerState;
    run: RunState;
    attackTargetId: string | null;
    nextPlayerAttackAt: number;
    requestPathTarget?: {
        x: number;
        y: number;
    };
    killedMonsterId?: string;
    droppedItem?: {
        item: ItemInstance;
        position: {
            x: number;
            y: number;
        };
        sourceId: string;
    };
    combatEvents: CombatEvent[];
    leveledUp: boolean;
}
export interface MonsterCombatResult {
    player: PlayerState;
    combatEvents: CombatEvent[];
}
export declare class CombatSystem {
    updatePlayerAttack(context: PlayerCombatContext): PlayerCombatResult;
    updateMonsterAttacks(monsters: MonsterRuntime[], player: PlayerState, nowMs: number, combatRng: RngLike): MonsterCombatResult;
}
export {};
//# sourceMappingURL=CombatSystem.d.ts.map