export class AISystem {
    updateMonsters(monsters, player, dt, nowMs) {
        const transitions = [];
        for (const monster of monsters) {
            if (monster.state.health <= 0) {
                continue;
            }
            const dx = player.position.x - monster.state.position.x;
            const dy = player.position.y - monster.state.position.y;
            const dist = Math.hypot(dx, dy);
            const previous = monster.state.aiState;
            if (dist <= monster.state.attackRange + 0.2) {
                monster.state.aiState = "attack";
            }
            else if (dist < monster.archetype.aiConfig.chaseRange) {
                monster.state.aiState = "chase";
                const speed = (monster.state.moveSpeed / 130) * dt;
                if (dist > 0.001) {
                    const step = Math.min(dist, speed);
                    monster.state.position.x += (dx / dist) * step;
                    monster.state.position.y += (dy / dist) * step;
                }
            }
            else {
                monster.state.aiState = "idle";
            }
            if (previous !== monster.state.aiState) {
                transitions.push({
                    monsterId: monster.state.id,
                    from: previous,
                    to: monster.state.aiState,
                    timestampMs: nowMs
                });
            }
        }
        return transitions;
    }
}
//# sourceMappingURL=AISystem.js.map