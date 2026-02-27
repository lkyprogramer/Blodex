# Phase 3 体验打磨实施方案（3A/3B/3C/3D）

## Context

基于 `docs/plans/2026-02-23-long-term-roadmap-design.md` 的 Phase 3 规划，以及当前仓库状态（Phase 0/1/2 主体能力已落地：多层地牢、技能/Buff、Boss、Meta、Biome/Hazard/Event、HUD 日志、基础音频链路），Phase 3 的目标是把“可玩”提升为“可持续沉浸”。

本阶段强调：

- 不改写 core 战斗规则语义，仅增强反馈层、UI 信息架构、平衡验证与性能稳定性；
- 继续坚持 deterministic、core/client 分层和 schema 兼容；
- 用分阶段可回滚方式落地，避免一次性大改导致回归面失控。

**执行顺序（硬约束）**：

- **3A 先行**：战斗反馈管线（VFX/SFX）
- **3B 后续**：UI 体系重构（UIManager + Minimap）
- **3C 再后**：难度模式与平衡仿真
- **3D 收敛**：性能优化与发布门禁

---

## 1. 目标与边界

### 1.1 目标

- 建立事件驱动的 VFX/SFX 系统，覆盖命中/暴击/闪避/死亡/技能/Boss phase/层切换等核心反馈。
- 将当前 HUD 演进为 `UIManager` 组件化架构，支持独立模块（SkillBar、BossBar、EventDialog、RunSummary、Minimap）。
- 增加 Minimap 与 Fog of War，提升路线决策与探索可读性。
- 引入难度模式（Normal/Hard/Nightmare）并通过 `balance.ts` 做可重复的数值仿真与门禁。
- 在内容压力场景下保持稳定帧节奏，并完成对象池/可见性裁剪/路径预算治理。

### 1.2 非目标

- 不新增 Phase 2 之外的大规模新怪物/新事件池（仅允许为反馈需要补资产）。
- 不做网络化/联机/排行榜服务端化。
- 不改变持久化主 schema（可在 v2 里增字段，禁止破坏向后兼容）。
- 不把 Phaser 渲染细节下沉到 `packages/core`。

---

## 2. 前置假设（依赖现状）

| 依赖能力 | 当前路径 | 说明 |
|---|---|---|
| Typed Domain EventBus | `packages/core/src/eventBus.ts` + `contracts/events.ts` | Phase 3 所有反馈系统通过订阅实现，不侵入 core 规则 |
| 运行态编排中心 | `apps/game-client/src/scenes/DungeonScene.ts` | 仅保留“事件转发 + 生命周期管理”角色 |
| 现有 HUD 与日志 | `apps/game-client/src/ui/Hud.ts` | 作为 UIManager 迁移期适配层 |
| 现有音频链路 | `apps/game-client/src/systems/AudioSystem.ts` | 3A 会升级为分层混音与事件路由，不破坏现有触发语义 |
| 内容定义层 | `packages/content/src/*` | 3C 难度参数和门禁继续数据化 |

---

## 3. 不可协商约束

1. **Determinism First**
- VFX/SFX/UI 都是表现层副作用，不允许反向影响 core 随机流与战斗结论。
- `balance.ts` 仿真输入相同必须输出一致统计。

2. **Boundary First**
- `packages/core` 只定义状态迁移与领域事件，不引入 Phaser/DOM/WebAudio。
- `apps/game-client` 负责表现系统订阅与资源调度。

3. **Storage-safe Evolution**
- Meta 仍以 `schemaVersion = 2` 延展；新增字段必须通过 `migrateMeta` 幂等注入默认值。
- 不更名、不删除既有关键字段（`runsPlayed/bestFloor/bestTimeMs/unlocks/permanentUpgrades`）。

4. **Performance Budget**
- 普通层：`update` 平均耗时 < 8ms；Boss 高压场景 p95 < 12ms（桌面开发机基线）。
- 渲染对象和粒子数量有硬上限，超限时必须降级而非持续堆积。

5. **可回滚**
- 每个 PR 必须具备 feature flag 或可禁用入口，确保可快速退回到上一稳定状态。

---

## 4. Phase 3A — 战斗反馈系统（VFX/SFX）

### PR-3A-01: 反馈事件分层与路由契约

**新增文件**
- `apps/game-client/src/systems/feedbackEventRouter.ts`

**修改文件**
- `packages/core/src/contracts/events.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**实施内容**

1) 明确“领域事件 -> 表现事件”映射表（只在 client 侧存在）：

```typescript
type FeedbackEventName =
  | "vfx:hit"
  | "vfx:crit"
  | "vfx:dodge"
  | "vfx:death"
  | "vfx:skillCast"
  | "vfx:bossPhase"
  | "sfx:hit"
  | "sfx:crit"
  | "sfx:dodge"
  | "sfx:death"
  | "sfx:skillCast"
  | "sfx:floorEnter"
  | "sfx:biomeEnter"
  | "sfx:bossPhase";
```

2) `DungeonScene` 不直接拼装具体特效参数，改为统一发给 `feedbackEventRouter`。

3) 迁移期保持旧 `AudioSystem` 调用可用，确保行为不回退。

**验收标准**
- 同一领域事件不会触发重复 VFX/SFX。
- 路由异常不影响主循环（降级为静默，不抛致命异常）。

---

### PR-3A-02: VFXSystem（命中反馈、死亡反馈、技能反馈）

**新增文件**
- `apps/game-client/src/systems/VFXSystem.ts`
- `apps/game-client/src/systems/pools/ParticlePool.ts`

**修改文件**
- `apps/game-client/src/systems/RenderSystem.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/style.css`

**实施内容**

1) 落地基础表现：
- hit flash（50ms tint）
- knockback tween（150ms，0.3 tile）
- crit floating text（黄色、放大、短 bounce）
- death dissolve（fade + scale down）
- boss phase transition（全屏 flash + 短 slow-mo）

2) 引入对象池：
- 粒子发射器和 floating text 复用，避免高频创建 GC 峰值。

3) 为技能预留 VFX hook：

```typescript
interface SkillVfxPreset {
  skillId: string;
  emitterKey: string;
  lifeMs: number;
  tint?: number;
  scale?: number;
}
```

**验收标准**
- 大规模战斗场景下无明显卡顿尖峰。
- 关闭 VFX feature flag 后游戏逻辑与战斗结算不变。

---

### PR-3A-03: SFXSystem（升级现有 AudioSystem）

**新增文件**
- `apps/game-client/src/systems/SFXSystem.ts`

**修改文件**
- `apps/game-client/src/systems/AudioSystem.ts`（迁移适配或废弃桥接）
- `apps/game-client/src/scenes/DungeonScene.ts`
- `assets/source-prompts/audio-plan.yaml`
- `assets/generated/audio-manifest.json`

**实施内容**

1) SFX 分层混音：
- `combat`（hit/crit/dodge/death）
- `skill`
- `ui`
- `ambient`

2) 高频事件节流：
- `combat:hit` 类别最小触发间隔（70~100ms）
- 同类音效随机变体（`hit_01..03`）避免重复听感疲劳

3) 自动播放限制处理：
- 首次用户手势 unlock
- unlock 前请求安全丢弃，不报错中断

4) 兼容策略：
- 对外保留 `play*` API 语义，内部路由到 `SFXSystem`

**验收标准**
- 无刺耳爆音，无 404 音频请求。
- run 切场后 ambient 必须停止，不串场。

---

### PR-3A-04: 3A 集成收敛与回归用例

**新增文件**
- `apps/game-client/src/systems/__tests__/feedback-router.test.ts`

**实施内容**
- 验证战斗关键事件（hit/crit/dodge/death/skill/bossPhase）均可触发对应反馈。
- 验证 feature flag 关闭后仅损失表现层，不影响 core 行为。

**3A Gate**
- [ ] 核心战斗事件均有可感知反馈（视觉+音频）。
- [ ] 音频资源请求全 200，且无刺耳失真。
- [ ] 3A 全开时与全关时，战斗结论一致。

---

## 5. Phase 3B — UI/UX 体系重构

### PR-3B-01: UIManager 基础骨架与状态适配层

**新增文件**
- `apps/game-client/src/ui/UIManager.ts`
- `apps/game-client/src/ui/state/UIStateAdapter.ts`

**修改文件**
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/ui/Hud.ts`（迁移适配）

**实施内容**

1) 统一 UI 状态快照：

```typescript
interface UIStateSnapshot {
  player: PlayerState;
  run: RunState;
  floor: FloorRuntimeState;
  boss?: BossRuntimeState;
  logs: UIMessage[];
  flags: {
    runEnded: boolean;
    eventPanelOpen: boolean;
    debugCheatsEnabled: boolean;
  };
}
```

2) `DungeonScene` 只调用：
- `uiManager.render(snapshot)`
- `uiManager.showEventDialog(...)`
- `uiManager.showSummary(...)`

3) `Hud.ts` 在迁移期作为 LegacyPanel，不一次性删除。

**验收标准**
- `DungeonScene` UI 拼装代码显著下降（以模块调用替代 innerHTML 拼装）。
- UI 刷新不再依赖散落在 scene 的 DOM 操作。

---

### PR-3B-02: 组件化面板拆分（SkillBar/BossBar/RunSummary/EventDialog）

**新增文件**
- `apps/game-client/src/ui/components/HudPanel.ts`
- `apps/game-client/src/ui/components/SkillBar.ts`
- `apps/game-client/src/ui/components/BossHealthBar.ts`
- `apps/game-client/src/ui/components/EventDialog.ts`
- `apps/game-client/src/ui/components/RunSummaryScreen.ts`

**修改文件**
- `apps/game-client/index.html`
- `apps/game-client/src/style.css`

**实施内容**
- 技能栏固定到底部，统一冷却/禁用/法力不足样式。
- Boss 条置顶，包含 phase indicator。
- EventDialog 与商店对话框样式统一（可复用按钮体系）。

**验收标准**
- 组件间无业务耦合（仅消费 `UIStateSnapshot`）。
- 组件热替换/隐藏不会造成事件监听泄漏。

---

### PR-3B-03: Minimap + Fog of War

**新增文件**
- `apps/game-client/src/ui/components/Minimap.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/systems/RenderSystem.ts`

**实施内容**

1) Minimap 规则：
- 右上角固定 160x160
- 玩家白点、怪物红点（视野内）、loot 黄点、楼梯绿点、事件蓝点

2) Fog of War：
- 视野半径 5 tile
- 已探索区域保持可见（当层有效）

3) 数据源：
- 只读场景格子与实体快照，不参与 pathfinding 与战斗判定。

**验收标准**
- minimap 更新稳定，不引入主循环抖动。
- 进入下一层后 fog 状态正确重置。

---

### PR-3B-04: UI 可访问性与移动端自适应

**修改文件**
- `apps/game-client/src/style.css`
- `apps/game-client/src/ui/*`

**实施内容**
- 热键角标统一视觉层级（图标上角标 + 状态文本）。
- 移动端布局折叠策略：日志、背包、技能栏保持可滚动可点击。
- 高对比度模式预留 class（不改默认主题）。

**验收标准**
- 720p 与 1080p 下关键信息无遮挡。
- 移动端（<=980px）可完成一局基础流程。

---

### PR-3B-05: 3B 集成收敛

**新增文件**
- `apps/game-client/src/ui/__tests__/ui-state-adapter.test.ts`

**3B Gate**
- [ ] UIManager 完成主入口接管，Legacy Hud 仅保留最小桥接。
- [ ] Minimap 与 Fog of War 可用且稳定。
- [ ] Event/Merchant/Summary 与日志协作无回归。

---

## 6. Phase 3C — 难度模式与平衡仿真

### PR-3C-01: Difficulty Mode 核心契约

**新增文件**
- `packages/core/src/difficulty.ts`
- `packages/core/src/__tests__/difficulty.test.ts`

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/run.ts`
- `packages/core/src/meta.ts`
- `packages/content/src/config.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`

**实施内容**

```typescript
type DifficultyMode = "normal" | "hard" | "nightmare";

interface DifficultyModifier {
  monsterHealthMultiplier: number;
  monsterDamageMultiplier: number;
  affixPolicy: "default" | "forceOne";
  soulShardMultiplier: number;
}
```

规则：
- Normal：基线
- Hard：怪物 HP/伤害 +30%，Soul Shards +50%
- Nightmare：怪物 HP/伤害 +60%，全怪至少 1 affix，Soul Shards +100%

解锁条件：
- Hard：完成 1 次 Normal
- Nightmare：完成 1 次 Hard

**验收标准**
- 难度模式在 run start 固定，不允许局中切换。
- 结算奖励倍率与模式一致。

---

### PR-3C-02: 数值仿真工具 `balance.ts`

**新增文件**
- `packages/core/src/balance.ts`
- `packages/core/src/__tests__/balance.simulation.test.ts`

**实施内容**

```typescript
interface BalanceConfig {
  difficulty: DifficultyMode;
  playerBehavior: "optimal" | "average" | "poor";
  sampleSize: number;
  seedBase: string;
}

interface RunSimulation {
  clearRate: number;
  avgFloorReached: number;
  avgRunDurationMs: number;
  hpCurveP50: number[];
  hpCurveP90: number[];
  deathCauseDistribution: Record<string, number>;
  itemRarityDistribution: Record<string, number>;
}
```

输出用于门禁断言：
- average-normal clear rate 在 40%~60%
- optimal-hard clear rate 在 60%~80%

**验收标准**
- 同一 config 与 seedBase 输出稳定可重现。
- 运行性能可接受（CI 中 sampleSize 可配置降采样）。

---

### PR-3C-03: 平衡参数回填与内容层参数化

**修改文件**
- `packages/content/src/floorScaling.ts`
- `packages/content/src/monsters.ts`
- `packages/content/src/lootTables.ts`
- `packages/content/src/unlocks.ts`

**实施内容**
- 把临时硬编码平衡系数回填到 content 配置。
- 输出“模式差异化参数表”供后续迭代追踪。

**3C Gate**
- [ ] 难度模式可解锁、可选择、可结算。
- [ ] balance 仿真门禁在 CI 可执行。
- [ ] 正常玩家通关率落在目标区间。

---

## 7. Phase 3D — 性能优化与发布稳定性

### PR-3D-01: AI 更新裁剪与空间索引

**新增文件**
- `apps/game-client/src/systems/spatialHash.ts`

**修改文件**
- `apps/game-client/src/systems/EntityManager.ts`
- `apps/game-client/src/systems/AISystem.ts`

**实施内容**
- 建立空间哈希网格，仅更新玩家附近（如 10 tile）活跃怪物。
- 远距离怪物降频更新（例如每 3 帧一次）。

**验收标准**
- 实体数量上升时，AI CPU 占比可控。

---

### PR-3D-02: Pathfinding 预算与帧切分

**修改文件**
- `packages/core/src/pathfinding.ts`
- `apps/game-client/src/systems/MovementSystem.ts`

**实施内容**
- A* 结果缓存（短时间、同起终点复用）。
- 大路径分帧执行，避免单帧长阻塞。

**验收标准**
- 密集移动指令下无明显主线程卡顿。

---

### PR-3D-03: 粒子池与渲染裁剪

**修改文件**
- `apps/game-client/src/systems/VFXSystem.ts`
- `apps/game-client/src/systems/RenderSystem.ts`

**实施内容**
- 粒子池复用与最大并发上限（超限丢弃低优先级效果）。
- 非可见区域对象不更新动画。

**验收标准**
- Boss 高压场景无持续 FPS 下滑。

---

### PR-3D-04: 生命周期清理与泄漏门禁

**修改文件**
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/systems/*`

**实施内容**
- 场景切换统一清理订阅、Tween、Sound、Emitter、DOM listener。
- 提供开发态诊断开关，输出残留订阅数/对象数。

**3D Gate（Phase 3 总 Gate）**
- [ ] 压力测试下帧时间稳定，无明显内存增长。
- [ ] VFX/SFX/UI 全部通过事件订阅解耦，不污染 core 规则层。
- [ ] 通过长期路线图 Phase 3 DoD。

---

## 8. PR 依赖关系图

```text
3A-01 -> 3A-02 -> 3A-03 -> 3A-04

3A-04 -> 3B-01 -> 3B-02 -> 3B-03 -> 3B-04 -> 3B-05

3B-05 -> 3C-01 -> 3C-02 -> 3C-03

3A-04 + 3B-05 + 3C-03 -> 3D-01 -> 3D-02 -> 3D-03 -> 3D-04
```

说明：
- 先稳定反馈管线，再做 UI 拆分，避免“双重不确定性”导致调试困难。
- 难度和平衡在 UI/反馈稳定后进行，减少主观体感噪声对数值判断的污染。

---

## 9. 交付物清单（预期）

### 9.1 新增文件（核心）
- `docs/plans/2026-02-27-phase3-experience-polish.md`（本文件）
- `apps/game-client/src/systems/VFXSystem.ts`
- `apps/game-client/src/systems/SFXSystem.ts`
- `apps/game-client/src/systems/pools/ParticlePool.ts`
- `apps/game-client/src/ui/UIManager.ts`
- `apps/game-client/src/ui/state/UIStateAdapter.ts`
- `apps/game-client/src/ui/components/Minimap.ts`
- `packages/core/src/difficulty.ts`
- `packages/core/src/balance.ts`

### 9.2 重点修改文件
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/systems/RenderSystem.ts`
- `apps/game-client/src/systems/AISystem.ts`
- `apps/game-client/src/systems/EntityManager.ts`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/style.css`
- `packages/core/src/contracts/types.ts`
- `packages/core/src/contracts/events.ts`
- `packages/core/src/meta.ts`
- `packages/core/src/run.ts`
- `packages/content/src/config.ts`

---

## 10. 验证与验收

### 10.1 自动化验证命令

```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/core build
pnpm --filter @blodex/content build
pnpm --filter @blodex/game-client typecheck
pnpm --filter @blodex/tooling build
```

### 10.2 手工 Smoke（`?debugCheats=1`）

1) 反馈链路
- hit/crit/dodge/death/skill/boss phase 均有可感知反馈。

2) UI 链路
- SkillBar 冷却状态正确；BossBar phase 切换正确；事件弹窗无交互阻塞。

3) Minimap 链路
- 视野与探索区域更新正确；切层后 fog 重置正确。

4) 难度链路
- Hard/Nightmare 仅在满足条件后可选；奖励倍率与怪物强度生效。

5) 性能链路
- 高密度怪群 + 多特效场景无明显卡顿/泄漏。

### 10.3 Balance 门禁

- `average-normal clear rate`：40%~60%
- `optimal-hard clear rate`：60%~80%
- `poor-nightmare clear rate`：显著低于 normal 且仍可达 Floor 2+

---

## 11. Phase 3 美术与音频资源生成计划

Phase 3 的资源重点从“新增内容”转向“反馈质量与识别效率”。

### 11.1 资源范围矩阵

#### 美术（VFX/UI）

| 资源域 | category | DoD 最低数量 | Recommended | 消费模块 |
|---|---|---:|---:|---|
| 命中/暴击/闪避特效 | `fx` | 6 | 12 | `VFXSystem` |
| 死亡与 Boss phase 特效 | `fx` | 4 | 8 | `VFXSystem` |
| 技能施法特效补全 | `fx` | 5 | 10 | `VFXSystem` |
| Minimap 图标集 | `ui_icon` | 6 | 10 | `Minimap` |
| UI 组件图标（状态/警告） | `ui_icon` | 10 | 20 | `UIManager` |

#### 音频（SFX/UI/Amb）

| 资源域 | category | DoD 最低数量 | Recommended | 事件映射 |
|---|---|---:|---:|---|
| 普攻命中变体 | `sfx` | 3 | 6 | `combat:hit` |
| 暴击/闪避/死亡 | `sfx` | 4 | 8 | `combat:*` |
| 技能施法音补全 | `sfx` | 5 | 10 | `skill:use:*` |
| Boss phase 与重击提示 | `sfx` | 2 | 4 | `boss:phaseChange` |
| UI 交互反馈音 | `ui` | 6 | 12 | `event/merchant/menu` |
| Biome ambient 变体 | `amb` | 4 | 8 | `amb:biome:*` |

### 11.2 命名规范

```text
fx_combat_hit_<variant>_<index>
fx_combat_crit_<variant>_<index>
fx_skill_<skill_id>_<variant>_<index>
ui_minimap_<marker_type>_<index>

sfx_combat_hit_<index>
sfx_combat_crit_<index>
sfx_combat_dodge_<index>
sfx_combat_death_<target>_<index>
sfx_skill_<skill_id>_<index>
ui_menu_<action>_<index>
amb_biome_<name>_loop_<index>
```

### 11.3 生产批次

#### Wave P3-A（反馈闭环）
- 先补齐 hit/crit/dodge/death/skill/boss phase 最小包。

#### Wave P3-B（UI 可读性）
- Minimap marker + UI 状态图标 + 弹窗反馈音。

#### Wave P3-C（质量收敛）
- 统一风格与响度，剔除未引用资产。

### 11.4 执行命令链

```bash
pnpm assets:compile
pnpm assets:generate
pnpm assets:images:report
pnpm assets:audio:compile
pnpm assets:audio:sync
pnpm assets:audio:validate
pnpm assets:validate
```

### 11.5 质量门禁

- 许可门禁：`blocked` 为 0，`review-required` 必有 attribution。
- 音频门禁：无爆音、无截断、循环点无明显断层。
- 视觉门禁：1080p/720p 下关键反馈对象可在 300ms 内辨识。
- 体积门禁：首屏关键资产总量不超过 Phase 2 基线 +25%。

---

## 12. 风险与回滚策略

1. **反馈过载导致视觉噪声**
- 缓解：为 VFX 设置优先级与并发上限；Boss 技能优先，普通 hit 可降级。

2. **音频疲劳与失真复发**
- 缓解：保留 `-nostdin + loudnorm + limiter` 的音频同步管线；SFX 分组音量可配置。

3. **UI 重构引发交互回归**
- 缓解：保留 `Hud.ts` 作为迁移桥接，分 PR 渐进替换。

4. **平衡调优陷入主观争议**
- 缓解：统一用 `balance.ts` 门禁指标，先满足区间再做主观体感微调。

5. **性能优化侵入业务逻辑**
- 缓解：优化代码限制在 `systems/*` 和缓存层；core 规则函数保持纯度。

---

## 13. 里程碑与门禁（建议）

| Milestone | 范围 | 出口条件 |
|---|---|---|
| M3-A | 3A 全部 | 反馈链路上线、无刺耳噪音、可关闭降级 |
| M3-B | 3B 全部 | UIManager 接管、Minimap 可用、移动端可玩 |
| M3-C | 3C 全部 | 难度模式与平衡仿真门禁通过 |
| M3-D | 3D 全部 | 性能与泄漏门禁通过，可进入发布候选 |

**Phase 3 Final Go/No-Go**
- [ ] Phase 3 全部 Gate 通过
- [ ] 长期路线图 Phase 3 DoD 满足
- [ ] 全链路回归（core/content/game-client/tooling）通过

