import type { RunSaveDataV2 } from "@blodex/core";
import { SaveManager } from "../../../systems/SaveManager";

export interface SaveCoordinatorOptions {
  saveManager: SaveManager;
  isRunEnded: () => boolean;
  buildSnapshot: () => RunSaveDataV2 | null;
}

export class SaveCoordinator {
  constructor(private readonly options: SaveCoordinatorOptions) {}

  bindPageLifecycle(): void {
    this.options.saveManager.bindPageLifecycle(() => {
      this.flush();
    });
  }

  startHeartbeat(): void {
    this.options.saveManager.startLeaseHeartbeat(() => this.options.buildSnapshot());
  }

  stopHeartbeat(): void {
    this.options.saveManager.stopLeaseHeartbeat();
  }

  flush(): void {
    if (this.options.isRunEnded()) {
      return;
    }
    this.options.saveManager.flushSave(() => this.options.buildSnapshot());
  }

  schedule(): void {
    if (this.options.isRunEnded()) {
      return;
    }
    this.options.saveManager.scheduleSave(() => this.options.buildSnapshot());
  }

  dispose(): void {
    this.options.saveManager.dispose();
  }
}
