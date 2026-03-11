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
export const PHASE7_LONG_RUN_EVIDENCE_TARGETS: Record<string, Phase7LongRunEvidenceTarget> = {
  "longrun-normal-average": {
    clearRateMax: 1,
    avgFloorReachedMin: 7.5,
    rareShareMax: 0.35,
    avgRunDurationMsMax: 1_850_000,
    pairSatisfaction56Min: 0.65,
    pairSatisfaction78Min: 0.3,
    finalFloorHpP50Max: 0.97
  },
  "longrun-hard-average": {
    clearRateMax: 0.95,
    avgFloorReachedMin: 7.5,
    rareShareMax: 0.32,
    avgRunDurationMsMax: 1_950_000,
    pairSatisfaction56Min: 0.65,
    pairSatisfaction78Min: 0.3,
    finalFloorHpP50Max: 0.93
  },
  "longrun-nightmare-optimal": {
    clearRateMax: 0.85,
    avgFloorReachedMin: 6.5,
    rareShareMax: 0.3,
    avgRunDurationMsMax: 1_700_000,
    pairSatisfaction56Min: 0.5,
    pairSatisfaction78Min: 0.2,
    finalFloorHpP50Max: 0.97
  }
};
