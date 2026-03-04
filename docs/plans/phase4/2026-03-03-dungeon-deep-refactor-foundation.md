# DungeonScene 深度重构地基方案

> 状态：已整合到统一主计划。请优先使用  
> `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md`

**日期**: 2026-03-03  
**适用范围**: `apps/game-client/src/scenes/DungeonScene.ts` 及 `scenes/dungeon/*` 子模块  
**目标**: 彻底消除 God Class 模式，形成可持续演进的场景架构

---

## 1. 直接结论

可以做，而且应当做成“架构迁移工程”，而不是“单次文件瘦身”。  
本次建议采用 **Shell + Module** 的分层方式：

1. `DungeonScene` 只保留 Phaser 生命周期和模块装配。
2. 游戏运行逻辑按领域拆为可独立演化模块（Combat/Boss/Event/Hazard/Save/UI/Debug）。
3. 通过 CI 结构预算硬约束，防止未来再次出现超级大类。

---

## 2. 当前症结

`DungeonScene` 当前同时承担以下职责：

1. 运行时编排（帧循环、子系统调度）
2. 领域流程（战斗、Boss、事件、挑战房、危害区）
3. 持久化（快照构建、写入调度、恢复）
4. UI 触发与日志语义映射
5. Debug API + 快捷键工具

这些职责有大量时序耦合，导致任何需求都倾向回流到同一个类。

---

## 3. 目标架构

### 3.1 分层

1. **Scene Shell 层**（`DungeonScene`）
   - Phaser 生命周期 (`preload/create/update/shutdown`)
   - 模块组装与依赖注入
   - 不承载具体业务规则

2. **Application Orchestrator 层**
   - `RunFlowOrchestrator`
   - `EncounterController`
   - `WorldEventController`
   - 只做流程编排，不做状态规则判断

3. **Domain Runtime Modules 层**
   - `CombatSystem + EncounterController`（战斗运行态，不单列 `CombatRuntimeModule`）
   - `BossRuntimeModule`
   - `EventRuntimeModule`
   - `HazardRuntimeModule`
   - `ProgressionRuntimeModule`
   - `RunPersistenceModule`
   - `DebugRuntimeModule`

4. **Presentation Adapter 层**
   - `HudPresenter` / `UIManager`
   - 文案、标签、反馈映射器（例如 `labelResolvers.ts`）

### 3.2 模块接口约束

每个 Runtime Module 必须使用统一接口：

```ts
export interface DungeonRuntimeModule {
  onCreate?(): void;
  onFrame?(nowMs: number, deltaMs: number): void;
  onShutdown?(): void;
}
```

模块之间禁止直接互调内部实现，统一通过 `ports` 或 orchestrator 回调协作。

---

## 4. 结构预算与防回退

已新增 CI 检查：`scripts/check-architecture-budgets.sh`

1. 默认预算：
   - 单 class 文件行数 <= 900
   - 单 class 方法数 <= 60
2. 临时白名单（技术债）：
   - `DungeonScene.ts`
   - `MetaMenuScene.ts`
   - `Hud.ts`
3. 要求：每个里程碑都要收紧白名单预算，直到清零。

---

## 5. 迁移里程碑（建议）

### M0（已开始）

1. 引入结构预算 CI 门禁
2. 提取纯映射/标签逻辑为独立模块（低风险）

### M1（高收益低风险）

1. 抽离 `DebugRuntimeModule`（debug 命令、热键、console API）
2. 抽离 `RunPersistenceModule`（快照/调度/恢复）
3. `DungeonScene` 目标降到 <= 5200 行

### M2（核心领域拆分）

1. 抽离 `EventRuntimeModule`（事件节点、choice 结算、商人流程）
2. 抽离 `BossRuntimeModule`（phase、attack、summon、telegraph）
3. `DungeonScene` 目标降到 <= 4200 行

### M3（循环治理）

1. 抽离 `HazardRuntimeModule` 与 `ProgressionRuntimeModule`
2. 收敛帧循环为明确 pipeline（输入 -> 规则 -> 反馈 -> UI）
3. `DungeonScene` 目标降到 <= 3000 行

### M4（收口）

1. 清空白名单或将白名单仅保留历史兼容窗口
2. 固化模块模板，作为后续新玩法的准入标准
3. `DungeonScene` 目标降到 <= 2500 行（与主计划 DoD 对齐）

---

## 6. 验证与回归策略

### 6.1 自动化

1. `pnpm ci:check` 全量通过
2. 新增或更新模块级单测（至少覆盖输入输出和边界条件）
3. 保存恢复回归：历史存档样本加载对比

### 6.2 手动冒烟

1. Normal 1 层 -> 5 层 -> Boss 完整流程
2. Endless 至少到 8 层
3. 事件、商人、挑战房、Boss 技能各触发一次

### 6.3 可观测性

1. 关键事件日志完整（`boss:*`, `event:*`, `merchant:*`, `player:levelup`）
2. 帧率与长帧比例在重构前后可对比

---

## 7. 实施原则

1. 每个 PR 只做一个模块或一个边界收敛点。
2. 每次抽离都先建 `ports`，再搬逻辑，最后删旧路径。
3. 禁止在迁移期间继续向 `DungeonScene` 添加新业务逻辑。
4. 新玩法必须落在对应 Runtime Module，不允许“临时塞回 Scene”。
