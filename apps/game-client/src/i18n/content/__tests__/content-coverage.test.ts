import {
  BIOME_MAP,
  BOSS_DEFS,
  BLUEPRINT_DEFS,
  ITEM_DEFS,
  MONSTER_AFFIX_DEFS,
  MONSTER_ARCHETYPES,
  MUTATION_DEFS,
  RANDOM_EVENT_DEFS,
  SKILL_DEFS,
  TALENT_DEFS,
  UNLOCK_DEFS
} from "@blodex/content";
import { describe, expect, it } from "vitest";
import { checkPlaceholderConsistency } from "../../catalogDiagnostics";
import { EN_US_CATALOG } from "../../catalog/en-US";
import { ZH_CN_CATALOG } from "../../catalog/zh-CN";
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
  contentMonsterNameKey,
  contentMutationNameKey,
  contentSkillDescriptionKey,
  contentSkillNameKey,
  contentTalentDescriptionKey,
  contentTalentNameKey,
  contentUnlockDescriptionKey,
  contentUnlockNameKey
} from "../contentKeys";

const ALLOWED_SAME_AS_ENGLISH = new Set<string>([]);

function collectExpectedContentKeys(): Set<string> {
  const keys = new Set<string>();

  for (const item of ITEM_DEFS) {
    keys.add(contentItemNameKey(item.id));
  }

  for (const skill of SKILL_DEFS) {
    keys.add(contentSkillNameKey(skill.id));
    keys.add(contentSkillDescriptionKey(skill.id));
  }

  for (const eventDef of RANDOM_EVENT_DEFS) {
    keys.add(contentEventNameKey(eventDef.id));
    keys.add(contentEventDescriptionKey(eventDef.id));
    for (const choice of eventDef.choices) {
      keys.add(contentEventChoiceNameKey(eventDef.id, choice.id));
      keys.add(contentEventChoiceDescriptionKey(eventDef.id, choice.id));
    }
  }

  for (const unlock of UNLOCK_DEFS) {
    keys.add(contentUnlockNameKey(unlock.id));
    keys.add(contentUnlockDescriptionKey(unlock.id));
  }

  for (const talent of TALENT_DEFS) {
    keys.add(contentTalentNameKey(talent.id));
    keys.add(contentTalentDescriptionKey(talent.id));
  }

  for (const blueprint of BLUEPRINT_DEFS) {
    keys.add(contentBlueprintNameKey(blueprint.id));
  }

  for (const mutation of MUTATION_DEFS) {
    keys.add(contentMutationNameKey(mutation.id));
  }

  for (const biome of Object.values(BIOME_MAP)) {
    keys.add(contentBiomeNameKey(biome.id));
  }

  for (const monster of MONSTER_ARCHETYPES) {
    keys.add(contentMonsterNameKey(monster.id));
  }

  for (const affix of MONSTER_AFFIX_DEFS) {
    keys.add(contentAffixNameKey(affix.id));
    keys.add(contentAffixDescriptionKey(affix.id));
  }

  for (const boss of BOSS_DEFS) {
    keys.add(contentBossNameKey(boss.id));
  }

  return keys;
}

function pickContentMessages(catalog: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(catalog).filter(([key]) => key.startsWith("content.")));
}

describe("content locale coverage", () => {
  it("keeps en-US and zh-CN catalogs aligned with generated content keys", () => {
    const expectedKeys = [...collectExpectedContentKeys()].sort((a, b) => a.localeCompare(b));
    const enMessages = pickContentMessages(EN_US_CATALOG.messages);
    const zhMessages = pickContentMessages(ZH_CN_CATALOG.messages);

    const missingInEn = expectedKeys.filter((key) => enMessages[key] === undefined);
    const missingInZh = expectedKeys.filter((key) => zhMessages[key] === undefined);
    const unexpectedInEn = Object.keys(enMessages)
      .filter((key) => !expectedKeys.includes(key))
      .sort((a, b) => a.localeCompare(b));
    const unexpectedInZh = Object.keys(zhMessages)
      .filter((key) => !expectedKeys.includes(key))
      .sort((a, b) => a.localeCompare(b));

    expect(missingInEn).toEqual([]);
    expect(missingInZh).toEqual([]);
    expect(unexpectedInEn).toEqual([]);
    expect(unexpectedInZh).toEqual([]);
  });

  it("rejects untranslated zh-CN content fallbacks", () => {
    const enMessages = pickContentMessages(EN_US_CATALOG.messages);
    const zhMessages = pickContentMessages(ZH_CN_CATALOG.messages);

    const untranslated = Object.keys(enMessages)
      .filter((key) => zhMessages[key] === enMessages[key] && !ALLOWED_SAME_AS_ENGLISH.has(key))
      .sort((a, b) => a.localeCompare(b));

    expect(untranslated).toEqual([]);
  });

  it("keeps placeholders aligned between en-US and zh-CN content messages", () => {
    const enMessages = pickContentMessages(EN_US_CATALOG.messages);
    const zhMessages = pickContentMessages(ZH_CN_CATALOG.messages);
    const issues = checkPlaceholderConsistency(enMessages, zhMessages, ZH_CN_CATALOG.locale);

    expect(issues).toEqual([]);
  });
});
