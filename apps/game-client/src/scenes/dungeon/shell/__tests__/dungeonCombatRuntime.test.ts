import { describe, expect, it, vi } from "vitest";
import type { CombatEvent, PlayerState } from "@blodex/core";
import type { MonsterRuntime } from "../../../../systems/EntityManager";
import { DungeonCombatRuntime, type DungeonCombatSource } from "../DungeonCombatRuntime";

function createPlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    id: "player-1",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    health: 20,
    mana: 0,
    baseStats: {
      strength: 10,
      dexterity: 10,
      vitality: 10,
      intelligence: 10
    },
    derivedStats: {
      maxHealth: 20,
      maxMana: 10,
      armor: 0,
      attackPower: 10,
      critChance: 0,
      attackSpeed: 1,
      moveSpeed: 120
    },
    inventory: [],
    equipment: {},
    gold: 0,
    skills: {
      skillSlots: [],
      cooldowns: {}
    },
    activeBuffs: [],
    ...(overrides ?? {})
  };
}

function createProjectileSprite() {
  return {
    active: true,
    setPosition() {
      return this;
    },
    setDepth() {
      return this;
    },
    destroy() {
      this.active = false;
    }
  };
}

function createRangedMonster(id: string, damage: number, nextAttackAt = 0): MonsterRuntime {
  return {
    state: {
      id,
      archetypeId: "ranged_caster",
      level: 1,
      health: 30,
      maxHealth: 30,
      damage,
      attackRange: 5,
      moveSpeed: 100,
      xpValue: 6,
      dropTableId: "starter_floor",
      position: { x: 4, y: 0 },
      aiState: "attack",
      aiBehavior: "kite"
    },
    archetype: {
      id: "ranged_caster",
      name: "Ash Acolyte",
      attackType: "ranged",
      healthMultiplier: 1,
      damageMultiplier: 1,
      attackRange: 5,
      moveSpeed: 100,
      xpValue: 6,
      spriteId: "monster_ranged_01",
      dropTableId: "starter_floor",
      aiConfig: {
        behavior: "kite",
        chaseRange: 8,
        attackCooldownMs: 1000,
        preferredDistance: 4
      }
    },
    baseMoveSpeed: 100,
    sprite: { destroy() {} } as MonsterRuntime["sprite"],
    healthBarBg: { destroy() {} } as MonsterRuntime["healthBarBg"],
    healthBarFg: { destroy() {} } as MonsterRuntime["healthBarFg"],
    affixMarker: undefined,
    healthBarYOffset: 0,
    yOffset: 0,
    nextAttackAt,
    nextSupportAt: 0
  };
}

function createSource(args?: {
  monsters?: MonsterRuntime[];
  player?: PlayerState;
  canMonsterAttack?: (monster: MonsterRuntime, player: PlayerState, nowMs: number) => boolean;
}): { source: DungeonCombatSource; emitted: Array<{ event: string; payload: unknown }>; monsters: MonsterRuntime[] } {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const monsters = args?.monsters ?? [];
  const source = {
    floorConfig: { isBossFloor: false },
    combatSystem: {
      updatePlayerAttack: vi.fn(),
      updateMonsterAttacks: vi.fn((monsterList: MonsterRuntime[], player: PlayerState) => ({
        player,
        combatEvents: [] as CombatEvent[]
      })),
      canMonsterAttack: vi.fn(args?.canMonsterAttack ?? (() => true))
    },
    aiSystem: {
      updateMonsters: vi.fn(() => ({ transitions: [], supportActions: [] }))
    },
    entityManager: {
      queryMonstersInRadius: vi.fn(() => monsters),
      findMonsterById: vi.fn((monsterId: string) => monsters.find((monster) => monster.state.id === monsterId)),
      removeMonsterById: vi.fn(() => null)
    },
    renderSystem: {
      spawnMonster: vi.fn(),
      spawnProjectile: vi.fn(() => createProjectileSprite()),
      syncProjectileSprite: vi.fn()
    },
    powerSpikeRuntimeModule: {
      spawnLootDrop: vi.fn()
    },
    progressionRuntimeModule: {
      onMonsterDefeated: vi.fn()
    },
    heartbeatFeedbackRuntime: {
      maybeQueueEquipmentCompare: vi.fn()
    },
    phase6Telemetry: {
      recordCombatEvents: vi.fn()
    },
    tasteRuntime: {
      recordKeyKill: vi.fn(),
      recordPickup: vi.fn()
    },
    contentLocalizer: {
      monsterName: (_id: string, fallback: string) => fallback
    },
    eventBus: {
      emit: vi.fn((event: string, payload: unknown) => {
        emitted.push({ event, payload });
      })
    },
    runLog: {
      appendKey: vi.fn()
    },
    currentBiome: {},
    player: args?.player ?? createPlayer(),
    run: {
      currentFloor: 1,
      kills: 0,
      totalKills: 0,
      endlessKills: 0,
      inEndless: false,
      lootCollected: 0
    },
    attackTargetId: null,
    dodgeRuntimeState: {
      autoTargetSuppressed: false
    },
    nextPlayerAttackAt: 0,
    combatRng: {
      next: () => 0.5
    },
    lootRng: {
      next: () => 0.5,
      nextInt: () => 0,
      pick: <T>(items: T[]) => items[0]
    },
    path: [],
    manualMoveTarget: null,
    manualMoveTargetFailures: 0,
    hudDirty: false,
    mutationRuntime: {
      onHitInvulnUntilMs: 0,
      onHitInvulnCooldownUntilMs: 0,
      lethalGuardUsedFloors: new Set<number>()
    },
    nearDeathWindowArmedAtMs: null,
    nearDeathFeedbackCooldownUntilMs: 0,
    lastAiNearCount: 0,
    lastAiFarCount: 0,
    aiFrameCounter: 0,
    entityLabelById: new Map<string, string>(),
    origin: { x: 0, y: 0 },
    dungeon: {
      width: 10,
      height: 10,
      walkable: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => true))
    },
    resolveMutationAttackSpeedMultiplier: vi.fn(() => 1),
    resolveMutationDropBonus: vi.fn(() => ({ obolMultiplier: 1, soulShardMultiplier: 1 })),
    isItemDefUnlocked: vi.fn(() => true),
    computePathTo: vi.fn(() => []),
    emitCombatEvents: vi.fn(),
    handleLevelUpGain: vi.fn(),
    tryDiscoverBlueprints: vi.fn(),
    applyOnKillMutationEffects: vi.fn(),
    collectMutationEffects: vi.fn(() => []),
    refreshMonsterBuffRuntime: vi.fn(),
    recordAcquiredItemTelemetry: vi.fn()
  } as unknown as DungeonCombatSource;

  return {
    source,
    emitted,
    monsters
  };
}

describe("DungeonCombatRuntime", () => {
  it("does not fire ranged projectiles when the shared combat gate rejects the monster", () => {
    const monster = createRangedMonster("ranged-a", 6);
    const { source, emitted } = createSource({
      monsters: [monster],
      canMonsterAttack: () => false
    });
    const runtime = new DungeonCombatRuntime(() => source);

    runtime.updateMonsterCombat(1_000);

    expect(source.combatSystem.canMonsterAttack).toHaveBeenCalledWith(monster, source.player, 1_000);
    expect(emitted.filter((entry) => entry.event === "combat:projectile_fired")).toHaveLength(0);
  });

  it("does not spawn new ranged projectiles after a pending projectile kills the player in the same frame", () => {
    const monsterA = createRangedMonster("ranged-a", 50);
    const { source, emitted, monsters } = createSource({
      monsters: [monsterA],
      player: createPlayer({
        health: 10,
        derivedStats: {
          maxHealth: 10,
          maxMana: 10,
          armor: 0,
          attackPower: 10,
          critChance: 0,
          attackSpeed: 1,
          moveSpeed: 120
        }
      })
    });
    const runtime = new DungeonCombatRuntime(() => source);

    runtime.updateMonsterCombat(1_000);
    expect(emitted.filter((entry) => entry.event === "combat:projectile_fired")).toHaveLength(1);

    const monsterB = createRangedMonster("ranged-b", 8);
    monsters.push(monsterB);
    runtime.updateProjectiles(1, 1_100);
    emitted.length = 0;

    runtime.updateMonsterCombat(1_100);

    expect(source.player.health).toBe(0);
    expect(emitted.filter((entry) => entry.event === "combat:projectile_hit")).toHaveLength(1);
    expect(
      emitted.some(
        (entry) =>
          entry.event === "combat:projectile_fired" &&
          (entry.payload as { sourceId: string }).sourceId === "ranged-b"
      )
    ).toBe(false);
  });
});
