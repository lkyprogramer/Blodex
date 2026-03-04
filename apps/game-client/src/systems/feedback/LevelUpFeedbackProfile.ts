export interface LevelUpFeedbackProfile {
  flashColor: number;
  flashDurationMs: number;
  ringColor: number;
  floatingTextColor: string;
  floatingTextRise: number;
  floatingTextDurationMs: number;
  hudPulseDurationMs: number;
  sfxRate: number;
  sfxDetune: number;
  sfxVolumeMultiplier: number;
}

export const LEVEL_UP_FEEDBACK_PROFILE: LevelUpFeedbackProfile = {
  flashColor: 0xf2d68b,
  flashDurationMs: 120,
  ringColor: 0xf2d68b,
  floatingTextColor: "#ffe6a6",
  floatingTextRise: 44,
  floatingTextDurationMs: 760,
  hudPulseDurationMs: 1450,
  sfxRate: 1,
  sfxDetune: 0,
  sfxVolumeMultiplier: 1
};
