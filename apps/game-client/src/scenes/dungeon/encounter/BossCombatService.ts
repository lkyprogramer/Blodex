import {
  applyDamageToBoss,
  type BossAttack,
  markBossAttackUsed,
  resolveBossAttack,
  resolveEquippedWeaponType,
  resolveWeaponTypeDef,
  selectBossAttack
} from "@blodex/core";
import { WEAPON_TYPE_DEF_MAP } from "@blodex/content";
import { BossSpawnService } from "./BossSpawnService";
import { BossTelegraphPresenter } from "./BossTelegraphPresenter";

type BossHost = Record<string, any>;

export interface BossCombatServiceOptions {
  host: BossHost;
  spawnService: BossSpawnService;
  telegraphPresenter: BossTelegraphPresenter;
}

export class BossCombatService {
  constructor(private readonly options: BossCombatServiceOptions) {}

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
    const bonusAttackSpeed = host.resolveMutationAttackSpeedMultiplier(nowMs);
    const critChanceBonus = weaponDef.mechanic.type === "crit_bonus" ? weaponDef.mechanic.critChanceBonus : 0;
    const critDamageMultiplier =
      weaponDef.mechanic.type === "crit_bonus" ? (weaponDef.mechanic.critDamageMultiplier ?? 1.7) : 1.7;

    if (distanceToBoss <= Math.max(1.1, weaponDef.attackRange + 0.3) && nowMs >= host.nextPlayerAttackAt) {
      const crit = host.combatRng.next() < Math.min(0.95, host.player.derivedStats.critChance + critChanceBonus);
      const damage = Math.max(
        1,
        Math.floor(host.player.derivedStats.attackPower * weaponDef.damageMultiplier * (crit ? critDamageMultiplier : 1))
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
        host.bossState = {
          ...host.bossState,
          aiState: "idle",
          telegraphEndMs: undefined,
          telegraphTarget: undefined,
          telegraphAttackId: undefined
        };
        this.options.telegraphPresenter.clear();
        return;
      }
      if (nowMs < host.bossState.telegraphEndMs) {
        return;
      }
      const telegraphedAttack = this.findAttackById(host.bossState.telegraphAttackId);
      if (telegraphedAttack === null) {
        host.bossState = {
          ...host.bossState,
          aiState: "idle",
          telegraphEndMs: undefined,
          telegraphTarget: undefined,
          telegraphAttackId: undefined
        };
        this.options.telegraphPresenter.clear();
        return;
      }
      this.resolveBossAttack(telegraphedAttack, nowMs, host.bossState.telegraphTarget, false);
      host.bossState = {
        ...host.bossState,
        aiState: "attacking",
        telegraphEndMs: undefined,
        telegraphTarget: undefined,
        telegraphAttackId: undefined
      };
      this.options.telegraphPresenter.clear();
      host.nextBossAttackAt = nowMs + Math.max(800, telegraphedAttack.cooldownMs * 0.4);
      host.hudDirty = true;
      return;
    }

    if (nowMs < host.nextBossAttackAt) {
      return;
    }

    const attack = selectBossAttack(host.bossState, host.bossDef, nowMs, host.bossRng);
    if (attack === null) {
      return;
    }

    if (attack.telegraphMs > 0) {
      const target = this.resolveTelegraphTarget(attack);
      const executeAtMs = nowMs + attack.telegraphMs;
      host.bossState = markBossAttackUsed(
        {
          ...host.bossState,
          aiState: "telegraph",
          telegraphTarget: target,
          telegraphEndMs: executeAtMs,
          telegraphAttackId: attack.id
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

    this.resolveBossAttack(attack, nowMs, undefined, true);
    host.bossState = {
      ...markBossAttackUsed(host.bossState, attack, nowMs),
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
    markCooldown: boolean
  ): void {
    const host = this.options.host;
    const attackResult = resolveBossAttack(
      attack,
      host.bossState,
      host.player,
      host.bossRng,
      nowMs,
      telegraphTarget
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
      boss: host.bossState,
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
      host.bossState = markBossAttackUsed(host.bossState, attack, nowMs);
    }
  }
}
