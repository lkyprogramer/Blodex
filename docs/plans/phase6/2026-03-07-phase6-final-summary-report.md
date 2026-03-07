# Phase 6 汇总报告（计划对比、完成情况、问题与技术债）

**日期**: `2026-03-07`  
**核对基线**: `origin/main@0c04ac6`  
**对照计划**: `docs/plans/phase6/2026-03-06-phase6-roadmap.md`  
**核对范围**:

1. 路线图与分阶段文档 `6.0 ~ 6.5`
2. 已合并 PR：
   - `#50` `6.0 observability baseline`
   - `#51` `6.1 combat tempo and choice agency`
   - `#52` `6.2 power spike guarantee`
   - `#53` `6.3 heartbeat expression`
   - `#54` `6.4 attribute tradeoffs and item choice`
   - `#55` `6.5 pacing tuning and release closure`
3. `phase6/release/*` 证据文档
4. 当前主干上的关键脚本与大文件预算状态

---

## 1. 直接结论

**Phase 6 的开发工作已经完成，但 Phase 6 还没有达到路线图定义的“正式关门”状态。**

更准确地说：

1. `6.0 ~ 6.5` 六个阶段的主要开发内容都已完成并合并到 `main`。
2. Phase 6 的核心玩法目标已经大体兑现：
   - 玩家代理权显著增强；
   - spike / boss reward / compare / heartbeat feedback 主链路已打通；
   - trade-off item 与 signed affix 已进入真实运行时；
   - release evidence pack、browser smoke、rollback/playbook 已形成。
3. 但从路线图的最终 DoD 来看，Phase 6 仍处于：
   - `Development Complete`
   - `Automation Pass`
   - `Release Pending / Taste Pending`
4. 当前最主要的未关闭问题有三类：
   - `6.5` 的 Nightmare pacing / cadence 未达标；
   - 手动 smoke、录像、职业 parity、buff/damageType 合同验证未签完；
   - 架构预算没有按原计划压回目标，只是被收口为 debt ceiling no-regression gate，且当前主干上 `DungeonScene.ts` 已再次高于临时 ceiling。

---

## 2. 与路线图的总体对比

### 2.1 路线图核心承诺

路线图冻结的 Signature Experience 是：

`15 分钟 5 层地牢；每层至少 1 次玩家可感知的关键构筑选择；每 2 层至少 1 次达到最低幅度标准的战力跃迁。`

同时还要求：

1. 技能稳定进入战斗循环
2. rare / build formed / boss reward 有明确反馈
3. buff/debuff 与 `physical / arcane` 至少形成最小 runtime 闭环
4. `damageOverTime` 完成语义收口
5. `arcanist` 起步深度显著收敛
6. 至少一类装备形成真实 trade-off
7. Host Port 的 `any` 债被实质收口
8. 技术门禁与 taste 门禁同时通过

### 2.2 总体完成判断

| 条目 | 计划口径 | 实际状态 | 结论 |
|---|---|---|---|
| 六阶段开发落地 | `6.0 ~ 6.5` 全部完成 | `#50 ~ #55` 全部已合并 | `完成` |
| 关键选择 | 每层至少 1 次可感知高价值选择 | 技能 `3 选 1` + 属性 `delta preview` 已落地 | `基本完成` |
| 战力跃迁 | 每 `2` 层至少 `1` 次且达到幅度门槛 | spike budget / scorer / boss reward 已落地 | `基本完成` |
| 心跳反馈 | rare / build / boss / synergy / compare 可见 | browser smoke 已确认主链路 | `完成` |
| 战斗节奏 | 技能稳定进入循环 | Normal / Hard 达标，Nightmare 未达标 | `部分完成` |
| runtime effect closure | buff / damageType / synergy 最小闭环 | 规则层已闭环，人工签署仍缺 | `部分完成` |
| trade-off 与语义修复 | DEX/VIT 重排、DOT 语义收口、signed affix | 已完成 | `完成` |
| 发布收口 | evidence pack + smoke matrix + taste sign-off | evidence 完整，sign-off 未完成 | `部分完成` |

---

## 3. 分阶段校验

### 3.1 `6.0` 基线冻结、观测补线与架构边界收口

**路线图承诺**

1. 冻结 Phase 6 事件字典
2. 产出 story/combat/runtime-effect baseline
3. 补齐 simulator 最小技能观测
4. 收口核心 typed host
5. 输出 cue asset gap audit 与 runtime effect gap audit

**实际落地**

1. `player_facing_choice / power_spike / build_formed / rare_drop_presented / boss_reward_closed / combat_rhythm_window / synergy_activated` 已进入统一 telemetry 口径。
2. run summary、save/resume、taste/log/debug 都已有基础统计承载。
3. `RealBalanceSimulator` 已补最小技能循环。
4. dungeon 主链 runtime host 做了一轮 typed port 收口。
5. `6.0 closeout`、`cue asset gap audit`、`runtime effect gap audit` 已产出。

**结论**

`6.0` 基本按计划完成，是整个 Phase 6 最完整的一段。

**偏差与遗留**

1. 这轮是“观测闭环”，不是“体验闭环”，表达层能力仍待后续阶段兑现。
2. typed host 虽然大幅改善，但没有彻底把 `DungeonScene` 从装配中心降级为小型 facade。

### 3.2 `6.1` 玩家代理权、战斗节奏与职业起步深度

**路线图承诺**

1. 升级技能改成显式 `3 选 1`
2. 属性面板增加 `delta preview`
3. 基础 mana regen + 核心技能 CD 重排
4. `arcanist` 起步技能池对齐
5. buff/debuff runtime 闭环
6. `physical / arcane` 最小差异化

**实际落地**

1. 技能升级 `3 选 1` 已落地。
2. 属性 `delta preview` 已落地。
3. 被动 mana regen、技能循环重排、节奏 telemetry 已落地。
4. `arcanist` 的基础技能池与 blueprint augment 语义已收口。
5. `war_cry / shadow_step / frost_nova` 等 buff/debuff 已进入真实 runtime。
6. `physical / arcane` 已形成最小规则差异。
7. save/restore、simulator、buff 时间重建链都做了多轮修补。

**结论**

`6.1` 的主功能已经完成，且属于 Phase 6 体验提升最明显的一段。

**偏差与遗留**

1. `delta preview` 主要覆盖通用属性变化，没有完全兑现“关键技能收益变化”的文档口径。
2. `2.5s ~ 4s` 的主动输入窗口合同并没有在阶段 closeout 中被正式签署，而是延后到 `6.5` 的 pacing/evidence 体系中统一收口。
3. 这一阶段的证据更多体现在代码和测试里，缺少一份与 `6.0 closeout` 同等级的正式收口文档。

### 3.3 `6.2` 战力跃迁保底、跃迁幅度与 Boss 奖励闭环

**路线图承诺**

1. `1-2`、`3-4` 必须各命中至少 `1` 次合同 spike
2. 引入 amplitude scorer
3. story boss reward runtime 闭环
4. 统一 spike source taxonomy

**实际落地**

1. `PowerSpikeBudget` / `pair fallback` / `boss reward` / `spike telemetry` 已落地。
2. Boss 奖励已先于最终结算进入 runtime 闭环。
3. spike 事件具备 runtime、save/restore、summary、simulator 对齐。
4. source taxonomy 已覆盖 `drop_spawn / merchant_purchase / event_reward / boss_reward / build_threshold / pair_fallback`。

**结论**

`6.2` 已经完成一版可运行的合同闭环，Boss 奖励和每两层保底不再只是文案。

**偏差与遗留**

1. source taxonomy 没有完整兑现文档口径，`skill unlock`、`route pivot` 没作为独立 source kind。
2. amplitude scorer 更偏启发式近似，不是真正基于战斗快照做 TTK/EHP 实测。
3. 保底补偿路径比文档更窄，主要落在 floor clear 时注入 fallback loot，而不是事件/商店/elite 的全路径保底。
4. `6.2` 通过了功能闭环，但缺少类似 `6.0 closeout` 的正式阶段证据归档。

### 3.4 `6.3` 心跳时刻表达层与装备比较反馈

**路线图承诺**

1. rare / unique / build formed / boss / synergy 具备专属反馈
2. compare prompt 从 hover 升级为主动弹出
3. 至少形成每局 `4` 个心跳时刻
4. 音频资源按最小集合接入

**实际落地**

1. `HeartbeatFeedbackRuntime`、`EquipmentComparePrompt`、`FeedbackRouter` 扩展链路已落地。
2. rare/build/boss/synergy cue 已接线。
3. compare prompt 已覆盖拾取、商店和 Boss 奖励等高价值场景。
4. `later / ignore` 语义、merchant compare 门槛、Boss reward compare、event/merchant close-path compare flush 都在 review 后被补齐。
5. browser smoke 已确认：
   - build formed toast
   - merchant 高价值 compare
   - negative affix compare
   - boss reward compare

**结论**

`6.3` 基本完成，且是真正把 Phase 6 从“规则闭环”推向“玩家可感知闭环”的关键阶段。

**偏差与遗留**

1. 表达层主链路已完成，但疲劳度、非金手指多局心跳密度评估仍不足。
2. 本阶段虽然做了音频资源接入，但 release 证据没有把资源链路归档得足够彻底。

### 3.5 `6.4` 属性 trade-off、语义修复与装备权衡

**路线图承诺**

1. DEX/VIT 职责重排
2. `damageOverTime` 语义收口
3. signed affix 能被 compare/HUD 正确表达
4. curated trade-off item 进入真实运行时

**实际落地**

1. `DEX / VIT` 贡献边界已重排。
2. `damageOverTime` 已正式收口为 `skillBonusDamage`，并补了 legacy save 迁移。
3. `itemTradeoff` scorer 已成为共享入口。
4. compare / tooltip / item score 已能处理 signed affix。
5. curated trade-off item 和 unique downside 已进入内容池。

**结论**

`6.4` 按路线图要求基本完成，没有明显缩水。

**偏差与遗留**

1. trade-off 已进入系统，但权重与评分仍更偏工程启发式，并未形成独立 calibration 资产。
2. compare 与 simulator 都依赖 `itemTradeoff` 权重，这套数值后续仍需要经验回压与样本校准。

### 3.6 `6.5` Pacing 调优、发布收口与 Taste 签署

**路线图承诺**

1. 把 `15 分钟 5 层` 做成可签署合同
2. 输出 evidence pack、smoke matrix、rollback/playbook、known issues、taste sign-off
3. 技术门禁与 taste 门禁同时通过

**实际落地**

1. `Phase6EvidencePack`、`Phase6Pacing`、threshold audit、release 文档、browser smoke、rollback/playbook 都已产出。
2. Normal 指标已经达标：
   - `P50=931920ms`
   - `P90=958920ms`
3. 回归矩阵与 taste sign-off 文档已存在。
4. browser smoke 已确认 choice/spike/feedback/compare/save-resume 主链路。

**结论**

`6.5` 的“证据与发布工具链”已完成，但 `6.5` 的“最终签署”没有完成。

**当前阻塞**

1. Nightmare `P50=570520ms`，低于目标下限。
2. Nightmare `active cadence=9.996`，高于上限 `9.0`。
3. `S6-05` 三职业 parity 仍是 `Pending`。
4. `S6-07` 中 `buff / damageType` 的人工录像验证仍待补。
5. release/taste/engineering 三个签署位都还是 `Pending`。

---

## 4. 对路线图 Signature Experience 的校验

### 4.1 `15 分钟 5 层地牢`

**结论**: `部分完成`

1. Normal 达标。
2. Hard 在签署口径 `hard-average` 下达标。
3. Nightmare 不达标。

因此，这个承诺目前只能说：

`Normal / Hard 基本达标，Nightmare 未达标。`

### 4.2 `每层至少 1 次关键构筑选择`

**结论**: `基本完成`

1. 技能升级 `3 选 1` 已显式化。
2. 属性面板已有 `delta preview`。
3. browser smoke 已确认这两条主链。

剩余问题主要不是“有没有”，而是“职业 parity 与长期权重是否已完全签署”。

### 4.3 `每 2 层至少 1 次战力跃迁`

**结论**: `基本完成`

1. runtime 有 budget 与 fallback。
2. amplitude scorer 已上线。
3. Boss reward 已形成稳定闭环。

但这条合同当前仍偏“启发式保底”，还不是“用强战斗快照完全证实的体验合同”。

### 4.4 `每局至少 4 个可记忆心跳时刻`

**结论**: `完成`

browser smoke 已确认：

1. level-up skill choice
2. build formed toast
3. merchant / boss reward compare
4. death feedback / next-run guidance

### 4.5 `buff / damageType / synergy 最小闭环`

**结论**: `部分完成`

1. 规则层已打通。
2. `synergy` 已在 browser smoke 中确认。
3. `buff / damageType` 的人工样本与录像证据还未补齐。

因此这一条是：

`开发完成，签署未完成。`

---

## 5. 主要问题与计划偏差

### 5.1 路线图最终 DoD 尚未全部满足

当前未完成项主要有：

1. Nightmare pacing / cadence 未达标
2. 手动 smoke 与 taste sign-off 未完成
3. `buff / damageType` 的人工合同验证未完成
4. 三职业 parity 仍缺手动样本

### 5.2 架构预算没有按最初计划兑现

路线图最初硬约束是：

1. `DungeonScene.ts <= 1500`
2. `MetaMenuScene.ts <= 650`
3. `HudContainer.ts <= 450`

而当前 `origin/main` 实际体量为：

1. `DungeonScene.ts = 4301`
2. `MetaMenuScene.ts = 1152`
3. `HudContainer.ts = 1158`

这说明实际执行过程中，项目采用的是：

`目标预算 + debt ceiling no-regression`

而不是路线图里写的“压回目标预算”。

更重要的是，当前 `DungeonScene.ts` 已重新高于脚本中的临时 debt ceiling `4286`，说明这条 no-regression gate 和主干现状已经再次发生漂移。

### 5.3 文档状态与主干状态存在轻微漂移

1. 某些阶段文档仍写着 `Branch implemented on ...`，没有更新成“已 merge 到 main”的视角。
2. `6.0` 阶段文档仍引用 worktree 绝对路径作为输出物，协作可读性较差。
3. release 文档存在于 `origin/main`，但当前本地 checkout 若未同步主干，会误判为“release 目录为空”。

### 5.4 6.1 / 6.2 的证据闭环弱于 6.5

1. `6.0` 有 closeout 文档。
2. `6.5` 有 evidence pack 与 release docs。
3. 但 `6.1`、`6.2` 更多是“代码完成 + PR 通过”，缺少统一的阶段 closeout 文档。

---

## 6. 遗留技术债

### 6.1 架构债

1. `DungeonScene` 仍是高耦合 God object。
2. `HudContainer` 与 `MetaMenuScene` 仍远高于原始目标预算。
3. 当前门禁已经从“结构改善”退化成“防继续膨胀”。

### 6.2 证据债

1. Nightmare pacing/cadence 还要继续回压。
2. release/taste/engineering 人工签署未完成。
3. `buff / damageType` 的人工录像验证未归档。
4. threshold registry 仍主要引用仓内源码路径，而不是长期归档证据。

### 6.3 仿真与校准债

1. `hard-average`、`nightmare-optimal` 依赖场景级 calibration override。
2. heuristic simulator 与 real runtime 仍有可见漂移。
3. spike amplitude scorer 与 itemTradeoff scorer 仍偏启发式，需要后续进一步校准。

### 6.4 持久化与恢复债

Phase 6 多个阶段都修过 save/restore：

1. synergy 恢复重复记账
2. monster move speed / active buffs 回放
3. legacy telemetry snapshot 兼容
4. prompt state / boss reward compare queue 恢复

这说明 save/resume 已明显改善，但仍属于高耦合、易回归的脆弱区域。

### 6.5 文档债

1. 阶段文档存在分支态、worktree 绝对路径与主干态混写的问题。
2. 缺少一份在主干长期保存的最终总览性总结文档。

---

## 7. 最终判断

如果按“开发是否完成”判断：

`Phase 6 已完成开发。`

如果按“路线图是否完全签署”判断：

`Phase 6 尚未完全签署。`

### 7.1 建议的状态定义

最合适的状态标签应为：

`Phase 6: Feature Complete / Automation Pass / Sign-off Pending`

### 7.2 关闭 Phase 6 前仍需补的最小动作

1. 完成 `S6-05` 三职业 parity 手动样本与录像
2. 完成 `S6-07` 中 `buff / damageType` 的手动验证与录像归档
3. 处理 Nightmare `P50` 与 `active cadence` 越界
4. 重新核对 architecture budget script 与当前主干体量，修正文档/门禁漂移
5. 把阶段文档中的 worktree/branch 叙述收敛到主干态
6. 完成 Engineering / Taste / Release Owner 三方签署

---

## 8. 建议的后续动作

### 8.1 若目标是“正式关闭 Phase 6”

优先顺序建议为：

1. 先补人工验证与录像
2. 再回压 Nightmare pacing/cadence
3. 最后完成签署表与文档归档

### 8.2 若目标是“进入 Phase 7”

建议先把以下内容作为 Phase 6 carry-out checklist 处理完：

1. `Nightmare pacing` 调优
2. `buff / damageType` 录像验收
3. `architecture budget gate` 与当前主干对齐
4. `phase6 docs` 主干态清洗

否则会把 Phase 6 的发布债与架构债直接滚入 Phase 7。
