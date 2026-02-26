import Phaser from "phaser";
import { createInitialMeta, migrateMeta, purchaseUnlock, type MetaProgression } from "@blodex/core";
import { UNLOCK_DEFS } from "@blodex/content";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";

export class MetaMenuScene extends Phaser.Scene {
  private meta: MetaProgression = createInitialMeta();

  constructor() {
    super("meta-menu");
  }

  create(): void {
    this.meta = this.loadMeta();

    const cx = this.scale.width / 2;

    this.add
      .text(cx, 80, "Blodex Meta Progression", {
        fontFamily: "Cinzel",
        color: "#e8d2ad",
        fontSize: "36px"
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(cx, 140, `Soul Shards: ${this.meta.soulShards}`, {
        fontFamily: "Spectral",
        color: "#f5ead2",
        fontSize: "24px"
      })
      .setOrigin(0.5, 0.5);

    const unlockLines = UNLOCK_DEFS.slice(0, 6).map((unlock, index) => {
      const unlocked = this.meta.unlocks.includes(unlock.id);
      return `${index + 1}. ${unlock.name} (${unlock.cost}) ${unlocked ? "[Unlocked]" : ""}`;
    });

    this.add
      .text(cx, 230, unlockLines.join("\n"), {
        fontFamily: "Spectral",
        color: "#c9bb9d",
        fontSize: "16px",
        align: "center"
      })
      .setOrigin(0.5, 0);

    const startButton = this.add
      .rectangle(cx, 470, 320, 56, 0x2d3b49, 0.95)
      .setStrokeStyle(2, 0xd0a86f)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, 470, "Start New Run", {
        fontFamily: "Cinzel",
        color: "#f2e8d7",
        fontSize: "22px"
      })
      .setOrigin(0.5, 0.5);

    startButton.on("pointerdown", () => {
      this.scene.start("dungeon");
    });

    this.input.keyboard?.on("keydown-ONE", () => this.tryPurchase(0));
    this.input.keyboard?.on("keydown-TWO", () => this.tryPurchase(1));
    this.input.keyboard?.on("keydown-THREE", () => this.tryPurchase(2));
    this.input.keyboard?.on("keydown-FOUR", () => this.tryPurchase(3));
    this.input.keyboard?.on("keydown-FIVE", () => this.tryPurchase(4));
    this.input.keyboard?.on("keydown-SIX", () => this.tryPurchase(5));
    this.input.keyboard?.on("keydown-ENTER", () => this.scene.start("dungeon"));
  }

  private tryPurchase(index: number): void {
    const unlock = UNLOCK_DEFS[index];
    if (unlock === undefined) {
      return;
    }
    const next = purchaseUnlock(this.meta, unlock);
    if (next === this.meta) {
      return;
    }
    this.meta = next;
    this.saveMeta(next);
    this.scene.restart();
  }

  private loadMeta(): MetaProgression {
    const rawV2 = window.localStorage.getItem(META_STORAGE_KEY_V2);
    if (rawV2 !== null) {
      try {
        return migrateMeta(JSON.parse(rawV2));
      } catch {
        return createInitialMeta();
      }
    }

    const rawV1 = window.localStorage.getItem(META_STORAGE_KEY_V1);
    if (rawV1 !== null) {
      try {
        const migrated = migrateMeta(JSON.parse(rawV1));
        this.saveMeta(migrated);
        return migrated;
      } catch {
        return createInitialMeta();
      }
    }

    return createInitialMeta();
  }

  private saveMeta(meta: MetaProgression): void {
    window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(meta));
  }
}
