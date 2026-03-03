import type { RunSummary } from "@blodex/core";
import { UI_POLISH_FLAGS } from "../../config/uiFlags";

function summaryModeLabel(summary: RunSummary): string {
  if (summary.runMode === "daily") {
    return "DAILY";
  }
  return (summary.difficulty ?? "normal").toUpperCase();
}

function renderLegacyRunSummary(summary: RunSummary): string {
  return `
    <h2>${summary.isVictory ? "Run Victory" : "Run Ended"}</h2>
    <div class="stat-line"><span>Mode</span><span>${summaryModeLabel(summary)}</span></div>
    <div class="stat-line"><span>Floor</span><span>${summary.floorReached}</span></div>
    <div class="stat-line"><span>Kills</span><span>${summary.kills}</span></div>
    <div class="stat-line"><span>Loot</span><span>${summary.lootCollected}</span></div>
    <div class="stat-line"><span>Obol</span><span>${summary.obolsEarned ?? 0}</span></div>
    <div class="stat-line"><span>Soul</span><span>${summary.soulShardsEarned ?? 0}</span></div>
    ${summary.score === undefined ? "" : `<div class="stat-line"><span>Score</span><span>${summary.score}</span></div>`}
    <div class="stat-line"><span>Time</span><span>${(summary.elapsedMs / 1000).toFixed(1)}s</span></div>
    <div class="stat-line"><span>Level</span><span>${summary.leveledTo}</span></div>
    <div class="summary-actions" style="margin-top: 10px;">
      <button id="new-run-button">Continue</button>
    </div>
  `;
}

export function renderRunSummaryScreen(summary: RunSummary): string {
  if (!UI_POLISH_FLAGS.runSummaryV2Enabled) {
    return renderLegacyRunSummary(summary);
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "Mode", value: summaryModeLabel(summary) },
    { label: "Floor", value: String(summary.floorReached) },
    { label: "Kills", value: String(summary.kills) },
    { label: "Loot", value: String(summary.lootCollected) },
    { label: "Obol", value: String(summary.obolsEarned ?? 0) },
    ...(summary.score === undefined ? [] : [{ label: "Score", value: String(summary.score) }]),
    { label: "Time", value: `${(summary.elapsedMs / 1000).toFixed(1)}s` },
    { label: "Level", value: String(summary.leveledTo) }
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
      <h2>${summary.isVictory ? "Run Victory" : "Run Ended"}</h2>
      <div class="summary-reward" style="--stagger-index:0;">
        <span>Soul Shards</span>
        <strong>+${summary.soulShardsEarned ?? 0}</strong>
      </div>
      <div class="summary-stats-grid">
        ${rowsHtml}
      </div>
      <div class="summary-actions">
        <button id="new-run-button">Continue</button>
      </div>
    </div>
  `;
}

export function bindRunSummaryActions(container: ParentNode, onContinue: () => void): void {
  container.querySelector<HTMLButtonElement>("#new-run-button")?.addEventListener("click", onContinue);
}
