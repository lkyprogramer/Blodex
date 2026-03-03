import { describe, expect, it, vi } from "vitest";
import { RunFlowOrchestrator } from "../RunFlowOrchestrator";

describe("RunFlowOrchestrator", () => {
  it("skips all updates when run already ended", () => {
    const orchestrator = new RunFlowOrchestrator();
    const onEventPanelFrame = vi.fn();
    const onActiveFrame = vi.fn();

    orchestrator.update({
      runEnded: true,
      eventPanelOpen: false,
      nowMs: 100,
      deltaMs: 16,
      onEventPanelFrame,
      onActiveFrame
    });

    expect(onEventPanelFrame).not.toHaveBeenCalled();
    expect(onActiveFrame).not.toHaveBeenCalled();
  });

  it("routes to event-panel frame when panel is open", () => {
    const orchestrator = new RunFlowOrchestrator();
    const onEventPanelFrame = vi.fn();
    const onActiveFrame = vi.fn();

    orchestrator.update({
      runEnded: false,
      eventPanelOpen: true,
      nowMs: 250,
      deltaMs: 16,
      onEventPanelFrame,
      onActiveFrame
    });

    expect(onEventPanelFrame).toHaveBeenCalledOnce();
    expect(onEventPanelFrame).toHaveBeenCalledWith(250);
    expect(onActiveFrame).not.toHaveBeenCalled();
  });

  it("routes to active frame during normal gameplay", () => {
    const orchestrator = new RunFlowOrchestrator();
    const onEventPanelFrame = vi.fn();
    const onActiveFrame = vi.fn();

    orchestrator.update({
      runEnded: false,
      eventPanelOpen: false,
      nowMs: 300,
      deltaMs: 33,
      onEventPanelFrame,
      onActiveFrame
    });

    expect(onEventPanelFrame).not.toHaveBeenCalled();
    expect(onActiveFrame).toHaveBeenCalledOnce();
    expect(onActiveFrame).toHaveBeenCalledWith(300, 33);
  });
});
