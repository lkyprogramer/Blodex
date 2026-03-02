import Phaser from "phaser";
import {
  createInitialMeta,
  migrateMeta,
  purchaseUnlock,
  resolveSelectedDifficulty,
  isDifficultyUnlocked,
  setSelectedDifficulty,
  type DifficultyMode,
  type MetaProgression
} from "@blodex/core";
import { UNLOCK_DEFS } from "@blodex/content";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const PURCHASE_HOTKEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"];
const DIFFICULTY_ORDER: DifficultyMode[] = ["normal", "hard", "nightmare"];
const DIFFICULTY_LABEL: Record<DifficultyMode, string> = {
  normal: "Normal",
  hard: "Hard",
  nightmare: "Nightmare"
};

export class MetaMenuScene extends Phaser.Scene {
  private meta: MetaProgression = createInitialMeta();

  constructor() {
    super("meta-menu");
  }

  create(): void {
    this.meta = this.loadMeta();
    const resolvedDifficulty = resolveSelectedDifficulty(this.meta);
    if (resolvedDifficulty !== this.meta.selectedDifficulty) {
      this.meta = {
        ...this.meta,
        selectedDifficulty: resolvedDifficulty
      };
      this.saveMeta(this.meta);
    }

    const cx = this.scale.width / 2;

    this.add
      .text(cx, 80, "Blodex Meta Progression", {
        fontFamily: "Cinzel",
        color: "#e8d2ad",
        fontSize: "36px"
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(cx, 134, `Soul Shards: ${this.meta.soulShards}`, {
        fontFamily: "Spectral",
        color: "#f5ead2",
        fontSize: "24px"
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(cx, 174, "Difficulty", {
        fontFamily: "Cinzel",
        color: "#e1c89b",
        fontSize: "24px"
      })
      .setOrigin(0.5, 0.5);

    DIFFICULTY_ORDER.forEach((mode, index) => {
      const unlocked = isDifficultyUnlocked(this.meta, mode);
      const selected = this.meta.selectedDifficulty === mode;
      const label = DIFFICULTY_LABEL[mode];
      const shortcut = index === 0 ? "Q" : index === 1 ? "W" : "E";
      const requirement =
        mode === "hard"
          ? "Clear 1 Normal run"
          : mode === "nightmare"
            ? "Clear 1 Hard run"
            : "Always available";
      const color = selected ? "#9ad7ff" : unlocked ? "#d7c49f" : "#7f7b70";
      const status = selected ? "[Selected]" : unlocked ? "[Available]" : `[Locked: ${requirement}]`;
      this.add
        .text(cx, 204 + index * 30, `[${shortcut}] ${label} ${status}`, {
          fontFamily: "Spectral",
          color,
          fontSize: "16px",
          align: "center"
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: unlocked })
        .on("pointerdown", () => {
          this.selectDifficulty(mode);
        });
    });

    this.add
      .text(cx, 298, "Click an unlock to purchase. Hotkeys: unlocks 1-0, difficulty Q/W/E.", {
        fontFamily: "Spectral",
        color: "#dbc8a5",
        fontSize: "15px",
        align: "center"
      })
      .setOrigin(0.5, 0.5);

    const unlockListStartY = 332;
    UNLOCK_DEFS.forEach((unlock, index) => {
      const unlocked = this.meta.unlocks.includes(unlock.id);
      const requirementReady = this.meta.cumulativeUnlockProgress >= unlock.cumulativeRequirement;
      const canAfford = this.meta.soulShards >= unlock.cost;
      const purchasable = !unlocked && requirementReady && canAfford;
      const statusText = unlocked
        ? "[Unlocked]"
        : !requirementReady
          ? `[Need Progress ${unlock.cumulativeRequirement}]`
          : !canAfford
            ? "[Need Soul Shards]"
            : "[Available]";
      const effectText = this.describeEffect(unlock);
      const color = unlocked ? "#7dbd91" : purchasable ? "#d7c49f" : "#7f7b70";

      this.add
        .text(
          cx,
          unlockListStartY + index * 30,
          `${index + 1}. ${unlock.name} (${unlock.cost}) ${statusText}\n   ${effectText}`,
          {
            fontFamily: "Spectral",
            color,
            fontSize: "15px",
            align: "center"
          }
        )
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          this.tryPurchase(index);
        });
    });

    const startButtonY = Math.min(this.scale.height - 56, unlockListStartY + UNLOCK_DEFS.length * 30 + 40);
    const startButton = this.add
      .rectangle(cx, startButtonY, 320, 56, 0x2d3b49, 0.95)
      .setStrokeStyle(2, 0xd0a86f)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, startButtonY, "Start New Run", {
        fontFamily: "Cinzel",
        color: "#f2e8d7",
        fontSize: "22px"
      })
      .setOrigin(0.5, 0.5);

    startButton.on("pointerdown", () => this.startRun());

    PURCHASE_HOTKEYS.forEach((key, index) => {
      this.input.keyboard?.on(`keydown-${key}`, () => this.tryPurchase(index));
    });
    this.input.keyboard?.on("keydown-Q", () => this.selectDifficulty("normal"));
    this.input.keyboard?.on("keydown-W", () => this.selectDifficulty("hard"));
    this.input.keyboard?.on("keydown-E", () => this.selectDifficulty("nightmare"));
    this.input.keyboard?.on("keydown-ENTER", () => this.startRun());
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

  private selectDifficulty(mode: DifficultyMode): void {
    const next = setSelectedDifficulty(this.meta, mode);
    if (next === this.meta) {
      return;
    }
    this.meta = next;
    this.saveMeta(next);
    this.scene.restart();
  }

  private startRun(): void {
    const difficulty = resolveSelectedDifficulty(this.meta);
    this.scene.start("dungeon", { difficulty });
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

  private describeEffect(unlock: (typeof UNLOCK_DEFS)[number]): string {
    if (unlock.effect.type === "permanent_upgrade") {
      return `Permanent: ${unlock.effect.key} +${unlock.effect.value}`;
    }
    if (unlock.effect.type === "skill_unlock") {
      return `Skill unlock: ${unlock.effect.skillId}`;
    }
    if (unlock.effect.type === "affix_unlock") {
      return `Affix unlock: ${unlock.effect.affixId}`;
    }
    if (unlock.effect.type === "biome_unlock") {
      return `Biome unlock: ${unlock.effect.biomeId}`;
    }
    return `Event unlock: ${unlock.effect.eventId}`;
  }
}
