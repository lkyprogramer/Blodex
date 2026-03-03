import {
  BIOME_DEFS,
  BLUEPRINT_DEFS,
  BOSS_DEFS,
  HAZARD_DEFS,
  ITEM_DEFS,
  LOOT_TABLES,
  MONSTER_AFFIX_DEFS,
  MONSTER_ARCHETYPES,
  MUTATION_DEFS,
  RANDOM_EVENT_DEFS,
  SKILL_DEFS,
  SYNERGY_DEFS,
  TALENT_DEFS,
  UNLOCK_DEFS,
  WEAPON_TYPE_DEFS
} from "../index";
import { describe, expect, it } from "vitest";

const CONSUMABLE_IDS = new Set(["health_potion", "mana_potion", "scroll_of_mapping"]);

describe("content integrity", () => {
  it("keeps loot/monster/biome/event references valid", () => {
    const itemIds = new Set(ITEM_DEFS.map((item) => item.id));
    const lootTableIds = new Set(LOOT_TABLES.map((table) => table.id));
    const monsterIds = new Set(MONSTER_ARCHETYPES.map((monster) => monster.id));
    const hazardIds = new Set(HAZARD_DEFS.map((hazard) => hazard.id));
    const biomeIds = new Set(BIOME_DEFS.map((biome) => biome.id));
    const eventIds = new Set(RANDOM_EVENT_DEFS.map((eventDef) => eventDef.id));

    for (const lootTable of LOOT_TABLES) {
      for (const entry of lootTable.entries) {
        expect(itemIds.has(entry.itemDefId), `${lootTable.id} -> missing item ${entry.itemDefId}`).toBe(true);
        expect(entry.weight, `${lootTable.id} -> ${entry.itemDefId} weight must be > 0`).toBeGreaterThan(0);
      }
    }

    for (const monster of MONSTER_ARCHETYPES) {
      expect(lootTableIds.has(monster.dropTableId), `${monster.id} -> missing loot table ${monster.dropTableId}`).toBe(true);
    }

    for (const boss of BOSS_DEFS) {
      expect(lootTableIds.has(boss.dropTableId), `${boss.id} -> missing loot table ${boss.dropTableId}`).toBe(true);
      expect(boss.exclusiveFloor, `${boss.id} -> exclusiveFloor must be >= 1`).toBeGreaterThanOrEqual(1);
    }

    for (const biome of BIOME_DEFS) {
      for (const monsterId of biome.monsterPool) {
        expect(monsterIds.has(monsterId), `${biome.id} -> missing monster ${monsterId}`).toBe(true);
      }
      for (const hazardId of biome.hazardPool) {
        expect(hazardIds.has(hazardId), `${biome.id} -> missing hazard ${hazardId}`).toBe(true);
      }
    }

    for (const eventDef of RANDOM_EVENT_DEFS) {
      expect(eventDef.floorRange.min, `${eventDef.id} floorRange.min must be <= max`).toBeLessThanOrEqual(
        eventDef.floorRange.max
      );

      if (eventDef.biomeIds !== undefined) {
        for (const biomeId of eventDef.biomeIds) {
          expect(biomeIds.has(biomeId), `${eventDef.id} -> missing biome ${biomeId}`).toBe(true);
        }
      }

      for (const choice of eventDef.choices) {
        for (const reward of choice.rewards) {
          if (reward.type === "item") {
            const hasItemRef = reward.itemDefId !== undefined;
            const hasLootRef = reward.lootTableId !== undefined;
            expect(hasItemRef || hasLootRef, `${eventDef.id}/${choice.id} item reward needs itemDefId or lootTableId`).toBe(true);
            if (reward.itemDefId !== undefined) {
              expect(itemIds.has(reward.itemDefId), `${eventDef.id}/${choice.id} -> missing item ${reward.itemDefId}`).toBe(
                true
              );
            }
            if (reward.lootTableId !== undefined) {
              expect(
                lootTableIds.has(reward.lootTableId),
                `${eventDef.id}/${choice.id} -> missing loot table ${reward.lootTableId}`
              ).toBe(true);
            }
          }

          if (reward.type === "consumable") {
            expect(CONSUMABLE_IDS.has(reward.consumableId), `${eventDef.id}/${choice.id} -> unknown consumable`).toBe(true);
            expect(reward.amount, `${eventDef.id}/${choice.id} -> consumable amount must be > 0`).toBeGreaterThan(0);
          }
        }

        if (choice.risk !== undefined) {
          const penalty = choice.risk.penalty;
          if (penalty.type === "item") {
            if (penalty.itemDefId !== undefined) {
              expect(itemIds.has(penalty.itemDefId), `${eventDef.id}/${choice.id} -> missing penalty item`).toBe(true);
            }
            if (penalty.lootTableId !== undefined) {
              expect(lootTableIds.has(penalty.lootTableId), `${eventDef.id}/${choice.id} -> missing penalty loot table`).toBe(
                true
              );
            }
          }
          if (penalty.type === "consumable") {
            expect(CONSUMABLE_IDS.has(penalty.consumableId), `${eventDef.id}/${choice.id} -> unknown penalty consumable`).toBe(
              true
            );
          }
        }
      }
    }

    const eventUnlockTargets = new Set(
      UNLOCK_DEFS.flatMap((unlockDef) =>
        unlockDef.effect.type === "event_unlock" ? [unlockDef.effect.eventId] : []
      )
    );
    for (const eventDef of RANDOM_EVENT_DEFS) {
      if (eventDef.unlockId !== undefined) {
        expect(eventDef.unlockId, `${eventDef.id} unlockId must match event id`).toBe(eventDef.id);
        expect(eventUnlockTargets.has(eventDef.id), `${eventDef.id} requires unlock but no event_unlock effect found`).toBe(true);
      }
    }

    expect(eventIds.size).toBe(RANDOM_EVENT_DEFS.length);
  });

  it("keeps unlock/blueprint/mutation/weapon/talent references valid", () => {
    const skillIds = new Set<string>(SKILL_DEFS.map((skill) => skill.id));
    const affixIds = new Set<string>(MONSTER_AFFIX_DEFS.map((affix) => affix.id));
    const biomeIds = new Set<string>(BIOME_DEFS.map((biome) => biome.id));
    const eventIds = new Set<string>(RANDOM_EVENT_DEFS.map((eventDef) => eventDef.id));
    const blueprintIds = new Set<string>(BLUEPRINT_DEFS.map((blueprint) => blueprint.id));
    const mutationIds = new Set<string>(MUTATION_DEFS.map((mutation) => mutation.id));
    const weaponTypeIds = new Set<string>(WEAPON_TYPE_DEFS.map((weaponType) => weaponType.id));
    const talentIds = new Set<string>(TALENT_DEFS.map((talent) => talent.id));

    for (const unlockDef of UNLOCK_DEFS) {
      if (unlockDef.effect.type === "skill_unlock") {
        expect(skillIds.has(unlockDef.effect.skillId), `${unlockDef.id} -> missing skill ${unlockDef.effect.skillId}`).toBe(true);
      }
      if (unlockDef.effect.type === "affix_unlock") {
        expect(affixIds.has(unlockDef.effect.affixId), `${unlockDef.id} -> missing affix ${unlockDef.effect.affixId}`).toBe(true);
      }
      if (unlockDef.effect.type === "biome_unlock") {
        expect(biomeIds.has(unlockDef.effect.biomeId), `${unlockDef.id} -> missing biome ${unlockDef.effect.biomeId}`).toBe(true);
      }
      if (unlockDef.effect.type === "event_unlock") {
        expect(eventIds.has(unlockDef.effect.eventId), `${unlockDef.id} -> missing event ${unlockDef.effect.eventId}`).toBe(true);
      }
    }

    for (const blueprint of BLUEPRINT_DEFS) {
      if (blueprint.category === "skill") {
        expect(skillIds.has(blueprint.unlockTargetId), `${blueprint.id} -> missing skill target ${blueprint.unlockTargetId}`).toBe(
          true
        );
      }

      if (blueprint.category === "weapon") {
        expect(blueprint.unlockTargetId.startsWith("weapon_type_"), `${blueprint.id} weapon target should use weapon_type_*`).toBe(
          true
        );
        const weaponTypeId = blueprint.unlockTargetId.replace("weapon_type_", "");
        expect(weaponTypeIds.has(weaponTypeId), `${blueprint.id} -> missing weapon type ${weaponTypeId}`).toBe(true);
      }

      if (blueprint.category === "mutation") {
        expect(mutationIds.has(blueprint.unlockTargetId), `${blueprint.id} -> missing mutation ${blueprint.unlockTargetId}`).toBe(
          true
        );
      }

      if (blueprint.category === "event") {
        expect(eventIds.has(blueprint.unlockTargetId), `${blueprint.id} -> missing event ${blueprint.unlockTargetId}`).toBe(true);
      }

      expect(blueprint.dropSources.length, `${blueprint.id} needs at least one drop source`).toBeGreaterThan(0);
      for (const source of blueprint.dropSources) {
        if (source.type === "monster_affix") {
          expect(source.sourceId, `${blueprint.id} monster_affix source requires sourceId`).toBeDefined();
          expect(affixIds.has(source.sourceId ?? ""), `${blueprint.id} -> missing affix source ${source.sourceId}`).toBe(true);
        }

        if (source.type === "random_event") {
          expect(source.sourceId, `${blueprint.id} random_event source requires sourceId`).toBeDefined();
          expect(eventIds.has(source.sourceId ?? ""), `${blueprint.id} -> missing event source ${source.sourceId}`).toBe(true);
        }

        if (source.type === "boss_kill" || source.type === "boss_first_kill") {
          if (source.sourceId !== undefined) {
            const bossIds = new Set(BOSS_DEFS.map((boss) => boss.id));
            expect(bossIds.has(source.sourceId), `${blueprint.id} -> missing boss source ${source.sourceId}`).toBe(true);
          }
        }
      }
    }

    const skillUnlockTargets = new Set(
      BLUEPRINT_DEFS.filter((blueprint) => blueprint.category === "skill").map((blueprint) => blueprint.unlockTargetId)
    );
    for (const skill of SKILL_DEFS) {
      if (skill.unlockCondition !== undefined) {
        expect(
          skillUnlockTargets.has(skill.unlockCondition) || skillIds.has(skill.unlockCondition),
          `${skill.id} unlockCondition ${skill.unlockCondition} is not reachable`
        ).toBe(true);
      }
    }

    for (const mutation of MUTATION_DEFS) {
      if (mutation.unlock.type === "blueprint") {
        expect(blueprintIds.has(mutation.unlock.blueprintId), `${mutation.id} -> missing blueprint ${mutation.unlock.blueprintId}`).toBe(
          true
        );
      }

      for (const conflictId of mutation.incompatibleWith ?? []) {
        expect(mutationIds.has(conflictId), `${mutation.id} -> missing incompatible mutation ${conflictId}`).toBe(true);
      }
    }

    for (const weaponType of WEAPON_TYPE_DEFS) {
      if (weaponType.unlock.type === "blueprint") {
        expect(blueprintIds.has(weaponType.unlock.blueprintId), `${weaponType.id} -> missing blueprint ${weaponType.unlock.blueprintId}`).toBe(
          true
        );
      }
    }

    for (const talent of TALENT_DEFS) {
      for (const prerequisite of talent.prerequisites) {
        expect(talentIds.has(prerequisite.talentId), `${talent.id} -> missing prerequisite ${prerequisite.talentId}`).toBe(true);
      }
    }
  });

  it("keeps synergy references valid", () => {
    const skillIds = new Set(SKILL_DEFS.map((skill) => skill.id));
    const talentIds = new Set(TALENT_DEFS.map((talent) => talent.id));
    const mutationIds = new Set(MUTATION_DEFS.map((mutation) => mutation.id));
    const weaponTypeIds = new Set(WEAPON_TYPE_DEFS.map((weaponType) => weaponType.id));

    for (const synergy of SYNERGY_DEFS) {
      for (const condition of synergy.conditions) {
        if (condition.type === "weapon_type") {
          expect(weaponTypeIds.has(condition.value), `${synergy.id} -> missing weapon type ${condition.value}`).toBe(true);
        }

        if (condition.type === "skill_equipped") {
          expect(skillIds.has(condition.value), `${synergy.id} -> missing skill ${condition.value}`).toBe(true);
        }

        if (condition.type === "skill_level_at_least") {
          expect(skillIds.has(condition.skillId), `${synergy.id} -> missing skill ${condition.skillId}`).toBe(true);
        }

        if (condition.type === "talent_rank_at_least") {
          expect(talentIds.has(condition.talentId), `${synergy.id} -> missing talent ${condition.talentId}`).toBe(true);
        }

        if (condition.type === "mutation_equipped") {
          expect(mutationIds.has(condition.value), `${synergy.id} -> missing mutation ${condition.value}`).toBe(true);
        }
      }

      for (const effect of synergy.effects) {
        if (effect.type === "skill_damage_percent" || effect.type === "skill_modifier") {
          expect(skillIds.has(effect.skillId), `${synergy.id} -> missing skill effect target ${effect.skillId}`).toBe(true);
        }

        if (effect.type === "cooldown_override") {
          expect(skillIds.has(effect.key), `${synergy.id} -> cooldown key should target existing skill id ${effect.key}`).toBe(true);
        }
      }
    }
  });
});
