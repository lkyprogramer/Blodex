import { t } from "../../i18n";
import type { HudPersistentIndicator, HudStatusBuffEntry, HudStatusRailState } from "./HudStatusRailTypes";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRemainingMs(remainingMs: number): string {
  if (remainingMs >= 10_000) {
    return `${Math.ceil(remainingMs / 1000)}s`;
  }
  return `${(remainingMs / 1000).toFixed(1)}s`;
}

function renderBuffEntry(entry: HudStatusBuffEntry): string {
  return `
    <div class="status-chip ${entry.tone}" title="${escapeHtml(entry.label)} · ${formatRemainingMs(entry.remainingMs)}">
      <span class="status-chip-label">${escapeHtml(entry.shortLabel)}</span>
      <span class="status-chip-timer">${formatRemainingMs(entry.remainingMs)}</span>
    </div>
  `;
}

function renderIndicator(indicator: HudPersistentIndicator): string {
  return `
    <div class="status-indicator ${indicator.tone}" title="${escapeHtml(indicator.label)}">
      <span class="status-indicator-label">${escapeHtml(indicator.label)}</span>
      ${
        indicator.detail === undefined
          ? ""
          : `<span class="status-indicator-detail">${escapeHtml(indicator.detail)}</span>`
      }
    </div>
  `;
}

export function renderHudStatusRail(state: HudStatusRailState | undefined): string {
  if (state === undefined || (state.buffs.length === 0 && state.indicators.length === 0)) {
    return "";
  }

  return `
    <div class="status-rail-root">
      <div class="status-rail-panel">
        <div class="status-rail-head">${t("ui.hud.status.buffs")}</div>
        <div class="status-buff-list">
          ${state.buffs.map((entry) => renderBuffEntry(entry)).join("")}
          ${
            state.overflowCount <= 0
              ? ""
              : `<div class="status-chip overflow"><span class="status-chip-label">+${state.overflowCount}</span></div>`
          }
        </div>
      </div>
      <div class="status-rail-panel">
        <div class="status-rail-head">${t("ui.hud.status.build")}</div>
        <div class="status-build-list">
          ${
            state.indicators.length === 0
              ? `<div class="status-empty">${t("ui.hud.status.build_empty")}</div>`
              : state.indicators.map((indicator) => renderIndicator(indicator)).join("")
          }
        </div>
      </div>
    </div>
  `;
}
