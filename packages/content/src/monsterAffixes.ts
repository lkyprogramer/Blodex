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
  }
];

export const MONSTER_AFFIX_MAP: Record<MonsterAffixDef["id"], MonsterAffixDef> = Object.fromEntries(
  MONSTER_AFFIX_DEFS.map((affix) => [affix.id, affix])
) as Record<MonsterAffixDef["id"], MonsterAffixDef>;

