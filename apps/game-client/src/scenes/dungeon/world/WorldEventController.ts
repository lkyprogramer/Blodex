export interface WorldEventControllerDeps {
  updateHazards: (nowMs: number) => void;
  collectNearbyLoot: (nowMs: number) => void;
  updateEventInteraction: (nowMs: number) => void;
  updateFloorProgress: (nowMs: number) => void;
  updateMinimap: (nowMs: number) => void;
}

export class WorldEventController {
  constructor(private readonly deps: WorldEventControllerDeps) {}

  updatePreResolution(nowMs: number): void {
    this.deps.updateHazards(nowMs);
    this.deps.collectNearbyLoot(nowMs);
    this.deps.updateEventInteraction(nowMs);
  }

  updatePostResolution(nowMs: number): void {
    this.deps.updateFloorProgress(nowMs);
    this.deps.updateMinimap(nowMs);
  }
}
