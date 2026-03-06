import type { ConsumableId, DifficultyMode } from "@blodex/core";
import { t } from ".";

type LevelUpStat = "strength" | "dexterity" | "vitality" | "intelligence";

export function difficultyLabel(difficulty: DifficultyMode | string): string {
  switch (difficulty) {
    case "normal":
      return t("ui.meta.difficulty.normal");
    case "hard":
      return t("ui.meta.difficulty.hard");
    case "nightmare":
      return t("ui.meta.difficulty.nightmare");
    default:
      return difficulty.toUpperCase();
  }
}

export function equipmentSlotLabel(slot: string): string {
  switch (slot) {
    case "weapon":
      return t("ui.hud.inventory.slot.weapon.long");
    case "helm":
      return t("ui.hud.inventory.slot.helm.long");
    case "chest":
      return t("ui.hud.inventory.slot.chest.long");
    case "boots":
      return t("ui.hud.inventory.slot.boots.long");
    case "ring":
      return t("ui.hud.inventory.slot.ring.long");
    default:
      return slot;
  }
}

export function hazardTypeLabel(hazardType: string): string {
  switch (hazardType) {
    case "damage_zone":
      return t("log.hazard.type.damage_zone");
    case "movement_modifier":
      return t("log.hazard.type.movement_modifier");
    case "periodic_trap":
      return t("log.hazard.type.periodic_trap");
    default:
      return hazardType;
  }
}

export function consumableFailureReasonLabel(reason: string): string {
  if (reason === "No charges left.") {
    return t("log.consumable.reason.no_charges");
  }
  if (reason === "HP already full.") {
    return t("log.consumable.reason.hp_full");
  }
  if (reason === "Mana already full.") {
    return t("log.consumable.reason.mana_full");
  }
  const cooldownMatch = /^Cooldown ([0-9]+(?:\.[0-9]+)?)s\.$/.exec(reason);
  if (cooldownMatch?.[1] !== undefined) {
    return t("log.consumable.reason.cooldown", {
      seconds: cooldownMatch[1]
    });
  }
  return reason;
}

export function consumableNameLabel(consumableId: ConsumableId, fallback?: string): string {
  switch (consumableId) {
    case "health_potion":
      return t("ui.consumable.health_potion.name");
    case "mana_potion":
      return t("ui.consumable.mana_potion.name");
    case "scroll_of_mapping":
      return t("ui.consumable.scroll_of_mapping.name");
    default:
      return fallback ?? consumableId;
  }
}

export function consumableDescriptionLabel(consumableId: ConsumableId, fallback?: string): string {
  switch (consumableId) {
    case "health_potion":
      return t("ui.consumable.health_potion.description");
    case "mana_potion":
      return t("ui.consumable.mana_potion.description");
    case "scroll_of_mapping":
      return t("ui.consumable.scroll_of_mapping.description");
    default:
      return fallback ?? consumableId;
  }
}

export function levelUpDialogTitle(): string {
  return t("ui.progression.levelup.title");
}

export function levelUpDialogDescription(pendingPoints: number): string {
  return t("ui.progression.levelup.description", {
    pendingPoints
  });
}

export function levelUpStatChoiceLabel(stat: LevelUpStat): { name: string; description: string } {
  switch (stat) {
    case "strength":
      return {
        name: t("ui.progression.levelup.choice.strength.name"),
        description: t("ui.progression.levelup.choice.strength.description")
      };
    case "dexterity":
      return {
        name: t("ui.progression.levelup.choice.dexterity.name"),
        description: t("ui.progression.levelup.choice.dexterity.description")
      };
    case "vitality":
      return {
        name: t("ui.progression.levelup.choice.vitality.name"),
        description: t("ui.progression.levelup.choice.vitality.description")
      };
    case "intelligence":
      return {
        name: t("ui.progression.levelup.choice.intelligence.name"),
        description: t("ui.progression.levelup.choice.intelligence.description")
      };
  }
}

export function progressionChoiceSourceLabel(source: string): string {
  switch (source) {
    case "event":
      return t("ui.progression.source.event");
    case "merchant":
      return t("ui.progression.source.merchant");
    case "levelup":
      return t("ui.progression.source.levelup");
    case "budget_fallback":
      return t("ui.progression.source.budget_fallback");
    default:
      return source;
  }
}
