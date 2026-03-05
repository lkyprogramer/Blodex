# Phase 5 Roadmap（V2 入口）

**更新时间**: 2026-03-05  
**主入口**: `docs/plans/phase5/v2/2026-03-04-phase5-v2-roadmap.md`

---

## 1. 执行原则

1. 先修致命规则与架构地基，再做体验增强。
2. 不考虑存档兼容，允许直接重构状态结构。
3. 三大类预算终态不变：`1500 / 650 / 450`。
4. 手动冒烟默认优先使用金手指（debug cheats）。
5. 从 5.1 起 taste 与技术同级门禁，不达标不跨阶段。

---

## 2. Signature Experience（Phase 5 口径）

`15 分钟 5 层地牢；每层至少 1 次关键构筑选择；每 2 层至少 1 次战力跃迁。`

Taste 四条门禁：

1. 构筑分歧（>=3 条可运行路线）。
2. 战斗节奏（持续主动决策）。
3. 心跳时刻（每局 >=3 次）。
4. 再来一局钩子（结算可执行建议）。

---

## 3. 阶段顺序（5.0~5.7）

1. `5.0` 语义基线冻结与契约统一（已完成）
2. `5.1` 致命规则修复 I（物品与战斗语义 + 构筑骨架）
3. `5.2` 致命规则修复 II（AI 空间一致性与怪物词缀归一 + 战斗节奏基线）
4. `5.3` 进度与经济闭环修复（高价值选择注入）
5. `5.4` 架构地基收敛（Taste 运行时边界固化）
6. `5.5` 体验增强重基线（心跳时刻表达层）
7. `5.6` 深度扩展与真实平衡评估（再来一局钩子）
8. `5.7` 发布收口与 DoD（含 taste 签署）

---

## 4. 文档索引（V2）

1. `docs/plans/phase5/v2/2026-03-04-phase5-v2-roadmap.md`
2. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.0-baseline-contract-freeze.md`
3. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.1-fatal-rules-item-combat.md`
4. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.2-fatal-rules-ai-affix.md`
5. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.3-progression-economy-loop.md`
6. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.4-architecture-foundation-convergence.md`
7. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.5-experience-enhancement-rebaseline.md`
8. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.6-depth-expansion-and-real-balance.md`
9. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.7-release-closure-and-dod.md`

---

## 5. 统一门禁命令

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
