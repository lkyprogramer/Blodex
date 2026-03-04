import Phaser from "phaser";
import {
  applyRunSummaryToMeta,
  buildMutationDefMap,
  calculateSoulShardReward,
  canStartDailyScoredAttempt,
  collectUnlockedMutationIds,
  canPurchaseTalent,
  createDailySeed,
  createInitialMeta,
  endRun,
  forgeBlueprint,
  migrateMeta,
  mergeFoundBlueprints,
  normalizeMutationMetaState,
  purchaseTalent,
  purchaseUnlock,
  resolveSelectedDifficulty,
  resolveDailyDate,
  unlockEchoMutation,
  validateMutationSelection,
  isDifficultyUnlocked,
  setSelectedDifficulty,
  type MutationDef,
  type MutationEffect,
  type RunSaveDataV2,
  type TalentNodeDef,
  type DifficultyMode,
  type MetaProgression
} from "@blodex/core";
import { BLUEPRINT_DEF_MAP, BLUEPRINT_DEFS, MUTATION_DEFS, TALENT_DEFS, UNLOCK_DEFS } from "@blodex/content";
import { getContentLocalizer, getLocale, resolveInitialLocale, setLocale, t } from "../i18n";
import type { LocaleCode } from "../i18n/types";
import { SaveManager } from "../systems/SaveManager";
import {
  bindMetaMenuPanelActions,
  renderMetaMenuPanel,
  type MetaMenuPanelView
} from "../ui/components/MetaMenuPanel";
import {
  bindLanguageGateModalActions,
  renderLanguageGateModal
} from "../ui/components/LanguageGateModal";
import { playSceneTransition } from "../ui/SceneTransitionOverlay";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const PURCHASE_HOTKEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"];
const DIFFICULTY_ORDER: DifficultyMode[] = ["normal", "hard", "nightmare"];
const DIFFICULTY_LABEL_KEY: Record<DifficultyMode, string> = {
  normal: "ui.meta.difficulty.normal",
  hard: "ui.meta.difficulty.hard",
  nightmare: "ui.meta.difficulty.nightmare"
};
const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);
const MUTATION_EFFECT_LABEL_KEY: Record<MutationEffect["type"], string> = {
  on_kill_heal_percent: "ui.meta.mutation.effect.on_kill_heal_percent",
  on_kill_attack_speed: "ui.meta.mutation.effect.on_kill_attack_speed",
  on_hit_invuln: "ui.meta.mutation.effect.on_hit_invuln",
  on_hit_reflect_percent: "ui.meta.mutation.effect.on_hit_reflect_percent",
  once_per_floor_lethal_guard: "ui.meta.mutation.effect.once_per_floor_lethal_guard",
  drop_bonus: "ui.meta.mutation.effect.drop_bonus",
  move_speed_multiplier: "ui.meta.mutation.effect.move_speed_multiplier",
  potion_heal_amp_and_self_damage: "ui.meta.mutation.effect.potion_heal_amp_and_self_damage",
  hidden_room_reveal_radius: "ui.meta.mutation.effect.hidden_room_reveal_radius"
};

function difficultyLabel(mode: DifficultyMode): string {
  return t(DIFFICULTY_LABEL_KEY[mode]);
}

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

  private renderDomMenu(): void {
    if (this.menuRoot === null) {
      return;
    }

    this.menuRoot.classList.remove("hidden");
    this.menuRoot.innerHTML = renderMetaMenuPanel(this.buildMenuView());

    this.unbindDomActions.push(
      ...bindMetaMenuPanelActions(this.menuRoot, {
        onSetLocale: (locale) => this.switchLocale(locale),
        onPurchase: (index) => this.tryPurchase(index),
        onPurchaseTalent: (talentId) => this.tryPurchaseTalent(talentId),
        onSelectDifficulty: (mode) => this.selectDifficulty(mode),
        onForgeBlueprint: (blueprintId) => this.tryForgeBlueprint(blueprintId),
        onUnlockMutation: (mutationId) => this.tryUnlockEchoMutation(mutationId),
        onToggleMutation: (mutationId) => this.tryToggleMutationSelection(mutationId),
        onStartRun: () => this.startRun(),
        onStartDaily: () => this.startDailyRun(),
        onContinueRun: () => this.continueRun(),
        onAbandonRun: () => this.abandonRun()
      })
    );

    if (!this.languageGateActive) {
      PURCHASE_HOTKEYS.forEach((key, index) => {
        this.bindKeyboard(`keydown-${key}`, () => this.tryPurchase(index));
      });
      this.bindKeyboard("keydown-Q", () => this.selectDifficulty("normal"));
      this.bindKeyboard("keydown-W", () => this.selectDifficulty("hard"));
      this.bindKeyboard("keydown-E", () => this.selectDifficulty("nightmare"));
      this.bindKeyboard("keydown-ENTER", () => this.startRun());
      this.bindKeyboard("keydown-D", () => this.startDailyRun());
      this.bindKeyboard("keydown-C", () => this.continueRun());
      this.bindKeyboard("keydown-B", () => this.abandonRun());
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
          this.selectDifficulty(mode);
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
      const effectText = this.describeEffect(unlock);
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
          this.tryPurchase(index);
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

    startButton.on("pointerdown", () => this.startRun());

    PURCHASE_HOTKEYS.forEach((key, index) => {
      this.bindKeyboard(`keydown-${key}`, () => this.tryPurchase(index));
    });
    this.bindKeyboard("keydown-Q", () => this.selectDifficulty("normal"));
    this.bindKeyboard("keydown-W", () => this.selectDifficulty("hard"));
    this.bindKeyboard("keydown-E", () => this.selectDifficulty("nightmare"));
    this.bindKeyboard("keydown-ENTER", () => this.startRun());
    this.bindKeyboard("keydown-D", () => this.startDailyRun());
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

  private switchLocale(locale: LocaleCode): void {
    if (this.languageGateActive) {
      return;
    }
    if (this.meta.preferredLocale === locale && getLocale() === locale) {
      return;
    }
    setLocale(locale);
    this.meta = {
      ...this.meta,
      preferredLocale: locale
    };
    this.saveMeta(this.meta);
    this.scene.restart();
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

  private buildMenuView(): MetaMenuPanelView {
    const unlockGroups = new Map<number, MetaMenuPanelView["unlockGroups"][number]>();

    UNLOCK_DEFS.forEach((unlock, index) => {
      const unlocked = this.meta.unlocks.includes(unlock.id);
      const requirementReady = this.meta.cumulativeUnlockProgress >= unlock.cumulativeRequirement;
      const canAfford = this.meta.soulShards >= unlock.cost;
      const purchasable = !unlocked && requirementReady && canAfford;
      const statusText = unlocked
        ? t("ui.meta.status.unlocked")
        : !requirementReady
          ? t("ui.meta.status.need_progress", { progress: unlock.cumulativeRequirement })
          : !canAfford
            ? t("ui.meta.status.need_soul_shards")
            : t("ui.meta.status.available");

      const group = unlockGroups.get(unlock.tier) ?? {
        tier: unlock.tier,
        unlocks: []
      };
      group.unlocks.push({
        index,
        id: unlock.id,
        name: this.contentLocalizer.unlockName(unlock.id, unlock.name),
        description: this.contentLocalizer.unlockDescription(unlock.id, unlock.description),
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

    const talentGroups = new Map<MetaMenuPanelView["talentGroups"][number]["path"], MetaMenuPanelView["talentGroups"][number]>();
    TALENT_DEFS.forEach((talent) => {
      const rank = this.meta.talentPoints[talent.id] ?? 0;
      const purchasable = canPurchaseTalent(this.meta, talent as TalentNodeDef);
      const statusText =
        rank >= talent.maxRank
          ? t("ui.meta.status.max_rank")
          : purchasable
            ? t("ui.meta.status.available")
            : this.meta.soulShards < talent.cost
              ? t("ui.meta.status.need_soul_shards")
              : t("ui.meta.status.prerequisite_required");
      const group = talentGroups.get(talent.path) ?? {
        path: talent.path,
        label: talent.path,
        talents: []
      };
      group.talents.push({
        id: talent.id,
        name: this.contentLocalizer.talentName(talent.id, talent.name),
        description: this.contentLocalizer.talentDescription(talent.id, talent.description),
        path: talent.path,
        tier: talent.tier,
        rank,
        maxRank: talent.maxRank,
        cost: talent.cost,
        statusText,
        purchasable
      });
      talentGroups.set(talent.path, group);
    });

    const foundBlueprints = new Set(this.meta.blueprintFoundIds);
    const forgedBlueprints = new Set(this.meta.blueprintForgedIds);
    const blueprintGroups = new Map<
      MetaMenuPanelView["blueprintGroups"][number]["category"],
      MetaMenuPanelView["blueprintGroups"][number]
    >();
    for (const blueprint of BLUEPRINT_DEFS) {
      const isFound = foundBlueprints.has(blueprint.id);
      const isForged = forgedBlueprints.has(blueprint.id);
      const canForge = isFound && !isForged && this.meta.soulShards >= blueprint.forgeCost;
      const statusText = isForged
        ? t("ui.meta.status.forged")
        : isFound
          ? canForge
            ? t("ui.meta.status.ready_to_forge")
            : t("ui.meta.status.need_soul_shards")
          : t("ui.meta.status.undiscovered");
      const group = blueprintGroups.get(blueprint.category) ?? {
        category: blueprint.category,
        label: this.blueprintCategoryLabel(blueprint.category),
        blueprints: []
      };
      group.blueprints.push({
        id: blueprint.id,
        name: this.contentLocalizer.blueprintName(blueprint.id, blueprint.name),
        category: blueprint.category,
        rarity: blueprint.rarity,
        forgeCost: blueprint.forgeCost,
        unlockTargetId: blueprint.unlockTargetId,
        statusText,
        forged: isForged,
        canForge
      });
      blueprintGroups.set(blueprint.category, group);
    }

    const unlockedMutationIds = collectUnlockedMutationIds(this.meta, MUTATION_DEFS);
    const selectedMutationIds = [...this.meta.selectedMutationIds];
    const unlockedMutationSet = new Set(unlockedMutationIds);
    const mutationGroups = new Map<
      MutationDef["category"],
      MetaMenuPanelView["mutationGroups"][number]
    >();
    for (const mutation of MUTATION_DEFS) {
      const selected = selectedMutationIds.includes(mutation.id);
      const unlocked = unlockedMutationSet.has(mutation.id);
      let canToggle = selected;
      let canUnlockEcho = false;
      let statusText = selected ? t("ui.meta.status.selected") : t("ui.meta.status.locked");
      if (!selected && unlocked) {
        const validation = validateMutationSelection(
          [...selectedMutationIds, mutation.id],
          MUTATION_DEF_BY_ID,
          this.meta.mutationSlots,
          unlockedMutationIds
        );
        canToggle = validation.ok;
        statusText = validation.ok
          ? t("ui.meta.status.available")
          : this.describeMutationValidationError(validation.reason);
      } else if (!selected && !unlocked) {
        if (mutation.unlock.type === "echo") {
          canUnlockEcho = this.meta.echoes >= mutation.unlock.cost;
          statusText = canUnlockEcho
            ? t("ui.meta.status.cost_echoes", { cost: mutation.unlock.cost })
            : t("ui.meta.status.need_echoes", { cost: mutation.unlock.cost });
        } else if (mutation.unlock.type === "blueprint") {
          statusText = this.meta.blueprintForgedIds.includes(mutation.unlock.blueprintId)
            ? t("ui.meta.status.available_next_refresh")
            : t("ui.meta.status.need_blueprint", { blueprintId: mutation.unlock.blueprintId });
        }
      }
      const group = mutationGroups.get(mutation.category) ?? {
        category: mutation.category,
        label: this.mutationCategoryLabel(mutation.category),
        mutations: []
      };
      group.mutations.push({
        id: mutation.id,
        name: this.contentLocalizer.mutationName(mutation.id, mutation.name),
        category: mutation.category,
        tier: mutation.tier,
        unlockText: this.describeMutationUnlock(mutation),
        effectText: this.describeMutationEffects(mutation),
        statusText,
        selected,
        canToggle,
        canUnlockEcho
      });
      mutationGroups.set(mutation.category, group);
    }

    const difficulties = DIFFICULTY_ORDER.map((mode, index) => {
      const shortcut = index === 0 ? "Q" : index === 1 ? "W" : "E";
      return {
        mode,
        label: difficultyLabel(mode),
        shortcut,
        selected: this.meta.selectedDifficulty === mode,
        unlocked: isDifficultyUnlocked(this.meta, mode),
        requirement: this.difficultyRequirement(mode)
      };
    });
    const currentLocale = getLocale();

    return {
      locale: currentLocale,
      availableLocales: [
        {
          code: "en-US",
          label: t("ui.locale.english"),
          selected: currentLocale === "en-US"
        },
        {
          code: "zh-CN",
          label: t("ui.locale.zh_cn"),
          selected: currentLocale === "zh-CN"
        }
      ],
      soulShards: this.meta.soulShards,
      echoes: this.meta.echoes,
      unlockedCount: this.meta.unlocks.length,
      totalUnlocks: UNLOCK_DEFS.length,
      difficulties,
      runSave: this.describeRunSave(),
      daily: this.describeDailyChallenge(),
      talentGroups: [...talentGroups.values()].map((group) => ({
        ...group,
        talents: [...group.talents].sort((left, right) => left.tier - right.tier)
      })),
      unlockGroups: [...unlockGroups.values()].sort((left, right) => left.tier - right.tier),
      blueprintGroups: [...blueprintGroups.values()],
      mutationGroups: [...mutationGroups.values()].map((group) => ({
        ...group,
        mutations: [...group.mutations].sort((left, right) => left.tier - right.tier || left.name.localeCompare(right.name))
      })),
      mutationSlots: this.meta.mutationSlots,
      selectedMutations: this.meta.selectedMutationIds.length,
      startRunEnabled: this.runSave === null
    };
  }

  private blueprintCategoryLabel(category: MetaMenuPanelView["blueprintGroups"][number]["category"]): string {
    switch (category) {
      case "skill":
        return t("ui.meta.blueprint.category.skill");
      case "weapon":
        return t("ui.meta.blueprint.category.weapon");
      case "consumable":
        return t("ui.meta.blueprint.category.consumable");
      case "event":
        return t("ui.meta.blueprint.category.event");
      case "mutation":
        return t("ui.meta.blueprint.category.mutation");
      default:
        return category;
    }
  }

  private mutationCategoryLabel(category: MutationDef["category"]): string {
    switch (category) {
      case "offensive":
        return t("ui.meta.mutation.category.offensive");
      case "defensive":
        return t("ui.meta.mutation.category.defensive");
      case "utility":
        return t("ui.meta.mutation.category.utility");
      default:
        return category;
    }
  }

  private describeMutationUnlock(mutation: MutationDef): string {
    if (mutation.unlock.type === "default") {
      return t("ui.meta.mutation.unlock.default");
    }
    if (mutation.unlock.type === "blueprint") {
      return t("ui.meta.mutation.unlock.blueprint", {
        blueprintId: mutation.unlock.blueprintId
      });
    }
    return t("ui.meta.mutation.unlock.echo", {
      cost: mutation.unlock.cost
    });
  }

  private describeMutationEffects(mutation: MutationDef): string {
    return mutation.effects
      .map((effect) => {
        const key = MUTATION_EFFECT_LABEL_KEY[effect.type];
        return key === undefined ? effect.type.replaceAll("_", " ") : t(key);
      })
      .join(" + ");
  }

  private describeMutationValidationError(reason: string): string {
    if (reason.includes("slot limit")) {
      return t("ui.meta.status.slot_full");
    }
    if (reason.includes("conflict")) {
      return t("ui.meta.status.conflict_selected");
    }
    if (reason.includes("not unlocked")) {
      return t("ui.meta.status.not_unlocked");
    }
    return t("ui.meta.status.unavailable");
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

  private describeDailyChallenge(): MetaMenuPanelView["daily"] {
    const date = resolveDailyDate();
    const canScore = canStartDailyScoredAttempt(this.meta, date);
    return {
      date,
      mode: canScore ? "scored" : "practice",
      statusText: canScore
        ? t("ui.meta.daily.status.scored_available")
        : t("ui.meta.daily.status.practice_only")
    };
  }

  private describeRunSave(): MetaMenuPanelView["runSave"] {
    if (this.runSave === null) {
      return null;
    }
    const leaseBlocked = this.saveManager.hasForeignLease(this.runSave);
    const date = new Date(this.runSave.savedAtMs);
    const when = Number.isNaN(date.valueOf()) ? t("ui.meta.save.unknown_time") : date.toLocaleString(getLocale());
    return {
      canContinue: !leaseBlocked,
      canAbandon: !leaseBlocked,
      statusText: leaseBlocked ? t("ui.meta.save.active_in_another_tab") : t("ui.meta.save.ready_to_continue"),
      detailText: t("ui.meta.save.detail", {
        floor: this.runSave.run.currentFloor,
        difficulty: (this.runSave.run.difficulty ?? "normal").toUpperCase(),
        when
      })
    };
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

  private tryPurchase(index: number): void {
    if (this.languageGateActive) {
      return;
    }
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

  private tryForgeBlueprint(blueprintId: string): void {
    if (this.languageGateActive) {
      return;
    }
    const blueprint = BLUEPRINT_DEF_MAP[blueprintId];
    if (blueprint === undefined) {
      return;
    }
    const next = forgeBlueprint(this.meta, blueprint);
    if (next === this.meta) {
      return;
    }
    this.meta = normalizeMutationMetaState(next, MUTATION_DEFS);
    this.saveMeta(this.meta);
    this.scene.restart();
  }

  private tryUnlockEchoMutation(mutationId: string): void {
    if (this.languageGateActive) {
      return;
    }
    const mutation = MUTATION_DEF_BY_ID[mutationId];
    if (mutation === undefined) {
      return;
    }
    const result = unlockEchoMutation(this.meta, mutation);
    if (!result.ok) {
      return;
    }
    this.meta = normalizeMutationMetaState(result.meta, MUTATION_DEFS);
    this.saveMeta(this.meta);
    this.scene.restart();
  }

  private tryToggleMutationSelection(mutationId: string): void {
    if (this.languageGateActive) {
      return;
    }
    const mutation = MUTATION_DEF_BY_ID[mutationId];
    if (mutation === undefined) {
      return;
    }
    const unlockedMutationIds = collectUnlockedMutationIds(this.meta, MUTATION_DEFS);
    const currentlySelected = [...this.meta.selectedMutationIds];
    const nextSelection = currentlySelected.includes(mutationId)
      ? currentlySelected.filter((selectedId) => selectedId !== mutationId)
      : [...currentlySelected, mutationId];
    const validation = validateMutationSelection(
      nextSelection,
      MUTATION_DEF_BY_ID,
      this.meta.mutationSlots,
      unlockedMutationIds
    );
    if (!validation.ok) {
      return;
    }
    this.meta = normalizeMutationMetaState(
      {
        ...this.meta,
        selectedMutationIds: validation.selected
      },
      MUTATION_DEFS
    );
    this.saveMeta(this.meta);
    this.scene.restart();
  }

  private tryPurchaseTalent(talentId: string): void {
    if (this.languageGateActive) {
      return;
    }
    const talent = TALENT_DEFS.find((entry) => entry.id === talentId);
    if (talent === undefined) {
      return;
    }
    const next = purchaseTalent(this.meta, talent as TalentNodeDef);
    if (next === this.meta) {
      return;
    }
    this.meta = next;
    this.saveMeta(next);
    this.scene.restart();
  }

  private selectDifficulty(mode: DifficultyMode): void {
    if (this.languageGateActive) {
      return;
    }
    const next = setSelectedDifficulty(this.meta, mode);
    if (next === this.meta) {
      return;
    }
    this.meta = next;
    this.saveMeta(next);
    this.scene.restart();
  }

  private startRun(): void {
    if (this.languageGateActive) {
      return;
    }
    if (this.runSave !== null) {
      return;
    }
    const difficulty = resolveSelectedDifficulty(this.meta);
    playSceneTransition({
      title: t("ui.transition.enter_dungeon.title"),
      subtitle: t("ui.transition.enter_dungeon.subtitle", {
        difficulty: difficulty.toUpperCase()
      }),
      mode: "scene",
      durationMs: 620
    });
    this.hideDomMenu();
    this.scene.start("dungeon", {
      difficulty,
      runMode: "normal"
    });
  }

  private startDailyRun(): void {
    if (this.languageGateActive) {
      return;
    }
    if (this.runSave !== null) {
      return;
    }
    const dailyDate = resolveDailyDate();
    const runSeed = createDailySeed(dailyDate);
    const canScore = canStartDailyScoredAttempt(this.meta, dailyDate);
    playSceneTransition({
      title: t("ui.transition.daily.title"),
      subtitle: t("ui.transition.daily.subtitle", {
        date: dailyDate
      }),
      mode: "scene",
      durationMs: 620
    });
    this.hideDomMenu();
    this.scene.start("dungeon", {
      difficulty: "hard",
      runMode: "daily",
      dailyDate,
      dailyPractice: !canScore,
      runSeed
    });
  }

  private continueRun(): void {
    if (this.languageGateActive) {
      return;
    }
    const save = this.saveManager.readSave();
    if (save === null) {
      this.scene.restart();
      return;
    }
    const lease = this.saveManager.acquireLease(save);
    if (!lease.ok || lease.save === null) {
      this.scene.restart();
      return;
    }
    playSceneTransition({
      title: t("ui.transition.resume.title"),
      subtitle: t("ui.transition.resume.subtitle", {
        floor: lease.save.run.currentFloor,
        difficulty: lease.save.run.difficulty.toUpperCase()
      }),
      mode: "scene",
      durationMs: 620
    });
    this.hideDomMenu();
    this.scene.start("dungeon", {
      difficulty: lease.save.run.difficulty,
      resumeSave: lease.save,
      resumedFromSave: true
    });
  }

  private estimateAbandonNowMs(save: RunSaveDataV2): number {
    const inputs = save.run.replay?.inputs ?? [];
    let elapsedMs = 0;
    for (const input of inputs) {
      if (Number.isFinite(input.atMs) && input.atMs > elapsedMs) {
        elapsedMs = input.atMs;
      }
    }
    return save.run.startedAtMs + elapsedMs;
  }

  private abandonRun(): void {
    if (this.languageGateActive) {
      return;
    }
    const save = this.saveManager.readSave();
    if (save === null) {
      this.scene.restart();
      return;
    }
    if (this.saveManager.hasForeignLease(save)) {
      this.scene.restart();
      return;
    }
    if (this.saveManager.isRunSettled(save.runId)) {
      this.saveManager.deleteSave();
      this.scene.restart();
      return;
    }

    const failedRun = {
      ...save.run,
      isVictory: false
    };
    const { summary: baseSummary, meta: nextMeta } = endRun(
      failedRun,
      save.player,
      this.estimateAbandonNowMs(save),
      this.meta
    );
    const soulShards = calculateSoulShardReward(failedRun, false);
    const summary = {
      ...baseSummary,
      isVictory: false,
      soulShardsEarned: soulShards,
      obolsEarned: failedRun.runEconomy.obols
    };
    const mergedMeta = mergeFoundBlueprints(nextMeta, save.blueprintFoundIdsInRun ?? []);
    this.meta = normalizeMutationMetaState(applyRunSummaryToMeta(mergedMeta, summary), MUTATION_DEFS);
    if (this.saveMeta(this.meta)) {
      this.saveManager.markRunSettled(save.runId);
      this.saveManager.deleteSave();
    }
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

  private saveMeta(meta: MetaProgression): boolean {
    try {
      window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }

  private describeEffect(unlock: (typeof UNLOCK_DEFS)[number]): string {
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
}
