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
});
