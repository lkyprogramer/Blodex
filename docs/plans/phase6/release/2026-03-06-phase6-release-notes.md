# Phase 6 Release Notes

**基线 commit**: `19574b7`  
**状态**: `Signed`

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

1. Phase 6 最终以已签署 evidence pack 收口，Nightmare pacing / cadence 已回到目标带内。
2. 6.5 无新增资源清单变更，`assets:*` 校验本阶段记为 `N/A`。

## 5. Known Issues

1. 当前无阻塞性已知问题。
2. `average idle gap` 仍保留为 `7.2` 的诊断项，不作为 Phase 6 阻塞签署项。

## 6. 相关文档

1. `docs/plans/phase6/2026-03-06-phase6-6.5-pacing-tuning-release-closure-and-taste-signoff.md`
2. `docs/plans/phase6/release/2026-03-06-phase6-release-readiness.md`
3. `docs/plans/phase6/release/2026-03-06-phase6-taste-signoff.md`
