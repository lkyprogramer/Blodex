# Phase 5.0 基线冻结与可观测治理实施文档（PR 级）

**日期**: 2026-03-04  
**阶段**: Phase 5 / 5.0  
**目标摘要**: 在进入 5.1~5.7 前，先冻结统一基线、补齐 coverage 门禁与运行时可观测指标，确保后续深层重构可量化、可回归、可止损。

**关联文档**:
1. `docs/plans/phase5/2026-03-04-phase5-deep-review-and-roadmap.md`
2. `docs/plans/phase5/roadmap.md`
3. `docs/plans/phase4/2026-03-03-phase4-0-baseline-freeze-and-governance.md`
4. `docs/plans/phase4/templates/phase4-pr-checklist.md`

---

## 1. 直接结论

5.0 不做玩法改动，先完成三件基础治理工作：

1. 基线冻结：统一记录当前代码体量、预算、关键风险点，作为 5.1 之后所有阶段的对比起点。
2. 质量门禁：把 `@blodex/game-client` 的覆盖率检查接入脚本与 CI，避免“有测试文件但无质量门槛”。
3. 运行可观测：补齐路径失败率、输入到首次位移延迟等指标采样，降低体验问题定位成本。

5.0 完成后的硬结果：

1. Phase 5 有唯一可复核的 baseline 文档与模板。
2. 覆盖率命令可执行，且在 `ci:check` 或等价门禁中生效。
3. 运行时可导出关键移动体验指标，不再只靠主观体感判断。

---

## 2. 设计约束（5.0 必须遵守）

### 2.1 行为等价约束

1. 5.0 仅做文档、脚本、观测补点，不改变战斗/移动/生成规则语义。
2. 任何采样逻辑必须“只读”，禁止影响决策分支。

### 2.2 门禁一致性约束

1. 文档阈值、脚本阈值、CI 阈值必须一致，禁止出现双标。
2. 临时白名单必须可审计，后续阶段可收紧。

### 2.3 执行边界约束

1. 不提前引入 5.1 的大规模重构。
2. 不在本阶段扩展存档 schema。

---

## 3. 现状基线（5.0 输入）

### 3.1 体量快照（2026-03-04 实测）

| 文件 | 当前行数 | 当前预算 |
|---|---:|---:|
| `apps/game-client/src/scenes/DungeonScene.ts` | 2581 | 2600 |
| `apps/game-client/src/scenes/MetaMenuScene.ts` | 1092 | 1200 |
| `apps/game-client/src/ui/hud/HudContainer.ts` | 1079 | 1100 |
| `apps/game-client/src/ui/Hud.ts` | 5 | 300 |

说明：`DungeonScene/MetaMenuScene/HudContainer` 都接近预算上沿，属于结构性风险区。

### 3.2 门禁现状

1. `pnpm check:architecture-budget` 已可运行并通过。
2. `pnpm ci:check` 已包含架构预算检查。
3. `@blodex/game-client` 当前缺少覆盖率脚本与阈值门禁。

### 3.3 关键债务现状

1. `apps/game-client/src/scenes/dungeon` 下仍有 `Record<string, any>` 用法 18 处。
2. 路径失败日志存在，但缺少聚合计数与趋势指标。
3. 输入延迟缺乏统一采样口径（`click/keydown -> first move`）。

---

## 4. 范围与非目标

### 4.1 范围

1. Phase 5 baseline 文档与模板（PR checklist / smoke matrix）。
2. `game-client` 覆盖率脚本、阈值、CI 接入。
3. 诊断指标补点（移动可达性和输入响应）。

### 4.2 非目标

1. 不改玩法机制与数值平衡。
2. 不改场景拆分和模块职责（留给 5.1）。
3. 不新增视觉和音频体验项（留给 5.3/5.5）。

---

## 5. 输出物定义（5.0 结束态）

1. `docs/plans/phase5/metrics/2026-03-04-phase5-0-baseline.md`
2. `docs/plans/phase5/templates/phase5-pr-checklist.md`
3. `docs/plans/phase5/templates/phase5-smoke-matrix.md`
4. `apps/game-client/package.json`（新增 coverage 脚本）
5. `package.json`（CI 门禁链路接入 coverage）
6. 诊断指标输出入口（debug diagnostics 或日志摘要）

---

## 6. PR 级实施计划（5.0）

> 规则：5.0 每个 PR 必须“单目标、可回滚、可复核”。

### PR-5.0-01：基线与模板冻结

**目标**: 建立 Phase 5 的统一执行与评审模板。

**新增文件（建议）**:
1. `docs/plans/phase5/metrics/2026-03-04-phase5-0-baseline.md`
2. `docs/plans/phase5/templates/phase5-pr-checklist.md`
3. `docs/plans/phase5/templates/phase5-smoke-matrix.md`

**修改文件（建议）**:
1. `docs/plans/phase5/roadmap.md`（补子阶段索引与跳转）

**验收标准**:
1. 任一成员可根据模板独立提交一个标准化 PR。
2. baseline 数据可由命令复核。
3. 主计划与子计划无冲突路径。

### PR-5.0-02：覆盖率门禁接入

**目标**: 把“测试存在”升级为“测试质量可量化”。

**修改文件（建议）**:
1. `apps/game-client/package.json`
2. `apps/game-client/vitest.config.ts`（或等价测试配置）
3. `package.json`

**关键动作**:
1. 新增 `test:coverage` 脚本（聚焦 `systems + scenes/dungeon`）。
2. 设定最低阈值（建议初始线）：`lines >= 70`, `branches >= 65`。
3. 把 coverage 检查接入 `ci:check`（可独立开关为 `check:coverage`）。

**验收标准**:
1. 覆盖率报告可生成。
2. 低于阈值时 CI 明确失败。
3. 报告路径和阈值在文档可查。

### PR-5.0-03：诊断采样点补齐

**目标**: 建立移动体验问题的可观测证据链。

**修改文件（建议）**:
1. `apps/game-client/src/scenes/DungeonScene.ts`
2. `apps/game-client/src/scenes/dungeon/diagnostics/DiagnosticsService.ts`
3. `apps/game-client/src/scenes/dungeon/debug/DebugCommandRegistry.ts`

**关键动作**:
1. 增加路径相关计数器：`pathRequestCount/pathAbortUnreachableCount/pathReplanCount`。
2. 增加输入延迟采样：`inputIntentAtMs -> firstMovementAtMs`。
3. diagnostics 导出聚合摘要（至少含 count + p50/p95）。

**验收标准**:
1. 不打开 debug 时无明显性能影响。
2. 打开 debug 可导出本局路径失败率和输入延迟摘要。
3. 指标字段稳定，可用于 5.2 对比。

---

## 7. 验证与回归清单

### 7.1 自动化

```bash
pnpm check:toolchain
pnpm check
pnpm test
pnpm check:architecture-budget
pnpm ci:check
```

覆盖率 PR 合并前补跑：

```bash
pnpm --filter @blodex/game-client test:coverage
```

### 7.2 手动核对

1. 默认优先使用金手指（debug cheats）快速推进到目标场景完成验证；仅在需要验证真实难度体感时补 1 轮非金手指复测。
2. `debugDiagnostics=1` 启动后，确认 diagnostics 面板可显示新增指标。
3. 进行 1 局 Normal，确认输入延迟与路径失败指标有数据。
4. 不带 debug 参数运行，确认主流程行为与性能无异常变化。

---

## 8. 风险与止损策略

| 风险 | 等级 | 触发信号 | 止损策略 |
|---|:---:|---|---|
| coverage 阈值过高导致 CI 长期阻塞 | 中 | 连续 PR 因门禁失败 | 分阶段阈值（先 70/65，再逐阶段上调） |
| 诊断采样影响主循环性能 | 中 | 帧时间波动上升 | 默认关闭采样明细，仅保留聚合计数 |
| 文档模板过重导致执行成本高 | 低 | PR 填写负担过大 | 保留必填最小集，附录放可选项 |

回滚原则：

1. 5.0 变更均可按文件粒度回滚。
2. 若 coverage 门禁阻塞过重，先临时降阈值，不回滚整条链路。

---

## 9. 5.0 出口门禁（Done 定义）

1. baseline 文档、PR 模板、smoke 模板已落地。
2. 覆盖率命令可执行且阈值生效。
3. diagnostics 可导出路径失败率与输入延迟指标。
4. `pnpm ci:check` 全绿。

---

## 10. 与 5.1 的交接清单

进入 5.1 前必须确认：

1. 三大类当前体量与预算数据已冻结。
2. `Record<string, any>` 使用点有完整清单（18 处）并可追踪消减。
3. 5.1 的 A/B/C 压线目标已写入主计划与阶段文档。
