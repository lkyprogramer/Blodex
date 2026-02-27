import type { HazardDef, HazardRuntimeState } from "./contracts/types";

export function createHazardRuntimeState(
  def: HazardDef,
  id: string,
  position: { x: number; y: number },
  nowMs: number
): HazardRuntimeState {
  return {
    id,
    defId: def.id,
    type: def.type,
    position: { ...position },
    radiusTiles: def.radiusTiles ?? 1.2,
    damagePerTick: def.damagePerTick,
    tickIntervalMs: def.tickIntervalMs,
    movementMultiplier: def.movementMultiplier,
    triggerIntervalMs: def.triggerIntervalMs,
    telegraphMs: def.telegraphMs,
    nextTickAtMs: def.tickIntervalMs === undefined ? undefined : nowMs + def.tickIntervalMs,
    nextTriggerAtMs: def.triggerIntervalMs === undefined ? undefined : nowMs + def.triggerIntervalMs
  };
}

export function isInsideHazard(
  position: { x: number; y: number },
  hazard: Pick<HazardRuntimeState, "position" | "radiusTiles">
): boolean {
  return (
    Math.hypot(position.x - hazard.position.x, position.y - hazard.position.y) <=
    Math.max(0.1, hazard.radiusTiles)
  );
}

export function multiplyMovementModifiers(modifiers: number[]): number {
  if (modifiers.length === 0) {
    return 1;
  }
  return modifiers.reduce((acc, value) => acc * Math.max(0, value), 1);
}

export function shouldRunHazardTick(
  nowMs: number,
  nextTickAtMs: number | undefined
): boolean {
  return nextTickAtMs !== undefined && nowMs >= nextTickAtMs;
}

export function shouldTriggerPeriodicHazard(
  nowMs: number,
  nextTriggerAtMs: number | undefined
): boolean {
  return nextTriggerAtMs !== undefined && nowMs >= nextTriggerAtMs;
}

export function nextHazardTickAt(nowMs: number, tickIntervalMs: number | undefined): number | undefined {
  if (tickIntervalMs === undefined || tickIntervalMs <= 0) {
    return undefined;
  }
  return nowMs + tickIntervalMs;
}

export function nextHazardTriggerAt(
  nowMs: number,
  triggerIntervalMs: number | undefined
): number | undefined {
  if (triggerIntervalMs === undefined || triggerIntervalMs <= 0) {
    return undefined;
  }
  return nowMs + triggerIntervalMs;
}

export function applyHazardDamage(health: number, damage: number): number {
  return Math.max(0, health - Math.max(0, damage));
}

