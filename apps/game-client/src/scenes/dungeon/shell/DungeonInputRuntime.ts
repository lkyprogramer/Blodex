import Phaser from "phaser";
import { appendReplayInput, type GridNode, type PlayerState, type RunState } from "@blodex/core";
import { isoToGrid } from "../../../systems/iso";
import type { RunLogService } from "../logging/RunLogService";

const MANUAL_PATH_REPLAN_INTERVAL_MS = 90;
const KEYBOARD_MOVE_INPUT_INTERVAL_MS = 70;

interface HiddenRoomState {
  roomId: string;
  revealed: boolean;
  entrance: { x: number; y: number };
}

interface MovementResult {
  player: PlayerState;
  path: GridNode[];
  moved: boolean;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}

export interface DungeonInputSource {
  runEnded: boolean;
  debugCheatsEnabled: boolean;
  time: { now: number };
  tileWidth: number;
  tileHeight: number;
  origin: { x: number; y: number };
  dungeon: {
    hiddenRooms?: HiddenRoomState[];
  };
  player: PlayerState;
  run: RunState;
  path: GridNode[];
  attackTargetId: string | null;
  manualMoveTarget: GridNode | null;
  manualMoveTargetFailures: number;
  nextManualPathReplanAt: number;
  nextKeyboardMoveInputAt: number;
  cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | null;
  keyboardBindings: Array<{
    eventName: string;
    handler: (...args: unknown[]) => void;
  }>;
  input: {
    keyboard?: Phaser.Input.Keyboard.KeyboardPlugin | null;
  };
  debugRuntimeModule: {
    handleHotkey(event: KeyboardEvent): void;
  };
  progressionRuntimeModule: {
    revealHiddenRoom(roomId: string, nowMs: number, source: string): void;
  };
  entityManager: {
    pickMonsterAt(targetTile: { x: number; y: number }): { state: { id: string } } | null;
  };
  movementSystem: {
    updatePlayerMovement(player: PlayerState, path: GridNode[], dt: number): MovementResult;
  };
  eventBus: {
    emit(event: string, payload: unknown): void;
  };
  runLog: Pick<RunLogService, "appendKey">;
  isBlockingOverlayOpen(): boolean;
  getRunRelativeNowMs(): number;
  recordPlayerInput(nowMs: number): void;
  computePathTo(target: { x: number; y: number }): GridNode[];
  tryUseSkill(slotIndex: number): void;
  tryUseConsumable(consumableId: "health_potion" | "mana_potion" | "scroll_of_mapping"): void;
}

export class DungeonInputRuntime {
  constructor(private readonly resolveSource: () => DungeonInputSource) {}

  private get source(): DungeonInputSource {
    return this.resolveSource();
  }

  handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const source = this.source;
    if (source.runEnded || source.isBlockingOverlayOpen()) {
      return;
    }
    const nowMs = source.time.now;
    const clickedGrid = isoToGrid(
      pointer.worldX,
      pointer.worldY,
      source.tileWidth,
      source.tileHeight,
      source.origin.x,
      source.origin.y
    );
    const targetTile = {
      x: Math.round(clickedGrid.x),
      y: Math.round(clickedGrid.y)
    };

    const hiddenRoom = (source.dungeon.hiddenRooms ?? []).find((entry) => {
      return !entry.revealed && entry.entrance.x === targetTile.x && entry.entrance.y === targetTile.y;
    });
    if (hiddenRoom !== undefined) {
      source.progressionRuntimeModule.revealHiddenRoom(hiddenRoom.roomId, nowMs, "click");
      source.recordPlayerInput(nowMs);
      return;
    }

    const clickedMonster = source.entityManager.pickMonsterAt(targetTile);
    if (clickedMonster !== null) {
      source.attackTargetId = clickedMonster.state.id;
      source.manualMoveTarget = null;
      source.manualMoveTargetFailures = 0;
      source.run = appendReplayInput(source.run, {
        type: "attack_target",
        atMs: source.getRunRelativeNowMs(),
        targetId: clickedMonster.state.id
      });
      source.recordPlayerInput(nowMs);
      return;
    }

    source.attackTargetId = null;
    source.manualMoveTarget = targetTile;
    source.manualMoveTargetFailures = 0;
    source.nextManualPathReplanAt = 0;
    source.path = source.computePathTo(targetTile);
    source.run = appendReplayInput(source.run, {
      type: "move_target",
      atMs: source.getRunRelativeNowMs(),
      target: targetTile
    });
    source.recordPlayerInput(nowMs);
  }

  updateKeyboardMoveIntent(nowMs: number): void {
    const source = this.source;
    if (source.runEnded || source.isBlockingOverlayOpen() || source.cursorKeys === null) {
      return;
    }
    if (source.path.length > 0 || nowMs < source.nextKeyboardMoveInputAt) {
      return;
    }

    const leftDown = source.cursorKeys.left?.isDown === true;
    const rightDown = source.cursorKeys.right?.isDown === true;
    const upDown = source.cursorKeys.up?.isDown === true;
    const downDown = source.cursorKeys.down?.isDown === true;
    const moveX = (rightDown ? 1 : 0) - (leftDown ? 1 : 0);
    const moveY = (downDown ? 1 : 0) - (upDown ? 1 : 0);
    if (moveX === 0 && moveY === 0) {
      return;
    }

    source.nextKeyboardMoveInputAt = nowMs + KEYBOARD_MOVE_INPUT_INTERVAL_MS;
    const targetTile = {
      x: Math.round(source.player.position.x) + moveX,
      y: Math.round(source.player.position.y) + moveY
    };
    const nextPath = source.computePathTo(targetTile);
    if (nextPath.length === 0) {
      return;
    }

    source.attackTargetId = null;
    source.manualMoveTarget = targetTile;
    source.manualMoveTargetFailures = 0;
    source.nextManualPathReplanAt = 0;
    source.path = nextPath;
    source.run = appendReplayInput(source.run, {
      type: "move_target",
      atMs: source.getRunRelativeNowMs(),
      target: targetTile
    });
    source.recordPlayerInput(nowMs);
  }

  updatePlayerMovement(dt: number, nowMs: number): void {
    const source = this.source;
    const result = source.movementSystem.updatePlayerMovement(source.player, source.path, dt);
    source.player = result.player;
    source.path = result.path;
    if (result.moved && result.from !== undefined && result.to !== undefined) {
      source.eventBus.emit("player:move", {
        playerId: source.player.id,
        from: result.from,
        to: result.to,
        timestampMs: nowMs
      });
    }
    this.updateManualMoveTarget(nowMs);
  }

  bindSkillKeys(): void {
    const bind = (code: string, slotIndex: number) => {
      this.bindKeyboard(`keydown-${code}`, () => {
        this.source.tryUseSkill(slotIndex);
      });
    };

    bind("ONE", 0);
    bind("TWO", 1);
    bind("THREE", 2);
    bind("FOUR", 3);
    bind("Q", 0);
    this.bindKeyboard("keydown-R", () => this.source.tryUseConsumable("health_potion"));
    this.bindKeyboard("keydown-F", () => this.source.tryUseConsumable("mana_potion"));
    this.bindKeyboard("keydown-G", () => this.source.tryUseConsumable("scroll_of_mapping"));

    if (this.source.debugCheatsEnabled) {
      this.bindKeyboard("keydown", (event) => {
        this.source.debugRuntimeModule.handleHotkey(event as KeyboardEvent);
      });
    }
  }

  bindMovementKeys(): void {
    const keyboard = this.source.input.keyboard;
    if (keyboard === undefined || keyboard === null) {
      this.source.cursorKeys = null;
      return;
    }
    this.source.cursorKeys = keyboard.createCursorKeys();
  }

  clearKeyboardBindings(): void {
    const keyboard = this.source.input.keyboard;
    if (keyboard !== undefined && keyboard !== null) {
      for (const binding of this.source.keyboardBindings) {
        keyboard.off(binding.eventName, binding.handler);
      }
    }
    this.source.keyboardBindings.length = 0;
  }

  private updateManualMoveTarget(nowMs: number): void {
    const source = this.source;
    if (source.manualMoveTarget === null || source.runEnded || source.isBlockingOverlayOpen()) {
      return;
    }
    if (source.attackTargetId !== null) {
      source.manualMoveTarget = null;
      source.manualMoveTargetFailures = 0;
      return;
    }

    const distance = Math.hypot(
      source.manualMoveTarget.x - source.player.position.x,
      source.manualMoveTarget.y - source.player.position.y
    );
    if (distance <= 0.2) {
      source.manualMoveTarget = null;
      source.manualMoveTargetFailures = 0;
      source.nextManualPathReplanAt = 0;
      return;
    }
    if (source.path.length > 0 || nowMs < source.nextManualPathReplanAt) {
      return;
    }

    source.nextManualPathReplanAt = nowMs + MANUAL_PATH_REPLAN_INTERVAL_MS;
    const nextPath = source.computePathTo(source.manualMoveTarget);
    if (nextPath.length > 0) {
      source.path = nextPath;
      source.manualMoveTargetFailures = 0;
      return;
    }

    source.manualMoveTargetFailures += 1;
    if (source.manualMoveTargetFailures >= 8) {
      source.manualMoveTarget = null;
      source.manualMoveTargetFailures = 0;
      source.runLog.appendKey("log.pathfinding.aborted_unreachable", undefined, "warn", nowMs);
    }
  }

  private bindKeyboard(eventName: string, handler: (...args: unknown[]) => void): void {
    const keyboard = this.source.input.keyboard;
    if (keyboard === undefined || keyboard === null) {
      return;
    }
    keyboard.on(eventName, handler);
    this.source.keyboardBindings.push({ eventName, handler });
  }
}
