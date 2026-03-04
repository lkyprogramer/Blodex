# Phase 4 性能对比报告（Performance Compare）

**日期**: 2026-03-03  
**阶段**: Phase 4.7  
**基线版本**: 待填（建议取 4.4 完成后基线）  
**候选版本**: `fd4ea52`  
**状态口径**: `Pending / Pass / Fail`

---

## 1. 采样方法

1. 固定场景、固定 seed、固定分辨率，避免环境噪声。
2. 每个场景采样至少 3 次，记录均值与 95 分位长帧。
3. 使用以下接口采集：
   - `window.__blodexDebug.diagnostics()`
   - `window.__blodexDebug.stressRuns(24)`
4. 采样前清理缓存并重启页面，确保可重复性。

---

## 2. 场景与指标

| 场景 ID | 场景描述 | 关键指标 |
|---|---|---|
| P-01 | Normal（Floor 1~3） | FPS、实体数、监听数、长帧比例 |
| P-02 | Boss Encounter | FPS、特效对象数、长帧比例 |
| P-03 | Endless（Floor 14） | FPS、实体峰值、mutator 活跃数、长帧比例 |
| P-04 | Event + Merchant | UI 交互时延、日志吞吐、监听数 |
| P-05 | Save/Load 恢复点 | 恢复耗时、恢复后 60s 长帧比例 |

---

## 3. 对比结果表

| 场景 | 指标 | 基线值 | 候选值 | Delta | 阈值 | 结果 | 证据 |
|---|---|---:|---:|---:|---:|---|---|
| P-01 | Avg FPS | 待填 | 待填 | 待填 | >= -5% | Pending | 待填 |
| P-01 | 95p Long Frame | 待填 | 待填 | 待填 | <= +10% | Pending | 待填 |
| P-02 | Avg FPS | 待填 | 待填 | 待填 | >= -5% | Pending | 待填 |
| P-03 | Avg FPS | 待填 | 待填 | 待填 | >= -8% | Pending | 待填 |
| P-03 | Listener Count | 待填 | 待填 | 待填 | 不上升异常 | Pending | 待填 |
| P-04 | UI Action Latency | 待填 | 待填 | 待填 | <= +15% | Pending | 待填 |
| P-05 | Load Restore Time | 待填 | 待填 | 待填 | <= +15% | Pending | 待填 |

---

## 4. 判定规则

1. 任一阻塞场景出现未解释退化，结论为 `Fail`。
2. 退化可接受必须满足：有解释、有回归测试、有后续收敛计划。
3. 无数据项一律视为 `Pending`，不得签署发布。

---

## 5. 当前结论

1. 结论：`Pending`（尚未完成完整采样与对比）。
2. 需要补齐：基线 commit、场景数据、阈值判定、证据链接。
