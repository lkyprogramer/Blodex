# Phase 4C — 分支路径 + 技能扩展 + 协同系统（PR 级实施规范）

**优先级**: P3（Path）+ P4（Skill）+ P5（Synergy/Endgame）  
**目标**: 在保持 deterministic 与可维护边界的前提下，形成可重复探索的路径分歧与构筑深度。  
**前置条件**: 4B 全部门禁通过。

---

## 1. 范围与非目标

### 1.1 范围

1. `Meta v4 -> v5` 与 `RunSave v1 -> v2`
2. Floor 2 双楼梯分支（3A/3B -> 4A/4B -> 5 收敛）
3. Challenge Room
4. 技能池扩展到 15 + 技能升级机制
5. Synergy 检测与百科持久化
6. Endless 模式
7. Daily Challenge

### 1.2 非目标

1. 不做联机排行榜服务（仅本地历史）
2. 不做跨日历时区同步（基于本地时区日切）
3. 不做全局资产重制（继续复用当前资源）

---

## 2. 不可协商约束

1. **路径可恢复**：分支选择必须写入 `RunState` 与 save。
2. **规则无歧义**：Daily 单日只允许一次“计分+奖励”尝试。
3. **经济防爆**：Endless 收益需封顶或递减，防止线性刷爆。
4. **兼容过渡**：旧 `StaircaseState` 调用点需有迁移适配层。
5. **触发可解释**：Synergy 条件与效果必须类型化、可单测。

---

## 3. 契约改造

### 3.1 RunState 扩展

```typescript
interface RunStateV2 extends RunState {
  // branch path
  branchChoice?: "molten_route" | "frozen_route";

  // endless
  inEndless: boolean;
  endlessFloor: number; // 0 = not started, 1 = first endless floor after victory

  // daily context
  runMode: "normal" | "daily";
  dailyDate?: string; // YYYY-MM-DD in local timezone
}
```

### 3.2 StaircaseState 扩展

```typescript
type StaircaseStateV2 =
  | {
      kind: "single";
      visible: boolean;
      position: { x: number; y: number };
    }
  | {
      kind: "branch";
      visible: boolean;
      options: [BranchStairOption, BranchStairOption];
      selected?: "left" | "right";
    };

interface BranchStairOption {
  position: { x: number; y: number };
  targetBiome: BiomeId;
  label: string;
}
```

### 3.3 RunSave v2

```typescript
interface RunSaveDataV2 extends RunSaveDataV1 {
  schemaVersion: 2;
  run: RunStateV2;
  staircase: StaircaseStateV2;
}
```

### 3.4 Meta v5

```typescript
interface DailyHistoryEntry {
  date: string; // YYYY-MM-DD
  score: number;
  floorReached: number;
  kills: number;
  clearTimeMs: number;
  challengeSuccessCount: number;
  seed: string;
  rewarded: boolean;
}

interface MetaProgressionV5 extends MetaProgressionV4 {
  schemaVersion: 5;

  synergyDiscoveredIds: string[];
  endlessBestFloor: number;

  dailyHistory: DailyHistoryEntry[];
  dailyRewardClaimedDates: string[];
}
```

### 3.5 RunSave 启动期读取与迁移策略

localStorage key 策略：

1. 新 key：`blodex_run_save_v2`
2. 兼容 key：`blodex_run_save_v1`

启动流程：

1. 优先读取 v2；若不存在再读取 v1
2. 命中 v1 时执行 `migrateRunSaveV1ToV2`，通过 `validateSaveV2` 后写入 v2 并删除 v1
3. 迁移失败时保留 v1 原值，MetaMenu 仅允许 `Abandon`，禁止 `Continue`（避免坏档继续扩散）

---

## 4. 路径分支设计（可实现口径）

### 4.1 楼层拓扑

```text
F1 Catacombs
F2 Catacombs (branch stairs appear)
  -> Route A: F3 Molten -> F4 Phantom Graveyard
  -> Route B: F3 Frozen -> F4 Venom Swamp
F5 Bone Throne (merge)
```

### 4.2 分支选择规则

1. 仅 F2 使用 `kind: "branch"`
2. 玩家踏入某分支楼梯后，写入 `run.branchChoice`
3. F3/F4 生物群系由 `branchChoice` 决定，不再随机
4. F5 强制收敛

### 4.3 新怪物数量修正

本阶段新增怪物应为 **5 个**（非 4 个）：

1. Wraith Knight
2. Soul Eater
3. Venom Spitter
4. Swamp Hulk
5. Fungal Host

### 4.4 新增生物群系清单（固定）

1. `phantom_graveyard`（Route A 的 Floor 4）
2. `venom_swamp`（Route B 的 Floor 4）

实现要求：

1. `packages/content/src/biomes.ts` 增量定义两个 biome
2. `packages/content/src/monsters.ts` 增量定义 5 个新 archetype
3. `BiomeId` 联合类型同步扩展，避免字符串漂移

---

## 5. Challenge Room 规范

### 5.1 生成

1. Floor 2+，每层最多 1 个
2. 生成概率 10%-15%
3. 房间为 `roomType: "challenge"`，入口门初始可交互

### 5.2 流程

1. 玩家确认进入后关门
2. 30s 计时，2-3 波怪
3. 成功：稀有掉落 + shard 奖励 + blueprint chance
4. 失败：传出房间 + HP 处罚，无奖励

### 5.3 契约

```typescript
interface ChallengeRoomState {
  roomId: string;
  started: boolean;
  finished: boolean;
  success: boolean;
  waveIndex: number;
  startedAtMs?: number;
  deadlineAtMs?: number;
}
```

---

## 6. 技能扩展（15 技能）

### 6.1 技能池规则

1. 三系各 5 个（战士/游侠/奥术）
2. 默认 + blueprint 解锁混合池
3. 升级三选一基于加权随机

### 6.2 升级加权

```typescript
interface SkillOfferWeightContext {
  strongestStat: "strength" | "dexterity" | "intelligence";
  ownedSkillIds: string[];
}

// weight policy
// - same archetype as strongest stat: x2
// - already owned skill: x0.5
// - otherwise: x1
```

### 6.3 技能升级

- 选到已有技能则提升等级（L1->L2->L3）
- L2：效果 +30%，CD -10%
- L3：效果 +60%，CD -20%

---

## 7. Synergy 系统

### 7.1 条件与效果（类型化）

```typescript
interface SynergyDef {
  id: string;
  category: "weapon_skill" | "skill_skill" | "talent_mutation" | "equipment";
  conditions: SynergyCondition[];
  effects: SynergyEffect[];
}

type SynergyCondition =
  | { type: "weapon_type"; value: WeaponType }
  | { type: "skill_equipped"; value: string }
  | { type: "skill_level_at_least"; skillId: string; level: number }
  | { type: "talent_rank_at_least"; talentId: string; rank: number }
  | { type: "mutation_equipped"; value: string }
  | { type: "special_affix_at_least"; key: ItemSpecialAffixKey; value: number };

type SynergyEffect =
  | { type: "skill_damage_percent"; skillId: string; value: number }
  | { type: "skill_modifier"; skillId: string; key: "radius" | "duration" | "manaCost"; value: number }
  | { type: "stat_percent"; stat: keyof DerivedStats; value: number }
  | { type: "cooldown_override"; key: string; valueMs: number };
```

### 7.2 检测时机

1. run start
2. 装备变更
3. 技能变更/升级
4. 天赋或变异变化（通常发生在 run 外）

### 7.3 百科持久化

- 首次激活写入 `meta.synergyDiscoveredIds`
- 重复激活不重复写

---

## 8. Endless 模式（经济护栏）

### 8.1 解锁与入口

- 任意难度通关一次后解锁
- 击败 F5 后二选一：`Claim Victory` / `Enter Abyss`

### 8.2 数值缩放

```text
floor >= 6
monster hp/dmg per floor: +25%
affix rules:
  floor >= 8 : +1 affix
  floor >= 10: +2 affixes
```

### 8.3 奖励公式（修订）

为防刷，采用封顶公式：

```typescript
function endlessKillShardReward(floor: number): number {
  // cap at 20 per kill
  return Math.min(floor * 2, 20);
}
```

并增加每层结算奖励替代线性暴涨：

```typescript
floorClearBonus = 8 + floor; // linear but low slope
```

补充限制：

1. Endless 中 blueprint 掉率加成最多 +20%（封顶）
2. Endless 中每日奖励不叠加 daily 奖励（防止双重刷）

---

## 9. Daily Challenge（规则收敛）

### 9.1 生成规则

```text
seed = sha256(`blodex_daily_${localDate}`)
difficulty = hard
fixed mutations + fixed weapon type
```

### 9.2 尝试与奖励规则（修订）

1. 每日仅允许一次“计分尝试”
2. 当日再次进入仅可 Practice（不计分、不发奖）
3. 奖励按 `dailyRewardClaimedDates` 幂等发放

实现细节：

1. `dailyHistory` 仅保留最近 30 天（超过滚动淘汰）
2. 同日若已有 scored entry，Practice 模式仅覆盖本地临时结果，不回写 scored entry

### 9.3 计分

```text
score = floorReached * 1000
      + kills * 10
      + max(0, 900 - floor(clearTimeMs / 1000))
      + challengeSuccessCount * 250
```

补充规则：

1. `clearTimeMs` 从 run start 到 run end，单位毫秒。
2. 同分排名 tie-break：`floorReached` 高者优先 -> `clearTimeMs` 低者优先 -> `kills` 高者优先。
3. Daily 历史写入字段必须完整（`score/floorReached/kills/clearTimeMs/challengeSuccessCount/seed/rewarded`），便于回溯审计。

---

## 10. PR 拆分（可直接执行）

### PR-4C-01：契约与迁移

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/meta.ts`
- `packages/core/src/save.ts`
- `packages/core/src/__tests__/meta.test.ts`
- `packages/core/src/__tests__/save.test.ts`

**交付点**
- `Meta v5`、`RunSave v2`、`StaircaseStateV2`

---

### PR-4C-02：路径分支

**新增文件**
- `packages/core/src/pathSelection.ts`

**修改文件**
- `packages/core/src/biome.ts`
- `packages/core/src/floor.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/ui/PathSelectOverlay.ts`（new）

**交付点**
- F2 双楼梯 + F3/F4 分支 + F5 收敛

---

### PR-4C-03：Challenge Room

**新增文件**
- `packages/core/src/challengeRoom.ts`
- `packages/core/src/__tests__/challengeRoom.test.ts`

**修改文件**
- `packages/core/src/procgen.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**交付点**
- challenge 计时/波次/结算

---

### PR-4C-04：技能扩展

**修改文件**
- `packages/content/src/skills.ts`
- `packages/core/src/skill.ts`
- `packages/core/src/__tests__/skill.test.ts`
- `packages/core/src/__tests__/skill.integration.test.ts`

**交付点**
- 15 技能 + 升级三层 + 加权 offer

---

### PR-4C-05：Synergy 引擎

**新增文件**
- `packages/core/src/synergy.ts`
- `packages/core/src/__tests__/synergy.test.ts`
- `packages/content/src/synergies.ts`
- `apps/game-client/src/ui/EncyclopediaPanel.ts`（new）

**交付点**
- 条件检测、效果应用、百科持久化

---

### PR-4C-06：Endless

**新增文件**
- `packages/core/src/endless.ts`
- `packages/core/src/__tests__/endless.test.ts`

**修改文件**
- `packages/content/src/config.ts`
- `packages/content/src/floorScaling.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**交付点**
- endless floor 生成与缩放
- 收益封顶公式生效

---

### PR-4C-07：Daily

**新增文件**
- `packages/core/src/daily.ts`
- `packages/core/src/__tests__/daily.test.ts`
- `apps/game-client/src/ui/DailyChallengePanel.ts`（new）

**交付点**
- daily seed/score/reward 幂等
- practice 模式（不计分不发奖）

---

### PR-4C-08：全量回归

**新增文件**
- `packages/core/src/__tests__/integration-phase4c.test.ts`

**交付点**
- path/challenge/skill/synergy/endless/daily 全链路回归

---

## 11. 测试矩阵

### 11.1 Core

1. 分支选择后 biome 路由一致
2. save/load 后 branch state 不丢
3. challenge success/fail/death 分支
4. synergy 激活/失活
5. endless scaling 与收益封顶
6. daily 单日幂等奖励

### 11.2 Client

1. 双楼梯 UI 提示与选择
2. challenge 计时 HUD
3. encyclopedia 已发现/未发现展示
4. daily 当日二次进入仅 practice

---

## 12. 4C 验收门禁（Gate）

- [ ] `Meta v4 -> v5` 与 `RunSave v1 -> v2` 迁移幂等通过
- [ ] F2 分支、F3/F4 差异、F5 收敛完整可玩
- [ ] Challenge room 成功/失败路径完整
- [ ] 15 技能与技能升级机制可用
- [ ] Synergy 检测准确且百科可持久化
- [ ] Endless 收益封顶有效
- [ ] Daily 单日计分与奖励幂等规则严格生效

---

## 13. 已知风险与缓解

1. **风险**：分支与无尽改动 run 生命周期，易引入状态机回归  
   **缓解**：run-state 变更集中在 `run.ts` + `save.ts`，禁止在 Scene 侧临时字段分叉。
2. **风险**：技能与协同组合过多，平衡难度上升  
   **缓解**：先通过 deterministic simulation 输出分布，再做数值微调。
3. **风险**：Daily 本地时区边界争议  
   **缓解**：统一采用浏览器本地日期并在 UI 明示“按本地日切”。
