export interface CombatIntentHost {
  path: Array<{ x: number; y: number }>;
  attackTargetId: string | null;
  manualMoveTarget: { x: number; y: number } | null;
  manualMoveTargetFailures: number;
  nextManualPathReplanAt?: number;
}

export function clearCombatIntent(host: CombatIntentHost): void {
  host.path = [];
  host.attackTargetId = null;
  host.manualMoveTarget = null;
  host.manualMoveTargetFailures = 0;
  if (host.nextManualPathReplanAt !== undefined) {
    host.nextManualPathReplanAt = 0;
  }
}
