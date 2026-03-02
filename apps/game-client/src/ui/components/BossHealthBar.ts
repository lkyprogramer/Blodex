function clampToInt(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

export interface BossHealthBarView {
  isBossFloor?: boolean;
  bossHealth?: number;
  bossMaxHealth?: number;
  bossPhase?: number;
}

export function renderBossHealthBar(view: BossHealthBarView): string {
  if (!view.isBossFloor) {
    return "";
  }

  const health = clampToInt(view.bossHealth, 0);
  const maxHealth = Math.max(1, clampToInt(view.bossMaxHealth, 1));
  const phase = Math.max(1, (view.bossPhase ?? 0) + 1);
  const ratio = Math.max(0, Math.min(1, health / maxHealth));
  const pct = Math.floor(ratio * 100);

  return `
    <div class="boss-health-panel panel-block">
      <div class="boss-health-head">
        <span class="boss-health-title">Boss</span>
        <span class="boss-health-meta">Phase ${phase} · ${pct}%</span>
      </div>
      <div class="boss-health-track">
        <div class="boss-health-fill" style="width: ${pct}%;"></div>
      </div>
      <div class="boss-health-values">${health}/${maxHealth}</div>
    </div>
  `;
}
