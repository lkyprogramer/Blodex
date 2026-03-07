import Phaser from "phaser";
import type { HazardType, WeaponType } from "@blodex/core";
import { ParticlePool } from "./pools/ParticlePool";
import { LEVEL_UP_FEEDBACK_PROFILE } from "./feedback/LevelUpFeedbackProfile";
import { resolveWeaponFeedbackProfile } from "./feedback/WeaponFeedbackProfile";

type EntitySprite = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
type VfxPriority = "high" | "low";

const MAX_TRANSIENT_EFFECTS = 72;

export interface VFXDiagnostics {
  enabled: boolean;
  activeTransientObjects: number;
  droppedEffects: number;
  pool: ReturnType<ParticlePool["getStats"]>;
}

export class VFXSystem {
  private enabled = true;
  private readonly transientObjects = new Set<Phaser.GameObjects.GameObject>();
  private readonly particlePool: ParticlePool;
  private droppedEffects = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.particlePool = new ParticlePool(scene);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearTransientObjects();
    }
  }

  playCombatHit(
    target: EntitySprite | null,
    amount: number,
    critical: boolean,
    weaponType?: WeaponType
  ): void {
    if (!this.enabled || target === null || !target.active) {
      return;
    }

    const weaponProfile = resolveWeaponFeedbackProfile(weaponType);
    const flashColor = critical ? 0xfff2a8 : weaponProfile.flashColor;
    this.flashTarget(target, flashColor, critical ? 72 : 60);
    this.spawnFloatingText(
      target.x,
      target.y - 40,
      `${critical ? "CRIT " : ""}${Math.max(1, Math.floor(amount))}`,
      {
        color: critical ? "#ffe777" : weaponProfile.floatingTextColor,
        size: critical ? Math.max(14, weaponProfile.floatingTextSize + 2) : weaponProfile.floatingTextSize,
        durationMs: critical ? 620 : 520,
        rise: critical ? weaponProfile.floatingTextRise + 8 : weaponProfile.floatingTextRise
      },
      critical ? "high" : "low"
    );

    const offset = critical
      ? Math.max(4, weaponProfile.hitOffset + 1)
      : Math.max(2, weaponProfile.hitOffset);
    this.scene.tweens.add({
      targets: target,
      x: target.x + offset,
      duration: 70,
      yoyo: true,
      ease: "Quad.Out"
    });

    if (critical || weaponType === "hammer") {
      this.scene.cameras.main.shake(90, 0.0025);
    }
  }

  playCombatDodge(target: EntitySprite | null): void {
    if (!this.enabled || target === null || !target.active) {
      return;
    }

    this.spawnFloatingText(
      target.x,
      target.y - 36,
      "DODGE",
      {
        color: "#a8d6ff",
        size: 12,
        durationMs: 430,
        rise: 18
      },
      "low"
    );
    this.scene.tweens.add({
      targets: target,
      alpha: 0.52,
      duration: 80,
      yoyo: true,
      ease: "Sine.InOut"
    });
  }

  playCombatDeath(target: EntitySprite | null): void {
    if (!this.enabled || target === null || !target.active) {
      return;
    }

    this.scene.tweens.add({
      targets: target,
      alpha: 0,
      scaleX: 0.84,
      scaleY: 0.84,
      duration: 180,
      ease: "Cubic.In",
      onComplete: () => {
        if (target.active) {
          target.setAlpha(1);
          target.setScale(1);
        }
      }
    });
  }

  playSkillCast(caster: EntitySprite | null, skillId: string): void {
    if (!this.enabled || caster === null || !caster.active) {
      return;
    }
    if (!this.tryReserveTransient("high")) {
      return;
    }

    const color =
      skillId === "blood_drain"
        ? 0xd86a6a
        : skillId === "frost_nova"
          ? 0x8bc7ff
          : skillId === "shadow_step"
            ? 0xb093e7
            : skillId === "war_cry"
              ? 0xf1b264
              : 0xcfd6de;

    const ring = this.particlePool
      .acquireEllipse()
      .setPosition(caster.x, caster.y - 6)
      .setSize(12, 8)
      .setFillStyle(color, 0.35)
      .setStrokeStyle(2, color, 0.75)
      .setDepth(90_000);
    this.transientObjects.add(ring);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 3.2,
      scaleY: 2.8,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => {
        this.transientObjects.delete(ring);
        this.particlePool.releaseEllipse(ring);
      }
    });
  }

  playLevelUp(target: EntitySprite | null, level: number): void {
    if (!this.enabled) {
      return;
    }

    const profile = LEVEL_UP_FEEDBACK_PROFILE;
    const centerX = target?.x ?? this.scene.cameras.main.midPoint.x;
    const centerY = (target?.y ?? this.scene.cameras.main.midPoint.y) - 10;
    this.spawnFloatingText(
      centerX,
      centerY - 28,
      `LEVEL ${Math.max(1, Math.floor(level))}`,
      {
        color: profile.floatingTextColor,
        size: 16,
        durationMs: profile.floatingTextDurationMs,
        rise: profile.floatingTextRise
      },
      "high"
    );

    if (target !== null && target.active) {
      this.flashTarget(target, profile.flashColor, profile.flashDurationMs);
    }

    if (this.tryReserveTransient("high")) {
      const ring = this.particlePool
        .acquireEllipse()
        .setPosition(centerX, centerY)
        .setSize(18, 12)
        .setFillStyle(profile.ringColor, 0.25)
        .setStrokeStyle(2, profile.ringColor, 0.8)
        .setDepth(90_000);
      this.transientObjects.add(ring);

      this.scene.tweens.add({
        targets: ring,
        scaleX: 4,
        scaleY: 3.2,
        alpha: 0,
        duration: profile.floatingTextDurationMs,
        ease: "Cubic.Out",
        onComplete: () => {
          this.transientObjects.delete(ring);
          this.particlePool.releaseEllipse(ring);
        }
      });
    }

    this.scene.cameras.main.flash(profile.flashDurationMs, 242, 214, 139, false);
    this.scene.cameras.main.shake(110, 0.0028);
  }

  playBossPhaseChange(boss: EntitySprite | null): void {
    if (!this.enabled) {
      return;
    }

    if (boss !== null && boss.active) {
      this.flashTarget(boss, 0xffc9ab, 120);
    }
    this.scene.cameras.main.flash(130, 250, 120, 80, false);
    this.scene.cameras.main.shake(180, 0.0045);
    this.scene.time.timeScale = 0.92;
    this.scene.time.delayedCall(220, () => {
      this.scene.time.timeScale = 1;
    });
  }

  playRareDrop(rarity: "rare" | "unique"): void {
    if (!this.enabled) {
      return;
    }

    this.scene.cameras.main.flash(rarity === "unique" ? 180 : 130, 234, 197, 117, false);
    this.scene.cameras.main.shake(rarity === "unique" ? 140 : 90, rarity === "unique" ? 0.0032 : 0.0022);
    this.spawnFloatingText(
      this.scene.cameras.main.midPoint.x,
      this.scene.cameras.main.midPoint.y - 24,
      rarity === "unique" ? "UNIQUE" : "RARE",
      {
        color: rarity === "unique" ? "#ffe7a0" : "#f1d48b",
        size: rarity === "unique" ? 18 : 16,
        durationMs: 820,
        rise: 22
      },
      "high"
    );
  }

  playBuildFormed(): void {
    if (!this.enabled) {
      return;
    }

    this.scene.cameras.main.flash(120, 179, 215, 146, false);
    this.spawnFloatingText(
      this.scene.cameras.main.midPoint.x,
      this.scene.cameras.main.midPoint.y - 18,
      "BUILD FORMED",
      {
        color: "#b7df92",
        size: 16,
        durationMs: 760,
        rise: 18
      },
      "high"
    );
  }

  playBossReward(): void {
    if (!this.enabled) {
      return;
    }

    this.scene.cameras.main.flash(140, 242, 210, 132, false);
    this.spawnFloatingText(
      this.scene.cameras.main.midPoint.x,
      this.scene.cameras.main.midPoint.y - 18,
      "BOSS REWARD",
      {
        color: "#f2d284",
        size: 16,
        durationMs: 760,
        rise: 18
      },
      "high"
    );
  }

  playSynergyActivated(): void {
    if (!this.enabled) {
      return;
    }

    this.spawnFloatingText(
      this.scene.cameras.main.midPoint.x,
      this.scene.cameras.main.midPoint.y - 18,
      "SYNERGY",
      {
        color: "#99d2ff",
        size: 15,
        durationMs: 720,
        rise: 16
      },
      "high"
    );
  }

  playPowerSpike(major: boolean): void {
    if (!this.enabled) {
      return;
    }

    this.scene.cameras.main.flash(major ? 150 : 110, 236, 182, 92, false);
    if (major) {
      this.scene.cameras.main.shake(120, 0.0026);
    }
    this.spawnFloatingText(
      this.scene.cameras.main.midPoint.x,
      this.scene.cameras.main.midPoint.y - 18,
      major ? "MAJOR SPIKE" : "SPIKE",
      {
        color: major ? "#ffdc96" : "#f0c07a",
        size: major ? 16 : 14,
        durationMs: 700,
        rise: 16
      },
      "high"
    );
  }

  playHazardTrigger(worldX: number, worldY: number, hazardType: HazardType): void {
    if (!this.enabled) {
      return;
    }
    if (!this.tryReserveTransient("low")) {
      return;
    }

    const color =
      hazardType === "damage_zone"
        ? 0xd86f51
        : hazardType === "movement_modifier"
          ? 0x74b3de
          : 0xc4a1df;

    const pulse = this.particlePool
      .acquireEllipse()
      .setPosition(worldX, worldY)
      .setSize(14, 8)
      .setFillStyle(color, 0.34)
      .setStrokeStyle(2, color, 0.82)
      .setDepth(90_000);
    this.transientObjects.add(pulse);

    this.scene.tweens.add({
      targets: pulse,
      scaleX: 3.4,
      scaleY: 2.7,
      alpha: 0,
      duration: 320,
      ease: "Quad.Out",
      onComplete: () => {
        this.transientObjects.delete(pulse);
        this.particlePool.releaseEllipse(pulse);
      }
    });
  }

  shutdown(): void {
    this.clearTransientObjects();
    this.droppedEffects = 0;
    this.particlePool.shutdown();
  }

  getDiagnostics(): VFXDiagnostics {
    return {
      enabled: this.enabled,
      activeTransientObjects: this.transientObjects.size,
      droppedEffects: this.droppedEffects,
      pool: this.particlePool.getStats()
    };
  }

  private clearTransientObjects(): void {
    for (const obj of this.transientObjects) {
      this.scene.tweens.killTweensOf(obj);
      if (obj instanceof Phaser.GameObjects.Text) {
        this.particlePool.releaseText(obj);
      } else if (obj instanceof Phaser.GameObjects.Ellipse) {
        this.particlePool.releaseEllipse(obj);
      } else {
        obj.destroy();
      }
    }
    this.transientObjects.clear();
    this.particlePool.releaseAll();
  }

  private flashTarget(target: EntitySprite, color: number, durationMs: number): void {
    if (target instanceof Phaser.GameObjects.Image) {
      target.setTintFill(color);
      this.scene.time.delayedCall(durationMs, () => {
        if (target.active) {
          target.clearTint();
        }
      });
      return;
    }

    const originalColor = target.fillColor;
    const originalAlpha = target.fillAlpha;
    target.setFillStyle(color, 1);
    this.scene.time.delayedCall(durationMs, () => {
      if (target.active) {
        target.setFillStyle(originalColor, originalAlpha);
      }
    });
  }

  private spawnFloatingText(
    x: number,
    y: number,
    message: string,
    config: { color: string; size: number; durationMs: number; rise: number },
    priority: VfxPriority
  ): void {
    if (!this.tryReserveTransient(priority)) {
      return;
    }
    const text = this.particlePool
      .acquireText()
      .setPosition(x, y)
      .setText(message)
      .setStyle({
        fontFamily: "Cinzel, serif",
        fontSize: `${config.size}px`,
        color: config.color,
        stroke: "#10141b",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(90_100);
    this.transientObjects.add(text);

    this.scene.tweens.add({
      targets: text,
      y: y - config.rise,
      alpha: 0,
      duration: config.durationMs,
      ease: "Cubic.Out",
      onComplete: () => {
        this.transientObjects.delete(text);
        this.particlePool.releaseText(text);
      }
    });
  }

  private tryReserveTransient(priority: VfxPriority): boolean {
    if (this.transientObjects.size < MAX_TRANSIENT_EFFECTS) {
      return true;
    }
    if (priority === "high") {
      return true;
    }
    this.droppedEffects += 1;
    return false;
  }
}
