import type { SkillDef, SkillResolution } from "@blodex/core";
import { directionBetween, resolveStepDisplacement } from "../shell/displacement";
import type { DodgeRuntimeState } from "../shell/dodgeTypes";

interface SkillDisplacementHost {
  player: {
    id: string;
    position: { x: number; y: number };
  };
  dodgeRuntimeState: DodgeRuntimeState;
  dungeon: {
    width: number;
    height: number;
    walkable: boolean[][];
  };
  entityManager: {
    findMonsterById(
      targetId: string
    ):
      | {
          state: {
            position: { x: number; y: number };
          };
        }
      | undefined;
  };
  eventBus: {
    emit(
      event: "player:move",
      payload: {
        playerId: string;
        from: { x: number; y: number };
        to: { x: number; y: number };
        timestampMs: number;
      }
    ): void;
  };
  path: Array<{ x: number; y: number }>;
  attackTargetId: string | null;
  manualMoveTarget: { x: number; y: number } | null;
  manualMoveTargetFailures: number;
  nextManualPathReplanAt: number;
  hudDirty: boolean;
}

export function applySkillDisplacement(
  host: SkillDisplacementHost,
  skillDef: SkillDef,
  resolution: SkillResolution,
  nowMs: number
): void {
  const displacement = skillDef.displacement;
  if (displacement === undefined) {
    return;
  }

  let direction = host.dodgeRuntimeState.lastFacingDirection;
  let stopBeforeTile: { x: number; y: number } | undefined;
  if (displacement.anchor === "target" && resolution.primaryTargetId !== undefined) {
    const target = host.entityManager.findMonsterById(resolution.primaryTargetId);
    if (target !== undefined) {
      direction = directionBetween(host.player.position, target.state.position);
      stopBeforeTile = {
        x: Math.round(target.state.position.x),
        y: Math.round(target.state.position.y)
      };
    }
  }

  if (direction === null) {
    return;
  }

  const resolved = resolveStepDisplacement({
    from: host.player.position,
    direction,
    distance: displacement.distance,
    walkable: host.dungeon.walkable,
    width: host.dungeon.width,
    height: host.dungeon.height,
    ...(stopBeforeTile === undefined ? {} : { stopBeforeTile })
  });
  host.path = [];
  host.attackTargetId = null;
  host.manualMoveTarget = null;
  host.manualMoveTargetFailures = 0;
  host.nextManualPathReplanAt = 0;
  host.dodgeRuntimeState.autoTargetSuppressed = true;
  if (resolved === null || resolved.traveledCells <= 0) {
    return;
  }

  const from = { ...host.player.position };
  host.player = {
    ...host.player,
    position: { ...resolved.to }
  };
  host.dodgeRuntimeState.lastFacingDirection = { ...resolved.direction };
  host.eventBus.emit("player:move", {
    playerId: host.player.id,
    from,
    to: { ...resolved.to },
    timestampMs: nowMs
  });
  host.hudDirty = true;
}
