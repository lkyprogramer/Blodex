# Phase 5.7 收口与发布（DoD Freeze）实施文档（PR 级）

**日期**: 2026-03-04  
**阶段**: Phase 5 / 5.7  
**目标摘要**: 对 5.0~5.6 的改造进行最终收口，完成发布门禁冻结、全量回归、兼容验证、性能对比、回滚预案和 DoD 签署。

**关联文档**:
1. `docs/plans/phase5/2026-03-04-phase5-deep-review-and-roadmap.md`
2. `docs/plans/phase5/roadmap.md`
3. `docs/plans/phase5/2026-03-04-phase5-6-depth-expansion-p2.md`
4. `docs/plans/phase4/2026-03-03-phase4-7-release-closure-and-dod.md`

---

## 1. 直接结论

5.7 的核心不是继续加需求，而是把 Phase 5 变成可发布基线：

1. 把 Phase 5 DoD 全量转为“失败即阻塞”的发布门禁。
2. 完成自动化、手动、兼容、性能四类回归并留证据。
3. 冻结最终架构阈值并与脚本一致：`1500 / 650 / 450`。
4. 输出发布说明、回滚手册、风险豁免单（如有），并冻结音频资产一致性证据。

5.7 通过标准：

1. 三大类终态阈值全部达成。
2. 回归矩阵无 P0/P1 未关闭缺陷。
3. 兼容与性能结论可复核。

---

## 2. 输入基线（5.7 执行起点）

### 2.1 基线刷新要求

执行 5.7 前先刷新以下数据（禁止沿用历史值）：

```bash
wc -l apps/game-client/src/scenes/DungeonScene.ts \
      apps/game-client/src/scenes/MetaMenuScene.ts \
      apps/game-client/src/ui/hud/HudContainer.ts

pnpm check:architecture-budget
pnpm ci:check
```

### 2.2 DoD 与脚本一致性要求

1. `scripts/check-architecture-budgets.sh` 的阈值必须与 DoD 完全一致。
2. release 文档中的状态必须绑定 commit SHA 与执行日期。

### 2.3 阻塞项优先级

1. 阈值未达成 -> 阻塞发布。
2. 兼容失败 -> 阻塞发布。
3. 未解释性能退化 -> 阻塞发布。

---

## 3. 范围与非目标

### 3.1 范围

1. 发布门禁文档与证据链落地。
2. 全量自动化 + 手动回归执行。
3. 兼容验证、性能对比、回滚演练。
4. 发布说明与 DoD 签署。

### 3.2 非目标

1. 不新增玩法和系统。
2. 不再做跨模块结构重构（仅允许阻塞修复）。
3. 不新增长期特性开关。

---

## 4. 5.7 输出物（必须产出）

1. `docs/plans/phase5/release/2026-03-04-phase5-release-readiness.md`
2. `docs/plans/phase5/release/2026-03-04-phase5-regression-matrix.md`
3. `docs/plans/phase5/release/2026-03-04-phase5-performance-compare.md`
4. `docs/plans/phase5/release/2026-03-04-phase5-rollback-playbook.md`
5. `docs/plans/phase5/release/2026-03-04-phase5-release-notes.md`

输出规则：

1. 每份文档包含 `Pending/Pass/Fail/Waived` 状态列。
2. 每条结论绑定证据（命令输出、截图、日志、测试结果）。
3. 豁免单必须包含编号、风险、到期版本、责任人。

---

## 5. PR 级实施计划（5.7）

### PR-5.7-01：门禁冻结与发布文档骨架

**目标**: 把 DoD 转为可执行发布门禁。

**关键动作**:
1. 新建 release 文档集。
2. 将 DoD 拆成可勾验条目。
3. 冻结最终阈值：
   - `DungeonScene <= 1500`
   - `MetaMenuScene <= 650`
   - `HudContainer <= 450`
4. 同步更新预算脚本与主计划阈值。

**验收标准**:
1. 门禁项可独立执行与复核。
2. 文档阈值与脚本阈值一致。

### PR-5.7-02：全量回归与兼容收口

**目标**: 关闭所有发布阻塞问题。

**建议命令**:

```bash
pnpm quality:precheck
pnpm check:toolchain
pnpm check
pnpm test
pnpm --filter @blodex/game-client i18n:check
pnpm --filter @blodex/game-client css:check
pnpm check:content-i18n
pnpm check:source-hygiene
pnpm check:architecture-budget
pnpm assets:audio:compile
pnpm assets:audio:validate
pnpm ci:check
pnpm assets:validate
```

**必须覆盖场景**:
1. Normal/Hard/Boss/Endless 全流程。
2. 路径选择与祝福联动场景。
3. Save/Restore（事件中、战斗中、分支选择后）。
4. 中英文切换与 HUD 关键信息一致性。

**验收标准**:
1. 回归矩阵无 P0/P1 未关闭项。
2. 兼容用例全部通过。

### PR-5.7-03：性能对比、回滚演练、发布签署

**目标**: 形成上线决策材料并完成签署冻结。

**关键动作**:
1. 对比 5.0 baseline 与 5.7 当前性能指标。
2. 完成回滚演练并记录步骤与耗时。
3. 产出 release notes（改造摘要、兼容说明、已知限制）。
4. 完成 DoD 签署。

**验收标准**:
1. 性能退化项要么修复要么有批准豁免。
2. 回滚方案可执行。
3. 发布说明可供研发/测试/运维共用。

---

## 6. 统一验证清单

### 6.1 自动化门禁

```bash
pnpm quality:precheck
pnpm check:toolchain
pnpm check
pnpm test
pnpm --filter @blodex/game-client i18n:check
pnpm --filter @blodex/game-client css:check
pnpm check:content-i18n
pnpm check:source-hygiene
pnpm check:architecture-budget
pnpm assets:audio:compile
pnpm assets:audio:validate
pnpm ci:check
pnpm assets:validate
```

### 6.2 手动阻塞矩阵

1. 默认优先使用金手指（debug cheats）快速通关并到达各阻塞验证节点；涉及难度/平衡判断时再补非金手指复测。
2. 玩法链路：Normal/Hard/Boss/Endless/RouteChoice/Event/Merchant。
3. 兼容链路：旧 save、旧 meta、混合字段恢复。
4. 体验链路：移动可达性、战斗触感、HUD 可读性。
5. 资产链路：视觉 + 音频资源缺失降级与加载稳定性。

---

## 7. DoD 冻结表（5.7 执行口径）

| 类别 | DoD 条目 | 通过标准 | 状态 | 证据文档 |
|---|---|---|---|---|
| 架构 | `DungeonScene.ts` | `<=1500` | Pending | `phase5-release-readiness.md` |
| 架构 | `MetaMenuScene.ts` | `<=650` | Pending | `phase5-release-readiness.md` |
| 架构 | `HudContainer.ts` | `<=450` | Pending | `phase5-release-readiness.md` |
| 质量 | game-client 覆盖率 | 达到 5.0 门禁阈值 | Pending | `phase5-release-readiness.md` |
| 体验 | 5.2~5.6 关键场景 | 回归矩阵通过 | Pending | `phase5-regression-matrix.md` |
| 兼容 | Save/Meta 向后兼容 | fixture 全通过 | Pending | `phase5-regression-matrix.md` |
| 性能 | 无未解释退化 | 指标对比通过 | Pending | `phase5-performance-compare.md` |
| 资产 | 音频清单一致性 | `audio-plan/audio-manifest/public/audio` 一致且校验通过 | Pending | `phase5-release-readiness.md` |
| 运维 | 回滚可执行 | 演练通过 | Pending | `phase5-rollback-playbook.md` |

---

## 8. 风险与止损策略

| 风险 | 等级 | 触发信号 | 止损策略 |
|---|:---:|---|---|
| 阈值未达但强行发布 | 高 | DoD 与脚本不一致 | 先收紧脚本并阻断合并 |
| 兼容遗漏 | 高 | 旧档加载失败 | fixture 测试升级为阻塞项 |
| 性能结论不可复核 | 中 | 指标缺证据 | 未填性能文档不得签署 |
| 回滚手册不可执行 | 中 | 演练失败 | 先补演练再发布 |

回滚原则：

1. 优先按阶段回滚（5.6 -> 5.5 -> 5.4）。
2. 若兼容风险高，优先回滚 save 扩展相关变更。

---

## 9. 5.7 出口门禁（Done 定义）

1. 三大类终态阈值全部达成。
2. 自动化门禁与手动回归矩阵全绿。
3. 兼容、性能、回滚文档齐全且可复核。
4. 发布说明完成并签署。
5. 音频资源链路校验通过并留证据（命令输出 + 清单快照）。

---

## 10. Phase 5 完成定义（Exit）

1. 项目从“预算临界”转入“长期可维护”状态。
2. 关键体验问题（可达性、触感、可读性）已形成持续治理闭环。
3. 文档、脚本、CI 三层口径一致，可直接作为 Phase 6 起点。
