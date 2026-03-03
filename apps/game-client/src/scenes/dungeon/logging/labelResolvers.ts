import type { DifficultyMode } from "@blodex/core";
import { t } from "../../../i18n";

export function difficultyLabel(difficulty: DifficultyMode): string {
  switch (difficulty) {
    case "normal":
      return t("ui.meta.difficulty.normal");
    case "hard":
      return t("ui.meta.difficulty.hard");
    case "nightmare":
      return t("ui.meta.difficulty.nightmare");
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

export interface EntityLabelInput {
  entityId: string;
  entityLabelById: Map<string, string>;
  playerId: string;
  bossId: string;
  bossName: string;
  findMonsterById: (entityId: string) => { archetype: { name: string } } | undefined;
}

export function entityLabel(input: EntityLabelInput): string {
  const cached = input.entityLabelById.get(input.entityId);
  if (cached !== undefined) {
    return cached;
  }

  if (input.entityId === input.playerId) {
    return t("ui.hud.player.title");
  }

  if (input.entityId === input.bossId) {
    return input.bossName;
  }

  const monster = input.findMonsterById(input.entityId);
  if (monster !== undefined) {
    const name = monster.archetype.name;
    input.entityLabelById.set(input.entityId, name);
    return name;
  }

  return input.entityId;
}
