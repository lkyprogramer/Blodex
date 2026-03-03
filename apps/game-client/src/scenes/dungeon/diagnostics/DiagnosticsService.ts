export class DiagnosticsService {
  private panelEl: HTMLDivElement | null = null;
  private nextRefreshAt = 0;

  init(enabled: boolean): void {
    this.panelEl = document.querySelector<HTMLDivElement>("#perf-panel");
    if (this.panelEl === null) {
      return;
    }
    if (!enabled) {
      this.panelEl.classList.add("hidden");
      this.panelEl.textContent = "";
      return;
    }
    this.panelEl.classList.remove("hidden");
    this.panelEl.classList.add("perf-panel");
    this.panelEl.textContent = "Diagnostics pending run bootstrap...";
    this.nextRefreshAt = 0;
  }

  render(enabled: boolean, nowMs: number, lines: string[]): void {
    if (!enabled || this.panelEl === null) {
      return;
    }
    if (nowMs < this.nextRefreshAt) {
      return;
    }
    this.nextRefreshAt = nowMs + 260;
    this.panelEl.textContent = lines.join("\n");
  }

  reset(): void {
    if (this.panelEl === null) {
      return;
    }
    this.panelEl.classList.add("hidden");
    this.panelEl.textContent = "";
  }
}
