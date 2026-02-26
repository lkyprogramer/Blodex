import { type GridNode, type PlayerState } from "@blodex/core";
export interface MovementUpdateResult {
    player: PlayerState;
    path: GridNode[];
    moved: boolean;
    from?: {
        x: number;
        y: number;
    };
    to?: {
        x: number;
        y: number;
    };
}
export declare class MovementSystem {
    clampToWalkable(walkable: boolean[][], dimensions: {
        width: number;
        height: number;
    }, playerPosition: {
        x: number;
        y: number;
    }, target: {
        x: number;
        y: number;
    }): GridNode;
    computePathTo(walkable: boolean[][], dimensions: {
        width: number;
        height: number;
    }, playerPosition: {
        x: number;
        y: number;
    }, target: {
        x: number;
        y: number;
    }): GridNode[];
    updatePlayerMovement(player: PlayerState, path: GridNode[], dt: number): MovementUpdateResult;
}
//# sourceMappingURL=MovementSystem.d.ts.map