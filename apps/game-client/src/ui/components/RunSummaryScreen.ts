import type { RunSummary } from "@blodex/core";
import { t } from "../../i18n";

function summaryModeLabel(summary: RunSummary): string {
  if (summary.runMode === "daily") {
    return t("ui.summary.mode.daily");
  }
  return (summary.difficulty ?? "normal").toUpperCase();
}

export function renderRunSummaryScreen(summary: RunSummary): string {
  const rows: Array<{ label: string; value: string }> = [
    { label: t("ui.summary.mode"), value: summaryModeLabel(summary) },
    { label: t("ui.summary.floor"), value: String(summary.floorReached) },
    { label: t("ui.summary.kills"), value: String(summary.kills) },
    { label: t("ui.summary.loot"), value: String(summary.lootCollected) },
    { label: t("ui.summary.obol"), value: String(summary.obolsEarned ?? 0) },
    ...(summary.score === undefined ? [] : [{ label: t("ui.summary.score"), value: String(summary.score) }]),
    { label: t("ui.summary.time"), value: `${(summary.elapsedMs / 1000).toFixed(1)}s` },
    { label: t("ui.summary.level"), value: String(summary.leveledTo) }
  ];
  const rowsHtml = rows
    .map(
      (row, index) => `
        <div class="summary-stat-line" style="--stagger-index:${index};">
          <span>${row.label}</span>
          <span>${row.value}</span>
        </div>
      `
    )
    .join("");

  return `
    <div class="run-summary-card ${summary.isVictory ? "victory" : "defeat"}">
      <h2>${summary.isVictory ? t("ui.summary.title.victory") : t("ui.summary.title.defeat")}</h2>
      <div class="summary-reward" style="--stagger-index:0;">
        <span>${t("ui.summary.soul_shards")}</span>
        <strong>+${summary.soulShardsEarned ?? 0}</strong>
      </div>
      <div class="summary-stats-grid">
        ${rowsHtml}
      </div>
      <div class="summary-actions">
        <button id="new-run-button">${t("ui.summary.continue")}</button>
      </div>
    </div>
  `;
}

export function bindRunSummaryActions(container: ParentNode, onContinue: () => void): void {
  container.querySelector<HTMLButtonElement>("#new-run-button")?.addEventListener("click", onContinue);
}
