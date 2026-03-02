import type { DifficultyMode, TalentPath } from "@blodex/core";

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

export interface MetaMenuPanelView {
  soulShards: number;
  unlockedCount: number;
  totalUnlocks: number;
  difficulties: MetaMenuDifficultyView[];
  runSave: MetaMenuRunSaveView | null;
  talentGroups: MetaMenuTalentGroupView[];
  unlockGroups: MetaMenuUnlockGroupView[];
  startRunEnabled: boolean;
}

export interface MetaMenuPanelHandlers {
  onPurchase: (index: number) => void;
  onPurchaseTalent: (talentId: string) => void;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  onStartRun: () => void;
  onContinueRun: () => void;
  onAbandonRun: () => void;
}

function pathLabel(path: TalentPath): string {
  switch (path) {
    case "core":
      return "Core";
    case "warrior":
      return "Warrior";
    case "ranger":
      return "Ranger";
    case "arcanist":
      return "Arcanist";
    case "utility":
      return "Utility";
    default:
      return path;
  }
}

export function renderMetaMenuPanel(view: MetaMenuPanelView): string {
  const resumeHtml =
    view.runSave === null
      ? ""
      : `
        <section class="meta-menu-section">
          <h2>Saved Run</h2>
          <div class="meta-resume-card ${view.runSave.canContinue ? "" : "blocked"}">
            <div class="meta-resume-status">${escapeHtml(view.runSave.statusText)}</div>
            <div class="meta-resume-detail">${escapeHtml(view.runSave.detailText)}</div>
            <div class="meta-resume-actions">
              <button data-action="continue" ${view.runSave.canContinue ? "" : "disabled"}>Continue Run</button>
              <button data-action="abandon" ${view.runSave.canAbandon ? "" : "disabled"}>Abandon Run</button>
            </div>
          </div>
        </section>
      `;

  const difficultyHtml = view.difficulties
    .map((entry) => {
      const status = entry.selected ? "Selected" : entry.unlocked ? "Available" : "Locked";
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
              <div class="meta-unlock-head">
                <span class="meta-unlock-name">${escapeHtml(talent.name)}</span>
                <span class="meta-unlock-cost">${talent.cost}</span>
              </div>
              <div class="meta-unlock-description">${escapeHtml(talent.description)}</div>
              <div class="meta-unlock-effect">Tier ${talent.tier} • Rank ${talent.rank}/${talent.maxRank}</div>
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
          <h3>Tier ${group.tier}</h3>
          <div class="meta-tier-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  return `
    <div class="meta-menu-shell">
      <header class="meta-menu-header">
        <h1>Blodex Meta Progression</h1>
        <div class="meta-menu-subhead">
          <span>Soul Shards: ${view.soulShards}</span>
          <span>Unlocks: ${view.unlockedCount}/${view.totalUnlocks}</span>
        </div>
      </header>
      ${resumeHtml}
      <section class="meta-menu-section">
        <h2>Difficulty</h2>
        <div class="meta-difficulty-grid">${difficultyHtml}</div>
      </section>
      <section class="meta-menu-section">
        <h2>Talent Tree</h2>
        <p class="meta-menu-hint">Purchase talents to improve baseline stats and run economy.</p>
        ${talentGroupsHtml}
      </section>
      <section class="meta-menu-section">
        <h2>Legacy Unlocks</h2>
        <p class="meta-menu-hint">Hotkeys: unlocks 1-0, difficulty Q/W/E, start Enter.</p>
        ${unlockGroupsHtml}
      </section>
      <footer class="meta-menu-footer">
        <button class="meta-start-button" data-action="start" ${view.startRunEnabled ? "" : "disabled"}>Start New Run</button>
      </footer>
    </div>
  `;
}

export function bindMetaMenuPanelActions(
  container: ParentNode,
  handlers: MetaMenuPanelHandlers
): Array<() => void> {
  const unbindActions: Array<() => void> = [];

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

  const startButton = container.querySelector<HTMLButtonElement>("button[data-action='start']");
  if (startButton !== null) {
    const onClick = () => handlers.onStartRun();
    startButton.addEventListener("click", onClick);
    unbindActions.push(() => startButton.removeEventListener("click", onClick));
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

  return unbindActions;
}
