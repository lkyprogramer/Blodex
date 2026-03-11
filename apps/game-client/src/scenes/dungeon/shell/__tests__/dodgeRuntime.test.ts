import { createRunState } from "@blodex/core";
import { describe, expect, it, vi } from "vitest";
import { DodgeRuntime, type DodgeRuntimeSource } from "../DodgeRuntime";
import { createInitialDodgeRuntimeState } from "../dodgeTypes";

function createSource(): DodgeRuntimeSource {
  return {
    runEnded: false,
    time: { now: 100 },
    tileWidth: 64,
    tileHeight: 32,
    origin: { x: 0, y: 0 },
    input: {
      activePointer: {
        worldX: 0,
        worldY: 0
      }
    } as unknown as DodgeRuntimeSource["input"],
    player: {
      id: "player",
      position: { x: 1, y: 1 }
    },
    run: createRunState("dodge-test", 0, "normal"),
    dungeon: {
      width: 5,
      height: 5,
      walkable: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => true))
    },
    path: [{ x: 4, y: 1 }],
    attackTargetId: "monster-1",
    manualMoveTarget: { x: 4, y: 1 },
    manualMoveTargetFailures: 2,
    nextManualPathReplanAt: 120,
    dodgeRuntimeState: {
      ...createInitialDodgeRuntimeState(),
      lastMoveIntentDirection: { x: 1, y: 0 }
    },
    hudDirty: false,
    eventBus: {
      emit: vi.fn()
    },
    isBlockingOverlayOpen: vi.fn(() => false),
    recordPlayerInput: vi.fn(),
    scheduleRunSave: vi.fn()
  };
}

describe("DodgeRuntime", () => {
  it("applies dodge displacement, clears combat state, and records replay input", () => {
    const source = createSource();
    const runtime = new DodgeRuntime(() => source);

    const used = runtime.tryUseDodge();

    expect(used).toBe(true);
    expect(source.player.position).toEqual({ x: 3, y: 1 });
    expect(source.path).toEqual([]);
    expect(source.attackTargetId).toBeNull();
    expect(source.manualMoveTarget).toBeNull();
    expect(source.dodgeRuntimeState.autoTargetSuppressed).toBe(true);
    expect(source.dodgeRuntimeState.readyAtMs).toBe(800);
    expect(source.dodgeRuntimeState.iframeUntilMs).toBe(180);
    expect(source.dodgeRuntimeState.lastSuccessfulDodgeAtMs).toBe(100);
    expect(source.run.replay?.inputs[0]).toEqual(
      expect.objectContaining({
        type: "dodge",
        result: "success",
        directionSource: "move_vector"
      })
    );
    expect(source.recordPlayerInput).toHaveBeenCalledWith(100);
    expect(source.scheduleRunSave).toHaveBeenCalledOnce();
    expect(vi.mocked(source.eventBus.emit)).not.toHaveBeenCalledWith(
      "combat:dodge",
      expect.anything()
    );
    expect(vi.mocked(source.eventBus.emit)).toHaveBeenCalledWith(
      "player:dodge",
      expect.objectContaining({
        result: "success"
      })
    );
  });

  it("marks blocked dodge without consuming cooldown when first cell is not walkable", () => {
    const source = createSource();
    source.dungeon.walkable[1]![2] = false;
    const runtime = new DodgeRuntime(() => source);

    const used = runtime.tryUseDodge();

    expect(used).toBe(false);
    expect(source.player.position).toEqual({ x: 1, y: 1 });
    expect(source.attackTargetId).toBe("monster-1");
    expect(source.manualMoveTarget).toEqual({ x: 4, y: 1 });
    expect(source.path).toEqual([{ x: 4, y: 1 }]);
    expect(source.dodgeRuntimeState.readyAtMs).toBe(0);
    expect(source.dodgeRuntimeState.iframeUntilMs).toBe(0);
    expect(source.dodgeRuntimeState.autoTargetSuppressed).toBe(false);
    expect(source.dodgeRuntimeState.lastResult).toBe("blocked");
    expect(source.run.replay?.inputs[0]).toEqual(
      expect.objectContaining({
        type: "dodge",
        result: "blocked"
      })
    );
    expect(vi.mocked(source.eventBus.emit)).toHaveBeenCalledWith(
      "player:dodge",
      expect.objectContaining({
        result: "blocked"
      })
    );
  });
});
