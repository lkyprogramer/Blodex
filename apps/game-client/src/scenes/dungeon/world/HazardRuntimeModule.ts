import Phaser from "phaser";
import {
  addRunObols,
  applyHazardDamage,
  createHazardRuntimeState,
  isInsideHazard,
  multiplyMovementModifiers,
  nextHazardTickAt,
  nextHazardTriggerAt,
  shouldRunHazardTick,
  shouldTriggerPeriodicHazard,
  type HazardRuntimeState
} from "@blodex/core";
import { HAZARD_MAP } from "@blodex/content";
import type { HazardRuntimeHost } from "./types";

export interface HazardRuntimeModuleOptions {
  host: HazardRuntimeHost;
}

export class HazardRuntimeModule {
  constructor(private readonly options: HazardRuntimeModuleOptions) {}

  clearHazards(): void {
    const host = this.options.host;
    for (const visual of host.hazardVisuals) {
      visual.destroy();
    }
    host.hazardVisuals = [];
    host.hazards = [];
    host.playerHazardContact.clear();
  }

  initializeHazards(nowMs: number): void {
    const host = this.options.host;
    if (host.floorConfig.isBossFloor) {
      return;
    }

    const hazardIds = host.currentBiome.hazardPool;
    if (hazardIds.length === 0) {
      return;
    }

    const count = host.run.currentFloor <= 2 ? 1 : host.run.currentFloor <= 4 ? 2 : 3;
    const positions = this.pickHazardPositions(count);
    for (let i = 0; i < positions.length; i += 1) {
      const position = positions[i]!;
      const hazardId = host.hazardRng.pick(hazardIds);
      const def = HAZARD_MAP[hazardId];
      if (def === undefined) {
        continue;
      }
      const runtime = createHazardRuntimeState(def, `hazard-${host.run.currentFloor}-${i}`, position, nowMs);
      host.hazards.push(runtime);
      this.addHazardVisual(runtime);
    }
  }

  resolvePlayerHazardMovementMultiplier(): number {
    const host = this.options.host;
    const modifiers: number[] = [];
    for (const hazard of host.hazards) {
      if (hazard.type !== "movement_modifier" || hazard.movementMultiplier === undefined) {
        continue;
      }
      if (isInsideHazard(host.player.position, hazard)) {
        modifiers.push(hazard.movementMultiplier);
      }
    }
    return multiplyMovementModifiers(modifiers);
  }

  updateHazards(nowMs: number): void {
    const host = this.options.host;
    if (host.hazards.length === 0) {
      return;
    }

    this.updateHazardContactEvents(nowMs);
    for (let i = 0; i < host.hazards.length; i += 1) {
      const hazard = host.hazards[i] as HazardRuntimeState;
      const visual = host.hazardVisuals[i];
      const damage = hazard.damagePerTick ?? 0;
      if (hazard.type === "damage_zone") {
        if (!shouldRunHazardTick(nowMs, hazard.nextTickAtMs)) {
          continue;
        }
        hazard.nextTickAtMs = nextHazardTickAt(nowMs, hazard.tickIntervalMs);
        if (isInsideHazard(host.player.position, hazard)) {
          this.applyHazardDamageToPlayer(hazard, damage, nowMs);
        }
        this.applyHazardDamageToMonsters(hazard, damage, nowMs);
        continue;
      }

      if (hazard.type === "periodic_trap") {
        if (visual !== undefined && hazard.nextTriggerAtMs !== undefined && hazard.telegraphMs !== undefined) {
          const telegraphStartsAt = hazard.nextTriggerAtMs - hazard.telegraphMs;
          if (nowMs >= telegraphStartsAt) {
            visual.setAlpha(Math.max(0.26, visual.alpha));
          }
        }

        if (!shouldTriggerPeriodicHazard(nowMs, hazard.nextTriggerAtMs)) {
          continue;
        }
        host.eventBus.emit("hazard:trigger", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          position: { ...hazard.position },
          radiusTiles: hazard.radiusTiles,
          timestampMs: nowMs
        });
        if (isInsideHazard(host.player.position, hazard)) {
          this.applyHazardDamageToPlayer(hazard, damage, nowMs);
        }
        this.applyHazardDamageToMonsters(hazard, damage, nowMs);
        hazard.nextTriggerAtMs = nextHazardTriggerAt(nowMs, hazard.triggerIntervalMs);
        if (visual !== undefined) {
          visual.setAlpha(0.12);
        }
      }
    }
  }

  private pickHazardPositions(count: number): Array<{ x: number; y: number }> {
    const host = this.options.host;
    const candidates = host.dungeon.spawnPoints.filter(
      (point: { x: number; y: number }) =>
        Math.hypot(point.x - host.player.position.x, point.y - host.player.position.y) >= 4
    );
    const picked: Array<{ x: number; y: number }> = [];
    const mutable = [...candidates];

    while (picked.length < count && mutable.length > 0) {
      const idx = host.hazardRng.nextInt(0, mutable.length - 1);
      const candidate = mutable.splice(idx, 1)[0];
      if (candidate === undefined) {
        break;
      }
      const tooClose = picked.some((entry) => Math.hypot(entry.x - candidate.x, entry.y - candidate.y) < 3);
      if (!tooClose) {
        picked.push({ ...candidate });
      }
    }

    return picked;
  }

  restoreHazards(snapshot: HazardRuntimeState[]): void {
    const host = this.options.host;
    host.hazards = snapshot.map((hazard: HazardRuntimeState) => ({
      ...hazard,
      position: { ...hazard.position }
    }));
    for (const hazard of host.hazards) {
      this.addHazardVisual(hazard);
    }
  }

  addHazardVisual(runtime: HazardRuntimeState): void {
    const host = this.options.host;
    const visual = host.renderSystem.spawnTelegraphCircle(runtime.position, runtime.radiusTiles, host.origin);
    const baseAlpha =
      runtime.type === "damage_zone" ? 0.22 : runtime.type === "movement_modifier" ? 0.16 : 0.12;
    visual.setAlpha(baseAlpha);
    if (visual instanceof Phaser.GameObjects.Image) {
      const tint =
        runtime.type === "damage_zone" ? 0xdb694d : runtime.type === "movement_modifier" ? 0x6aa7cf : 0xbfa4d9;
      visual.setTint(tint);
    } else if (visual instanceof Phaser.GameObjects.Ellipse) {
      const fill =
        runtime.type === "damage_zone" ? 0xdb694d : runtime.type === "movement_modifier" ? 0x6aa7cf : 0xbfa4d9;
      visual.setFillStyle(fill, baseAlpha);
    }
    host.hazardVisuals.push(visual);
  }

  private updateHazardContactEvents(nowMs: number): void {
    const host = this.options.host;
    for (const hazard of host.hazards) {
      const inside = isInsideHazard(host.player.position, hazard);
      const previous = host.playerHazardContact.get(hazard.id) === true;
      if (inside && !previous) {
        host.playerHazardContact.set(hazard.id, true);
        host.eventBus.emit("hazard:enter", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          targetId: host.player.id,
          timestampMs: nowMs
        });
      } else if (!inside && previous) {
        host.playerHazardContact.delete(hazard.id);
        host.eventBus.emit("hazard:exit", {
          hazardId: hazard.id,
          hazardType: hazard.type,
          targetId: host.player.id,
          timestampMs: nowMs
        });
      }
    }
  }

  private applyHazardDamageToPlayer(hazard: HazardRuntimeState, amount: number, nowMs: number): void {
    const host = this.options.host;
    const nextHealth = applyHazardDamage(host.player.health, amount);
    host.player = {
      ...host.player,
      health: nextHealth
    };
    host.eventBus.emit("hazard:damage", {
      hazardId: hazard.id,
      hazardType: hazard.type,
      targetId: host.player.id,
      amount,
      remainingHealth: nextHealth,
      timestampMs: nowMs
    });
    if (nextHealth <= 0) {
      host.lastDeathReason = `Fatal ${hazard.type} damage from ${hazard.defId} (${amount}).`;
    }
    host.hudDirty = true;
  }

  private applyHazardDamageToMonsters(hazard: HazardRuntimeState, amount: number, nowMs: number): void {
    const host = this.options.host;
    const deadIds: string[] = [];
    for (const monster of host.entityManager.listLivingMonsters()) {
      if (!isInsideHazard(monster.state.position, hazard)) {
        continue;
      }
      const nextHealth = applyHazardDamage(monster.state.health, amount);
      monster.state.health = nextHealth;
      host.eventBus.emit("hazard:damage", {
        hazardId: hazard.id,
        hazardType: hazard.type,
        targetId: monster.state.id,
        amount,
        remainingHealth: nextHealth,
        timestampMs: nowMs
      });
      if (nextHealth <= 0) {
        deadIds.push(monster.state.id);
      }
    }

    if (deadIds.length === 0) {
      return;
    }

    for (const monsterId of deadIds) {
      const dead = host.entityManager.removeMonsterById(monsterId);
      if (dead === null) {
        continue;
      }
      host.progressionRuntimeModule.onMonsterDefeated(dead.state, nowMs);
      for (const affixId of dead.state.affixes ?? []) {
        host.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
      }
      host.applyOnKillMutationEffects(nowMs);
      dead.sprite.destroy();
      dead.healthBarBg.destroy();
      dead.healthBarFg.destroy();
      dead.affixMarker?.destroy();
      const { obolMultiplier } = host.resolveMutationDropBonus();
      host.run = addRunObols(
        {
          ...host.run,
          kills: host.run.kills + 1,
          totalKills: host.run.totalKills + 1,
          endlessKills: (host.run.endlessKills ?? 0) + (host.run.inEndless ? 1 : 0)
        },
        Math.max(1, Math.floor(obolMultiplier))
      );
    }
    host.hudDirty = true;
  }
}
