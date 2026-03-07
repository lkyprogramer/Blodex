# Phase 6 Browser Smoke Report

**日期**: `2026-03-07`  
**环境**: `localhost:5175/?debugCheats=1`  
**方式**: `Chrome DevTools + debug cheats + targeted save/reload`  
**结论**: `Core pass / One runtime gap found and fixed`

## 1. 目标与范围

1. 快速验证 Phase 6 的核心玩家可感知改动：
   - `6.1` 关键选择与职业起步深度
   - `6.2` 战力跃迁与 Boss reward 闭环
   - `6.3` heartbeat feedback / equipment compare
   - `6.4` trade-off item 与 signed delta 呈现
   - `6.0 / 6.1` save / resume 续档闭环
2. 本轮默认使用 debug cheats 缩短路径，不把 cheat run 当作 pacing / cadence 签署证据。

## 2. 使用的金手指入口

1. 启用方式：`?debugCheats=1`
2. 关键命令：
   - `window.__blodexDebug.clearFloor()`
   - `window.__blodexDebug.jumpFloor(floor)`
   - `window.__blodexDebug.openBossVictory()`
   - `window.__blodexDebug.openMerchant()`
   - `window.__blodexDebug.addObols(amount)`
   - `window.__blodexDebug.forceSynergy()`
   - `window.__blodexDebug.killPlayer()`

## 3. 验证结果

| ID | 场景 | 结果 | 证据 |
|---|---|---|---|
| B1 | level-up skill 3 选 1 | Pass | `clearFloor()` 后弹出技能选择；截图 `phase6-6.1-skill-choice.png` |
| B2 | 属性分配 delta preview | Pass | 选择面板显示 `攻击 / 暴击 / 法力 / 移速` 等即时变化 |
| B3 | arcanist 基础技能可见 | Pass | `rift_step` 在未锻造蓝图前进入技能选择池 |
| B4 | build formed feedback | Pass | 出现 `构筑成型` toast；截图 `phase6-6.3-build-formed-toast.png` |
| B5 | synergy activated feedback | Pass | `forceSynergy()` 后日志出现 `Synergy activated...`，角色武器/技能同步切换 |
| B6 | merchant compare gating | Pass | floor 1 low-value common 购买不弹 compare；floor 4 high-value rare 购买弹 compare |
| B7 | negative affix / trade-off compare | Pass | `誓约胸甲` 展示 `最大生命 +19 / 最大法力 +13 / 移速 -8` |
| B8 | boss reward runtime closure | Pass | `openBossVictory()` 后奖励入包、日志记录、run-end summary 有 `Boss reward closed` |
| B9 | boss reward -> compare prompt | Pass | 初次发现缺口，修复后复测通过；截图 `phase6-boss-reward-compare-fixed.png` |
| B10 | death feedback -> next-run guidance | Pass | `killPlayer()` 后失败结算展示诊断、错过机会、下一局方案 |
| B11 | save / resume continuity | Pass | 刷新后元进度界面出现 `继续挑战`，恢复到第 4 层与当前构筑 |

## 4. 关键观察

### 4.1 已确认成立

1. Phase 6 的“关键选择 -> 战力跃迁 -> 反馈表达 -> run-end 建议”主链已经能在浏览器里串通。
2. `merchant_purchase` 的 compare prompt 门槛生效，没有被 common 购买刷屏。
3. `trade-off item` 的正负词缀呈现已经可读，负收益不会在 UI 层丢失。
4. save / resume 不再只恢复 floor 编号，实际武器、技能槽和日志都能回到续档态。

### 4.2 本轮发现并修复

1. **Boss reward 没有进入 compare prompt 链路**：
   - 初测现象：Boss 奖励入包，但胜利面板关闭后没有出现 equipment compare。
   - 根因：`PowerSpikeRuntimeModule.grantStoryBossReward()` 只做了 pickup / spike / build telemetry，没有把奖励物品送入 `HeartbeatFeedbackRuntime` 的 compare 队列；同时 Boss 面板关闭后会立即 `finishRun(true)`，没有给 compare prompt 留出展示窗口。
   - 修复后复测：关闭 Boss 胜利面板后，`BOSS 奖励` compare prompt 正常出现。

## 5. 当前未覆盖项

1. `6.5 pacing / cadence` 不应使用 cheat run 签署，本轮未把它作为通过/失败依据。
2. `damageType` 与 `buff runtime` 没做单独的浏览器级白盒验证；本轮只间接验证了 `synergy` 和 run-end 分析。
3. 路线分支本轮主要通过 biome / summary 间接确认，没有专门走一次真实 fork 交互。

## 6. 产出附件

1. [phase6-6.1-skill-choice.png](./assets/browser-smoke/phase6-6.1-skill-choice.png)
2. [phase6-6.3-build-formed-toast.png](./assets/browser-smoke/phase6-6.3-build-formed-toast.png)
3. [phase6-6.3-compare-prompt.png](./assets/browser-smoke/phase6-6.3-compare-prompt.png)
4. [phase6-boss-reward-compare-fixed.png](./assets/browser-smoke/phase6-boss-reward-compare-fixed.png)
