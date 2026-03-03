import {
  BIOME_MAP,
  BLUEPRINT_DEFS,
  ITEM_DEFS,
  MUTATION_DEFS,
  RANDOM_EVENT_DEFS,
  TALENT_DEFS,
  UNLOCK_DEFS,
  SKILL_DEFS
} from "@blodex/content";
import type { MessageCatalog } from "../types";
import {
  contentBiomeNameKey,
  contentBlueprintNameKey,
  contentEventChoiceDescriptionKey,
  contentEventChoiceNameKey,
  contentEventDescriptionKey,
  contentEventNameKey,
  contentItemNameKey,
  contentMutationNameKey,
  contentSkillDescriptionKey,
  contentSkillNameKey,
  contentTalentDescriptionKey,
  contentTalentNameKey,
  contentUnlockDescriptionKey,
  contentUnlockNameKey
} from "../content/contentKeys";

const UI_MESSAGES: Record<string, string> = {
  "ui.common.close": "Close",
  "ui.common.leave": "Leave",
  "ui.common.continue": "Continue",
  "ui.common.ready": "Ready",
  "ui.common.locked": "Locked",
  "ui.common.available": "Available",
  "ui.common.status": "Status",
  "ui.common.hotkey": "Hotkey",
  "ui.common.charges": "Charges",
  "ui.common.target": "Target",
  "ui.common.mode": "Mode",
  "ui.common.floor": "Floor",
  "ui.common.kills": "Kills",
  "ui.common.loot": "Loot",
  "ui.common.obol": "Obol",
  "ui.common.time": "Time",
  "ui.common.level": "Level",
  "ui.common.score": "Score",
  "ui.common.goal": "Goal",

  "ui.hud.meta.runs": "Runs",
  "ui.hud.meta.best_floor": "Best F",
  "ui.hud.meta.best_time": "Best T",
  "ui.hud.player.title": "Vanguard",
  "ui.hud.player.hp": "HP",
  "ui.hud.player.mana": "Mana",
  "ui.hud.player.xp": "XP",
  "ui.hud.player.level": "Lvl",
  "ui.hud.player.power": "Pow",
  "ui.hud.player.armor": "Arm",
  "ui.hud.run.title": "Run State",
  "ui.hud.run.floor": "Floor",
  "ui.hud.run.mode": "Mode",
  "ui.hud.run.biome": "Biome",
  "ui.hud.run.status": "Status",
  "ui.hud.run.kills": "Kills",
  "ui.hud.run.loot": "Loot",
  "ui.hud.run.obol": "Obol",
  "ui.hud.run.goal": "Goal",
  "ui.hud.run.status.dead": "Dead",
  "ui.hud.run.status.hunting": "Hunting",
  "ui.hud.run.goal.stairs_up": "Stairs up",
  "ui.hud.run.goal.hunt": "Hunt",
  "ui.hud.run.mode.daily": "DAILY",
  "ui.hud.run.mode.abyss_base": "ABYSS",
  "ui.hud.run.mode.abyss": "ABYSS {floor}",
  "ui.hud.run.mapping_hint": "Mapping scroll active: objective location revealed.",
  "ui.hud.run.critical_hint": "Critical HP: drink potion or disengage.",
  "ui.hud.death.title": "You Died",
  "ui.hud.death.subtitle": "The Abyss claims another run.",

  "ui.hud.inventory.title": "Inventory",
  "ui.hud.inventory.subhead": "Backpack ({count})",
  "ui.hud.inventory.empty": "No drops yet.",
  "ui.hud.inventory.equip": "Equip {item}",
  "ui.hud.inventory.unequip": "Unequip {slot}",
  "ui.hud.inventory.discard": "Discard {item}",
  "ui.hud.inventory.need_level": "Need level {level}",
  "ui.hud.inventory.need_level_short": "Lv{level}",
  "ui.hud.inventory.equip_lock_hint": "Need Lv{level}",
  "ui.hud.inventory.slot.weapon.short": "WPN",
  "ui.hud.inventory.slot.helm.short": "HELM",
  "ui.hud.inventory.slot.chest.short": "CHEST",
  "ui.hud.inventory.slot.boots.short": "BOOTS",
  "ui.hud.inventory.slot.ring.short": "RING",
  "ui.hud.inventory.slot.weapon.long": "Weapon",
  "ui.hud.inventory.slot.helm.long": "Helm",
  "ui.hud.inventory.slot.chest.long": "Chest",
  "ui.hud.inventory.slot.boots.long": "Boots",
  "ui.hud.inventory.slot.ring.long": "Ring",

  "ui.hud.log.title": "System Log",
  "ui.hud.log.empty": "No events yet.",
  "ui.hud.tooltip.consumable_default_name": "Consumable",
  "ui.hud.tooltip.skill_default_name": "Skill",
  "ui.hud.tooltip.hotkey": "Hotkey: {hotkey}",
  "ui.hud.tooltip.charges": "Charges: {charges}",
  "ui.hud.tooltip.status": "Status: {status}",
  "ui.hud.tooltip.mana_cost": "Mana Cost: {manaCost}",
  "ui.hud.tooltip.base_cd": "Base CD: {seconds}s",
  "ui.hud.tooltip.target": "Target: {target}",
  "ui.hud.tooltip.slot": "Slot: {slot}",
  "ui.hud.tooltip.req_level": "Req Lvl: {level}",
  "ui.hud.tooltip.not_enough_mana": "Not enough mana.",
  "ui.hud.tooltip.no_affixes": "No affixes",
  "ui.hud.tooltip.compare": "Compare: {name}",
  "ui.hud.tooltip.power_delta": "Power Δ {delta}",

  "ui.hud.cooldown.label": "Cooldown {seconds}s",
  "ui.hud.cooldown.ready": "Ready",

  "ui.hud.targeting.self": "Self",
  "ui.hud.targeting.nearest_enemy": "Nearest enemy",
  "ui.hud.targeting.nearest_enemy_range": "Nearest enemy ({range} range)",
  "ui.hud.targeting.around_you": "Around you",
  "ui.hud.targeting.around_you_radius": "Around you ({radius} radius)",
  "ui.hud.targeting.directional": "Directional",
  "ui.hud.targeting.directional_range": "Directional ({range} range)",
  "ui.hud.targeting.unknown": "-",

  "ui.skillbar.status.locked": "Locked",
  "ui.skillbar.status.ready": "Ready",
  "ui.skillbar.slot_status": "{charges} left · {cooldown}",
  "ui.skillbar.use_title": "Use {name}",
  "ui.skillbar.locked_slot_title": "Locked skill slot",
  "ui.skillbar.locked_slot_name": "Locked",
  "ui.skillbar.locked_slot_description": "Unlock more skill slots from meta progression.",

  "ui.summary.title.victory": "Run Victory",
  "ui.summary.title.defeat": "Run Defeat",
  "ui.summary.mode": "Mode",
  "ui.summary.floor": "Floor",
  "ui.summary.kills": "Kills",
  "ui.summary.loot": "Loot",
  "ui.summary.obol": "Obol",
  "ui.summary.soul": "Soul",
  "ui.summary.score": "Score",
  "ui.summary.time": "Time",
  "ui.summary.level": "Level",
  "ui.summary.soul_shards": "Soul Shards",
  "ui.summary.continue": "Continue",
  "ui.summary.mode.daily": "DAILY",

  "ui.event.close": "Close",
  "ui.event.leave": "Leave",
  "ui.event.merchant.title": "Wandering Merchant",
  "ui.event.merchant.subtitle": "Spend Obol to buy items for this run.",
  "ui.event.merchant.buy": "Buy ({price})",
  "ui.event.merchant.sold_out": "Sold out.",
  "ui.event.choice.unavailable": "Unavailable.",
  "ui.event.choice.need_cost": "Need {amount} {type}.",
  "ui.event.choice.invalid_cost": "invalid cost",
  "ui.event.choice.need_cost_short": "need {amount} {type}",

  "ui.meta.title": "Blodex Meta Progression",
  "ui.meta.resources.soul_shards": "Soul Shards: {value}",
  "ui.meta.resources.echoes": "Echoes: {value}",
  "ui.meta.resources.unlocks": "Unlocks: {count}/{total}",
  "ui.meta.nav.difficulty": "Difficulty",
  "ui.meta.nav.daily": "Daily",
  "ui.meta.nav.talents": "Talents",
  "ui.meta.nav.forge": "Soul Forge",
  "ui.meta.nav.mutations": "Mutations",
  "ui.meta.nav.legacy": "Legacy",
  "ui.meta.section.saved_run": "Saved Run",
  "ui.meta.action.continue_run": "Continue Run",
  "ui.meta.action.abandon_run": "Abandon Run",
  "ui.meta.action.start_run": "Start New Run",
  "ui.meta.action.start_daily": "Start Daily Challenge",
  "ui.meta.action.unlock": "Unlock",
  "ui.meta.section.difficulty": "Difficulty",
  "ui.meta.section.daily": "Daily Challenge",
  "ui.meta.section.talents": "Talent Tree",
  "ui.meta.section.forge": "Soul Forge",
  "ui.meta.section.mutations": "Mutation Loadout",
  "ui.meta.section.unlocks": "Legacy Unlocks",
  "ui.meta.daily.mode.scored": "Scored",
  "ui.meta.daily.mode.practice": "Practice",
  "ui.meta.talent.path.core": "Core",
  "ui.meta.talent.path.warrior": "Warrior",
  "ui.meta.talent.path.ranger": "Ranger",
  "ui.meta.talent.path.arcanist": "Arcanist",
  "ui.meta.talent.path.utility": "Utility",
  "ui.meta.talent.tier": "Tier {tier}",
  "ui.meta.talent.cost": "Cost {cost}",
  "ui.meta.talent.rank": "Rank {rank}/{maxRank}",
  "ui.meta.unlock.tier": "Tier {tier}",
  "ui.meta.blueprint.category.skill": "Skill Blueprints",
  "ui.meta.blueprint.category.weapon": "Weapon Blueprints",
  "ui.meta.blueprint.category.consumable": "Consumable Blueprints",
  "ui.meta.blueprint.category.event": "Event Blueprints",
  "ui.meta.blueprint.category.mutation": "Mutation Blueprints",
  "ui.meta.mutation.category.offensive": "Offensive Mutations",
  "ui.meta.mutation.category.defensive": "Defensive Mutations",
  "ui.meta.mutation.category.utility": "Utility Mutations",
  "ui.meta.mutation.tier": "T{tier}",
  "ui.meta.mutation.selected_count": "Selected {selected}/{slots}. Click card to toggle, unlock echo mutations with Unlock button.",
  "ui.meta.hint.hotkeys": "Hotkeys: unlocks 1-0, difficulty Q/W/E, start Enter, daily D.",
  "ui.meta.hint.talents": "Purchase talents to improve baseline stats and run economy.",
  "ui.meta.hint.forge": "Discover blueprints in runs, then forge discovered plans with Soul Shards.",

  "ui.meta.difficulty.selected": "Selected",
  "ui.meta.difficulty.available": "Available",
  "ui.meta.difficulty.locked": "Locked",
  "ui.meta.difficulty.normal": "Normal",
  "ui.meta.difficulty.hard": "Hard",
  "ui.meta.difficulty.nightmare": "Nightmare",

  "ui.meta.status.unlocked": "Unlocked",
  "ui.meta.status.available": "Available",
  "ui.meta.status.need_progress": "Need Progress {progress}",
  "ui.meta.status.need_soul_shards": "Need Soul Shards",
  "ui.meta.status.max_rank": "Max Rank",
  "ui.meta.status.prerequisite_required": "Prerequisite Required",
  "ui.meta.status.forged": "Forged",
  "ui.meta.status.ready_to_forge": "Ready to Forge",
  "ui.meta.status.undiscovered": "Undiscovered",
  "ui.meta.status.selected": "Selected",
  "ui.meta.status.locked": "Locked",
  "ui.meta.status.cost_echoes": "Cost {cost} Echoes",
  "ui.meta.status.need_echoes": "Need {cost} Echoes",
  "ui.meta.status.available_next_refresh": "Available next refresh",
  "ui.meta.status.need_blueprint": "Need {blueprintId}",
  "ui.meta.status.slot_full": "Slot full",
  "ui.meta.status.conflict_selected": "Conflict with selected",
  "ui.meta.status.not_unlocked": "Not unlocked",
  "ui.meta.status.unavailable": "Unavailable",

  "ui.meta.requirement.hard": "Clear 1 Normal run",
  "ui.meta.requirement.nightmare": "Clear 1 Hard run",
  "ui.meta.requirement.normal": "Always available",

  "ui.meta.daily.status.scored_available": "Scored attempt available. Daily rewards can be claimed once.",
  "ui.meta.daily.status.practice_only": "Scored attempt already consumed today. Practice only (no score/reward).",

  "ui.meta.save.unknown_time": "Unknown time",
  "ui.meta.save.active_in_another_tab": "Run is active in another tab.",
  "ui.meta.save.ready_to_continue": "Saved run ready to continue.",
  "ui.meta.save.detail": "Floor {floor} • {difficulty} • {when}",

  "ui.meta.effect.permanent": "Permanent: {key} +{value}",
  "ui.meta.effect.skill_unlock": "Skill unlock: {skillId}",
  "ui.meta.effect.affix_unlock": "Affix unlock: {affixId}",
  "ui.meta.effect.biome_unlock": "Biome unlock: {biomeId}",
  "ui.meta.effect.event_unlock": "Event unlock: {eventId}",
  "ui.meta.mutation.unlock.default": "Default unlock",
  "ui.meta.mutation.unlock.blueprint": "Forge {blueprintId}",
  "ui.meta.mutation.unlock.echo": "Echo unlock ({cost})",

  "ui.transition.enter_dungeon.title": "Enter the Dungeon",
  "ui.transition.enter_dungeon.subtitle": "{difficulty} · Floor 1",
  "ui.transition.daily.title": "Daily Challenge",
  "ui.transition.daily.subtitle": "{date} · HARD",
  "ui.transition.resume.title": "Resume Expedition",
  "ui.transition.resume.subtitle": "Floor {floor} · {difficulty}",
  "ui.transition.return_sanctum.title": "Return to Sanctum",
  "ui.transition.return_sanctum.subtitle": "Meta Progression",

  "ui.legacy.meta.click_unlock_hint": "Click an unlock to purchase. Hotkeys: unlocks 1-0, difficulty Q/W/E.",

  "log.debug.prefix": "[Debug] {message}",
  "log.run.resumed_saved": "Resumed saved run.",
  "log.system.feedback_degraded": "Feedback degraded for {type}; continuing run safely.",
  "log.item.equip_failed_missing": "Equip failed: item {itemId} not found in backpack.",
  "log.item.equip_failed_locked": "Cannot equip {itemName}: Need Lv{requiredLevel}, current Lv{currentLevel}.",
  "log.item.equip_failed_generic": "Equip failed: {itemName} could not be equipped.",
  "log.item.discard_failed_missing": "Discard failed: item {itemId} not found in backpack.",
  "log.item.discarded": "Discarded {itemName}.",
  "log.run.objective_mapped": "Objective mapped on HUD.",
  "log.run.daily_practice_switched": "Daily scored attempt already consumed today. Switched to Practice mode.",
  "log.run.daily_scored_unlocked": "Daily scored attempt unlocked."
};

function buildContentMessages(): Record<string, string> {
  const messages: Record<string, string> = {};

  for (const item of ITEM_DEFS) {
    messages[contentItemNameKey(item.id)] = item.name;
  }

  for (const skill of SKILL_DEFS) {
    messages[contentSkillNameKey(skill.id)] = skill.name;
    messages[contentSkillDescriptionKey(skill.id)] = skill.description;
  }

  for (const eventDef of RANDOM_EVENT_DEFS) {
    messages[contentEventNameKey(eventDef.id)] = eventDef.name;
    messages[contentEventDescriptionKey(eventDef.id)] = eventDef.description;
    for (const choice of eventDef.choices) {
      messages[contentEventChoiceNameKey(eventDef.id, choice.id)] = choice.name;
      messages[contentEventChoiceDescriptionKey(eventDef.id, choice.id)] = choice.description;
    }
  }

  for (const unlock of UNLOCK_DEFS) {
    messages[contentUnlockNameKey(unlock.id)] = unlock.name;
    messages[contentUnlockDescriptionKey(unlock.id)] = unlock.description;
  }

  for (const talent of TALENT_DEFS) {
    messages[contentTalentNameKey(talent.id)] = talent.name;
    messages[contentTalentDescriptionKey(talent.id)] = talent.description;
  }

  for (const blueprint of BLUEPRINT_DEFS) {
    messages[contentBlueprintNameKey(blueprint.id)] = blueprint.name;
  }

  for (const mutation of MUTATION_DEFS) {
    messages[contentMutationNameKey(mutation.id)] = mutation.name;
  }

  for (const biome of Object.values(BIOME_MAP)) {
    messages[contentBiomeNameKey(biome.id)] = biome.name;
  }

  return messages;
}

export const EN_US_CATALOG: MessageCatalog = {
  locale: "en-US",
  messages: {
    ...UI_MESSAGES,
    ...buildContentMessages()
  }
};
