import {
  applyDamageToBoss,
  resolveSpecialAffixTotals,
  type BossAttack,
  type ItemInstance,
  markBossAttackUsed,
  resolveBossAttack,
  resolveEquippedWeaponType,
  resolveWeaponTypeDef,
  selectBossAttack
} from "@blodex/core";
import { WEAPON_TYPE_DEF_MAP } from "@blodex/content";
import { BossSpawnService } from "./BossSpawnService";
import { BossTelegraphPresenter } from "./BossTelegraphPresenter";
import type { BossCombatHost } from "./ports";

export interface BossCombatServiceOptions {
  host: BossCombatHost;
  spawnService: BossSpawnService;
  telegraphPresenter: BossTelegraphPresenter;
}

export class BossCombatService {
  constructor(private readonly options: BossCombatServiceOptions) {}

  private clearTelegraphState(state: NonNullable<BossCombatHost["bossState"]>, aiState: "idle" | "attacking") {
    const { telegraphAttackId, telegraphEndMs, telegraphTarget, ...rest } = state;
    return {
      ...rest,
      aiState
    };
  }

  updateCombat(nowMs: number): void {
    const host = this.options.host;
    if (!host.floorConfig.isBossFloor || host.bossState === null) {
      this.options.telegraphPresenter.clear();
      return;
    }
    if (host.bossState.health <= 0) {
      this.options.telegraphPresenter.clear();
      return;
    }

    const distanceToBoss = Math.hypot(
      host.player.position.x - host.bossState.position.x,
      host.player.position.y - host.bossState.position.y
    );
    const weaponType = resolveEquippedWeaponType(host.player);
    const weaponDef = resolveWeaponTypeDef(weaponType, WEAPON_TYPE_DEF_MAP);
    const specialAffixTotals = resolveSpecialAffixTotals(
      Object.values(host.player.equipment).filter((item): item is ItemInstance => item !== undefined)
    );
    const bonusAttackSpeed = host.resolveMutationAttackSpeedMultiplier(nowMs);
    const critChanceBonus = weaponDef.mechanic.type === "crit_bonus" ? weaponDef.mechanic.critChanceBonus : 0;
    const critDamageMultiplier =
      weaponDef.mechanic.type === "crit_bonus" ? (weaponDef.mechanic.critDamageMultiplier ?? 1.7) : 1.7;

    if (distanceToBoss <= Math.max(1.1, weaponDef.attackRange + 0.3) && nowMs >= host.nextPlayerAttackAt) {
      const crit = host.combatRng.next() < Math.min(0.95, host.player.derivedStats.critChance + critChanceBonus);
      const effectiveCritMultiplier = Math.max(1, critDamageMultiplier * (1 + specialAffixTotals.critDamage));
      const damage = Math.max(
        1,
        Math.floor(host.player.derivedStats.attackPower * weaponDef.damageMultiplier * (crit ? effectiveCritMultiplier : 1))
      );
      const previousPhase = host.bossState.currentPhaseIndex;
      host.bossState = applyDamageToBoss(host.bossState, damage);
      host.bossState = {
        ...host.bossState,
        ...(host.bossState.health <= host.bossState.maxHealth * 0.5 && host.bossState.currentPhaseIndex === 0
          ? { currentPhaseIndex: 1 }
          : {})
      };
      host.nextPlayerAttackAt =
        nowMs +
        1000 /
          Math.max(
            0.6,
            host.player.derivedStats.attackSpeed * Math.max(0.2, weaponDef.attackSpeedMultiplier) * bonusAttackSpeed
          );

      if (specialAffixTotals.lifesteal > 0 && damage > 0) {
        const heal = Math.floor(damage * specialAffixTotals.lifesteal);
        if (heal > 0) {
          host.player = {
            ...host.player,
            health: Math.min(host.player.derivedStats.maxHealth, host.player.health + heal)
          };
        }
      }

      if (host.bossState.currentPhaseIndex !== previousPhase) {
        host.eventBus.emit("boss:phaseChange", {
          bossId: host.bossDef.id,
          fromPhase: previousPhase,
          toPhase: host.bossState.currentPhaseIndex,
          hpRatio: host.bossState.health / host.bossState.maxHealth,
          timestampMs: nowMs
        });
      }

      host.hudDirty = true;
    }

    if (host.bossState.aiState === "telegraph") {
      if (
        host.bossState.telegraphEndMs === undefined ||
        host.bossState.telegraphAttackId === undefined
      ) {
        host.bossState = this.clearTelegraphState(host.bossState, "idle");
        this.options.telegraphPresenter.clear();
        return;
      }
      if (nowMs < host.bossState.telegraphEndMs) {
        return;
      }
      const telegraphingBossState = host.bossState;
      const telegraphAttackId = telegraphingBossState.telegraphAttackId;
      if (telegraphAttackId === undefined) {
        host.bossState = this.clearTelegraphState(telegraphingBossState, "idle");
        this.options.telegraphPresenter.clear();
        return;
      }
      const telegraphedAttack = this.findAttackById(telegraphAttackId);
      if (telegraphedAttack === null) {
        host.bossState = this.clearTelegraphState(telegraphingBossState, "idle");
        this.options.telegraphPresenter.clear();
        return;
      }
      this.resolveBossAttack(
        telegraphedAttack,
        nowMs,
        telegraphingBossState.telegraphTarget,
        false,
        specialAffixTotals
      );
      host.bossState = this.clearTelegraphState(telegraphingBossState, "attacking");
      this.options.telegraphPresenter.clear();
      host.nextBossAttackAt = nowMs + Math.max(800, telegraphedAttack.cooldownMs * 0.4);
      host.hudDirty = true;
      return;
    }

    if (nowMs < host.nextBossAttackAt) {
      return;
    }

    const currentBossState = host.bossState;
    if (currentBossState === null) {
      return;
    }
    const attack = selectBossAttack(currentBossState, host.bossDef, nowMs, host.bossRng);
    if (attack === null) {
      return;
    }

    if (attack.telegraphMs > 0) {
      const target = this.resolveTelegraphTarget(attack);
      const executeAtMs = nowMs + attack.telegraphMs;
      host.bossState = markBossAttackUsed(
        {
          ...currentBossState,
          aiState: "telegraph",
          telegraphEndMs: executeAtMs,
          telegraphAttackId: attack.id,
          ...(target === undefined ? {} : { telegraphTarget: target })
        },
        attack,
        nowMs
      );
      host.nextBossAttackAt = executeAtMs;
      host.eventBus.emit("boss:attack_intent", {
        bossId: host.bossDef.id,
        attack,
        executeAtMs,
        ...(target === undefined ? {} : { target }),
        timestampMs: nowMs
      });
      this.options.telegraphPresenter.show(host.bossState, attack);
      host.hudDirty = true;
      return;
    }

    this.resolveBossAttack(attack, nowMs, undefined, true, specialAffixTotals);
    host.bossState = {
      ...markBossAttackUsed(currentBossState, attack, nowMs),
      aiState: "attacking"
    };
    host.nextBossAttackAt = nowMs + Math.max(800, attack.cooldownMs * 0.4);
    host.hudDirty = true;
  }

  private resolveTelegraphTarget(attack: BossAttack): { x: number; y: number } | undefined {
    if (attack.type === "summon") {
      return undefined;
    }
    const host = this.options.host;
    return {
      x: host.player.position.x,
      y: host.player.position.y
    };
  }

  private findAttackById(attackId: string): BossAttack | null {
    const host = this.options.host;
    if (host.bossState === null) {
      return null;
    }
    const currentPhase = host.bossDef.phases[host.bossState.currentPhaseIndex];
    const fromCurrent = currentPhase?.attackPattern.find((entry: BossAttack) => entry.id === attackId);
    if (fromCurrent !== undefined) {
      return fromCurrent;
    }
    for (const phase of host.bossDef.phases) {
      const found = phase.attackPattern.find((entry: BossAttack) => entry.id === attackId);
      if (found !== undefined) {
        return found;
      }
    }
    return null;
  }

  private resolveBossAttack(
    attack: BossAttack,
    nowMs: number,
    telegraphTarget: { x: number; y: number } | undefined,
    markCooldown: boolean,
    specialAffixTotals: ReturnType<typeof resolveSpecialAffixTotals>
  ): void {
    const host = this.options.host;
    const currentBossState = host.bossState;
    if (currentBossState === null) {
      return;
    }
    const attackResult = resolveBossAttack(
      attack,
      currentBossState,
      host.player,
      host.bossRng,
      nowMs,
      telegraphTarget,
      specialAffixTotals
    );
    host.player = attackResult.player;
    host.emitCombatEvents(attackResult.events);
    host.eventBus.emit("boss:attack_resolve", {
      bossId: host.bossDef.id,
      attack,
      ...(telegraphTarget === undefined ? {} : { target: telegraphTarget }),
      timestampMs: nowMs
    });
    host.eventBus.emit("boss:attack", {
      boss: currentBossState,
      attack,
      timestampMs: nowMs
    });

    if (attack.type === "summon") {
      host.eventBus.emit("boss:summon", {
        bossId: host.bossDef.id,
        attack,
        count: attackResult.summonCount ?? 2,
        timestampMs: nowMs
      });
      this.options.spawnService.spawnSummonedMonsters(attackResult.summonCount ?? 2);
    }

    if (markCooldown) {
      host.bossState = markBossAttackUsed(currentBossState, attack, nowMs);
    }
  }
}
