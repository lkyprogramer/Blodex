# Phase 7 遗留扩展池（内容广度、Boss 与长期 Replayability）

**日期**: 2026-03-06  
**状态**: Draft  
**前置条件**: Phase 6 已完成系统补完与体验合同签署

---

## 1. 直接结论

Phase 7 不再优先解决“已有系统空转”的问题，而是承接那些已经确认重要、但不适合塞进 Phase 6 的内容扩展项。

判断标准：

1. 修“已有定义未生效”的，留在 Phase 6。
2. 加“新的内容广度和玩法体量”的，进入 Phase 7。

因此，Phase 7 的主题是：

`在已闭环的战斗与构筑系统上，增加 Boss、遭遇、内容池和长期可重复游玩的深度。`

---

## 2. Phase 7 启动前提

只有以下条件满足后，Phase 7 才建议启动：

1. `buff/debuff` 已在实机 runtime 中真实生效。
2. `physical / arcane` 已形成最小差异化，不再只是日志标签。
3. `damageOverTime` 已完成语义收口。
4. `synergy activated` 已有玩家侧反馈。
5. `boss reward runtime` 已闭环。
6. `15 分钟 5 层` 的节奏合同已经可验证。

如果这些前提不成立，Phase 7 会变成“在半空系统上继续堆内容”。

---

## 3. 遗留项分组

### 3.1 P0：Boss 与遭遇广度

1. 新增 `2~3` 个 Boss，每个都要有独立攻击逻辑、阶段切换和反馈语义。
2. 将 Boss 选择从当前单一 `bone_sovereign` 扩展为可配置池，而不是 Scene 默认绑死单个 Boss。
3. 为新 Boss 配套：
   - `BossDef`
   - `sprite / audio / feedback`
   - `dropTable`
   - `boss reward` 语义

### 3.2 P1：中层内容扩展

1. 怪物 affix 从当前基础集扩到 `8+`，优先补行为差异，而不是只加数值词缀。
2. 激活或扩充 consumable 内容池，让 `ItemKind.consumable` 不再只是类型预留。
3. Talent 从“开/关两态”扩展到更有投入感的 rank 模型。
4. 商人从随机事件增强为更稳定的遭遇节点或独立房间。

### 3.3 P2：长期深度扩展

1. 完整元素体系：
   - `physical / arcane / fire / cold / lightning`
   - 抗性、弱点、敌人画像
2. Set / 套装系统。
3. 开局 archetype 选择与更强的职业分界。
4. 地牢层数从 `5` 扩展到 `8~10`，插入中期节点。

---

## 4. 推荐排序

### 4.1 第一批

1. 多 Boss 管线与 `BossDef` 扩展。
2. 新 Boss 的内容接入与资源治理。
3. monster affix 扩充第一批。

### 4.2 第二批

1. consumable 内容池。
2. talent rank 扩展。
3. merchant 独立节点或房间。

### 4.3 第三批

1. 完整元素体系。
2. set 系统。
3. 更长 run 与更多楼层。

---

## 5. 为什么这些不放进 Phase 6

1. 新 Boss 是明显的内容广度工作，不是体验骨架闭环。
2. 完整元素体系会把最小 `physical / arcane` 差异化扩成新的大系统，超出 Phase 6 范围。
3. consumable、talent rank、merchant room 都会拉高 content / UI / economy 联调成本，不适合与 Phase 6 的体验签署并行。
4. 如果在 Phase 6 里同时做系统补完和大规模内容扩展，风险会从“可签署的体验修复”膨胀成“多系统并发改造”。

---

## 6. 建议的 Phase 7 入口文档结构

Phase 7 真正启动时，建议按以下顺序拆子文档：

1. `7.0` 多 Boss 管线与 encounter 编排
2. `7.1` Boss 内容批次一
3. `7.2` 怪物 affix / consumable / merchant 扩充
4. `7.3` 元素体系与 set 系统
5. `7.4` 长 run 与楼层扩展

---

## 7. 当前结论

暂时进入 Phase 7 的遗留项：

1. `2~3` 个新 Boss
2. 更大的 monster affix 池
3. consumable 内容激活
4. talent rank 扩展
5. merchant 独立房间或稳定节点
6. 完整元素体系
7. set 系统
8. 更强职业分化
9. `5 -> 8~10` 层的 run 扩展

这些项已被确认有价值，但都不应抢占 Phase 6 的系统补完优先级。

