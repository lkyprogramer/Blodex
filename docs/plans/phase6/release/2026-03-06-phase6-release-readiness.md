# Phase 6 Release Readiness

**基线 commit**: `19574b7`  
**状态**: `Signed`

## 1. 冻结基线与版本标识

1. Phase 6 基线：`19574b7`
2. Evidence pack 输出：`pnpm phase6:evidence:report`
3. 自动化门禁：`pnpm ci:check`

## 1.1 关联证据索引

1. 浏览器烟测：`docs/plans/phase6/release/2026-03-07-phase6-browser-smoke-report.md`
2. 阻塞 smoke matrix：`docs/plans/phase6/release/2026-03-06-phase6-regression-matrix.md`
3. 最终 Taste sign-off：`docs/plans/phase6/release/2026-03-06-phase6-taste-signoff.md`

## 2. 自动化门禁结果

| 门禁 | 结果 | 证据 |
|---|---|---|
| `pnpm -r typecheck` | Pass | 已包含在 `pnpm ci:check`（2026-03-08 本地执行） |
| `pnpm test` | Pass | 已包含在 `pnpm ci:check`（2026-03-08 本地执行） |
| `pnpm ci:check` | Pass | 2026-03-08 本地执行 |
| `pnpm phase6:evidence:report` | Pass | 2026-03-08 本地执行 |
| `assets:audio:validate` | N/A | 6.5 无音频资源增量 |
| `assets:validate` | N/A | 6.5 无资源 manifest 增量 |

## 3. Exit Gate / DoD 签署表

| 条目 | 状态 | 证据 |
|---|---|---|
| choice / spike / feedback 合同 | Pass | `2026-03-07-phase6-browser-smoke-report.md` |
| buff / damageType / synergy 运行时入口与合同校验 | Pass | `assets/manual/phase6-buff-damagetype-contract.md` |
| pacing 目标（Normal P50 / P90） | Pass | `931920 / 958920` |
| core skill cadence（active combat） | Pass | Normal `4.580`，Hard `4.384`，Nightmare `8.200` |
| threshold registry / override audit | Pass | `1` default + `2` overrides；`violations=[]` |
| Host Port / architecture gates | Pass | `pnpm ci:check` + `pnpm check:architecture-budget` |

## 4. 阻塞缺陷与豁免记录

1. 当前默认不接受 `Non-waivable` 豁免。
2. 如需豁免，必须记录：
   - 条目 ID
   - 风险说明
   - 替代控制
   - 到期版本

## 5. 最终发布签署

| 角色 | 结论 | 日期 | 备注 |
|---|---|---|---|
| Engineering | Signed | 2026-03-08 | 自动化证据与 release consistency 已复核 |
| Taste Review | Signed | 2026-03-08 | browser smoke + parity / contract 人工证据已归档 |
| Release Owner | Signed | 2026-03-08 | regression matrix、rollback 与最终签署记录齐备 |
