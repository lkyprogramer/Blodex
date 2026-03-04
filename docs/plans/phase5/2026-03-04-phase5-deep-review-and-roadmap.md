# Phase 5 深度核查与总体开发路线图（执行版）

**日期**: 2026-03-04  
**适用分支**: `main`（Phase 4 合并后）  
**文档目标**: 对已收集的 Phase 5 反馈进行代码级核查，并输出可按顺序执行、可验证、可回滚的总体开发方案。

> 状态说明（2026-03-04 更新）：本文件已降级为历史参考，当前执行入口请使用 `docs/plans/phase5/2026-03-04-phase5-integrated-remediation-roadmap-v2.md`。

---

## 1. 直接结论

1. Phase 4 的主干目标已基本落地，但 `DungeonScene / MetaMenuScene / HudContainer` 仍处于预算临界线，架构地基仍需收敛。
2. 现有 Phase 5 草案中有部分前提不准确（例如“仅点击移动”“摄像机固定跟随”），必须先纠偏再规划。
3. Phase 5 建议采用 **5.0 → 5.7** 的顺序执行，其中“超大类收敛（5.1）”为第一优先级，并围绕一个统一大目标分步压线（A/B/C 三阶段）。

---

## 2. 反馈问题核查矩阵（已核对代码）

| 反馈项 | 核查结果 | 证据（代码） | 处理结论 |
|---|---|---|---|
| 仅有点击移动 | **部分不成立** | `DungeonScene` 已有键盘网格移动：`createCursorKeys()` + `updateKeyboardMoveIntent()` | 改为“已有方向键网格移动，但缺 WASD 别名与更连续的输入模型” |
| 摄像机固定跟随、无平滑 | **不成立** | `RenderSystem.configureCamera()` 使用 `startFollow(..., 0.12, 0.12)` | 从反馈中移除该问题，不作为 Phase 5 主任务 |
| 走廊太窄导致点击困难 | **成立** | `procgen.ts` `carveCorridor()` 仅刻单格主路径 | Phase 5.2 作为 P0 优先修复 |
| `clampToWalkable` 容差不足 | **成立** | `MovementSystem.clampToWalkable()` 搜索半径 `±2` | Phase 5.2 扩展到 `±4` 并补测试 |
| 地牢连接拓扑单一（链式） | **成立** | `procgen.ts` 使用 `for i=1..rooms.length-1` 顺序连接 | Phase 5.4 引入 MST + 回边策略 |
| 完全无 Hitstop | **部分成立** | 普通战斗无 hitstop；仅 Boss phase 有 `timeScale=0.92` 的短暂效果 | Phase 5.2 增加可控 combat hitstop（展示层） |
| 三系统测试缺失 | **不成立（已过时）** | 已存在 `aiSystem/movementSystem/monsterSpawnSystem` 测试文件 | 改为“测试存在，但缺覆盖率门禁” |
| 覆盖率门禁不足 | **成立** | `game-client` 无 `--coverage` 门禁脚本；CI 未强制覆盖阈值 | Phase 5.0 建立系统级 coverage gate |
| Biome 资产不足 | **成立（部分）** | 当前仅 4 套独立地砖，`venom_swamp` 与 `bone_throne` 复用 | Phase 5.4 处理视觉差异与资源计划 |

---

## 3. 当前基线快照（2026-03-04）

### 3.1 工程体量与预算

- `DungeonScene.ts`: `2581` 行（预算 `2600`）
- `MetaMenuScene.ts`: `1092` 行（预算 `1200`）
- `Hud.ts`: `5` 行（预算 `300`）
- `HudContainer.ts`: `1079` 行（预算 `1100`）

`pnpm check:architecture-budget` 当前通过。

### 3.2 关键实现现状

1. 地图尺寸：`64x64`（`GAME_CONFIG.gridWidth/gridHeight`）。
2. 走廊刻画：单格宽度（`procgen.carveCorridor`）。
3. 点击容差：`clampToWalkable` 搜索 `±2`。
4. 输入模型：鼠标点击 + 方向键网格移动（无 WASD 别名）。
5. 摄像机：平滑跟随已开启（lerp 0.12）。
6. 战斗反馈：已有闪白、浮字、抖屏；普通命中无专用 hitstop。
7. 系统测试：`AISystem/MovementSystem/MonsterSpawnSystem` 已有测试；但未形成覆盖率门禁闭环。

---

## 4. Phase 5 目标、范围与硬约束

### 4.1 目标

1. 让“移动到达”稳定可预期，显著降低误点和不可达挫败。
2. 提升战斗触感（命中、受击、击杀）但不破坏数值语义。
3. 提升地牢拓扑多样性，减少“链式房间”重复体验。
4. 建立覆盖率与手动回归证据链，确保体验升级可持续迭代。
5. 以“深层重构”完成三大临界类降维：
   - `DungeonScene.ts <= 1500`
   - `MetaMenuScene.ts <= 650`
   - `HudContainer.ts <= 450`
6. 消除 `scenes/dungeon/*` 模块对 `host: Record<string, any>` 的依赖（目标为 0）。
7. 新增音频资源必须走 `audio-plan -> audio-manifest -> public/audio -> assets:audio:validate` 治理链路，禁止只改代码引用。

### 4.2 范围

1. `packages/core/src/procgen.ts`、`packages/core/src/pathfinding.ts`（如有必要）。
2. `apps/game-client/src/scenes/DungeonScene.ts`（仅薄装配修改）。
3. `apps/game-client/src/scenes/dungeon/*` 运行时模块。
4. `apps/game-client/src/systems/{MovementSystem,VFXSystem,SFXSystem,CombatSystem}`。
5. `docs/plans/phase5/*` 交付文档与回归矩阵。
6. `assets/source-prompts/audio-plan.yaml`、`assets/generated/audio-manifest.json`、`apps/game-client/public/audio/*`（当 5.3/5.5 产生音频增量时）。

### 4.3 非目标

1. 不在 Phase 5 中进行大规模美术/音频重制作（仅补必要缺口和占位计划）。
2. 不重写核心战斗公式（伤害、暴击、经验语义保持）。
3. 不引入网络联机、服务端同步等跨阶段任务。

### 4.4 硬约束

1. 迁移期间禁止向 `DungeonScene` 回填业务复杂逻辑，优先迁入 `scenes/dungeon/*`。
2. 所有改动必须可通过 `pnpm ci:check`，并补充针对新增行为的测试。
3. 如需变更存档结构，默认采用 **V2 可选字段**；无充分理由不升 schema。
4. 每个阶段必须给出可执行的手动验证步骤和回滚路径。

---

## 5. 顺序执行主线（5.0 ~ 5.7）

### 5.0 基线冻结与可观测治理

**目标**: 建立 Phase 5 的统一度量口径，避免“凭感觉优化”。

**开发项**:
1. 新增 Phase 5 基线快照文档（体量、关键命令、当前缺口）。
2. 建立 `game-client` 系统覆盖率命令与阈值（至少 lines/branches 双阈值）。
3. 在 diagnostics 增加路径失败计数器与输入延迟采样点。

**建议 PR**:
1. PR-5.0-01 文档与模板（baseline、smoke matrix、PR checklist）。
2. PR-5.0-02 覆盖率脚本与 CI 接入（聚焦 systems + dungeon modules）。
3. PR-5.0-03 诊断采样点（仅统计，不改行为）。

**出口门禁**:
1. `pnpm ci:check` 通过。
2. 覆盖率报告可生成且阈值生效。
3. 可输出路径失败率、输入到首次位移延迟两个指标。

---

### 5.1 架构底座收敛（第一优先级）

**目标**: 将 `DungeonScene.ts / MetaMenuScene.ts / HudContainer.ts` 从“预算临界状态”拉回长期可维护区间，避免 Phase 5 迭代再次回流为 God Class。

**开发项**:
1. `DungeonScene` 再解耦：
   - 抽离 `RunBootstrapService`（run 初始化、daily 载入、meta/locale 规整）。
   - 抽离 `HudRefreshCoordinator`（HUD 快照、瞬时高亮、刷新时机）。
   - 抽离 `InputIntentRouter`（鼠标/键盘输入优先级与意图路由）。
2. `MetaMenuScene` 再解耦：
   - 抽离 `MetaMenuViewBuilder`（`buildMenuView` 与文本映射）。
   - 抽离 `MetaMenuActionService`（购买、锻造、变异选择、开跑/续跑/放弃）。
3. `HudContainer` 再解耦：
   - 抽离 `HudTooltipService`（tooltip 生成、布局、fallback）。
   - 抽离 `InventoryRenderService`（装备/背包渲染和差异比对映射）。
   - 抽离 `HudFormatters`（纯函数格式化，不依赖 DOM）。
4. 治理收口：
   - 收紧 `check-architecture-budget` 目标阈值并补“跨层依赖”规则。
5. 二阶段压线：
   - 阶段 A（结构解耦）：先降到 `2300 / 950 / 850`。
   - 阶段 B（深层重构）：继续降到 `1800 / 780 / 620`，并清零 `host: Record<string, any>`。

**建议 PR**:
1. PR-5.1-01 `DungeonScene` 运行入口收敛。
2. PR-5.1-02 `MetaMenuScene` view/action 拆分。
3. PR-5.1-03 `HudContainer` tooltip/inventory/formatter 拆分。
4. PR-5.1-04 `host` typed port 收敛（替代 `Record<string, any>`）。
5. PR-5.1-05 预算与边界门禁收紧。

**出口门禁**:
1. 阶段 A：`DungeonScene.ts <= 2300`，`MetaMenuScene.ts <= 950`，`HudContainer.ts <= 850`。
2. 阶段 B：`DungeonScene.ts <= 1800`，`MetaMenuScene.ts <= 780`，`HudContainer.ts <= 620`。
3. `host: Record<string, any>` 在 `apps/game-client/src/scenes/dungeon/*` 清零。
4. `pnpm ci:check` 持续通过，且无新临界白名单项。

---

### 5.2 移动与可达性基础（P0）

**目标**: 先解决“走不过去/点不准”的硬痛点。

**开发项**:
1. `procgen` 走廊由 1 格扩展为 3 格（通过 `corridorHalfWidth=1` 控制）。
2. `clampToWalkable` 搜索半径 `±2 -> ±4`。
3. 键盘输入增强：保留方向键，新增 WASD 别名；输入冲突规则明确。
4. 增加不可达日志去重与统计，避免刷屏。

**建议 PR**:
1. PR-5.2-01 走廊加宽（core procgen + tests）。
2. PR-5.2-02 容差扩大（MovementSystem + tests）。
3. PR-5.2-03 WASD 输入兼容与回归。

**出口门禁**:
1. `procgen` 确定性测试全绿（同 seed 输出稳定）。
2. 手动验证：窄走廊点击成功率显著提升，`aborted_unreachable` 频率下降。
3. 不出现怪物卡死/刷怪阻塞的新回归。

---

### 5.3 战斗触感核心（P0/P1）

**目标**: 强化“命中-受击-击杀”的即时反馈。

**开发项**:
1. 新增 combat hitstop（展示层，可配置开关，默认轻量）。
2. 增加击退（普攻与重击分级；不改伤害公式）。
3. 伤害数字分层（普通/暴击/高伤不同样式）。
4. 击杀粒子与音效细化（复用优先；如新增 SFX 变体，必须同步音频资源清单）。

**建议 PR**:
1. PR-5.3-01 Hitstop 与调参管线。
2. PR-5.3-02 击退机制（CombatSystem + collision 约束）。
3. PR-5.3-03 数字分层 + 击杀粒子 + SFX 变体与音频清单同步。

**出口门禁**:
1. 战斗数值回归测试通过（DPS 语义不变）。
2. 常规战斗帧率无明显退化。
3. 手动验证：命中手感与击杀反馈可稳定感知。

---

### 5.4 地牢拓扑升级（P1）

**目标**: 把“顺序链式连接”升级为“可分支网络”。

**开发项**:
1. 房间连接从顺序连接改为：候选边构图 -> MST 保证连通 -> 随机回边形成环路。
2. 走廊形态扩展（L/直连/双拐）并保持 deterministic。
3. 适配隐藏房与刷怪点策略，避免新拓扑导致的生成异常。

**建议 PR**:
1. PR-5.4-01 连接器重构（MST + 回边）。
2. PR-5.4-02 走廊形态策略与测试样例。
3. PR-5.4-03 隐藏房/刷怪点联调与回归。

**出口门禁**:
1. 地图始终全连通，Boss/事件/隐藏房流程无断链。
2. 多 seed 下布局差异可感知，且 determinism 不破坏。
3. 关键 smoke（Normal、Hard、Daily、Endless）通过。

---

### 5.5 氛围与可读性增强（P1）

**目标**: 低成本提升视觉和交互可读性。

**开发项**:
1. Idle 微动画（缩放/位移轻量 tween）。
2. Biome 氛围粒子与色调补充，并明确 ambient loop 策略（独立或复用）。
3. 新手首局上下文提示（非阻断式）。
4. Biome 资产缺口计划：`venom_swamp` 独立地砖和 ambient loop 需求列入资源排期。

**建议 PR**:
1. PR-5.5-01 Idle + 环境粒子。
2. PR-5.5-02 新手引导提示与文案。
3. PR-5.5-03 Biome 资源接入（图片 + ambient 音频；若资源未就绪则保留占位和开关）。

**出口门禁**:
1. 体验提升不引入可玩性回归。
2. `en-US/zh-CN` 文案同步。
3. 无资源时有可降级路径（不阻塞主流程）。

---

### 5.6 深度扩展（P2，可分批）

**目标**: 增加中后期决策深度与重玩价值。

**开发项**:
1. 楼层路径选择（标准/精英/商店等分支）。
2. “祝福”临时增益系统（单局内叠加，强调构筑差异）。
3. 事件风险收益分支继续扩展并与祝福联动。

**建议 PR**:
1. PR-5.6-01 路径选择状态与 UI。
2. PR-5.6-02 祝福系统核心（run-state 可选字段）。
3. PR-5.6-03 事件联动与平衡调优。

**出口门禁**:
1. 路径分支可回放、可保存恢复。
2. 旧存档可加载（字段缺省兼容）。
3. 日志与 HUD 可解释当前分支/祝福状态。

---

### 5.7 发布收口与 DoD

**目标**: 将 Phase 5 改动收敛为可发布基线。

**开发项**:
1. 更新发布就绪清单、性能对比、回滚手册。
2. 收紧架构预算至最终目标（`1500 / 650 / 450`）。
3. 整体冒烟回归与缺陷关闭。

**出口门禁**:
1. 自动化门禁全绿。
2. 回归矩阵全通过或有批准豁免单。
3. 发布文档齐全并完成签署。

---

## 6. 全局验证策略

### 6.1 自动化

```bash
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

### 6.2 手动冒烟（每阶段最少覆盖）

1. 默认优先使用金手指（debug cheats）快速通关并推进到目标验证节点；仅在需要验证真实难度体感/平衡时补非金手指复测。
2. 鼠标点击移动 + 键盘移动（方向键/WASD）互操作。
3. 窄走廊、转角、障碍边缘点击容错。
4. 普通战斗、精英战、Boss 战反馈一致性。
5. Event/Merchant/DeferredOutcome 存档恢复一致性。
6. Endless 第 8/11/14 层突变与奖励结算。
7. Biome 切换时 ambient loop 与战斗 SFX 正常播放；缺失资源时可 fallback 且有日志。

---

## 7. 风险与回滚

| 风险 | 触发场景 | 防护 | 回滚策略 |
|---|---|---|---|
| Procgen 重构导致地图断连 | MST/回边实现错误 | 连通性测试 + 多 seed property test | 保留旧连接器开关，单 PR 回滚 |
| 战斗反馈改造影响性能 | 粒子/抖屏/冻帧叠加 | 限流（对象池/频率上限）+ 诊断面板 | 关闭效果开关，保留数值逻辑 |
| 输入增强导致冲突 | 鼠标与键盘状态竞争 | 明确优先级与状态机测试 | 回退到方向键路径模型 |
| 存档字段扩展出兼容问题 | 5.5 新字段解析失败 | 可选字段 + 迁移测试 | 忽略新字段并降级加载 |

---

## 8. Phase 5 DoD（最终）

1. 移动可达性：路径中止告警显著下降，窄区点击可达性稳定。
2. 战斗触感：命中/受击/击杀反馈闭环完成，且不破坏战斗数值语义。
3. 地牢拓扑：不再是单链式房间连接，至少支持环路与多路径选择。
4. 工程质量：覆盖率门禁落地，核心模块测试可证明关键行为。
5. 架构治理：完成三大类终态压线（`DungeonScene <= 1500`、`MetaMenuScene <= 650`、`HudContainer <= 450`）。
6. 发布资料：回归矩阵、性能对比、回滚手册齐全。
7. 音频资源治理：所有新增音频已进入 `audio-plan/audio-manifest` 并通过校验。

---

## 9. 建议的首批启动顺序

1. 先执行 **5.0-01/02**（基线与 coverage gate），确保后续每个改动都可量化。
2. 第一优先级执行 **5.1-01/02/03/04**（三大临界类收敛 + 门禁收紧），先稳住架构地基。
3. 再推进 **5.2-01/02**（走廊加宽 + clamp 扩容），优先消除移动挫败。
4. 随后推进 **5.3-01**（轻量 hitstop），快速提升体感并验证性能边界。

> 执行原则：每个 PR 都应“可合并、可回退、可验证”，避免再次形成超级变更包。
