import type { ItemInstance, MetaProgression, PlayerState, ReplayInputEvent, RunReplay, RunSummary } from "./contracts/types";
export declare const REPLAY_VERSION = "phase0-v1";
export interface RunState {
    startedAtMs: number;
    floor: number;
    kills: number;
    lootCollected: number;
    runSeed?: string;
    replay?: RunReplay;
}
export declare function createRunSeed(): string;
export declare function deriveFloorSeed(runSeed: string, floor: number, stream?: string): string;
export declare function createReplay(runSeed: string, floor: number, version?: string): RunReplay;
export declare function appendReplayInput(run: RunState, input: ReplayInputEvent): RunState;
export declare function computeReplayChecksum(summary: RunSummary, replay: RunReplay): string;
export declare function createInitialMeta(): MetaProgression;
export declare function collectLoot(player: PlayerState, item: ItemInstance): PlayerState;
export declare function endRun(run: RunState, player: PlayerState, nowMs: number, meta: MetaProgression): {
    summary: RunSummary;
    meta: MetaProgression;
    replay?: RunReplay;
};
//# sourceMappingURL=run.d.ts.map