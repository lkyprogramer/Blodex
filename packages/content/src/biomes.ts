import type { BiomeDef } from "./types";

export const BIOME_DEFS: BiomeDef[] = [
  {
    id: "forgotten_catacombs",
    name: "Forgotten Catacombs",
    ambientColor: 0x11161d,
    floorTilesetKey: "tile_floor_01",
    wallStyleKey: "crypt_stone",
    roomCount: { min: 8, max: 13 },
    monsterPool: ["melee_grunt", "ranged_caster", "magma_crawler", "shadow_lurker"],
    hazardPool: ["bone_spike"],
    lootBias: {
      weapon: 1.15,
      chest: 1.1
    }
  },
  {
    id: "molten_caverns",
    name: "Molten Caverns",
    ambientColor: 0x23160f,
    floorTilesetKey: "tile_floor_01",
    wallStyleKey: "magma_rock",
    roomCount: { min: 9, max: 14 },
    monsterPool: ["magma_crawler", "ember_wraith", "flame_brute", "elite_bruiser"],
    hazardPool: ["lava_pool", "bone_spike"],
    lootBias: {
      weapon: 1.2,
      ring: 1.15
    }
  },
  {
    id: "frozen_halls",
    name: "Frozen Halls",
    ambientColor: 0x11202c,
    floorTilesetKey: "tile_floor_01",
    wallStyleKey: "ice_marble",
    roomCount: { min: 9, max: 14 },
    monsterPool: ["frost_warden", "ice_specter", "shadow_lurker", "bone_priest"],
    hazardPool: ["ice_patch", "bone_spike"],
    lootBias: {
      helm: 1.2,
      boots: 1.2
    }
  },
  {
    id: "bone_throne",
    name: "Bone Throne",
    ambientColor: 0x1a1218,
    floorTilesetKey: "tile_floor_01",
    wallStyleKey: "bone_marble",
    roomCount: { min: 1, max: 1 },
    monsterPool: ["elite_bruiser", "frost_warden", "bone_priest"],
    hazardPool: ["bone_spike", "lava_pool"],
    lootBias: {
      weapon: 1.25,
      chest: 1.15
    }
  }
];

export const BIOME_MAP: Record<BiomeDef["id"], BiomeDef> = Object.fromEntries(
  BIOME_DEFS.map((biome) => [biome.id, biome])
) as Record<BiomeDef["id"], BiomeDef>;

