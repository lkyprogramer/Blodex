# Phase 6 Release Notes

**基线 commit**: `19574b7`  
**状态**: `Release Candidate / Manual Sign-off Pending`

## 1. 版本摘要

1. 完成 Phase 6 的 choice / spike / feedback / rhythm / trade-off 收口。
2. 增加 pacing evidence pack、threshold registry 审计，以及 release closure 文档集。

## 2. 玩法与体验变化

1. 关键构筑选择与技能 cadence 调整。
2. power spike guarantee 与 boss reward 闭环。
3. heartbeat feedback 与 equipment compare 表现层。
4. attribute trade-off 与 item downside 选择。

## 3. Pacing 目标与证据口径

1. Normal 实测：P50 `931920ms`，P90 `958920ms`
2. Evidence pack：`pnpm phase6:evidence:report`
3. cadence 口径：
   - sign-off 使用 `active combat window`
   - `run clock cadence` 仅用于观测整局停顿稀释

## 4. 兼容 / 资源 / 运维说明

1. save 兼容仍通过 normalization 路径保障。
2. 6.5 无新增资源清单变更，`assets:*` 校验本阶段记为 `N/A`。

## 5. Known Issues

1. 手动录像证据待补齐。
2. Nightmare `active cadence` 高于目标上限，需要 design 复盘。
3. Nightmare `runDurationP50` 低于目标下限，需要 design 复盘。
4. 最终 taste sign-off 需人工签署。

## 6. 相关文档

1. `docs/plans/phase6/2026-03-06-phase6-6.5-pacing-tuning-release-closure-and-taste-signoff.md`
2. `docs/plans/phase6/release/2026-03-06-phase6-release-readiness.md`
3. `docs/plans/phase6/release/2026-03-06-phase6-taste-signoff.md`
