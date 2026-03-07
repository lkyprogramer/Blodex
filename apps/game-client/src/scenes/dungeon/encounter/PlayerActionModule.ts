import {
  addRunObols,
  applyXpGain,
  appendReplayInput,
  canUseConsumable,
  canUseSkill,
  createSkillDefForLevel,
  markSkillUsed,
  pickSkillChoicesWeighted,
  resolveHealthRegenTick,
  resolveSpecialAffixTotals,
  useConsumable,
  type ConsumableId,
  type ConsumableState,
  type GameEventMap,
  type ItemInstance,
  type MetaProgression,
  type MonsterState,
  type MutationEffect,
  type PlayerState,
  type RunState,
  type SkillDef,
  type SkillResolution,
  type TypedEventBus
} from "@blodex/core";
import { BLUEPRINT_DEF_MAP, SKILL_DEFS, WEAPON_TYPE_DEF_MAP } from "@blodex/content";
import type { MonsterRuntime } from "../../../systems/EntityManager";
import type { MessageParams } from "../../../i18n/types";
import type { LogLevel } from "../../../ui/Hud";

const PASSIVE_MANA_REGEN_PER_SECOND = 2;

interface PlayerActionRunLog {
  appendKey(key: string, params?: MessageParams, level?: LogLevel, timestampMs?: number): void;
}

interface PlayerActionEntityManager {
  listMonsters(): MonsterRuntime[];
  removeMonsterById(id: string): MonsterRuntime | null;
}

interface PlayerActionCombatSystem {
  useSkill(
    player: PlayerState,
    monsters: MonsterRuntime[],
    skillDef: SkillDef,
    rng: { next(): number; nextInt(min: number, max: number): number; pick<T>(items: T[]): T },
    nowMs: number,
    weaponTypeDefs: typeof WEAPON_TYPE_DEF_MAP
  ): SkillResolution;
}

export interface PlayerActionHost {
  player: PlayerState;
  run: RunState;
  runEnded: boolean;
  eventPanelOpen: boolean;
  comparePromptOpen: boolean;
  time: { now: number };
  resolveRuntimeSkillDef(skillDef: SkillDef): SkillDef;
  entityManager: PlayerActionEntityManager;
  combatSystem: PlayerActionCombatSystem;
  skillRng: { next(): number; nextInt(min: number, max: number): number; pick<T>(items: T[]): T };
  progressionRuntimeModule: {
    onMonsterDefeated(monster: MonsterState, nowMs: number): void;
  };
  tryDiscoverBlueprints(
    sourceType: "monster_affix",
    nowMs: number,
    sourceId?: string
  ): void;
  applyOnKillMutationEffects(nowMs: number): void;
  spawnSplitChildren(monster: MonsterState, archetype: MonsterRuntime["archetype"], nowMs: number): void;
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
  handleLevelUpGain(levelsGained: number, nowMs: number, source: string): void;
  resolveMutationDropBonus(): { obolMultiplier: number; soulShardMultiplier: number };
  getRunRelativeNowMs(): number;
  recordPlayerInput?(nowMs: number): void;
  recordSkillResolutionTelemetry?(resolution: SkillResolution, nowMs: number): void;
  applyResolvedBuffs?(buffs: SkillResolution["buffsApplied"], nowMs: number): void;
  eventBus: TypedEventBus<GameEventMap>;
  refreshSynergyRuntime(persistDiscovery?: boolean): void;
  hudDirty: boolean;
  consumables: ConsumableState;
  collectMutationEffects<T extends MutationEffect["type"]>(
    type: T
  ): Array<Extract<MutationEffect, { type: T }>>;
  mapRevealActive: boolean;
  runLog: PlayerActionRunLog;
  meta: Pick<MetaProgression, "blueprintForgedIds" | "unlocks">;
  scheduleRunSave(): void;
}

export interface PlayerActionModuleOptions {
  host: PlayerActionHost;
}

export interface LevelupSkillChoice {
  skillId: string;
  nextLevel: number;
  name: string;
  description: string;
  cooldownMs: number;
  manaCost: number;
}

export class PlayerActionModule {
  private healthRegenCarry = 0;
  private manaRegenCarry = 0;

  constructor(private readonly options: PlayerActionModuleOptions) {}

  resetRuntimeState(): void {
    this.healthRegenCarry = 0;
    this.manaRegenCarry = 0;
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

  applyPassiveManaRegen(deltaMs: number): void {
    const host = this.options.host;
    if (host.player.mana >= host.player.derivedStats.maxMana) {
      this.manaRegenCarry = 0;
      return;
    }
    const manaToRestore = (PASSIVE_MANA_REGEN_PER_SECOND * deltaMs) / 1000 + this.manaRegenCarry;
    const restoredMana = Math.floor(manaToRestore);
    this.manaRegenCarry = manaToRestore - restoredMana;
    if (restoredMana <= 0) {
      return;
    }
    host.player = {
      ...host.player,
      mana: Math.min(host.player.derivedStats.maxMana, host.player.mana + restoredMana)
    };
    host.hudDirty = true;
  }

  tryUseSkill(slotIndex: number): boolean {
    const host = this.options.host;
    if (host.player.skills === undefined || host.runEnded || host.eventPanelOpen || host.comparePromptOpen) {
      return false;
    }
    const nowMs = host.time.now;

    const slot = host.player.skills.skillSlots[slotIndex];
    if (slot === null || slot === undefined) {
      return false;
    }

    const def = SKILL_DEFS.find((entry) => entry.id === slot.defId);
    if (def === undefined) {
      return false;
    }
    const scaledDef = createSkillDefForLevel(def, slot.level);
    const runtimeSkillDef = host.resolveRuntimeSkillDef(scaledDef);
    const specialAffixTotals = resolveSpecialAffixTotals(
      Object.values(host.player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );

    if (!canUseSkill(host.player, host.player.skills, runtimeSkillDef, nowMs)) {
      return false;
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
        host.spawnSplitChildren(dead.state, dead.archetype, nowMs);

        const xpResult = applyXpGain(host.player, dead.state.xpValue, "manual", {
          xpBonus: specialAffixTotals.xpBonus
        });
        host.player = host.refreshPlayerStatsFromEquipment(xpResult.player);
        if (xpResult.leveledUp) {
          host.handleLevelUpGain(xpResult.levelsGained, nowMs, "skill_kill");
        }
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

    host.run = appendReplayInput(host.run, {
      type: "skill_use",
      atMs: host.getRunRelativeNowMs(),
      skillId: def.id
    });
    if (typeof host.recordPlayerInput === "function") {
      host.recordPlayerInput(nowMs);
    }
    if (typeof host.recordSkillResolutionTelemetry === "function") {
      host.recordSkillResolutionTelemetry(resolution, nowMs);
    }
    if (typeof host.applyResolvedBuffs === "function") {
      host.applyResolvedBuffs(resolution.buffsApplied, nowMs);
    } else {
      for (const buff of resolution.buffsApplied) {
        host.eventBus.emit("buff:apply", {
          buff,
          timestampMs: nowMs
        });
      }
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
    return true;
  }

  tryUseConsumable(consumableId: ConsumableId): boolean {
    const host = this.options.host;
    if (host.runEnded || host.eventPanelOpen || host.comparePromptOpen) {
      return false;
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
      return false;
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
    if (typeof host.recordPlayerInput === "function") {
      host.recordPlayerInput(nowMs);
    }
    host.hudDirty = true;
    return true;
  }

  resolveLevelupSkillChoices(): LevelupSkillChoice[] {
    const host = this.options.host;
    if (host.player.skills === undefined) {
      return [];
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
    return choices
      .map((choice) => this.resolveLevelupSkillChoiceById(choice.id))
      .filter((choice): choice is LevelupSkillChoice => choice !== null);
  }

  applyLevelupSkillChoice(skillId: string): boolean {
    const host = this.options.host;
    if (host.player.skills === undefined) {
      return false;
    }
    const pick = SKILL_DEFS.find((entry) => entry.id === skillId);
    if (pick === undefined) {
      return false;
    }

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
      pendingSkillChoices: Math.max(0, Math.floor(host.player.pendingSkillChoices ?? 0) - 1),
      skills: {
        ...host.player.skills,
        skillSlots: slots
      }
    };
    host.refreshSynergyRuntime();
    host.hudDirty = true;
    host.scheduleRunSave();
    return true;
  }

  offerLevelupSkill(): void {
    const choices = this.resolveLevelupSkillChoices();
    const pick = choices[0];
    if (pick === undefined) {
      return;
    }
    this.applyLevelupSkillChoice(pick.skillId);
  }

  resolveLevelupSkillChoiceById(skillId: string): LevelupSkillChoice | null {
    const host = this.options.host;
    if (host.player.skills === undefined) {
      return null;
    }
    const def = SKILL_DEFS.find((entry) => entry.id === skillId);
    if (def === undefined) {
      return null;
    }
    const existing = host.player.skills.skillSlots.find((entry) => entry?.defId === def.id);
    const nextLevel = existing === undefined || existing === null ? 1 : Math.min(3, existing.level + 1);
    const nextSkillDef = host.resolveRuntimeSkillDef(createSkillDefForLevel(def, nextLevel));
    return {
      skillId: def.id,
      nextLevel,
      name: def.name,
      description: def.description,
      cooldownMs: nextSkillDef.cooldownMs,
      manaCost: nextSkillDef.manaCost
    };
  }
}
