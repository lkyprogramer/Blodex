import Phaser from "phaser";
import type { BiomeId, ConsumableId, HazardType } from "@blodex/core";
import type { FeedbackAction } from "./feedbackEventRouter";

const AUDIO_KEYS = [
  "sfx_combat_hit_01",
  "sfx_combat_death_01",
  "sfx_combat_crit_01",
  "sfx_boss_phase_change_01",
  "sfx_skill_cleave_01",
  "sfx_skill_shadow_step_01",
  "sfx_skill_blood_drain_01",
  "sfx_skill_frost_nova_01",
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
  "ui_biome_enter_01"
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
  shadow_step: "sfx_skill_shadow_step_01",
  blood_drain: "sfx_skill_blood_drain_01",
  frost_nova: "sfx_skill_frost_nova_01",
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
        this.playCombatHit(action.critical);
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
      default:
        return;
    }
  }

  playCombatHit(isCrit: boolean): void {
    this.play(isCrit ? "sfx_combat_crit_01" : "sfx_combat_hit_01", VOLUME.combat);
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

  private play(key: AudioKey, volume: number): void {
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
    this.scene.sound.play(key, { volume });
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
