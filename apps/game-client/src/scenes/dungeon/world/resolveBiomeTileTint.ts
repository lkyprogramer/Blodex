import type { BiomeDef } from "@blodex/content";

export function resolveBiomeTileTint(biomeId: BiomeDef["id"]): number | undefined {
  switch (biomeId) {
    case "molten_caverns":
      return 0xf4d2bc;
    case "frozen_halls":
      return 0xcfe2f0;
    case "bone_throne":
      return 0xe4d6d6;
    case "forgotten_catacombs":
    default:
      return undefined;
  }
}
