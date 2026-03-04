# Phase 4 发布回归矩阵（Release Regression Matrix）

**日期**: 2026-03-03  
**阶段**: Phase 4.7  
**测试分支**: `codex/phase4-7-release-closure-dod`  
**测试提交**: `fd4ea52`  
**状态口径**: `Pending / Pass / Fail`

---

## 1. 测试上下文

| 字段 | 内容 |
|---|---|
| OS | `Darwin 24.6.0 arm64` |
| Browser / Runtime | `Node v22.17.0` |
| Device | 本机终端 |
| 测试人 | Codex |
| 测试日期 | 2026-03-04 |

---

## 2. 自动化回归

| 序号 | 命令 | 结果 | 证据摘要 |
|---|---|---|---|
| A-01 | `pnpm quality:precheck` | Pass | typecheck/test/i18n/css/content/hygiene 全通过 |
| A-02 | `pnpm check:architecture-budget` | Pass | 预算检查通过，详见 readiness |
| A-03 | `pnpm ci:check` | Pass | 全量门禁通过（含 budget/hygiene） |
| A-04 | `pnpm assets:validate` | Pass | manifest 与 audio manifest 校验通过 |

---

## 3. 手动阻塞矩阵

| 用例 ID | 场景 | 步骤摘要 | 预期结果 | 实际结果 | 结论 | 证据 |
|---|---|---|---|---|---|---|
| S-01 | Normal 主流程 | 1->5 层并完成 Boss 结算 | 流程完整，奖励与日志正确 | 待填 | Pending | 待填 |
| S-02 | Boss Telegraph | 触发 `heavy_strike` 与 `bone_spikes` | 预警->执行时序正确，可规避窗口生效 | 待填 | Pending | 待填 |
| S-03 | Endless 里程碑 | 推进至 14 层 | 8/11/14 层突变规则按期生效 | 待填 | Pending | 待填 |
| S-04 | Event 分支深化 | 触发至少 3 个新增分支 | 分支效果差异明确，状态正确 | 待填 | Pending | 待填 |
| S-05 | Merchant 策略深化 | 测试后期价格与库存策略 | 决策不只依赖当前 obol | 待填 | Pending | 待填 |
| S-06 | Deferred Outcome | 触发延迟收益并跨层推进 | 到达触发点后结算且不重复 | 待填 | Pending | 待填 |
| S-07 | Save/Load-Event | 事件中保存后恢复 | 状态与分支上下文一致 | 待填 | Pending | 待填 |
| S-08 | Save/Load-Boss | Boss 前保存后恢复 | Boss 进入与反馈链路一致 | 待填 | Pending | 待填 |
| S-09 | Save/Load-Endless | Endless 中段保存后恢复 | Mutator 与延迟收益状态一致 | 待填 | Pending | 待填 |
| S-10 | Biome/Weapon/LevelUp | 覆盖 G1/G2/G3 关键反馈 | 可感知差异稳定，语义不变 | 待填 | Pending | 待填 |
| S-11 | i18n/日志一致性 | 中英文切换并复测关键链路 | 关键文案、日志、HUD 无缺漏 | 待填 | Pending | 待填 |

---

## 4. 兼容性矩阵（Fixture）

| 用例 ID | Fixture | 目标 | 结果 | 备注 |
|---|---|---|---|---|
| C-01 | 旧 Run Save V1 | 迁移到 V2 后可继续游玩 | Pending | 待执行 |
| C-02 | 旧 Run Save V2（缺字段） | 缺字段走默认值并可恢复 | Pending | 待执行 |
| C-03 | 旧 Meta schema | 迁移后可完整进入流程 | Pending | 待执行 |
| C-04 | 脏值容错 | 非法字段不导致崩溃 | Pending | 待执行 |

---

## 5. 缺陷与发布建议

| 缺陷 ID | 级别 | 描述 | 状态 | 对应修复 |
|---|:---:|---|---|---|
| N/A | N/A | 当前暂无录入 | N/A | N/A |

**发布建议（当前）**:
1. 结论：`No-Go`（回归尚未执行完成，且存在 DoD 阻塞项）。
2. 进入 `Go` 的前置条件：自动化全绿 + 手动矩阵全 Pass + 阻塞缺陷清零。
