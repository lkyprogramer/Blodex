import type { RunSummary } from "@blodex/core";

export function renderRunSummaryScreen(summary: RunSummary): string {
  return `
    <h2>${summary.isVictory ? "Run Victory" : "Run Ended"}</h2>
    <div class="stat-line"><span>Mode</span><span>${(summary.difficulty ?? "normal").toUpperCase()}</span></div>
    <div class="stat-line"><span>Floor</span><span>${summary.floorReached}</span></div>
    <div class="stat-line"><span>Kills</span><span>${summary.kills}</span></div>
    <div class="stat-line"><span>Loot</span><span>${summary.lootCollected}</span></div>
    <div class="stat-line"><span>Obol</span><span>${summary.obolsEarned ?? 0}</span></div>
    <div class="stat-line"><span>Soul</span><span>${summary.soulShardsEarned ?? 0}</span></div>
    <div class="stat-line"><span>Time</span><span>${(summary.elapsedMs / 1000).toFixed(1)}s</span></div>
    <div class="stat-line"><span>Level</span><span>${summary.leveledTo}</span></div>
    <div class="summary-actions" style="margin-top: 10px;">
      <button id="new-run-button">Continue</button>
    </div>
  `;
}

export function bindRunSummaryActions(container: ParentNode, onContinue: () => void): void {
  container.querySelector<HTMLButtonElement>("#new-run-button")?.addEventListener("click", onContinue);
}
