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
  type RunSaveDataV2,
  type TalentNodeDef,
  type DifficultyMode,
  type MetaProgression
} from "@blodex/core";
import { BLUEPRINT_DEF_MAP, BLUEPRINT_DEFS, MUTATION_DEFS, TALENT_DEFS, UNLOCK_DEFS } from "@blodex/content";
import { UI_POLISH_FLAGS } from "../config/uiFlags";
import { SaveManager } from "../systems/SaveManager";
import {
  bindMetaMenuPanelActions,
  renderMetaMenuPanel,
  type MetaMenuPanelView
} from "../ui/components/MetaMenuPanel";
import { playSceneTransition } from "../ui/SceneTransitionOverlay";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const PURCHASE_HOTKEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"];
const DIFFICULTY_ORDER: DifficultyMode[] = ["normal", "hard", "nightmare"];
const DIFFICULTY_LABEL: Record<DifficultyMode, string> = {
  normal: "Normal",
  hard: "Hard",
  nightmare: "Nightmare"
};
const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);

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
  private runSave: RunSaveDataV2 | null = null;
  private readonly saveManager = new SaveManager();
  private readonly unbindDomActions: Array<() => void> = [];
  private readonly keyboardBindings: Array<{ eventName: string; handler: () => void }> = [];
  private menuRoot: HTMLDivElement | null = null;

  constructor() {
    super("meta-menu");
  }

  create(): void {
    this.meta = this.loadMeta();
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
    this.bindKeyboard("keydown-D", () => this.startDailyRun());
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

    const talentGroups = new Map<MetaMenuPanelView["talentGroups"][number]["path"], MetaMenuPanelView["talentGroups"][number]>();
    TALENT_DEFS.forEach((talent) => {
      const rank = this.meta.talentPoints[talent.id] ?? 0;
      const purchasable = canPurchaseTalent(this.meta, talent as TalentNodeDef);
      const statusText =
        rank >= talent.maxRank
          ? "Max Rank"
          : purchasable
            ? "Available"
            : this.meta.soulShards < talent.cost
              ? "Need Soul Shards"
              : "Prerequisite Required";
      const group = talentGroups.get(talent.path) ?? {
        path: talent.path,
        label: talent.path,
        talents: []
      };
      group.talents.push({
        id: talent.id,
        name: talent.name,
        description: talent.description,
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
        ? "Forged"
        : isFound
          ? canForge
            ? "Ready to Forge"
            : "Need Soul Shards"
          : "Undiscovered";
      const group = blueprintGroups.get(blueprint.category) ?? {
        category: blueprint.category,
        label: this.blueprintCategoryLabel(blueprint.category),
        blueprints: []
      };
      group.blueprints.push({
        id: blueprint.id,
        name: blueprint.name,
        category: blueprint.category,
        rarity: blueprint.rarity,
        forgeCost: blueprint.forgeCost,
        unlockTargetId: blueprint.unlockTargetId,
        statusText,
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
      let statusText = selected ? "Selected" : "Locked";
      if (!selected && unlocked) {
        const validation = validateMutationSelection(
          [...selectedMutationIds, mutation.id],
          MUTATION_DEF_BY_ID,
          this.meta.mutationSlots,
          unlockedMutationIds
        );
        canToggle = validation.ok;
        statusText = validation.ok ? "Available" : this.describeMutationValidationError(validation.reason);
      } else if (!selected && !unlocked) {
        if (mutation.unlock.type === "echo") {
          canUnlockEcho = this.meta.echoes >= mutation.unlock.cost;
          statusText = canUnlockEcho
            ? `Cost ${mutation.unlock.cost} Echoes`
            : `Need ${mutation.unlock.cost} Echoes`;
        } else if (mutation.unlock.type === "blueprint") {
          statusText = this.meta.blueprintForgedIds.includes(mutation.unlock.blueprintId)
            ? "Available next refresh"
            : `Need ${mutation.unlock.blueprintId}`;
        }
      }
      const group = mutationGroups.get(mutation.category) ?? {
        category: mutation.category,
        label: this.mutationCategoryLabel(mutation.category),
        mutations: []
      };
      group.mutations.push({
        id: mutation.id,
        name: mutation.name,
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
        label: DIFFICULTY_LABEL[mode],
        shortcut,
        selected: this.meta.selectedDifficulty === mode,
        unlocked: isDifficultyUnlocked(this.meta, mode),
        requirement: this.difficultyRequirement(mode)
      };
    });

    return {
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
        return "Skill Blueprints";
      case "weapon":
        return "Weapon Blueprints";
      case "consumable":
        return "Consumable Blueprints";
      case "event":
        return "Event Blueprints";
      case "mutation":
        return "Mutation Blueprints";
      default:
        return category;
    }
  }

  private mutationCategoryLabel(category: MutationDef["category"]): string {
    switch (category) {
      case "offensive":
        return "Offensive";
      case "defensive":
        return "Defensive";
      case "utility":
        return "Utility";
      default:
        return category;
    }
  }

  private describeMutationUnlock(mutation: MutationDef): string {
    if (mutation.unlock.type === "default") {
      return "Default unlock";
    }
    if (mutation.unlock.type === "blueprint") {
      return `Forge ${mutation.unlock.blueprintId}`;
    }
    return `Echo unlock (${mutation.unlock.cost})`;
  }

  private describeMutationEffects(mutation: MutationDef): string {
    return mutation.effects
      .map((effect) => effect.type.replaceAll("_", " "))
      .join(" + ");
  }

  private describeMutationValidationError(reason: string): string {
    if (reason.includes("slot limit")) {
      return "Slot full";
    }
    if (reason.includes("conflict")) {
      return "Conflict with selected";
    }
    if (reason.includes("not unlocked")) {
      return "Not unlocked";
    }
    return "Unavailable";
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

  private describeDailyChallenge(): MetaMenuPanelView["daily"] {
    const date = resolveDailyDate();
    const canScore = canStartDailyScoredAttempt(this.meta, date);
    return {
      date,
      mode: canScore ? "scored" : "practice",
      statusText: canScore
        ? "Scored attempt available. Daily rewards can be claimed once."
        : "Scored attempt already consumed today. Practice only (no score/reward)."
    };
  }

  private describeRunSave(): MetaMenuPanelView["runSave"] {
    if (this.runSave === null) {
      return null;
    }
    const leaseBlocked = this.saveManager.hasForeignLease(this.runSave);
    const date = new Date(this.runSave.savedAtMs);
    const when = Number.isNaN(date.valueOf()) ? "Unknown time" : date.toLocaleString();
    return {
      canContinue: !leaseBlocked,
      canAbandon: !leaseBlocked,
      statusText: leaseBlocked ? "Run is active in another tab." : "Saved run ready to continue.",
      detailText: `Floor ${this.runSave.run.currentFloor} • ${(this.runSave.run.difficulty ?? "normal").toUpperCase()} • ${when}`
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
    const next = setSelectedDifficulty(this.meta, mode);
    if (next === this.meta) {
      return;
    }
    this.meta = next;
    this.saveMeta(next);
    this.scene.restart();
  }

  private startRun(): void {
    if (this.runSave !== null) {
      return;
    }
    const difficulty = resolveSelectedDifficulty(this.meta);
    playSceneTransition({
      title: "Enter the Dungeon",
      subtitle: `${difficulty.toUpperCase()} · Floor 1`,
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
    if (this.runSave !== null) {
      return;
    }
    const dailyDate = resolveDailyDate();
    const runSeed = createDailySeed(dailyDate);
    const canScore = canStartDailyScoredAttempt(this.meta, dailyDate);
    playSceneTransition({
      title: "Daily Challenge",
      subtitle: `${dailyDate} · HARD`,
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
      title: "Resume Expedition",
      subtitle: `Floor ${lease.save.run.currentFloor} · ${lease.save.run.difficulty.toUpperCase()}`,
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
