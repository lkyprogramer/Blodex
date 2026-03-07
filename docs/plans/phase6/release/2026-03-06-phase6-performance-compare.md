# Phase 6 Performance / Pacing Compare

**基线 commit**: `19574b7`  
**状态**: `Automation Pass / Manual Context Pending`

## 1. 采样方法与基线

1. heuristic：`pnpm balance:report`
2. real：`pnpm balance:real:report`
3. unified evidence：`pnpm phase6:evidence:report`

## 2. 场景与指标

1. `clearRate`
2. `avgFloorReached`
3. `avgRunDurationMs`
4. `runDurationP50Ms / runDurationP90Ms`
5. `avgSkillCastsPer30s`（active combat window）
6. `avgSkillCastsPer30sRunClock`
7. `pairSatisfactionRate`

## 3. 对比结果表

| 场景 | heuristic avgRunDurationMs | real avgRunDurationMs | delta | 结论 |
|---|---|---|---|---|
| normal-average | `953079` | `916758` | `36321` | 默认阈值内；Normal timing pass |
| hard-optimal | `990057` | `868191` | `121866` | 默认阈值内；保留为上界观测样本 |
| hard-average | `809831` | `969362` | `159531` | 通过 `phase6-6.5-hard-average-v2` override；用于 Hard 发布签署 |
| nightmare-optimal | `883118` | `586256` | `296862` | 通过 `phase6-6.5-nightmare-optimal-v1` override；Nightmare P50 仍低于目标下限 |

## 3.1 Pacing / Cadence 快照

| 难度 | P50 | P90 | active cadence | run-clock cadence | 结论 |
|---|---|---|---|---|---|
| normal | `931920` | `958920` | `4.580` | `0.613` | 达标 |
| hard | `1015080` | `1057920` | `4.384` | `0.629` | 达标（签署口径使用 `hard-average`） |
| nightmare | `570520` | `998960` | `9.996` | `1.510` | P50 低于目标；cadence 高于上限 |

## 4. Pacing / Threshold Override 审计

1. 默认阈值不得无证据整体放宽。
2. override 必须记录：
   - 场景
   - sample size
   - baseline commit
   - evidenceRef
   - rationale

## 5. 结论与阈值判定

| 条目 | 状态 | 备注 |
|---|---|---|
| Normal P50 12~18 min | Pass | `931920ms` |
| Normal P90 <= 20 min | Pass | `958920ms` |
| active cadence（Normal） | Pass | `4.580` 落在 `4.5~8.5` |
| active cadence（Hard） | Pass | `4.384` 落在 `4.0~8.0` |
| active cadence（Nightmare） | Fail | `9.996 > 9.0` |
| threshold registry 完整 | Pass | `1` 个 default + `2` 个 scenario override |
| override 审计通过 | Pass | `violations=[]` |
