import {
  addRunObols,
  applyXpGain,
  canUseConsumable,
  canUseSkill,
  createSkillDefForLevel,
  hasMonsterAffix,
  markSkillUsed,
  pickSkillChoicesWeighted,
  resolveHealthRegenTick,
  resolveSpecialAffixTotals,
  useConsumable,
  type ConsumableId,
  type ItemInstance,
  type SkillDef
} from "@blodex/core";
import { BLUEPRINT_DEF_MAP, SKILL_DEFS, WEAPON_TYPE_DEF_MAP } from "@blodex/content";

type PlayerActionHost = Record<string, any>;

export interface PlayerActionModuleOptions {
  host: PlayerActionHost;
}

export class PlayerActionModule {
  private healthRegenCarry = 0;

  constructor(private readonly options: PlayerActionModuleOptions) {}

  resetRuntimeState(): void {
    this.healthRegenCarry = 0;
  }

  applySpecialAffixHealthRegen(deltaMs: number): void {
    const host = this.options.host;
    const totals = resolveSpecialAffixTotals(
      Object.values(host.player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );
    if (totals.healthRegen <= 0) {
      this.healthRegenCarry = 0;
      return;
    }

    const tick = resolveHealthRegenTick(
      host.player.health,
      host.player.derivedStats.maxHealth,
      totals.healthRegen,
      deltaMs,
      this.healthRegenCarry
    );
    this.healthRegenCarry = tick.carry;
    if (tick.healed <= 0) {
      return;
    }
    host.player = {
      ...host.player,
      health: tick.health
    };
    host.hudDirty = true;
  }

  tryUseSkill(slotIndex: number): void {
    const host = this.options.host;
    if (host.player.skills === undefined || host.runEnded || host.eventPanelOpen) {
      return;
    }
    const nowMs = host.time.now;

    const slot = host.player.skills.skillSlots[slotIndex];
    if (slot === null || slot === undefined) {
      return;
    }

    const def = SKILL_DEFS.find((entry) => entry.id === slot.defId);
    if (def === undefined) {
      return;
    }
    const scaledDef = createSkillDefForLevel(def, slot.level);
    const runtimeSkillDef = host.applySynergyToSkillDef(scaledDef);
    const specialAffixTotals = resolveSpecialAffixTotals(
      Object.values(host.player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );

    if (!canUseSkill(host.player, host.player.skills, runtimeSkillDef, nowMs)) {
      return;
    }

    const monsters = host.entityManager.listMonsters();
    const resolution = host.combatSystem.useSkill(
      host.player,
      monsters,
      runtimeSkillDef as SkillDef,
      host.skillRng,
      nowMs,
      WEAPON_TYPE_DEF_MAP
    );
    host.player = {
      ...resolution.player,
      skills: markSkillUsed(host.player.skills, runtimeSkillDef as SkillDef, nowMs, {
        cooldownReduction: specialAffixTotals.cooldownReduction
      })
    };

    let kills = 0;
    for (const event of resolution.events) {
      if (event.kind !== "death") {
        continue;
      }
      const dead = host.entityManager.removeMonsterById(event.targetId);
      if (dead !== null) {
        host.progressionRuntimeModule.onMonsterDefeated(dead.state, nowMs);
        dead.sprite.destroy();
        dead.healthBarBg.destroy();
        dead.healthBarFg.destroy();
        dead.affixMarker?.destroy();
        for (const affixId of dead.state.affixes ?? []) {
          host.tryDiscoverBlueprints("monster_affix", nowMs, affixId);
        }
        host.applyOnKillMutationEffects(nowMs);
        if (hasMonsterAffix(dead.state, "splitting")) {
          host.spawnSplitChildren(dead.state, dead.archetype, nowMs);
        }

        const xpResult = applyXpGain(host.player, dead.state.xpValue, "strength", {
          xpBonus: specialAffixTotals.xpBonus
        });
        host.player = host.refreshPlayerStatsFromEquipment(xpResult.player);
      }
      kills += 1;
    }

    if (kills > 0) {
      const { obolMultiplier } = host.resolveMutationDropBonus();
      host.run = addRunObols(
        {
          ...host.run,
          kills: host.run.kills + kills,
          totalKills: host.run.totalKills + kills,
          endlessKills: (host.run.endlessKills ?? 0) + (host.run.inEndless ? kills : 0)
        },
        Math.max(kills, Math.floor(kills * obolMultiplier))
      );
    }

    host.eventBus.emit("skill:use", {
      playerId: host.player.id,
      skillId: def.id,
      timestampMs: nowMs,
      resolution
    });
    host.eventBus.emit("skill:cooldown", {
      playerId: host.player.id,
      skillId: def.id,
      readyAtMs: host.player.skills?.cooldowns[def.id] ?? nowMs
    });
    host.refreshSynergyRuntime();
    host.hudDirty = true;
  }

  tryUseConsumable(consumableId: ConsumableId): void {
    const host = this.options.host;
    if (host.runEnded || host.eventPanelOpen) {
      return;
    }
    const nowMs = host.time.now;
    const availability = canUseConsumable(host.player, host.consumables, consumableId, nowMs);
    if (!availability.ok) {
      host.eventBus.emit("consumable:failed", {
        playerId: host.player.id,
        consumableId,
        reason: availability.reason,
        timestampMs: nowMs
      });
      return;
    }

    const result = useConsumable(host.player, host.consumables, consumableId, nowMs);
    host.player = result.player;
    host.consumables = result.consumables;
    if (consumableId === "health_potion") {
      const potionEffects = host.collectMutationEffects("potion_heal_amp_and_self_damage");
      if (potionEffects.length > 0) {
        const healPercent = potionEffects.reduce((sum: number, effect: { healPercent: number }) => sum + effect.healPercent, 0);
        const selfDamagePercent = potionEffects.reduce(
          (sum: number, effect: { selfDamageCurrentHpPercent: number }) => sum + effect.selfDamageCurrentHpPercent,
          0
        );
        const extraHeal = Math.max(0, Math.floor(result.amountApplied * healPercent));
        const healedHealth = Math.min(host.player.derivedStats.maxHealth, host.player.health + extraHeal);
        const selfDamage = Math.max(0, Math.floor(healedHealth * selfDamagePercent));
        host.player = {
          ...host.player,
          health: Math.max(1, healedHealth - selfDamage)
        };
        host.eventBus.emit("mutation:trigger", {
          mutationId: "runtime:potion_tradeoff",
          effectType: "potion_heal_amp_and_self_damage",
          timestampMs: nowMs,
          value: extraHeal - selfDamage
        });
      }
    }
    if (result.mappingRevealed) {
      host.mapRevealActive = true;
      host.runLog.appendKey("log.run.objective_mapped", undefined, "info", nowMs);
    }
    host.eventBus.emit("consumable:use", {
      playerId: host.player.id,
      consumableId,
      amountApplied: result.amountApplied,
      remainingCharges: host.consumables.charges[consumableId] ?? 0,
      timestampMs: nowMs
    });
    host.hudDirty = true;
  }

  offerLevelupSkill(): void {
    const host = this.options.host;
    if (host.player.skills === undefined) {
      return;
    }

    const forgedSkillUnlocks = new Set(
      host.meta.blueprintForgedIds
        .map((blueprintId: string) => BLUEPRINT_DEF_MAP[blueprintId])
        .filter((blueprint: { category?: string } | undefined) => blueprint?.category === "skill")
        .map((blueprint: { unlockTargetId?: string } | undefined) => blueprint?.unlockTargetId)
        .filter((skillId: string | undefined): skillId is string => typeof skillId === "string")
    );
    const pool = SKILL_DEFS.filter((skill) => {
      if (skill.unlockCondition === undefined) {
        return true;
      }
      return host.meta.unlocks.includes(skill.unlockCondition) || forgedSkillUnlocks.has(skill.unlockCondition);
    });
    const ownedSkillIds = host.player.skills.skillSlots
      .filter((entry: NonNullable<(typeof host.player.skills.skillSlots)[number]> | null) => entry !== null)
      .map((entry: NonNullable<(typeof host.player.skills.skillSlots)[number]>) => entry.defId);
    const strongestStat =
      host.player.baseStats.strength >= host.player.baseStats.dexterity &&
      host.player.baseStats.strength >= host.player.baseStats.intelligence
        ? "strength"
        : host.player.baseStats.dexterity >= host.player.baseStats.intelligence
          ? "dexterity"
          : "intelligence";
    const choices = pickSkillChoicesWeighted(
      pool,
      host.skillRng,
      {
        strongestStat,
        ownedSkillIds
      },
      3
    );
    if (choices.length === 0) {
      return;
    }

    const pick = choices[0]!;
    const slots = [...host.player.skills.skillSlots];
    const existingIndex = slots.findIndex((entry) => entry?.defId === pick.id);
    if (existingIndex >= 0) {
      const existing = slots[existingIndex];
      if (existing !== null && existing !== undefined) {
        slots[existingIndex] = {
          defId: existing.defId,
          level: Math.min(3, existing.level + 1)
        };
      }
    } else {
      const firstEmpty = slots.findIndex((entry) => entry === null);
      if (firstEmpty >= 0) {
        slots[firstEmpty] = { defId: pick.id, level: 1 };
      } else {
        slots[0] = { defId: pick.id, level: 1 };
      }
    }

    host.player = {
      ...host.player,
      skills: {
        ...host.player.skills,
        skillSlots: slots
      }
    };
    host.refreshSynergyRuntime();
    host.hudDirty = true;
    host.scheduleRunSave();
  }
}
