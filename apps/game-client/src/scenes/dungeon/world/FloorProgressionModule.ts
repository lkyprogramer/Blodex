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
import { GAME_CONFIG } from "@blodex/content";

type FloorProgressionHost = Record<string, any>;

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
      host.staircaseState = {
        ...host.staircaseState,
        visible: true
      };
      host.renderStaircases();
      host.eventBus.emit("floor:clear", {
        floor: host.run.currentFloor,
        kills: host.run.kills,
        staircase: host.staircaseState,
        timestampMs: nowMs
      });
      host.tryDiscoverBlueprints("floor_clear", nowMs);
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
      host.staircaseState = {
        ...host.staircaseState,
        selected: side
      };
      host.run = {
        ...host.run,
        branchChoice: resolveBranchChoiceFromSide(side)
      };
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
      host.run = addRunObols(host.run, endlessFloorClearBonus(host.run.currentFloor));
    } else {
      host.run = addRunObols(host.run, 5);
    }
    host.setupFloor(host.run.currentFloor, false);
  }
}
