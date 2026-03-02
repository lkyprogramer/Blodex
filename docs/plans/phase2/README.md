# Phase 2（4A/4B/4C）PR 级实施总览（修订版）

**日期**: 2026-03-02  
**目标**: 在不破坏现有 Core/Client 架构边界的前提下，将 Phase 2 设计收敛为可直接拆 PR 实施的规范。  
**范围**: `4A Save + Talent`、`4B Blueprint + Mutation + WeaponType`、`4C Branching + Skills + Synergy + Endgame`。

---

## 1. 修订目的

本次修订重点解决原方案中的开发落地问题：

1. 存档恢复同态不足（恢复后状态漂移）
2. 4A/4B 字段命名不一致、迁移边界不清晰
3. 分支楼梯/无尽模式与现有 `RunState`、`StaircaseState`、`maxFloors` 契约冲突
4. 武器远程投射物复杂度被低估，缺少分期策略
5. Hidden/Challenge 房与当前 `DungeonLayout` 表达能力不匹配
6. Daily/Endless 规则与经济平衡存在可刷漏洞与语义冲突

本目录文档已按上述问题逐条落地到 PR 级别条目。

---

## 2. 全局硬约束

1. **确定性优先**：所有 procgen/loot/combat/skill/event 分流 RNG，禁止跨流消费。
2. **Schema 迁移幂等**：`MetaProgression` 迁移必须可重复执行且不重复扣/加资源。
3. **边界不破坏**：`packages/core` 不依赖 Phaser；`apps/game-client` 不承载业务判定。
4. **兼容优先于优雅**：跨阶段保留兼容字段，待 Phase 2 完整收敛后再清理。
5. **先契约后玩法**：每个子阶段先改 types + migration + tests，再接 UI/内容。
6. **反刷防护内建**：Abandon、Daily、Endless 都必须给出反刷规则与验收用例。
7. **命名冻结**：4B 起蓝图/变异字段统一为 `blueprintFoundIdsInRun`、`selectedMutationIds`，禁止同义别名继续扩散。

---

## 3. Schema 与版本路线图

| 维度 | 当前 | 4A | 4B | 4C |
|------|------|----|----|----|
| `MetaProgression.schemaVersion` | `2` | `3` | `4` | `5` |
| `Run Save schemaVersion` | N/A | `1` | `1`（向后兼容扩展字段） | `2`（分支/无尽字段） |
| 核心新增 | Save + Talent | Blueprint + Mutation + WeaponType | BranchPath + Synergy + Daily + Endless |

说明：
- 4B 不升级 run-save 版本号，采用可选字段前向兼容；
- 4C 因 `StaircaseState`、`RunState`、`Daily/Endless` 增量较大，升级 run-save 到 v2。

---

## 4. 执行顺序（不可打乱）

1. **4A 必须先完成并稳定**（含 run-save 恢复同态测试）
2. **4B 在 4A 之上叠加**（先 Blueprint/Mutation，再 WeaponType）
3. **4C 最后实施**（先 Path，再 Skill/Synergy，最后 Daily/Endless）

原因：
- 4B/4C 都依赖 4A 的 schema 与 UI 主菜单骨架。
- 4C 的路径分支和无尽会改变 run 生命周期，不宜在 save 不稳定时并行推进。

---

## 5. PR 批次总览

### 4A（P0/P1）
- `PR-4A-01`：`Meta v2 -> v3` 迁移与 Talent 契约
- `PR-4A-02`：`RunSave v1` 契约与 core 序列化
- `PR-4A-03`：客户端 SaveManager（自动保存/恢复/多标签锁）
- `PR-4A-04`：Resume/Abandon 流程与 crash-safe 清理
- `PR-4A-05`：Talent 应用链路（stats/slots/economy）
- `PR-4A-06`：4A 集成测试与验收门禁

### 4B（P2/P4）
- `PR-4B-01`：`Meta v3 -> v4` 与 Blueprint 契约
- `PR-4B-02`：Blueprint 掉落/拾取/锻造闭环
- `PR-4B-03`：Mutation 解锁、槽位、效果执行链路
- `PR-4B-04`：WeaponType 第一阶段（数值与近战机制）
- `PR-4B-05`：WeaponType 第二阶段（可选投射物，feature flag）
- `PR-4B-06`：Hidden Room/Soul Forge/Mutation UI 与测试

### 4C（P3/P5）
- `PR-4C-01`：`RunSave v1 -> v2` 与 Path 契约改造
- `PR-4C-02`：双楼梯分支与分支收敛（Floor2->3->4->5）
- `PR-4C-03`：Challenge Room 与奖励/失败分支
- `PR-4C-04`：技能扩展（15 技能）与升级机制
- `PR-4C-05`：Synergy 引擎与百科持久化
- `PR-4C-06`：Endless 模式（含经济上限）
- `PR-4C-07`：Daily Challenge（单次计分规则）
- `PR-4C-08`：4C 全量回归与平衡基线

---

## 6. 全局测试与验收门禁

每个 PR 至少满足：

1. **Type check**：`pnpm -r typecheck`
2. **Core tests**：`pnpm --filter @blodex/core test`
3. **Client tests**：`pnpm --filter @blodex/game-client test`

Phase 2 总体验收新增硬门禁：

1. 固定 seed + 固定输入下，resume 前后 `RunSummary` 一致
2. 任意版本 meta/run-save 迁移幂等（重复迁移无副作用）
3. Daily 奖励同一天不可重复领取
4. Endless 收益在高层有软上限，无法线性刷爆

---

## 7. 文档索引

- [4A：存档系统 + 天赋树（PR 级）](./phase2-4a-save-and-talents.md)
- [4B：蓝图 + 变异 + 武器类型（PR 级）](./phase2-4b-blueprints-mutations-weapons.md)
- [4C：分支路径 + 技能扩展 + 协同系统（PR 级）](./phase2-4c-paths-skills-synergies.md)
