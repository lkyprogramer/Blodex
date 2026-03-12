import type { RandomEventDef } from "@blodex/core";
import type { FloorPacingKind } from "@blodex/content";

export function buildFloorTransitionCopy(options: {
  floor: number;
  biomeName: string;
  pacingKind?: FloorPacingKind;
}): { title: string; subtitle: string } {
  const { floor, biomeName, pacingKind } = options;
  if (pacingKind === "recovery") {
    return {
      title: "Recovery Window",
      subtitle: `${biomeName} · Reset build, route, and resources.`
    };
  }
  if (pacingKind === "preparation") {
    return {
      title: "Final Preparation",
      subtitle: `${biomeName} · Settle the build before the last ascent.`
    };
  }
  return {
    title: `Floor ${floor}`,
    subtitle: biomeName
  };
}

export function buildChallengeRoomEventDef(options: {
  roomId: string;
  floor: number;
  waveTotal: number;
  artAssetId?: string;
}): RandomEventDef {
  const { roomId, floor, waveTotal, artAssetId } = options;
  return {
    id: `challenge_${roomId}`,
    name: "Challenge Room",
    description: `A sealed proving ground blocks the ascent. Survive ${waveTotal} timed waves for bonus rewards.`,
    ...(artAssetId === undefined ? {} : { artAssetId }),
    badgeAssetId: "node_challenge_marker_01",
    floorRange: { min: floor, max: floor },
    spawnWeight: 1,
    choices: [
      {
        id: "enter",
        name: "Enter Challenge",
        description: "Commit to the pressure spike before moving on.",
        rewards: []
      },
      {
        id: "skip",
        name: "Leave",
        description: "Keep the floor calm and preserve the prep window.",
        rewards: []
      }
    ]
  };
}
