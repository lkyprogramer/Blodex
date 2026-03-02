# Phase 4A — 存档系统 + 天赋树（PR 级实施规范）

**优先级**: P0（Save）+ P1（Talent）  
**目标**: 在浏览器中断场景下实现可恢复同态运行，并将平铺升级树迁移为可扩展的天赋系统。  
**前置条件**: Phase 1（多层、技能、meta v2）已稳定。

---

## 1. 范围与非目标

### 1.1 范围

1. `RunSave v1`：支持中途保存、继续、放弃
2. `Meta v2 -> v3`：引入天赋树并保留兼容字段
3. 天赋树（27 节点）+ 经济重平衡
4. Resume/Abandon 全链路（含 crash-safe 清理）

### 1.2 非目标

1. 不引入 Blueprint/Mutation 实际玩法（仅保留前向兼容字段）
2. 不改动 4C 分支楼梯结构（仍单楼梯）
3. 不做云存档（仅 localStorage）

---

## 2. 不可协商约束

1. **恢复同态**：恢复后下一帧逻辑结果应与中断前一致。
2. **迁移幂等**：v2->v3 多次执行不重复退款、不重复加点。
3. **奖励反刷**：Abandon 不得额外发奖，且结算事务需幂等。
4. **写入顺序**：`meta commit` 成功后才能 `delete save`。
5. **多标签安全**：同一份 run-save 仅允许单标签持有执行权。

---

## 3. 数据契约（先改 types）

### 3.1 RunSave v1 契约

```typescript
// localStorage key: blodex_run_save_v1
interface RunSaveDataV1 {
  schemaVersion: 1;
  savedAtMs: number;
  appVersion: string;

  // Stable identity
  runId: string; // `${runSeed}:${startedAtMs}`
  runSeed: string;

  // Domain state
  run: RunState;
  player: PlayerState;
  consumables: ConsumableState;
  dungeon: DungeonLayout;
  staircase: StaircaseState;
  hazards: HazardRuntimeState[];
  boss: BossRuntimeState | null;

  // Runtime snapshots required for resume parity
  monsters: RuntimeMonsterState[];
  lootOnGround: Array<{ item: ItemInstance; position: { x: number; y: number } }>;
  eventNode: RuntimeEventNodeState | null;
  minimap: MinimapSnapshot;
  mapRevealActive: boolean;

  // RNG replay cursors (draw counts per stream)
  rngCursor: Record<RunRngStreamName, number>;

  // Forward-compat placeholders (4B+)
  blueprintFoundIdsInRun?: string[];
  selectedMutationIds?: string[];

  // Lease lock for multi-tab
  lease?: SaveLease;
}

interface RuntimeMonsterState {
  state: MonsterState;
  nextAttackAt: number;
  nextSupportAt: number;
}

interface RuntimeEventNodeState {
  eventId: string;
  position: { x: number; y: number };
  resolved: boolean;
  merchantOffers?: MerchantOffer[];
}

interface MinimapSnapshot {
  layoutHash: string;
  exploredKeys: number[];
}

interface SaveLease {
  tabId: string;
  leaseUntilMs: number;
  renewedAtMs: number;
}
```

说明：
- `rngCursor` 必须落盘，否则 resume 后随机消费顺序会漂移；
- `monsters.nextAttackAt/nextSupportAt` 必须落盘，否则 AI 行为改变；
- `minimap.exploredKeys` 必须落盘，否则雾区恢复不一致。
- 读取历史草案字段 `blueprintsFoundThisRun` / `selectedMutations` 时，需在 `deserializeRunSave` 阶段归一化为 `blueprintFoundIdsInRun` / `selectedMutationIds`，并且不再向新存档写回旧字段。

### 3.2 Meta v3 契约

```typescript
interface MetaProgressionV3 {
  runsPlayed: number;
  bestFloor: number;
  bestTimeMs: number;
  soulShards: number;
  unlocks: string[];
  cumulativeUnlockProgress: number;
  schemaVersion: 3;

  selectedDifficulty: DifficultyMode;
  difficultyCompletions: Record<DifficultyMode, number>;

  // New
  talentPoints: Record<string, number>; // talentId -> rank
  totalShardsSpent: number;

  // Transitional compatibility (read/write maintained in 4A)
  permanentUpgrades: PermanentUpgrade;
}
```

---

## 4. Save/Resume 运行语义

### 4.1 保存触发点

| 触发器 | 规则 |
|--------|------|
| `floor:enter` | 新楼层初始化完成后立即保存 |
| 事件结算 | `event:choice` 应用完奖励/风险后保存 |
| 商店购买 | `merchant:purchase` 成功后保存 |
| 周期自动保存 | 每 60s（仅 run 未结束且面板未阻塞） |
| 页面隐藏 | `visibilitychange -> hidden` 触发即时保存 |
| 页面关闭 | `beforeunload/pagehide` 尽力保存（best effort） |

### 4.2 保存策略

1. 单次保存原子流程：
   1. 组装 snapshot
   2. `validateSave(snapshot)`
   3. `JSON.stringify`
   4. `localStorage.setItem`
2. 同帧并发触发合并：300ms debounce
3. 保存失败（配额/序列化失败）仅告警，不中断运行

### 4.3 多标签锁（lease）

- `lease` TTL = 15s，心跳续约间隔 = 5s
- 标签 A 持有 lease 时，标签 B 只能显示只读提示，不可 Continue
- lease 过期后可抢占

### 4.4 恢复流程

```text
MetaMenuScene boot
  -> detect run-save
  -> validate + lease check
  -> [Continue Run] or [Abandon Run]

Continue Run
  -> acquire lease
  -> bootstrap DungeonScene from snapshot
  -> restore runtime timers/RNG cursor/minimap/event node
  -> mark save as in-use (not delete)
```

**关键修正**：Continue 时不立即删档。只有 run 完整结算写入 meta 后才删档。

### 4.5 Abandon 语义（反刷）

Abandon 等价于“主动结束本次 run（失败分支）”：

1. 走 `finishRun(false)` 同一结算管道
2. 不追加任何额外奖励
3. 奖励仅按失败保留规则结算一次
4. 事务幂等键：`runId`，防止重复结算

---

## 5. 天赋系统设计（开发口径）

### 5.1 效果类型（去字符串化）

```typescript
type TalentEffect =
  | { type: "base_stat_flat"; stat: "strength" | "dexterity" | "vitality" | "intelligence"; value: number }
  | { type: "derived_stat_flat"; stat: "maxHealth" | "maxMana" | "armor" | "attackPower"; value: number }
  | { type: "derived_stat_percent"; stat: "attackPower" | "attackSpeed" | "moveSpeed" | "critChance"; value: number }
  | { type: "economy"; key: "deathRetention" | "merchantDiscount"; value: number }
  | { type: "capacity"; key: "skillSlots" | "potionCharges"; value: number }
  | { type: "trigger"; key: "lethalGuard" | "phaseDodge" | "manaShield"; value: number };

interface TalentNodeDef {
  id: string;
  path: "core" | "warrior" | "ranger" | "arcanist" | "utility";
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  cost: number;
  maxRank: number;
  prerequisites: TalentPrerequisite[];
  effects: TalentEffect[];
  uiPosition: { x: number; y: number };
}

interface TalentPrerequisite {
  talentId: string;
  minRank: number;
}
```

### 5.2 经济口径（修正后）

原文算术错误已修正：

- Core：`24 + 24 + 20 = 68`
- Warrior：`306`
- Ranger：`306`
- Arcanist：`306`
- Utility：`225`

**总计**：`68 + 306 + 306 + 306 + 225 = 1211` soul shards

### 5.3 与 legacy `permanentUpgrades` 的兼容

4A 仍保留 `permanentUpgrades`，由 `talentPoints` 派生写回：

```typescript
function derivePermanentUpgradesFromTalents(talentPoints: Record<string, number>): PermanentUpgrade;
```

原因：
- 当前 `DungeonScene`、`deriveStats`、`createInitialConsumableState` 都依赖该结构；
- 先兼容再清理，避免在 4A 触发跨阶段大回归。

---

## 6. 迁移方案（v2 -> v3）

### 6.1 迁移输入

- 旧字段：`permanentUpgrades`
- 新字段：`talentPoints`、`totalShardsSpent`

### 6.2 迁移规则

1. 将旧升级映射到等价天赋 rank
2. 计算映射后的理论花费 `spentByMigration`
3. `totalShardsSpent += spentByMigration`
4. `schemaVersion = 3`
5. 写回派生后的 `permanentUpgrades`

### 6.3 幂等保证

- 当检测到 `schemaVersion >= 3` 直接返回
- 迁移不依赖 wall-clock
- 不做余额自动补偿（避免重复补偿风险）

---

## 7. PR 拆分（可直接执行）

### PR-4A-01：types + migration + tests

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/meta.ts`
- `packages/core/src/__tests__/meta.test.ts`
- `packages/core/src/__tests__/meta.integration.test.ts`

**交付点**
- `MetaProgression` 升级到 v3
- `migrateMeta` 幂等
- `derivePermanentUpgradesFromTalents` 完成

---

### PR-4A-02：save core 契约与序列化

**新增文件**
- `packages/core/src/save.ts`
- `packages/core/src/__tests__/save.test.ts`

**修改文件**
- `packages/core/src/index.ts`

**交付点**
- `serializeRunState` / `deserializeRunState`
- `validateSave`（严格字段校验）
- 旧草案字段归一化（`blueprintsFoundThisRun` -> `blueprintFoundIdsInRun`、`selectedMutations` -> `selectedMutationIds`）
- 兼容未知字段透传（forward compatibility）

---

### PR-4A-03：客户端 SaveManager + lease

**新增文件**
- `apps/game-client/src/systems/SaveManager.ts`
- `apps/game-client/src/systems/__tests__/saveManager.test.ts`

**修改文件**
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`

**交付点**
- 自动保存触发器接入
- `visibilitychange/pagehide/beforeunload` 接入
- 多标签 lease 机制接入

---

### PR-4A-04：Resume/Abandon 流程

**修改文件**
- `apps/game-client/src/scenes/MetaMenuScene.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/ui/Hud.ts`

**交付点**
- 主菜单展示 Continue/Abandon
- Continue 从 snapshot 完整恢复
- Abandon 走失败结算，不额外奖励

---

### PR-4A-05：Talent domain + UI

**新增文件**
- `packages/core/src/talent.ts`
- `packages/core/src/__tests__/talent.test.ts`
- `packages/content/src/talents.ts`
- `apps/game-client/src/ui/TalentTreePanel.ts`

**修改文件**
- `packages/content/src/index.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`
- `packages/core/src/stats.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**交付点**
- 天赋购买判定与 rank 更新
- 天赋效果写入 player 初始化与运行时属性
- UI 可购买/不可购买状态与提示完整

---

### PR-4A-06：集成与门禁

**新增文件**
- `packages/core/src/__tests__/integration-save-resume.test.ts`
- `apps/game-client/src/ui/__tests__/talent-tree-panel.test.ts`

**交付点**
- resume parity 测试
- migration fixture 测试
- 天赋与 save 共存测试

---

## 8. 测试矩阵（最小集合）

### 8.1 Core

1. save round-trip：`state -> save -> load -> assert deepEqual`
2. save corruption：缺字段/错类型/坏 JSON
3. rng cursor recovery：恢复后下一次掉落/事件一致
4. meta v2->v3 迁移幂等
5. talent prerequisite/cost/rank 边界

### 8.2 Client

1. `visibilitychange` 触发保存
2. Continue 恢复后 monster attack timer 连续
3. Continue 恢复后 minimap explored 保持
4. 双标签 lease 抢占/续约行为
5. Abandon 不重复发奖

---

## 9. 4A 验收门禁（Gate）

- [ ] 中途关闭页面后可继续，且恢复前后行为同态
- [ ] Continue 不提前删档；run 结算成功后才删档
- [ ] Abandon 不可刷奖励，且只结算一次
- [ ] `Meta v2 -> v3` 迁移幂等通过
- [ ] 27 节点天赋可购买、效果生效、UI 可交互
- [ ] soul shard 经济口径与文档一致（总投资 1211）

---

## 10. 风险与回滚策略

1. **风险**：save 数据膨胀导致 localStorage 超限  
   **缓解**：压缩可选字段（replay 输入不入 save）、限制 snapshot 频率。
2. **风险**：迁移错误导致历史档损坏  
   **缓解**：保留 `blodex_meta_v2_backup` 一次性备份并提供降级读取。
3. **风险**：Resume 与新功能并行导致回归面过大  
   **缓解**：4A gate 通过前冻结 4B 功能分支合入。
