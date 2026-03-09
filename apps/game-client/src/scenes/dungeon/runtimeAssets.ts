import type { ConsumableId } from "@blodex/core";

export const DUNGEON_IMAGE_ASSET_IDS = [
  "player_vanguard",
  "monster_melee_01",
  "monster_ranged_01",
  "monster_elite_01",
  "tile_floor_01",
  "biome_catacombs_tile_floor_01",
  "biome_molten_tile_floor_01",
  "biome_venom_tile_floor_01",
  "biome_frozen_tile_floor_01",
  "biome_bone_tile_floor_01",
  "item_weapon_01",
  "item_weapon_02",
  "item_weapon_03",
  "item_helm_01",
  "item_helm_02",
  "item_chest_01",
  "item_chest_02",
  "item_boots_01",
  "item_boots_02",
  "item_ring_01",
  "item_ring_02",
  "boss_bone_sovereign",
  "boss_cathedral_judge",
  "boss_ember_warden",
  "boss_ossuary_keeper",
  "boss_node_marker_01",
  "boss_telegraph_sigil_01",
  "boss_reward_badge_cathedral_judge",
  "boss_reward_badge_ember_warden",
  "boss_reward_badge_ossuary_keeper",
  "merchant_room_marker_01",
  "node_forge_marker_01",
  "node_gamble_marker_01",
  "node_challenge_marker_01",
  "node_branch_marker_01",
  "affix_badge_armored",
  "affix_badge_vampiric",
  "affix_badge_splitting",
  "affix_badge_frenzied",
  "affix_badge_hulking",
  "affix_badge_warded",
  "affix_badge_skirmisher",
  "affix_badge_manaburn",
  "telegraph_circle_red",
  "staircase_floor_exit",
  "skill_cleave",
  "skill_shadow_step",
  "skill_blood_drain",
  "skill_frost_nova",
  "skill_war_cry"
] as const;

export const DUNGEON_IMAGE_ASSET_KEY_SET = new Set<string>(DUNGEON_IMAGE_ASSET_IDS);

export const ENTITY_ASSET_KEYS_FOR_BACKGROUND_REMOVAL = [
  "player_vanguard",
  "monster_melee_01",
  "monster_ranged_01",
  "monster_elite_01",
  "boss_bone_sovereign",
  "boss_cathedral_judge",
  "boss_ember_warden",
  "boss_ossuary_keeper"
] as const;

export const CONSUMABLE_ICON_BY_ID: Record<ConsumableId, string> = {
  health_potion: "item_consumable_health_potion_01",
  mana_potion: "item_consumable_mana_potion_01",
  scroll_of_mapping: "item_consumable_scroll_mapping_01",
  scroll_of_mapping_plus: "item_consumable_scroll_mapping_plus_01",
  frenzy_tonic: "item_consumable_frenzy_tonic_01",
  phantom_brew: "item_consumable_phantom_brew_01"
};
