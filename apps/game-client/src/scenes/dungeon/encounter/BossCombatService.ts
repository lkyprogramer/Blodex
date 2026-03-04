import {
  applyDamageToBoss,
  markBossAttackUsed,
  resolveBossAttack,
  resolveEquippedWeaponType,
  resolveWeaponTypeDef,
  selectBossAttack
} from "@blodex/core";
import { WEAPON_TYPE_DEF_MAP } from "@blodex/content";
import { BossSpawnService } from "./BossSpawnService";

type BossHost = Record<string, any>;

export interface BossCombatServiceOptions {
  host: BossHost;
  spawnService: BossSpawnService;
}

export class BossCombatService {
  constructor(private readonly options: BossCombatServiceOptions) {}

  updateCombat(nowMs: number): void {
    const host = this.options.host;
    if (!host.floorConfig.isBossFloor || host.bossState === null) {
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

    if (nowMs < host.nextBossAttackAt) {
      return;
    }

    const attack = selectBossAttack(host.bossState, host.bossDef, nowMs, host.bossRng);
    if (attack === null) {
      return;
    }

    const attackResult = resolveBossAttack(attack, host.bossState, host.player, host.bossRng, nowMs);
    host.player = attackResult.player;
    host.emitCombatEvents(attackResult.events);

    if (attack.type === "summon") {
      host.eventBus.emit("boss:summon", {
        bossId: host.bossDef.id,
        attack,
        count: attackResult.summonCount ?? 2,
        timestampMs: nowMs
      });
      this.options.spawnService.spawnSummonedMonsters(attackResult.summonCount ?? 2);
    }

    host.bossState = markBossAttackUsed(host.bossState, attack, nowMs);
    host.nextBossAttackAt = nowMs + Math.max(800, attack.cooldownMs * 0.4);
    host.hudDirty = true;
  }
}
