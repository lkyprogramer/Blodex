import type { BossAttack, BossRuntimeState } from "@blodex/core";
import Phaser from "phaser";
import { gridToIso } from "../../../systems/iso";
import type { BossTelegraphHost } from "./ports";

export interface BossTelegraphPresenterOptions {
  host: BossTelegraphHost;
}

export class BossTelegraphPresenter {
  private marker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null = null;
  private markerAttackId: string | null = null;

  constructor(private readonly options: BossTelegraphPresenterOptions) {}

  show(state: BossRuntimeState, attack: BossAttack): void {
    const host = this.options.host;
    const target = state.telegraphTarget ?? state.position;
    const radius =
      attack.type === "aoe_zone"
        ? Math.max(0.9, attack.radius ?? 1.25)
        : Math.max(0.75, Math.min(1.5, attack.range));

    if (this.marker !== null && this.markerAttackId === attack.id) {
      this.updateMarkerPosition(target);
      this.marker.setVisible(true);
      return;
    }

    this.clear();
    const marker = host.renderSystem.spawnTelegraphCircle(target, radius, host.origin);
    this.marker = marker;
    this.markerAttackId = attack.id;
    marker.setAlpha(0.52);
    marker.setVisible(true);

    host.tweens.add({
      targets: marker,
      alpha: 0.22,
      duration: 160,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
  }

  clear(): void {
    const host = this.options.host;
    if (this.marker !== null) {
      host.tweens.killTweensOf(this.marker);
      this.marker.destroy();
      this.marker = null;
    }
    this.markerAttackId = null;
  }

  private updateMarkerPosition(target: { x: number; y: number }): void {
    const host = this.options.host;
    if (this.marker === null) {
      return;
    }
    const mapped = gridToIso(
      target.x,
      target.y,
      host.tileWidth,
      host.tileHeight,
      host.origin.x,
      host.origin.y
    );
    this.marker.setPosition(mapped.x, mapped.y);
  }
}
