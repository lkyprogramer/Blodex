# Phase 7 汇总报告（路线图对比、完成度、差异与收口建议）

**日期**: `2026-03-09`  
**核对基线**: `origin/main@c7a28a6`  
**对照计划**: `docs/plans/phase7/2026-03-07-phase7-technical-debt-first-refactor-roadmap.md`  
**核对范围**:

1. `7.0A ~ 7.8` 全部阶段文档  
2. 已合并 PR：
   - `#56` `7.0A shell reconstruction`
   - `#57` `7.0B runsave v3`
   - `#58` `7.0C evidence registry`
   - `#59` `7.1 final sign-off`
   - `#60` `7.2 scorer / calibration governance`
   - `#61` `7.3 content entry gate`
   - `#62` `7.4 boss pipeline`
   - `#63` `7.5 boss content batch one`
   - `#64` `7.6 affix / consumable / merchant / talent`
   - `#65` `7.7 elemental / set foundations`
   - `#66` `7.8 long-run floor expansion`
3. `docs/plans/phase6/release/*` 与 `docs/plans/phase7/*`
4. 当前主干上的关键门禁脚本与架构预算状态

---

## 1. 直接结论

**Phase 7 的开发已经基本完成。经过 2026-03-09 的补救收口后，最初路线图中的高优先级文档偏差已经被补齐；当前真正剩下的核心差异主要收敛为 `7.8` 的 long-run tuning。**

更准确地说：

1. `7.0A ~ 7.7` 的主要工程目标已经基本兑现，且都已合并到 `main`。
2. `技术债优先` 这条大方向是成功的：
   - `DungeonScene / HudContainer / MetaMenuScene / MetaMenuPanel` 已压回硬预算；
   - `RunSaveV3 + restore pipeline` 已重建；
   - `Evidence / Calibration / Sign-off` 已注册中心化；
   - `Phase 6` 已完成正式签署；
   - 内容扩展按 `7.3 gate` 之后才进入，顺序没有失控。
3. 2026-03-09 补救后，以下问题已被显式收口：
   - `docs/architecture.md` 已更新到 `Phase 7` 基线
   - `7.0B` 的窄兼容例外已正式备案
   - `7.1` 的手工 evidence 已补强一轮，口径与 canonical 文档一致
   - `7.8B` 的 long-run tuning closure 已单独立项
4. 如果按“是否完成开发”判断，Phase 7 可视为 **约 `95%` 完成**。
5. 如果按“是否完全兑现原路线图所有质量出口”判断，Phase 7 当前更准确的状态是：
   - `Development Complete`
   - `Core Technical Debt Closed`
   - `Phase 6 Closure Complete`
   - `Content Expansion Complete`
   - `Long-run Tuning Pending`

---

## 2. 总体对比结论

| 维度 | 路线图承诺 | 当前状态 | 结论 |
|---|---|---|---|
| 技术债优先顺序 | 必须先做 `7.0A ~ 7.1`，再进内容扩展 | 实际执行顺序与路线图一致 | `完成` |
| 核心大文件去债 | `DungeonScene/HudContainer/MetaMenuScene` 压回硬预算，无 debt ceiling | 已压回硬预算，门禁已改为硬阈值 | `完成` |
| Save / Resume 重建 | `RunSaveV3`、严格 pipeline、状态分层 | 已完成 | `完成` |
| Evidence / Release 注册中心 | registry 成为单一事实源 | 已完成 | `完成` |
| Phase 6 正式签署 | `Signed` | 已完成 | `完成` |
| 内容扩展入口门 | 只有前置完成后才允许 `7.4+` | 已完成 | `完成` |
| 多 Boss / 内容扩展 | `7.4 ~ 7.7` 逐步展开 | 已完成 | `完成` |
| 长 run 扩展 | `8~10` 层 + 节点 + reward/pacing rebalance | `8` 层与节点已完成，但 tuning 未完成 | `部分完成` |
| 架构文档对齐 | `docs/architecture.md` 与主干结构重新对齐 | 已更新到 `Phase 7` 基线，并记录当前 closure baseline 与兼容例外 | `完成` |

---

## 3. 分阶段对账

### 3.1 `7.0A` 核心架构去债

**路线图要求**

1. `DungeonScene <= 1500`
2. `HudContainer <= 450`
3. `MetaMenuScene <= 650`
4. `MetaMenuPanel <= 450`
5. 不再依赖 debt ceiling
6. `docs/architecture.md` 与主干结构重新对齐

**当前主干事实**

1. `DungeonScene.ts = 1531`
2. `HudContainer.ts = 339`
3. `MetaMenuScene.ts = 543`
4. `MetaMenuPanel.ts = 259`
5. `scripts/check-architecture-budgets.sh` 已无 debt ceiling 分支，核心文件改为硬阈值
6. shell / host / facade 拆分已经真实落地，并通过浏览器烟测

**判断**

`7.0A` 的**代码层目标已完成**，但与原路线图存在 2 个偏差：

1. `DungeonScene` 最终收口是 `1532` 批准基线，不是最初路线图写死的 `1500`
2. `docs/architecture.md` 已在 2026-03-09 更新到 `Phase 7` 基线，并补入当前硬预算、host/facade 结构与 `RunSaveV3` 窄兼容例外

**结论**: `完成（按批准后的 closure baseline）`

---

### 3.2 `7.0B` Save / Resume 体系重构

**路线图要求**

1. `RunSaveV3`
2. `strict deserialize -> load -> derived rebuild -> ephemeral bootstrap`
3. 删除旧 migration / normalize / fallback
4. 不做 silent wipe

**当前主干事实**

1. `RunSaveV3` 已落地
2. restore pipeline 已固定
3. compare prompt、buff timeline、session state 已显式建模
4. 旧 key 会给出一次性提示后清理

**偏差**

原路线图写得非常激进：`不保留 legacy normalization / migration helper`。  
实际主干里又回补了一条非常窄的兼容分支：

1. `7.8` 扩展 `power spike pairStates` 后，为避免旧版 `V3` 存档直接失效，`save.ts` 增加了旧 `"5"` pair state -> `"5-6" / "7-8"` 的归一化

这不是旧 `V1/V2` 迁移回潮，但它确实意味着：

`7.0B` 最终落地不是“零兼容分支”，而是“仅保留极窄的 V3 内部向前兼容修正”。`

该偏差已经在 `7.0B` 阶段文档和全局架构文档中正式备案。

**结论**: `完成，带一个低风险、可接受的实现偏差`

---

### 3.3 `7.0C` Evidence / Release 基建重构

**路线图要求**

1. calibration / threshold / smoke / signoff / artifact 全部 registry 化
2. `Phase6EvidencePack` 只消费 registry
3. release docs 状态可校验

**当前主干事实**

1. `CalibrationRegistry`
2. `ThresholdRegistry`
3. `SmokeScenarioRegistry`
4. `SignoffChecklistRegistry`
5. `ReleaseArtifactIndex`
6. `phase6:evidence:check`

全部已落地并进入主干。

**结论**: `完成`

---

### 3.4 `7.1` Phase 6 最终签署收口

**路线图要求**

1. Nightmare pacing / cadence 达标
2. `S6-05`、`S6-07` 通过
3. release / taste / engineering 签署完成

**当前主干事实**

1. `Phase 6 release-readiness = Signed`
2. regression matrix 全部 `Pass`
3. Nightmare 已重新调优并重新归档 evidence

**偏差**

这里存在一个**口径收窄**：

1. 原始阶段文档的字面含义更接近：
   - `S6-05` 每职业至少一局完整 run
   - `S6-07` 一组更强的手工 runtime 样本
2. 最终主干采用的是：
   - `S6-05` = 三职业起步深度入口白盒样本，并在 2026-03-09 增补了更强的 ranger 分岔样本
   - `S6-07` = buff / damageType 运行时入口 + 代码合同交叉校验，并在 2026-03-09 增补了 `war_cry` 真实运行时样本

也就是说，`7.1` 最终是**按收窄后的签署口径完成**，而不是按最初最严格的“完整 run parity / 纯手工逐帧验证”完成。

**结论**: `完成，但验证范围仍比最初最严格的 full-run / full-manual 表述更窄`

---

### 3.5 `7.2` 评分与仿真债治理

**路线图要求**

1. `ItemTradeoffCalibrationAsset`
2. `SpikeAmplitudeCalibrationAsset`
3. policy threshold / calibration override 分离

**当前主干事实**

1. calibration asset 已建立
2. threshold governance 已建立
3. evidence / report 已走治理层

**结论**: `完成`

---

### 3.6 `7.3` 内容扩展入口门

**路线图要求**

1. 只有 `7.0A ~ 7.1` 通过，才允许内容扩展
2. content gate 必须校验架构门禁、Phase 6 签署、资源入口门

**当前主干事实**

1. `phase7:content-gate:check` 已存在
2. 架构门禁、Phase 6 readiness、回归矩阵、asset/audio plan、manifest binding 都已接入

**结论**: `完成`

---

### 3.7 `7.4 ~ 7.7` 内容扩展批次

**路线图要求**

1. `7.4` 多 Boss 管线
2. `7.5` Boss batch one
3. `7.6` affix / consumable / merchant / talent
4. `7.7` 元素体系 / set

**当前主干事实**

1. `7.4` encounter registry + dispatcher + reward binding 已完成
2. `7.5` 三个 Boss 已落地，`ossuary_keeper` 也已修到真实可达
3. `7.6` 中层内容扩展已落地
4. `7.7` element + enemy profile + set skeleton 已落地

**资源侧说明**

1. 这些阶段没有生成新的正式美术/音频资产
2. 仍基于 placeholder / 现有 manifest 运行
3. 这与路线图一致，因为文档已明确：
   - **需要 Gemini Key 时才允许真正生成美术资源**
   - 当前阶段可以先完成 runtime / placeholder / manifest / prompt 规划

**结论**: `完成`

---

### 3.8 `7.8` 长 run 与楼层扩展

**路线图要求**

1. `5 -> 8~10`
2. 中期节点成立
3. pacing model 与 reward curve 重新平衡
4. save / summary 适配更长 run

**当前主干事实**

1. story run 已扩到 `8` 层
2. `forge / gamble / guaranteed challenge / guaranteed merchant` 已进入运行时
3. `save / summary / recommendation` 已适配 `storyMaxFloor`
4. dedicated `8-floor` automation evidence 已建立
5. `jumpFloor()` 已恢复 endless 白盒验证能力

**当前主干同时明确记录了一个关键事实**

`Long-run Tuning Follow-up Required`

也就是说：

1. `7.8` 的拓扑、节点、save、summary、evidence 入口已经完成
2. 但 `8-floor` 的 reward curve / pacing 还没有达到“重新平衡完成”的质量状态
3. 当前自动化更多是在**发现 long-run 问题**，而不是证明 long-run 已经稳定

**结论**: `部分完成`

---

## 4. 差异清单、严重度与影响

| 编号 | 差异 | 严重度 | 影响 |
|---|---|---|---|
| D1 | `7.8` 的 long-run tuning 未完成，但 runtime/topology 已完成 | `HIGH` | Phase 7 不能算完全按原路线图关门 |
| D2 | `7.1` 最终签署口径仍比原始最严格表述更窄 | `MEDIUM` | 不影响主干稳定性，但影响“严格意义上的原始计划兑现度” |
| D3 | `7.0B` 回补了极窄的 V3 兼容归一化 | `LOW` | 与最初“零兼容”口径有偏差，但已正式备案 |
| D4 | `7.0A` 的 `DungeonScene` 最终 closure baseline 是 `1532`，不是最初写死的 `1500` | `LOW` | 已在阶段文档与全局架构文档内批准，不影响主干结构质量 |

---

## 5. 这些差异有多大

### 5.1 从“结构债优先”角度看

差异 **不大**。  
路线图里最关键的前半段其实是：

1. `7.0A`
2. `7.0B`
3. `7.0C`
4. `7.1`

这四段是整个 Phase 7 的核心，而它们的代码层目标都已经落地。

### 5.2 从“发布质量完全闭合”角度看

差异 **中等**。  
因为 `7.8` 的 runtime 已经扩展完成，但长线 reward/pacing 没有真正收敛到新质量门禁里。

这意味着：

1. Phase 7 的**工程重构与内容拓扑**已经完成
2. Phase 7 的**长线质量收官**还没有完成

### 5.3 从“文档与事实一致性”角度看

差异已从 **中等偏大** 收敛到 **中等**。  
`docs/architecture.md`、`7.0B` 兼容例外备案、`7.1` 手工 evidence 索引这几类 canonical 文档偏差已在 2026-03-09 被补齐。

---

## 6. 解决这些差异的完整方案

### 6.1 `P0`：补齐全局架构基线文档

**目标**

把 `docs/architecture.md` 从 `Phase 4` 叙事更新到 `Phase 7` 实际主干结构。

**当前状态**

`已完成`

**已完成内容**

1. 更新标题、更新时间和适用范围
2. 反映 `7.0A` 后的新结构：
   - `DungeonScene` shell
   - `DungeonSessionFacade`
   - save / evidence / compare / overlay 协调器
3. 删除旧 debt ceiling 描述
4. 把当前真实预算阈值写成新基线：
   - `DungeonScene <= 1532`
   - `HudContainer <= 450`
   - `MetaMenuScene <= 650`
   - `MetaMenuPanel <= 450`
5. 明确 `RunSaveV3`、registry、content gate 的现状

**结果**

当前全局架构文档已不再是阻塞项。

---

### 6.2 `P0`：把 `7.8` 从“runtime complete”推进到“quality complete”

**目标**

新增一个明确的 `7.8B long-run tuning closure` 收口阶段，把长线 run 的质量门禁单独签完。

**当前状态**

`已立项，但未完成`

**建议工作项**

1. 冻结 `8-floor` 的 quality targets：
   - `runDurationP50/P90`
   - `avgFloorReached`
   - `clearRate`
   - `rareShare`
   - `pairSatisfactionRate`
2. 基于 `phase7LongRunEvidence` 当前输出，逐项调：
   - floor 5~8 的怪物密度
   - 事件/商人 cadence
   - fallback / spike 预算
   - mid-run node 奖励带宽
3. 新增 `Phase7LongRunEvidencePack` 或等价文档资产
4. 把 `7.8` 文档状态从：
   - `Long-run Tuning Follow-up Required`
   改成：
   - `Long-run Quality Signed`

**为什么这是 P0**

因为这是唯一还会影响 Phase 7 “是否真正完成”的功能性差异。

---

### 6.3 `P1`：决定是否补强 `7.1` 的严格签署口径

当前主干已经签完，并且 2026-03-09 已补强一轮手工 evidence；但如果要完全贴合最初更严格的文字表述，还可以继续追加：

1. 三职业各补一局完整 run 录像/摘要
2. `war_cry / shadow_step / frost_nova` 各补一组真实 runtime 效果截图或录像

如果不做，也可以接受当前状态；但需要在后续任何 Phase 7 总结中继续保持当前真实口径：

1. `S6-05` = baseline access parity
2. `S6-07` = runtime access + code contract hybrid proof

**建议优先级**

`中优先级`

因为这不影响主干 correctness，只影响“与原始最严格措辞是否完全一致”。

---

### 6.4 `P2`：把 `7.0B` 的窄兼容分支显式备案

当前这条不是问题本身，而是**需要明确写进最终文档**。

**当前状态**

`已完成`

1. `RunSaveV3` 主体仍然是 strict schema
2. 仅对 `7.8` 扩展带来的旧 V3 `powerSpikeBudgetState["5"]` 做了窄兼容

这可以作为最终总结中的 “accepted deviation”，不需要再继续重构。

---

## 7. 建议的最终收口顺序

### 7.1 立即处理

1. 继续推进 `7.8B` 的 tuning / evidence 收口

### 7.2 然后处理

1. 重新跑并归档 `8-floor` tuning evidence
2. 关闭 `7.8B` 的 tuning follow-up 状态

### 7.3 可选增强

1. 如果要完全贴合原始措辞，再补 `7.1` 的 full-run / 更强手工 evidence
2. 在后续 release note 或最终 Phase 7 closeout 中继续引用 `7.0B` 的窄兼容备案

---

## 8. 最终判断

如果按“是否完成了 Phase 7 的开发工作”判断：

`是，已经完成。`

如果按“是否完全无偏差地兑现了 2026-03-07 路线图的全部质量出口”判断：

`还没有。`

当前最准确的总结是：

1. **技术债优先的重构目标，已经实现。**
2. **Phase 6 的正式收口，已经实现。**
3. **内容扩展 `7.4 ~ 7.7`，已经实现。**
4. **`7.8` 的运行时与治理入口，已经实现。**
5. **但 `7.8` 的长线调优与最终质量签署，仍需一个收官 follow-up。**

因此，Phase 7 当前应视为：

`Core Delivery Complete, Final Quality Closure Pending`

而不是：

`Zero-gap Fully Closed`
