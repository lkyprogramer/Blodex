# Phase 5 Roadmap（执行入口）

**更新时间**: 2026-03-04  
**主文档**: `docs/plans/phase5/2026-03-04-phase5-deep-review-and-roadmap.md`

## 0. Phase 5 大目标（North Star）

在 Phase 5 结束时，把项目从“功能已完整但结构临界”升级为“可持续演进的稳态架构”：

1. 三大临界类完成深层降维：
   - `DungeonScene.ts <= 1500`
   - `MetaMenuScene.ts <= 650`
   - `HudContainer.ts <= 450`
2. `apps/game-client/src/scenes/dungeon/*` 清零 `host: Record<string, any>`。
3. 体验增强全部建立在模块边界内，不再回流 God Class。
4. 覆盖率、预算、回归、回滚四类门禁形成闭环。
5. 新增音频资源必须进入 `audio-plan -> audio-manifest -> assets:audio:validate` 的统一治理链路。

## 1. 第一优先级（必须先做）

**P0-ARCH：三大临界类收敛**

1. `apps/game-client/src/scenes/DungeonScene.ts`
2. `apps/game-client/src/scenes/MetaMenuScene.ts`
3. `apps/game-client/src/ui/hud/HudContainer.ts`

目标：
1. 先稳住架构地基，再推进体验增强，防止 Phase 5 继续堆叠到超级类。
2. 通过模块拆分 + 门禁收紧，把“预算临界状态”拉回安全区。

阶段目标（分步压线）：
1. 阶段 A：`DungeonScene.ts <= 2300`，`MetaMenuScene.ts <= 950`，`HudContainer.ts <= 850`
2. 阶段 B：`DungeonScene.ts <= 1800`，`MetaMenuScene.ts <= 780`，`HudContainer.ts <= 620`
3. 阶段 C（Phase 5 收口）：`DungeonScene.ts <= 1500`，`MetaMenuScene.ts <= 650`，`HudContainer.ts <= 450`

## 2. 顺序路线（必须按序）

1. `5.0` 基线冻结与可观测治理  
2. `5.1` 架构底座收敛（第一优先级）  
3. `5.2` 移动与可达性基础  
4. `5.3` 战斗触感核心  
5. `5.4` 地牢拓扑升级  
6. `5.5` 氛围与可读性增强  
7. `5.6` 深度扩展  
8. `5.7` 发布收口与 DoD

## 2.1 子阶段文档索引（5.0~5.7）

1. `docs/plans/phase5/2026-03-04-phase5-0-baseline-freeze-and-observability-governance.md`
2. `docs/plans/phase5/2026-03-04-phase5-1-foundation-convergence-and-god-class-reduction.md`
3. `docs/plans/phase5/2026-03-04-phase5-2-mobility-and-reachability-p0.md`
4. `docs/plans/phase5/2026-03-04-phase5-3-combat-feel-core-p0-p1.md`
5. `docs/plans/phase5/2026-03-04-phase5-4-dungeon-topology-upgrade-p1.md`
6. `docs/plans/phase5/2026-03-04-phase5-5-atmosphere-and-readability-enhancement-p1.md`
7. `docs/plans/phase5/2026-03-04-phase5-6-depth-expansion-p2.md`
8. `docs/plans/phase5/2026-03-04-phase5-7-release-closure-and-dod.md`

## 3. 启动顺序（当前）

1. 先做 `5.0-01/02`（基线与 coverage gate）。
2. 立即做 `5.1-01/02/03/04`（三大类收敛 + 门禁收紧）。
3. 然后做 `5.2-01/02`（走廊加宽 + clamp 扩容）。

## 4. 里程碑验收（与大目标对齐）

1. M1（5.0 + 5.1-A）：
   - 度量与门禁上线
   - 三大类从临界线拉回安全区第一档
2. M2（5.1-B + 5.2 + 5.3）：
   - 三大类进入中位稳态
   - 移动与战斗手感完成核心闭环
   - 5.3 如新增 SFX 变体，完成音频清单同步与校验
3. M3（5.4 + 5.5 + 5.6 + 5.7）：
   - 三大类达到终态压线
   - 地牢拓扑与中后期深度落地
   - 发布资料与回滚演练齐备
   - 5.5/5.7 的 biome ambient 与音频资产门禁留证据

## 5. 执行约束

1. 每个 PR 必须可回滚、可验证，不做大爆炸改造。
2. 不允许新增业务逻辑回流到上述三大类中。
3. `pnpm ci:check` 必须全程保持可通过。
4. 只要 PR 新增音频资产，必须补跑并记录 `pnpm assets:audio:compile && pnpm assets:audio:validate`。
