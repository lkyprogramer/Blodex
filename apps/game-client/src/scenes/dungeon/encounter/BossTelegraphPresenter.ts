import type { BossAttack, BossRuntimeState } from "@blodex/core";
import type { BossTelegraphProfileDef } from "@blodex/content";
import Phaser from "phaser";
import { gridToIso } from "../../../systems/iso";
import type { BossTelegraphHost } from "./ports";

export interface BossTelegraphPresenterOptions {
  host: BossTelegraphHost;
}

export class BossTelegraphPresenter {
  private static readonly BOSS_TELEGRAPH_TEXTURE_KEY = "boss_telegraph_sigil_01";
  private marker: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null = null;
  private markerAttackId: string | null = null;

  constructor(private readonly options: BossTelegraphPresenterOptions) {}

  show(state: BossRuntimeState, attack: BossAttack, profile?: BossTelegraphProfileDef): void {
    const host = this.options.host;
    const target = state.telegraphTarget ?? state.position;
    const radiusScale = profile?.radiusScale ?? 1;
    const radius =
      attack.type === "aoe_zone"
        ? Math.max(0.9, (attack.radius ?? 1.25) * radiusScale)
        : Math.max(0.75, Math.min(1.5, attack.range * radiusScale));

    if (this.marker !== null && this.markerAttackId === attack.id) {
      this.updateMarkerPosition(target);
      this.marker.setVisible(true);
      return;
    }

    this.clear();
    const marker = host.renderSystem.spawnTelegraphCircle(
      target,
      radius,
      host.origin,
      BossTelegraphPresenter.BOSS_TELEGRAPH_TEXTURE_KEY
    );
    this.marker = marker;
    this.markerAttackId = attack.id;
    marker.setAlpha(profile?.alpha ?? 0.52);
    if (marker instanceof Phaser.GameObjects.Image) {
      marker.setTint(profile?.tintColor ?? 0xb74f4f);
    }
    marker.setVisible(true);

    host.tweens.add({
      targets: marker,
      alpha: 0.22,
      duration: profile?.pulseDurationMs ?? 160,
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
