function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderHudPanel(title: string, bodyHtml: string): string {
  return `
    <h2>${escapeHtml(title)}</h2>
    ${bodyHtml}
  `;
}
