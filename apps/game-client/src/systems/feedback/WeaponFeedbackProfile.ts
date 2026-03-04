import type { WeaponType } from "@blodex/core";

export interface WeaponFeedbackProfile {
  flashColor: number;
  floatingTextColor: string;
  floatingTextSize: number;
  floatingTextRise: number;
  hitOffset: number;
  sfxRate: number;
  sfxDetune: number;
  sfxVolumeMultiplier: number;
}

const DEFAULT_WEAPON_FEEDBACK_PROFILE: WeaponFeedbackProfile = {
  flashColor: 0xf0e7da,
  floatingTextColor: "#f0e7da",
  floatingTextSize: 12,
  floatingTextRise: 24,
  hitOffset: 3,
  sfxRate: 1,
  sfxDetune: 0,
  sfxVolumeMultiplier: 1
};

const WEAPON_FEEDBACK_PROFILES: Record<WeaponType, WeaponFeedbackProfile> = {
  sword: {
    flashColor: 0xf3ecd6,
    floatingTextColor: "#f3ecd6",
    floatingTextSize: 12,
    floatingTextRise: 24,
    hitOffset: 3,
    sfxRate: 1,
    sfxDetune: 0,
    sfxVolumeMultiplier: 1
  },
  axe: {
    flashColor: 0xf2d0b5,
    floatingTextColor: "#f2d0b5",
    floatingTextSize: 13,
    floatingTextRise: 25,
    hitOffset: 4,
    sfxRate: 0.94,
    sfxDetune: -220,
    sfxVolumeMultiplier: 1.08
  },
  dagger: {
    flashColor: 0xdff3ec,
    floatingTextColor: "#dff3ec",
    floatingTextSize: 11,
    floatingTextRise: 20,
    hitOffset: 2,
    sfxRate: 1.16,
    sfxDetune: 180,
    sfxVolumeMultiplier: 0.92
  },
  staff: {
    flashColor: 0xd8d9f6,
    floatingTextColor: "#d8d9f6",
    floatingTextSize: 12,
    floatingTextRise: 26,
    hitOffset: 3,
    sfxRate: 1.08,
    sfxDetune: 120,
    sfxVolumeMultiplier: 0.98
  },
  hammer: {
    flashColor: 0xffd7a0,
    floatingTextColor: "#ffd7a0",
    floatingTextSize: 14,
    floatingTextRise: 28,
    hitOffset: 5,
    sfxRate: 0.9,
    sfxDetune: -320,
    sfxVolumeMultiplier: 1.12
  },
  sword_master: {
    flashColor: 0xf7dfb2,
    floatingTextColor: "#f7dfb2",
    floatingTextSize: 13,
    floatingTextRise: 27,
    hitOffset: 4,
    sfxRate: 1.03,
    sfxDetune: 40,
    sfxVolumeMultiplier: 1.04
  }
};

export function resolveWeaponFeedbackProfile(
  weaponType: WeaponType | undefined
): WeaponFeedbackProfile {
  if (weaponType === undefined) {
    return DEFAULT_WEAPON_FEEDBACK_PROFILE;
  }
  return WEAPON_FEEDBACK_PROFILES[weaponType] ?? DEFAULT_WEAPON_FEEDBACK_PROFILE;
}
