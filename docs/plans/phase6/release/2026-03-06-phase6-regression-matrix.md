# Phase 6 Regression Matrix

**基线 commit**: `19574b7`  
**状态**: `Automation Pass / Manual Smoke Pass`

## 1. 测试上下文

1. 默认优先使用 debug cheats 快速覆盖阻塞节点。
2. 所有节奏与体感结论必须补至少 1 轮非金手指复测。
3. 任一阻塞项失败即不允许签署。

## 2. 阻塞 Smoke Matrix

| 场景 ID | 场景 | 自动化/手动 | 结果 | 证据 |
|---|---|---|---|---|
| S6-01 | Normal story run | 自动化 | Pass | `pnpm phase6:evidence:report`，Normal `P50=931920` / `P90=958920` |
| S6-02 | Hard story run | 自动化 | Pass | `pnpm phase6:evidence:report`，签署口径 `hard-average` 无 pacing alert |
| S6-03 | Nightmare story run | 自动化 | Pass | `pnpm phase6:evidence:report`，Nightmare `P50=993800` / `P90=1053920` / cadence `8.200` |
| S6-04 | rare / build / boss peak run | 手动 | Pass | `2026-03-07-phase6-browser-smoke-report.md` |
| S6-05 | warrior / ranger / arcanist 起步深度入口白盒样本 | 手动 | Pass | `assets/manual/phase6-class-parity.md` |
| S6-06 | trade-off item run | 手动 | Pass | `2026-03-07-phase6-browser-smoke-report.md` |
| S6-07 | buff / damageType / synergy 运行时入口与合同校验 | 手动 | Pass | `assets/manual/phase6-buff-damagetype-contract.md` |

## 3. 扩展回归

1. resource fallback 与 manifest 一致性
2. rhythm before/after 对比
3. build formed 与 compare prompt 高压路径

## 4. 问题清单与复盘结论

1. 当前阻塞 smoke 已全部通过。
2. `S6-05` 与 `S6-07` 已通过手工签署记录转为 `Pass`。
3. Nightmare 调优后的最终自动化口径：
   - `runDurationP50=993800`
   - `runDurationP90=1053920`
   - `active cadence=8.200`
