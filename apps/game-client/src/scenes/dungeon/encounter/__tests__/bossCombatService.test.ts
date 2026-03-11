import { describe, expect, it, vi } from "vitest";
import type { BossAttack, BossDef, PlayerState } from "@blodex/core";
import { BossCombatService } from "../BossCombatService";
import type { BossCombatHost } from "../ports";

function createPlayer(position: { x: number; y: number }): PlayerState {
  return {
    id: "player-1",
    position,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    health: 100,
    mana: 40,
    baseStats: {
      strength: 8,
      dexterity: 8,
      vitality: 8,
      intelligence: 8
    },
    derivedStats: {
      maxHealth: 100,
      maxMana: 40,
      armor: 5,
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
    activeBuffs: []
  };
}

function createAttack(): BossAttack {
  return {
    id: "bone_wave",
    type: "aoe_zone",
    damage: 20,
    range: 4,
    radius: 1.5,
    cooldownMs: 1_000,
    telegraphMs: 600
  };
}

function createBossDef(attack: BossAttack): BossDef {
  return {
    id: "bone_sovereign",
    name: "Bone Sovereign",
    spriteKey: "boss_bone_sovereign",
    baseHealth: 500,
    dropTableId: "boss_drop",
    exclusiveFloor: 8,
    phases: [
      {
        hpThreshold: 1,
        attackPattern: [attack]
      }
    ]
  };
}

function createHost(attack: BossAttack): BossCombatHost & {
  emitCombatEvents: ReturnType<typeof vi.fn>;
  eventBus: { emit: ReturnType<typeof vi.fn> };
} {
  const eventEmit = vi.fn();
  const emitCombatEvents = vi.fn();
  return {
    floorConfig: { isBossFloor: true },
    bossState: {
      bossId: "bone_sovereign",
      currentPhaseIndex: 0,
      health: 500,
      maxHealth: 500,
      attackCooldowns: {},
      position: { x: 0, y: 0 },
      aiState: "telegraph",
      telegraphAttackId: attack.id,
      telegraphEndMs: 100,
      telegraphTarget: { x: 1, y: 1 }
    },
    player: createPlayer({ x: 1, y: 1 }),
    dodgeRuntimeState: {
      readyAtMs: 0,
      iframeUntilMs: 0,
      autoTargetSuppressed: false,
      lastSuccessfulDodgeAtMs: null,
      lastMoveIntentDirection: null,
      lastFacingDirection: { x: 1, y: 0 },
      lastDodgeDirection: { x: 1, y: 0 },
      lastDodgeDirectionSource: "move_vector",
      lastResult: null
    },
    resolveMutationAttackSpeedMultiplier: vi.fn(() => 1),
    nextPlayerAttackAt: Number.POSITIVE_INFINITY,
    combatRng: {
      next: vi.fn(() => 0.99)
    },
    eventBus: {
      emit: eventEmit
    } as never,
    bossDef: createBossDef(attack),
    hudDirty: false,
    nextBossAttackAt: 0,
    bossRng: {
      next: vi.fn(() => 0.99),
      nextInt: vi.fn(() => 0),
      pick: <T>(items: T[]) => items[0] as T
    },
    emitCombatEvents
  };
}

describe("BossCombatService", () => {
  it("marks telegraphed attacks as iframe evades when dodge i-frame is active", () => {
    const attack = createAttack();
    const host = createHost(attack);
    host.dodgeRuntimeState.iframeUntilMs = 100;
    const service = new BossCombatService({
      host,
      spawnService: { spawnSummonedMonsters: vi.fn() } as never,
      telegraphPresenter: { clear: vi.fn(), show: vi.fn() } as never,
      dispatcher: { resolveActiveEncounter: vi.fn(() => ({ telegraphProfile: undefined })) } as never
    });

    service.updateCombat(100);

    expect(host.emitCombatEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "dodge"
      })
    ]);
    expect(host.player.health).toBe(100);
    expect(host.eventBus.emit).toHaveBeenCalledWith(
      "boss:attack_resolve",
      expect.objectContaining({
        result: "evaded_by_iframe"
      })
    );
  });

  it("classifies telegraphed misses as position-based evades", () => {
    const attack = createAttack();
    const host = createHost(attack);
    host.player = createPlayer({ x: 4, y: 4 });
    const service = new BossCombatService({
      host,
      spawnService: { spawnSummonedMonsters: vi.fn() } as never,
      telegraphPresenter: { clear: vi.fn(), show: vi.fn() } as never,
      dispatcher: { resolveActiveEncounter: vi.fn(() => ({ telegraphProfile: undefined })) } as never
    });

    service.updateCombat(100);

    expect(host.emitCombatEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "dodge"
      })
    ]);
    expect(host.eventBus.emit).toHaveBeenCalledWith(
      "boss:attack_resolve",
      expect.objectContaining({
        result: "evaded_by_position"
      })
    );
    expect(host.eventBus.emit).not.toHaveBeenCalledWith(
      "player:dodge",
      expect.objectContaining({
        result: "evade_success"
      })
    );
    expect(host.dodgeRuntimeState.lastResult).toBeNull();
  });

  it("promotes position evades to dodge success when the telegraph was escaped by a recent dodge", () => {
    const attack = createAttack();
    const host = createHost(attack);
    host.player = createPlayer({ x: 4, y: 4 });
    host.bossState = {
      ...host.bossState!,
      telegraphEndMs: 700
    };
    host.dodgeRuntimeState.lastSuccessfulDodgeAtMs = 150;
    const service = new BossCombatService({
      host,
      spawnService: { spawnSummonedMonsters: vi.fn() } as never,
      telegraphPresenter: { clear: vi.fn(), show: vi.fn() } as never,
      dispatcher: { resolveActiveEncounter: vi.fn(() => ({ telegraphProfile: undefined })) } as never
    });

    service.updateCombat(700);

    expect(host.eventBus.emit).toHaveBeenCalledWith(
      "player:dodge",
      expect.objectContaining({
        result: "evade_success",
        reason: "position"
      })
    );
    expect(host.dodgeRuntimeState.lastResult).toBe("evade_success");
  });

  it("does not let boss-floor auto attacks resume while auto-target is suppressed", () => {
    const attack = createAttack();
    const host = createHost(attack);
    const bossState = host.bossState!;
    const { telegraphAttackId: _telegraphAttackId, telegraphEndMs: _telegraphEndMs, telegraphTarget: _telegraphTarget, ...stableBossState } =
      bossState;
    host.bossState = {
      ...stableBossState,
      aiState: "idle",
      position: { x: 1, y: 0 }
    };
    host.nextPlayerAttackAt = 0;
    host.dodgeRuntimeState.autoTargetSuppressed = true;
    const initialHealth = host.bossState?.health ?? 0;
    const service = new BossCombatService({
      host,
      spawnService: { spawnSummonedMonsters: vi.fn() } as never,
      telegraphPresenter: { clear: vi.fn(), show: vi.fn() } as never,
      dispatcher: { resolveActiveEncounter: vi.fn(() => ({ telegraphProfile: undefined })) } as never
    });

    service.updateCombat(0);

    expect(host.bossState?.health).toBe(initialHealth);
  });
});
