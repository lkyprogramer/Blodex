import type { BiomeDef } from "@blodex/content";
import { resolveBiomeVisualThemeById } from "../presentation/BiomeVisualThemeRegistry";

export function resolveBiomeTileTint(biomeId: BiomeDef["id"]): number | undefined {
  return resolveBiomeVisualThemeById(biomeId).tileTint;
}
