# Phase 5 V2 总体执行路线图（统一入口）

**日期**: 2026-03-04  
**状态**: Active  
**适用分支**: `main`

---

## 1. 直接结论

Phase 5 V2 采用“先修致命规则与架构地基，再做体验增强与发布收口”的顺序，避免在错误规则上继续堆叠功能。

核心优先级：

1. 先完成 F1/F2/F3 + A1（词缀生效、单位统一、AI 空间一致、Host 类型化）。
2. 再完成 F4/F5/F6/F8 + A2（进度经济闭环、真实平衡评估）。
3. 最后执行体验增强与发布收口。

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

## 3. 阶段顺序（5.0 ~ 5.7）

1. `5.0` 语义基线冻结与契约统一（P0）
2. `5.1` 致命规则修复 I：物品与战斗语义（P0）
3. `5.2` 致命规则修复 II：AI 空间一致性与怪物词缀归一（P0/P1）
4. `5.3` 进度与经济闭环修复（P1）
5. `5.4` 架构地基收敛（P0）
6. `5.5` 体验增强重基线（P1）
7. `5.6` 深度扩展与真实平衡评估（P1/P2）
8. `5.7` 发布收口与 DoD（P0）

---

## 4. 子文档索引

1. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.0-baseline-contract-freeze.md`
2. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.1-fatal-rules-item-combat.md`
3. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.2-fatal-rules-ai-affix.md`
4. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.3-progression-economy-loop.md`
5. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.4-architecture-foundation-convergence.md`
6. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.5-experience-enhancement-rebaseline.md`
7. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.6-depth-expansion-and-real-balance.md`
8. `docs/plans/phase5/v2/2026-03-04-phase5-v2-5.7-release-closure-and-dod.md`

---

## 5. 统一自动化门禁

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

## 6. 阶段入口策略

1. 每个阶段结束必须更新 metrics 文档并绑定 commit SHA。
2. 每个 PR 必须具备可回滚路径和最小验证脚本。
3. 未完成当前阶段出口门禁，不进入下一阶段。
