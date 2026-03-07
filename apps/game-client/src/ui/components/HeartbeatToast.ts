function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface HeartbeatToastView {
  title: string;
  detail: string;
  tone: "rare" | "build" | "boss" | "synergy" | "spike";
}

export function renderHeartbeatToast(view: HeartbeatToastView): string {
  return `
    <div class="heartbeat-toast-card ${view.tone}">
      <div class="heartbeat-toast-title">${escapeHtml(view.title)}</div>
      <div class="heartbeat-toast-detail">${escapeHtml(view.detail)}</div>
    </div>
  `;
}
