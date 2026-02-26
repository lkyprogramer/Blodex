# Phase 1 核心系统扩展实施方案（1A/1B）

## Context

Phase 0 完成后，`DungeonScene` 已被拆分为 EntityManager / CombatSystem / AISystem / MovementSystem 四个系统模块，EventBus 和 RunSeed 确定性基础已就绪。当前游戏仅支持单层地牢、击杀 12 怪即胜的简单循环。

Phase 1 的目标是构建 Roguelike 游戏的四大支柱：**多层地牢、技能系统、Boss 战、元进度**，使游戏从"技术原型"进化为"可重复游玩的完整运行循环"。

**执行顺序（硬约束）：**
- **1A 先行**：多层地牢 + Boss 战（先完成运行循环闭环）
- **1B 后续**：技能/Buff + 元进度（在稳定循环上叠加深度）

---

## 1. 目标与边界

### 1.1 目标
- 实现 5 层地牢运行循环（Floor 1-4 普通层 + Floor 5 Boss 层）
- 实现楼层难度递增与楼梯机制
- 实现 Boss 战系统（多阶段 AI + 召唤）
- 实现技能系统（5 个初始技能 + 升级选择）
- 实现 Buff/Debuff 时间驱动系统
- 实现 Soul Shard 元进度货币 + 永久升级树
- 实现 Obol 运行内货币生命周期（产出/显示/结算清零，消费入口留给 Phase 2 Merchant）
- 完成 `blodex_meta_v1` → `v2` schema 迁移

### 1.2 非目标
- 不做生物群系（Biome）系统（Phase 2）
- 不做怪物词缀系统（Phase 2）
- 不做 VFX/SFX/UI 大重构（Phase 3）
- 不做随机事件系统（Phase 2）
- 不新增怪物类型（仍用 3 种原型，Phase 2 扩展到 10 种）
- 不做 Obol 商店与事件消费系统（Phase 2 再引入）

---

## 2. 前置假设（Phase 0 交付物）

Phase 1 实施依赖以下 Phase 0 产出：

| 模块 | 路径 | 状态 |
|------|------|------|
| EntityManager | `apps/game-client/src/systems/EntityManager.ts` | Phase 0 交付 |
| CombatSystem | `apps/game-client/src/systems/CombatSystem.ts` | Phase 0 交付 |
| AISystem | `apps/game-client/src/systems/AISystem.ts` | Phase 0 交付 |
| MovementSystem | `apps/game-client/src/systems/MovementSystem.ts` | Phase 0 交付 |
| EventBus | `packages/core/src/eventBus.ts` | Phase 0 交付 |
| GameEventMap | `packages/core/src/contracts/events.ts` | Phase 0 交付 |
| RunSeed 确定性 | `packages/core/src/run.ts` | Phase 0 交付 |
| MonsterArchetypeDef + aiConfig | `packages/content/src/monsters.ts` | Phase 0 交付 |

---

## 3. 不可协商约束

1. **确定性优先** — 所有楼层生成、战斗、掉落、技能选择均从 `runSeed + floorNumber` 派生，禁止隐式 `Date.now()`。
2. **Schema 兼容** — `MetaProgression` 迁移 v1→v2 必须幂等、可回退（缺失字段给默认值）。
3. **分层边界** — `packages/core` 不引入 Phaser 依赖；技能效果计算在 core，技能 VFX 在 client。
4. **`(floor - 1)` 缩放** — 难度公式使用 `(floor - 1)` 而非 `floor`（Floor 1 = 基准难度）。
5. **`unlocks: string[]`** — JSON-safe，不使用 `Set<string>`。
6. **`schemaVersion: 2`** — 新增字段必须标记 schema 版本。
7. **RNG 流隔离** — `procgen/combat/loot/skill/boss` 必须使用独立随机流，禁止共享消费顺序导致回放漂移。

### 3.1 Determinism Contract（新增）

为避免 Phase 1 功能增加后破坏 replay，一律遵循：

```typescript
interface RunRngStreams {
  procgen: RngLike;
  combat: RngLike;
  loot: RngLike;
  skill: RngLike;
  boss: RngLike;
}
```

规则：
1. 每个子系统只能消费自己的随机流。
2. 技能三选一必须先对候选池按 `id` 排序，再按 `skill` 流抽样。
3. Boss 攻击选择只允许消费 `boss` 流，不得复用 combat 流。
4. 测试最小要求：固定 seed 重放时，以下结果必须一致：
   - `RunSummary`
   - 楼层布局 hash
   - 技能选择序列
   - Boss 攻击序列

---

## 4. Phase 1A — 多层地牢 + Boss 战

### PR-1A-01: 楼层数据模型与难度曲线

**修改文件**
- `packages/core/src/contracts/types.ts` — 扩展 `RunState`、新增 `FloorConfig`
- `packages/content/src/floorScaling.ts` — 新增：数据驱动难度曲线
- `packages/content/src/config.ts` — 扩展 `GameConfig`
- `packages/content/src/index.ts` — 导出新模块
- `packages/core/src/run.ts` — 扩展 `RunState` 包含多层状态

**实施内容**

扩展 `RunState`:
```typescript
export interface RunState {
  startedAtMs: number;
  runSeed: string;          // 从 Phase 0B 继承
  currentFloor: number;     // 当前所在楼层 (1-5)
  floorsCleared: number;    // 已通过的楼层数
  kills: number;            // 当前层击杀数
  totalKills: number;       // 全程总击杀数
  lootCollected: number;
}
```

新增 `FloorConfig` 与缩放函数:
```typescript
// packages/content/src/floorScaling.ts
export interface FloorConfig {
  floorNumber: number;
  monsterHpMultiplier: number;    // base × (1 + (floor-1) × 0.25)
  monsterDmgMultiplier: number;   // base × (1 + (floor-1) × 0.15)
  monsterCount: number;           // 12 + (floor-1) × 2, boss floor override
  clearThreshold: number;         // 击杀 70% 即出现楼梯
  isBossFloor: boolean;
}

export function getFloorConfig(floor: number): FloorConfig;
```

**验收标准**
- `getFloorConfig(1)` → HP ×1.00, DMG ×1.00, count=12
- `getFloorConfig(3)` → HP ×1.50, DMG ×1.30, count=16
- `getFloorConfig(5)` → isBossFloor=true
- 所有缩放纯函数有单测覆盖

---

### PR-1A-02: 楼层转换与楼梯机制

**修改文件**
- `packages/core/src/floor.ts` — 新增：楼层状态管理、楼梯生成逻辑
- `packages/core/src/procgen.ts` — 扩展：接受 `floorNumber` 参数影响房间数和密度
- `packages/core/src/contracts/events.ts` — 新增 `floor:clear`、`floor:enter` 事件
- `packages/core/src/index.ts` — 导出 floor 模块

**实施内容**

楼梯生成规则:
```typescript
// packages/core/src/floor.ts
export interface StaircaseState {
  position: { x: number; y: number };
  visible: boolean;  // 击杀达到 clearThreshold 后变为 true
}

export function shouldRevealStaircase(
  kills: number,
  floorConfig: FloorConfig
): boolean {
  return kills >= Math.ceil(floorConfig.monsterCount * 0.7);
}

export function findStaircasePosition(
  layout: DungeonLayout,
  playerSpawn: { x: number; y: number }
): { x: number; y: number } {
  // 选择距离玩家出生点最远的房间中心
}
```

扩展 `generateDungeon`:
```typescript
export interface ProcgenOptions {
  // ...existing
  floorNumber?: number;  // 影响 roomCount 和密度
}
// floor 1-2: roomCount=12, floor 3-4: roomCount=14, floor 5: 特殊 boss 房
```

**验收标准**
- 击杀 70% 怪物后楼梯可见
- 楼梯位于距玩家出生点最远的房间
- `floor:clear` 和 `floor:enter` 事件正确触发
- `generateDungeon` 在不同 `floorNumber` 下产出不同密度地图

---

### PR-1A-03: 客户端楼层转换渲染与流程

**修改文件**
- `apps/game-client/src/scenes/DungeonScene.ts` — 楼梯实体渲染、楼层转换动画、多层循环
- `apps/game-client/src/ui/Hud.ts` — 显示当前楼层号、楼梯提示

**实施内容**
- DungeonScene 中添加楼梯 sprite（可复用 tile 纹理 + 颜色 tint）
- 玩家踏上楼梯触发楼层转换：
  1. 保留 PlayerState（HP/mana/inventory/equipment/level 不重置）
  2. 用 `runSeed + nextFloor` 派生新 seed
  3. 重新 `generateDungeon` + `spawnMonsters`（按新 FloorConfig）
  4. 重置当前层击杀计数
- 更新胜利条件：击杀 12 怪 → 击败 Floor 5 Boss

**验收标准**
- 玩家可从 Floor 1 一路推进到 Floor 5
- 楼层转换保留玩家状态（HP/装备/等级）
- 每层种子不同，地图布局不同
- HUD 正确显示当前楼层

---

### PR-1A-04: Boss 数据模型与 AI

**新增文件**
- `packages/core/src/boss.ts` — Boss AI 状态机、阶段管理、攻击模式调度
- `packages/core/src/__tests__/boss.test.ts` — Boss 逻辑单测
- `packages/content/src/bosses.ts` — Boss 数据定义

**修改文件**
- `packages/core/src/contracts/types.ts` — 新增 `BossDef`, `BossPhase`, `BossAttack`
- `packages/core/src/contracts/events.ts` — 新增 `boss:phaseChange`, `boss:summon`
- `packages/core/src/index.ts` — 导出 boss 模块
- `packages/content/src/index.ts` — 导出 bosses

**实施内容**

Boss 类型定义（按 roadmap 设计文档）:
```typescript
export interface BossDef {
  id: string;
  name: string;
  spriteKey: string;
  baseHealth: number;
  phases: BossPhase[];
  dropTableId: string;
  exclusiveFloor: number;
}

export interface BossPhase {
  hpThreshold: number;         // 0.0-1.0, 触发阈值
  attackPattern: BossAttack[];
  enrageTimer?: number;
}

export interface BossAttack {
  id: string;
  cooldownMs: number;
  telegraphMs: number;
  type: "melee" | "projectile" | "aoe_zone" | "summon";
  damage: number;
  range: number;
  radius?: number;
}
```

第一个 Boss — Bone Sovereign:
```typescript
// packages/content/src/bosses.ts
export const BONE_SOVEREIGN: BossDef = {
  id: "bone_sovereign",
  name: "Bone Sovereign",
  spriteKey: "boss_bone_sovereign",
  baseHealth: 800,
  phases: [
    {
      hpThreshold: 1.0,  // Phase 1: 100%-50%
      attackPattern: [
        { id: "heavy_strike", cooldownMs: 3000, telegraphMs: 1500,
          type: "melee", damage: 25, range: 1.5 },
        { id: "summon_hounds", cooldownMs: 15000, telegraphMs: 0,
          type: "summon", damage: 0, range: 0 }
      ]
    },
    {
      hpThreshold: 0.5,  // Phase 2: 50%-0%
      attackPattern: [
        { id: "heavy_strike", cooldownMs: 2500, telegraphMs: 1200,
          type: "melee", damage: 30, range: 1.5 },
        { id: "bone_spikes", cooldownMs: 6000, telegraphMs: 2000,
          type: "aoe_zone", damage: 20, range: 6, radius: 1.5 },
        { id: "summon_hounds", cooldownMs: 10000, telegraphMs: 0,
          type: "summon", damage: 0, range: 0 }
      ],
      enrageTimer: 120000
    }
  ],
  dropTableId: "boss_bone_sovereign",
  exclusiveFloor: 5
};
```

Boss AI 状态机:
```typescript
// packages/core/src/boss.ts
export interface BossRuntimeState {
  bossId: string;
  currentPhaseIndex: number;
  health: number;
  maxHealth: number;
  attackCooldowns: Record<string, number>;
  position: { x: number; y: number };
  aiState: "idle" | "telegraph" | "attacking" | "summoning" | "dead";
  telegraphTarget?: { x: number; y: number };
  telegraphEndMs?: number;
}

export function initBossState(boss: BossDef, position: { x: number; y: number }): BossRuntimeState;
export function updateBossPhase(state: BossRuntimeState, boss: BossDef): BossRuntimeState;
export function selectBossAttack(state: BossRuntimeState, boss: BossDef, nowMs: number, rng: RngLike): BossAttack | null;
export function resolveBossAttack(attack: BossAttack, boss: BossRuntimeState, player: PlayerState, rng: RngLike, nowMs: number): { player: PlayerState; events: CombatEvent[] };
```

**验收标准**
- Boss 在 50% HP 时正确切换 Phase
- 各攻击模式按冷却独立调度
- 召唤技能产出 Crypt Hound 状态（不涉及渲染）
- 阶段切换触发 `boss:phaseChange` 事件
- 固定 seed 下 Boss 战斗序列一致

---

### PR-1A-05: Boss 房间生成与客户端 Boss 战

**修改文件**
- `packages/core/src/procgen.ts` — Floor 5 特殊 boss 房布局生成
- `apps/game-client/src/scenes/DungeonScene.ts` — Boss 渲染、血条、阶段指示、门封锁
- `apps/game-client/src/ui/Hud.ts` — Boss 专用血条（顶部宽条 + 阶段标记）

**实施内容**

Boss 房间生成:
```typescript
// procgen.ts 扩展
export function generateBossRoom(seed: string): DungeonLayout {
  // 生成 12×12 大房间 + 入口走廊
  // 玩家出生在走廊入口
  // Boss 出生在房间中心
  // 门封锁：玩家进入后不可回退
}
```

客户端 Boss 战:
- Boss 使用更大 sprite (64×80)
- 顶部全宽血条 + 阶段分割线
- telegraph 区域用半透明红色圆/矩形显示
- 召唤物使用现有 Crypt Hound sprite
- Boss 死亡 → 宝箱 sprite + run victory

Boss 专用掉落表:
```typescript
// packages/content/src/lootTables.ts 新增
{
  id: "boss_bone_sovereign",
  entries: [
    // 保证掉落 1 件 rare + 1 件 boss exclusive
    { itemDefId: "sanctified_greatsword", weight: 15, minFloor: 5 },
    { itemDefId: "revenant_mask", weight: 15, minFloor: 5 },
    { itemDefId: "oathbound_cuirass", weight: 15, minFloor: 5 },
    { itemDefId: "bloodsigil_band", weight: 15, minFloor: 5 },
    { itemDefId: "catacomb_greaves", weight: 15, minFloor: 5 }
    // boss exclusive 物品在 PR-1B 中添加
  ]
}
```

Boss 掉落解算（新增约束）:
```typescript
// packages/core/src/loot.ts 扩展
export interface BossDropResult {
  guaranteedRare: ItemInstance;
  guaranteedBossExclusive: ItemInstance;
  bonusDrop?: ItemInstance; // 可选额外掉落
}

export function rollBossDrops(
  rareTable: LootTableDef,
  bossExclusiveTable: LootTableDef,
  itemDefs: Record<string, ItemDef>,
  floor: number,
  rng: RngLike,
  seedFragment: string
): BossDropResult;
```

**验收标准**
- Floor 5 生成 boss 房而非普通地牢
- Boss 血条和阶段指示正确显示
- telegraph 预警区域可见
- Boss 掉落至少 2 件（1 rare + 1 boss exclusive）并可重放
- Boss 击败 → 运行胜利（显示总结面板 + meta 更新）
- 玩家死亡 → 运行失败（正常结算）

---

### PR-1A-06: 1A 集成测试与收敛

**新增文件**
- `packages/core/src/__tests__/floor.test.ts`
- `packages/core/src/__tests__/integration-multifloor.test.ts`

**实施内容**
- 完整 5 层运行集成测试（纯逻辑，无渲染）
- 固定 seed 下验证确定性：楼层生成、怪物配置、Boss 阶段转换
- 死亡分支与胜利分支都产出正确的 `RunSummary` + `MetaProgression`

**验收标准（1A Gate）**
- [ ] 可完成 1→5 层完整运行
- [ ] Boss 击杀与死亡分支都正确结算
- [ ] 固定 seed 下 replay 一致
- [ ] `RunSummary.floorReached` 正确反映最高楼层

---

## 5. Phase 1B — 技能/Buff + 元进度

### PR-1B-01: 技能数据模型与解算引擎

**新增文件**
- `packages/core/src/skill.ts` — 技能解算、冷却管理、效果应用
- `packages/core/src/__tests__/skill.test.ts`
- `packages/content/src/skills.ts` — 5 个初始技能数据

**修改文件**
- `packages/core/src/contracts/types.ts` — 新增 `SkillDef`, `SkillEffect`, `PlayerSkillState`
- `packages/core/src/contracts/events.ts` — 新增 `skill:use`, `skill:cooldown`
- `packages/core/src/index.ts` — 导出 skill 模块
- `packages/content/src/index.ts` — 导出 skills

**实施内容**

类型定义（按 roadmap）:
```typescript
export interface SkillDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  cooldownMs: number;
  manaCost: number;
  damageType: DamageType;
  targeting: "self" | "nearest" | "directional" | "aoe_around";
  range: number;
  effects: SkillEffect[];
  unlockCondition?: string;  // meta-progression unlock ID
}

export interface SkillEffect {
  type: "damage" | "heal" | "buff" | "debuff" | "summon";
  value: number | { base: number; scaling: keyof BaseStats; ratio: number };
  duration?: number;
  radius?: number;
}

export interface PlayerSkillState {
  skillSlots: (SkillInstance | null)[];  // max 4
  cooldowns: Record<string, number>;     // skillId -> readyAtMs
}

export interface SkillInstance {
  defId: string;
  level: number;  // 预留技能等级
}
```

5 个初始技能:
```typescript
// packages/content/src/skills.ts
export const SKILL_DEFS: SkillDef[] = [
  { id: "cleave", name: "Cleave", cooldownMs: 3000, manaCost: 8,
    damageType: "physical", targeting: "aoe_around", range: 1.5,
    effects: [{ type: "damage", value: { base: 0, scaling: "strength", ratio: 1.2 } }] },
  { id: "shadow_step", name: "Shadow Step", cooldownMs: 5000, manaCost: 12,
    damageType: "physical", targeting: "nearest", range: 6,
    effects: [{ type: "buff", value: 1, duration: 3000 }] },  // guaranteed crit buff
  { id: "blood_drain", name: "Blood Drain", cooldownMs: 8000, manaCost: 15,
    damageType: "arcane", targeting: "nearest", range: 3,
    effects: [
      { type: "damage", value: { base: 0, scaling: "strength", ratio: 0.8 } },
      { type: "heal", value: { base: 0, scaling: "strength", ratio: 0.8 } }
    ] },
  { id: "frost_nova", name: "Frost Nova", cooldownMs: 10000, manaCost: 20,
    damageType: "arcane", targeting: "aoe_around", range: 2,
    effects: [{ type: "debuff", value: 0.5, duration: 3000, radius: 2 }] },  // 50% slow
  { id: "war_cry", name: "War Cry", cooldownMs: 15000, manaCost: 10,
    damageType: "physical", targeting: "self", range: 0,
    effects: [{ type: "buff", value: 1, duration: 6000 }] }  // +30% ATK, +20% ATS
];
```

技能解算核心:
```typescript
// packages/core/src/skill.ts
export function canUseSkill(player: PlayerState, skillState: PlayerSkillState, skillDef: SkillDef, nowMs: number): boolean;
export function resolveSkill(player: PlayerState, targets: MonsterState[], skillDef: SkillDef, rng: RngLike, nowMs: number): SkillResolution;
export function updateCooldowns(skillState: PlayerSkillState, nowMs: number): PlayerSkillState;

export interface SkillResolution {
  player: PlayerState;
  affectedMonsters: MonsterState[];
  events: CombatEvent[];
  buffsApplied: BuffInstance[];
}
```

**验收标准**
- 5 个技能的伤害/治疗/Buff 效果计算有单测
- 冷却管理正确（不可在冷却中使用）
- Mana 不足时不可使用
- 所有技能解算为纯函数

---

### PR-1B-02: Buff/Debuff 系统

**新增文件**
- `packages/core/src/buff.ts` — Buff 状态管理、每帧更新、效果叠加
- `packages/core/src/__tests__/buff.test.ts`

**修改文件**
- `packages/core/src/contracts/types.ts` — 新增 `BuffDef`, `BuffInstance`
- `packages/core/src/contracts/events.ts` — 新增 `buff:apply`, `buff:expire`
- `packages/core/src/stats.ts` — `deriveStats` 接受 buff 列表参数
- `packages/core/src/index.ts` — 导出 buff 模块

**实施内容**

```typescript
export interface BuffDef {
  id: string;
  name: string;
  duration: number;  // ms
  statModifiers?: Partial<Record<keyof DerivedStats, number>>;  // 加法修正
  statMultipliers?: Partial<Record<keyof DerivedStats, number>>; // 乘法修正
  dot?: { damagePerTick: number; tickIntervalMs: number };       // 持续伤害
  slow?: number;       // 移速乘数 (0.5 = 50% 减速)
  guaranteedCrit?: boolean;
}

export interface BuffInstance {
  defId: string;
  sourceId: string;     // 施加者
  targetId: string;     // 受益/受害者
  appliedAtMs: number;
  expiresAtMs: number;
}

export function applyBuff(target: BuffInstance[], buff: BuffInstance): BuffInstance[];
export function updateBuffs(buffs: BuffInstance[], nowMs: number): { active: BuffInstance[]; expired: BuffInstance[] };
export function aggregateBuffEffects(buffs: BuffInstance[], buffDefs: Record<string, BuffDef>): AggregatedBuffEffect;
```

`deriveStats` 扩展:
```typescript
// stats.ts
export function deriveStats(
  base: BaseStats,
  equippedItems: ItemInstance[],
  buffEffects?: AggregatedBuffEffect  // 新增可选参数，不破坏现有调用
): DerivedStats;
```

**验收标准**
- Buff 到期自动移除
- 多个 Buff 正确叠加（加法 + 乘法分开）
- DOT 按 tick 间隔触发
- `buff:apply` / `buff:expire` 事件正确触发
- `deriveStats` 向后兼容（不传 buff 参数时行为不变）

---

### PR-1B-03: 技能 UI 与输入绑定

**修改文件**
- `apps/game-client/src/scenes/DungeonScene.ts` — 技能使用集成、键盘输入
- `apps/game-client/src/ui/Hud.ts` — 技能栏 UI（4 槽位 + 冷却指示器）

**实施内容**

键盘绑定:
- `1` / `2` / `3` / `4` → 技能槽 0-3
- `Q` → 快捷键映射（默认映射当前主技能槽，不引入额外槽位索引）

技能栏 UI:
- 底部居中 4 个槽位（初始 2 个可用，其余锁定灰显）
- 冷却中显示半透明遮罩 + 剩余秒数
- Mana 不足时槽位边框变蓝灰

升级时技能选择:
```
levelUp 事件 → 显示 SkillPickerPanel:
  - 从已解锁技能池随机 3 个（用 rng 保证确定性）
  - 玩家选 1 个
  - 若槽位已满，弹出替换选择
  - 游戏暂停直到选择完成
```

**验收标准**
- 键盘 1-4 正确触发技能
- 冷却和 Mana 限制在 UI 上有视觉反馈
- 升级时技能选择面板正常工作
- 技能选择使用 rng（确定性）

---

### PR-1B-04: 元进度系统 — Schema 迁移 + Soul Shard

**新增文件**
- `packages/core/src/meta.ts` — 元进度管理、解锁逻辑、碎片计算
- `packages/core/src/__tests__/meta.test.ts`
- `packages/content/src/unlocks.ts` — 解锁树数据

**修改文件**
- `packages/core/src/contracts/types.ts` — 扩展 `MetaProgression`、新增 `PermanentUpgrade`、`UnlockDef`、`RunEconomyState`
- `packages/core/src/run.ts` — 运行启动读取 meta、初始化 `RunEconomyState`
- `packages/core/src/stats.ts` — `deriveStats` 考虑永久升级
- `packages/core/src/index.ts` — 导出 meta 模块
- `packages/content/src/index.ts` — 导出 unlocks

**实施内容**

扩展 `MetaProgression` (v2):
```typescript
export interface MetaProgression {
  // v1 字段保留
  runsPlayed: number;
  bestFloor: number;
  bestTimeMs: number;

  // v2 新增
  soulShards: number;
  unlocks: string[];          // JSON-safe, 不用 Set
  schemaVersion: 2;
  permanentUpgrades: {
    startingHealth: number;   // +0/+10/+20/+30
    startingArmor: number;    // +0/+2/+4/+6
    luckBonus: number;        // +0%/+5%/+10%
    skillSlots: number;       // 2/3/4 (默认 2)
    potionCharges: number;    // 0/1/2/3
  };
}

export interface RunEconomyState {
  obols: number;  // 运行内货币，运行结束清零
}
```

Schema 迁移:
```typescript
// packages/core/src/meta.ts
export function migrateMeta(raw: unknown): MetaProgression {
  // v1 → v2 迁移：
  // - runsPlayed, bestFloor, bestTimeMs: 保留, missing → 0
  // - soulShards: 0
  // - unlocks: []
  // - schemaVersion: 2
  // - permanentUpgrades: 全部基线值
  // 幂等：已经是 v2 的直接返回
}
```

Soul Shard 计算:
```typescript
export function calculateSoulShardReward(run: RunState, isVictory: boolean): number {
  // 每怪 +1, 清层 +5, 打 Boss +20, 完成 +10, 死亡 50% earned
}
```

Obol 获取:
```typescript
export function calculateObolReward(event: "monster_kill" | "floor_clear"): number {
  // monster_kill: +1, floor_clear: +5
}
```

解锁树 (4 tiers, 按 roadmap):
```typescript
// packages/content/src/unlocks.ts
export interface UnlockDef {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3 | 4;
  cost: number;           // soul shard cost
  cumulativeRequirement: number;  // 累计消费才能解锁本 tier
  effect: UnlockEffect;
}

export type UnlockEffect =
  | { type: "permanent_upgrade"; key: keyof MetaProgression["permanentUpgrades"]; value: number }
  | { type: "skill_unlock"; skillId: string }
  | { type: "affix_unlock"; affixId: string }
  | { type: "biome_unlock"; biomeId: string };
```

**验收标准**
- `migrateMeta` 将 v1 数据正确迁移为 v2，幂等
- v2 数据重复迁移无副作用
- Soul Shard 计算：monster +1, floor +5, boss +20, complete +10, death 50%
- 解锁购买扣减 soulShards，添加到 unlocks[]
- `deriveStats` 正确应用 permanentUpgrade bonus

---

### PR-1B-05: 元进度 UI — MetaMenuScene

**新增文件**
- `apps/game-client/src/scenes/MetaMenuScene.ts` — 运行间菜单场景

**修改文件**
- `apps/game-client/src/main.ts` — 注册 MetaMenuScene
- `apps/game-client/src/scenes/DungeonScene.ts` — 运行结束后跳转 MetaMenuScene
- `apps/game-client/src/ui/Hud.ts` — 运行中 Obol 显示

**实施内容**

MetaMenuScene 功能:
- 显示 Soul Shard 余额
- 4 tier 解锁树可视化（已解锁 / 可购买 / 锁定）
- 点击购买解锁
- "Start New Run" 按钮 → 切换到 DungeonScene

运行结束流程变更:
```
DungeonScene.finishRun()
  → 计算 Soul Shard 奖励
  → 更新 MetaProgression
  → saveMeta (v2)
  → 显示 RunSummary
  → 点击 "Continue" → scene.start("meta-menu")
```

localStorage key 变更:
```
blodex_meta_v1 → blodex_meta_v2
迁移逻辑：
  1. 尝试读 blodex_meta_v2
  2. 若不存在，尝试读 blodex_meta_v1 → migrateMeta → 写入 blodex_meta_v2
  3. 不删除 v1（回退安全）
```

**验收标准**
- 运行结束可正确跳转到 MetaMenuScene
- 解锁树显示正确、购买逻辑正常
- 从 MetaMenuScene 开始新运行，永久升级生效
- v1 存档可无损迁移到 v2

---

### PR-1B-06: 1B 集成测试与收敛

**新增文件**
- `packages/core/src/__tests__/skill.integration.test.ts`
- `packages/core/src/__tests__/meta.integration.test.ts`

**实施内容**
- 技能使用 → Buff 应用 → 属性变化 → 战斗结算 全链路测试
- 完整运行 → Soul Shard 结算 → 解锁购买 → 新运行应用 全链路测试
- 3 种 build 验证（全近战 / 全远程技能 / 混合）确认可行性
- 确定性验证：固定 seed 下技能选择 + Buff 计时一致

**验收标准（1B Gate）**
- [ ] 至少 3 种可行 build（通关率差异在目标区间内）
- [ ] meta-progression 不破坏确定性战斗解算
- [ ] v1→v2 schema 迁移幂等可回退
- [ ] 所有新增 core 模块有独立单测 + 集成测试

---

## 6. PR 依赖关系图

```text
1A-01 → 1A-02 → 1A-03 → 1A-05 → 1A-06
                    ↘
         1A-04 ────→ 1A-05

1B-01 → 1B-02 → 1B-03 → 1B-06
                    ↗
1B-04 → 1B-05 ────→ 1B-06
```

说明:
- 1A-01 (数据模型) 是 1A 所有后续 PR 的基础
- 1A-04 (Boss 逻辑) 和 1A-02/03 (楼层机制) 可部分并行，但 1A-05 (Boss 客户端) 依赖两者
- 1B-01 (技能) 和 1B-04 (元进度) 可并行开发
- 1B-03 (技能 UI) 和 1B-05 (元进度 UI) 分别依赖对应逻辑 PR
- 1B-06 (收敛) 等待所有 1B PR 完成

---

## 7. 交付物清单

### 新增文件（预期）
- `packages/core/src/floor.ts`
- `packages/core/src/boss.ts`
- `packages/core/src/skill.ts`
- `packages/core/src/buff.ts`
- `packages/core/src/meta.ts`
- `packages/core/src/__tests__/floor.test.ts`
- `packages/core/src/__tests__/boss.test.ts`
- `packages/core/src/__tests__/skill.test.ts`
- `packages/core/src/__tests__/buff.test.ts`
- `packages/core/src/__tests__/meta.test.ts`
- `packages/core/src/__tests__/skill.integration.test.ts`
- `packages/core/src/__tests__/meta.integration.test.ts`
- `packages/core/src/__tests__/integration-multifloor.test.ts`
- `packages/content/src/floorScaling.ts`
- `packages/content/src/bosses.ts`
- `packages/content/src/skills.ts`
- `packages/content/src/unlocks.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`

### 重点修改文件（预期）
- `packages/core/src/contracts/types.ts` — 大量新增类型
- `packages/core/src/contracts/events.ts` — 新增领域事件
- `packages/core/src/run.ts` — 多层 RunState + RunEconomyState
- `packages/core/src/stats.ts` — buff 参数 + permanentUpgrade 支持
- `packages/core/src/procgen.ts` — floorNumber 参数 + boss 房生成
- `packages/core/src/index.ts` — 导出新模块
- `packages/content/src/lootTables.ts` — Boss 掉落表
- `packages/content/src/index.ts` — 导出新模块
- `apps/game-client/src/scenes/DungeonScene.ts` — 楼层转换、Boss 战、技能集成
- `apps/game-client/src/ui/Hud.ts` — 技能栏、Boss 血条、Obol 显示
- `apps/game-client/src/main.ts` — 注册 MetaMenuScene

---

## 8. 验证与验收

### 8.1 自动化验证
```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/core build
pnpm --filter @blodex/content build
pnpm --filter @blodex/game-client typecheck
```

### 8.2 手动 smoke 清单
- Floor 1→2→3→4→5 完整推进正常
- 每层难度明显递增（怪物血量/伤害）
- 70% 击杀后楼梯出现
- Boss 两阶段 AI 正常（Heavy Strike + 召唤 → Bone Spikes + 加速召唤）
- Boss 击败 → 宝箱 + 运行胜利
- 技能 1-4 键正确触发
- 升级时技能选择面板正常
- Buff 效果可感知（War Cry 攻速提升、Frost Nova 减速）
- 运行结束 → MetaMenuScene → 解锁树 → 新运行
- 永久升级在新运行中生效

### 8.3 1A / 1B Gate

| Gate | DoD |
|------|-----|
| 1A Done | 完整 1→5 层运行可完成，Boss 击杀/死亡双分支正确结算，固定 seed replay 一致 |
| 1B Done | ≥3 种可行 build，meta 不破坏确定性，v1→v2 迁移幂等可回退 |

---

## 9. 主要风险与缓解

1. **Boss AI 复杂度导致帧率下降**
   - 缓解：Boss AI 状态机在 core 层为纯计算，渲染层只做 sprite 更新
   - 缓解：召唤物复用现有怪物系统，不单独维护

2. **技能系统与现有战斗系统集成冲突**
   - 缓解：技能通过 CombatSystem 的扩展接口集成，不替换现有 auto-attack
   - 缓解：auto-attack 保留为默认行为，技能为主动触发的额外操作

3. **Schema 迁移丢失用户数据**
   - 缓解：不删除 v1 key，保留回退路径
   - 缓解：迁移函数有完整单测覆盖所有边界（null/undefined/部分字段）

4. **楼层转换时内存泄漏**
   - 缓解：楼层转换复用 Phase 0 的 EntityManager 清理机制
   - 缓解：每次 floor transition 前调用 `EntityManager.reset()` + EventBus 清理

5. **技能平衡难以在没有大量 playtest 的情况下确定**
   - 缓解：技能数值全部数据驱动（content 层），调整不需改逻辑代码
   - 缓解：1B Gate 只要求 3 种可行 build，不要求完美平衡

---

## 10. 资产依赖与交付门槛（新增）

Phase 1 开发依赖资产供应链，具体规范见：`docs/asset-pipeline-spec.md`。

### 10.1 1A 最小资产包（阻塞项）
- Boss 资源：
  - `boss_bone_sovereign` sprite（至少 1 套）
  - telegraph 基础贴图（圆/区域警示）
- 地图资源：
  - 楼梯可见态 sprite（或替代可视化贴图）
  - Boss 房地面/边界可区分视觉资源（可先占位）
- 音频资源（最小）：
  - `combat:hit`, `combat:death`, `combat:crit`
  - `boss:phaseChange`

### 10.2 1B 最小资产包（阻塞项）
- 技能图标：
  - `cleave`, `shadow_step`, `blood_drain`, `frost_nova`, `war_cry`
- 技能反馈资源：
  - 每个技能至少 1 个 cast SFX
  - 每个技能至少 1 个基础 VFX 占位资源
- 元进度 UI 资源：
  - 解锁树节点状态图标（locked/available/unlocked）

### 10.3 资产校验门禁（并入 CI）
- 所有新增资产必须有 manifest 条目（图片/音频）。
- `license`、`sourceType`、`sourceRef`、`revision` 字段必须完整。
- 阻断规则：禁止 `blocked` 许可资产进入运行时目录。
