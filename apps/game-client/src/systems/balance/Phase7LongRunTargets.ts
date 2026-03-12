export interface Phase7LongRunEvidenceTarget {
  clearRateMax: number;
  avgFloorReachedMin: number;
  rareShareMax: number;
  avgRunDurationMsMax: number;
  pairSatisfaction56Min: number;
  pairSatisfaction78Min: number;
  finalFloorHpP50Max: number;
}

// 8.0C turns floor 7 into a prep window, so 7-8 evidence tracks "finale readiness"
// rather than the older expectation of two consecutive combat-heavy floors.
// 8.1 widens the late-game content pool with room templates, extra ranged families,
// and a second item/boss batch, so dedicated long-run evidence now uses the updated
// late-pair floor instead of the tighter 7.8B closure-era thresholds.
export const PHASE7_LONG_RUN_EVIDENCE_TARGETS: Record<string, Phase7LongRunEvidenceTarget> = {
  "longrun-normal-average": {
    clearRateMax: 1,
    avgFloorReachedMin: 7.5,
    rareShareMax: 0.35,
    avgRunDurationMsMax: 1_850_000,
    pairSatisfaction56Min: 0.58,
    pairSatisfaction78Min: 0.3,
    finalFloorHpP50Max: 0.97
  },
  "longrun-hard-average": {
    clearRateMax: 0.95,
    avgFloorReachedMin: 7.5,
    rareShareMax: 0.32,
    avgRunDurationMsMax: 1_950_000,
    pairSatisfaction56Min: 0.65,
    pairSatisfaction78Min: 0.16,
    finalFloorHpP50Max: 0.93
  },
  "longrun-nightmare-optimal": {
    clearRateMax: 0.8,
    avgFloorReachedMin: 6.25,
    rareShareMax: 0.3,
    avgRunDurationMsMax: 1_700_000,
    pairSatisfaction56Min: 0.41,
    pairSatisfaction78Min: 0.15,
    finalFloorHpP50Max: 0.945
  }
};
