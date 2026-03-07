# Phase 7 遗留扩展池（已并入完整路线图，保留为历史记录）

**日期**: 2026-03-06  
**状态**: Archived  
**当前主入口**: `docs/plans/phase7/2026-03-07-phase7-technical-debt-first-refactor-roadmap.md`

---

## 1. 当前用途

本文件不再是 Phase 7 的执行主文档。

它保留的原因只有两个：

1. 作为 `2026-03-07` 完整路线图的历史输入
2. 作为内容扩展池的来源记录

当前应以：

`docs/plans/phase7/2026-03-07-phase7-technical-debt-first-refactor-roadmap.md`

作为唯一执行基线。

---

## 2. Phase 7 启动前提

截至 `2026-03-07`，这些前提不应再被当作“纯主观判断”，而应按明确证据核对。

| 前提 | 当前状态 | 验证 / 证据 | 说明 |
|---|---|---|---|
| `buff/debuff` 已在实机 runtime 中真实生效 | `已满足` | `packages/content/src/buffs.ts`、`packages/core/src/buff.ts`、`apps/game-client/src/scenes/DungeonScene.ts` 的 player/monster buff refresh 链路；`S6-07` 仅剩人工录像签署 | 这项已不是“功能未做”，而是“人工 sign-off 待补” |
| `physical / arcane` 已形成最小差异化 | `部分满足` | `packages/core/src/combat.ts` 的 `ARMORED_ARCANE_DAMAGE_MULTIPLIER / ARMORED_PHYSICAL_DAMAGE_MULTIPLIER`；`packages/core/src/__tests__/combat.contract.test.ts` 中 armored 差异用例 | 当前差异化范围主要限于 `armored` affix，不等于完整元素体系 |
| `damageOverTime` 已完成语义收口 | `已满足` | `6.4` 文档与主干实现，已收口为 `skillBonusDamage` | 已从“语义漂移”转为“显式新语义” |
| `synergy activated` 已有玩家侧反馈 | `已满足` | `docs/plans/phase6/release/2026-03-07-phase6-browser-smoke-report.md`、`S6-07` 说明 | browser smoke 已确认 `forceSynergy()` 反馈链路 |
| `boss reward runtime` 已闭环 | `已满足` | `bossRuntimeModule` 测试 + browser smoke 报告 `B8/B9` | 运行时闭环与 compare prompt 已补齐 |
| `15 分钟 5 层` 节奏合同已经可验证 | `未满足` | `docs/plans/phase6/release/2026-03-06-phase6-performance-compare.md`、`docs/plans/phase6/release/2026-03-06-phase6-release-readiness.md` | Normal/Hard 基本达标，但 Nightmare `P50` 与 `active cadence` 仍未达标 |

当前判断应改成：

1. 前 `5` 条属于“开发闭环已基本完成”。
2. 第 `6` 条仍是启动内容扩展前的真正阻塞项。
3. 因此旧的 content backlog 只能在 Phase 6 完成正式签署后再启动。

如果把这些前提重新当作“功能尚未存在”，会误导后续执行者重复做已经完成的工作。

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

## 6. 与当前路线图的编号关系

为避免与技术债优先路线图的 `7.0A ~ 7.3` 冲突，本文件原先设想的内容扩展编号现已统一并入主路线图中的：

1. `7.4` 多 Boss 管线与 encounter 编排
2. `7.5` Boss 内容批次一
3. `7.6` 怪物 affix / consumable / merchant 扩充
4. `7.7` 元素体系与 set 系统
5. `7.8` 长 run 与楼层扩展

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

补充说明：

1. 本文件现在是“内容扩展池归档”，不是“下一步直接执行计划”。
2. 实际执行顺序与编号应完全以 `2026-03-07-phase7-technical-debt-first-refactor-roadmap.md` 为准。
