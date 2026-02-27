# Phase 3 按 PR 顺序任务清单

> 来源：`docs/plans/2026-02-27-phase3-experience-polish.md`
> 目标：把 3A/3B/3C/3D 方案转成可执行、可追踪、可验收的 PR 任务序列。

## 0. 使用约定

- 每个 PR 完成后必须：
  - 通过 `core/content/game-client/tooling` 对应校验命令。
  - 补齐最小测试（单测/集成/手工 smoke 证据）。
  - 记录风险与回滚开关（feature flag 或降级路径）。
- 禁止跨 PR 偷改核心规则：若涉及范围外变更，单独开补丁 PR。

---

## 1. PR 顺序总览

1. PR-3A-01 反馈事件分层与路由契约
2. PR-3A-02 VFXSystem（命中/死亡/技能反馈）
3. PR-3A-03 SFXSystem（升级 AudioSystem）
4. PR-3A-04 3A 集成收敛
5. PR-3B-01 UIManager 骨架与状态适配层
6. PR-3B-02 UI 组件化拆分
7. PR-3B-03 Minimap + Fog of War
8. PR-3B-04 UI 可访问性与移动端自适应
9. PR-3B-05 3B 集成收敛
10. PR-3C-01 Difficulty Mode 契约
11. PR-3C-02 balance.ts 仿真工具
12. PR-3C-03 平衡参数回填
13. PR-3D-01 AI 更新裁剪与空间索引
14. PR-3D-02 Pathfinding 预算与帧切分
15. PR-3D-03 粒子池与渲染裁剪
16. PR-3D-04 生命周期清理与泄漏门禁

---

## 2. 任务清单（按 PR）

## PR-3A-01 反馈事件分层与路由契约

- [ ] 新建 `apps/game-client/src/systems/feedbackEventRouter.ts`，定义 domain->feedback 映射。
- [ ] 在 `DungeonScene` 中收敛反馈触发入口，替换散落调用点。
- [ ] 在 `packages/core/src/contracts/events.ts` 补充必要 payload（如 phase/hit 元信息缺口）。
- [ ] 加入容错：路由失败不抛致命异常，仅记录 warning。
- [ ] 增加最小单测：同一 domain event 不重复触发同类反馈。
- [ ] 验收：运行一局，确认 hit/crit/death/skill/floor/bossPhase 路由全命中。

## PR-3A-02 VFXSystem（命中/死亡/技能反馈）

- [ ] 新建 `apps/game-client/src/systems/VFXSystem.ts`。
- [ ] 新建 `apps/game-client/src/systems/pools/ParticlePool.ts`。
- [ ] 接入 hit flash、knockback、crit text、death dissolve、boss phase flash。
- [ ] 在 `RenderSystem` 暴露必要 sprite/tween hook，不把 VFX 逻辑塞回 Scene。
- [ ] 增加 VFX feature flag，默认开启，可快速关闭回滚。
- [ ] 压测验证：高密度战斗下无明显 GC 峰值。

## PR-3A-03 SFXSystem（升级 AudioSystem）

- [ ] 新建 `apps/game-client/src/systems/SFXSystem.ts`，实现 combat/skill/ui/ambient 分层。
- [ ] 兼容 `AudioSystem` 现有 `play*` API（桥接或替换）。
- [ ] 完成高频事件节流（hit/crit）与随机变体策略。
- [ ] 确认浏览器 unlock 逻辑：无手势前安全静默。
- [ ] 同步音频计划：更新 `assets/source-prompts/audio-plan.yaml` 与 `assets/generated/audio-manifest.json`。
- [ ] 运行 `pnpm assets:audio:sync && pnpm assets:audio:validate`。
- [ ] 验收：无 404 音频请求、无爆音、ambient 不串场。

## PR-3A-04 3A 集成收敛

- [ ] 新增 `apps/game-client/src/systems/__tests__/feedback-router.test.ts`。
- [ ] 增加“3A 全开 vs 全关”一致性回归用例（只比较战斗结论，不比较表现）。
- [ ] 补齐日志：关键反馈触发点在 system log 可追踪。
- [ ] 输出 3A Gate 验收记录（视觉、音频、一致性三项）。

## PR-3B-01 UIManager 骨架与状态适配层

- [ ] 新建 `apps/game-client/src/ui/UIManager.ts`。
- [ ] 新建 `apps/game-client/src/ui/state/UIStateAdapter.ts`，定义 `UIStateSnapshot`。
- [ ] 将 `DungeonScene` 的 UI 入口收敛为 `uiManager.render/show*`。
- [ ] `Hud.ts` 改为 Legacy 兼容层，保留过渡期接口。
- [ ] 增加状态适配单测：snapshot 映射正确、字段不丢失。

## PR-3B-02 UI 组件化拆分

- [ ] 新建 `HudPanel/SkillBar/BossHealthBar/EventDialog/RunSummaryScreen` 组件文件。
- [ ] 调整 `index.html` 容器结构，移除强耦合 DOM 片段。
- [ ] 调整 `style.css`：统一组件布局、状态样式、层级规则。
- [ ] 组件仅接收 snapshot，不直接访问 Scene 业务对象。
- [ ] 验收：技能冷却、Boss phase、事件弹窗、summary 行为与旧版一致。

## PR-3B-03 Minimap + Fog of War

- [ ] 新建 `apps/game-client/src/ui/components/Minimap.ts`。
- [ ] 在 `RenderSystem`/Scene 提供 minimap 所需只读网格与实体快照。
- [ ] 实现视野半径 5 tile 与 explored 缓存。
- [ ] 支持玩家/怪物/loot/楼梯/事件 marker 渲染。
- [ ] 验收：切层后 fog 重置正确，minimap 更新不卡顿。

## PR-3B-04 UI 可访问性与移动端自适应

- [ ] 统一热键角标规范（图标+角标+状态文本）。
- [ ] 完成 `<=980px` 布局适配（日志/背包/技能栏可滚动可点击）。
- [ ] 预留高对比度模式 class（不改默认主题）。
- [ ] 验收：720p/1080p 可读，移动端可完成完整 run。

## PR-3B-05 3B 集成收敛

- [ ] 新增 `apps/game-client/src/ui/__tests__/ui-state-adapter.test.ts`。
- [ ] 清理 UI 迁移遗留入口，保证主入口由 UIManager 接管。
- [ ] 验证 Event/Merchant/Summary/日志协作无回归。
- [ ] 输出 3B Gate 验收记录。

## PR-3C-01 Difficulty Mode 契约

- [ ] 新建 `packages/core/src/difficulty.ts` 与 `difficulty.test.ts`。
- [ ] 扩展 `contracts/types.ts`：`DifficultyMode`、modifier 结构。
- [ ] 修改 `run.ts`：run start 固定 difficulty，不允许局中变更。
- [ ] 修改 `meta.ts` 与 `MetaMenuScene.ts`：Hard/Nightmare 解锁与选择。
- [ ] 验收：模式切换只影响配置倍率，不改 deterministic 流程。

## PR-3C-02 balance.ts 仿真工具

- [ ] 新建 `packages/core/src/balance.ts` 与 `balance.simulation.test.ts`。
- [ ] 实现 `simulateRun(config)`：clearRate/floor/hp 曲线/死亡原因/掉落分布。
- [ ] 提供 CI 可运行的 sampleSize 配置（默认小样本）。
- [ ] 增加门禁断言：normal-average 与 hard-optimal 区间。
- [ ] 输出仿真结果格式（JSON/console）供后续调参对比。

## PR-3C-03 平衡参数回填

- [ ] 更新 `floorScaling.ts/monsters.ts/lootTables.ts/unlocks.ts`，移除临时硬编码系数。
- [ ] 生成“模式差异参数表”并纳入文档（可放 `docs/plans` 附录）。
- [ ] 用 balance 门禁回归验证调参前后趋势。
- [ ] 输出 3C Gate 验收记录。

## PR-3D-01 AI 更新裁剪与空间索引

- [ ] 新建 `apps/game-client/src/systems/spatialHash.ts`。
- [ ] `EntityManager` 接入空间索引维护。
- [ ] `AISystem` 改为“近场高频、远场低频”更新策略。
- [ ] 增加性能基准对比（怪物 20/40/60）。

## PR-3D-02 Pathfinding 预算与帧切分

- [ ] 为 A* 增加短期缓存策略（同起终点复用）。
- [ ] 引入长路径分帧执行机制。
- [ ] 防止路径缓存污染：地图/阻挡变化时失效。
- [ ] 验收：连续点击移动无主线程尖峰卡顿。

## PR-3D-03 粒子池与渲染裁剪

- [ ] 在 VFXSystem 引入并发上限与低优先级丢弃策略。
- [ ] 在 RenderSystem 增加可见区域裁剪更新。
- [ ] 提供调试面板（当前粒子数/丢弃次数）。
- [ ] 验收：Boss 高压场景帧率稳定，无持续劣化。

## PR-3D-04 生命周期清理与泄漏门禁

- [ ] 统一 Scene shutdown/destroy 清理：event/tween/sound/emitter/dom listener。
- [ ] 增加开发态泄漏诊断输出（残留订阅数、音源数、粒子池占用）。
- [ ] 加入长期运行 smoke（多局切换）验证无持续内存上涨。
- [ ] 输出 3D Gate 与 Phase 3 Final Go/No-Go 记录。

---

## 3. 每个 PR 的通用回归命令

```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/core build
pnpm --filter @blodex/content build
pnpm --filter @blodex/game-client typecheck
pnpm --filter @blodex/tooling build
```

如 PR 涉及资源：

```bash
pnpm assets:compile
pnpm assets:generate
pnpm assets:audio:compile
pnpm assets:audio:sync
pnpm assets:audio:validate
pnpm assets:validate
```

---

## 4. 建议看板列（可直接映射）

1. Backlog
2. Ready (Spec Locked)
3. In Progress
4. Code Review
5. QA / Smoke
6. Done
7. Gate Evidence Archived

