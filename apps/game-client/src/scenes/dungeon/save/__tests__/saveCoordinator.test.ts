import type { RunSaveDataV2 } from "@blodex/core";
import { describe, expect, it, vi } from "vitest";
import type { SaveManager } from "../../../../systems/SaveManager";
import { SaveCoordinator } from "../SaveCoordinator";

interface MockSaveManager {
  bindPageLifecycle: ReturnType<typeof vi.fn>;
  startLeaseHeartbeat: ReturnType<typeof vi.fn>;
  stopLeaseHeartbeat: ReturnType<typeof vi.fn>;
  flushSave: ReturnType<typeof vi.fn>;
  scheduleSave: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function createMockSaveManager(): MockSaveManager {
  return {
    bindPageLifecycle: vi.fn(),
    startLeaseHeartbeat: vi.fn(),
    stopLeaseHeartbeat: vi.fn(),
    flushSave: vi.fn(),
    scheduleSave: vi.fn(),
    dispose: vi.fn()
  };
}

describe("SaveCoordinator", () => {
  it("wires page lifecycle callback to flush", () => {
    const manager = createMockSaveManager();

    const snapshot = {} as RunSaveDataV2;
    const buildSnapshot = vi.fn(() => snapshot);
    const coordinator = new SaveCoordinator({
      saveManager: manager as unknown as SaveManager,
      isRunEnded: () => false,
      buildSnapshot
    });

    coordinator.bindPageLifecycle();
    const pageLifecycleCallback = manager.bindPageLifecycle.mock.calls[0]?.[0] as (() => void) | undefined;
    pageLifecycleCallback?.();

    expect(manager.bindPageLifecycle).toHaveBeenCalledOnce();
    expect(manager.flushSave).toHaveBeenCalledOnce();
    const flushBuilder = manager.flushSave.mock.calls[0]?.[0] as (() => RunSaveDataV2 | null) | undefined;
    expect(flushBuilder?.()).toBe(snapshot);
    expect(buildSnapshot).toHaveBeenCalledOnce();
  });

  it("guards flush/schedule when run ended", () => {
    const manager = createMockSaveManager();
    const coordinator = new SaveCoordinator({
      saveManager: manager as unknown as SaveManager,
      isRunEnded: () => true,
      buildSnapshot: () => null
    });

    coordinator.flush();
    coordinator.schedule();

    expect(manager.flushSave).not.toHaveBeenCalled();
    expect(manager.scheduleSave).not.toHaveBeenCalled();
  });

  it("delegates heartbeat lifecycle and dispose", () => {
    const manager = createMockSaveManager();
    const snapshot = { schemaVersion: 2 } as RunSaveDataV2;
    const buildSnapshot = vi.fn(() => snapshot);
    const coordinator = new SaveCoordinator({
      saveManager: manager as unknown as SaveManager,
      isRunEnded: () => false,
      buildSnapshot
    });

    coordinator.startHeartbeat();
    coordinator.stopHeartbeat();
    coordinator.dispose();

    expect(manager.startLeaseHeartbeat).toHaveBeenCalledOnce();
    const heartbeatBuilder = manager.startLeaseHeartbeat.mock.calls[0]?.[0] as (() => RunSaveDataV2 | null) | undefined;
    expect(heartbeatBuilder?.()).toBe(snapshot);
    expect(buildSnapshot).toHaveBeenCalledOnce();
    expect(manager.stopLeaseHeartbeat).toHaveBeenCalledOnce();
    expect(manager.dispose).toHaveBeenCalledOnce();
  });
});
