import type { DifficultyMode } from "@blodex/core";

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

export interface MetaMenuPanelView {
  soulShards: number;
  unlockedCount: number;
  totalUnlocks: number;
  difficulties: MetaMenuDifficultyView[];
  unlockGroups: MetaMenuUnlockGroupView[];
}

export interface MetaMenuPanelHandlers {
  onPurchase: (index: number) => void;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  onStartRun: () => void;
}

export function renderMetaMenuPanel(view: MetaMenuPanelView): string {
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
      <section class="meta-menu-section">
        <h2>Difficulty</h2>
        <div class="meta-difficulty-grid">${difficultyHtml}</div>
      </section>
      <section class="meta-menu-section">
        <h2>Unlock Tree</h2>
        <p class="meta-menu-hint">Hotkeys: unlocks 1-0, difficulty Q/W/E, start Enter.</p>
        ${unlockGroupsHtml}
      </section>
      <footer class="meta-menu-footer">
        <button class="meta-start-button" data-action="start">Start New Run</button>
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

  return unbindActions;
}

