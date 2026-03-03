import type { MetaProgression, PlayerState, RunState } from "@blodex/core";
import type { FloorConfig } from "@blodex/content";

export interface DungeonRuntimeFlags {
  runEnded: boolean;
  eventPanelOpen: boolean;
  debugCheatsEnabled: boolean;
}

export interface DungeonRuntimeContext {
  run: RunState;
  player: PlayerState;
  meta: MetaProgression;
  floorConfig: FloorConfig;
  nowMs: number;
  deltaMs: number;
  flags: DungeonRuntimeFlags;
}
