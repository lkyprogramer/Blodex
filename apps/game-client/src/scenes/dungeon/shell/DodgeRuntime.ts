import { appendReplayInput, type DodgeDirectionSource, type RunState } from "@blodex/core";
import type Phaser from "phaser";
import { isoToGrid } from "../../../systems/iso";
import { directionBetween, resolveStepDisplacement } from "./displacement";
import type { DodgeRuntimeState } from "./dodgeTypes";

const DODGE_DISTANCE_TILES = 2;
const DODGE_IFRAME_MS = 80;
const DODGE_COOLDOWN_MS = 700;

export interface DodgeRuntimeSource {
  runEnded: boolean;
  time: { now: number };
  tileWidth: number;
  tileHeight: number;
  origin: { x: number; y: number };
  input: Phaser.Input.InputPlugin;
  player: {
    id: string;
    position: { x: number; y: number };
  };
  run: RunState;
  dungeon: {
    width: number;
    height: number;
    walkable: boolean[][];
  };
  path: Array<{ x: number; y: number }>;
  attackTargetId: string | null;
  manualMoveTarget: { x: number; y: number } | null;
  manualMoveTargetFailures: number;
  nextManualPathReplanAt: number;
  dodgeRuntimeState: DodgeRuntimeState;
  hudDirty: boolean;
  eventBus: {
    emit(event: string, payload: unknown): void;
  };
  isBlockingOverlayOpen(): boolean;
  recordPlayerInput(nowMs: number): void;
  scheduleRunSave(): void;
}

export class DodgeRuntime {
  constructor(private readonly resolveSource: () => DodgeRuntimeSource) {}

  private get source(): DodgeRuntimeSource {
    return this.resolveSource();
  }

  tryUseDodge(): boolean {
    const source = this.source;
    const nowMs = source.time.now;
    if (source.runEnded || source.isBlockingOverlayOpen()) {
      return false;
    }
    if (nowMs < source.dodgeRuntimeState.readyAtMs) {
      return false;
    }

    const resolved = this.resolveDirection();
    if (resolved === null) {
      return false;
    }

    const resolution = resolveStepDisplacement({
      from: source.player.position,
      direction: resolved.direction,
      distance: DODGE_DISTANCE_TILES,
      walkable: source.dungeon.walkable,
      width: source.dungeon.width,
      height: source.dungeon.height
    });
    if (resolution === null || resolution.traveledCells <= 0 || resolution.blockedAtFirstCell) {
      source.dodgeRuntimeState.lastResult = "blocked";
      source.run = appendReplayInput(source.run, {
        type: "dodge",
        atMs: this.getRunRelativeNowMs(),
        direction: { ...resolved.direction },
        directionSource: resolved.directionSource,
        result: "blocked"
      });
      source.eventBus.emit("player:dodge", {
        playerId: source.player.id,
        result: "blocked",
        direction: { ...resolved.direction },
        directionSource: resolved.directionSource,
        timestampMs: nowMs
      });
      source.hudDirty = true;
      source.recordPlayerInput(nowMs);
      source.scheduleRunSave();
      return false;
    }

    this.interruptCombatAndMovement();
    source.dodgeRuntimeState.autoTargetSuppressed = true;
    source.dodgeRuntimeState.lastDodgeDirection = { ...resolved.direction };
    source.dodgeRuntimeState.lastDodgeDirectionSource = resolved.directionSource;
    source.dodgeRuntimeState.lastFacingDirection = { ...resolved.direction };
    const from = { ...source.player.position };
    source.player = {
      ...source.player,
      position: { ...resolution.to }
    };
    source.dodgeRuntimeState.readyAtMs = nowMs + DODGE_COOLDOWN_MS;
    source.dodgeRuntimeState.iframeUntilMs = nowMs + DODGE_IFRAME_MS;
    source.dodgeRuntimeState.lastSuccessfulDodgeAtMs = nowMs;
    source.dodgeRuntimeState.lastResult = "success";
    source.run = appendReplayInput(source.run, {
      type: "dodge",
      atMs: this.getRunRelativeNowMs(),
      direction: { ...resolved.direction },
      directionSource: resolved.directionSource,
      result: "success"
    });
    source.eventBus.emit("player:move", {
      playerId: source.player.id,
      from,
      to: { ...resolution.to },
      timestampMs: nowMs
    });
    source.eventBus.emit("player:dodge", {
      playerId: source.player.id,
      result: "success",
      direction: { ...resolved.direction },
      directionSource: resolved.directionSource,
      from,
      to: { ...resolution.to },
      timestampMs: nowMs
    });
    source.hudDirty = true;
    source.recordPlayerInput(nowMs);
    source.scheduleRunSave();
    return true;
  }

  isIFrameActive(nowMs: number): boolean {
    return nowMs <= this.source.dodgeRuntimeState.iframeUntilMs;
  }

  private resolveDirection():
    | {
        direction: { x: number; y: number };
        directionSource: DodgeDirectionSource;
      }
    | null {
    const source = this.source;
    const moveVector = source.dodgeRuntimeState.lastMoveIntentDirection;
    if (moveVector !== null) {
      return {
        direction: { ...moveVector },
        directionSource: "move_vector"
      };
    }

    const pointer = source.input.activePointer;
    if (pointer !== undefined) {
      const pointerGrid = isoToGrid(
        pointer.worldX,
        pointer.worldY,
        source.tileWidth,
        source.tileHeight,
        source.origin.x,
        source.origin.y
      );
      const pointerDirection = directionBetween(source.player.position, pointerGrid);
      if (pointerDirection !== null) {
        return {
          direction: pointerDirection,
          directionSource: "cursor"
        };
      }
    }

    const facing = source.dodgeRuntimeState.lastFacingDirection;
    if (facing !== null) {
      return {
        direction: { ...facing },
        directionSource: "facing"
      };
    }
    return null;
  }

  private interruptCombatAndMovement(): void {
    const source = this.source;
    source.path = [];
    source.attackTargetId = null;
    source.manualMoveTarget = null;
    source.manualMoveTargetFailures = 0;
    source.nextManualPathReplanAt = 0;
  }

  private getRunRelativeNowMs(): number {
    return Math.max(0, this.source.time.now - this.source.run.startedAtMs);
  }
}
