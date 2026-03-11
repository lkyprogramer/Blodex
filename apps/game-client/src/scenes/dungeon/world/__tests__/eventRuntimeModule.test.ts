import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({
  default: {
    GameObjects: {
      Image: class {},
      Rectangle: class {},
      Ellipse: class {}
    }
  }
}));
import { EventRuntimeModule } from "../EventRuntimeModule";

describe("EventRuntimeModule", () => {
  it("spawns guaranteed merchant events on floors 2 and 4 when unlocked", () => {
    const marker = {
      destroy: vi.fn(),
      setAlpha: vi.fn()
    };
    const host = {
      eventNode: null,
      merchantOffers: [],
      uiManager: {
        hideEventPanel: vi.fn()
      },
      floorConfig: { isBossFloor: false },
      run: { currentFloor: 2 },
      unlockedEventIds: ["wandering_merchant"],
      eventRng: {
        next: vi.fn(() => 0.99),
        pick: vi.fn((items: Array<{ x: number; y: number }>) => items[0])
      },
      dungeon: {
        spawnPoints: [
          { x: 8, y: 8 },
          { x: 10, y: 10 }
        ]
      },
      staircaseState: {
        position: { x: 20, y: 20 }
      },
      hazards: [],
      player: {
        position: { x: 0, y: 0 }
      },
      renderSystem: {
        spawnTelegraphCircle: vi.fn(() => marker)
      },
      origin: { x: 0, y: 0 },
      contentLocalizer: {
        eventName: vi.fn((_id: string, fallback: string) => fallback)
      },
      eventBus: {
        emit: vi.fn()
      },
      time: { now: 1234 }
    } as unknown as ConstructorParameters<typeof EventRuntimeModule>[0]["host"];

    const module = new EventRuntimeModule({
      host,
      resolutionService: {} as never,
      merchantFlowService: {} as never
    });

    module.setupFloorEvent(1234);

    expect(host.renderSystem.spawnTelegraphCircle).toHaveBeenCalledTimes(1);
    expect(host.eventBus.emit).toHaveBeenCalledWith(
      "event:spawn",
      expect.objectContaining({
        eventId: "wandering_merchant",
        floor: 2
      })
    );
    expect(host.eventNode?.eventDef.id).toBe("wandering_merchant");
  });

  it("flushes queued compare prompts after closing the event panel", () => {
    const marker = {
      destroy: vi.fn()
    };
    const host = {
      eventNode: {
        eventDef: {
          id: "wandering_merchant",
          name: "Merchant",
          floorRange: { min: 1, max: 5 },
          spawnWeight: 1,
          choices: []
        },
        position: { x: 4, y: 4 },
        marker,
        resolved: false
      },
      merchantOffers: [{ offerId: "offer-1" }],
      uiManager: {
        hideEventPanel: vi.fn()
      },
      eventPanelOpen: true,
      hudDirty: false,
      flushQueuedComparePrompts: vi.fn()
    } as unknown as ConstructorParameters<typeof EventRuntimeModule>[0]["host"];

    const module = new EventRuntimeModule({
      host,
      resolutionService: {} as never,
      merchantFlowService: {} as never
    });

    module.consumeCurrentEvent();

    expect(marker.destroy).toHaveBeenCalledTimes(1);
    expect(host.uiManager.hideEventPanel).toHaveBeenCalledTimes(1);
    expect(host.flushQueuedComparePrompts).toHaveBeenCalledTimes(1);
    expect(host.eventPanelOpen).toBe(false);
    expect(host.eventNode).toBeNull();
    expect(host.hudDirty).toBe(true);
  });

  it("biases guaranteed prep-window nodes toward the player side of the floor", () => {
    const marker = {
      destroy: vi.fn(),
      setAlpha: vi.fn()
    };
    const host = {
      eventNode: null,
      merchantOffers: [],
      uiManager: {
        hideEventPanel: vi.fn()
      },
      floorConfig: { isBossFloor: false, eventNodeBias: "near_player", pacingKind: "recovery" },
      run: { currentFloor: 5 },
      unlockedEventIds: [],
      eventRng: {
        next: vi.fn(() => 0.99),
        pick: vi.fn((items: Array<{ x: number; y: number }>) => items[items.length - 1])
      },
      dungeon: {
        spawnPoints: [
          { x: 6, y: 6 },
          { x: 18, y: 18 }
        ]
      },
      staircaseState: {
        position: { x: 24, y: 24 }
      },
      hazards: [],
      player: {
        position: { x: 0, y: 0 }
      },
      path: [],
      attackTargetId: null,
      manualMoveTarget: null,
      manualMoveTargetFailures: 0,
      renderSystem: {
        spawnTelegraphCircle: vi.fn(() => marker)
      },
      origin: { x: 0, y: 0 },
      contentLocalizer: {
        eventName: vi.fn((_id: string, fallback: string) => fallback)
      },
      eventBus: {
        emit: vi.fn()
      },
      time: { now: 4567 }
    } as unknown as ConstructorParameters<typeof EventRuntimeModule>[0]["host"];

    const module = new EventRuntimeModule({
      host,
      resolutionService: {} as never,
      merchantFlowService: {} as never
    });

    module.setupFloorEvent(4567);

    expect(host.eventNode?.position).toEqual({ x: 6, y: 6 });
    expect(host.eventNode?.eventDef.id).toBe("gambler_cache");
  });

  it("clears combat intent before opening the merchant panel", () => {
    const showMerchantDialog = vi.fn();
    const host = {
      eventNode: {
        eventDef: {
          id: "wandering_merchant",
          name: "Merchant",
          floorRange: { min: 1, max: 8 },
          spawnWeight: 1,
          choices: []
        },
        position: { x: 4, y: 4 },
        marker: { destroy: vi.fn() },
        resolved: false
      },
      merchantOffers: [{ offerId: "offer-1" }],
      uiManager: {
        showMerchantDialog,
        hideEventPanel: vi.fn()
      },
      floorConfig: { isBossFloor: false },
      eventPanelOpen: false,
      player: {
        position: { x: 1, y: 1 }
      },
      path: [{ x: 3, y: 3 }],
      attackTargetId: "monster-1",
      manualMoveTarget: { x: 8, y: 8 },
      manualMoveTargetFailures: 2,
      nextManualPathReplanAt: 500,
      time: { now: 1234 }
    } as unknown as ConstructorParameters<typeof EventRuntimeModule>[0]["host"];

    const module = new EventRuntimeModule({
      host,
      resolutionService: {} as never,
      merchantFlowService: {
        ensureOffers: vi.fn(() => true),
        buildView: vi.fn(() => ({ offers: [] }))
      } as never
    });

    module.openMerchantPanel(1234);

    expect(host.path).toEqual([]);
    expect(host.attackTargetId).toBeNull();
    expect(host.manualMoveTarget).toBeNull();
    expect(host.manualMoveTargetFailures).toBe(0);
    expect(host.nextManualPathReplanAt).toBe(0);
    expect(showMerchantDialog).toHaveBeenCalledTimes(1);
  });
});
