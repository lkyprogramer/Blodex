import { describe, expect, it, vi } from "vitest";
import { RunPersistenceModule } from "../RunPersistenceModule";
import type { SaveCoordinator } from "../SaveCoordinator";
import type { RunSaveSnapshotBuilder } from "../RunSaveSnapshotBuilder";
import type { RunStateRestorer } from "../RunStateRestorer";

describe("RunPersistenceModule", () => {
  it("delegates flush and updates flush timestamp", () => {
    const saveCoordinator = {
      flush: vi.fn(),
      schedule: vi.fn()
    };
    const onFlush = vi.fn();
    const module = new RunPersistenceModule({
      saveCoordinator: saveCoordinator as unknown as SaveCoordinator,
      snapshotBuilder: { build: vi.fn() } as unknown as RunSaveSnapshotBuilder,
      stateRestorer: { restore: vi.fn() } as unknown as RunStateRestorer,
      nowMs: () => 123,
      onFlush
    });

    module.flush();

    expect(saveCoordinator.flush).toHaveBeenCalledOnce();
    expect(onFlush).toHaveBeenCalledWith(123);
  });

  it("delegates schedule/build/restore", () => {
    const saveCoordinator = {
      flush: vi.fn(),
      schedule: vi.fn()
    };
    const snapshot = { schemaVersion: 2 };
    const snapshotBuilder = {
      build: vi.fn(() => snapshot)
    };
    const stateRestorer = {
      restore: vi.fn(() => true)
    };
    const module = new RunPersistenceModule({
      saveCoordinator: saveCoordinator as unknown as SaveCoordinator,
      snapshotBuilder: snapshotBuilder as unknown as RunSaveSnapshotBuilder,
      stateRestorer: stateRestorer as unknown as RunStateRestorer,
      nowMs: () => 0,
      onFlush: vi.fn()
    });

    module.schedule();
    const built = module.buildSnapshot(321);
    const restored = module.restore({ schemaVersion: 2 } as never);

    expect(saveCoordinator.schedule).toHaveBeenCalledOnce();
    expect(snapshotBuilder.build).toHaveBeenCalledWith(321);
    expect(built).toBe(snapshot);
    expect(stateRestorer.restore).toHaveBeenCalledOnce();
    expect(restored).toBe(true);
  });
});
