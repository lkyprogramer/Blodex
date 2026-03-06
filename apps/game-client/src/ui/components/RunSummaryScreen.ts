import type { RunSummary } from "@blodex/core";
import { t } from "../../i18n";
import type { RunOutcomeAnalysis } from "../../scenes/dungeon/taste/RunOutcomeAnalyzer";

function summaryModeLabel(summary: RunSummary): string {
  if (summary.runMode === "daily") {
    return t("ui.summary.mode.daily");
  }
  return (summary.difficulty ?? "normal").toUpperCase();
}

export function renderRunSummaryScreen(summary: RunSummary, analysis?: RunOutcomeAnalysis): string {
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
  const analysisHtml =
    analysis === undefined
      ? ""
      : `
        <div class="summary-analysis">
          <div class="summary-analysis-block">
            <span class="summary-analysis-label">${t("ui.summary.failure")}</span>
            <strong>${analysis.failureHeadline}</strong>
          </div>
          <div class="summary-analysis-block">
            <span class="summary-analysis-label">${t("ui.summary.missed")}</span>
            <ul class="summary-analysis-list">
              ${analysis.missedOpportunities.map((entry) => `<li>${entry}</li>`).join("")}
            </ul>
          </div>
          <div class="summary-analysis-block">
            <span class="summary-analysis-label">${t("ui.summary.next_run")}</span>
            <div class="summary-plan-grid">
              ${analysis.suggestions
                .map(
                  (suggestion, index) => `
                    <div class="summary-plan-card ${suggestion.lane}">
                      <span class="summary-plan-tag">${index === 0 ? t("ui.summary.plan_a") : t("ui.summary.plan_b")}</span>
                      <strong>${suggestion.title}</strong>
                      <p>${suggestion.reason}</p>
                      <p>${suggestion.action}</p>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      `;

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
      ${analysisHtml}
      <div class="summary-actions">
        <button id="new-run-button">${t("ui.summary.continue")}</button>
      </div>
    </div>
  `;
}

export function bindRunSummaryActions(container: ParentNode, onContinue: () => void): void {
  container.querySelector<HTMLButtonElement>("#new-run-button")?.addEventListener("click", onContinue);
}
