import Phaser from "phaser";
import { isStoryBossFloor } from "@blodex/core";
import { GAME_CONFIG } from "@blodex/content";
import type { ProgressionRuntimeHost } from "./types";

export function resolveBossNodeTextureKey(runInEndless: boolean, nextFloor: number): string | undefined {
  if (runInEndless) {
    return undefined;
  }
  const storyMaxFloor = GAME_CONFIG.maxFloors ?? 8;
  return isStoryBossFloor(nextFloor, storyMaxFloor) ? "boss_node_marker_01" : undefined;
}

export function resolveBiomeTransitionPanelAssetId(biomeId: string): string | undefined {
  switch (biomeId) {
    case "forgotten_catacombs":
      return "biome_transition_panel_catacombs_01";
    case "molten_caverns":
      return "biome_transition_panel_molten_01";
    case "frozen_halls":
      return "biome_transition_panel_frozen_01";
    case "phantom_graveyard":
      return "biome_transition_panel_phantom_01";
    case "venom_swamp":
      return "biome_transition_panel_venom_01";
    case "bone_throne":
      return "biome_transition_panel_bone_01";
    default:
      return undefined;
  }
}

export function resolveBranchRouteCardAssetId(branchChoice: string | undefined): string | undefined {
  if (branchChoice === "molten_route") {
    return "branch_route_card_molten_01";
  }
  if (branchChoice === "frozen_route") {
    return "branch_route_card_frozen_01";
  }
  return undefined;
}

export function spawnChallengeWorldMarker(
  host: ProgressionRuntimeHost,
  center: { x: number; y: number }
): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
  const tint =
    host.floorConfig.pacingKind === "preparation"
      ? 0xc9d6e8
      : host.floorConfig.pacingKind === "recovery"
        ? 0xd9c48c
        : 0x9c6ac4;
  const alpha = host.floorConfig.pacingKind === "combat" ? 0.2 : 0.28;
  const challengeMarker =
    host.renderSystem.spawnWorldMarker?.(center, "node_challenge_marker_01", host.origin, {
      width: host.floorConfig.pacingKind === "combat" ? 36 : 42,
      height: host.floorConfig.pacingKind === "combat" ? 36 : 42
    }) ?? host.renderSystem.spawnTelegraphCircle(center, host.floorConfig.pacingKind === "combat" ? 0.95 : 1.05, host.origin);
  challengeMarker.setAlpha(alpha);
  if (challengeMarker instanceof Phaser.GameObjects.Image) {
    challengeMarker.setTint(tint);
  }
  return challengeMarker;
}
