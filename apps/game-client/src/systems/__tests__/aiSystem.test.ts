import { describe, expect, it } from "vitest";
import { AISystem } from "../AISystem";
import type { MonsterRuntime } from "../EntityManager";
import type { PlayerState } from "@blodex/core";

function makePlayer(position: { x: number; y: number }): PlayerState {
  return {
    id: "player",
    position,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    health: 100,
    mana: 50,
    baseStats: {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      vitality: 10
    },
    derivedStats: {
      maxHealth: 100,
      maxMana: 50,
      attackPower: 12,
      armor: 6,
      critChance: 0.05,
      attackSpeed: 1,
      moveSpeed: 130
    },
    inventory: [],
    equipment: {},
    gold: 0,
    skills: {
      skillSlots: [],
      cooldowns: {}
    },
    activeBuffs: []
  };
}

function makeMonsterRuntime(input: {
  id: string;
  behavior: "chase" | "support" | "shield" | "ambush";
  position: { x: number; y: number };
  aiState?: MonsterRuntime["state"]["aiState"];
  health?: number;
  maxHealth?: number;
  nextSupportAt?: number;
  chaseRange?: number;
  attackRange?: number;
  shieldThreshold?: number;
  supportRange?: number;
  healThreshold?: number;
  healPower?: number;
}): MonsterRuntime {
  return {
    state: {
      id: input.id,
      archetypeId: "test_archetype",
      level: 1,
      health: input.health ?? 100,
      maxHealth: input.maxHealth ?? 100,
      damage: 12,
      attackRange: input.attackRange ?? 1.2,
      moveSpeed: 130,
      xpValue: 8,
      dropTableId: "none",
      position: { ...input.position },
      aiState: input.aiState ?? "idle",
      aiBehavior: input.behavior
    },
    archetype: {
      id: "test_archetype",
      name: "Test",
      healthMultiplier: 1,
      damageMultiplier: 1,
      attackRange: input.attackRange ?? 1.2,
      moveSpeed: 130,
      attackSpeed: 1,
      xpValue: 8,
      spriteId: "monster_test",
      dropTableId: "none",
      aiConfig: {
        behavior: input.behavior,
        chaseRange: input.chaseRange ?? 8,
        attackCooldownMs: 900,
        ...(input.behavior === "support"
          ? {
              supportRange: input.supportRange ?? 4,
              healThreshold: input.healThreshold ?? 0.7,
              healPower: input.healPower ?? 20
            }
          : {}),
        ...(input.behavior === "shield"
          ? {
              shieldThreshold: input.shieldThreshold ?? 0.45
            }
          : {})
      }
    } as MonsterRuntime["archetype"],
    sprite: { destroy: () => undefined } as MonsterRuntime["sprite"],
    healthBarBg: { destroy: () => undefined } as MonsterRuntime["healthBarBg"],
    healthBarFg: { destroy: () => undefined } as MonsterRuntime["healthBarFg"],
    affixMarker: undefined,
    healthBarYOffset: 0,
    yOffset: 0,
    nextAttackAt: 0,
    nextSupportAt: input.nextSupportAt ?? 0
  };
}

describe("AISystem", () => {
  it("switches chase monster from idle to chase and moves toward player", () => {
    const ai = new AISystem();
    const player = makePlayer({ x: 0, y: 0 });
    const monster = makeMonsterRuntime({
      id: "chase-1",
      behavior: "chase",
      position: { x: 4, y: 0 },
      aiState: "idle",
      chaseRange: 8
    });

    const result = ai.updateMonsters([monster], player, 1, 1_000);

    expect(monster.state.aiState).toBe("chase");
    expect(monster.state.position.x).toBeLessThan(4);
    expect(result.transitions).toEqual([
      {
        monsterId: "chase-1",
        from: "idle",
        to: "chase",
        timestampMs: 1_000
      }
    ]);
  });

  it("emits support action when ally in range needs heal and cooldown is ready", () => {
    const ai = new AISystem();
    const player = makePlayer({ x: 10, y: 10 });
    const support = makeMonsterRuntime({
      id: "support-1",
      behavior: "support",
      position: { x: 1, y: 1 },
      aiState: "idle",
      supportRange: 3,
      healThreshold: 0.8,
      healPower: 17,
      nextSupportAt: 0
    });
    const ally = makeMonsterRuntime({
      id: "ally-1",
      behavior: "chase",
      position: { x: 1.5, y: 1.2 },
      health: 50,
      maxHealth: 100,
      aiState: "idle"
    });

    const result = ai.updateMonsters([support, ally], player, 1, 2_000);

    expect(support.state.aiState).toBe("support");
    expect(result.supportActions).toEqual([
      {
        sourceMonsterId: "support-1",
        targetMonsterId: "ally-1",
        amount: 17,
        timestampMs: 2_000
      }
    ]);
    expect(support.nextSupportAt).toBe(4_600);
  });

  it("uses shield state and retreats when shield monster hp is below threshold", () => {
    const ai = new AISystem();
    const player = makePlayer({ x: 0, y: 0 });
    const monster = makeMonsterRuntime({
      id: "shield-1",
      behavior: "shield",
      position: { x: 1.5, y: 0 },
      aiState: "idle",
      health: 20,
      maxHealth: 100,
      shieldThreshold: 0.45,
      chaseRange: 6
    });

    ai.updateMonsters([monster], player, 1, 3_000);

    expect(monster.state.aiState).toBe("shield");
    expect(monster.state.position.x).toBeGreaterThan(1.5);
  });

  it("does not cross blocked tiles when navigation walkability is provided", () => {
    const ai = new AISystem();
    const player = makePlayer({ x: 8, y: 0 });
    const monster = makeMonsterRuntime({
      id: "wall-test",
      behavior: "chase",
      position: { x: 1.4, y: 0 },
      aiState: "idle",
      chaseRange: 12
    });

    ai.updateMonsters([monster], player, 1, 4_000, {
      canMoveTo: (position) => position.x <= 1.5
    });

    expect(monster.state.aiState).toBe("chase");
    expect(monster.state.position.x).toBeLessThanOrEqual(1.5);
  });

  it("falls back to axis movement in corridor-like constraints", () => {
    const ai = new AISystem();
    const player = makePlayer({ x: 4, y: 1 });
    const monster = makeMonsterRuntime({
      id: "corridor-test",
      behavior: "chase",
      position: { x: 0, y: 0 },
      aiState: "idle",
      chaseRange: 10
    });

    ai.updateMonsters([monster], player, 1, 5_000, {
      canMoveTo: (position) => position.y <= 0.1
    });

    expect(monster.state.position.x).toBeGreaterThan(0);
    expect(monster.state.position.y).toBeLessThanOrEqual(0.1);
  });
});
