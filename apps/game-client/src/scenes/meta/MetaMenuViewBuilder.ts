import {
  buildMutationDefMap,
  canPurchaseTalent,
  canStartDailyScoredAttempt,
  collectUnlockedMutationIds,
  isDifficultyUnlocked,
  resolveDailyDate,
  validateMutationSelection,
  type DifficultyMode,
  type MetaProgression,
  type MutationDef,
  type MutationEffect,
  type RunSaveDataV2,
  type TalentNodeDef
} from "@blodex/core";
import {
  BLUEPRINT_DEFS,
  BLUEPRINT_DEF_MAP,
  MUTATION_DEFS,
  SKILL_DEF_MAP,
  TALENT_DEFS,
  UNLOCK_DEFS
} from "@blodex/content";
import { getLocale, t } from "../../i18n";
import { difficultyLabel } from "../../i18n/labelResolvers";
import type { LocaleCode } from "../../i18n/types";
import type { SaveManager } from "../../systems/SaveManager";
import type { MetaMenuPanelView } from "../../ui/components/MetaMenuPanel";

const DIFFICULTY_ORDER: DifficultyMode[] = ["normal", "hard", "nightmare"];
const PURCHASE_HOTKEYS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "ZERO"];
const MUTATION_DEF_BY_ID = buildMutationDefMap(MUTATION_DEFS);
const MUTATION_EFFECT_LABEL_KEY: Record<MutationEffect["type"], string> = {
  on_kill_heal_percent: "ui.meta.mutation.effect.on_kill_heal_percent",
  on_kill_attack_speed: "ui.meta.mutation.effect.on_kill_attack_speed",
  on_hit_invuln: "ui.meta.mutation.effect.on_hit_invuln",
  on_hit_reflect_percent: "ui.meta.mutation.effect.on_hit_reflect_percent",
  once_per_floor_lethal_guard: "ui.meta.mutation.effect.once_per_floor_lethal_guard",
  drop_bonus: "ui.meta.mutation.effect.drop_bonus",
  move_speed_multiplier: "ui.meta.mutation.effect.move_speed_multiplier",
  potion_heal_amp_and_self_damage: "ui.meta.mutation.effect.potion_heal_amp_and_self_damage",
  hidden_room_reveal_radius: "ui.meta.mutation.effect.hidden_room_reveal_radius"
};

export interface MetaMenuViewBuilderArgs {
  meta: MetaProgression;
  runSave: RunSaveDataV2 | null;
  saveManager: Pick<SaveManager, "hasForeignLease">;
  currentLocale: LocaleCode;
  contentLocalizer: {
    unlockName(id: string, fallback: string): string;
    unlockDescription(id: string, fallback: string): string;
    talentName(id: string, fallback: string): string;
    talentDescription(id: string, fallback: string): string;
    blueprintName(id: string, fallback: string): string;
    mutationName(id: string, fallback: string): string;
    skillName(id: string, fallback: string): string;
  };
}

function hotkeyLabelFromKey(eventName: string): string {
  switch (eventName) {
    case "ONE":
      return "1";
    case "TWO":
      return "2";
    case "THREE":
      return "3";
    case "FOUR":
      return "4";
    case "FIVE":
      return "5";
    case "SIX":
      return "6";
    case "SEVEN":
      return "7";
    case "EIGHT":
      return "8";
    case "NINE":
      return "9";
    case "ZERO":
      return "0";
    default:
      return eventName;
  }
}

function blueprintCategoryLabel(category: MetaMenuPanelView["blueprintGroups"][number]["category"]): string {
  switch (category) {
    case "skill":
      return t("ui.meta.blueprint.category.skill");
    case "weapon":
      return t("ui.meta.blueprint.category.weapon");
    case "consumable":
      return t("ui.meta.blueprint.category.consumable");
    case "event":
      return t("ui.meta.blueprint.category.event");
    case "mutation":
      return t("ui.meta.blueprint.category.mutation");
    default:
      return category;
  }
}

function mutationCategoryLabel(category: MutationDef["category"]): string {
  switch (category) {
    case "offensive":
      return t("ui.meta.mutation.category.offensive");
    case "defensive":
      return t("ui.meta.mutation.category.defensive");
    case "utility":
      return t("ui.meta.mutation.category.utility");
    default:
      return category;
  }
}

function describeMutationUnlock(mutation: MutationDef): string {
  if (mutation.unlock.type === "default") {
    return t("ui.meta.mutation.unlock.default");
  }
  if (mutation.unlock.type === "blueprint") {
    return t("ui.meta.mutation.unlock.blueprint", {
      blueprintId: mutation.unlock.blueprintId
    });
  }
  return t("ui.meta.mutation.unlock.echo", {
    cost: mutation.unlock.cost
  });
}

function describeMutationEffects(mutation: MutationDef): string {
  return mutation.effects
    .map((effect) => {
      const key = MUTATION_EFFECT_LABEL_KEY[effect.type];
      return key === undefined ? effect.type.replaceAll("_", " ") : t(key);
    })
    .join(" + ");
}

function describeMutationValidationError(reason: string): string {
  if (reason.includes("slot limit")) {
    return t("ui.meta.status.slot_full");
  }
  if (reason.includes("conflict")) {
    return t("ui.meta.status.conflict_selected");
  }
  if (reason.includes("not unlocked")) {
    return t("ui.meta.status.not_unlocked");
  }
  return t("ui.meta.status.unavailable");
}

function difficultyRequirement(mode: DifficultyMode): string {
  if (mode === "hard") {
    return t("ui.meta.requirement.hard");
  }
  if (mode === "nightmare") {
    return t("ui.meta.requirement.nightmare");
  }
  return t("ui.meta.requirement.normal");
}

function describeDailyChallenge(meta: MetaProgression): MetaMenuPanelView["daily"] {
  const date = resolveDailyDate();
  const canScore = canStartDailyScoredAttempt(meta, date);
  return {
    date,
    mode: canScore ? "scored" : "practice",
    statusText: canScore
      ? t("ui.meta.daily.status.scored_available")
      : t("ui.meta.daily.status.practice_only")
  };
}

function describeRunSave(
  runSave: RunSaveDataV2 | null,
  saveManager: Pick<SaveManager, "hasForeignLease">
): MetaMenuPanelView["runSave"] {
  if (runSave === null) {
    return null;
  }
  const leaseBlocked = saveManager.hasForeignLease(runSave);
  const date = new Date(runSave.savedAtMs);
  const when = Number.isNaN(date.valueOf()) ? t("ui.meta.save.unknown_time") : date.toLocaleString(getLocale());
  return {
    canContinue: !leaseBlocked,
    canAbandon: !leaseBlocked,
    statusText: leaseBlocked ? t("ui.meta.save.active_in_another_tab") : t("ui.meta.save.ready_to_continue"),
    detailText: t("ui.meta.save.detail", {
      floor: runSave.run.currentFloor,
      difficulty: difficultyLabel(runSave.run.difficulty ?? "normal"),
      when
    })
  };
}

function describeBlueprintDetail(
  blueprint: (typeof BLUEPRINT_DEFS)[number],
  contentLocalizer: MetaMenuViewBuilderArgs["contentLocalizer"]
): string {
  if (blueprint.category !== "skill") {
    return blueprint.unlockTargetId;
  }
  const skillDef = SKILL_DEF_MAP[blueprint.unlockTargetId];
  const skillName =
    skillDef === undefined
      ? blueprint.unlockTargetId
      : contentLocalizer.skillName(skillDef.id, skillDef.name);
  if (blueprint.skillAugment === undefined) {
    return t("ui.meta.effect.skill_unlock", { skillId: skillName });
  }
  const detailParts: string[] = [];
  if (blueprint.skillAugment.cooldownMultiplier !== undefined && blueprint.skillAugment.cooldownMultiplier < 1) {
    detailParts.push(
      t("ui.meta.blueprint.effect.part.cooldown_reduction", {
        value: Math.round((1 - blueprint.skillAugment.cooldownMultiplier) * 100)
      })
    );
  }
  if (blueprint.skillAugment.manaCostFlat !== undefined && blueprint.skillAugment.manaCostFlat < 0) {
    detailParts.push(
      t("ui.meta.blueprint.effect.part.mana_reduction", {
        value: Math.abs(blueprint.skillAugment.manaCostFlat)
      })
    );
  }
  if (blueprint.skillAugment.rangeMultiplier !== undefined && blueprint.skillAugment.rangeMultiplier > 1) {
    detailParts.push(
      t("ui.meta.blueprint.effect.part.range_increase", {
        value: Math.round((blueprint.skillAugment.rangeMultiplier - 1) * 100)
      })
    );
  }
  if (blueprint.skillAugment.durationMultiplier !== undefined && blueprint.skillAugment.durationMultiplier > 1) {
    detailParts.push(
      t("ui.meta.blueprint.effect.part.duration_increase", {
        value: Math.round((blueprint.skillAugment.durationMultiplier - 1) * 100)
      })
    );
  }
  if (blueprint.skillAugment.damageMultiplier !== undefined && blueprint.skillAugment.damageMultiplier > 1) {
    detailParts.push(
      t("ui.meta.blueprint.effect.part.damage_increase", {
        value: Math.round((blueprint.skillAugment.damageMultiplier - 1) * 100)
      })
    );
  }
  if (
    blueprint.skillAugment.appendedEffects?.some(
      (effect) => effect.type === "buff" && effect.buffId === "guaranteed_crit"
    ) === true
  ) {
    detailParts.push(t("ui.meta.blueprint.effect.part.guaranteed_crit"));
  }
  return t("ui.meta.blueprint.effect.skill_augment", {
    skillName,
    effectList: detailParts.join(" · ")
  });
}

function describeEffect(unlock: (typeof UNLOCK_DEFS)[number]): string {
  if (unlock.effect.type === "permanent_upgrade") {
    return t("ui.meta.effect.permanent", {
      key: unlock.effect.key,
      value: unlock.effect.value
    });
  }
  if (unlock.effect.type === "skill_unlock") {
    return t("ui.meta.effect.skill_unlock", {
      skillId: unlock.effect.skillId
    });
  }
  if (unlock.effect.type === "affix_unlock") {
    return t("ui.meta.effect.affix_unlock", {
      affixId: unlock.effect.affixId
    });
  }
  if (unlock.effect.type === "biome_unlock") {
    return t("ui.meta.effect.biome_unlock", {
      biomeId: unlock.effect.biomeId
    });
  }
  return t("ui.meta.effect.event_unlock", {
    eventId: unlock.effect.eventId
  });
}

export function buildMetaMenuView(args: MetaMenuViewBuilderArgs): MetaMenuPanelView {
  const { meta, runSave, saveManager, currentLocale, contentLocalizer } = args;
  const unlockGroups = new Map<number, MetaMenuPanelView["unlockGroups"][number]>();

  UNLOCK_DEFS.forEach((unlock, index) => {
    const unlocked = meta.unlocks.includes(unlock.id);
    const requirementReady = meta.cumulativeUnlockProgress >= unlock.cumulativeRequirement;
    const canAfford = meta.soulShards >= unlock.cost;
    const purchasable = !unlocked && requirementReady && canAfford;
    const statusText = unlocked
      ? t("ui.meta.status.unlocked")
      : !requirementReady
        ? t("ui.meta.status.need_progress", { progress: unlock.cumulativeRequirement })
        : !canAfford
          ? t("ui.meta.status.need_soul_shards")
          : t("ui.meta.status.available");

    const group = unlockGroups.get(unlock.tier) ?? {
      tier: unlock.tier,
      unlocks: []
    };
    group.unlocks.push({
      index,
      id: unlock.id,
      name: contentLocalizer.unlockName(unlock.id, unlock.name),
      description: contentLocalizer.unlockDescription(unlock.id, unlock.description),
      tier: unlock.tier,
      cost: unlock.cost,
      shortcut:
        PURCHASE_HOTKEYS[index] === undefined ? "-" : hotkeyLabelFromKey(PURCHASE_HOTKEYS[index]),
      effectText: describeEffect(unlock),
      statusText,
      unlocked,
      purchasable
    });
    unlockGroups.set(unlock.tier, group);
  });

  const talentGroups = new Map<MetaMenuPanelView["talentGroups"][number]["path"], MetaMenuPanelView["talentGroups"][number]>();
  TALENT_DEFS.forEach((talent) => {
    const rank = meta.talentPoints[talent.id] ?? 0;
    const purchasable = canPurchaseTalent(meta, talent as TalentNodeDef);
    const statusText =
      rank >= talent.maxRank
        ? t("ui.meta.status.max_rank")
        : purchasable
          ? t("ui.meta.status.available")
          : meta.soulShards < talent.cost
            ? t("ui.meta.status.need_soul_shards")
            : t("ui.meta.status.prerequisite_required");
    const group = talentGroups.get(talent.path) ?? {
      path: talent.path,
      label: talent.path,
      talents: []
    };
    group.talents.push({
      id: talent.id,
      name: contentLocalizer.talentName(talent.id, talent.name),
      description: contentLocalizer.talentDescription(talent.id, talent.description),
      path: talent.path,
      tier: talent.tier,
      rank,
      maxRank: talent.maxRank,
      cost: talent.cost,
      statusText,
      purchasable
    });
    talentGroups.set(talent.path, group);
  });

  const foundBlueprints = new Set(meta.blueprintFoundIds);
  const forgedBlueprints = new Set(meta.blueprintForgedIds);
  const blueprintGroups = new Map<
    MetaMenuPanelView["blueprintGroups"][number]["category"],
    MetaMenuPanelView["blueprintGroups"][number]
  >();
  for (const blueprint of BLUEPRINT_DEFS) {
    const isFound = foundBlueprints.has(blueprint.id);
    const isForged = forgedBlueprints.has(blueprint.id);
    const canForge = isFound && !isForged && meta.soulShards >= blueprint.forgeCost;
    const statusText = isForged
      ? t("ui.meta.status.forged")
      : isFound
        ? canForge
          ? t("ui.meta.status.ready_to_forge")
          : t("ui.meta.status.need_soul_shards")
        : t("ui.meta.status.undiscovered");
    const group = blueprintGroups.get(blueprint.category) ?? {
      category: blueprint.category,
      label: blueprintCategoryLabel(blueprint.category),
      blueprints: []
    };
    group.blueprints.push({
      id: blueprint.id,
      name: contentLocalizer.blueprintName(blueprint.id, blueprint.name),
      category: blueprint.category,
      rarity: blueprint.rarity,
      forgeCost: blueprint.forgeCost,
      detailText: describeBlueprintDetail(blueprint, contentLocalizer),
      statusText,
      forged: isForged,
      canForge
    });
    blueprintGroups.set(blueprint.category, group);
  }

  const unlockedMutationIds = collectUnlockedMutationIds(meta, MUTATION_DEFS);
  const selectedMutationIds = [...meta.selectedMutationIds];
  const unlockedMutationSet = new Set(unlockedMutationIds);
  const mutationGroups = new Map<
    MutationDef["category"],
    MetaMenuPanelView["mutationGroups"][number]
  >();
  for (const mutation of MUTATION_DEFS) {
    const selected = selectedMutationIds.includes(mutation.id);
    const unlocked = unlockedMutationSet.has(mutation.id);
    let canToggle = selected;
    let canUnlockEcho = false;
    let statusText = selected ? t("ui.meta.status.selected") : t("ui.meta.status.locked");
    if (!selected && unlocked) {
      const validation = validateMutationSelection(
        [...selectedMutationIds, mutation.id],
        MUTATION_DEF_BY_ID,
        meta.mutationSlots,
        unlockedMutationIds
      );
      canToggle = validation.ok;
      statusText = validation.ok
        ? t("ui.meta.status.available")
        : describeMutationValidationError(validation.reason);
    } else if (!selected && !unlocked) {
      if (mutation.unlock.type === "echo") {
        canUnlockEcho = meta.echoes >= mutation.unlock.cost;
        statusText = canUnlockEcho
          ? t("ui.meta.status.cost_echoes", { cost: mutation.unlock.cost })
          : t("ui.meta.status.need_echoes", { cost: mutation.unlock.cost });
      } else if (mutation.unlock.type === "blueprint") {
        statusText = meta.blueprintForgedIds.includes(mutation.unlock.blueprintId)
          ? t("ui.meta.status.available_next_refresh")
          : t("ui.meta.status.need_blueprint", { blueprintId: mutation.unlock.blueprintId });
      }
    }
    const group = mutationGroups.get(mutation.category) ?? {
      category: mutation.category,
      label: mutationCategoryLabel(mutation.category),
      mutations: []
    };
    group.mutations.push({
      id: mutation.id,
      name: contentLocalizer.mutationName(mutation.id, mutation.name),
      category: mutation.category,
      tier: mutation.tier,
      unlockText: describeMutationUnlock(mutation),
      effectText: describeMutationEffects(mutation),
      statusText,
      selected,
      canToggle,
      canUnlockEcho
    });
    mutationGroups.set(mutation.category, group);
  }

  const difficulties = DIFFICULTY_ORDER.map((mode, index) => {
    const shortcut = index === 0 ? "Q" : index === 1 ? "W" : "E";
    return {
      mode,
      label: difficultyLabel(mode),
      shortcut,
      selected: meta.selectedDifficulty === mode,
      unlocked: isDifficultyUnlocked(meta, mode),
      requirement: difficultyRequirement(mode)
    };
  });

  return {
    locale: currentLocale,
    availableLocales: [
      {
        code: "en-US",
        label: t("ui.locale.english"),
        selected: currentLocale === "en-US"
      },
      {
        code: "zh-CN",
        label: t("ui.locale.zh_cn"),
        selected: currentLocale === "zh-CN"
      }
    ],
    soulShards: meta.soulShards,
    echoes: meta.echoes,
    unlockedCount: meta.unlocks.length,
    totalUnlocks: UNLOCK_DEFS.length,
    difficulties,
    runSave: describeRunSave(runSave, saveManager),
    daily: describeDailyChallenge(meta),
    talentGroups: [...talentGroups.values()].map((group) => ({
      ...group,
      talents: [...group.talents].sort((left, right) => left.tier - right.tier)
    })),
    unlockGroups: [...unlockGroups.values()].sort((left, right) => left.tier - right.tier),
    blueprintGroups: [...blueprintGroups.values()],
    mutationGroups: [...mutationGroups.values()].map((group) => ({
      ...group,
      mutations: [...group.mutations].sort((left, right) => left.tier - right.tier || left.name.localeCompare(right.name))
    })),
    mutationSlots: meta.mutationSlots,
    selectedMutations: meta.selectedMutationIds.length,
    startRunEnabled: runSave === null
  };
}
