import Phaser from "phaser";
import type { BiomeId, ConsumableId, HazardType, WeaponType } from "@blodex/core";
import type { FeedbackAction } from "./feedbackEventRouter";
import { LEVEL_UP_FEEDBACK_PROFILE } from "./feedback/LevelUpFeedbackProfile";
import { resolveWeaponFeedbackProfile } from "./feedback/WeaponFeedbackProfile";

const AUDIO_KEYS = [
  "sfx_combat_hit_01",
  "sfx_combat_death_01",
  "sfx_combat_crit_01",
  "sfx_boss_phase_change_01",
  "sfx_skill_cleave_01",
  "sfx_skill_shield_slam_01",
  "sfx_skill_quake_strike_01",
  "sfx_skill_execution_drive_01",
  "sfx_skill_shadow_step_01",
  "sfx_skill_blade_fan_01",
  "sfx_skill_mark_prey_01",
  "sfx_skill_venom_volley_01",
  "sfx_skill_wind_dash_01",
  "sfx_skill_blood_drain_01",
  "sfx_skill_frost_nova_01",
  "sfx_skill_chain_lightning_01",
  "sfx_skill_spirit_burst_01",
  "sfx_skill_rift_step_01",
  "sfx_skill_war_cry_01",
  "amb_biome_forgotten_catacombs_loop_01",
  "amb_biome_molten_caverns_loop_01",
  "amb_biome_frozen_halls_loop_01",
  "amb_biome_bone_throne_loop_01",
  "sfx_hazard_lava_trigger_01",
  "sfx_hazard_ice_trigger_01",
  "sfx_hazard_spike_trigger_01",
  "ui_event_mysterious_shrine_open_01",
  "ui_event_trapped_chest_open_01",
  "ui_event_wandering_merchant_open_01",
  "ui_event_cursed_altar_open_01",
  "ui_event_fallen_adventurer_open_01",
  "ui_event_unstable_portal_open_01",
  "ui_merchant_open_01",
  "ui_merchant_buy_01",
  "ui_merchant_fail_01",
  "sfx_consumable_health_potion_01",
  "sfx_consumable_mana_potion_01",
  "sfx_consumable_scroll_mapping_01",
  "ui_floor_enter_01",
  "ui_biome_enter_01",
  "ui_loot_rare_drop_01",
  "ui_build_formed_01",
  "ui_boss_reward_open_01",
  "ui_equipment_compare_open_01"
] as const;

type AudioKey = (typeof AUDIO_KEYS)[number];

const BIOME_AMBIENT_MAP: Record<BiomeId, AudioKey> = {
  forgotten_catacombs: "amb_biome_forgotten_catacombs_loop_01",
  molten_caverns: "amb_biome_molten_caverns_loop_01",
  frozen_halls: "amb_biome_frozen_halls_loop_01",
  phantom_graveyard: "amb_biome_frozen_halls_loop_01",
  venom_swamp: "amb_biome_molten_caverns_loop_01",
  bone_throne: "amb_biome_bone_throne_loop_01"
};

const SKILL_SFX_MAP: Record<string, AudioKey> = {
  cleave: "sfx_skill_cleave_01",
  shield_slam: "sfx_skill_shield_slam_01",
  quake_strike: "sfx_skill_quake_strike_01",
  execution_drive: "sfx_skill_execution_drive_01",
  shadow_step: "sfx_skill_shadow_step_01",
  blade_fan: "sfx_skill_blade_fan_01",
  mark_prey: "sfx_skill_mark_prey_01",
  venom_volley: "sfx_skill_venom_volley_01",
  wind_dash: "sfx_skill_wind_dash_01",
  blood_drain: "sfx_skill_blood_drain_01",
  frost_nova: "sfx_skill_frost_nova_01",
  chain_lightning: "sfx_skill_chain_lightning_01",
  spirit_burst: "sfx_skill_spirit_burst_01",
  rift_step: "sfx_skill_rift_step_01",
  war_cry: "sfx_skill_war_cry_01"
};

const CONSUMABLE_SFX_MAP: Record<ConsumableId, AudioKey> = {
  health_potion: "sfx_consumable_health_potion_01",
  mana_potion: "sfx_consumable_mana_potion_01",
  scroll_of_mapping: "sfx_consumable_scroll_mapping_01"
};

const HAZARD_SFX_MAP: Record<HazardType, AudioKey> = {
  damage_zone: "sfx_hazard_lava_trigger_01",
  movement_modifier: "sfx_hazard_ice_trigger_01",
  periodic_trap: "sfx_hazard_spike_trigger_01"
};

const EVENT_SFX_MAP: Record<string, AudioKey> = {
  mysterious_shrine: "ui_event_mysterious_shrine_open_01",
  trapped_chest: "ui_event_trapped_chest_open_01",
  wandering_merchant: "ui_event_wandering_merchant_open_01",
  cursed_altar: "ui_event_cursed_altar_open_01",
  fallen_adventurer: "ui_event_fallen_adventurer_open_01",
  unstable_portal: "ui_event_unstable_portal_open_01"
};

const VOLUME = {
  combat: 0.28,
  skill: 0.28,
  ui: 0.32,
  ambient: 0.18
} as const;

const THROTTLE_MS: Partial<Record<AudioKey, number>> = {
  sfx_combat_hit_01: 80,
  sfx_combat_crit_01: 110
};

export interface SFXDiagnostics {
  enabled: boolean;
  unlockedByGesture: boolean;
  ambientKey: AudioKey | null;
  ambientActive: boolean;
  trackedCooldownKeys: number;
}

export class SFXSystem {
  private readonly lastPlayedAt = new Map<AudioKey, number>();
  private ambientSound: Phaser.Sound.BaseSound | null = null;
  private ambientKey: AudioKey | null = null;
  private unlockedByGesture = false;
  private enabled = true;

  constructor(private readonly scene: Phaser.Scene) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAmbient();
    }
  }

  preload(): void {
    for (const key of AUDIO_KEYS) {
      if (this.scene.cache.audio.exists(key)) {
        continue;
      }
      this.scene.load.audio(key, `/audio/${key}.ogg`);
    }
  }

  initialize(): void {
    this.unlockedByGesture = !this.scene.sound.locked;
    const unlock = () => {
      this.unlockedByGesture = true;
      if (this.scene.sound.locked) {
        try {
          this.scene.sound.unlock();
        } catch {
          // Ignore browser unlock errors and gracefully keep silent.
        }
      }
    };

    this.scene.input.once("pointerdown", unlock);
    this.scene.input.keyboard?.once("keydown", unlock);
  }

  dispatch(action: FeedbackAction): void {
    if (action.channel !== "sfx") {
      return;
    }
    switch (action.cue) {
      case "combat_hit":
        this.playCombatHit(action.critical, action.weaponType);
        return;
      case "combat_dodge":
        // Dodge SFX placeholder for future asset expansion.
        return;
      case "combat_death":
        this.playCombatDeath();
        return;
      case "skill_use":
        this.playSkillUse(action.skillId);
        return;
      case "consumable_use":
        this.playConsumableUse(action.consumableId);
        return;
      case "event_spawn":
        this.playEventSpawn(action.eventId);
        return;
      case "merchant_offer":
        this.playMerchantOpen();
        return;
      case "merchant_purchase":
        this.playMerchantPurchase();
        return;
      case "merchant_fail":
        this.playMerchantFail();
        return;
      case "floor_enter":
        this.playFloorEnter();
        return;
      case "biome_enter":
        this.playBiomeEnter();
        return;
      case "ambient_biome":
        this.playAmbientForBiome(action.biomeId);
        return;
      case "boss_phase":
        this.playBossPhaseChange();
        return;
      case "hazard_trigger":
        this.playHazardTrigger(action.hazardType);
        return;
      case "level_up":
        this.playLevelUp(action.level);
        return;
      case "rare_drop":
        this.playRareDrop(action.rarity);
        return;
      case "build_formed":
        this.playBuildFormed();
        return;
      case "boss_reward":
        this.playBossReward();
        return;
      case "equipment_compare":
        this.playEquipmentCompare();
        return;
      case "synergy_activated":
        this.playBuildFormed();
        return;
      case "power_spike":
        this.playPowerSpike(action.major);
        return;
      default:
        return;
    }
  }

  playCombatHit(isCrit: boolean, weaponType?: WeaponType): void {
    const profile = resolveWeaponFeedbackProfile(weaponType);
    this.play(isCrit ? "sfx_combat_crit_01" : "sfx_combat_hit_01", VOLUME.combat * profile.sfxVolumeMultiplier, {
      rate: isCrit ? profile.sfxRate * 1.02 : profile.sfxRate,
      detune: isCrit ? profile.sfxDetune + 80 : profile.sfxDetune
    });
  }

  playCombatDeath(): void {
    this.play("sfx_combat_death_01", VOLUME.combat);
  }

  playBossPhaseChange(): void {
    this.play("sfx_boss_phase_change_01", VOLUME.combat);
  }

  playSkillUse(skillId: string): void {
    const key = SKILL_SFX_MAP[skillId];
    if (key !== undefined) {
      this.play(key, VOLUME.skill);
    }
  }

  playConsumableUse(consumableId: ConsumableId): void {
    this.play(CONSUMABLE_SFX_MAP[consumableId], VOLUME.ui);
  }

  playHazardTrigger(hazardType: HazardType): void {
    this.play(HAZARD_SFX_MAP[hazardType], VOLUME.combat);
  }

  playEventSpawn(eventId: string): void {
    const key = EVENT_SFX_MAP[eventId];
    if (key !== undefined) {
      this.play(key, VOLUME.ui);
    }
  }

  playMerchantOpen(): void {
    this.play("ui_merchant_open_01", VOLUME.ui);
  }

  playMerchantPurchase(): void {
    this.play("ui_merchant_buy_01", VOLUME.ui);
  }

  playMerchantFail(): void {
    this.play("ui_merchant_fail_01", VOLUME.ui);
  }

  playFloorEnter(): void {
    this.play("ui_floor_enter_01", VOLUME.ui);
  }

  playBiomeEnter(): void {
    this.play("ui_biome_enter_01", VOLUME.ui);
  }

  playLevelUp(level: number): void {
    const profile = LEVEL_UP_FEEDBACK_PROFILE;
    const detune = Math.min(260, Math.max(-260, profile.sfxDetune + level * 4));
    this.play("ui_biome_enter_01", VOLUME.ui * profile.sfxVolumeMultiplier, {
      rate: profile.sfxRate,
      detune
    });
  }

  playRareDrop(rarity: "rare" | "unique"): void {
    this.play("ui_loot_rare_drop_01", rarity === "unique" ? 0.42 : 0.36, {
      rate: rarity === "unique" ? 0.94 : 1
    });
  }

  playBuildFormed(): void {
    this.play("ui_build_formed_01", 0.34);
  }

  playBossReward(): void {
    this.play("ui_boss_reward_open_01", 0.38);
  }

  playEquipmentCompare(): void {
    this.play("ui_equipment_compare_open_01", 0.34);
  }

  playPowerSpike(major: boolean): void {
    this.play("ui_loot_rare_drop_01", major ? 0.38 : 0.28, {
      rate: major ? 0.96 : 1.06
    });
  }

  playAmbientForBiome(biomeId: BiomeId): void {
    const key = BIOME_AMBIENT_MAP[biomeId];
    if (this.ambientKey === key && this.ambientSound?.isPlaying) {
      return;
    }

    this.stopAmbient();
    if (!this.canPlay(key)) {
      return;
    }

    const ambient = this.scene.sound.add(key, {
      loop: true,
      volume: VOLUME.ambient
    });
    ambient.play();
    this.ambientSound = ambient;
    this.ambientKey = key;
  }

  stopAmbient(): void {
    if (this.ambientSound !== null) {
      this.ambientSound.stop();
      this.ambientSound.destroy();
    }
    this.ambientSound = null;
    this.ambientKey = null;
  }

  shutdown(): void {
    this.stopAmbient();
    this.lastPlayedAt.clear();
  }

  getDiagnostics(): SFXDiagnostics {
    return {
      enabled: this.enabled,
      unlockedByGesture: this.unlockedByGesture || !this.scene.sound.locked,
      ambientKey: this.ambientKey,
      ambientActive: this.ambientSound?.isPlaying ?? false,
      trackedCooldownKeys: this.lastPlayedAt.size
    };
  }

  private play(
    key: AudioKey,
    volume: number,
    options?: {
      rate?: number;
      detune?: number;
    }
  ): void {
    if (!this.enabled || !this.canPlay(key)) {
      return;
    }

    const now = performance.now();
    const throttleMs = THROTTLE_MS[key] ?? 0;
    const last = this.lastPlayedAt.get(key) ?? 0;
    if (throttleMs > 0 && now - last < throttleMs) {
      return;
    }

    this.lastPlayedAt.set(key, now);
    this.scene.sound.play(key, {
      volume,
      ...(options?.rate === undefined ? {} : { rate: options.rate }),
      ...(options?.detune === undefined ? {} : { detune: options.detune })
    });
  }

  private canPlay(key: AudioKey): boolean {
    if (!this.scene.cache.audio.exists(key)) {
      return false;
    }
    if (!this.scene.sound.locked) {
      return true;
    }
    return this.unlockedByGesture;
  }
}
