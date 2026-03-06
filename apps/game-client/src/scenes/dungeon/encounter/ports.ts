import type Phaser from "phaser";
import type {
  BossAttack,
  BossDef,
  BossRuntimeState,
  CombatEvent,
  DungeonLayout,
  GameEventMap,
  MonsterAffixId,
  PlayerState,
  RunState,
  TypedEventBus
} from "@blodex/core";
import type { FloorConfig, MonsterArchetypeDef } from "@blodex/content";
import type { MonsterRuntime } from "../../../systems/EntityManager";

interface EncounterRngPort {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: T[]): T;
}

interface BossSpawnEntityPort {
  setBoss(boss: {
    state: BossRuntimeState;
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  } | null): void;
  listMonsters(): MonsterRuntime[];
  rebuildMonsterSpatialIndex(): void;
}

interface BossSpawnRenderPort {
  spawnBoss(
    position: { x: number; y: number },
    origin: { x: number; y: number },
    spriteKey: string
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  spawnMonster(
    state: MonsterRuntime["state"],
    archetype: MonsterArchetypeDef,
    origin: { x: number; y: number }
  ): MonsterRuntime;
}

export interface BossSpawnHost {
  dungeon: DungeonLayout;
  bossDef: BossDef;
  bossState: BossRuntimeState | null;
  bossSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null;
  entityLabelById: Map<string, string>;
  renderSystem: BossSpawnRenderPort;
  entityManager: BossSpawnEntityPort;
  origin: { x: number; y: number };
  run: RunState;
  unlockedAffixIds: MonsterAffixId[];
  spawnRng: EncounterRngPort;
  time: { now: number };
  floorConfig: Pick<FloorConfig, "monsterHpMultiplier" | "monsterDmgMultiplier">;
  eventBus: TypedEventBus<GameEventMap>;
}

interface BossTelegraphRenderPort {
  spawnTelegraphCircle(
    position: { x: number; y: number },
    radius: number,
    origin: { x: number; y: number }
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
}

export interface BossTelegraphHost {
  renderSystem: BossTelegraphRenderPort;
  origin: { x: number; y: number };
  tweens: Pick<Phaser.Tweens.TweenManager, "add" | "killTweensOf">;
  tileWidth: number;
  tileHeight: number;
}

export interface BossCombatHost {
  floorConfig: Pick<FloorConfig, "isBossFloor">;
  bossState: BossRuntimeState | null;
  player: PlayerState;
  resolveMutationAttackSpeedMultiplier(nowMs: number): number;
  nextPlayerAttackAt: number;
  combatRng: Pick<EncounterRngPort, "next">;
  eventBus: TypedEventBus<GameEventMap>;
  bossDef: BossDef;
  hudDirty: boolean;
  nextBossAttackAt: number;
  bossRng: EncounterRngPort;
  emitCombatEvents(events: CombatEvent[]): void;
}

export interface BossCombatResolveHost extends BossCombatHost {
  bossState: BossRuntimeState;
}

