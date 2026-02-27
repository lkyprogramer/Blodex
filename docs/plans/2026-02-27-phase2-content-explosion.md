# Phase 2 内容爆发实施方案（2A/2B）

## Context

基于 `docs/plans/2026-02-23-long-term-roadmap-design.md` 的 Phase 2 方向，且结合当前仓库落地状态（Phase 1 已完成多层地牢、Boss、技能/Buff、元进度基础），Phase 2 的核心目标是：

- 把“系统骨架”转化为“可重复游玩的内容密度”；
- 在不破坏 deterministic 回放与 core/client 分层的前提下，扩展 Biome、Hazard、怪物派系、怪物词缀、装备池与随机事件；
- 引入 Obol 真实消费回路（Merchant / Event）并形成每局差异。

**执行顺序（硬约束）：**
- **2A 先行**：Biome + Hazard + 怪物派系扩展 + 词缀系统（先做战斗与关卡层差异）
- **2B 后续**：装备/消耗品扩展 + 随机事件 + Merchant 经济回路（再做策略与资源决策深度）

---

## 1. 目标与边界

### 1.1 目标
- 新增 4 套 Biome 语义（Floor 1-5 映射）并支持 Floor 3-4 顺序随机化
- 新增 Hazard 系统（地面持续伤害、移动修正、周期陷阱）
- 新增 7 个怪物原型与 5 种 AI 行为模式（kite/ambush/swarm/shield/support）
- 新增 Monster Affix 系统（Floor 3+，按比例挂词缀）
- 扩展装备词缀池（进攻/防御/功能）并引入 Unique/Boss Exclusive 结构化掉落
- 新增 Consumable（药水/卷轴）并接入运行时背包与快捷使用
- 新增 Random Event System（含 Wandering Merchant）并打通 Obol 消耗
- 保持 replay 可重放、meta 存档可兼容、性能稳定（桌面目标 60fps）

### 1.2 非目标
- 不做 Phase 3 级别的 VFX/SFX 全量表现重构
- 不做网络化、多人、赛季化或服务器权威校验
- 不做完全开放的关卡编辑器
- 不改写 Phase 1 的核心战斗公式（只允许 content 数值调优）

---

## 2. 前置假设（Phase 1 交付物）

Phase 2 实施依赖以下现有能力：

| 模块 | 路径 | 用途 |
|------|------|------|
| Floor/Boss/Skill/Buff/Meta 核心模块 | `packages/core/src/*.ts` | 扩展基础状态机与解算 |
| Typed EventBus | `packages/core/src/eventBus.ts` | 注入新领域事件与客户端副作用桥接 |
| 多层运行状态 | `packages/core/src/run.ts` | Floor 级内容切换的生命周期承载 |
| 内容数据层 | `packages/content/src/*.ts` | Biome/怪物/掉落/事件数据配置 |
| DungeonScene 系统编排 | `apps/game-client/src/scenes/DungeonScene.ts` | Biome/Hazard/Event 的运行时编排 |
| HUD 与系统日志 | `apps/game-client/src/ui/Hud.ts` | 事件反馈、经济提示、失败原因可见化 |

---

## 3. 不可协商约束

1. **Determinism 优先**
- 所有影响战斗/掉落/事件结果的随机行为必须来源于显式 RNG stream。
- Floor 3/4 Biome 顺序、事件抽取、词缀抽取、商店库存都必须可重放。

2. **分层边界**
- `packages/core` 不引入 Phaser 依赖，不直接处理贴图、Tween、音频。
- hazard/affix/event 的“规则判定”在 core；渲染表现和交互面板在 client。

3. **Schema 安全演进**
- Meta 继续使用 v2 语义向后兼容；如新增字段必须通过 `migrateMeta` 幂等迁移。
- 禁止破坏 `runsPlayed/bestFloor/bestTimeMs/unlocks/permanentUpgrades` 既有字段。

4. **性能预算**
- 目标基线：普通层 20~35 活跃实体时，`update` 平均 < 8ms（桌面环境）。
- Hazard tick 与事件轮询必须采用时间片触发，禁止每帧全图扫描。

5. **内容扩展可数据化**
- 新 Biome/怪物/词缀/事件不得硬编码在 `DungeonScene` 的 `if/else` 分支内。
- 必须以 `packages/content` 数据定义驱动，scene 只做分发与编排。

### 3.1 RNG Stream Contract（Phase 2 扩展）

在现有 `procgen/spawn/combat/loot/skill/boss` 基础上新增：

```typescript
type RunRngStreamName =
  | "procgen"
  | "spawn"
  | "combat"
  | "loot"
  | "skill"
  | "boss"
  | "biome"
  | "hazard"
  | "event"
  | "merchant";
```

规则：
- Biome 选择只消费 `biome` 流；
- Hazard 周期触发只消费 `hazard` 流；
- 事件生成与分支风险判定只消费 `event` 流；
- Merchant 刷货只消费 `merchant` 流；
- 任何跨流消费都视为 replay 漂移风险。

---

## 4. Phase 2A — 环境与敌对内容扩展

### PR-2A-01: Biome 数据模型与楼层映射

**新增文件**
- `packages/core/src/biome.ts`
- `packages/content/src/biomes.ts`
- `packages/core/src/__tests__/biome.test.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/run.ts`
- `packages/content/src/index.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**实施内容**

1) 新增 `BiomeDef` 与映射策略：

```typescript
interface BiomeDef {
  id: "forgotten_catacombs" | "molten_caverns" | "frozen_halls" | "bone_throne";
  name: string;
  ambientColor: number;
  floorTilesetKey: string;
  wallStyleKey: string;
  roomCount: { min: number; max: number };
  monsterPool: string[];
  hazardPool: string[];
  lootBias: Partial<Record<EquipmentSlot, number>>;
}
```

2) Floor → Biome 规则：
- Floor 1-2 固定 `forgotten_catacombs`
- Floor 3-4 在 `molten_caverns` 与 `frozen_halls` 间按 `runSeed` 决定顺序
- Floor 5 固定 `bone_throne`

3) `RunState` 扩展 `currentBiomeId`，并在 `floor:enter` payload 中附带 biome 信息。

**验收标准**
- 固定 seed 下 Floor 3/4 Biome 顺序一致
- 不同 seed 下 Floor 3/4 至少存在顺序变化
- `DungeonScene` 不再通过硬编码 floor number 决定视觉风格

---

### PR-2A-02: Hazard 核心系统

**新增文件**
- `packages/core/src/hazard.ts`
- `packages/core/src/__tests__/hazard.test.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/contracts/events.ts`
- `packages/core/src/index.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/systems/RenderSystem.ts`

**实施内容**

引入 Hazard 模型：

```typescript
type HazardType = "damage_zone" | "movement_modifier" | "periodic_trap";

interface HazardDef {
  id: string;
  type: HazardType;
  damagePerTick?: number;
  tickIntervalMs?: number;
  movementMultiplier?: number;
  triggerIntervalMs?: number;
  telegraphMs?: number;
  radiusTiles?: number;
  spriteKey: string;
}
```

新增领域事件：
- `hazard:trigger`
- `hazard:damage`
- `hazard:enter`
- `hazard:exit`

运行时规则：
- lava：驻留 DOT（damage_zone）
- ice：移动修正（movement_modifier，带滑移系数）
- bone spike：周期触发 + telegraph（periodic_trap）

**验收标准**
- Hazard 伤害触发遵循 tick 间隔，不随帧率漂移
- `movement_modifier` 与 Buff slow 叠加关系可预测（乘法叠加）
- 所有 Hazard 事件出现在 system log，便于战斗归因

---

### PR-2A-03: 怪物派系扩展与 AI 行为模式

**新增文件**
- `packages/core/src/__tests__/ai.behavior.test.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/content/src/types.ts`
- `packages/content/src/monsters.ts`
- `apps/game-client/src/systems/AISystem.ts`
- `apps/game-client/src/systems/MonsterSpawnSystem.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**实施内容**

扩展 AI 行为类型：

```typescript
type MonsterAiBehavior = "chase" | "kite" | "ambush" | "swarm" | "shield" | "support";
```

新增怪物（7）：
- `magma_crawler`（swarm）
- `ember_wraith`（kite）
- `flame_brute`（chase + on-death aoe）
- `frost_warden`（shield）
- `ice_specter`（kite + slow hit）
- `shadow_lurker`（ambush）
- `bone_priest`（support）

把 `MonsterArchetypeId` 从手写 union 升级为 data-derived（避免每新增怪物都要手改 contracts）。

**验收标准**
- 各行为模式在 AI 单测中可复现（给定位置输入 -> 期望输出动作）
- Floor 3+ 怪物池不再只由 3 原型构成
- support 怪可对 boss/summon 触发治疗（领域事件可观测）

---

### PR-2A-04: Monster Affix 系统

**新增文件**
- `packages/core/src/monsterAffix.ts`
- `packages/core/src/__tests__/monsterAffix.test.ts`
- `packages/content/src/monsterAffixes.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/contracts/events.ts`
- `packages/content/src/index.ts`
- `apps/game-client/src/systems/CombatSystem.ts`
- `apps/game-client/src/systems/RenderSystem.ts`
- `apps/game-client/src/ui/Hud.ts`

**实施内容**

新增词缀：
- `frenzied`、`armored`、`vampiric`、`splitting`

运行时规则：
- Floor 1-2: affix ratio = 0
- Floor 3-4: 20% 概率挂 1 词缀
- Floor 5: 仅普通怪可挂；boss summon 默认不挂（减少战斗噪声）

扩展事件：
- `monster:affixApplied`
- `monster:split`
- `monster:leech`

**验收标准**
- 固定 seed 下 affix 分配确定
- `splitting` 生成子体不会破坏 kill/loot 统计
- HUD 日志能清晰展示“怪物因词缀触发了什么”

---

### PR-2A-05: 2A 集成收敛

**新增文件**
- `packages/core/src/__tests__/integration-biome-hazard-affix.test.ts`

**实施内容**
- 完整验证：floor enter -> biome resolve -> hazard spawn -> combat with affix -> floor clear
- 校验 deterministic：同 seed 的 biome 顺序、hazard 触发序列、affix 分配一致

**2A Gate**
- [ ] Floor 3/4 具备可感知差异（Biome + Hazard + Monster Pool）
- [ ] 词缀系统上线且可稳定重放
- [ ] 2A 新增事件全部接入 HUD 日志

---

## 5. Phase 2B — 经济与事件内容扩展

### PR-2B-01: 装备词缀池与 Item 数据结构扩展

**新增文件**
- `packages/core/src/__tests__/loot.affix-expansion.test.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/content/src/types.ts`
- `packages/content/src/items.ts`
- `packages/content/src/lootTables.ts`
- `packages/core/src/loot.ts`

**实施内容**

新增 affix key（示例）：
- offensive: `lifesteal`, `critDamage`, `aoeRadius`, `damageOverTime`
- defensive: `thorns`, `healthRegen`, `dodgeChance`
- utility: `xpBonus`, `soulShardBonus`, `cooldownReduction`

结构调整：
- `ItemDef` 增加 `kind: "equipment" | "consumable" | "unique"`（默认 equipment）
- Unique 采用固定 affix，不走随机 roll
- Boss exclusive table 与 rare table 分离配置并允许权重调优

**验收标准**
- 普通装备仍保持现有 roll 兼容
- Unique 不受随机 affix 干扰
- 掉落总分布可通过 seed 回放重现

---

### PR-2B-02: Consumable 系统（药水/卷轴）

**新增文件**
- `packages/core/src/consumable.ts`
- `packages/core/src/__tests__/consumable.test.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/contracts/events.ts`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**实施内容**

初始 consumable：
- Health Potion（40% max HP）
- Mana Potion（60% max Mana）
- Scroll of Mapping（揭示当前层）

输入与限制：
- 快捷键 `R`（血药）/`F`（蓝药）
- charge 上限受 `permanentUpgrades.potionCharges` 影响

**验收标准**
- 使用消耗品有明确日志与冷却/次数反馈
- charge 归零后按钮禁用且有原因提示
- mapping 卷轴不影响战斗 determinism（只影响可视信息）

---

### PR-2B-03: Random Event + Merchant 系统

**新增文件**
- `packages/core/src/randomEvent.ts`
- `packages/core/src/__tests__/randomEvent.test.ts`
- `packages/content/src/randomEvents.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/contracts/events.ts`
- `packages/core/src/run.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/style.css`

**实施内容**

Event 模型：

```typescript
interface RandomEventDef {
  id: string;
  name: string;
  floorRange: { min: number; max: number };
  biomeIds?: string[];
  spawnWeight: number;
  choices: EventChoice[];
}

interface EventChoice {
  id: string;
  cost?: { type: "health" | "mana" | "obol"; amount: number };
  rewards: EventReward[];
  risk?: { chance: number; penalty: EventReward };
}
```

首批 6 事件：
- Mysterious Shrine / Trapped Chest / Wandering Merchant / Cursed Altar / Fallen Adventurer / Unstable Portal

Merchant 规则：
- 每次触发刷 3 件货物，价格 5~15 Obol
- 库存由 `merchant` 流决定，运行内可重放

**验收标准**
- 每层最多触发 1 个事件，避免事件噪声淹没战斗节奏
- Event 选择后有完整日志链路（cost -> reward -> 风险结果）
- Obol 形成“可赚可花”的闭环，不再只在 summary 显示

---

### PR-2B-04: Meta 解锁树与 Phase 2 内容接入

**新增文件**
- `packages/core/src/__tests__/meta.phase2-unlock.test.ts`

**修改文件**
- `packages/content/src/unlocks.ts`
- `packages/core/src/meta.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`

**实施内容**
- 扩展 unlock effect：`biome_unlock` / `affix_unlock` / `event_unlock`
- Meta 菜单明确展示 Phase 2 内容开关状态（未解锁时灰显）
- migrate 逻辑保持幂等（仍以 schemaVersion=2 延展，不强制升级到 v3）

**验收标准**
- 未解锁内容不会参与候选池
- 解锁后下一局生效且 deterministic 不漂移
- 老存档可直接进入新版本并安全补默认值

---

### PR-2B-05: 2B 集成收敛

**新增文件**
- `packages/core/src/__tests__/integration-phase2-economy-event.test.ts`

**实施内容**
- 验证链路：kill -> obol -> merchant/event spend -> item/consumable gain -> run end summary/meta
- 回放一致性校验：事件触发序列与购买结果一致

**2B Gate**
- [ ] 事件系统与 Merchant 稳定运行
- [ ] Obol 消费成为有效决策，不再是“只统计不使用”
- [ ] 新增内容不破坏 Phase 1 运行闭环与结算

---

## 6. PR 依赖关系图

```text
2A-01 -> 2A-02 -> 2A-03 -> 2A-04 -> 2A-05

2B-01 -> 2B-02 -> 2B-03 -> 2B-05
   \                         ^
    -> 2B-04 ----------------|
```

说明：
- 2A 完整通过后再进入 2B，降低“玩法链路 + 经济链路”同时变更风险。
- 2B-04（unlock 接入）可与 2B-02/03 并行，但必须在 2B-05 前合流验证。

---

## 7. 交付物清单（预期）

### 新增文件
- `docs/plans/2026-02-27-phase2-content-explosion.md`（本文件）
- `packages/core/src/biome.ts`
- `packages/core/src/hazard.ts`
- `packages/core/src/monsterAffix.ts`
- `packages/core/src/consumable.ts`
- `packages/core/src/randomEvent.ts`
- `packages/content/src/biomes.ts`
- `packages/content/src/monsterAffixes.ts`
- `packages/content/src/randomEvents.ts`
- `packages/core/src/__tests__/integration-biome-hazard-affix.test.ts`
- `packages/core/src/__tests__/integration-phase2-economy-event.test.ts`

### 重点修改文件
- `packages/core/src/contracts/types.ts`
- `packages/core/src/contracts/events.ts`
- `packages/core/src/run.ts`
- `packages/core/src/meta.ts`
- `packages/content/src/monsters.ts`
- `packages/content/src/items.ts`
- `packages/content/src/lootTables.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/systems/AISystem.ts`
- `apps/game-client/src/systems/RenderSystem.ts`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`

---

## 8. 验证与验收

### 8.1 自动化验证

```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/core build
pnpm --filter @blodex/content build
pnpm --filter @blodex/game-client typecheck
pnpm dev
```

### 8.2 手工 Smoke 清单
- Floor 3/4 Biome 顺序在不同 seed 下变化，同 seed 下稳定
- lava/ice/spike 三类 hazard 反馈和伤害结算正确
- 新怪物 AI 行为可观察（kite 拉扯、ambush 伏击、support 治疗）
- 词缀怪触发效果有日志并可解释死亡原因
- Event 面板可交互，分支成本与收益正确
- Merchant 可消费 Obol 购买并立即生效
- Consumable 使用后数值正确变化，charge 与禁用态正确
- run end 结算与 meta 数据仍正确（含 soul shard / obol）

### 8.3 Phase 2 Gate

| Gate | DoD |
|------|-----|
| 2A Done | Biome+Hazard+Monster+Affix 全链路上线且可重放 |
| 2B Done | Event+Merchant+Consumable+扩展掉落上线，Obol 完整消费闭环形成 |

---

## 9. 主要风险与缓解

1. **内容膨胀导致平衡崩坏**
- 缓解：所有数值在 `packages/content` 数据层配置，不在 core 写死。
- 缓解：先过“可玩性 Gate”，后做细平衡迭代，避免过早调参。

2. **随机源耦合导致 replay 漂移**
- 缓解：严格按 stream 隔离消费，新增回放断言测试。

3. **事件系统侵入主循环导致卡顿**
- 缓解：事件触发点限定在“进入事件房/交互确认”而非每帧轮询。
- 缓解：Hazard/事件扫描采用房间级索引或触发器缓存。

4. **UI 复杂度提升导致信息噪声**
- 缓解：遵循“日志优先、面板极简”的反馈策略。
- 缓解：事件与商店面板采用暂停式交互，避免战斗中信息洪泛。

5. **资产供应不足阻塞开发节奏**
- 缓解：先用占位资源（灰盒）打通逻辑，再逐步替换正式资产。
- 缓解：资源规范统一遵循 `docs/asset-pipeline-spec.md`。

---

## 10. 资产依赖与里程碑门槛

### 10.1 2A 最小资产包（阻塞项）
- Biome 地面/墙体差异贴图（至少 3 套）
- Hazard 预警与地面标记贴图（lava/ice/spike）
- 新怪物基础 sprite（7 个最小集可分批）

### 10.2 2B 最小资产包（阻塞项）
- 事件面板 UI 图标（风险/奖励/货币）
- Consumable 图标（血药/蓝药/卷轴）
- Merchant 资源（商人立绘/图标可占位）

### 10.3 门禁规则
- 所有新增资产必须进入 manifest（图片/音频）并通过 license 字段校验
- 禁止 `blocked` 许可资产进入运行时目录

---

## 11. Phase 2 美术与音频资源生成计划（新增）

本节补齐“可执行生产路径”，与 `docs/asset-pipeline-spec.md` 一致，并绑定到 2A/2B 里程碑。

### 11.1 资源范围矩阵（Phase 2 全量）

#### 美术资源（图片）

| 资源域 | category | 最低数量（DoD） | 目标数量（Recommended） | 主要消费模块 |
|--------|----------|----------------|-------------------------|--------------|
| Biome 地表/墙体 | `tile` | 4 biome × 2 图 = 8 | 4 biome × 4 图 = 16 | `RenderSystem.drawDungeon` |
| Hazard 可视资源 | `fx` / `tile` | lava/ice/spike 各 1 套 = 3 | 每类 2 套 + telegraph 变体 = 8 | `DungeonScene` hazard overlay |
| 新怪物立绘 | `monster_sprite` | 7 | 10（含变体） | `MonsterSpawnSystem` |
| 新 Boss/召唤变体 | `boss_sprite` / `monster_sprite` | 1 | 3 | Boss phase/summon |
| 事件/商店 UI 图标 | `ui_icon` / `hud` | 12 | 24 | Event/Merchant panel |
| 消耗品图标 | `item_icon` | 3 | 6 | Inventory/HUD 快捷栏 |
| 技能/状态图标补充 | `skill_icon` / `ui_icon` | 6 | 12 | Buff/debuff/event affordance |

#### 音频资源（audio）

| 资源域 | category | 最低数量（DoD） | 目标数量（Recommended） | 事件映射 |
|--------|----------|----------------|-------------------------|----------|
| Biome 环境循环音 | `amb` | 4 biome × 1 loop = 4 | 每 biome 2 loop = 8 | `amb:biome:*` |
| Hazard 触发音 | `sfx` | 3 | 6 | `hazard:trigger` |
| 新怪物攻击/受击音 | `sfx` | 7 | 14 | `combat:*` + archetype tag |
| 事件交互音 | `ui` / `sfx` | 6 | 12 | `event:*` |
| Merchant 交互音 | `ui` | 3 | 6 | `merchant:open/buy/fail` |
| 消耗品使用音 | `sfx` | 3 | 6 | `consumable:use:*` |
| Floor/Biome 切换提示音 | `ui` / `sfx` | 2 | 4 | `floor:enter`, `biome:enter` |

### 11.2 命名规范与 ID 规划

图片 ID 命名（新增）：

```text
biome_<name>_tile_floor_<index>
biome_<name>_tile_wall_<index>
hazard_<type>_<variant>_<index>
monster_<faction>_<role>_<index>
ui_event_<event_id>_<index>
ui_merchant_<action>_<index>
item_consumable_<type>_<index>
```

音频 ID 命名（新增）：

```text
amb_biome_<name>_loop_<index>
sfx_hazard_<type>_<action>_<index>
sfx_monster_<archetype>_<action>_<index>
sfx_consumable_<type>_<index>
ui_event_<event_id>_<action>_<index>
ui_merchant_<action>_<index>
```

约束：
- ID 与 `outputName` 一一对应，禁止同义不同名。
- `sourceRef` 必须可追溯（生成模型或外部文件名）。
- `license` 仅允许 `allowed` 或 `review-required`（后者必须 `attribution` 非空）。

### 11.3 生产批次（与 2A/2B 对齐）

#### Wave A（对齐 2A，先可玩）

目标：先把 Biome/Hazard/新怪可运行，允许占位质量。

产出最小包：
- 8 张 biome 基础 tile（4 biome × floor/wall）
- 3 套 hazard 贴图 + 3 个 hazard SFX
- 7 个怪物 sprite + 每怪至少 1 个攻击/受击音
- 4 条 biome ambient loop

验收条件：
- 在 2A smoke 中可清晰区分 biome 差异
- hazard 有“视觉+音频”双反馈
- 新怪都可被识别（轮廓与动作角色不混淆）

#### Wave B（对齐 2B，策略层）

目标：打通事件、商店、消耗品的交互资源。

产出最小包：
- 事件图标 6 组，商店图标 3 组
- 消耗品图标 3 个（血药/蓝药/卷轴）
- 事件 UI 音 6 个，商店音 3 个，消耗品音 3 个

验收条件：
- 事件面板与商店面板不出现空图标/缺音
- 失败路径有明确错误音（如 Obol 不足）
- 日志文本与图标语义一致

#### Wave C（质量收敛）

目标：替换占位资产，完成统一风格与响度规范。

产出：
- Biome/hazard/monster 第二套变体
- 主循环关键事件音量标准化（`loudnorm`）后回归
- 资源冗余清理（删除未引用 ID）

### 11.4 实际命令链（按现有仓库脚本）

#### 图片流水线

```bash
pnpm assets:compile
pnpm assets:generate
pnpm assets:images:report
pnpm assets:validate
```

说明：
- `assets:generate` 会执行生成脚本并调用 `assets:images:optimize`。
- 当前优化依赖 `output/imagegen/raw`，CI 或本地需确保该目录由生成步骤产出。

#### 音频流水线

```bash
pnpm assets:audio:compile
pnpm assets:audio:sync
pnpm assets:audio:validate
pnpm assets:validate
```

说明：
- 仓库当前没有 `assets:audio:generate` 命令，音频来源分两种：
  1) 外部授权文件放入 `assets/audio-sources/`
  2) 缺失文件由 `sync_audio_assets.sh` 生成静音占位（用于不阻塞联调）
- `assets:audio:validate` 会校验文件存在与许可字段门禁。

### 11.5 计划文件变更清单（必须落地）

1. 扩展 `assets/source-prompts/asset-plan.yaml`
- 增加 Phase 2 的 biome/hazard/monster/ui/consumable 图像条目。

2. 扩展 `assets/source-prompts/audio-plan.yaml`
- 增加 biome ambient、hazard、event、merchant、consumable 音频条目。
- 为所有 `review-required` 条目补全 attribution。

3. 生成并提交清单
- `assets/generated/manifest.json`
- `assets/generated/audio-manifest.json`

4. 客户端绑定校验
- 新增资源 ID 必须在 `DungeonScene`/`Hud` 的加载与事件映射中有引用。
- 未引用资源在 Wave C 清理，避免仓库膨胀。

### 11.6 质量门禁（发布前必须通过）

- 资源完整性：manifest 中的 `outputPath` 全部可落盘读取。
- 许可合规：`blocked` 资源为 0；`review-required` 的 attribution 完整。
- 性能门禁：新增资源后首屏加载时间不超过基线 +20%。
- 可读性门禁：1080p 与 720p 下关键战斗对象可识别（人工 smoke）。
- 音频门禁：无爆音、无明显切边、循环环境音无断点。

### 11.7 风险与回退策略

1. 资源延期风险
- 回退：使用脚本生成的占位资产先保证功能闭环，视觉后补。

2. 许可不清风险
- 回退：该资源立即下线，替换为 `generated` 或 CC0 来源。

3. 体积膨胀风险
- 回退：优先保留 DoD 最小集，变体资源延后到 Wave C。

4. 风格不一致风险
- 回退：统一 `styleTag` 批次重生成，不在同一批混用多风格。
