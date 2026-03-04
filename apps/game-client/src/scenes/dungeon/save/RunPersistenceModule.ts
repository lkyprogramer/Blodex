import type { RunSaveDataV2 } from "@blodex/core";
import { SaveCoordinator } from "./SaveCoordinator";
import { RunSaveSnapshotBuilder } from "./RunSaveSnapshotBuilder";
import { RunStateRestorer } from "./RunStateRestorer";

export interface RunPersistenceModuleOptions {
  saveCoordinator: SaveCoordinator;
  snapshotBuilder: RunSaveSnapshotBuilder;
  stateRestorer: RunStateRestorer;
  nowMs: () => number;
  onFlush: (nowMs: number) => void;
}

export class RunPersistenceModule {
  constructor(private readonly options: RunPersistenceModuleOptions) {}

  flush(): void {
    this.options.saveCoordinator.flush();
    this.options.onFlush(this.options.nowMs());
  }

  schedule(): void {
    this.options.saveCoordinator.schedule();
  }

  buildSnapshot(nowMs: number): RunSaveDataV2 | null {
    return this.options.snapshotBuilder.build(nowMs);
  }

  restore(save: RunSaveDataV2): boolean {
    return this.options.stateRestorer.restore(save);
  }
}
