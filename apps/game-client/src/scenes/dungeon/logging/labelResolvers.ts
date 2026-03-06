import { t } from "../../../i18n";

export {
  consumableDescriptionLabel,
  consumableFailureReasonLabel,
  consumableNameLabel,
  difficultyLabel,
  equipmentSlotLabel,
  hazardTypeLabel,
  levelUpDialogDescription,
  levelUpDialogTitle,
  levelUpStatChoiceLabel,
  progressionChoiceSourceLabel
} from "../../../i18n/labelResolvers";

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
