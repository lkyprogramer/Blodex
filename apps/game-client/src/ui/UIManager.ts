import { Hud, type LogEntry } from "./Hud";
import type { UIStateSnapshot } from "./state/UIStateAdapter";
import {
  Minimap,
  type MinimapExplorationSnapshot,
  type MinimapFrame
} from "./components/Minimap";

export type UIRenderState = Parameters<Hud["render"]>[0];

type HudCtorArgs = ConstructorParameters<typeof Hud>;

export class UIManager {
  private readonly hud: Hud;
  private readonly minimap: Minimap;
  private lastSnapshot: UIStateSnapshot<UIRenderState> | null = null;

  constructor(...args: HudCtorArgs) {
    this.hud = new Hud(...args);
    this.minimap = new Minimap("#minimap");
  }

  render(state: UIRenderState): void {
    this.hud.render(state);
  }

  renderSnapshot(snapshot: UIStateSnapshot<UIRenderState>): void {
    this.lastSnapshot = snapshot;
    this.hud.render(snapshot.view);
  }

  appendLog(...args: Parameters<Hud["appendLog"]>): void {
    this.hud.appendLog(...args);
  }

  clearLogs(): void {
    this.hud.clearLogs();
  }

  getLogs(): readonly LogEntry[] {
    return this.hud.getLogEntries();
  }

  getLastSnapshot(): UIStateSnapshot<UIRenderState> | null {
    return this.lastSnapshot;
  }

  configureMinimap(layout: {
    width: number;
    height: number;
    walkable: boolean[][];
    layoutHash: string;
  }): void {
    this.minimap.configure(layout);
  }

  renderMinimap(frame: MinimapFrame): void {
    this.minimap.render(frame);
  }

  resetMinimap(): void {
    this.minimap.reset();
  }

  getMinimapSnapshot(): MinimapExplorationSnapshot | null {
    return this.minimap.snapshot();
  }

  restoreMinimap(snapshot: MinimapExplorationSnapshot): void {
    this.minimap.restore(snapshot);
  }

  showDeathOverlay(...args: Parameters<Hud["showDeathOverlay"]>): void {
    this.hud.showDeathOverlay(...args);
  }

  hideDeathOverlay(): void {
    this.hud.hideDeathOverlay();
  }

  showEventPanel(...args: Parameters<Hud["showEventPanel"]>): void {
    this.hud.showEventPanel(...args);
  }

  showEventDialog(...args: Parameters<Hud["showEventPanel"]>): void {
    this.hud.showEventPanel(...args);
  }

  showMerchantPanel(...args: Parameters<Hud["showMerchantPanel"]>): void {
    this.hud.showMerchantPanel(...args);
  }

  showMerchantDialog(...args: Parameters<Hud["showMerchantPanel"]>): void {
    this.hud.showMerchantPanel(...args);
  }

  hideEventPanel(): void {
    this.hud.hideEventPanel();
  }

  showSummary(...args: Parameters<Hud["showSummary"]>): void {
    this.hud.showSummary(...args);
  }

  clearSummary(): void {
    this.hud.clearSummary();
  }

  reset(): void {
    this.lastSnapshot = null;
    this.hud.reset();
    this.minimap.reset();
  }
}
