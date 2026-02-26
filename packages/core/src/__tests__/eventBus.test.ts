import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "../eventBus";

interface TestEventMap {
  "alpha:event": { value: number };
  "beta:event": { label: string };
}

describe("eventBus", () => {
  it("dispatches handlers synchronously in registration order", () => {
    const bus = createEventBus<TestEventMap>();
    const calls: number[] = [];

    bus.on("alpha:event", ({ value }) => calls.push(value));
    bus.on("alpha:event", ({ value }) => calls.push(value * 10));

    bus.emit("alpha:event", { value: 2 });
    expect(calls).toEqual([2, 20]);
  });

  it("supports unsubscribe via off and on return cleanup", () => {
    const bus = createEventBus<TestEventMap>();
    const handler = vi.fn();

    const stop = bus.on("beta:event", handler);
    bus.emit("beta:event", { label: "first" });
    expect(handler).toHaveBeenCalledTimes(1);

    stop();
    bus.emit("beta:event", { label: "second" });
    expect(handler).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    bus.on("beta:event", second);
    bus.off("beta:event", second);
    bus.emit("beta:event", { label: "third" });
    expect(second).not.toHaveBeenCalled();
  });

  it("clears subscriptions by event or globally", () => {
    const bus = createEventBus<TestEventMap>();
    const alpha = vi.fn();
    const beta = vi.fn();

    bus.on("alpha:event", alpha);
    bus.on("beta:event", beta);
    bus.removeAll("alpha:event");
    bus.emit("alpha:event", { value: 1 });
    bus.emit("beta:event", { label: "ok" });
    expect(alpha).not.toHaveBeenCalled();
    expect(beta).toHaveBeenCalledTimes(1);

    bus.removeAll();
    bus.emit("beta:event", { label: "no-op" });
    expect(beta).toHaveBeenCalledTimes(1);
  });
});
