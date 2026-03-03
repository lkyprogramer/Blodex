import type { BlueprintDef, DifficultyMode, MutationDef, TalentPath } from "@blodex/core";
import { t } from "../../i18n";
import type { LocaleCode } from "../../i18n/types";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface MetaMenuDifficultyView {
  mode: DifficultyMode;
  label: string;
  shortcut: string;
  selected: boolean;
  unlocked: boolean;
  requirement: string;
}

export interface MetaMenuRunSaveView {
  canContinue: boolean;
  canAbandon: boolean;
  statusText: string;
  detailText: string;
}

export interface MetaMenuDailyView {
  date: string;
  mode: "scored" | "practice";
  statusText: string;
}

export interface MetaMenuUnlockCardView {
  index: number;
  id: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  shortcut: string;
  effectText: string;
  statusText: string;
  unlocked: boolean;
  purchasable: boolean;
}

export interface MetaMenuUnlockGroupView {
  tier: number;
  unlocks: MetaMenuUnlockCardView[];
}

export interface MetaMenuTalentCardView {
  id: string;
  name: string;
  description: string;
  path: TalentPath;
  tier: number;
  rank: number;
  maxRank: number;
  cost: number;
  statusText: string;
  purchasable: boolean;
}

export interface MetaMenuTalentGroupView {
  path: TalentPath;
  label: string;
  talents: MetaMenuTalentCardView[];
}

export interface MetaMenuBlueprintCardView {
  id: string;
  name: string;
  category: BlueprintDef["category"];
  rarity: BlueprintDef["rarity"];
  forgeCost: number;
  unlockTargetId: string;
  statusText: string;
  forged: boolean;
  canForge: boolean;
}

export interface MetaMenuBlueprintGroupView {
  category: BlueprintDef["category"];
  label: string;
  blueprints: MetaMenuBlueprintCardView[];
}

export interface MetaMenuMutationCardView {
  id: string;
  name: string;
  category: MutationDef["category"];
  tier: MutationDef["tier"];
  unlockText: string;
  effectText: string;
  statusText: string;
  selected: boolean;
  canToggle: boolean;
  canUnlockEcho: boolean;
}

export interface MetaMenuMutationGroupView {
  category: MutationDef["category"];
  label: string;
  mutations: MetaMenuMutationCardView[];
}

export interface MetaMenuPanelView {
  locale: LocaleCode;
  availableLocales: Array<{
    code: LocaleCode;
    label: string;
    selected: boolean;
  }>;
  soulShards: number;
  echoes: number;
  unlockedCount: number;
  totalUnlocks: number;
  difficulties: MetaMenuDifficultyView[];
  runSave: MetaMenuRunSaveView | null;
  daily: MetaMenuDailyView;
  talentGroups: MetaMenuTalentGroupView[];
  unlockGroups: MetaMenuUnlockGroupView[];
  blueprintGroups: MetaMenuBlueprintGroupView[];
  mutationGroups: MetaMenuMutationGroupView[];
  mutationSlots: number;
  selectedMutations: number;
  startRunEnabled: boolean;
}

export interface MetaMenuPanelHandlers {
  onSetLocale: (locale: LocaleCode) => void;
  onPurchase: (index: number) => void;
  onPurchaseTalent: (talentId: string) => void;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  onForgeBlueprint: (blueprintId: string) => void;
  onUnlockMutation: (mutationId: string) => void;
  onToggleMutation: (mutationId: string) => void;
  onStartRun: () => void;
  onStartDaily: () => void;
  onContinueRun: () => void;
  onAbandonRun: () => void;
}

function pathLabel(path: TalentPath): string {
  switch (path) {
    case "core":
      return t("ui.meta.talent.path.core");
    case "warrior":
      return t("ui.meta.talent.path.warrior");
    case "ranger":
      return t("ui.meta.talent.path.ranger");
    case "arcanist":
      return t("ui.meta.talent.path.arcanist");
    case "utility":
      return t("ui.meta.talent.path.utility");
    default:
      return path;
  }
}

export function renderMetaMenuPanel(view: MetaMenuPanelView): string {
  const localeSwitcherHtml = view.availableLocales
    .map((entry) => {
      const classes = ["meta-locale-chip", entry.selected ? "selected" : ""]
        .filter((className) => className.length > 0)
        .join(" ");
      return `
        <button
          class="${classes}"
          data-action="set-locale"
          data-locale="${entry.code}"
          aria-pressed="${entry.selected ? "true" : "false"}"
        >
          ${escapeHtml(entry.label)}
        </button>
      `;
    })
    .join("");

  const resumeHtml =
    view.runSave === null
      ? ""
      : `
        <section class="meta-menu-section">
          <h2>${t("ui.meta.section.saved_run")}</h2>
          <div class="meta-resume-card ${view.runSave.canContinue ? "" : "blocked"}">
            <div class="meta-resume-status">${escapeHtml(view.runSave.statusText)}</div>
            <div class="meta-resume-detail">${escapeHtml(view.runSave.detailText)}</div>
            <div class="meta-resume-actions">
              <button data-action="continue" ${view.runSave.canContinue ? "" : "disabled"}>${t("ui.meta.action.continue_run")}</button>
              <button data-action="abandon" ${view.runSave.canAbandon ? "" : "disabled"}>${t("ui.meta.action.abandon_run")}</button>
            </div>
          </div>
        </section>
      `;

  const difficultyHtml = view.difficulties
    .map((entry) => {
      const status = entry.selected
        ? t("ui.meta.difficulty.selected")
        : entry.unlocked
          ? t("ui.meta.difficulty.available")
          : t("ui.meta.difficulty.locked");
      const classes = [
        "meta-difficulty-card",
        entry.selected ? "selected" : "",
        !entry.unlocked ? "locked" : ""
      ]
        .filter((className) => className.length > 0)
        .join(" ");
      return `
        <button
          class="${classes}"
          data-action="difficulty"
          data-mode="${entry.mode}"
          ${entry.unlocked ? "" : "disabled"}
          aria-pressed="${entry.selected ? "true" : "false"}"
        >
          <div class="meta-difficulty-row">
            <span class="meta-keycap">${escapeHtml(entry.shortcut)}</span>
            <span class="meta-difficulty-name">${escapeHtml(entry.label)}</span>
            <span class="meta-difficulty-status">${status}</span>
          </div>
          <div class="meta-difficulty-requirement">${escapeHtml(entry.requirement)}</div>
        </button>
      `;
    })
    .join("");

  const talentGroupsHtml = view.talentGroups
    .map((group) => {
      const cards = group.talents
        .map((talent) => {
          const classes = [
            "meta-talent-card",
            talent.rank >= talent.maxRank ? "unlocked" : "",
            talent.purchasable ? "available" : "",
            !talent.purchasable && talent.rank < talent.maxRank ? "locked" : ""
          ]
            .filter((className) => className.length > 0)
            .join(" ");
          return `
            <button
              class="${classes}"
              data-action="purchase-talent"
              data-talent-id="${escapeHtml(talent.id)}"
              ${talent.purchasable ? "" : "disabled"}
            >
              <div class="meta-unlock-head meta-talent-head">
                <span class="meta-unlock-name">${escapeHtml(talent.name)}</span>
                <span class="meta-talent-tier">${escapeHtml(t("ui.meta.talent.tier", { tier: talent.tier }))}</span>
              </div>
              <div class="meta-talent-meta">
                <span class="meta-unlock-cost">${escapeHtml(t("ui.meta.talent.cost", { cost: talent.cost }))}</span>
                <span class="meta-talent-rank">${escapeHtml(
                  t("ui.meta.talent.rank", {
                    rank: talent.rank,
                    maxRank: talent.maxRank
                  })
                )}</span>
              </div>
              <div class="meta-unlock-description">${escapeHtml(talent.description)}</div>
              <div class="meta-unlock-status">${escapeHtml(talent.statusText)}</div>
            </button>
          `;
        })
        .join("");

      return `
        <section class="meta-tier-group" data-path="${group.path}">
          <h3>${pathLabel(group.path)}</h3>
          <div class="meta-tier-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  const blueprintGroupsHtml = view.blueprintGroups
    .map((group) => {
      const cards = group.blueprints
        .map((blueprint) => {
          const classes = [
            "meta-blueprint-card",
            `rarity-${blueprint.rarity}`,
            blueprint.canForge ? "available" : "",
            blueprint.forged ? "unlocked" : "",
            !blueprint.canForge && !blueprint.forged ? "locked" : ""
          ]
            .filter((className) => className.length > 0)
            .join(" ");
          return `
            <button
              class="${classes}"
              data-action="forge-blueprint"
              data-blueprint-id="${escapeHtml(blueprint.id)}"
              ${blueprint.canForge ? "" : "disabled"}
            >
              <div class="meta-unlock-head">
                <span class="meta-unlock-name">${escapeHtml(blueprint.name)}</span>
                <span class="meta-unlock-cost">${blueprint.forgeCost}</span>
              </div>
              <div class="meta-unlock-description">${escapeHtml(blueprint.unlockTargetId)}</div>
              <div class="meta-unlock-effect">
                <span class="meta-rarity-chip rarity-${escapeHtml(blueprint.rarity)}">${escapeHtml(
                  blueprint.rarity.toUpperCase()
                )}</span>
              </div>
              <div class="meta-unlock-status">${escapeHtml(blueprint.statusText)}</div>
            </button>
          `;
        })
        .join("");
      return `
        <section class="meta-tier-group" data-blueprint-category="${group.category}">
          <h3>${escapeHtml(group.label)}</h3>
          <div class="meta-tier-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  const mutationGroupsHtml = view.mutationGroups
    .map((group) => {
      const cards = group.mutations
        .map((mutation) => {
          const classes = [
            "meta-mutation-card",
            mutation.selected ? "selected" : "",
            mutation.canToggle || mutation.canUnlockEcho ? "available" : "",
            !mutation.canToggle && !mutation.canUnlockEcho && !mutation.selected ? "locked" : ""
          ]
            .filter((className) => className.length > 0)
            .join(" ");
          const actionButton =
            mutation.canUnlockEcho
              ? `<button class="meta-inline-action" data-action="unlock-mutation" data-mutation-id="${escapeHtml(mutation.id)}">${t("ui.meta.action.unlock")}</button>`
              : "";
          return `
            <div class="meta-mutation-item">
              <button
                class="${classes}"
                data-action="toggle-mutation"
                data-mutation-id="${escapeHtml(mutation.id)}"
                ${mutation.canToggle ? "" : "disabled"}
                aria-pressed="${mutation.selected ? "true" : "false"}"
              >
                <div class="meta-unlock-head">
                  <span class="meta-unlock-name">${escapeHtml(mutation.name)}</span>
                  <span class="meta-unlock-cost">${escapeHtml(t("ui.meta.mutation.tier", { tier: mutation.tier }))}</span>
                </div>
                <div class="meta-unlock-description">${escapeHtml(mutation.unlockText)}</div>
                <div class="meta-unlock-effect">${escapeHtml(mutation.effectText)}</div>
                <div class="meta-unlock-status">${escapeHtml(mutation.statusText)}</div>
              </button>
              ${actionButton}
            </div>
          `;
        })
        .join("");
      return `
        <section class="meta-tier-group" data-mutation-category="${group.category}">
          <h3>${escapeHtml(group.label)}</h3>
          <div class="meta-tier-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  const unlockGroupsHtml = view.unlockGroups
    .map((group) => {
      const cards = group.unlocks
        .map((unlock) => {
          const classes = [
            "meta-unlock-card",
            unlock.unlocked ? "unlocked" : "",
            unlock.purchasable ? "available" : "",
            !unlock.unlocked && !unlock.purchasable ? "locked" : ""
          ]
            .filter((className) => className.length > 0)
            .join(" ");
          return `
            <button
              class="${classes}"
              data-action="purchase"
              data-index="${unlock.index}"
              ${unlock.purchasable ? "" : "disabled"}
            >
              <div class="meta-unlock-head">
                <span class="meta-keycap">${escapeHtml(unlock.shortcut)}</span>
                <span class="meta-unlock-name">${escapeHtml(unlock.name)}</span>
                <span class="meta-unlock-cost">${unlock.cost}</span>
              </div>
              <div class="meta-unlock-description">${escapeHtml(unlock.description)}</div>
              <div class="meta-unlock-effect">${escapeHtml(unlock.effectText)}</div>
              <div class="meta-unlock-status">${escapeHtml(unlock.statusText)}</div>
            </button>
          `;
        })
        .join("");
      return `
        <section class="meta-tier-group" data-tier="${group.tier}">
          <h3>${escapeHtml(t("ui.meta.unlock.tier", { tier: group.tier }))}</h3>
          <div class="meta-tier-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  return `
    <div class="meta-menu-shell">
      <header class="meta-menu-header">
        <div class="meta-menu-header-main">
          <h1>${t("ui.meta.title")}</h1>
          <div class="meta-locale-switcher" aria-label="${escapeHtml(t("ui.meta.language.aria_label"))}">
            <span>${escapeHtml(t("ui.meta.language.label"))}</span>
            <div class="meta-locale-switcher-options">${localeSwitcherHtml}</div>
          </div>
        </div>
        <div class="meta-menu-subhead">
          <span>${t("ui.meta.resources.soul_shards", { value: view.soulShards })}</span>
          <span>${t("ui.meta.resources.echoes", { value: view.echoes })}</span>
          <span>${t("ui.meta.resources.unlocks", { count: view.unlockedCount, total: view.totalUnlocks })}</span>
        </div>
      </header>
      <nav class="meta-menu-nav" aria-label="Meta sections">
        <button class="meta-nav-chip" data-action="jump-section" data-target="meta-section-difficulty">${t("ui.meta.nav.difficulty")}</button>
        <button class="meta-nav-chip" data-action="jump-section" data-target="meta-section-daily">${t("ui.meta.nav.daily")}</button>
        <button class="meta-nav-chip" data-action="jump-section" data-target="meta-section-talents">${t("ui.meta.nav.talents")}</button>
        <button class="meta-nav-chip" data-action="jump-section" data-target="meta-section-forge">${t("ui.meta.nav.forge")}</button>
        <button class="meta-nav-chip" data-action="jump-section" data-target="meta-section-mutations">${t("ui.meta.nav.mutations")}</button>
        <button class="meta-nav-chip" data-action="jump-section" data-target="meta-section-unlocks">${t("ui.meta.nav.legacy")}</button>
      </nav>
      ${resumeHtml}
      <section class="meta-menu-section" id="meta-section-difficulty">
        <h2>${t("ui.meta.section.difficulty")}</h2>
        <div class="meta-difficulty-grid">${difficultyHtml}</div>
      </section>
      <section class="meta-menu-section" id="meta-section-daily">
        <h2>${t("ui.meta.section.daily")}</h2>
        <p class="meta-menu-hint">${escapeHtml(view.daily.date)} • ${view.daily.mode === "scored" ? t("ui.meta.daily.mode.scored") : t("ui.meta.daily.mode.practice")}</p>
        <p class="meta-menu-hint">${escapeHtml(view.daily.statusText)}</p>
        <button class="meta-start-button" data-action="start-daily">${t("ui.meta.action.start_daily")}</button>
      </section>
      <section class="meta-menu-section" id="meta-section-talents">
        <h2>${t("ui.meta.section.talents")}</h2>
        <p class="meta-menu-hint">${t("ui.meta.hint.talents")}</p>
        ${talentGroupsHtml}
      </section>
      <section class="meta-menu-section" id="meta-section-forge">
        <h2>${t("ui.meta.section.forge")}</h2>
        <p class="meta-menu-hint">${t("ui.meta.hint.forge")}</p>
        ${blueprintGroupsHtml}
      </section>
      <section class="meta-menu-section" id="meta-section-mutations">
        <h2>${t("ui.meta.section.mutations")}</h2>
        <p class="meta-menu-hint">${t("ui.meta.mutation.selected_count", {
          selected: view.selectedMutations,
          slots: view.mutationSlots
        })}</p>
        ${mutationGroupsHtml}
      </section>
      <section class="meta-menu-section" id="meta-section-unlocks">
        <h2>${t("ui.meta.section.unlocks")}</h2>
        <p class="meta-menu-hint">${t("ui.meta.hint.hotkeys")}</p>
        ${unlockGroupsHtml}
      </section>
      <footer class="meta-menu-footer">
        <button class="meta-start-button" data-action="start" ${view.startRunEnabled ? "" : "disabled"}>${t("ui.meta.action.start_run")}</button>
      </footer>
    </div>
  `;
}

export function bindMetaMenuPanelActions(
  container: ParentNode,
  handlers: MetaMenuPanelHandlers
): Array<() => void> {
  const unbindActions: Array<() => void> = [];

  container.querySelectorAll<HTMLButtonElement>("button[data-action='set-locale']").forEach((button) => {
    const locale = button.dataset.locale as LocaleCode | undefined;
    if (locale === undefined) {
      return;
    }
    const onClick = () => handlers.onSetLocale(locale);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='purchase']").forEach((button) => {
    const onClick = () => {
      const index = Number.parseInt(button.dataset.index ?? "", 10);
      if (Number.isFinite(index)) {
        handlers.onPurchase(index);
      }
    };
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='purchase-talent']").forEach((button) => {
    const talentId = button.dataset.talentId;
    if (talentId === undefined) {
      return;
    }
    const onClick = () => handlers.onPurchaseTalent(talentId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='difficulty']").forEach((button) => {
    const mode = button.dataset.mode as DifficultyMode | undefined;
    if (mode === undefined) {
      return;
    }
    const onClick = () => handlers.onSelectDifficulty(mode);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='forge-blueprint']").forEach((button) => {
    const blueprintId = button.dataset.blueprintId;
    if (blueprintId === undefined) {
      return;
    }
    const onClick = () => handlers.onForgeBlueprint(blueprintId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='unlock-mutation']").forEach((button) => {
    const mutationId = button.dataset.mutationId;
    if (mutationId === undefined) {
      return;
    }
    const onClick = () => handlers.onUnlockMutation(mutationId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='toggle-mutation']").forEach((button) => {
    const mutationId = button.dataset.mutationId;
    if (mutationId === undefined) {
      return;
    }
    const onClick = () => handlers.onToggleMutation(mutationId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  const startButton = container.querySelector<HTMLButtonElement>("button[data-action='start']");
  if (startButton !== null) {
    const onClick = () => handlers.onStartRun();
    startButton.addEventListener("click", onClick);
    unbindActions.push(() => startButton.removeEventListener("click", onClick));
  }

  const startDailyButton = container.querySelector<HTMLButtonElement>("button[data-action='start-daily']");
  if (startDailyButton !== null) {
    const onClick = () => handlers.onStartDaily();
    startDailyButton.addEventListener("click", onClick);
    unbindActions.push(() => startDailyButton.removeEventListener("click", onClick));
  }

  const continueButton = container.querySelector<HTMLButtonElement>("button[data-action='continue']");
  if (continueButton !== null) {
    const onClick = () => handlers.onContinueRun();
    continueButton.addEventListener("click", onClick);
    unbindActions.push(() => continueButton.removeEventListener("click", onClick));
  }

  const abandonButton = container.querySelector<HTMLButtonElement>("button[data-action='abandon']");
  if (abandonButton !== null) {
    const onClick = () => handlers.onAbandonRun();
    abandonButton.addEventListener("click", onClick);
    unbindActions.push(() => abandonButton.removeEventListener("click", onClick));
  }

  container.querySelectorAll<HTMLButtonElement>("button[data-action='jump-section']").forEach((button) => {
    const targetId = button.dataset.target;
    if (targetId === undefined || targetId.length === 0) {
      return;
    }
    const onClick = () => {
      const target = container.querySelector<HTMLElement>(`#${targetId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  return unbindActions;
}
