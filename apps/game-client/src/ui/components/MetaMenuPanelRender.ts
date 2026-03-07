import { t } from "../../i18n";
import type {
  MetaMenuBlueprintGroupView,
  MetaMenuMutationGroupView,
  MetaMenuPanelView,
  MetaMenuTalentGroupView,
  MetaMenuUnlockGroupView
} from "./MetaMenuPanel";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pathLabel(path: MetaMenuTalentGroupView["path"]): string {
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

function renderTalentGroups(talentGroups: MetaMenuTalentGroupView[]): string {
  return talentGroups
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
}

function renderBlueprintGroups(blueprintGroups: MetaMenuBlueprintGroupView[]): string {
  return blueprintGroups
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
              <div class="meta-unlock-description">${escapeHtml(blueprint.detailText)}</div>
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
}

function renderMutationGroups(mutationGroups: MetaMenuMutationGroupView[]): string {
  return mutationGroups
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
}

function renderUnlockGroups(unlockGroups: MetaMenuUnlockGroupView[]): string {
  return unlockGroups
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
        ${renderTalentGroups(view.talentGroups)}
      </section>
      <section class="meta-menu-section" id="meta-section-forge">
        <h2>${t("ui.meta.section.forge")}</h2>
        <p class="meta-menu-hint">${t("ui.meta.hint.forge")}</p>
        ${renderBlueprintGroups(view.blueprintGroups)}
      </section>
      <section class="meta-menu-section" id="meta-section-mutations">
        <h2>${t("ui.meta.section.mutations")}</h2>
        <p class="meta-menu-hint">${t("ui.meta.mutation.selected_count", {
          selected: view.selectedMutations,
          slots: view.mutationSlots
        })}</p>
        ${renderMutationGroups(view.mutationGroups)}
      </section>
      <section class="meta-menu-section" id="meta-section-unlocks">
        <h2>${t("ui.meta.section.unlocks")}</h2>
        <p class="meta-menu-hint">${t("ui.meta.hint.hotkeys")}</p>
        ${renderUnlockGroups(view.unlockGroups)}
      </section>
      <footer class="meta-menu-footer">
        <button class="meta-start-button" data-action="start" ${view.startRunEnabled ? "" : "disabled"}>${t("ui.meta.action.start_run")}</button>
      </footer>
    </div>
  `;
}
