function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface EquipmentComparePromptSummaryLine {
  label: string;
  symbol: string;
  tone: "positive" | "negative" | "neutral";
}

export interface EquipmentComparePromptAffixLine {
  label: string;
  value: string;
  delta?: string;
  tone: "positive" | "negative" | "neutral";
}

export interface EquipmentComparePromptView {
  itemId: string;
  title: string;
  subtitle: string;
  sourceLabel: string;
  candidateName: string;
  compareName?: string;
  rarityLabel: string;
  powerDeltaLabel: string;
  powerDeltaTone: "positive" | "negative" | "neutral";
  summaryLines: EquipmentComparePromptSummaryLine[];
  affixLines: EquipmentComparePromptAffixLine[];
  equipNowLabel: string;
  laterLabel: string;
  ignoreLabel: string;
}

export function renderEquipmentComparePrompt(view: EquipmentComparePromptView): string {
  const summaryHtml = view.summaryLines
    .map(
      (line) => `
        <div class="equipment-compare-summary-line">
          <span>${escapeHtml(line.label)}</span>
          <span class="equipment-compare-summary-value ${line.tone}">${escapeHtml(line.symbol)}</span>
        </div>
      `
    )
    .join("");
  const affixHtml = view.affixLines
    .map(
      (line) => `
        <div class="equipment-compare-affix-line">
          <span>${escapeHtml(line.label)}</span>
          <span class="equipment-compare-affix-value ${line.tone}">
            ${escapeHtml(line.value)}${line.delta === undefined ? "" : ` (${escapeHtml(line.delta)})`}
          </span>
        </div>
      `
    )
    .join("");

  return `
    <div class="dialog-card equipment-compare-card">
      <div class="equipment-compare-kicker">${escapeHtml(view.sourceLabel)}</div>
      <h2>${escapeHtml(view.title)}</h2>
      <p>${escapeHtml(view.subtitle)}</p>
      <div class="equipment-compare-meta">
        <span class="equipment-compare-rarity">${escapeHtml(view.rarityLabel)}</span>
        <span class="equipment-compare-power ${view.powerDeltaTone}">${escapeHtml(view.powerDeltaLabel)}</span>
      </div>
      <div class="equipment-compare-headline">
        <div>
          <div class="equipment-compare-name">${escapeHtml(view.candidateName)}</div>
          ${
            view.compareName === undefined
              ? ""
              : `<div class="equipment-compare-current">${escapeHtml(view.compareName)}</div>`
          }
        </div>
      </div>
      <div class="equipment-compare-summary">${summaryHtml}</div>
      <div class="equipment-compare-affixes">${affixHtml}</div>
      <div class="dialog-actions equipment-compare-actions">
        <button class="dialog-action" data-compare-action="equip" data-item-id="${escapeHtml(view.itemId)}">
          <span class="dialog-action-title">${escapeHtml(view.equipNowLabel)}</span>
        </button>
        <button class="dialog-action" data-compare-action="later">
          <span class="dialog-action-title">${escapeHtml(view.laterLabel)}</span>
        </button>
        <button class="dialog-action" data-compare-action="ignore">
          <span class="dialog-action-title">${escapeHtml(view.ignoreLabel)}</span>
        </button>
      </div>
    </div>
  `;
}

export function bindEquipmentComparePromptActions(
  container: ParentNode,
  onAction: (action: "equip" | "later" | "ignore", itemId?: string) => void
): void {
  container.querySelectorAll<HTMLButtonElement>("button[data-compare-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.compareAction;
      if (action !== "equip" && action !== "later" && action !== "ignore") {
        return;
      }
      onAction(action, button.dataset.itemId);
    });
  });
}
