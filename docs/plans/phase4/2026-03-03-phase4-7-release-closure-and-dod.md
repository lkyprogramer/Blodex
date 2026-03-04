# Phase 4.7 收口与发布（DoD Freeze）实施文档（PR 级）

**日期**: 2026-03-03  
**阶段**: Phase 4 / 4.7  
**目标摘要**: 对 4.0~4.6 的架构改造与体验增强进行最终收口，完成发布门禁冻结、全量回归、兼容验证、性能对比、回滚预案和 DoD 签署。

**关联文档**:
1. `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md`
2. `docs/plans/phase4/2026-03-03-phase4-6-experience-enhancement-ii-g4-g6-g7.md`
3. `docs/plans/phase4/release/2026-03-03-phase4-release-readiness.md`
4. `docs/plans/phase4/release/2026-03-03-phase4-regression-matrix.md`
5. `docs/plans/phase4/release/2026-03-03-phase4-performance-compare.md`
6. `docs/plans/phase4/release/2026-03-03-phase4-rollback-playbook.md`
7. `docs/plans/phase4/release/2026-03-03-phase4-release-notes.md`

---

## 1. 直接结论

4.7 的核心不是继续扩展功能，而是把 Phase 4 变成可发布、可回滚、可复核的稳定版本：

1. 把主计划 DoD 转成发布门禁，做到“失败即阻塞”。
2. 用统一矩阵完成自动化 + 手动 + 兼容三层回归，并留下证据。
3. 输出发布说明、性能对比、回滚手册，明确上线窗口与止损路径。
4. 对 DoD 未达标项给出明确处理：修复、延期，或有编号的临时豁免。

4.7 结束的唯一通过标准：

1. `phase4-release-readiness.md` 全部阻塞项清零。
2. `phase4-regression-matrix.md` 无 P0/P1 未关闭缺陷。
3. `phase4-performance-compare.md` 无未解释的显著性能退化。
4. `phase4-rollback-playbook.md` 完成演练并可执行。
5. DoD 清单全部签署（或附带批准过的豁免单）。

---

## 2. 输入基线（本阶段执行起点）

### 2.1 代码基线

1. 执行基线：`origin/main@fd4ea52`（2026-03-04）。
2. 当前关键体量（`wc -l` 实测）：
   - `apps/game-client/src/scenes/DungeonScene.ts`: 2581
   - `apps/game-client/src/ui/Hud.ts`: 5
   - `apps/game-client/src/ui/hud/HudContainer.ts`: 1079
   - `apps/game-client/src/scenes/MetaMenuScene.ts`: 1092
   - `packages/core/src/contracts/types.ts`: 846
3. 预算脚本现状：`check-architecture-budgets.sh` 对 `DungeonScene.ts` 上限是 2600。

### 2.2 关键一致性约束

1. DoD 与预算阈值必须一致，避免“文档通过、脚本放行更宽”导致收口失真。
2. 4.7 期间禁止新增玩法和跨模块重构，只允许发布阻塞修复。
3. 兼容风险优先级高于体验细节，先保证存档与流程稳定。
4. 每个结论必须挂载证据（命令输出、测试记录、截图或日志引用）。

### 2.3 当前已知阻塞项（进入 4.7 即必须处理）

1. `DungeonScene` DoD 目标是 `< 2500`，当前为 `2581`，属于发布阻塞项。
2. `check-architecture-budgets.sh` 仍允许 `2600`，与 DoD 不一致，必须在 4.7 收口时统一。

---

## 3. 范围与非目标

### 3.1 范围

1. 发布门禁冻结与证据模板落地。
2. 自动化门禁、手动冒烟、兼容验证执行与缺陷收口。
3. 性能对比与发布风险评估。
4. 发布说明、回滚手册、DoD 签署归档。

### 3.2 非目标

1. 不新增 G 类体验需求。
2. 不新增架构方向或大规模模块迁移。
3. 不更改已冻结的运行时边界（除阻塞发布缺陷修复）。
4. 不引入新的长期特性开关。

---

## 4. 4.7 输出物（必须产出）

### 4.1 发布文档集

1. `docs/plans/phase4/release/2026-03-03-phase4-release-readiness.md`
2. `docs/plans/phase4/release/2026-03-03-phase4-regression-matrix.md`
3. `docs/plans/phase4/release/2026-03-03-phase4-performance-compare.md`
4. `docs/plans/phase4/release/2026-03-03-phase4-rollback-playbook.md`
5. `docs/plans/phase4/release/2026-03-03-phase4-release-notes.md`

### 4.2 输出规则

1. 每份文档必须包含状态字段（`Pending/Pass/Fail/Waived`）和证据列。
2. 豁免必须包含：豁免编号、风险说明、到期版本、责任人。
3. 所有文档引用同一版本标识（commit SHA + 日期）。

---

## 5. PR 级实施计划（顺序执行）

> 固定顺序：`PR-4.7-22 -> PR-4.7-23 -> PR-4.7-24`。

### PR-4.7-22：门禁冻结与文档骨架

**目标**: 把主计划 DoD 冻结为可执行门禁，建立证据存放结构。

**关键动作**:
1. 创建 release 文档目录及 5 份模板。
2. 将 DoD 拆解为可勾验条目（命令/阈值/状态/证据）。
3. 明确 P0/P1 阻塞规则、豁免流程、签署人责任。
4. 在主计划补齐 4.7 子产物索引。

**验收标准**:
1. 任意成员能按文档独立完成一次门禁执行。
2. DoD 条目与主计划一致，无双标。
3. 阻塞与豁免规则明确且可追溯。

### PR-4.7-23：全量回归与兼容收口

**目标**: 完成自动化 + 手动 + 兼容验证，关闭发布阻塞缺陷。

**建议命令**:

```bash
pnpm quality:precheck
pnpm check:architecture-budget
pnpm ci:check
pnpm assets:validate
```

**必须覆盖场景**:
1. Normal 1->5 + Boss。
2. Endless 至少到 14 层（验证 8/11/14 规则变化）。
3. Event/Merchant 分支（含 G7 延迟收益）。
4. Save/Restore 三类快照（事件中、Boss 前、Endless 中段）。
5. i18n 中英文切换下关键反馈与新文案。

**兼容验收**:
1. 旧 Run Save fixture 可加载并继续游玩。
2. 旧 Meta fixture 可迁移并进入主流程。
3. 缺字段与脏值容错路径有记录且通过。

### PR-4.7-24：性能对比、回滚手册、发布说明

**目标**: 输出上线决策材料，完成 DoD 签署。

**关键动作**:
1. 采集性能对比（`diagnostics()` + `stressRuns(24)`，各场景至少 3 轮）。
2. 填充回滚手册（触发条件、回滚命令、演练结果）。
3. 输出 release notes（改造摘要、兼容说明、已知限制）。
4. 组织发布签署并冻结最终基线。

**验收标准**:
1. 性能结论明确，无未解释退化。
2. 回滚路径演练通过。
3. 发布说明可供研发、测试、运维共同执行。

---

## 6. 统一验证清单

### 6.1 自动化门禁

```bash
pnpm quality:precheck
pnpm check:architecture-budget
pnpm ci:check
pnpm assets:validate
```

### 6.2 手动阻塞矩阵

1. 功能链路：Normal/Boss/Endless/Event/Merchant/Challenge。
2. 兼容链路：旧 save、旧 meta、迁移后连续游玩。
3. 反馈链路：武器差异、升级反馈、Boss 预警、Endless 突变提示。
4. UI 链路：HUD、战斗日志、i18n 文案一致。

### 6.3 发布签署前核对

1. DoD 与脚本阈值一致。
2. P0/P1 缺陷全部关闭或附批准豁免。
3. 证据链接完整可复核。
4. 回滚演练记录已归档。

---

## 7. DoD 冻结表（4.7 执行口径）

| 类别 | DoD 条目 | 通过标准 | 当前状态 | 证据文档 |
|---|---|---|---|---|
| 工程 | `DungeonScene.ts < 2500` | 实测行数 < 2500 | Blocked | `release-readiness.md` |
| 工程 | `Hud.ts < 300`（容器层） | `Hud.ts` 为薄壳 | Pass | `release-readiness.md` |
| 工程 | `UI_POLISH_FLAGS` 清理 | 无业务分支依赖 | Pass | `release-readiness.md` |
| 工程 | 三系统覆盖率 > 70% | 覆盖报告达标 | Pending | `release-readiness.md` |
| 体验 | G1~G7 全量达成 | 回归矩阵通过 | Pending | `regression-matrix.md` |
| 兼容 | Save/Meta 向后兼容 | fixture 全通过 | Pending | `regression-matrix.md` |
| 可观测 | 关键事件日志完整 | 关键事件可追踪 | Pending | `regression-matrix.md` |
| 性能 | 无明显退化 | 指标对比达标 | Pending | `performance-compare.md` |

> `Blocked` 项在 4.7 未关闭前，禁止发布签署。

---

## 8. 风险与止损策略

| 风险 | 等级 | 触发信号 | 止损策略 |
|---|:---:|---|---|
| DoD 与脚本阈值不一致 | 高 | 文档要求与 CI 门禁冲突 | 先统一阈值，再做签署 |
| 兼容回归漏测 | 高 | 旧档加载失败或状态错乱 | 把 fixture 验证升级为阻塞门禁 |
| 性能退化未记录 | 中 | 长帧上升但缺证据 | 不填性能报告禁止发布 |
| Freeze 期间继续加功能 | 中 | PR 出现新玩法改动 | 退回 PR，按阻塞修复重提 |
| 回滚文档不可执行 | 中 | 演练失败 | 补齐命令与顺序后再签署 |

---

## 9. 本轮开发验证（文档层）

本轮针对 4.7 文档开发完成后，至少执行：

```bash
pnpm check:architecture-budget
./scripts/check-source-hygiene.sh
pnpm ci:check
```

本轮执行结果：

1. `pnpm check:architecture-budget`: Pass
2. `./scripts/check-source-hygiene.sh`: Pass
3. `pnpm ci:check`: Pass
4. `pnpm quality:precheck`: Pass
5. `pnpm assets:validate`: Pass

记录位置：

1. `docs/plans/phase4/release/2026-03-03-phase4-release-readiness.md` 的“自动化门禁结果”。
2. 本文第 7 章 DoD 冻结表状态列。

---

## 10. 完成定义（4.7 Exit）

1. 5 份 release 文档全部填充完成并通过评审。
2. 自动化门禁、手动矩阵、兼容验证全部通过。
3. DoD 冻结表无 `Blocked/Pending`（或有批准豁免单并记录到期版本）。
4. 发布说明与回滚手册已被研发、测试、运维共同确认。
5. 最终基线 commit 与证据文档绑定归档，可用于后续版本回归基准。
