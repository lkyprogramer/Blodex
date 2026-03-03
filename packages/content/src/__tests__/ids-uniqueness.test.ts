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

function duplicateIds(ids: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));
}

describe("content id uniqueness", () => {
  it("keeps dataset ids unique", () => {
    const datasets: Array<{ name: string; ids: string[] }> = [
      { name: "BIOME_DEFS", ids: BIOME_DEFS.map((entry) => entry.id) },
      { name: "BLUEPRINT_DEFS", ids: BLUEPRINT_DEFS.map((entry) => entry.id) },
      { name: "BOSS_DEFS", ids: BOSS_DEFS.map((entry) => entry.id) },
      { name: "HAZARD_DEFS", ids: HAZARD_DEFS.map((entry) => entry.id) },
      { name: "ITEM_DEFS", ids: ITEM_DEFS.map((entry) => entry.id) },
      { name: "LOOT_TABLES", ids: LOOT_TABLES.map((entry) => entry.id) },
      { name: "MONSTER_AFFIX_DEFS", ids: MONSTER_AFFIX_DEFS.map((entry) => entry.id) },
      { name: "MONSTER_ARCHETYPES", ids: MONSTER_ARCHETYPES.map((entry) => entry.id) },
      { name: "MUTATION_DEFS", ids: MUTATION_DEFS.map((entry) => entry.id) },
      { name: "RANDOM_EVENT_DEFS", ids: RANDOM_EVENT_DEFS.map((entry) => entry.id) },
      { name: "SKILL_DEFS", ids: SKILL_DEFS.map((entry) => entry.id) },
      { name: "SYNERGY_DEFS", ids: SYNERGY_DEFS.map((entry) => entry.id) },
      { name: "TALENT_DEFS", ids: TALENT_DEFS.map((entry) => entry.id) },
      { name: "UNLOCK_DEFS", ids: UNLOCK_DEFS.map((entry) => entry.id) },
      { name: "WEAPON_TYPE_DEFS", ids: WEAPON_TYPE_DEFS.map((entry) => entry.id) }
    ];

    for (const dataset of datasets) {
      expect(duplicateIds(dataset.ids), `${dataset.name} has duplicate ids`).toEqual([]);
    }
  });

  it("keeps event choice ids unique per event", () => {
    for (const eventDef of RANDOM_EVENT_DEFS) {
      const choiceIds = eventDef.choices.map((choice) => choice.id);
      expect(duplicateIds(choiceIds), `${eventDef.id} has duplicate choice ids`).toEqual([]);
    }
  });
});
