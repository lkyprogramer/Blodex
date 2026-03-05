import {
  addRunObols,
  applyXpGain,
  deriveStats,
  resolveEquippedWeaponType,
  resolveMonsterAttack,
  resolvePlayerAttack,
  resolveSpecialAffixTotals,
  resolveWeaponTypeDef,
  rollItemDrop,
  type SkillDef,
  type SkillResolution,
  resolveSkill,
  type CombatEvent,
  type EquipmentSlot,
  type ItemDef,
  type ItemInstance,
  type LootTableDef,
  type RngLike,
  type PlayerState,
  type RunState,
  type WeaponType,
  type WeaponTypeDef
} from "@blodex/core";
import type { MonsterRuntime } from "./EntityManager";

interface PlayerCombatContext {
  player: PlayerState;
  run: RunState;
  monsters: MonsterRuntime[];
  attackTargetId: string | null;
  nextPlayerAttackAt: number;
  nowMs: number;
  combatRng: RngLike;
  lootRng: RngLike;
  itemDefs: Record<string, ItemDef>;
  lootTables: Record<string, LootTableDef>;
  attackSpeedMultiplier?: number;
  weaponTypeDefs?: Partial<Record<WeaponType, WeaponTypeDef>>;
  canDropItemDef?: (itemDef: ItemDef) => boolean;
  slotWeightMultiplier?: Partial<Record<EquipmentSlot, number>>;
}

export interface PlayerCombatResult {
  player: PlayerState;
  run: RunState;
  attackTargetId: string | null;
  nextPlayerAttackAt: number;
  requestPathTarget?: { x: number; y: number };
  killedMonsterId?: string;
  droppedItem?: {
    item: ItemInstance;
    position: { x: number; y: number };
    sourceId: string;
  };
  combatEvents: CombatEvent[];
  leveledUp: boolean;
  levelsGained: number;
}

export interface MonsterCombatResult {
  player: PlayerState;
  combatEvents: CombatEvent[];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const PLAYER_MELEE_RANGE = 1.5;
const AUTO_TARGET_ACQUIRE_RANGE = 2.25;

type TargetSource = "manual" | "auto";

function resolvePreferredTarget(
  monsters: MonsterRuntime[],
  playerPosition: { x: number; y: number },
  requestedTargetId: string | null
): { target?: MonsterRuntime; source?: TargetSource } {
  if (requestedTargetId !== null) {
    const requested = monsters.find((monster) => monster.state.id === requestedTargetId);
    if (requested !== undefined && requested.state.health > 0) {
      return { target: requested, source: "manual" };
    }
  }

  let nearest: MonsterRuntime | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const monster of monsters) {
    if (monster.state.health <= 0) {
      continue;
    }
    const dist = distance(playerPosition, monster.state.position);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearest = monster;
    }
  }
  if (nearest === undefined || nearestDistance > AUTO_TARGET_ACQUIRE_RANGE) {
    return {};
  }
  return { target: nearest, source: "auto" };
}

export class CombatSystem {
  private readonly staggerUntilByMonsterId = new Map<string, number>();

  private resolveWeaponDef(
    player: PlayerState,
    weaponTypeDefs: Partial<Record<WeaponType, WeaponTypeDef>> | undefined
  ): WeaponTypeDef {
    const weaponType = resolveEquippedWeaponType(player);
    return resolveWeaponTypeDef(weaponType, weaponTypeDefs ?? {});
  }

  private applyAxeCleave(
    monsters: MonsterRuntime[],
    primaryTargetId: string,
    primaryTargetPosition: { x: number; y: number },
    amount: number,
    radius: number,
    secondaryDamagePercent: number,
    playerId: string,
    nowMs: number
  ): CombatEvent[] {
    const events: CombatEvent[] = [];
    const secondaryDamage = Math.max(1, Math.floor(amount * Math.max(0, secondaryDamagePercent)));
    for (const monster of monsters) {
      if (monster.state.id === primaryTargetId || monster.state.health <= 0) {
        continue;
      }
      if (distance(monster.state.position, primaryTargetPosition) > radius) {
        continue;
      }
      const nextHealth = Math.max(1, monster.state.health - secondaryDamage);
      const appliedDamage = monster.state.health - nextHealth;
      if (appliedDamage <= 0) {
        continue;
      }
      monster.state = {
        ...monster.state,
        health: nextHealth
      };
      events.push({
        kind: "damage",
        sourceId: playerId,
        targetId: monster.state.id,
        amount: appliedDamage,
        damageType: "physical",
        timestampMs: nowMs
      });
    }
    return events;
  }

  updatePlayerAttack(context: PlayerCombatContext): PlayerCombatResult {
    const { target, source } = resolvePreferredTarget(
      context.monsters,
      context.player.position,
      context.attackTargetId
    );
    const activeTargetId = target?.state.id ?? null;

    if (target === undefined || target.state.health <= 0) {
      return {
        player: context.player,
        run: context.run,
        attackTargetId: null,
        nextPlayerAttackAt: context.nextPlayerAttackAt,
        combatEvents: [],
        leveledUp: false,
        levelsGained: 0
      };
    }

    const weaponDef = this.resolveWeaponDef(context.player, context.weaponTypeDefs);
    const effectiveMeleeRange = Math.max(0.5, weaponDef.attackRange);
    const dist = distance(context.player.position, target.state.position);
    if (dist > effectiveMeleeRange) {
      if (source !== "manual") {
        return {
          player: context.player,
          run: context.run,
          attackTargetId: null,
          nextPlayerAttackAt: context.nextPlayerAttackAt,
          combatEvents: [],
          leveledUp: false,
          levelsGained: 0
        };
      }
      return {
        player: context.player,
        run: context.run,
        attackTargetId: activeTargetId,
        nextPlayerAttackAt: context.nextPlayerAttackAt,
        requestPathTarget: {
          x: Math.round(target.state.position.x),
          y: Math.round(target.state.position.y)
        },
        combatEvents: [],
        leveledUp: false,
        levelsGained: 0
      };
    }

    if (context.nowMs < context.nextPlayerAttackAt) {
      return {
        player: context.player,
        run: context.run,
        attackTargetId: activeTargetId,
        nextPlayerAttackAt: context.nextPlayerAttackAt,
        combatEvents: [],
        leveledUp: false,
        levelsGained: 0
      };
    }

    const effectiveAttackSpeedMultiplier = Math.max(
      0.2,
      (context.attackSpeedMultiplier ?? 1) * Math.max(0.2, weaponDef.attackSpeedMultiplier)
    );
    const equippedItems = Object.values(context.player.equipment).filter(
      (item): item is ItemInstance => item !== undefined
    );
    const specialAffixTotals = resolveSpecialAffixTotals(equippedItems);
    const nextPlayerAttackAt =
      context.nowMs + 1000 / Math.max(0.6, context.player.derivedStats.attackSpeed * effectiveAttackSpeedMultiplier);
    const result = resolvePlayerAttack(context.player, target.state, context.combatRng, context.nowMs, {
      damageMultiplier: weaponDef.damageMultiplier,
      specialAffixTotals,
      ...(weaponDef.mechanic.type === "crit_bonus"
        ? {
            critChanceBonus: weaponDef.mechanic.critChanceBonus,
            critDamageMultiplier: weaponDef.mechanic.critDamageMultiplier
          }
        : {})
    });
    const resolvedPlayer = result.player;
    target.state = result.monster;
    let weaponEvents: CombatEvent[] = [];
    const primaryDamage = result.events.find((event) => event.kind === "damage" || event.kind === "crit")?.amount ?? 0;
    if (weaponDef.mechanic.type === "aoe_cleave" && primaryDamage > 0) {
      weaponEvents = this.applyAxeCleave(
        context.monsters,
        target.state.id,
        target.state.position,
        primaryDamage,
        weaponDef.mechanic.radius * (1 + specialAffixTotals.aoeRadius),
        weaponDef.mechanic.secondaryDamagePercent,
        context.player.id,
        context.nowMs
      );
    } else if (
      weaponDef.mechanic.type === "stagger" &&
      target.state.health > 0 &&
      context.combatRng.next() < weaponDef.mechanic.chance
    ) {
      this.staggerUntilByMonsterId.set(target.state.id, context.nowMs + weaponDef.mechanic.durationMs);
    }
    const mergedEvents = [...result.events, ...weaponEvents];

    if (target.state.health > 0) {
      return {
        player: resolvedPlayer,
        run: context.run,
        attackTargetId: activeTargetId,
        nextPlayerAttackAt,
        combatEvents: mergedEvents,
        leveledUp: false,
        levelsGained: 0
      };
    }

    this.staggerUntilByMonsterId.delete(target.state.id);

    const nextKills = context.run.kills + 1;
    const xpResult = applyXpGain(resolvedPlayer, target.state.xpValue, "manual", {
      xpBonus: specialAffixTotals.xpBonus
    });
    const nextDerived = deriveStats(
      xpResult.player.baseStats,
      equippedItems
    );

    const nextPlayer = {
      ...xpResult.player,
      derivedStats: nextDerived,
      health: Math.min(xpResult.player.health + 12, nextDerived.maxHealth),
      mana: Math.min(xpResult.player.mana + 4, nextDerived.maxMana)
    };

    const lootTable = context.lootTables[target.state.dropTableId];
    const droppedItem =
      lootTable === undefined
        ? undefined
        : rollItemDrop(
            lootTable,
            context.itemDefs,
            context.run.currentFloor,
            context.lootRng,
            `${context.run.currentFloor}-${target.state.id}-${nextKills}`,
            context.canDropItemDef === undefined
              ? undefined
              : {
                  isItemEligible: context.canDropItemDef,
                  ...(context.slotWeightMultiplier === undefined
                    ? {}
                    : { slotWeightMultiplier: context.slotWeightMultiplier })
                }
          );

    const droppedItemPayload =
      droppedItem === null || droppedItem === undefined
        ? undefined
        : {
            item: droppedItem,
            position: { ...target.state.position },
            sourceId: target.state.id
          };

    return {
      player: nextPlayer,
      run: {
        ...addRunObols(context.run, 1),
        kills: nextKills,
        totalKills: context.run.totalKills + 1,
        endlessKills: (context.run.endlessKills ?? 0) + (context.run.inEndless ? 1 : 0)
      },
      attackTargetId: null,
      nextPlayerAttackAt,
      killedMonsterId: target.state.id,
      combatEvents: mergedEvents,
      leveledUp: xpResult.leveledUp,
      levelsGained: xpResult.levelsGained,
      ...(droppedItemPayload === undefined ? {} : { droppedItem: droppedItemPayload })
    };
  }

  useSkill(
    player: PlayerState,
    monsters: MonsterRuntime[],
    skillDef: SkillDef,
    rng: RngLike,
    nowMs: number,
    weaponTypeDefs?: Partial<Record<WeaponType, WeaponTypeDef>>
  ): SkillResolution {
    const weaponDef = this.resolveWeaponDef(player, weaponTypeDefs);
    const skillDamageMultiplier =
      weaponDef.mechanic.type === "skill_amp" ? 1 + weaponDef.mechanic.skillDamagePercent : 1;
    const specialAffixTotals = resolveSpecialAffixTotals(
      Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );
    const snapshot = monsters.map((monster) => monster.state);
    const resolution = resolveSkill(player, snapshot, skillDef, rng, nowMs, {
      damageMultiplier: skillDamageMultiplier,
      specialAffixTotals
    });
    const byId = new Map(resolution.affectedMonsters.map((monster) => [monster.id, monster]));
    for (const monster of monsters) {
      const next = byId.get(monster.state.id);
      if (next !== undefined) {
        monster.state = next;
      }
    }
    return resolution;
  }

  updateMonsterAttacks(
    monsters: MonsterRuntime[],
    player: PlayerState,
    nowMs: number,
    combatRng: RngLike
  ): MonsterCombatResult {
    const events: CombatEvent[] = [];
    let nextPlayer = player;
    const specialAffixTotals = resolveSpecialAffixTotals(
      Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );

    for (const monster of monsters) {
      if (monster.state.health <= 0 || monster.state.aiState !== "attack") {
        this.staggerUntilByMonsterId.delete(monster.state.id);
        continue;
      }

      const staggerUntilMs = this.staggerUntilByMonsterId.get(monster.state.id) ?? 0;
      if (nowMs < staggerUntilMs) {
        continue;
      }

      if (distance(monster.state.position, nextPlayer.position) > monster.state.attackRange + 0.2) {
        continue;
      }

      if (nowMs < monster.nextAttackAt) {
        continue;
      }

      monster.nextAttackAt = nowMs + monster.archetype.aiConfig.attackCooldownMs;
      const result = resolveMonsterAttack(monster.state, nextPlayer, combatRng, nowMs, specialAffixTotals);
      nextPlayer = result.player;
      monster.state = result.monster;
      events.push(...result.events);
    }

    return {
      player: nextPlayer,
      combatEvents: events
    };
  }
}
