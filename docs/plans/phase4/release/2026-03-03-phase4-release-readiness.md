# Phase 4 发布就绪清单（Release Readiness）

**日期**: 2026-03-03  
**阶段**: Phase 4.7  
**发布候选分支**: `codex/phase4-7-release-closure-dod`  
**发布候选提交**: `fd4ea52`  
**状态口径**: `Pending / Pass / Fail / Blocked / Waived`

---

## 1. 冻结与准入规则

1. 仅允许 P0/P1 发布阻塞修复进入 4.7。
2. 所有改动必须附带回归证据与回滚路径。
3. 无证据项默认 `Pending`，不得签署发布。
4. `Blocked` 项不允许通过发布评审，除非有批准豁免单。

---

## 2. 自动化门禁结果

| 门禁 | 命令 | 结果 | 证据 | 备注 |
|---|---|---|---|---|
| 架构预算 | `pnpm check:architecture-budget` | Pass | 本轮执行通过 | `DungeonScene=2581/2600` |
| 源码卫生 | `./scripts/check-source-hygiene.sh` | Pass | 输出 `source tree is clean` | 无 |
| 全量 CI | `pnpm ci:check` | Pass | typecheck/test/i18n/css/content/hygiene/budget 全绿 | 无 |
| 资产一致性 | `pnpm assets:validate` | Pass | `Manifest valid: 68` + `Audio manifest valid: 40` | 仅保留文档改动 |

---

## 3. DoD 签署表（主计划第 9 章）

| 类别 | 条目 | 标准 | 当前值/现状 | 状态 | 证据 |
|---|---|---|---|---|---|
| 工程 | `DungeonScene.ts` 行数 | `< 2500` | `2581` | Blocked | `wc -l` 结果 |
| 工程 | `Hud.ts` 行数（容器化） | `< 300` | `5` | Pass | `wc -l` 结果 |
| 工程 | `UI_POLISH_FLAGS` 清理 | 无业务引用 | `rg` 无检索命中 | Pass | `rg \"UI_POLISH_FLAGS\" apps/game-client/src` |
| 工程 | 三系统覆盖率 | `> 70%` | 待核验 | Pending | 覆盖率报告 |
| 工程 | 全量门禁 | `pnpm ci:check` 通过 | 本轮已通过 | Pass | 本地命令输出 |
| 体验 | G1~G7 达成 | 回归矩阵全 Pass | 待核验 | Pending | `phase4-regression-matrix.md` |
| 兼容 | Save/Meta 向后兼容 | fixture 全 Pass | 待核验 | Pending | 兼容记录 |
| 可观测 | 关键事件日志完整 | 指定事件均可追踪 | 待核验 | Pending | 日志样本 |
| 性能 | 无明显退化 | 指标在阈值内 | 待核验 | Pending | `phase4-performance-compare.md` |

---

## 4. 阻塞缺陷清单（发布视角）

| 缺陷 ID | 严重级别 | 描述 | 当前状态 | Owner | 修复 PR | 证据 |
|---|:---:|---|---|---|---|---|
| REL-001 | P1 | `DungeonScene` 未达到 `<2500` DoD | Open | @owner | 待补充 | 行数统计 |

---

## 5. 豁免记录（如使用）

| 豁免 ID | 对应条目 | 风险说明 | 到期版本 | 审批人 | 状态 |
|---|---|---|---|---|---|
| N/A | N/A | 当前无豁免 | N/A | N/A | N/A |

---

## 6. 发布签署

| 角色 | 人员 | 结论 | 日期 | 备注 |
|---|---|---|---|---|
| Tech Lead | 待填 | Pending | 待填 | 无 |
| QA | 待填 | Pending | 待填 | 无 |
| Product | 待填 | Pending | 待填 | 无 |
| Release Manager | 待填 | Pending | 待填 | 无 |

**签署规则**:
1. 任何 `Blocked` 未关闭时，签署结果必须为 `No-Go`。
2. 使用豁免时，必须在“豁免记录”登记并绑定到期版本。
