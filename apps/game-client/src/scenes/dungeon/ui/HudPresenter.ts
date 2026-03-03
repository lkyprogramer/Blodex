import { createUIStateSnapshot, type UIStateSnapshot, type UIStateView } from "../../../ui/state/UIStateAdapter";
import type { LogEntry } from "../../../ui/Hud";

export interface HudPresenterInput<TView extends UIStateView> {
  view: TView;
  logs: readonly LogEntry[];
  flags: {
    runEnded: boolean;
    eventPanelOpen: boolean;
    debugCheatsEnabled: boolean;
    timestampMs: number;
  };
}

export class HudPresenter {
  buildSnapshot<TView extends UIStateView>(input: HudPresenterInput<TView>): UIStateSnapshot<TView> {
    return createUIStateSnapshot(input.view, {
      logs: input.logs,
      flags: input.flags
    });
  }
}
