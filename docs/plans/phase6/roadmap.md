# Phase 6 Roadmap（入口）

**更新时间**: 2026-03-06  
**主入口**: `docs/plans/phase6/2026-03-06-phase6-roadmap.md`

---

## 1. Phase 6 主题

1. 把 Phase 5 已经搭好的 progression / taste / reward 骨架，转成玩家可感知的体验层。
2. 补齐三个缺口：
   - `choice` 有骨架但缺玩家代理权；
   - `spike` 有概率但缺保底与幅度；
   - `taste` 有记录但缺 run 内消费者。
3. 在不重写战斗系统的前提下，提升战斗节奏与技能占比，避免 run 的 70% 时间仍停留在“看自动攻击”。
4. 收口 Phase 5 留下的契约漂移与架构债，包括 `damageOverTime`、`boss reward runtime`、`Host Port typing`。
5. 资源口径同步冻结：6.3 的专属音频 cue 视为硬增量，视觉资源默认优先复用现有 `VFXSystem`，仅允许少量可选增强。
6. 补齐已有系统空洞：`buff/debuff` runtime 闭环、`physical/arcane` 最小差异化、`synergy` 激活反馈。

---

## 2. Signature Experience（Phase 6 口径）

`15 分钟 5 层地牢；每层至少 1 次玩家可感知的关键构筑选择；每 2 层至少 1 次玩家可感知且达到最低幅度标准的战力跃迁。`

新增 Phase 6 Taste 口径：

1. 关键选择必须由玩家显式作出，而不是后台自动分配。
2. 战力跃迁必须同时满足结算真实生效、运行时可记录、表现层可感知。
3. 战斗节奏必须在不引入完整主动防御重写的前提下，显著提高技能与主动输入占比。
4. run-end diagnosis 保留，但必须补齐 run 内 build 成型与关键掉落反馈。

---

## 3. 阶段顺序（6.0 ~ 6.5）

1. `6.0` 基线冻结、观测补线与架构边界收口
2. `6.1` 玩家代理权、战斗节奏与职业起步深度
3. `6.2` 战力跃迁保底、跃迁幅度与 Boss 奖励闭环
4. `6.3` 心跳时刻表达层与装备比较反馈
5. `6.4` 属性 trade-off、语义修复与装备权衡
6. `6.5` Pacing 调优、验证证据与发布签署

---

## 4. 文档索引

1. `docs/plans/phase6/2026-03-06-phase6-roadmap.md`
2. `docs/plans/phase6/2026-03-06-phase6-6.0-baseline-observability-and-architecture-closure.md`
3. `docs/plans/phase6/2026-03-06-phase6-6.1-combat-tempo-choice-agency-and-arcanist-parity.md`
4. `docs/plans/phase6/2026-03-06-phase6-6.2-power-spike-guarantee-magnitude-and-boss-reward-closure.md`
5. `docs/plans/phase6/2026-03-06-phase6-6.3-heartbeat-expression-and-equipment-compare-feedback.md`
6. `docs/plans/phase6/2026-03-06-phase6-6.4-attribute-tradeoff-semantic-repair-and-item-choice.md`
7. `docs/plans/phase6/2026-03-06-phase6-6.5-pacing-tuning-release-closure-and-taste-signoff.md`

后续如需拆分子阶段文档，沿用 `phase5/v2` 的命名方式追加。

Phase 6 之外的内容广度遗留项已单独沉淀到 `docs/plans/phase7/2026-03-06-phase7-carryover-backlog.md`。
