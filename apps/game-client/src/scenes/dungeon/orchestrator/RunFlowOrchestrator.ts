export interface RunFlowFrameInput {
  runEnded: boolean;
  eventPanelOpen: boolean;
  nowMs: number;
  deltaMs: number;
  onEventPanelFrame: (nowMs: number) => void;
  onActiveFrame: (nowMs: number, deltaMs: number) => void;
}

export class RunFlowOrchestrator {
  update(input: RunFlowFrameInput): void {
    if (input.runEnded) {
      return;
    }
    if (input.eventPanelOpen) {
      input.onEventPanelFrame(input.nowMs);
      return;
    }
    input.onActiveFrame(input.nowMs, input.deltaMs);
  }
}
