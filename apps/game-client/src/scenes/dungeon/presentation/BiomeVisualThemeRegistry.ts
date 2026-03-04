import type { BiomeDef } from "@blodex/content";

export interface BiomeVisualTheme {
  floorTileKey: string;
  tileTint?: number;
  accentColor: number;
  hazeAlpha: number;
}

const DEFAULT_BIOME_THEME: BiomeVisualTheme = {
  floorTileKey: "tile_floor_01",
  accentColor: 0xcfb990,
  hazeAlpha: 0.08
};

export const BIOME_VISUAL_THEME_REGISTRY: Record<BiomeDef["id"], BiomeVisualTheme> = {
  forgotten_catacombs: {
    floorTileKey: "biome_catacombs_tile_floor_01",
    accentColor: 0xd0ba98,
    hazeAlpha: 0.08
  },
  molten_caverns: {
    floorTileKey: "biome_molten_tile_floor_01",
    tileTint: 0xf4d2bc,
    accentColor: 0xf0b57d,
    hazeAlpha: 0.11
  },
  frozen_halls: {
    floorTileKey: "biome_frozen_tile_floor_01",
    tileTint: 0xcfe2f0,
    accentColor: 0x9dc4e2,
    hazeAlpha: 0.1
  },
  phantom_graveyard: {
    floorTileKey: "biome_bone_tile_floor_01",
    tileTint: 0xd7c8ef,
    accentColor: 0xbba5df,
    hazeAlpha: 0.1
  },
  venom_swamp: {
    floorTileKey: "biome_venom_tile_floor_01",
    tileTint: 0xb9d7a9,
    accentColor: 0x93bd7c,
    hazeAlpha: 0.1
  },
  bone_throne: {
    floorTileKey: "biome_bone_tile_floor_01",
    tileTint: 0xe4d6d6,
    accentColor: 0xd4b5b5,
    hazeAlpha: 0.09
  }
};

export function resolveBiomeVisualThemeById(biomeId: BiomeDef["id"]): BiomeVisualTheme {
  return BIOME_VISUAL_THEME_REGISTRY[biomeId] ?? DEFAULT_BIOME_THEME;
}

export function resolveBiomeVisualTheme(biome: Pick<BiomeDef, "id" | "floorTilesetKey">): BiomeVisualTheme {
  const fromRegistry = resolveBiomeVisualThemeById(biome.id);
  return {
    ...fromRegistry,
    floorTileKey: fromRegistry.floorTileKey || biome.floorTilesetKey || DEFAULT_BIOME_THEME.floorTileKey
  };
}
