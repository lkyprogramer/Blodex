# Phase 6 Release Readiness

**基线 commit**: `19574b7`  
**状态**: `Automation Pass / Release Pending`

## 1. 冻结基线与版本标识

1. Phase 6 基线：`19574b7`
2. Evidence pack 输出：`pnpm phase6:evidence:report`
3. 自动化门禁：`pnpm ci:check`

## 2. 自动化门禁结果

| 门禁 | 结果 | 证据 |
|---|---|---|
| `pnpm -r typecheck` | Pass | 已包含在 `pnpm ci:check`（2026-03-07 本地执行） |
| `pnpm test` | Pass | 已包含在 `pnpm ci:check`（2026-03-07 本地执行） |
| `pnpm ci:check` | Pass | 2026-03-07 本地执行 |
| `pnpm phase6:evidence:report` | Pass | 2026-03-07 本地执行 |
| `assets:audio:validate` | N/A | 6.5 无音频资源增量 |
| `assets:validate` | N/A | 6.5 无资源 manifest 增量 |

## 3. Exit Gate / DoD 签署表

| 条目 | 状态 | 证据 |
|---|---|---|
| choice / spike / feedback 合同 | Pass | `2026-03-07-phase6-browser-smoke-report.md` |
| buff / damageType / synergy 合同 | Pending | `synergy` 已在 browser smoke 验证；`buff / damageType` 待补 |
| pacing 目标（Normal P50 / P90） | Pass | `931920 / 958920` |
| core skill cadence（active combat） | Fail | Hard `4.384` 已达标；Nightmare `9.996 > 9.0` |
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
| Engineering | Pending | | 自动化通过，但 cadence / manual smoke 未签 |
| Taste Review | Pending | | 录像与手感复盘待补 |
| Release Owner | Pending | | 等待最终人工签署 |
