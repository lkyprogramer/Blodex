import type { MonsterAffixDef } from "./types";

export const MONSTER_AFFIX_DEFS: MonsterAffixDef[] = [
  {
    id: "frenzied",
    name: "Frenzied",
    description: "Moves and attacks faster."
  },
  {
    id: "armored",
    name: "Armored",
    description: "Has reinforced health pool."
  },
  {
    id: "vampiric",
    name: "Vampiric",
    description: "Leeches life when attacking."
  },
  {
    id: "splitting",
    name: "Splitting",
    description: "Splits into lesser forms on death."
  },
  {
    id: "hulking",
    name: "Hulking",
    description: "Lumbers forward with a larger health pool."
  },
  {
    id: "warded",
    name: "Warded",
    description: "Dampens arcane damage and shrugs off spell bursts."
  },
  {
    id: "skirmisher",
    name: "Skirmisher",
    description: "Closes space quickly and strikes from farther out."
  },
  {
    id: "manaburn",
    name: "Manaburn",
    description: "Burns mana whenever its attacks connect."
  }
];

export const MONSTER_AFFIX_MAP: Record<MonsterAffixDef["id"], MonsterAffixDef> = Object.fromEntries(
  MONSTER_AFFIX_DEFS.map((affix) => [affix.id, affix])
) as Record<MonsterAffixDef["id"], MonsterAffixDef>;
