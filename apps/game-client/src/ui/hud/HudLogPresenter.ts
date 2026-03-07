import { t } from "../../i18n";

export interface HudLogRenderEntry {
  id: number;
  level: string;
  message: string;
  timestampMs: number;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRunTimestamp(timestampMs: number): string {
  const seconds = Math.max(0, timestampMs / 1000);
  return `T+${seconds.toFixed(1)}s`;
}

export function renderHudLogPanel(logEntries: readonly HudLogRenderEntry[]): string {
  const rows = [...logEntries]
    .reverse()
    .map(
      (entry) => `
        <div class="log-entry ${entry.level}" data-log-id="${entry.id}">
          <p class="log-message">${escapeHtml(entry.message)}</p>
          <small class="log-time">${formatRunTimestamp(entry.timestampMs)}</small>
        </div>
      `
    )
    .join("");
  return `
    <h2>${t("ui.hud.log.title")}</h2>
    <div class="log-list">
      ${rows || `<p class="log-empty">${escapeHtml(t("ui.hud.log.empty"))}</p>`}
    </div>
  `;
}
