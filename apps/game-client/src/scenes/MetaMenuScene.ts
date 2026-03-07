import Phaser from "phaser";
import {
  createInitialMeta,
  migrateMeta,
  normalizeMutationMetaState,
  resolveSelectedDifficulty,
  resolveDailyDate,
  isDifficultyUnlocked,
  type RunSaveDataV2,
  type DifficultyMode,
  type MetaProgression
} from "@blodex/core";
import { MUTATION_DEFS, UNLOCK_DEFS } from "@blodex/content";
import { getContentLocalizer, getLocale, resolveInitialLocale, setLocale, t } from "../i18n";
import { difficultyLabel } from "../i18n/labelResolvers";
import type { LocaleCode } from "../i18n/types";
import { SaveManager } from "../systems/SaveManager";
import {
  bindMetaMenuPanelActions,
  renderMetaMenuPanel
} from "../ui/components/MetaMenuPanel";
import {
  bindLanguageGateModalActions,
  renderLanguageGateModal
} from "../ui/components/LanguageGateModal";
import { playSceneTransition } from "../ui/SceneTransitionOverlay";
import { buildMetaMenuView } from "./meta/MetaMenuViewBuilder";
import { MetaFlowController } from "./meta/MetaFlowController";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const PURCHASE_HOTKEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"];
const DIFFICULTY_ORDER: DifficultyMode[] = ["normal", "hard", "nightmare"];

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

function describeLegacyUnlockEffect(unlock: (typeof UNLOCK_DEFS)[number]): string {
  if (unlock.effect.type === "permanent_upgrade") {
    return t("ui.meta.effect.permanent", {
      key: unlock.effect.key,
      value: unlock.effect.value
    });
  }
  if (unlock.effect.type === "skill_unlock") {
    return t("ui.meta.effect.skill_unlock", {
      skillId: unlock.effect.skillId
    });
  }
  if (unlock.effect.type === "affix_unlock") {
    return t("ui.meta.effect.affix_unlock", {
      affixId: unlock.effect.affixId
    });
  }
  if (unlock.effect.type === "biome_unlock") {
    return t("ui.meta.effect.biome_unlock", {
      biomeId: unlock.effect.biomeId
    });
  }
  return t("ui.meta.effect.event_unlock", {
    eventId: unlock.effect.eventId
  });
}

export class MetaMenuScene extends Phaser.Scene {
  private readonly contentLocalizer = getContentLocalizer();
  private meta: MetaProgression = createInitialMeta();
  private runSave: RunSaveDataV2 | null = null;
  private readonly saveManager = new SaveManager();
  private readonly unbindDomActions: Array<() => void> = [];
  private readonly unbindLanguageGateActions: Array<() => void> = [];
  private readonly keyboardBindings: Array<{ eventName: string; handler: () => void }> = [];
  private menuRoot: HTMLDivElement | null = null;
  private languageGateRoot: HTMLDivElement | null = null;
  private languageGateActive = false;
  private pendingLocaleSelection: LocaleCode = "en-US";
  private readonly metaFlowController = new MetaFlowController(this.createMetaFlowHost());

  constructor() {
    super("meta-menu");
  }

  create(): void {
    this.meta = this.loadMeta();
    this.resolveLocalePreference();
    this.normalizeMetaForPhase4B();
    this.runSave = this.saveManager.readSave();
    const resolvedDifficulty = resolveSelectedDifficulty(this.meta);
    if (resolvedDifficulty !== this.meta.selectedDifficulty) {
      this.meta = {
        ...this.meta,
        selectedDifficulty: resolvedDifficulty
      };
      this.saveMeta(this.meta);
    }

    this.teardownDomBindings();
    this.teardownLanguageGateBindings();
    this.teardownKeyboardBindings();
    this.hideDomMenu();
    this.hideLanguageGate();

    if (this.ensureMenuRoot()) {
      this.renderDomMenu();
    } else {
      this.renderLegacyPhaserMenu();
    }

    if (this.languageGateActive) {
      this.showLanguageGate();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleSceneTeardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.handleSceneTeardown());
  }

  private createMetaFlowHost() {
    const scene = this;
    return {
      getMeta() {
        return scene.meta;
      },
      setMeta(meta: MetaProgression) {
        scene.meta = meta;
      },
      getRunSave() {
        return scene.runSave;
      },
      getLanguageGateActive() {
        return scene.languageGateActive;
      },
      saveMeta(meta: MetaProgression) {
        return scene.saveMeta(meta);
      },
      hideDomMenu() {
        scene.hideDomMenu();
      },
      restartScene() {
        scene.scene.restart();
      },
      startDungeonScene(data: Record<string, unknown>) {
        scene.scene.start("dungeon", data);
      },
      readSave() {
        return scene.saveManager.readSave();
      },
      acquireLease(save: RunSaveDataV2) {
        return scene.saveManager.acquireLease(save);
      },
      hasForeignLease(save: RunSaveDataV2) {
        return scene.saveManager.hasForeignLease(save);
      },
      isRunSettled(runId: string) {
        return scene.saveManager.isRunSettled(runId);
      },
      markRunSettled(runId: string) {
        scene.saveManager.markRunSettled(runId);
      },
      deleteSave() {
        scene.saveManager.deleteSave();
      },
      resolveDailyDate() {
        return resolveDailyDate();
      }
    };
  }

  private renderDomMenu(): void {
    if (this.menuRoot === null) {
      return;
    }

    this.menuRoot.classList.remove("hidden");
    this.menuRoot.innerHTML = renderMetaMenuPanel(
      buildMetaMenuView({
        meta: this.meta,
        runSave: this.runSave,
        saveManager: this.saveManager,
        currentLocale: getLocale(),
        contentLocalizer: this.contentLocalizer
      })
    );

    this.unbindDomActions.push(
      ...bindMetaMenuPanelActions(this.menuRoot, {
        onSetLocale: (locale) => this.metaFlowController.switchLocale(locale),
        onPurchase: (index) => this.metaFlowController.tryPurchase(index),
        onPurchaseTalent: (talentId) => this.metaFlowController.tryPurchaseTalent(talentId),
        onSelectDifficulty: (mode) => this.metaFlowController.selectDifficulty(mode),
        onForgeBlueprint: (blueprintId) => this.metaFlowController.tryForgeBlueprint(blueprintId),
        onUnlockMutation: (mutationId) => this.metaFlowController.tryUnlockEchoMutation(mutationId),
        onToggleMutation: (mutationId) => this.metaFlowController.tryToggleMutationSelection(mutationId),
        onStartRun: () => this.metaFlowController.startRun(),
        onStartDaily: () => this.metaFlowController.startDailyRun(),
        onContinueRun: () => this.metaFlowController.continueRun(),
        onAbandonRun: () => this.metaFlowController.abandonRun()
      })
    );

    if (!this.languageGateActive) {
      PURCHASE_HOTKEYS.forEach((key, index) => {
        this.bindKeyboard(`keydown-${key}`, () => this.metaFlowController.tryPurchase(index));
      });
      this.bindKeyboard("keydown-Q", () => this.metaFlowController.selectDifficulty("normal"));
      this.bindKeyboard("keydown-W", () => this.metaFlowController.selectDifficulty("hard"));
      this.bindKeyboard("keydown-E", () => this.metaFlowController.selectDifficulty("nightmare"));
      this.bindKeyboard("keydown-ENTER", () => this.metaFlowController.startRun());
      this.bindKeyboard("keydown-D", () => this.metaFlowController.startDailyRun());
      this.bindKeyboard("keydown-C", () => this.metaFlowController.continueRun());
      this.bindKeyboard("keydown-B", () => this.metaFlowController.abandonRun());
    }
  }

  private renderLegacyPhaserMenu(): void {
    const cx = this.scale.width / 2;

    this.add
      .text(cx, 80, t("ui.meta.title"), {
        fontFamily: "Cinzel",
        color: "#e8d2ad",
        fontSize: "36px"
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(cx, 134, t("ui.meta.resources.soul_shards", { value: this.meta.soulShards }), {
        fontFamily: "Spectral",
        color: "#f5ead2",
        fontSize: "24px"
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(cx, 174, t("ui.meta.section.difficulty"), {
        fontFamily: "Cinzel",
        color: "#e1c89b",
        fontSize: "24px"
      })
      .setOrigin(0.5, 0.5);

    DIFFICULTY_ORDER.forEach((mode, index) => {
      const unlocked = isDifficultyUnlocked(this.meta, mode);
      const selected = this.meta.selectedDifficulty === mode;
      const label = difficultyLabel(mode);
      const shortcut = index === 0 ? "Q" : index === 1 ? "W" : "E";
      const requirement = this.difficultyRequirement(mode);
      const color = selected ? "#9ad7ff" : unlocked ? "#d7c49f" : "#7f7b70";
      const status = selected
        ? `[${t("ui.meta.difficulty.selected")}]`
        : unlocked
          ? `[${t("ui.meta.difficulty.available")}]`
          : `[${t("ui.meta.difficulty.locked")}: ${requirement}]`;
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
          this.metaFlowController.selectDifficulty(mode);
        });
    });

    this.add
      .text(cx, 298, t("ui.legacy.meta.click_unlock_hint"), {
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
        ? `[${t("ui.meta.status.unlocked")}]`
        : !requirementReady
          ? `[${t("ui.meta.status.need_progress", { progress: unlock.cumulativeRequirement })}]`
          : !canAfford
            ? `[${t("ui.meta.status.need_soul_shards")}]`
            : `[${t("ui.meta.status.available")}]`;
      const effectText = describeLegacyUnlockEffect(unlock);
      const color = unlocked ? "#7dbd91" : purchasable ? "#d7c49f" : "#7f7b70";

      this.add
        .text(
          cx,
          unlockListStartY + index * 30,
          `${index + 1}. ${this.contentLocalizer.unlockName(unlock.id, unlock.name)} (${unlock.cost}) ${statusText}\n   ${effectText}`,
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
          this.metaFlowController.tryPurchase(index);
        });
    });

    const startButtonY = Math.min(this.scale.height - 56, unlockListStartY + UNLOCK_DEFS.length * 30 + 40);
    const startButton = this.add
      .rectangle(cx, startButtonY, 320, 56, 0x2d3b49, 0.95)
      .setStrokeStyle(2, 0xd0a86f)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, startButtonY, t("ui.meta.action.start_run"), {
        fontFamily: "Cinzel",
        color: "#f2e8d7",
        fontSize: "22px"
      })
      .setOrigin(0.5, 0.5);

    startButton.on("pointerdown", () => this.metaFlowController.startRun());

    PURCHASE_HOTKEYS.forEach((key, index) => {
      this.bindKeyboard(`keydown-${key}`, () => this.metaFlowController.tryPurchase(index));
    });
    this.bindKeyboard("keydown-Q", () => this.metaFlowController.selectDifficulty("normal"));
    this.bindKeyboard("keydown-W", () => this.metaFlowController.selectDifficulty("hard"));
    this.bindKeyboard("keydown-E", () => this.metaFlowController.selectDifficulty("nightmare"));
    this.bindKeyboard("keydown-ENTER", () => this.metaFlowController.startRun());
    this.bindKeyboard("keydown-D", () => this.metaFlowController.startDailyRun());
  }

  private resolveLocalePreference(): void {
    const locale = resolveInitialLocale({
      preferredLocale: this.meta.preferredLocale,
      defaultLocale: "en-US"
    });
    this.languageGateActive = this.meta.preferredLocale === null;
    this.pendingLocaleSelection = locale;
    setLocale(locale, { persist: this.meta.preferredLocale !== null });
    if (this.meta.preferredLocale !== null && this.meta.preferredLocale !== locale) {
      this.meta = {
        ...this.meta,
        preferredLocale: locale
      };
      this.saveMeta(this.meta);
    }
  }

  private ensureLanguageGateRoot(): boolean {
    this.languageGateRoot = document.querySelector("#language-gate") as HTMLDivElement | null;
    return this.languageGateRoot !== null;
  }

  private showLanguageGate(): void {
    if (!this.ensureLanguageGateRoot() || this.languageGateRoot === null) {
      return;
    }
    this.teardownLanguageGateBindings();
    this.languageGateRoot.classList.remove("hidden");
    this.languageGateRoot.innerHTML = renderLanguageGateModal({
      selectedLocale: this.pendingLocaleSelection
    });
    this.unbindLanguageGateActions.push(
      ...bindLanguageGateModalActions(this.languageGateRoot, {
        onSelectLocale: (locale) => {
          this.pendingLocaleSelection = locale;
          setLocale(locale, { persist: false });
          this.showLanguageGate();
        },
        onConfirm: () => this.confirmLanguageSelection()
      })
    );
  }

  private hideLanguageGate(): void {
    const root = this.languageGateRoot ?? (document.querySelector("#language-gate") as HTMLDivElement | null);
    if (root === null) {
      return;
    }
    root.classList.add("hidden");
    root.innerHTML = "";
  }

  private confirmLanguageSelection(): void {
    const locale = this.pendingLocaleSelection;
    this.languageGateActive = false;
    setLocale(locale);
    this.meta = {
      ...this.meta,
      preferredLocale: locale
    };
    this.saveMeta(this.meta);
    this.teardownLanguageGateBindings();
    this.hideLanguageGate();
    this.scene.restart();
  }

  private difficultyRequirement(mode: DifficultyMode): string {
    if (mode === "hard") {
      return t("ui.meta.requirement.hard");
    }
    if (mode === "nightmare") {
      return t("ui.meta.requirement.nightmare");
    }
    return t("ui.meta.requirement.normal");
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

  private teardownLanguageGateBindings(): void {
    if (this.unbindLanguageGateActions.length === 0) {
      return;
    }
    for (const off of this.unbindLanguageGateActions) {
      off();
    }
    this.unbindLanguageGateActions.length = 0;
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
    this.teardownLanguageGateBindings();
    this.hideDomMenu();
    this.hideLanguageGate();
  }

  private normalizeMetaForPhase4B(): void {
    const normalized = normalizeMutationMetaState(this.meta, MUTATION_DEFS);
    if (JSON.stringify(normalized) !== JSON.stringify(this.meta)) {
      this.meta = normalized;
      this.saveMeta(this.meta);
      return;
    }
    this.meta = normalized;
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

  private saveMeta(meta: MetaProgression): boolean {
    try {
      window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }

}
