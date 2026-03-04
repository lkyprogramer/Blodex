import { BIOME_DEFS } from "@blodex/content";
import { describe, expect, it } from "vitest";
import {
  BIOME_VISUAL_THEME_REGISTRY,
  resolveBiomeVisualTheme
} from "../BiomeVisualThemeRegistry";

describe("BiomeVisualThemeRegistry", () => {
  it("covers every biome definition and resolves a floor tile key", () => {
    for (const biome of BIOME_DEFS) {
      const resolved = resolveBiomeVisualTheme(biome);
      expect(resolved.floorTileKey.length).toBeGreaterThan(0);
      expect(BIOME_VISUAL_THEME_REGISTRY[biome.id]).toBeDefined();
    }
  });

  it("keeps at least five distinct floor tile materials", () => {
    const tileKeys = new Set(BIOME_DEFS.map((biome) => resolveBiomeVisualTheme(biome).floorTileKey));
    expect(tileKeys.size).toBeGreaterThanOrEqual(5);
  });
});
