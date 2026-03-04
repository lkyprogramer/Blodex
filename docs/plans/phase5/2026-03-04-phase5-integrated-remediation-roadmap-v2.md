# Phase 5 整合修复执行方案（V2）

**日期**: 2026-03-04  
**状态**: 当前 Phase 5 主执行方案（替代旧主计划）  
**适用分支**: `main`

> 状态说明（2026-03-04 更新）：本文件已拆分为 `docs/plans/phase5/v2/` 下的阶段文档集，请以 `docs/plans/phase5/v2/2026-03-04-phase5-v2-roadmap.md` 作为执行入口。

---

## 1. 直接结论

Phase 5 从本版开始调整为“先修地基，再做体验增强”的顺序，优先处理已核实的致命缺陷，再推进架构收敛和体验升级。

本方案整合并替代以下来源的冲突与分散内容：

1. `docs/plans/phase5/roadmap.md`
2. `docs/plans/phase5/2026-03-04-phase5-deep-review-and-roadmap.md`
3. `docs/plans/phase5/2026-03-04-phase5-0~5-7-*.md`
4. `docs/plans/phase5/2026-03-04-fatal-flaws-deep-retrospective.md`

---

## 2. 核实后问题矩阵（输入）

| 编号 | 问题 | 核实结论 | 处理优先级 |
|---|---|---|---|
| F1 | Special affixes 未进入核心结算 | 成立（核心战斗链路未消费，只有少量外围消费） | P0 |
| F2 | `critChance` 单位不一致 | 成立 | P0 |
| F3 | 怪物 AI 无 walkable 约束 | 成立 | P0 |
| F4 | 护甲线性减伤扩展性差 | 成立 | P1 |
| F5 | 掉落楼层分层弱 | 部分成立（机制有，内容配置不足） | P1 |
| F6 | 升级无属性选择 | 成立 | P1 |
| F7 | `vampiric/splitting` 在 core 空壳 | 部分成立（客户端有实现，core 无规则归一） | P1 |
| F8 | biome `lootBias` 未生效 | 成立 | P1 |
| A1 | RuntimeModule 依赖 `Record<string, any>` | 成立 | P0 |
| A2 | balance 模拟非真实战斗模型 | 成立 | P1 |

---

## 3. 硬约束（本版）

1. **不考虑任何存档兼容**：允许直接调整 `RunState/Save/Meta` 结构，不保留旧 schema 分支。
2. 所有新增/变更规则必须有自动化测试，禁止“只改 UI 文案就视为完成”。
3. 不允许新增业务逻辑回流 `DungeonScene/MetaMenuScene/HudContainer`。
4. 继续执行预算终态：
   - `DungeonScene.ts <= 1500`
   - `MetaMenuScene.ts <= 650`
   - `HudContainer.ts <= 450`
5. 新增音频资源必须进入 `audio-plan -> audio-manifest -> assets:audio:validate`。
6. 手动冒烟默认优先使用金手指（debug cheats）快速覆盖关键链路。

---

## 4. 新的阶段顺序（5.0 ~ 5.7）

### 4.0 语义基线冻结与契约统一（P0）

**目标**：统一数值单位、规则口径、测试口径，避免后续修复建立在错误基线上。

**关键项**：

1. 冻结“属性单位字典”（尤其 `critChance` 必须是小数）。
2. 定义 `ItemSpecialAffixKey -> 结算通道` 映射表。
3. 建立 Phase5 修复矩阵与验收模板（每项对应测试、命令、手动场景）。

**建议 PR**：

1. PR-5.0-01 单位与规则契约文档冻结。
2. PR-5.0-02 关键基线测试补齐（stats/combat/loot/ai）。
3. PR-5.0-03 质量门禁接入（包含 coverage 与架构预算）。

**出口门禁**：

1. 单位字典与代码一致。
2. 回归命令可一键执行。
3. `pnpm ci:check` 通过。

---

### 4.1 致命规则修复 I：物品与战斗语义（P0）

**目标**：修复 F1 + F2，恢复“刷装备有意义”的核心循环。

**关键项**：

1. 将 affix `critChance` 全量改为小数刻度（例如 `0.01`）。
2. 新增 `resolveSpecialAffixTotals(equipment)`，统一聚合 special affix。
3. 在战斗/技能/收益管道显式消费以下 special affix：
   - `lifesteal`, `critDamage`, `aoeRadius`, `damageOverTime`
   - `thorns`, `healthRegen`, `dodgeChance`
   - `xpBonus`, `soulShardBonus`, `cooldownReduction`
4. HUD 展示值与实际结算值统一（禁止“显示有、结算无”）。

**建议 PR**：

1. PR-5.1-01 critChance 单位统一（content + tests）。
2. PR-5.1-02 special affix 聚合层与接口。
3. PR-5.1-03 combat/skill/reward 消费接入与回归。

**出口门禁**：

1. 10 个 special affix 至少 1 条自动化用例覆盖。
2. 随机掉落与 unique 固定词缀结算一致。
3. 核心战斗回归通过。

---

### 4.2 致命规则修复 II：AI 空间一致性与怪物词缀归一（P0/P1）

**目标**：修复 F3 + F7，恢复空间博弈真实性，消除 core/runtime 分裂。

**关键项**：

1. AI 移动接入 `walkable` 校验与回退策略。
2. 对 `vampiric/splitting` 建立统一规则钩子，避免多处分散实现。
3. 近战/远程/支持型 AI 在障碍环境下保持行为稳定。

**建议 PR**：

1. PR-5.2-01 AISystem 可走性约束与测试。
2. PR-5.2-02 vampiric/splitting 规则归一（core-first）。
3. PR-5.2-03 场景链路回归（战斗、掉落、分裂子体）。

**出口门禁**：

1. 怪物不能穿墙。
2. 吸血/分裂行为在普通击杀与技能击杀路径一致。
3. 关键 AI 测试覆盖通过。

---

### 4.3 进度与经济闭环修复（P1）

**目标**：修复 F4 + F5 + F8 + F6，建立“成长有选择、掉落有分层、biome 有个性”。

**关键项**：

1. 护甲改为百分比减伤公式（含 K 值调参）。
2. 重排 loot table 的 `minFloor` 与权重带。
3. `rollItemDrop` 接入 biome `lootBias` 权重修正。
4. 升级加入属性选择（2~3 选 1），并同步处理 DEX 过强问题。

**建议 PR**：

1. PR-5.3-01 护甲公式替换与数值回归。
2. PR-5.3-02 掉落楼层分层重配。
3. PR-5.3-03 biome lootBias 接入。
4. PR-5.3-04 升级属性选择与属性平衡修正。

**出口门禁**：

1. Floor 1~5 掉落分布有明显分层。
2. biome 间掉落槽位分布可观测差异。
3. 升级选择真实影响后续战斗表现。

---

### 4.4 架构地基收敛（P0）

**目标**：落实 A1 与既定“超大类瘦身”目标，杜绝“假拆分”。

**关键项**：

1. 为 RuntimeModule 定义显式 Host Port 接口，逐步清零 `Record<string, any>`。
2. 按既定目标拆分 `DungeonScene/MetaMenuScene/HudContainer`。
3. 强化架构检查脚本：体量预算 + 禁止回流规则。

**建议 PR**：

1. PR-5.4-01 Host Port 类型化改造。
2. PR-5.4-02 三大类 A/B/C 分段压线。
3. PR-5.4-03 架构门禁收紧与白名单清理。

**出口门禁**：

1. `scenes/dungeon/*` 中 `Record<string, any>` 清零。
2. 体量阶段目标达成，最终目标不变（`1500/650/450`）。
3. 无新增跨层耦合违规。

---

### 4.5 体验增强重基线（P1）

**目标**：在前述地基修复完成后，执行原 5.2~5.5 的体验增强项，避免“表面优化掩盖规则缺陷”。

**关键项**：

1. 移动与可达性（走廊宽度、容错、输入模型）。
2. 战斗触感（hitstop、击退、数字分层、SFX 变体）。
3. 地牢拓扑升级（MST + 回边 + deterministic）。
4. 氛围与可读性（粒子、ambient loop、新手提示、fallback）。

**建议 PR**：

1. PR-5.5-01 Mobility（原 5.2）。
2. PR-5.5-02 Combat Feel（原 5.3）。
3. PR-5.5-03 Topology（原 5.4）。
4. PR-5.5-04 Atmosphere/Readability（原 5.5）。

**出口门禁**：

1. 可达性、触感、可读性三条链路全部回归通过。
2. 视觉与音频资源链路校验通过。

---

### 4.6 深度扩展与真实平衡评估（P1/P2）

**目标**：执行原 5.6 深度扩展，并修复 A2（平衡模拟可信度）。

**关键项**：

1. 路径分支、祝福系统、事件联动落地。
2. 构建“真实规则驱动”的离线平衡仿真（调用真实 combat/loot/ai 组件）。
3. 将当前 heuristic 模拟降级为探索用途，不作为最终平衡结论来源。

**建议 PR**：

1. PR-5.6-01 路径与祝福系统。
2. PR-5.6-02 事件联动与状态可解释性。
3. PR-5.6-03 真实平衡仿真管线与报告。

**出口门禁**：

1. 深度系统可运行可验证。
2. 平衡报告可由真实规则复现。

---

### 4.7 发布收口与 DoD（P0）

**目标**：将 Phase 5 收敛为可发布基线。

**关键项**：

1. 全量自动化门禁与手动回归执行。
2. 最终预算、性能、质量、资源链路冻结。
3. 发布文档与回滚手册签署。

**出口门禁**：

1. `DungeonScene/MetaMenuScene/HudContainer` 达标。
2. F1~F8/A1/A2 全部关闭或有豁免单。
3. 资源链路（图片+音频）校验通过。
4. 发布材料齐全。

---

## 5. 旧方案映射（避免执行混乱）

| 旧阶段文档 | 新阶段归属 |
|---|---|
| 原 5.0 基线治理 | 新 5.0 |
| 原 5.1 架构收敛 | 新 5.4 |
| 原 5.2 移动可达性 | 新 5.5 |
| 原 5.3 战斗触感 | 新 5.5 |
| 原 5.4 拓扑升级 | 新 5.5 |
| 原 5.5 氛围增强 | 新 5.5 |
| 原 5.6 深度扩展 | 新 5.6 |
| 原 5.7 发布收口 | 新 5.7 |
| fatal-flaws 反馈 | 新 5.1/5.2/5.3/5.4/5.6 |

---

## 6. 全局验证策略

### 6.1 自动化命令

```bash
pnpm quality:precheck
pnpm check:toolchain
pnpm check
pnpm test
pnpm --filter @blodex/game-client i18n:check
pnpm --filter @blodex/game-client css:check
pnpm check:content-i18n
pnpm check:source-hygiene
pnpm check:architecture-budget
pnpm assets:audio:compile
pnpm assets:audio:validate
pnpm assets:validate
pnpm ci:check
```

### 6.2 手动冒烟（统一口径）

1. 默认优先使用金手指（debug cheats）快速推进到各阶段关键节点。
2. 在规则修复阶段重点验证：词缀生效、AI 不穿墙、掉落分层、升级选择。
3. 在体验阶段重点验证：移动可达性、战斗反馈、拓扑差异、氛围可读性。
4. 在发布阶段补做非金手指复测（至少 1 轮）用于平衡体感确认。

---

## 7. 风险与止损

1. 规则改动引发连锁回归：通过“先单位统一，再规则接入”的顺序止损。
2. 架构与玩法改动互相干扰：严格按阶段串行，禁止跨阶段混改。
3. 无存档兼容前提下的字段调整失控：统一在阶段 PR 中附字段变更说明与测试。
4. 体验优化抢跑：5.5 前禁止合入表层体验 PR。

---

## 8. 本周启动建议

1. 立即启动新 5.0 与 5.1（P0）。
2. 5.2 与 5.4 并行设计，串行合入。
3. 5.3 完成后再进入 5.5 体验增强。
