import Phaser from "phaser";

export interface ParticlePoolConfig {
  maxFloatingTexts: number;
  maxEllipses: number;
}

export interface ParticlePoolStats {
  allTexts: number;
  freeTexts: number;
  activeTexts: number;
  allEllipses: number;
  freeEllipses: number;
  activeEllipses: number;
}

const DEFAULT_CONFIG: ParticlePoolConfig = {
  maxFloatingTexts: 48,
  maxEllipses: 36
};

/**
 * Lightweight pool for transient VFX objects.
 * Reuses text/ellipse nodes to reduce allocations during dense combat.
 */
export class ParticlePool {
  private readonly config: ParticlePoolConfig;
  private readonly allTexts: Phaser.GameObjects.Text[] = [];
  private readonly freeTexts: Phaser.GameObjects.Text[] = [];
  private readonly activeTexts: Phaser.GameObjects.Text[] = [];

  private readonly allEllipses: Phaser.GameObjects.Ellipse[] = [];
  private readonly freeEllipses: Phaser.GameObjects.Ellipse[] = [];
  private readonly activeEllipses: Phaser.GameObjects.Ellipse[] = [];

  constructor(private readonly scene: Phaser.Scene, config?: Partial<ParticlePoolConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...(config ?? {})
    };
  }

  acquireText(): Phaser.GameObjects.Text {
    const reusable = this.popText();
    if (reusable !== null) {
      reusable
        .setVisible(true)
        .setActive(true)
        .setAlpha(1)
        .setScale(1);
      this.activeTexts.push(reusable);
      return reusable;
    }

    const text = this.scene.add.text(0, 0, "", {
      fontFamily: "Cinzel, serif",
      fontSize: "12px",
      color: "#f0e7da",
      stroke: "#10141b",
      strokeThickness: 3
    });
    text.setVisible(true).setActive(true).setOrigin(0.5);

    this.allTexts.push(text);
    this.activeTexts.push(text);
    return text;
  }

  releaseText(text: Phaser.GameObjects.Text): void {
    this.scene.tweens.killTweensOf(text);
    this.removeFromArray(this.activeTexts, text);
    text
      .setText("")
      .setVisible(false)
      .setActive(false)
      .setAlpha(1)
      .setScale(1)
      .setPosition(-9999, -9999);
    if (!this.freeTexts.includes(text)) {
      this.freeTexts.push(text);
    }
  }

  acquireEllipse(): Phaser.GameObjects.Ellipse {
    const reusable = this.popEllipse();
    if (reusable !== null) {
      reusable
        .setVisible(true)
        .setActive(true)
        .setAlpha(1)
        .setScale(1);
      this.activeEllipses.push(reusable);
      return reusable;
    }

    const ellipse = this.scene.add.ellipse(0, 0, 8, 8, 0xffffff, 0.3);
    ellipse.setVisible(true).setActive(true);
    this.allEllipses.push(ellipse);
    this.activeEllipses.push(ellipse);
    return ellipse;
  }

  releaseEllipse(ellipse: Phaser.GameObjects.Ellipse): void {
    this.scene.tweens.killTweensOf(ellipse);
    this.removeFromArray(this.activeEllipses, ellipse);
    ellipse
      .setVisible(false)
      .setActive(false)
      .setAlpha(1)
      .setScale(1)
      .setPosition(-9999, -9999);
    if (!this.freeEllipses.includes(ellipse)) {
      this.freeEllipses.push(ellipse);
    }
  }

  releaseAll(): void {
    for (const text of [...this.activeTexts]) {
      this.releaseText(text);
    }
    for (const ellipse of [...this.activeEllipses]) {
      this.releaseEllipse(ellipse);
    }
  }

  shutdown(): void {
    this.releaseAll();
    for (const text of this.allTexts) {
      text.destroy();
    }
    for (const ellipse of this.allEllipses) {
      ellipse.destroy();
    }
    this.allTexts.length = 0;
    this.freeTexts.length = 0;
    this.activeTexts.length = 0;
    this.allEllipses.length = 0;
    this.freeEllipses.length = 0;
    this.activeEllipses.length = 0;
  }

  getStats(): ParticlePoolStats {
    return {
      allTexts: this.allTexts.length,
      freeTexts: this.freeTexts.length,
      activeTexts: this.activeTexts.length,
      allEllipses: this.allEllipses.length,
      freeEllipses: this.freeEllipses.length,
      activeEllipses: this.activeEllipses.length
    };
  }

  private popText(): Phaser.GameObjects.Text | null {
    const fromFree = this.freeTexts.pop();
    if (fromFree !== undefined) {
      return fromFree;
    }
    if (this.allTexts.length < this.config.maxFloatingTexts) {
      return null;
    }
    const recycled = this.activeTexts.shift() ?? null;
    if (recycled === null) {
      return null;
    }
    this.scene.tweens.killTweensOf(recycled);
    recycled
      .setText("")
      .setAlpha(1)
      .setScale(1)
      .setVisible(true)
      .setActive(true);
    return recycled;
  }

  private popEllipse(): Phaser.GameObjects.Ellipse | null {
    const fromFree = this.freeEllipses.pop();
    if (fromFree !== undefined) {
      return fromFree;
    }
    if (this.allEllipses.length < this.config.maxEllipses) {
      return null;
    }
    const recycled = this.activeEllipses.shift() ?? null;
    if (recycled === null) {
      return null;
    }
    this.scene.tweens.killTweensOf(recycled);
    recycled
      .setAlpha(1)
      .setScale(1)
      .setVisible(true)
      .setActive(true);
    return recycled;
  }

  private removeFromArray<T>(items: T[], target: T): void {
    const index = items.indexOf(target);
    if (index >= 0) {
      items.splice(index, 1);
    }
  }
}
