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
import { UI_POLISH_FLAGS } from "../config/uiFlags";
import {
  bindMetaMenuPanelActions,
  renderMetaMenuPanel,
  type MetaMenuPanelView
} from "../ui/components/MetaMenuPanel";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const PURCHASE_HOTKEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"];
const DIFFICULTY_ORDER: DifficultyMode[] = ["normal", "hard", "nightmare"];
const DIFFICULTY_LABEL: Record<DifficultyMode, string> = {
  normal: "Normal",
  hard: "Hard",
  nightmare: "Nightmare"
};

function hotkeyLabelFromKey(eventName: string): string {
  switch (eventName) {
    case "ONE":
      return "1";
    case "TWO":
      return "2";
    case "THREE":
      return "3";
    case "FOUR":
      return "4";
    case "FIVE":
      return "5";
    case "SIX":
      return "6";
    case "SEVEN":
      return "7";
    case "EIGHT":
      return "8";
    case "NINE":
      return "9";
    case "ZERO":
      return "0";
    default:
      return eventName;
  }
}

export class MetaMenuScene extends Phaser.Scene {
  private meta: MetaProgression = createInitialMeta();
  private readonly unbindDomActions: Array<() => void> = [];
  private readonly keyboardBindings: Array<{ eventName: string; handler: () => void }> = [];
  private menuRoot: HTMLDivElement | null = null;

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

    this.teardownDomBindings();
    this.teardownKeyboardBindings();
    this.hideDomMenu();

    if (UI_POLISH_FLAGS.metaMenuDomEnabled && this.ensureMenuRoot()) {
      this.renderDomMenu();
    } else {
      this.renderLegacyPhaserMenu();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleSceneTeardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.handleSceneTeardown());
  }

  private renderDomMenu(): void {
    if (this.menuRoot === null) {
      return;
    }

    this.menuRoot.classList.remove("hidden");
    this.menuRoot.innerHTML = renderMetaMenuPanel(this.buildMenuView());

    this.unbindDomActions.push(
      ...bindMetaMenuPanelActions(this.menuRoot, {
        onPurchase: (index) => this.tryPurchase(index),
        onSelectDifficulty: (mode) => this.selectDifficulty(mode),
        onStartRun: () => this.startRun()
      })
    );

    PURCHASE_HOTKEYS.forEach((key, index) => {
      this.bindKeyboard(`keydown-${key}`, () => this.tryPurchase(index));
    });
    this.bindKeyboard("keydown-Q", () => this.selectDifficulty("normal"));
    this.bindKeyboard("keydown-W", () => this.selectDifficulty("hard"));
    this.bindKeyboard("keydown-E", () => this.selectDifficulty("nightmare"));
    this.bindKeyboard("keydown-ENTER", () => this.startRun());
  }

  private renderLegacyPhaserMenu(): void {
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
      const requirement = this.difficultyRequirement(mode);
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
      this.bindKeyboard(`keydown-${key}`, () => this.tryPurchase(index));
    });
    this.bindKeyboard("keydown-Q", () => this.selectDifficulty("normal"));
    this.bindKeyboard("keydown-W", () => this.selectDifficulty("hard"));
    this.bindKeyboard("keydown-E", () => this.selectDifficulty("nightmare"));
    this.bindKeyboard("keydown-ENTER", () => this.startRun());
  }

  private buildMenuView(): MetaMenuPanelView {
    const unlockGroups = new Map<number, MetaMenuPanelView["unlockGroups"][number]>();

    UNLOCK_DEFS.forEach((unlock, index) => {
      const unlocked = this.meta.unlocks.includes(unlock.id);
      const requirementReady = this.meta.cumulativeUnlockProgress >= unlock.cumulativeRequirement;
      const canAfford = this.meta.soulShards >= unlock.cost;
      const purchasable = !unlocked && requirementReady && canAfford;
      const statusText = unlocked
        ? "Unlocked"
        : !requirementReady
          ? `Need Progress ${unlock.cumulativeRequirement}`
          : !canAfford
            ? "Need Soul Shards"
            : "Available";

      const group = unlockGroups.get(unlock.tier) ?? {
        tier: unlock.tier,
        unlocks: []
      };
      group.unlocks.push({
        index,
        id: unlock.id,
        name: unlock.name,
        description: unlock.description,
        tier: unlock.tier,
        cost: unlock.cost,
        shortcut:
          PURCHASE_HOTKEYS[index] === undefined ? "-" : hotkeyLabelFromKey(PURCHASE_HOTKEYS[index]),
        effectText: this.describeEffect(unlock),
        statusText,
        unlocked,
        purchasable
      });
      unlockGroups.set(unlock.tier, group);
    });

    const difficulties = DIFFICULTY_ORDER.map((mode, index) => {
      const shortcut = index === 0 ? "Q" : index === 1 ? "W" : "E";
      return {
        mode,
        label: DIFFICULTY_LABEL[mode],
        shortcut,
        selected: this.meta.selectedDifficulty === mode,
        unlocked: isDifficultyUnlocked(this.meta, mode),
        requirement: this.difficultyRequirement(mode)
      };
    });

    return {
      soulShards: this.meta.soulShards,
      unlockedCount: this.meta.unlocks.length,
      totalUnlocks: UNLOCK_DEFS.length,
      difficulties,
      unlockGroups: [...unlockGroups.values()].sort((left, right) => left.tier - right.tier)
    };
  }

  private difficultyRequirement(mode: DifficultyMode): string {
    if (mode === "hard") {
      return "Clear 1 Normal run";
    }
    if (mode === "nightmare") {
      return "Clear 1 Hard run";
    }
    return "Always available";
  }

  private bindKeyboard(eventName: string, handler: () => void): void {
    this.input.keyboard?.on(eventName, handler);
    this.keyboardBindings.push({
      eventName,
      handler
    });
  }

  private teardownKeyboardBindings(): void {
    if (this.keyboardBindings.length === 0) {
      return;
    }
    for (const binding of this.keyboardBindings) {
      this.input.keyboard?.off(binding.eventName, binding.handler);
    }
    this.keyboardBindings.length = 0;
  }

  private teardownDomBindings(): void {
    if (this.unbindDomActions.length === 0) {
      return;
    }
    for (const off of this.unbindDomActions) {
      off();
    }
    this.unbindDomActions.length = 0;
  }

  private ensureMenuRoot(): boolean {
    this.menuRoot = document.querySelector("#meta-menu") as HTMLDivElement | null;
    return this.menuRoot !== null;
  }

  private hideDomMenu(): void {
    const root = this.menuRoot ?? (document.querySelector("#meta-menu") as HTMLDivElement | null);
    if (root === null) {
      return;
    }
    root.classList.add("hidden");
    root.innerHTML = "";
  }

  private handleSceneTeardown(): void {
    this.teardownKeyboardBindings();
    this.teardownDomBindings();
    this.hideDomMenu();
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
    this.hideDomMenu();
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
