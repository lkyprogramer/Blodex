export interface PowerSpikeRepresentativeSample {
  id: string;
  sourceKind: "item" | "build_threshold";
  candidateDefId?: string;
  compareDefId?: string;
  note: string;
}

export interface PowerSpikeThresholdSet {
  offensiveAccepted: number;
  defensiveAccepted: number;
  utilityAccepted: number;
  ttkAccepted: number;
  sustainAccepted: number;
  majorAnyAxis: number;
}

export interface BuildThresholdCalibrationSet {
  keyItemBonusPerItem: number;
  keyItemBonusCap: number;
  pivotBonusPerPivot: number;
  pivotBonusCap: number;
  offenseBase: number;
  defenseBase: number;
  utilityBase: number;
  sustainBase: number;
  ttkBase: number;
}

export interface PowerSpikeCalibrationAsset {
  id: string;
  version: number;
  baselineArtifactPath: string;
  rationale: string;
  thresholds: PowerSpikeThresholdSet;
  buildThreshold: BuildThresholdCalibrationSet;
  representativeSamples: readonly PowerSpikeRepresentativeSample[];
}

export const DEFAULT_POWER_SPIKE_CALIBRATION_ASSET: PowerSpikeCalibrationAsset = {
  id: "phase7-7.2-power-spike-v1",
  version: 1,
  baselineArtifactPath: "docs/plans/phase7/calibration/2026-03-08-phase7-7.2-spike-amplitude-calibration.md",
  rationale:
    "Phase 7.2 freezes item/build spike thresholds into an explicit calibration asset so the runtime, simulator, and evidence pack classify spikes against the same policy.",
  thresholds: {
    offensiveAccepted: 0.3,
    defensiveAccepted: 0.4,
    utilityAccepted: 0.35,
    ttkAccepted: 0.25,
    sustainAccepted: 0.35,
    majorAnyAxis: 0.5
  },
  buildThreshold: {
    keyItemBonusPerItem: 0.12,
    keyItemBonusCap: 0.24,
    pivotBonusPerPivot: 0.06,
    pivotBonusCap: 0.18,
    offenseBase: 0.32,
    defenseBase: 0.38,
    utilityBase: 0.32,
    sustainBase: 0.36,
    ttkBase: 0.28
  },
  representativeSamples: [
    {
      id: "rare-weapon-upgrade",
      sourceKind: "item",
      candidateDefId: "sanctified_greatsword",
      compareDefId: "rusted_sabre",
      note: "A rare weapon jump should register as an accepted major spike on the offense axis."
    },
    {
      id: "build-threshold-offense-pivot",
      sourceKind: "build_threshold",
      note: "An offense-tagged build threshold with one key item and one pivot should clear the accepted threshold."
    },
    {
      id: "boss-reward-sequential-medium-upgrade",
      sourceKind: "item",
      candidateDefId: "dusk_halberd",
      compareDefId: "sanctified_greatsword",
      note: "A medium follow-up reward after a major spike should no longer clear accepted thresholds when scored sequentially."
    }
  ]
};

export function getPowerSpikeCalibrationAsset(
  asset: PowerSpikeCalibrationAsset = DEFAULT_POWER_SPIKE_CALIBRATION_ASSET
): PowerSpikeCalibrationAsset {
  return {
    ...asset,
    thresholds: { ...asset.thresholds },
    buildThreshold: { ...asset.buildThreshold },
    representativeSamples: asset.representativeSamples.map((sample) => ({ ...sample }))
  };
}
