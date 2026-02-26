import { applyXpGain, deriveStats, resolveMonsterAttack, resolvePlayerAttack, rollItemDrop } from "@blodex/core";
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
export class CombatSystem {
    updatePlayerAttack(context) {
        const target = context.attackTargetId === null
            ? undefined
            : context.monsters.find((monster) => monster.state.id === context.attackTargetId);
        if (target === undefined || target.state.health <= 0) {
            return {
                player: context.player,
                run: context.run,
                attackTargetId: null,
                nextPlayerAttackAt: context.nextPlayerAttackAt,
                combatEvents: [],
                leveledUp: false
            };
        }
        const dist = distance(context.player.position, target.state.position);
        if (dist > 1.5) {
            return {
                player: context.player,
                run: context.run,
                attackTargetId: context.attackTargetId,
                nextPlayerAttackAt: context.nextPlayerAttackAt,
                requestPathTarget: {
                    x: Math.round(target.state.position.x),
                    y: Math.round(target.state.position.y)
                },
                combatEvents: [],
                leveledUp: false
            };
        }
        if (context.nowMs < context.nextPlayerAttackAt) {
            return {
                player: context.player,
                run: context.run,
                attackTargetId: context.attackTargetId,
                nextPlayerAttackAt: context.nextPlayerAttackAt,
                combatEvents: [],
                leveledUp: false
            };
        }
        const nextPlayerAttackAt = context.nowMs + 1000 / Math.max(0.6, context.player.derivedStats.attackSpeed);
        const result = resolvePlayerAttack(context.player, target.state, context.combatRng, context.nowMs);
        target.state = result.monster;
        if (target.state.health > 0) {
            return {
                player: context.player,
                run: context.run,
                attackTargetId: context.attackTargetId,
                nextPlayerAttackAt,
                combatEvents: result.events,
                leveledUp: false
            };
        }
        const nextKills = context.run.kills + 1;
        const xpResult = applyXpGain(context.player, target.state.xpValue, "strength");
        const nextDerived = deriveStats(xpResult.player.baseStats, Object.values(context.player.equipment).filter((item) => item !== undefined));
        const nextPlayer = {
            ...xpResult.player,
            derivedStats: nextDerived,
            health: Math.min(context.player.health + 12, nextDerived.maxHealth),
            mana: Math.min(context.player.mana + 4, nextDerived.maxMana)
        };
        const lootTable = context.lootTables[target.state.dropTableId];
        const droppedItem = lootTable === undefined
            ? undefined
            : rollItemDrop(lootTable, context.itemDefs, context.run.floor, context.lootRng, `${context.run.floor}-${target.state.id}-${nextKills}`);
        const droppedItemPayload = droppedItem === null || droppedItem === undefined
            ? undefined
            : {
                item: droppedItem,
                position: { ...target.state.position },
                sourceId: target.state.id
            };
        return {
            player: nextPlayer,
            run: {
                ...context.run,
                kills: nextKills
            },
            attackTargetId: null,
            nextPlayerAttackAt,
            killedMonsterId: target.state.id,
            combatEvents: result.events,
            leveledUp: xpResult.leveledUp,
            ...(droppedItemPayload === undefined ? {} : { droppedItem: droppedItemPayload })
        };
    }
    updateMonsterAttacks(monsters, player, nowMs, combatRng) {
        const events = [];
        let nextPlayer = player;
        for (const monster of monsters) {
            if (monster.state.health <= 0 || monster.state.aiState !== "attack") {
                continue;
            }
            if (distance(monster.state.position, nextPlayer.position) > monster.state.attackRange + 0.2) {
                continue;
            }
            if (nowMs < monster.nextAttackAt) {
                continue;
            }
            monster.nextAttackAt = nowMs + monster.archetype.aiConfig.attackCooldownMs;
            const result = resolveMonsterAttack(monster.state, nextPlayer, combatRng, nowMs);
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
//# sourceMappingURL=CombatSystem.js.map