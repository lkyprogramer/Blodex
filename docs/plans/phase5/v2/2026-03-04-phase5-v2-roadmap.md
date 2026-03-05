# Phase 5 V2 总体执行路线图（统一入口）

**日期**: 2026-03-04  
**状态**: Active  
**适用分支**: `main`

---

## 1. 直接结论

Phase 5 V2 保持原执行顺序（先规则与架构，后体验与发布），但从 5.1 开始将 taste 作为阶段硬门禁，不再只以技术正确作为出口。

Phase 5 签名体验口径：

`15 分钟 5 层地牢；每层至少 1 次关键构筑选择；每 2 层至少 1 次战力跃迁。`

---

## 2. 全局硬约束

1. 不考虑存档兼容，允许直接重构 `RunState/Save/Meta` 结构。
2. 不允许业务逻辑回流 `DungeonScene/MetaMenuScene/HudContainer`。
3. 架构终态预算保持：
   - `DungeonScene.ts <= 1500`
   - `MetaMenuScene.ts <= 650`
   - `HudContainer.ts <= 450`
4. 新增音频资源必须走 `audio-plan -> audio-manifest -> assets:audio:validate`。
5. 手动冒烟默认优先使用金手指（debug cheats）快速覆盖关键链路。

---

## 3. Taste 四条硬门禁（5.1 起生效）

1. 构筑分歧：至少 3 条可运行 archetype，且输出/生存/节奏有可观测差异。
2. 战斗节奏：战斗需持续出现主动决策窗口，避免长时间被动观看。
3. 心跳时刻：每局至少 3 次峰值反馈（关键掉落/升级/击杀/分支）。
4. 再来一局钩子：结算时给出可执行的下一局不同路径。

---

## 4. 阶段顺序（5.0 ~ 5.7）

1. `5.0` 语义基线冻结与契约统一（已完成）
2. `5.1` 致命规则修复 I：物品与战斗语义 + 构筑骨架（P0）
3. `5.2` 致命规则修复 II：AI 空间一致性与怪物词缀归一 + 战斗节奏基线（P0/P1）
4. `5.3` 进度与经济闭环修复 + 高价值选择注入（P1）
5. `5.4` 架构地基收敛 + Taste 运行时边界固化（P0）
6. `5.5` 体验增强重基线 + 心跳时刻表达层（P1）
7. `5.6` 深度扩展与真实平衡评估 + 再来一局钩子（P1/P2）
8. `5.7` 发布收口与 DoD（含 taste 签署）（P0）

---

## 5. 子文档索引

1. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.0-baseline-contract-freeze.md`
2. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.1-fatal-rules-item-combat.md`
3. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.2-fatal-rules-ai-affix.md`
4. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.3-progression-economy-loop.md`
5. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.4-architecture-foundation-convergence.md`
6. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.5-experience-enhancement-rebaseline.md`
7. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.6-depth-expansion-and-real-balance.md`
8. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.7-release-closure-and-dod.md`

---

## 6. 统一自动化门禁

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

---

## 7. 阶段推进策略

1. 每个阶段结束必须更新 metrics 文档并绑定 commit SHA。
2. 每个 PR 必须具备可回滚路径和最小验证脚本。
3. 未完成当前阶段出口门禁（技术 + taste），不进入下一阶段。
