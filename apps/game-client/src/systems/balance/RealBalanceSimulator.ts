import {
  addRunObols,
  applyDamageToBoss,
  applyXpGain,
  applyLevelUpChoice,
  canUseSkill,
  createSkillDefForLevel,
  createRunState,
  defaultBaseStats,
  deriveStats,
  getDifficultyModifier,
  initBossState,
  markSkillUsed,
  markBossAttackUsed,
  resolveBranchChoiceBySeed,
  resolveBiomeForFloorBySeed,
  resolveBossAttack,
  resolveEquippedWeaponType,
  resolveHealthRegenTick,
  resolvePlayerAttack,
  resolveSpecialAffixTotals,
  resolveWeaponTypeDef,
  rollItemDrop,
  rollBossDrops,
  SeededRng,
  selectBossAttack,
  type BalanceConfig,
  type BranchChoice,
  type CombatEvent,
  type EquipmentSlot,
  type ItemInstance,
  type MonsterState,
  type PlayerState,
  type RunSimulation,
  type RunState,
  type SkillDef,
  type WeaponTypeDef,
  updateBossPhase,
  xpForNextLevel
} from "@blodex/core";
import {
  BIOME_MAP,
  BONE_SOVEREIGN,
  ITEM_DEF_MAP,
  LOOT_TABLE_MAP,
  MONSTER_ARCHETYPE_MAP,
  SKILL_DEFS,
  WEAPON_TYPE_DEF_MAP,
  type MonsterArchetypeDef
} from "@blodex/content";
import { CombatSystem } from "../CombatSystem";
import type { MonsterRuntime } from "../EntityManager";

const STORY_MAX_FLOOR = 5;
const LOOP_TICK_MS = 120;
const MAX_FLOOR_SIM_MS = 240_000;
const BOSS_EXCLUSIVE_TABLE_ID = "boss_bone_sovereign_exclusive";
const DEFAULT_SIM_SKILL_IDS = ["cleave", "shadow_step", "blade_fan"] as const;

interface SimulatedRun {
  cleared: boolean;
  floorReached: number;
  runDurationMs: number;
  hpByFloor: number[];
  deathCause: string;
  rarityCounts: Record<"common" | "magic" | "rare", number>;
  skillUses: number;
  skillDamage: number;
  autoAttackDamage: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(clamp(ratio, 0, 1) * (sorted.length - 1));
  return Number(sorted[index]?.toFixed(4) ?? 0);
}

function resolveFloorConfig(floor: number, difficulty: ReturnType<typeof getDifficultyModifier>) {
  const storyFloor = Math.min(STORY_MAX_FLOOR, Math.max(1, Math.floor(floor)));
  if (storyFloor >= STORY_MAX_FLOOR) {
    return {
      monsterHpMultiplier: 2 * difficulty.monsterHealthMultiplier,
      monsterDmgMultiplier: 1.6 * difficulty.monsterDamageMultiplier,
      monsterCount: 1
    };
  }
  const scaleIndex = storyFloor - 1;
  return {
    monsterHpMultiplier: (1 + scaleIndex * 0.25) * difficulty.monsterHealthMultiplier,
    monsterDmgMultiplier: (1 + scaleIndex * 0.15) * difficulty.monsterDamageMultiplier,
    monsterCount: 12 + scaleIndex * 2
  };
}

function createBalancePlayer(): PlayerState {
  const baseStats = defaultBaseStats();
  const derivedStats = deriveStats(baseStats, []);
  return {
    id: "balance-player",
    position: { x: 0, y: 0 },
    level: 1,
    xp: 0,
    xpToNextLevel: xpForNextLevel(1),
    pendingLevelUpChoices: 0,
    health: derivedStats.maxHealth,
    mana: derivedStats.maxMana,
    baseStats,
    derivedStats,
    inventory: [],
    equipment: {},
    gold: 0,
    skills: {
      skillSlots: DEFAULT_SIM_SKILL_IDS.map((defId) => ({
        defId,
        level: 1
      })),
      cooldowns: {}
    },
    activeBuffs: []
  };
}

function makeSpriteStub<T>(): T {
  return {
    destroy() {}
  } as T;
}

function itemScore(item: ItemInstance): number {
  const special = item.rolledSpecialAffixes ?? {};
  return (
    (item.rolledAffixes.attackPower ?? 0) * 2.2 +
    (item.rolledAffixes.armor ?? 0) * 1.4 +
    (item.rolledAffixes.maxHealth ?? 0) * 0.12 +
    (item.rolledAffixes.critChance ?? 0) * 160 +
    (item.rolledAffixes.attackSpeed ?? 0) * 32 +
    (item.rolledAffixes.moveSpeed ?? 0) * 0.08 +
    (special.critDamage ?? 0) * 120 +
    (special.lifesteal ?? 0) * 160 +
    (special.healthRegen ?? 0) * 3 +
    (special.thorns ?? 0) * 70 +
    (special.dodgeChance ?? 0) * 120
  );
}

function shouldEquipItem(
  current: ItemInstance | undefined,
  candidate: ItemInstance,
  behavior: BalanceConfig["playerBehavior"]
): boolean {
  if (current === undefined) {
    return true;
  }
  const scoreGap = itemScore(candidate) - itemScore(current);
  const threshold = behavior === "optimal" ? -2 : behavior === "average" ? 6 : 12;
  return scoreGap >= threshold;
}

function chooseLevelStat(player: PlayerState, behavior: BalanceConfig["playerBehavior"]): keyof PlayerState["baseStats"] {
  if (behavior === "optimal") {
    if (player.health / Math.max(1, player.derivedStats.maxHealth) < 0.58) {
      return "vitality";
    }
    const weaponType = resolveEquippedWeaponType(player);
    if (weaponType === "dagger" || weaponType === "sword") {
      return "dexterity";
    }
    if (weaponType === "staff") {
      return "intelligence";
    }
    return "strength";
  }
  if (behavior === "average") {
    return player.baseStats.vitality < player.baseStats.strength ? "vitality" : "strength";
  }
  return player.baseStats.vitality <= player.baseStats.dexterity ? "vitality" : "dexterity";
}

function applyPendingLevelUps(
  player: PlayerState,
  behavior: BalanceConfig["playerBehavior"]
): PlayerState {
  let next = player;
  while ((next.pendingLevelUpChoices ?? 0) > 0) {
    next = applyLevelUpChoice(next, chooseLevelStat(next, behavior));
    const equipped = Object.values(next.equipment).filter((item): item is ItemInstance => item !== undefined);
    const derivedStats = deriveStats(next.baseStats, equipped);
    next = {
      ...next,
      derivedStats,
      health: Math.min(derivedStats.maxHealth, next.health + 10),
      mana: Math.min(derivedStats.maxMana, next.mana + 4)
    };
  }
  return next;
}

function collectItem(
  player: PlayerState,
  item: ItemInstance,
  behavior: BalanceConfig["playerBehavior"]
): PlayerState {
  const inventory = [...player.inventory, item];
  let next: PlayerState = {
    ...player,
    inventory
  };
  const current = next.equipment[item.slot];
  if (!shouldEquipItem(current, item, behavior)) {
    return next;
  }
  const equipment = {
    ...next.equipment,
    [item.slot]: item
  };
  const replaced = current;
  const nextInventory = inventory.filter((entry) => entry.id !== item.id);
  if (replaced !== undefined) {
    nextInventory.push(replaced);
  }
  const equipped = Object.values(equipment).filter((entry): entry is ItemInstance => entry !== undefined);
  const derivedStats = deriveStats(next.baseStats, equipped);
  return {
    ...next,
    inventory: nextInventory,
    equipment,
    derivedStats,
    health: Math.min(derivedStats.maxHealth, next.health + 8),
    mana: Math.min(derivedStats.maxMana, next.mana)
  };
}

function applyPassiveRegen(player: PlayerState, deltaMs: number): PlayerState {
  const equipped = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
  const totals = resolveSpecialAffixTotals(equipped);
  const regen = resolveHealthRegenTick(
    player.health,
    player.derivedStats.maxHealth,
    totals.healthRegen,
    deltaMs
  );
  return regen.healed <= 0
    ? player
    : {
        ...player,
        health: regen.health
      };
}

function createMonsterRuntime(
  archetype: MonsterArchetypeDef,
  state: MonsterState
): MonsterRuntime {
  return {
    state,
    archetype,
    sprite: makeSpriteStub<MonsterRuntime["sprite"]>(),
    healthBarBg: makeSpriteStub<MonsterRuntime["healthBarBg"]>(),
    healthBarFg: makeSpriteStub<MonsterRuntime["healthBarFg"]>(),
    affixMarker: undefined,
    healthBarYOffset: 0,
    yOffset: 0,
    nextAttackAt: 0,
    nextSupportAt: 0
  };
}

function createFloorMonsters(
  floor: number,
  runSeed: string,
  branchChoice: BranchChoice | undefined,
  config: BalanceConfig
): MonsterRuntime[] {
  const difficulty = getDifficultyModifier(config.difficulty);
  const floorConfig = resolveFloorConfig(floor, difficulty);
  const biome = BIOME_MAP[resolveBiomeForFloorBySeed(floor, runSeed, branchChoice)];
  const rng = new SeededRng(`${runSeed}:real:spawn:${floor}`);
  const runtimes: MonsterRuntime[] = [];

  for (let index = 0; index < floorConfig.monsterCount; index += 1) {
    const pool = biome.monsterPool;
    const archetypeId = pool[rng.nextInt(0, pool.length - 1)];
    if (archetypeId === undefined) {
      continue;
    }
    const archetype = MONSTER_ARCHETYPE_MAP[archetypeId];
    if (archetype === undefined) {
      continue;
    }
    const state: MonsterState = {
      id: `real-floor-${floor}-monster-${index}`,
      archetypeId: archetype.id,
      level: floor,
      health: Math.floor(85 * archetype.healthMultiplier * floorConfig.monsterHpMultiplier),
      maxHealth: Math.floor(85 * archetype.healthMultiplier * floorConfig.monsterHpMultiplier),
      damage: Math.floor(7 * archetype.damageMultiplier * floorConfig.monsterDmgMultiplier),
      attackRange: archetype.attackRange,
      moveSpeed: archetype.moveSpeed,
      xpValue: archetype.xpValue,
      dropTableId: archetype.dropTableId,
      position: { x: 1 + (index % 3) * 0.18, y: (index % 2) * 0.12 },
      aiState: "attack",
      aiBehavior: archetype.aiConfig.behavior
    };
    runtimes.push(createMonsterRuntime(archetype, state));
  }

  return runtimes;
}

function resolveWeaponDef(player: PlayerState): WeaponTypeDef {
  return resolveWeaponTypeDef(resolveEquippedWeaponType(player), WEAPON_TYPE_DEF_MAP);
}

function sumPlayerDamage(events: CombatEvent[], playerId: string): number {
  return events.reduce((sum, event) => {
    if (event.sourceId !== playerId || (event.kind !== "damage" && event.kind !== "crit")) {
      return sum;
    }
    return sum + Math.max(0, event.amount);
  }, 0);
}

function chooseSkillForSimulation(
  player: PlayerState,
  behavior: BalanceConfig["playerBehavior"],
  monsterCount: number,
  nowMs: number,
  rng: SeededRng
): SkillDef | null {
  if (player.skills === undefined) {
    return null;
  }
  const usageChance = behavior === "optimal" ? 0.68 : behavior === "average" ? 0.03 : 0.01;
  if (rng.next() > usageChance) {
    return null;
  }

  const candidates = player.skills.skillSlots
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
    .map((slot) => {
      const def = SKILL_DEFS.find((entry) => entry.id === slot.defId);
      return def === undefined ? undefined : createSkillDefForLevel(def, slot.level);
    })
    .filter((def): def is SkillDef => def !== undefined)
    .filter((def) => canUseSkill(player, player.skills!, def, nowMs));

  if (candidates.length === 0) {
    return null;
  }

  const preferred =
    (monsterCount >= 2 ? candidates.find((def) => def.targeting === "aoe_around") : undefined) ??
    candidates.find((def) => def.targeting !== "self") ??
    candidates[0];
  return preferred ?? null;
}

function applyMonsterKillRewards(
  player: PlayerState,
  run: RunState,
  monster: MonsterState,
  lootRng: SeededRng,
  behavior: BalanceConfig["playerBehavior"],
  slotWeightMultiplier: Partial<Record<EquipmentSlot, number>> | undefined
): {
  player: PlayerState;
  run: RunState;
  lootCollected: number;
  rarityCounts: Record<"common" | "magic" | "rare", number>;
} {
  const equippedItems = Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined);
  const specialAffixTotals = resolveSpecialAffixTotals(equippedItems);
  const xpResult = applyXpGain(player, monster.xpValue, "manual", {
    xpBonus: specialAffixTotals.xpBonus
  });
  const nextDerived = deriveStats(xpResult.player.baseStats, equippedItems);
  let nextPlayer: PlayerState = {
    ...xpResult.player,
    derivedStats: nextDerived,
    health: Math.min(xpResult.player.health + 4, nextDerived.maxHealth),
    mana: Math.min(xpResult.player.mana + 1, nextDerived.maxMana)
  };
  const nextKills = run.kills + 1;
  let lootCollected = 0;
  const rarityCounts: Record<"common" | "magic" | "rare", number> = {
    common: 0,
    magic: 0,
    rare: 0
  };
  const lootTable = LOOT_TABLE_MAP[monster.dropTableId];
  const droppedItem =
    lootTable === undefined
      ? undefined
      : rollItemDrop(
          lootTable,
          ITEM_DEF_MAP,
          run.currentFloor,
          lootRng,
          `${run.currentFloor}-${monster.id}-${nextKills}`,
          slotWeightMultiplier === undefined ? undefined : { slotWeightMultiplier }
        );
  if (droppedItem !== null && droppedItem !== undefined) {
    rarityCounts[droppedItem.rarity] += 1;
    lootCollected += 1;
    nextPlayer = collectItem(nextPlayer, droppedItem, behavior);
  }
  return {
    player: nextPlayer,
    run: {
      ...addRunObols(run, 1),
      kills: nextKills,
      totalKills: run.totalKills + 1,
      endlessKills: (run.endlessKills ?? 0) + (run.inEndless ? 1 : 0)
    },
    lootCollected,
    rarityCounts
  };
}

function simulateFloorCombat(
  player: PlayerState,
  config: BalanceConfig,
  floor: number,
  runSeed: string,
  branchChoice: BranchChoice | undefined
): {
  player: PlayerState;
  elapsedMs: number;
  lootCollected: number;
  rarityCounts: Record<"common" | "magic" | "rare", number>;
  cleared: boolean;
  skillUses: number;
  skillDamage: number;
  autoAttackDamage: number;
} {
  const combatSystem = new CombatSystem();
  const monsterQueue = createFloorMonsters(floor, runSeed, branchChoice, config);
  const combatRng = new SeededRng(`${runSeed}:real:combat:${floor}`);
  const lootRng = new SeededRng(`${runSeed}:real:loot:${floor}`);
  const skillRng = new SeededRng(`${runSeed}:real:skill:${floor}`);
  let nextPlayer = player;
  let attackTargetId: string | null = null;
  let nextPlayerAttackAt = 0;
  let elapsedMs = 0;
  let lootCollected = 0;
  let skillUses = 0;
  let skillDamage = 0;
  let autoAttackDamage = 0;
  const rarityCounts: Record<"common" | "magic" | "rare", number> = {
    common: 0,
    magic: 0,
    rare: 0
  };
  let run = {
    ...createRunState(runSeed, 0, config.difficulty),
    currentFloor: floor,
    ...(branchChoice === undefined ? {} : { branchChoice })
  };
  const activeMonsters: MonsterRuntime[] = [];
  const packSize = Math.min(
    4,
    Math.max(2, floor >= 4 ? 3 : 2 + (config.playerBehavior === "optimal" ? 1 : 0))
  );

  while (nextPlayer.health > 0 && (monsterQueue.length > 0 || activeMonsters.length > 0) && elapsedMs < MAX_FLOOR_SIM_MS) {
    if (activeMonsters.length === 0) {
      activeMonsters.push(...monsterQueue.splice(0, packSize));
      attackTargetId = null;
      nextPlayerAttackAt = elapsedMs;
    }

    const skillDef = chooseSkillForSimulation(
      nextPlayer,
      config.playerBehavior,
      activeMonsters.length,
      elapsedMs,
      skillRng
    );
    if (skillDef !== null && nextPlayer.skills !== undefined) {
      const resolution = combatSystem.useSkill(nextPlayer, activeMonsters, skillDef, skillRng, elapsedMs, WEAPON_TYPE_DEF_MAP);
      nextPlayer = {
        ...resolution.player,
        skills: markSkillUsed(nextPlayer.skills, skillDef, elapsedMs)
      };
      skillUses += 1;
      skillDamage += sumPlayerDamage(resolution.events, nextPlayer.id);
      const deadIds = new Set(
        resolution.events
          .filter((event) => event.kind === "death")
          .map((event) => event.targetId)
      );
      if (deadIds.size > 0) {
        const slotWeightMultiplier = BIOME_MAP[resolveBiomeForFloorBySeed(floor, runSeed, branchChoice)].lootBias;
        for (const targetId of deadIds) {
          const index = activeMonsters.findIndex((monster) => monster.state.id === targetId);
          if (index < 0) {
            continue;
          }
          const [deadMonster] = activeMonsters.splice(index, 1);
          if (deadMonster === undefined) {
            continue;
          }
          const rewards = applyMonsterKillRewards(
            nextPlayer,
            run,
            deadMonster.state,
            lootRng,
            config.playerBehavior,
            slotWeightMultiplier
          );
          nextPlayer = rewards.player;
          run = rewards.run;
          lootCollected += rewards.lootCollected;
          rarityCounts.common += rewards.rarityCounts.common;
          rarityCounts.magic += rewards.rarityCounts.magic;
          rarityCounts.rare += rewards.rarityCounts.rare;
          nextPlayer = applyPendingLevelUps(nextPlayer, config.playerBehavior);
        }
      }
      if (nextPlayer.health <= 0 || activeMonsters.length === 0) {
        elapsedMs += LOOP_TICK_MS;
        continue;
      }
    }

    const playerTurn = combatSystem.updatePlayerAttack({
      player: nextPlayer,
      run,
      monsters: activeMonsters,
      attackTargetId,
      nextPlayerAttackAt,
      nowMs: elapsedMs,
      combatRng,
      lootRng,
      itemDefs: ITEM_DEF_MAP,
      lootTables: LOOT_TABLE_MAP,
      weaponTypeDefs: WEAPON_TYPE_DEF_MAP,
      slotWeightMultiplier: BIOME_MAP[resolveBiomeForFloorBySeed(floor, runSeed, branchChoice)].lootBias
    });

    nextPlayer = playerTurn.player;
    run = playerTurn.run;
    attackTargetId = playerTurn.attackTargetId;
    nextPlayerAttackAt = playerTurn.nextPlayerAttackAt;
    autoAttackDamage += sumPlayerDamage(playerTurn.combatEvents, nextPlayer.id);
    if (playerTurn.killedMonsterId !== undefined) {
      const index = activeMonsters.findIndex((monster) => monster.state.id === playerTurn.killedMonsterId);
      if (index >= 0) {
        activeMonsters.splice(index, 1);
      }
    }
    if (playerTurn.droppedItem !== undefined) {
      rarityCounts[playerTurn.droppedItem.item.rarity] += 1;
      lootCollected += 1;
      nextPlayer = collectItem(nextPlayer, playerTurn.droppedItem.item, config.playerBehavior);
    }
    nextPlayer = applyPendingLevelUps(nextPlayer, config.playerBehavior);
    if (nextPlayer.health <= 0) {
      break;
    }
    if (activeMonsters.length === 0) {
      elapsedMs += LOOP_TICK_MS;
      continue;
    }

    const monsterTurn = combatSystem.updateMonsterAttacks(activeMonsters, nextPlayer, elapsedMs, combatRng);
    nextPlayer = applyPassiveRegen(monsterTurn.player, LOOP_TICK_MS);
    elapsedMs += LOOP_TICK_MS;
  }

  return {
    player: nextPlayer,
    elapsedMs,
    lootCollected,
    rarityCounts,
    cleared: monsterQueue.length === 0 && activeMonsters.length === 0 && nextPlayer.health > 0,
    skillUses,
    skillDamage,
    autoAttackDamage
  };
}

function simulateBossCombat(
  player: PlayerState,
  config: BalanceConfig,
  runSeed: string
): {
  player: PlayerState;
  elapsedMs: number;
  lootCollected: number;
  rarityCounts: Record<"common" | "magic" | "rare", number>;
  cleared: boolean;
  skillUses: number;
  skillDamage: number;
  autoAttackDamage: number;
} {
  const combatRng = new SeededRng(`${runSeed}:real:boss:combat`);
  const bossRng = new SeededRng(`${runSeed}:real:boss:ai`);
  const lootRng = new SeededRng(`${runSeed}:real:boss:loot`);
  const skillRng = new SeededRng(`${runSeed}:real:boss:skill`);
  const combatSystem = new CombatSystem();
  const weaponDef = resolveWeaponDef(player);
  const specialTotals = resolveSpecialAffixTotals(
    Object.values(player.equipment).filter((item): item is ItemInstance => item !== undefined)
  );
  let nextPlayer = player;
  let bossState = initBossState(BONE_SOVEREIGN, { x: 1.15, y: 0 });
  let elapsedMs = 0;
  let nextPlayerAttackAt = 0;
  let pendingBossAttack:
    | {
        attack: ReturnType<typeof selectBossAttack>;
        executeAtMs: number;
      }
    | undefined;
  const rarityCounts: Record<"common" | "magic" | "rare", number> = {
    common: 0,
    magic: 0,
    rare: 0
  };
  const proxyArchetype = MONSTER_ARCHETYPE_MAP.melee_grunt ?? Object.values(MONSTER_ARCHETYPE_MAP)[0]!;
  let lootCollected = 0;
  let skillUses = 0;
  let skillDamage = 0;
  let autoAttackDamage = 0;

  while (nextPlayer.health > 0 && bossState.health > 0 && elapsedMs < MAX_FLOOR_SIM_MS) {
    const skillDef = chooseSkillForSimulation(nextPlayer, config.playerBehavior, 1, elapsedMs, skillRng);
    if (skillDef !== null && nextPlayer.skills !== undefined && bossState.health > 0) {
      const proxy = createMonsterRuntime(
        proxyArchetype,
        {
          id: bossState.bossId,
          archetypeId: "melee_grunt",
          level: STORY_MAX_FLOOR,
          health: bossState.health,
          maxHealth: bossState.maxHealth,
          damage: 0,
          attackRange: 1.5,
          moveSpeed: 0,
          xpValue: 0,
          dropTableId: BONE_SOVEREIGN.dropTableId,
          position: { ...bossState.position },
          aiState: "attack",
          isBoss: true
        }
      );
      const resolution = combatSystem.useSkill(nextPlayer, [proxy], skillDef, skillRng, elapsedMs, WEAPON_TYPE_DEF_MAP);
      nextPlayer = {
        ...resolution.player,
        skills: markSkillUsed(nextPlayer.skills, skillDef, elapsedMs)
      };
      skillUses += 1;
      skillDamage += sumPlayerDamage(resolution.events, nextPlayer.id);
      const nextBossState = resolution.affectedMonsters[0];
      if (nextBossState !== undefined) {
        bossState = {
          ...bossState,
          health: nextBossState.health
        };
      }
      if (bossState.health <= 0) {
        break;
      }
    }

    if (elapsedMs >= nextPlayerAttackAt) {
      const proxy = {
        id: bossState.bossId,
        archetypeId: "boss_proxy",
        level: STORY_MAX_FLOOR,
        health: bossState.health,
        maxHealth: bossState.maxHealth,
        damage: 0,
        attackRange: 1.5,
        moveSpeed: 0,
        xpValue: 0,
        dropTableId: BONE_SOVEREIGN.dropTableId,
        position: { ...bossState.position },
        aiState: "attack" as const,
        isBoss: true
      };
      const playerHit = resolvePlayerAttack(nextPlayer, proxy, combatRng, elapsedMs, {
        damageMultiplier: weaponDef.damageMultiplier,
        specialAffixTotals: specialTotals,
        ...(weaponDef.mechanic.type === "crit_bonus"
          ? {
              critChanceBonus: weaponDef.mechanic.critChanceBonus,
              critDamageMultiplier: weaponDef.mechanic.critDamageMultiplier
            }
          : {})
      });
      const dealt = Math.max(0, proxy.health - playerHit.monster.health);
      autoAttackDamage += dealt;
      nextPlayer = applyPassiveRegen(playerHit.player, LOOP_TICK_MS);
      if (dealt > 0) {
        bossState = updateBossPhase(applyDamageToBoss(bossState, dealt), BONE_SOVEREIGN);
      }
      nextPlayerAttackAt =
        elapsedMs +
        1000 /
          Math.max(
            0.6,
            nextPlayer.derivedStats.attackSpeed * Math.max(0.2, weaponDef.attackSpeedMultiplier)
          );
      if (bossState.health <= 0) {
        break;
      }
    }

    if (pendingBossAttack !== undefined && elapsedMs >= pendingBossAttack.executeAtMs) {
      const result = resolveBossAttack(
        pendingBossAttack.attack!,
        bossState,
        nextPlayer,
        bossRng,
        elapsedMs,
        nextPlayer.position,
        specialTotals
      );
      nextPlayer = applyPassiveRegen(result.player, LOOP_TICK_MS);
      pendingBossAttack = undefined;
    } else if (pendingBossAttack === undefined) {
      const attack = selectBossAttack(bossState, BONE_SOVEREIGN, elapsedMs, bossRng);
      if (attack !== null) {
        bossState = markBossAttackUsed(bossState, attack, elapsedMs);
        if (attack.telegraphMs > 0) {
          pendingBossAttack = {
            attack,
            executeAtMs: elapsedMs + attack.telegraphMs
          };
        } else {
          const result = resolveBossAttack(
            attack,
            bossState,
            nextPlayer,
            bossRng,
            elapsedMs,
            nextPlayer.position,
            specialTotals
          );
          nextPlayer = applyPassiveRegen(result.player, LOOP_TICK_MS);
        }
      }
    }

    elapsedMs += LOOP_TICK_MS;
  }

  if (bossState.health <= 0) {
    const drops = rollBossDrops(
      LOOT_TABLE_MAP[BONE_SOVEREIGN.dropTableId]!,
      LOOT_TABLE_MAP[BOSS_EXCLUSIVE_TABLE_ID]!,
      ITEM_DEF_MAP,
      STORY_MAX_FLOOR,
      lootRng,
      `${runSeed}:real:boss:reward`
    );
    const collected = [drops.guaranteedRare, drops.guaranteedBossExclusive, drops.bonusDrop].filter(
      (item): item is ItemInstance => item !== undefined
    );
    for (const item of collected) {
      rarityCounts[item.rarity] += 1;
      lootCollected += 1;
      nextPlayer = collectItem(nextPlayer, item, config.playerBehavior);
    }
  }

  return {
    player: nextPlayer,
    elapsedMs,
    lootCollected,
    rarityCounts,
    cleared: bossState.health <= 0 && nextPlayer.health > 0,
    skillUses,
    skillDamage,
    autoAttackDamage
  };
}

function resolveDeathCause(
  floorReached: number,
  player: PlayerState,
  branchChoice: BranchChoice | undefined
): string {
  if (player.health > 0) {
    return "none";
  }
  if (floorReached >= STORY_MAX_FLOOR) {
    return "boss_pressure";
  }
  if (branchChoice === "molten_route") {
    return "elite_swarm";
  }
  return "attrition";
}

function simulateSingleRun(config: BalanceConfig, index: number): SimulatedRun {
  const floors = Math.max(1, Math.floor(config.maxFloors ?? STORY_MAX_FLOOR));
  const runSeed = `${config.seedBase}:${config.difficulty}:${config.playerBehavior}:real:${index}`;
  const branchChoice: BranchChoice = resolveBranchChoiceBySeed(runSeed);
  let player = createBalancePlayer();
  let floorReached = 0;
  let runDurationMs = 0;
  const hpByFloor = new Array<number>(floors).fill(0);
  const rarityCounts: Record<"common" | "magic" | "rare", number> = {
    common: 0,
    magic: 0,
    rare: 0
  };
  let skillUses = 0;
  let skillDamage = 0;
  let autoAttackDamage = 0;
  let cleared = true;

  for (let floor = 1; floor <= floors; floor += 1) {
    const result =
      floor >= STORY_MAX_FLOOR
        ? simulateBossCombat(player, config, runSeed)
        : simulateFloorCombat(player, config, floor, runSeed, branchChoice);
    player = result.player;
    runDurationMs += result.elapsedMs;
    floorReached = floor;
    hpByFloor[floor - 1] = Number((player.health / Math.max(1, player.derivedStats.maxHealth)).toFixed(4));
    rarityCounts.common += result.rarityCounts.common;
    rarityCounts.magic += result.rarityCounts.magic;
    rarityCounts.rare += result.rarityCounts.rare;
    skillUses += result.skillUses;
    skillDamage += result.skillDamage;
    autoAttackDamage += result.autoAttackDamage;
    if (!result.cleared || player.health <= 0) {
      cleared = false;
      break;
    }
  }

  for (let index = floorReached; index < floors; index += 1) {
    hpByFloor[index] = 0;
  }

  return {
    cleared,
    floorReached,
    runDurationMs,
    hpByFloor,
    deathCause: resolveDeathCause(floorReached, player, branchChoice),
    rarityCounts,
    skillUses,
    skillDamage,
    autoAttackDamage
  };
}

export function simulateRealRun(config: BalanceConfig): RunSimulation {
  const sampleSize = Math.max(1, Math.floor(config.sampleSize));
  const floors = Math.max(1, Math.floor(config.maxFloors ?? STORY_MAX_FLOOR));
  const runs = Array.from({ length: sampleSize }, (_, index) => simulateSingleRun(config, index));
  const clearedCount = runs.filter((run) => run.cleared).length;
  const avgFloorReached = runs.reduce((sum, run) => sum + run.floorReached, 0) / sampleSize;
  const avgRunDurationMs = runs.reduce((sum, run) => sum + run.runDurationMs, 0) / sampleSize;
  const deathCauseDistribution: Record<string, number> = {};
  const totalRarity: Record<"common" | "magic" | "rare", number> = {
    common: 0,
    magic: 0,
    rare: 0
  };
  let totalSkillUses = 0;
  let totalSkillDamage = 0;
  let totalAutoAttackDamage = 0;

  for (const run of runs) {
    deathCauseDistribution[run.deathCause] = (deathCauseDistribution[run.deathCause] ?? 0) + 1;
    totalRarity.common += run.rarityCounts.common;
    totalRarity.magic += run.rarityCounts.magic;
    totalRarity.rare += run.rarityCounts.rare;
    totalSkillUses += run.skillUses;
    totalSkillDamage += run.skillDamage;
    totalAutoAttackDamage += run.autoAttackDamage;
  }

  const hpCurveP50: number[] = [];
  const hpCurveP90: number[] = [];
  for (let floor = 0; floor < floors; floor += 1) {
    const values = runs.map((run) => run.hpByFloor[floor] ?? 0);
    hpCurveP50.push(percentile(values, 0.5));
    hpCurveP90.push(percentile(values, 0.9));
  }

  const rarityDenominator = Math.max(1, totalRarity.common + totalRarity.magic + totalRarity.rare);
  const avgSkillUsesPerRun = totalSkillUses / sampleSize;
  const avgSkillCastsPer30s =
    totalSkillUses / Math.max(1, runs.reduce((sum, run) => sum + run.runDurationMs / 30_000, 0));
  const totalPlayerDamage = totalSkillDamage + totalAutoAttackDamage;
  return {
    clearRate: Number((clearedCount / sampleSize).toFixed(4)),
    avgFloorReached: Number(avgFloorReached.toFixed(3)),
    avgRunDurationMs: Math.round(avgRunDurationMs),
    hpCurveP50,
    hpCurveP90,
    deathCauseDistribution,
    itemRarityDistribution: {
      common: Number((totalRarity.common / rarityDenominator).toFixed(4)),
      magic: Number((totalRarity.magic / rarityDenominator).toFixed(4)),
      rare: Number((totalRarity.rare / rarityDenominator).toFixed(4))
    },
    combatRhythm: {
      avgSkillUsesPerRun: Number(avgSkillUsesPerRun.toFixed(3)),
      avgSkillCastsPer30s: Number(avgSkillCastsPer30s.toFixed(3)),
      avgSkillDamageShare: Number((totalSkillDamage / Math.max(1, totalPlayerDamage)).toFixed(4)),
      avgAutoAttackDamageShare: Number((totalAutoAttackDamage / Math.max(1, totalPlayerDamage)).toFixed(4))
    }
  };
}
