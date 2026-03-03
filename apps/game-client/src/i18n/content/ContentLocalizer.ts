import type { I18nService } from "../types";
import {
  contentAffixDescriptionKey,
  contentAffixNameKey,
  contentBiomeNameKey,
  contentBossNameKey,
  contentBlueprintNameKey,
  contentEventChoiceDescriptionKey,
  contentEventChoiceNameKey,
  contentEventDescriptionKey,
  contentEventNameKey,
  contentItemNameKey,
  contentMutationNameKey,
  contentMonsterNameKey,
  contentSkillDescriptionKey,
  contentSkillNameKey,
  contentTalentDescriptionKey,
  contentTalentNameKey,
  contentUnlockDescriptionKey,
  contentUnlockNameKey
} from "./contentKeys";

export class ContentLocalizer {
  constructor(private readonly i18n: I18nService) {}

  itemName(itemId: string, fallback: string): string {
    return this.resolve(contentItemNameKey(itemId), fallback);
  }

  skillName(skillId: string, fallback: string): string {
    return this.resolve(contentSkillNameKey(skillId), fallback);
  }

  skillDescription(skillId: string, fallback: string): string {
    return this.resolve(contentSkillDescriptionKey(skillId), fallback);
  }

  eventName(eventId: string, fallback: string): string {
    return this.resolve(contentEventNameKey(eventId), fallback);
  }

  eventDescription(eventId: string, fallback: string): string {
    return this.resolve(contentEventDescriptionKey(eventId), fallback);
  }

  eventChoiceName(eventId: string, choiceId: string, fallback: string): string {
    return this.resolve(contentEventChoiceNameKey(eventId, choiceId), fallback);
  }

  eventChoiceDescription(eventId: string, choiceId: string, fallback: string): string {
    return this.resolve(contentEventChoiceDescriptionKey(eventId, choiceId), fallback);
  }

  unlockName(unlockId: string, fallback: string): string {
    return this.resolve(contentUnlockNameKey(unlockId), fallback);
  }

  unlockDescription(unlockId: string, fallback: string): string {
    return this.resolve(contentUnlockDescriptionKey(unlockId), fallback);
  }

  talentName(talentId: string, fallback: string): string {
    return this.resolve(contentTalentNameKey(talentId), fallback);
  }

  talentDescription(talentId: string, fallback: string): string {
    return this.resolve(contentTalentDescriptionKey(talentId), fallback);
  }

  blueprintName(blueprintId: string, fallback: string): string {
    return this.resolve(contentBlueprintNameKey(blueprintId), fallback);
  }

  mutationName(mutationId: string, fallback: string): string {
    return this.resolve(contentMutationNameKey(mutationId), fallback);
  }

  biomeName(biomeId: string, fallback: string): string {
    return this.resolve(contentBiomeNameKey(biomeId), fallback);
  }

  monsterName(monsterId: string, fallback: string): string {
    return this.resolve(contentMonsterNameKey(monsterId), fallback);
  }

  affixName(affixId: string, fallback: string): string {
    return this.resolve(contentAffixNameKey(affixId), fallback);
  }

  affixDescription(affixId: string, fallback: string): string {
    return this.resolve(contentAffixDescriptionKey(affixId), fallback);
  }

  bossName(bossId: string, fallback: string): string {
    return this.resolve(contentBossNameKey(bossId), fallback);
  }

  private resolve(key: string, fallback: string): string {
    return this.i18n.hasKey(key) ? this.i18n.t(key) : fallback;
  }
}
