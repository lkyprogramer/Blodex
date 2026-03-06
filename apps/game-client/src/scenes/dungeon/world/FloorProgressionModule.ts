import {
  addRunObols,
  advanceEndlessFloor,
  appendReplayInput,
  endlessFloorClearBonus,
  enterNextFloor,
  isPlayerOnStaircase,
  resolveBranchChoiceFromSide,
  resolveBranchSideAtPosition
} from "@blodex/core";
import type {
  GameEventMap,
  PlayerState,
  RunState,
  StaircaseState,
  TypedEventBus
} from "@blodex/core";
import { GAME_CONFIG } from "@blodex/content";

export interface FloorProgressionHost {
  floorConfig: {
    isBossFloor: boolean;
    monsterCount: number;
    clearThreshold: number;
  };
  staircaseState: StaircaseState;
  run: RunState;
  player: Pick<PlayerState, "position">;
  ensureFloorChoiceBudget(nowMs: number): void;
  progressionRuntimeModule: {
    renderStaircases(): void;
    setupFloor(floor: number, isFreshFloor: boolean): void;
  };
  grantFloorPairFallbackReward(nowMs: number): void;
  eventBus: TypedEventBus<GameEventMap>;
  tryDiscoverBlueprints(
    sourceType: "floor_clear",
    nowMs: number,
    sourceId?: string
  ): void;
  eventPanelOpen: boolean;
  getRunRelativeNowMs(): number;
  syncEndlessMutators(nowMs: number): void;
  deferredOutcomeRuntime: {
    settle(trigger: string, nowMs: number): void;
  };
  markHighValueChoice(source: string, nowMs: number): void;
}

export interface FloorProgressionModuleOptions {
  host: FloorProgressionHost;
}

export class FloorProgressionModule {
  constructor(private readonly options: FloorProgressionModuleOptions) {}

  update(nowMs: number): void {
    const host = this.options.host;
    if (host.floorConfig.isBossFloor) {
      return;
    }

    const revealThreshold = Math.ceil(host.floorConfig.monsterCount * host.floorConfig.clearThreshold);
    if (!host.staircaseState.visible && host.run.kills >= revealThreshold) {
      host.ensureFloorChoiceBudget(nowMs);
      host.staircaseState = {
        ...host.staircaseState,
        visible: true
      };
      host.progressionRuntimeModule.renderStaircases();
      host.grantFloorPairFallbackReward(nowMs);
      host.eventBus.emit("floor:clear", {
        floor: host.run.currentFloor,
        kills: host.run.kills,
        staircase: host.staircaseState,
        timestampMs: nowMs
      });
      host.tryDiscoverBlueprints("floor_clear", nowMs);
      if (host.eventPanelOpen) {
        return;
      }
    }

    if (!host.staircaseState.visible) {
      return;
    }
    if (!isPlayerOnStaircase(host.player.position, host.staircaseState, 0.85)) {
      return;
    }

    if (host.staircaseState.kind === "branch") {
      const side = resolveBranchSideAtPosition(host.staircaseState, host.player.position, 0.85);
      if (side === undefined) {
        return;
      }
      const branchChoice = resolveBranchChoiceFromSide(side);
      host.staircaseState = {
        ...host.staircaseState,
        selected: side
      };
      host.run = {
        ...host.run,
        branchChoice
      };
      host.markHighValueChoice(branchChoice, nowMs);
    }

    const storyMaxFloor = GAME_CONFIG.maxFloors ?? 5;
    if (!host.run.inEndless && host.run.currentFloor >= storyMaxFloor) {
      return;
    }

    const fromFloor = host.run.currentFloor;
    host.run = appendReplayInput(host.run, {
      type: "floor_transition",
      atMs: host.getRunRelativeNowMs(),
      fromFloor,
      toFloor: fromFloor + 1
    });
    host.run = enterNextFloor(host.run);
    if (host.run.inEndless) {
      host.run = advanceEndlessFloor(host.run);
      host.syncEndlessMutators(nowMs);
      host.run = addRunObols(
        host.run,
        endlessFloorClearBonus(host.run.currentFloor, host.run.mutatorActiveIds ?? [])
      );
    } else {
      host.run = addRunObols(host.run, 5);
    }
    host.progressionRuntimeModule.setupFloor(host.run.currentFloor, false);
    host.deferredOutcomeRuntime.settle("floor_reached", nowMs);
  }
}
