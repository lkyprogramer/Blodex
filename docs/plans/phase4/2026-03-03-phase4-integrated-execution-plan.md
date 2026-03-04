# Phase 4 统一执行主计划（整合版）

**日期**: 2026-03-03  
**文档位置**: `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md`  
**整合来源（原始草案）**:
1. `docs/plans/phase4/2026-03-03-phase4-review-and-roadmap.md`
2. `docs/plans/phase4/2026-03-03-dungeon-deep-refactor-foundation.md`

**执行子文档索引（按顺序）**:
1. `docs/plans/phase4/2026-03-03-phase4-0-baseline-freeze-and-governance.md`
2. `docs/plans/phase4/2026-03-03-phase4-1-scene-decomposition-m1-debug-save.md`
3. `docs/plans/phase4/2026-03-03-phase4-2-scene-decomposition-m2-event-boss.md`
4. `docs/plans/phase4/2026-03-03-phase4-3-scene-decomposition-m3-hazard-progression.md`
5. `docs/plans/phase4/2026-03-03-phase4-4-engineering-convergence-e2-e3-e4.md`
6. `docs/plans/phase4/2026-03-03-phase4-5-experience-enhancement-i-g1-g2-g3-g5.md`
7. `docs/plans/phase4/2026-03-03-phase4-6-experience-enhancement-ii-g4-g6-g7.md`
8. `docs/plans/phase4/2026-03-03-phase4-7-release-closure-and-dod.md`
9. `docs/plans/phase4/release/2026-03-03-phase4-release-readiness.md`
10. `docs/plans/phase4/release/2026-03-03-phase4-regression-matrix.md`
11. `docs/plans/phase4/release/2026-03-03-phase4-performance-compare.md`
12. `docs/plans/phase4/release/2026-03-03-phase4-rollback-playbook.md`
13. `docs/plans/phase4/release/2026-03-03-phase4-release-notes.md`
14. `docs/plans/phase4/templates/phase4-pr-checklist.md`
15. `docs/plans/phase4/templates/phase4-smoke-matrix.md`
16. `docs/plans/phase4/metrics/2026-03-03-phase4-0-baseline.md`

**历史基线（4.0 冻结）**:
1. `apps/game-client/src/scenes/DungeonScene.ts`: 6301 行
2. `apps/game-client/src/ui/Hud.ts`: 963 行
3. `apps/game-client/src/scenes/MetaMenuScene.ts`: 1093 行
4. `packages/core/src/contracts/types.ts`: 818 行
5. 快照文档：`docs/plans/phase4/metrics/2026-03-03-phase4-0-baseline.md`

**当前基线（main 实测，2026-03-04 / `origin/main@fd4ea52`）**:
1. `apps/game-client/src/scenes/DungeonScene.ts`: 2581 行
2. `apps/game-client/src/ui/Hud.ts`: 5 行
3. `apps/game-client/src/ui/hud/HudContainer.ts`: 1079 行
4. `apps/game-client/src/scenes/MetaMenuScene.ts`: 1092 行
5. `packages/core/src/contracts/types.ts`: 846 行
6. 预算快照：`DungeonScene 2581/2600 (73 methods)`，`MetaMenuScene 1092/1200 (40 methods)`，`Hud 5/300`，`HudContainer 1079/1100`

---

## 1. 直接结论

本阶段不再采用“局部瘦身 + 继续堆功能”的策略，而采用一条可执行主线：

1. 先完成 `DungeonScene` 的结构性迁移，建立可持续架构地基。
2. 再在稳定结构上推进体验深化（G1~G7），避免功能开发回流成新一轮 God Class。
3. 全程使用预算门禁、迁移测试、PR 验收矩阵约束质量，确保改造可持续而非一次性。

---

## 2. 范围与硬约束

### 2.1 范围

1. 客户端主战斗场景重构：`apps/game-client/src/scenes/DungeonScene.ts` 与 `scenes/dungeon/*`
2. 相关 UI 与系统重构：`Hud.ts`、`UIManager`、`systems/*`
3. 核心体验增强：Biome、武器反馈、升级反馈、Boss 预警、Endless、随机事件
4. 兼容性保障：`packages/core` 存档与迁移

### 2.2 硬约束（必须遵守）

1. 迁移期间禁止向 `DungeonScene` 新增业务逻辑（只允许迁出或薄封装）。
2. 模块之间禁止互相直接依赖实现细节，必须通过 orchestrator 或 ports 协作。
3. 每个 PR 必须可回归，可独立验证，不允许“大爆炸式”一次改完。
4. 每个阶段结束必须收紧预算阈值，防止技术债“永久白名单化”。
5. `MetaProgression` 如发生 schema 演进，必须提供向后兼容加载与测试。
6. 中英文文案同步更新，不允许单语变更落地。

### 2.3 决策冻结（本轮核实补充）

1. `CombatRuntimeModule` 不单列落地；战斗职责由 `CombatSystem + EncounterController` 承担，避免重复抽象。
2. G6（Endless Mutator）状态落点：运行态放在 `RunState`（随单局保存恢复），不放 `MetaProgression`。
3. G7（延迟收益）持久化采用 `RunSaveDataV2` 可选字段，缺省值为空数组，保证旧档可加载。
4. 4.2~4.7 每阶段开始前必须刷新“当前 main 实测值”，禁止继续复用 4.0 的 6301 静态值。

---

## 3. 现状校准（作为执行起点）

### 3.1 工程结构

| 项 | 现状 | 结论 |
|---|---|---|
| DungeonScene 体量 | 2581 行，73 methods | 已大幅收敛，仍高于 DoD `<2500`，4.7 需收口 |
| Feature Flag | `UI_POLISH_FLAGS` 无检索命中 | 业务分支已清理，可删除残留定义 |
| 架构门禁 | `check:architecture-budget` 已接入 `ci:check` | 门禁生效，但需把 `DungeonScene` 阈值从 2600 收紧到 2500 |
| HUD | `Hud.ts` 5 行，`HudContainer.ts` 1079 行 | 容器化已完成，后续按需继续细分容器职责 |
| 系统测试 | AISystem/MovementSystem/MonsterSpawnSystem 均有测试文件 | 需在 4.7 通过覆盖率报告确认 `>70%` |

### 3.2 体验机制

| 项 | 当前状态 | 改造方向 |
|---|---|---|
| Biome 视觉 | 6 种配置但地砖表现同质 | 接入差异贴图/色调 |
| 武器差异 | 机制可运行但“手感差异”弱 | 增强可见反馈或补 projectile 路线 |
| 升级反馈 | 日志为主，无强视觉音效 | 增加 `playLevelUp` + 音效 |
| Boss 预警 | 通用 telegraph 在，Boss 技能未接入 | 为 `bone_spikes/heavy_strike` 加预警 |
| Endless | 数值缩放 + affix 加码，缺规则突变 | 追加 mutator 层 |
| 随机事件 | 已有基础风险收益，后期策略分化不足 | 增加条件/延迟收益分支 |

---

## 4. 目标架构（Phase 4 结束态）

### 4.1 分层模型

| 层级 | 职责 | 约束 |
|---|---|---|
| Scene Shell | Phaser 生命周期、模块装配 | 不承载具体业务规则 |
| Orchestrator | 帧流程编排、调用顺序 | 不做领域状态计算 |
| Domain Runtime Modules | Combat/Boss/Event/Hazard/Progression/Save/Debug | 模块可独立测试 |
| Presentation Adapter | HUD/UI/日志映射/本地化 | 不反向侵入领域规则 |

### 4.2 目标模块清单

1. `CombatSystem + EncounterController`（承载 combat runtime，不单列 `CombatRuntimeModule`）
2. `DebugRuntimeModule`
3. `RunPersistenceModule`
4. `EventRuntimeModule`
5. `BossRuntimeModule`
6. `HazardRuntimeModule`
7. `ProgressionRuntimeModule`
8. `HudCompositionModule`（或等价 UI 分层）

### 4.3 统一模块接口

```ts
export interface DungeonRuntimeModule {
  onCreate?(): void;
  onFrame?(nowMs: number, deltaMs: number): void;
  onShutdown?(): void;
}
```

---

## 5. 顺序执行总览（唯一主线）

> 说明：本计划按“严格顺序”组织。每一阶段完成并通过出口门禁后，才能进入下一阶段。

| 阶段 | 主题 | 对应任务 | 目标结果 |
|---|---|---|---|
| 4.0 | 基线冻结与规范收敛 | E1(预备)、治理 | 建立唯一执行文档、门禁生效 |
| 4.1 | Scene 深拆 M1 | E1 | 抽离 Debug/Save，Scene < 5200 |
| 4.2 | Scene 深拆 M2 | E1 | 抽离 Event/Boss，Scene < 4200 |
| 4.3 | Scene 深拆 M3 | E1 | 抽离 Hazard/Progression，Scene < 3000 |
| 4.4 | 工程收敛 | E2/E3/E4 | 清理 flag、HUD 拆分、补系统测试 |
| 4.5 | 体验增强 I | G1/G2/G3/G5 | 中前期战斗与成长反馈完成 |
| 4.6 | 体验增强 II | G4/G6/G7 | Boss 深化 + Endless + 事件深化 |
| 4.7 | 收口与发布 | DoD 全量 | 达成最终指标并冻结基线 |

---

## 6. 分阶段详细执行计划

### 6.0 Phase 4.0（基线冻结与规范收敛）

**目标**: 建立统一执行基线，避免后续分叉。

**开发项**:
1. 本整合文档作为唯一执行基线。
2. 在旧文档增加“已整合到主计划”的提示。
3. 确认 `check:architecture-budget` 在 `ci:check` 链路内。
4. 固化 PR 验收模板与回归清单。

**产出物**:
1. 主计划文档（本文件）。
2. 架构预算脚本与 CI 配置。

**出口门禁**:
1. `pnpm check:architecture-budget` 通过。
2. 团队按本文件执行，不再新增平行路线图。

### 6.1 Phase 4.1（Scene 深拆 M1：Debug + Save）

**目标**: 从 Scene 迁出低耦合高收益区域，建立迁移节奏。

**开发项**:
1. 抽离 Debug 相关逻辑为 `DebugRuntimeModule`。
2. 抽离保存相关逻辑为 `RunPersistenceModule`，统一快照构建/调度/恢复端口。
3. Scene 仅保留模块调用入口与必要薄封装。
4. 补齐模块级单测（至少覆盖失败路径与边界输入）。

**建议 PR 顺序**:
1. PR-01: Debug API/热键/命令拆出。
2. PR-02: 保存快照构建器拆出。
3. PR-03: 保存调度与恢复拆出。

**出口门禁**:
1. `DungeonScene.ts` <= 5200 行。
2. Debug/Save 相关逻辑不再直接堆积在 Scene。
3. `pnpm ci:check` 通过。
4. 手动验证：开局 -> 存档 -> 刷新 -> 读档恢复一致。

### 6.2 Phase 4.2（Scene 深拆 M2：Event + Boss）

**目标**: 迁出最复杂流程块，显著降低 Scene 认知负担。

**开发项**:
1. 抽离随机事件流程（event node、choice、merchant）为 `EventRuntimeModule`。
2. 抽离 Boss 流程（phase、attack、summon、telegraph hook）为 `BossRuntimeModule`。
3. 保证事件日志与反馈事件对齐。

**建议 PR 顺序**:
1. PR-04: Event node 生命周期 + 面板交互迁移。
2. PR-05: Merchant 分支迁移。
3. PR-06: Boss combat/phase/summon 迁移。

**出口门禁**:
1. `DungeonScene.ts` <= 4200 行。
2. 事件与 Boss 代码在模块内具备可测试入口。
3. 手动验证：至少触发 2 个随机事件 + 1 次商人 + 1 场 Boss。

### 6.3 Phase 4.3（Scene 深拆 M3：Hazard + Progression）

**目标**: 收敛主循环，完成 Scene 架构重心转移。

**开发项**:
1. 抽离 Hazard 相关更新、伤害、视觉同步为 `HazardRuntimeModule`。
2. 抽离楼层推进、挑战房、成长推进为 `ProgressionRuntimeModule`。
3. 形成统一 frame pipeline（Input -> Simulation -> Feedback -> UI）。

**建议 PR 顺序**:
1. PR-07: Hazard 迁移。
2. PR-08: Floor/Challenge/Progression 迁移。
3. PR-09: Frame pipeline 收敛与 orchestrator 清理。

**出口门禁**:
1. `DungeonScene.ts` <= 3000 行。
2. 帧循环职责可读且稳定。
3. Normal 1->5 层 + Boss 冒烟通过。

### 6.4 Phase 4.4（工程收敛：E2 + E3 + E4）

**目标**: 清理技术债并补全重构安全网。

**开发项**:
1. 清理 `UI_POLISH_FLAGS` 相关死分支与配置。
2. `Hud.ts` 拆分为面板组件，容器化编排。
3. 补齐 `AISystem` / `MovementSystem` / `MonsterSpawnSystem` 单测。
4. 清理 Scene 迁移期残留壳层（临时适配器、重复日志映射、过时委托）。
5. 收紧预算阈值（包括白名单项）。

**建议 PR 顺序**:
1. PR-10: Flag 清理。
2. PR-11: HUD 面板拆分（结构）。
3. PR-12: HUD 增量渲染（性能）。
4. PR-13: 三大系统测试补齐 + Scene 壳层收敛。

**出口门禁**:
1. `DungeonScene.ts` <= 2500 行。
2. `Hud.ts` <= 300 行（容器层）。
3. `uiFlags.ts` 无业务引用（可删除或仅保留空壳过渡）。
4. 三个系统分支覆盖率 >= 70%。

**行数收敛说明**:
1. `4.3 -> 4.4` 的 Scene 降行不依赖 HUD 拆分单点；主要来自 flag 死分支清理 + 迁移期壳层删除 + 调用链收敛。

### 6.5 Phase 4.5（体验增强 I：G1 + G2 + G3 + G5）

**目标**: 完成核心战斗反馈闭环。

**开发项**:
1. G1: Biome 差异化视觉。
2. G2: 武器“可见差异”增强（反馈或 projectile 路线二选一并定稿）。
3. G3: 升级视觉 + 音效反馈。
4. G5: 装备对比可读性增强（箭头 + HUD 属性高亮）。

**建议 PR 顺序**:
1. PR-14: Biome 视觉。
2. PR-15: 武器反馈。
3. PR-16: 升级反馈。
4. PR-17: 装备对比增强。

**出口门禁**:
1. 6 种 Biome 可肉眼区分。
2. 6 种武器均有至少 1 个可见差异点。
3. 升级触发 VFX/SFX 同步。
4. Tooltip 对比和 HUD 高亮符合预期。

### 6.6 Phase 4.6（体验增强 II：G4 + G6 + G7）

**目标**: 强化后期玩法深度与重玩价值。

**开发项**:
1. G4: Boss 技能 telegraph 化并校准难度。
2. G6: Endless 规则级突变（在现有缩放/affix 基础上叠加）。
3. G7: 事件与商人策略深化（条件化/延迟收益 + 难度维度）。
4. 如新增 Meta 字段，补齐迁移逻辑与测试。
5. G6 持久化决策：`mutatorActiveIds/mutatorState` 写入 `RunState`（随 run 保存），不写入 `MetaProgression`。
6. G7 延迟收益字段：在 `RunSaveDataV2` 增加可选 `deferredOutcomes[]`（含 `outcomeId/source/trigger/reward/status`），默认 `[]`。

**建议 PR 顺序**:
1. PR-18: Boss telegraph。
2. PR-19: Endless mutator 核心。
3. PR-20: Event/Merchant 深化。
4. PR-21: Meta 迁移与兼容测试收口。

**出口门禁**:
1. Boss 技能可预判且可规避。
2. Endless 第 8/11/14 层有可观察突变叠加。
3. 事件至少 3 个新增非同质分支。
4. 老存档加载回归通过。
5. save->restore 后 `deferredOutcomes[]` 不丢失且不重复结算。

### 6.7 Phase 4.7（收口与发布）

**目标**: 形成可长期维护的稳定基线。

**开发项**:
1. 预算白名单继续收紧，明确下阶段清零计划。
2. 全量回归、性能对比、风险复盘。
3. 发布说明与后续路线维护。

**出口门禁**:
1. 本文第 9 章 DoD 全部打勾。
2. CI、冒烟、迁移、可观测指标全部达标。

---

## 7. PR 模板与验收矩阵（统一标准）

### 7.1 每个 PR 必填信息

1. 本 PR 属于哪个阶段、对应哪个任务编号。
2. 迁移前后的职责边界变化。
3. 回归影响面与风险点。
4. 自动化与手动验证结果。

### 7.2 每个 PR 必做验证

```bash
pnpm --filter @blodex/game-client typecheck
pnpm --filter @blodex/core test
pnpm --filter @blodex/game-client test
pnpm check:architecture-budget
```

如涉及全局链路或发布门禁，补跑：

```bash
pnpm ci:check
```

### 7.3 手动冒烟最小矩阵

1. Normal 模式：第 1 层 -> 第 5 层 -> Boss。
2. Endless 模式：至少推进到第 8 层。
3. 随机事件、商人、挑战房、Boss 技能各触发一次。
4. 存档：保存 -> 刷新 -> 恢复一致。

---

## 8. 风险与止损策略

| 风险 | 等级 | 触发信号 | 止损策略 |
|---|:---:|---|---|
| 大拆分引入行为回归 | 高 | 冒烟失败/日志异常 | 回滚至上一个 PR 边界，缩小迁移粒度 |
| 存档不兼容 | 高 | 老存档加载失败 | 先补迁移器和 fixture，再继续功能开发 |
| Boss 预警后难度塌陷 | 中 | 通关率异常升高 | 微调伤害/冷却并复测 |
| Endless 突变过度惩罚 | 中 | 玩家中途退出率升高 | 引入对策型收益或降低叠加斜率 |
| HUD 拆分性能退化 | 中 | 长帧比例上升 | 回退全量重绘点，改局部更新 |

---

## 9. 最终 DoD（本主计划验收标准）

### 9.1 工程

1. `DungeonScene.ts` < 2500 行。
2. `Hud.ts` < 300 行（容器层）。
3. `UI_POLISH_FLAGS` 业务分支清理完成。
4. `AISystem` / `MovementSystem` / `MonsterSpawnSystem` 覆盖率 > 70%。
5. `pnpm ci:check` 通过。

### 9.2 体验

1. 6 种 Biome 视觉可区分。
2. 6 种武器均有可感知差异。
3. 升级具备 VFX + SFX 强反馈。
4. Boss 核心技能具备可规避预警。
5. 装备对比支持方向强化展示。
6. Endless 引入规则级突变并可观测。
7. 至少 3 个事件获得新增策略分支。

### 9.3 兼容与可观测

1. Meta 存档向后兼容（含历史 fixture）。
2. 中英文内容同步更新。
3. 关键事件日志完整（`player:levelup`、`boss:*`、`merchant:*`、`event:*`）。
4. 重构前后性能指标可对比且无明显退化。

---

## 10. 后续维护规则

1. 新功能默认进入对应 Runtime Module，不得回流 `DungeonScene`。
2. 新增超大文件前必须先声明预算例外并给出回收期限。
3. 每个迭代结束回顾一次预算白名单，持续收紧。
4. 本文作为 Phase 4 唯一执行计划，后续变更统一在本文增量修订。
