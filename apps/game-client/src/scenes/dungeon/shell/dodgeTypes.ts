import type { DodgeDirectionSource, DodgeResult } from "@blodex/core";

export interface DodgeRuntimeState {
  readyAtMs: number;
  iframeUntilMs: number;
  autoTargetSuppressed: boolean;
  lastSuccessfulDodgeAtMs: number | null;
  lastMoveIntentDirection: { x: number; y: number } | null;
  lastFacingDirection: { x: number; y: number } | null;
  lastDodgeDirection: { x: number; y: number } | null;
  lastDodgeDirectionSource: DodgeDirectionSource | null;
  lastResult: DodgeResult | null;
}

export function createInitialDodgeRuntimeState(): DodgeRuntimeState {
  return {
    readyAtMs: 0,
    iframeUntilMs: 0,
    autoTargetSuppressed: false,
    lastSuccessfulDodgeAtMs: null,
    lastMoveIntentDirection: null,
    lastFacingDirection: { x: 1, y: 0 },
    lastDodgeDirection: null,
    lastDodgeDirectionSource: null,
    lastResult: null
  };
}
