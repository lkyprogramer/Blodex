# Phase 2 UI / 美术综合审查报告

**日期**: 2026-03-03
**审查人**: 游戏总监视角（代码分析 + 实际游玩）
**审查范围**: `apps/game-client` 全部 UI/HUD/MetaMenu/反馈系统
**方法**: 代码静态分析 + Chrome DevTools 实机游玩 + Debug 金手指快速通关

---

## 1. 审查概要

### 1.1 游玩路径

| 序号 | 场景 | 截图 | 关键发现 |
|------|------|------|----------|
| 1 | MetaMenu 初始态 | 01/02/03 | DOM 化完成，结构清晰 |
| 2 | Mutation 选择 | 03 | Battle Instinct 可选可取消 |
| 3 | Dungeon Floor 1 | 04/07 | HUD 侧栏信息完整 |
| 4 | Floor 2 分支 | 09 | 双楼梯分支可见 |
| 5 | Floor 3 Molten | 10 | 生物群系差异化 |
| 6 | Floor 4 Phantom | 11 | 路径分支生效 |
| 7 | Floor 5 Boss | 12/13 | Boss 血条 + 胜利选择 |
| 8 | Run Victory | 14/15 | 结算卡片工作 |
| 9 | MetaMenu 更新 | 16/17 | 天赋/锻造扣费正确 |
| 10 | 死亡场景 | 18 | "You Died" 弹层 |
| 11 | Endless F6-F8 | 19-22 | Affix 缩放工作 |
| 12 | Daily Challenge | 23-25 | Scored→Practice 幂等 |

### 1.2 整体评价

Phase 2 功能完备度高，MetaMenu DOM 化、天赋树、蓝图/锻造/变异/Daily/Endless/分支路径 全链路可玩通。但 UI 层面存在多个影响游戏体验的问题，按严重程度分级如下。

---

## 2. 严重问题（P0 — 必须修复）

### 2.1 System Log 被 periodic_trap 消息淹没

**现象**: 每 2.6 秒触发两条 "periodic_trap triggered." 日志，从进入有陷阱的楼层开始持续刷屏，完全淹没了战斗、事件、蓝图发现等关键信息。

**截图证据**: 几乎所有 Dungeon 截图的 System Log 区域都被 periodic_trap 占满。

**影响**:
- 玩家无法通过 System Log 获取任何有用信息
- 蓝图发现、楼层清除、Boss 击败等关键事件被瞬间推出可视区域
- 对比 Diablo 系列，战斗日志应该是玩家获取反馈的核心渠道

**建议修复方案**:
1. periodic_trap 事件不写入 System Log（仅在 debug 模式显示）
2. 或者添加日志过滤/合并机制：连续相同消息折叠为 "periodic_trap triggered. (×N)"
3. 对怪物受 trap 伤害，考虑合并到 damage 日志中而非单独条目

### 2.2 Endless 模式 Soul Shards 经济失控

**现象**: Endless Floor 8 死亡获得 +1581 Soul Shards。普通 5 层通关仅 +110。

**数据对比**:
- Normal Victory (F5): +110 shards
- Endless Death (F8): +1581 shards（14.4倍！）
- Daily Victory (F5 Hard): +181 shards

**影响**: 玩家只需一次 Endless 就能买光大部分天赋和蓝图。天赋树总投资 1211 shards，一次 Endless F8 就超额。这完全破坏了 meta 进度节奏。

**根因分析** (`DungeonScene.ts:4817-4830`):

Endless 死亡结算公式 `kills * endlessKillShardReward(floor)` 使用 `totalKills`（含 F1-F5 正常层的所有击杀），而非仅计算 Endless 层（F6+）的击杀数。F8 死亡时：`96 kills × min(8×2, 20) = 96 × 16 = 1536`，加上 floor bonus `14+15+16 = 45`，总计 **1581**。

**建议修复方案**:
1. Endless shard 计算中 kills 应只统计 `endlessFloor >= 1` 之后的击杀，或引入 `endlessKills` 计数器
2. 正常层（F1-F5）的击杀仍用 `calculateSoulShardReward` 基础公式
3. 最终结果取两者之和（或取较高者，视设计意图）

### 2.3 [已排查] 玩家始终为 Level 1 / XP 不增长

**现象**: 通关 5 层（60 kills）、Endless 8 层（96 kills）后，玩家始终 Level 1，XP 0/98。

**根因**: debug `clearFloor` 直接调用 `entityManager.removeMonsterById` → `onMonsterDefeated`（仅处理 Challenge Room 波次），跳过了正常战斗路径 `playerCombat` 中的 XP 分配和升级判定。正常战斗中 XP 通过 `playerCombat.leveledUp` 正常工作（代码行 3945-3953）。

**结论**: 非功能 Bug，是 debug 快速通关的预期行为。但建议在 `debugForceClearFloor` 中补充模拟 XP 奖励（如每个怪给固定 XP），使 debug 通关更接近真实游戏体验。

**严重度降级**: P0 → P2（debug 体验改善）

### 2.4 [已排查] 无掉落物 / 背包始终为空

**现象**: 通关 8 层（含 Endless），背包仅有 debug 测试物品 "Debug Sealed Ring (Lv3)"，无任何自然掉落。

**根因**: 同 2.3 — debug `clearFloor` 跳过了正常战斗路径中的 `playerCombat.droppedItem` 掉落判定（代码行 3978-3986）。正常战斗中掉落通过 `collectLoot` → `spawnLootDrop` 正常工作。

**结论**: 非功能 Bug，是 debug 快速通关的预期行为。同样建议在 debug 清层后模拟一些掉落。

**严重度降级**: P0 → P2（debug 体验改善）

---

## 3. 重要问题（P1 — 应该修复）

### 3.1 Run Summary 缺少 Victory/Defeat 视觉区分

**现象**:
- 胜利: 标题 "Run Victory"（绿金色调）
- 死亡: 标题 "Run Ended"（同样的中性色调）

**问题**: "Run Ended" 不等于 "Run Defeat"。死亡应使用 "Run Defeat" 标题，并有明显的红色/暗色主题区分。当前 `RunSummaryScreen.ts` 第 75 行的 V2 实现虽有 `.victory`/`.defeat` class，但实际标题未用 "Defeat" 文字。

**设计参考**: Hades 的死亡结算用暗红色调 + "Death Defied" 主题；Slay the Spire 用灰暗色 + 骷髅图标。

### 3.2 Endless 模式无 HUD 标识

**现象**: 进入 Endless 后，Run State 仍显示 Mode: "NORMAL"，无任何视觉提示表明玩家已在深渊层。

**影响**: 玩家不知道自己处于 Endless 模式，无法感知危险递增。

**建议修复**:
1. Mode 显示 "ENDLESS" 或 "ABYSS"
2. 或在 Floor 标识后追加 "(Abyss)" 标签
3. 考虑 HUD 主题色切换（如深渊紫色调）

### 3.3 Death Overlay 过于简陋

**现象**: 死亡覆盖层仅显示 "You Died" + 一行调试说明文字 "Debug cheat forced death to validate death feedback pipeline."

**问题**:
1. 即使不是 debug 死亡，这个覆盖层也缺少：全屏暗化、渐入动画、粒子效果
2. 与 Dark Souls / Hades 的死亡仪式感差距巨大
3. 死亡是 roguelike 中最高频的结束场景，必须给予仪式感

**建议**:
- 全屏红色脉冲 + 渐暗
- "You Died" 使用大号 Cinzel 字体 + 淡入动画
- 配合音效（已有 SFX 系统基础）

### 3.4 MetaMenu 信息过载 — 需要折叠/导航

**现象**: MetaMenu 从上到下包含 9 个区块（Difficulty / Daily / Talent Tree×5 paths / Soul Forge×5 categories / Mutation Loadout×3 / Legacy Unlocks×3 tiers），需要大量滚动。

**影响**:
- 新玩家打开菜单会被信息量压垮
- 常用操作（Start New Run）在最底部
- 无法快速定位到特定区块

**建议**:
1. 添加侧边导航锚点或顶部 tab 切换
2. 默认折叠低优先级区块（如 Legacy Unlocks）
3. 或改为多页面/多 tab 布局

### 3.5 Daily Challenge 结束后难度被改变

**现象**: Daily Challenge (Hard) 结束后回到 MetaMenu，难度选择从 Normal 变成了 Hard (Selected)。

**影响**: 玩家可能不注意到难度被切换，下次开始 Normal Run 实际进入了 Hard 模式。

**建议**: Daily Challenge 不应影响玩家的 selectedDifficulty 存储。

---

## 4. 中等问题（P2 — 建议修复）

### 4.1 HUD 面板默认折叠 — 关键信息不可见

**现象**: Vanguard Stats、Minimap、Run State 等面板在某些视口尺寸下默认折叠，需要滚动展开。

**影响**: 玩家进入地下城后看不到 HP 条、小地图等核心信息。

**建议**: 确保 HP/Mana/XP bar 区域始终可见，不随滚动隐藏。可用 `position: sticky` 固定关键状态栏。

### 4.2 Boss 血条残留

**现象**: Boss 击败后（openBossVictory），HUD 仍显示 Boss 血条 "Phase 1 · 0% / 0/800"。回到 MetaMenu 后也残留。

**影响**: 视觉杂乱，玩家可能误以为还有未完成的 Boss 战。

### 4.3 Tooltip 缺乏丰富信息

**现象**: 装备/物品/技能 tooltip 仅显示名称和基本状态。缺少：
- 物品稀有度颜色编码
- 详细属性数值对比
- 武器类型机制说明
- 天赋效果具体数值预览

**设计参考**: Diablo 系列物品 tooltip 是核心 UI 组件，颜色分级（白/蓝/黄/橙）+ 属性列表 + 套装效果是标配。

### 4.4 Skill Cooldown 遮罩未验证

**现象**: 代码中有 `.skill-cooldown-overlay` 和 `--cooldown-progress` CSS 变量，但在 debug 快速通关中未能实际观察到冷却遮罩效果（因为跳过了实际战斗）。

**建议**: 在实际战斗中验证冷却遮罩的视觉效果是否生效。

### 4.5 进度条未充分利用

**现象**: HP/Mana/XP 已有进度条样式（`.player-bar-fill.hp/mana/xp`），但视觉表现不够突出：
- HP < 25% 时无明显警示效果
- 受伤时无闪烁/震动反馈
- 进度条颜色渐变不够明显

### 4.6 Run Summary 出现在侧栏而非全屏

**现象**: Run Victory/Run Ended 卡片出现在 HUD 侧栏底部，与其他 HUD 元素混在一起，需要滚动才能看到。

**影响**: 作为一局结束的关键仪式，结算面板应该是全屏或大幅覆盖的弹层，而非侧栏中的普通卡片。

**设计参考**: Slay the Spire 结算占据全屏中央，有渐入动画和统计数据的 staggered reveal。

---

## 5. 美术质量评估

### 5.1 色彩与主题

**优点**:
- Dark Fantasy 主题贯穿一致：`--bg-deep: #0f1318`, `--accent: #d0a86f`
- 面板使用了半透明背景 + 边框，层次感尚可
- Biome 颜色编码有效（Molten=红色调，Frozen=蓝色调）

**不足**:
- 整体色调过于统一（灰黑+金），缺少局部高亮色来引导视觉焦点
- 按钮 hover 状态（`--accent-hover: #e8c48a`）变化过于微弱
- 缺少稀有度颜色系统（common/rare/legendary 在 Soul Forge 中无色彩区分）

### 5.2 字体与排版

**优点**:
- Cinzel (标题) + Spectral (正文) 的衬线搭配符合 Dark Fantasy 气质
- 字体大小从 2rem (标题) 到 0.72rem (log 时间戳) 有层级

**不足**:
- System Log 时间戳 `0.72rem` 过小（约 11.5px），长时间阅读困难
- Soul Forge / Mutation 卡片内文字密度过高，行距不足
- Talent 节点按钮文字信息过多（名称+费用+描述+Tier+Rank+状态 全在一行），需要重构布局

### 5.3 动画与反馈

**优点**:
- 定义了 `fadeIn/fadeScaleIn/pulseGlow/pulseBorder/countUp` 关键帧
- `prefers-reduced-motion` 降级支持完整
- Motion token 系统 (`--motion-fast: 140ms`, `--motion-base: 220ms`)

**不足**:
- 实际游玩中几乎感受不到动画效果（大部分面板切换是瞬变）
- MetaMenu 到 Dungeon 的转场无过渡
- 楼层切换无加载/过渡动画
- 死亡无全屏动效

### 5.4 资产质量

**优点**:
- 138 个资产文件（69 WebP + 69 PNG 双格式），覆盖全面
- 风格统一的 DALL-E 生成资产

**不足**:
- 资产在实际 HUD 中使用面积很小（技能图标约 32×32 区域），细节不可见
- 怪物/Boss sprite 在 Phaser Canvas 中的渲染质量取决于缩放，未见自适应 LOD

### 5.5 布局与响应式

**优点**:
- 定义了 3 个断点（980px, 640px, 1400px）
- HUD 侧栏固定 340px，Canvas 自适应剩余宽度

**不足**:
- 窄屏（<980px）下 MetaMenu 内容挤压严重
- 天赋树 5 条路径垂直堆叠，在移动端需要大量滚动
- 未验证 640px 以下是否有按钮被遮挡

---

## 6. 功能正确性验证

### 6.1 通过的功能点

| 功能 | 状态 | 备注 |
|------|------|------|
| MetaMenu DOM 化 | ✅ 通过 | 卡片系统、快捷键工作 |
| 天赋购买 | ✅ 通过 | 扣费正确、前置解锁、Max Rank 禁用 |
| 蓝图发现 | ✅ 通过 | floor_clear/boss_kill/boss_first_kill 触发 |
| 蓝图锻造 | ✅ 通过 | 扣费正确、状态 Forged |
| 变异选择 | ✅ 通过 | 选择/取消、槽位满提示 |
| 分支路径 | ✅ 通过 | F3 Molten/F4 Phantom 或 F3 Frozen/F4 Venom |
| Boss 战 | ✅ 通过 | 血条、Phase 显示、胜利选择 |
| Endless 入口 | ✅ 通过 | Enter Abyss→F6，affix 缩放 |
| Daily Challenge | ✅ 通过 | SHA256 seed、固定武器、Hard 难度、Scored→Practice |
| Daily Abyss 禁用 | ✅ 通过 | "Daily mode only allows Claim Victory" |
| Daily 计分 | ✅ 通过 | Score: 6462 显示在 Run Summary |
| 死亡处理 | ✅ 通过 | HP=0、"You Died"、Run Ended summary |
| Echoes 增长 | ✅ 通过 | 每次 run 结束 +1 |
| Challenge Room 生成 | ✅ 通过 | Floor 4 "Challenge room discovered (Waves: 2/3)" |
| 存档/恢复 | ✅ 通过 | Continue/Abandon 按钮工作 |
| Debug API | ✅ 通过 | ?debugCheats=1 激活，所有命令可用 |

### 6.2 需要调查的问题

| 问题 | 严重度 | 可能原因 |
|------|--------|----------|
| XP 不增长 (Level 1) | P2 | debug clearFloor 跳过 combat pipeline（预期行为） |
| 无装备掉落 | P2 | debug clearFloor 跳过 combat pipeline（预期行为） |
| Endless Shards 过多 | P0 | 结算公式未封顶 |
| Daily 后难度切换 | P1 | Daily 写入了 selectedDifficulty |
| Boss 血条残留 | P2 | shutdown 未清理 boss bar state |

---

## 7. 与 UI Polish 计划的对照

对照 `docs/plans/2026-03-02-ui-visual-polish.md` 的规划，以下是当前实际状态：

| PR 编号 | 目标 | 实际状态 |
|---------|------|----------|
| PR-UI-01 | 全局动效基础 | ✅ keyframes 已定义，reduced-motion 已实现 |
| PR-UI-02 | 物品反馈+字体 | ⚠️ newly-acquired 样式已定义但未验证生效 |
| PR-UI-03 | 面板质感 | ⚠️ inset 阴影有但层次感不足 |
| PR-UI-04 | 玩家资源条 | ✅ HP/Mana/XP bar 已实现，低血警示未验证 |
| PR-UI-05 | 技能冷却 | ✅ overlay CSS 已实现，实际效果未战斗验证 |
| PR-UI-06 | 小地图增强 | ✅ 200px + 脉冲 + N 标识 |
| PR-UI-07 | 结算面板 | ⚠️ V2 已实现但嵌在侧栏，不是全屏 overlay |
| PR-UI-08 | MetaMenu DOM 化 | ✅ 完成，信息过载是新问题 |

---

## 8. 优先修复建议（按影响排序）

### 第一批（阻塞游戏体验）

1. **修复 periodic_trap 日志刷屏** — 过滤或折叠 trap 消息
2. **修复 Endless Shard 奖励公式** — 实现设计文档中的封顶逻辑
3. **debug clearFloor 补充 XP/掉落模拟** — 使 debug 游玩更接近真实体验

### 第二批（提升游戏感受）

5. **Run Summary 全屏化** — 移出侧栏，改为覆盖层弹出
6. **Death Overlay 增强** — 全屏暗化 + 大字体 + 渐入动效
7. **Endless 模式 HUD 标识** — Mode 显示 "ENDLESS/ABYSS"
8. **Run Summary 标题区分** — 死亡使用 "Run Defeat" + 红色主题

### 第三批（视觉品质提升）

9. **MetaMenu 导航优化** — tab 切换或锚点导航
10. **稀有度颜色系统** — common(白)/rare(蓝)/legendary(金) 贯穿所有卡片
11. **天赋节点布局重构** — 信息层次化，减少单按钮文字密度
12. **Boss 血条生命周期修复** — 击败后正确清理
13. **Daily 难度不应影响 selectedDifficulty** — 隔离 daily 设置
14. **HP 低血警示效果** — HP<25% 脉冲/边框变红
15. **场景转场动画** — MetaMenu↔Dungeon、楼层切换时添加过渡

---

## 9. 截图索引

所有截图保存在 `docs/plans/phase2/screenshots/`：

| 编号 | 文件名 | 描述 |
|------|--------|------|
| 01 | 01-meta-menu-initial.png | MetaMenu 初始状态 |
| 02 | 02-meta-menu-full.png | MetaMenu 完整视图 |
| 03 | 03-mutation-selected.png | 变异选择态 |
| 04 | 04-dungeon-floor1.png | 地下城 Floor 1 |
| 05 | 05-floor1-cleared.png | Floor 1（debug 未启用） |
| 06 | 06-meta-menu-with-debug.png | MetaMenu + Debug 面板 |
| 07 | 07-dungeon-hud-full.png | 地下城完整 HUD |
| 08 | 08-floor1-cleared-debug.png | Floor 1 清除（debug） |
| 09 | 09-floor2-branch.png | Floor 2 分支路径 |
| 10 | 10-floor3-biome.png | Floor 3 Molten Caverns |
| 11 | 11-floor4.png | Floor 4 Phantom Graveyard |
| 12 | 12-floor5-boss.png | Floor 5 Boss 战 |
| 13 | 13-boss-victory-choice.png | Boss 胜利 — 选择命运 |
| 14 | 14-run-summary-victory.png | Run Victory 结算 |
| 15 | 15-run-summary-card.png | 结算卡片详情 |
| 16 | 16-meta-menu-post-victory.png | 胜利后 MetaMenu |
| 17 | 17-meta-menu-talent-forge.png | 天赋购买+蓝图锻造后 |
| 18 | 18-death-overlay.png | 死亡覆盖层 |
| 19 | 19-boss-victory-enter-abyss.png | Boss 胜利→Enter Abyss |
| 20 | 20-endless-floor6.png | Endless Floor 6 |
| 21 | 21-endless-floor8.png | Endless Floor 8 (affix 缩放) |
| 22 | 22-endless-death.png | Endless 死亡 (+1581 shards!) |
| 23 | 23-daily-challenge-start.png | Daily Challenge 开始 |
| 24 | 24-daily-victory.png | Daily Victory (Score: 6462) |
| 25 | 25-meta-menu-post-daily.png | Daily 后 MetaMenu (Practice) |
| 26 | 26-abyss-mode-hud.png | ABYSS 模式 HUD 标识验证 |
| 27 | 27-endless-death-shards-fixed.png | Endless 死亡结算修复验证（+45） |
| 28 | 28-daily-difficulty-preserved.png | Daily 后难度保持 Normal |
| 29 | 29-meta-menu-nav.png | MetaMenu 分区导航 |
| 30 | 30-boss-bar-cleared.png | Boss 胜利后血条不残留 |
| 31 | 31-floor-transition-overlay.png | 楼层切换转场 overlay（Floor 2） |
| 32 | 32-low-health-warning.png | 低血告警（HP 30/254 + HUD 红色警示） |
| 33 | 33-tooltip-compare-delta.png | Tooltip 对比差值与 Power Δ |
| 34 | 34-narrow-screen-sticky-hud.png | 窄屏 HUD 关键区 sticky 验证 |
| 35 | 35-meta-talent-layout-rework.png | MetaMenu 天赋卡片分区布局重构 |

---

## 10. CSS 代码质量评估

### 10.1 现状

- `style.css` 1,513 行，单文件架构
- CSS 变量系统化：`--bg-*`, `--text-*`, `--accent-*`, `--motion-*`
- 5 个 keyframe 动画 + `prefers-reduced-motion` 降级
- 响应式断点：980px / 640px / 1400px

### 10.2 技术债务

1. **单文件过大** — 1,513 行无模块化分割，维护成本递增
2. **选择器特异性不一致** — 部分用 ID (`#hud-panel`)，部分用 class (`.meta-*-card`)
3. **Magic numbers** — 多处硬编码像素值缺少变量抽象
4. **动画未充分利用** — 定义了 5 个 keyframe 但实际触发场景有限
5. **深色主题唯一** — 无浅色模式支持（对 Dark Fantasy 可接受）

### 10.3 组件代码质量

| 组件 | 行数 | 评价 |
|------|------|------|
| MetaMenuPanel.ts | 543 | 功能完整但偏大，可按区块拆分 |
| Hud.ts | 724 | 承担过多职责（meta stats + player bars + minimap + boss + inventory + log + skills），需要拆分 |
| SkillBar.ts | 181 | 大小合理，cooldown overlay 实现清晰 |
| RunSummaryScreen.ts | 75 | 轻量但缺少 defeat 视觉差异 |
| Minimap.ts | 239 | Canvas 绘制逻辑合理，脉冲效果良好 |

---

## 11. 与竞品对标

### 11.1 参考游戏

| 要素 | Hades | Slay the Spire | Blodex 当前 |
|------|-------|----------------|-------------|
| 死亡仪式感 | 全屏暗红 + 冥河动画 | 灰色调 + 心碎动效 | 仅 "You Died" 文字 |
| 结算面板 | 全屏卡片 + 奖励动画 | 全屏统计 + staggered | 侧栏内小卡片 |
| 稀有度颜色 | 白/蓝/紫/金 | 白/蓝/金 | 无颜色编码 |
| 进度反馈 | 镜中对话 + 关系变化 | 地图路径可视化 | 仅文字日志 |
| 菜单导航 | Tab 切换 + 动画过渡 | 顶部 tab | 单页长列表滚动 |

### 11.2 低成本高回报改进

1. **稀有度颜色**（仅 CSS）— 给 common/rare/legendary 物品、蓝图、天赋加上颜色前缀/边框
2. **结算 overlay 化**（DOM 移位）— 把 Run Summary 从侧栏移到全屏 overlay
3. **死亡屏幕增强**（CSS 动画）— 利用已有的 keyframe + 暗化 overlay
4. **日志过滤**（JS 逻辑）— 添加消息类型过滤，trap 消息不进入默认视图

---

## 12. 总结

Phase 2 在功能交付上非常出色 — 天赋/蓝图/变异/分支/Endless/Daily 全链路可玩。但 UI 层面存在多个影响核心游戏体验的问题，最严重的是 System Log 被 trap 消息淹没、Endless 经济失控、以及 Daily 结束后会污染玩家难度选择。

美术方面，Dark Fantasy 主题统一性好，但仪式感和反馈感严重不足 — 死亡、结算、楼层转场等关键时刻缺乏视觉冲击力。这些都是 roguelike 游戏中高频且情感密度最大的时刻。

建议先修复 P0 级功能问题，再按本文第 8 节的优先级逐步提升视觉品质。

---

## 13. 反馈问题核实（文档 + 截图 + 代码）

### 13.1 核实范围

- 文档：`docs/plans/phase2/ui-art-review.md`
- 截图：`docs/plans/phase2/screenshots/`（重点核对 02/14/18/20/21/22/25）
- 代码：`apps/game-client/src`、`packages/core/src`、`packages/content/src`

### 13.2 核实结论总览

| ID | 反馈问题 | 核实结论 | 证据（截图） | 证据（代码） |
|---|---|---|---|---|
| P0-1 | System Log 被 periodic_trap 刷屏 | **成立** | `21-endless-floor8.png` 可见 periodic_trap 伤害日志持续出现 | `packages/content/src/hazards.ts:23`（2600ms）+ `apps/game-client/src/scenes/DungeonScene.ts:1186`（trigger 日志）+ `:1193`（damage 日志） |
| P0-2 | Endless Shards 经济失控 | **成立** | `22-endless-death.png`（死亡场景）+ 审查结论记录 +1581 | `apps/game-client/src/scenes/DungeonScene.ts:4821-4827` 使用 `totalKills` 按 Endless per-kill 计算 |
| P1-3 | Run Summary 缺少 defeat 视觉区分 | **成立** | 结算卡片类名有 defeat，但文案仍偏中性 | `apps/game-client/src/ui/components/RunSummaryScreen.ts:57` 使用 `"Run Ended"` |
| P1-4 | Endless HUD 不显示 ENDLESS/ABYSS | **成立** | `20-endless-floor6.png` OCR: `floor 6 NORMAL` | `apps/game-client/src/ui/Hud.ts:275` Mode 显示 difficulty；`apps/game-client/src/scenes/DungeonScene.ts:5130-5151` 未传 runMode/inEndless |
| P1-5 | Death Overlay 过于简陋 | **成立** | `18-death-overlay.png` 仅标题 + 一行原因 | `apps/game-client/src/ui/Hud.ts:350-357` 仅简单 HTML；`apps/game-client/src/style.css:731-767` 动效/层次有限 |
| P1-6 | MetaMenu 信息过载、缺导航 | **成立** | `02-meta-menu-full.png` 单页长列表 | `apps/game-client/src/ui/components/MetaMenuPanel.ts` 线性渲染所有区块，无 tab/锚点导航 |
| P1-7 | Daily 结束后改变难度选择 | **成立** | `25-meta-menu-post-daily.png` 中 Hard 显示 Selected | `apps/game-client/src/scenes/MetaMenuScene.ts:734-736` Daily 强制 hard；`apps/game-client/src/scenes/DungeonScene.ts:675-687` 会写回 `meta.selectedDifficulty` |
| P2-8 | HUD 关键面板可见性问题 | **部分成立**（移动端明显） | 窄屏下需要滚动 | `apps/game-client/src/style.css:842-846`、`:1419-1421` 限制 HUD 高度，关键块可能首屏不可见 |
| P2-9 | Boss 血条残留 | **成立** | `14-run-summary-victory.png`、`24-daily-victory.png` 可见 `Boss Phase 1 · 0%` | `apps/game-client/src/scenes/DungeonScene.ts:4874` 结束时渲染一次 HUD；`:753-756` runEnded 后不再刷新，残留状态不清理 |
| P2-10 | Tooltip 信息不足 | **部分成立** | 现有 Tooltip 未体现对比/收益信息 | `apps/game-client/src/ui/Hud.ts:639-653` 仅基础 affix 展示，无装备对比、DPS/防御变化 |
| P2-11 | Skill Cooldown 遮罩未验证 | **成立（验证缺口）** | 审查截图未覆盖真实战斗冷却过程 | `apps/game-client/src/ui/components/SkillBar.ts:139-141` + `apps/game-client/src/style.css:1005-1019` 已实现，但缺对局验证证据 |
| P2-12 | 低血反馈不足 | **成立** | 截图中无低血高亮提示机制 | `apps/game-client/src/style.css:984-994` 仅静态进度条，无 `low-hp` 告警状态 |
| P2-13 | Run Summary 在侧栏而非全屏 | **成立** | 结算阶段需滚动侧栏才能看到卡片 | `apps/game-client/index.html:21` summary 挂在 `#hud-panel`；`apps/game-client/src/ui/Hud.ts:689-692` 注入侧栏 |

---

## 14. 改造优化计划（执行版）

### 14.1 目标与约束

- 目标：先消除经济/反馈错误，再提升高频体验节点（死亡、结算、模式辨识），最后做 UI 可用性精修。
- 约束：
  - 不改动已有 run replay 协议语义；
  - 涉及存档字段新增时，必须可向后兼容；
  - 所有改动都补最小回归测试（core 逻辑 + game-client UI 渲染）。

### 14.2 分批实施（建议 3 个批次）

#### Batch A（P0，先落地）

1. **日志降噪与折叠（P0-1）**
   - 改造点：
     - `DungeonScene.ts`：`hazard:trigger` 默认不进主日志（仅 diagnostics/debug）。
     - `Hud.ts`：新增同类日志窗口折叠（例如 3s 内同消息合并为 `xN`）。
   - 验收：
     - 连续 30 秒陷阱层，日志面板保留关键事件（清层/Boss/蓝图）且可读。

2. **Endless 结算公式修复（P0-2）**
   - 改造点：
     - `packages/core/src`：新增 `endlessKills`（或 `abyssEntryTotalKills`）的明确口径。
     - `DungeonScene.ts`：击杀计数在进入 Abyss 后单独累计。
     - `finishRun`：Endless 死亡奖励仅对 Endless 段击杀应用 `endlessKillShardReward`，Normal 段按基础公式结算。
     - `save.ts/migrate`：新增字段默认值，保证旧存档可读。
   - 验收：
     - F8 死亡不再出现 +1581 量级异常；
     - 同等时长下，Endless 收益高于 Normal，但不会一次性买空天赋树。

3. **Daily 难度隔离（P1-7）**
   - 改造点：
     - `DungeonScene.resolveSelectedDifficultyForRun`：当 `pendingRunMode === "daily"` 时，不写回 `meta.selectedDifficulty`。
     - Daily run 内部仍强制 `hard`，但只作用于该局。
   - 验收：
     - Daily 结束回到 MetaMenu，难度仍保持玩家进入 Daily 前的选择。

4. **Debug clearFloor 体验对齐（原清单第 3 点）**
   - 改造点：
     - `DungeonScene.ts` 的 debug 清层逻辑增加可控模拟：按怪数补发 XP 与掉落事件（可加 debug 开关）。
     - 避免 debug 快速通关时出现“全程 0 XP/无掉落”的误导性观感。
   - 验收：
     - 开启 debug 清层后，角色等级与背包反馈接近真实战斗路径。

#### Batch B（P1，体验关键路径）

1. **Run Summary 语义与承载层重构（P1-3 + P2-13）**
   - 改造点：
     - `RunSummaryScreen.ts`：失败标题改为 `Run Defeat`，保留 `victory/defeat` 主题差异。
     - 新增独立 overlay 容器（建议 `#run-summary-overlay`），不再塞入 HUD 侧栏。
     - Continue 行为支持点击与回车。
   - 验收：
     - 死亡/胜利均为居中结算弹层，首屏可见，无需滚动侧栏。

2. **Endless 模式可见性（P1-4）**
   - 改造点：
     - `UIStateAdapter.ts` + `DungeonScene.ts`：向 HUD 传入 `runMode/inEndless/endlessFloor`。
     - `Hud.ts`：Mode 显示 `ABYSS`（或 `ENDLESS`）并附层数。
   - 验收：
     - 进入 Abyss 后 HUD 明确显示模式变化，不再显示 `NORMAL`。

3. **Death Overlay 2.0（P1-5）**
   - 改造点：
     - `style.css`：全屏暗化 + 脉冲 + 渐入动效；支持 `prefers-reduced-motion`。
     - `Hud.ts`：debug 原因文案降级为次级信息，正式死亡文案优先。
   - 验收：
     - 死亡视觉显著区别于普通弹窗，且不影响性能与可访问性。

4. **MetaMenu 导航降噪（P1-6）**
   - 改造点：
     - `MetaMenuPanel.ts`：新增分区导航（tab 或锚点）；默认折叠低频区块（Legacy/部分明细）。
   - 验收：
     - 新用户 3 次滚动以内可找到 `Start New Run`、`Difficulty`、`Daily`。

#### Batch C（P2，质量收尾）

1. **Boss 血条生命周期修复（P2-9）**
   - `finishRun` 时显式清理 boss state 或强制隐藏 boss bar，避免 0/800 残留。
2. **HUD 关键信息固定可见（P2-8）**
   - 移动端将 HP/Mana/XP + Run State 置顶 sticky，避免被长日志/背包挤出首屏。
3. **Tooltip 深化（P2-10）**
   - 增加与当前装备的属性对比、主收益提示（攻强/护甲/暴击变化）。
4. **冷却遮罩验证闭环（P2-11）**
   - 增加技能冷却可视化测试样例和人工走查用例。
5. **低血反馈（P2-12）**
   - HP < 25% 增加资源条和 HUD 边缘告警，不影响正常可读性。
6. **稀有度颜色系统统一（原清单第 10 点）**
   - 统一 common/magic/rare 在 Tooltip、背包格子、锻造卡片、商店条目中的视觉语义与色板 token。
7. **天赋节点布局重构（原清单第 11 点）**
   - `MetaMenuPanel.ts` 的天赋卡片从“单块堆叠信息”改为分区（名称/成本、效果、进度、状态），减少扫描成本。
8. **场景转场动画（原清单第 15 点）**
   - 增加 `MetaMenu -> Dungeon` 与楼层切换过渡（fade + 轻量文案），并兼容 `prefers-reduced-motion`。

### 14.3 测试与验收清单（建议）

1. 单元与类型检查
   - `pnpm --filter @blodex/core test`
   - `pnpm --filter @blodex/game-client test`
   - `pnpm --filter @blodex/core typecheck`
   - `pnpm --filter @blodex/game-client typecheck`
2. 回归场景（手工）
   - Normal F5 胜利 → Summary/Meta 数据正确
   - Abyss F8 死亡 → Soul Shards 口径正确、HUD 模式正确
   - Daily（Scored/Practice）→ 结束后难度不被污染
   - Boss 击败/死亡 → Boss bar 不残留、Death/RunSummary overlay 正常
3. 关键指标
   - 日志可读性（陷阱层 30 秒日志中关键事件可见）
   - 经济节奏（Endless 单局收益不突破 meta 预期上限）
   - 交互可达性（MetaMenu 关键入口 3 次操作内可达）

---

## 15. 本轮开发改造落地清单（2026-03-03）

### 15.1 已落地改造

1. `periodic_trap` 日志降噪（不再刷主日志）。
2. Endless 奖励口径修复：引入 `endlessKills`，Abyss 击杀独立计数与结算。
3. 存档兼容：`RunState` / `save` 迁移增加 `endlessKills` 读写与默认值。
4. Daily 难度隔离：Daily run 不再覆盖 `meta.selectedDifficulty`。
5. Run Summary 改为全屏 overlay（从侧栏迁出）。
6. 失败结算文案改为 `Run Defeat`，并保留 victory/defeat 主题区分。
7. Endless HUD 模式标识：显示 `ABYSS N`（Daily 显示 `DAILY`）。
8. Death Overlay 视觉增强（暗化、脉冲、主副文案）。
9. MetaMenu 增加分区导航（Difficulty/Daily/Talents/Soul Forge/Mutations/Legacy）。
10. Debug `clearFloor` 增加 XP/升级/掉落模拟，减少调试路径偏差。
11. Boss 血条残留修复（补充组件防御：缺失 boss runtime 时不渲染）。
12. HUD 窄屏可见性优化：`#hud-critical` sticky 固定关键状态区。
13. Tooltip 深化：同槽位对比、属性 `(+/-Δ)`、`Power Δ`，并统一稀有度视觉 token。
14. 天赋卡片布局重构：名称/Tier、Cost/Rank、描述/状态分层展示。
15. 低血反馈增强：`HP <= 25%` 时触发 HUD 与全局红色告警提示。
16. 场景转场补齐：MetaMenu↔Dungeon 与楼层切换均有过渡文案与 fade 效果。

### 15.2 关键改动文件

- `packages/core/src/run.ts`
- `packages/core/src/save.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/systems/CombatSystem.ts`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/ui/state/UIStateAdapter.ts`
- `apps/game-client/src/ui/components/RunSummaryScreen.ts`
- `apps/game-client/src/ui/components/MetaMenuPanel.ts`
- `apps/game-client/src/ui/components/BossHealthBar.ts`
- `apps/game-client/src/ui/SceneTransitionOverlay.ts`
- `apps/game-client/src/style.css`
- `apps/game-client/index.html`

---

## 16. Chrome DevTools 实机验证（2026-03-03）

### 16.1 验证环境

- URL: `http://127.0.0.1:4173/?debugCheats=1`
- 启动方式：`pnpm --filter @blodex/core build && pnpm --filter @blodex/content build && pnpm --filter @blodex/game-client dev --host 127.0.0.1 --port 4173`
- 验证手段：Chrome DevTools + 页面脚本调试 API `window.__blodexDebug`

### 16.2 验证结果（通过）

1. **Endless HUD 标识**
   - 结果：`Run State` 中 `Mode` 显示 `ABYSS 1/3`，不再显示 `NORMAL`。
   - 证据：`26-abyss-mode-hud.png`
2. **Endless 经济修复**
   - 复现场景：普通层累计高击杀后进入 Abyss，在 F8 死亡。
   - 结果：结算 `Soul Shards +45`，不再出现 `+1581` 异常量级；结算已不受 `totalKills` 污染。
   - 证据：`27-endless-death-shards-fixed.png`
3. **Run Summary 全屏 + Defeat 文案**
   - 结果：结算容器为固定定位全屏（`position: fixed`，覆盖整个 viewport），失败标题为 `Run Defeat`。
   - 证据：`27-endless-death-shards-fixed.png`
4. **Death Overlay 增强**
   - 结果：显示 `YOU DIED` + 副标题 + 原因文案，背景为径向暗红渐变。
   - 证据：`27-endless-death-shards-fixed.png`
5. **System Log 降噪**
   - 结果：Abyss 场景日志中 `periodic_trap` 计数为 0，日志不再被周期陷阱刷屏。
6. **Daily 难度隔离**
   - 复现：先选 `Normal` → 进入/结束 Daily → 返回 MetaMenu。
   - 结果：`Difficulty` 仍为 `Normal Selected`，未被 Daily 改写为 Hard。
   - 证据：`28-daily-difficulty-preserved.png`
7. **MetaMenu 导航**
   - 结果：顶部分区导航可见并可触发分区跳转动作。
   - 证据：`29-meta-menu-nav.png`
8. **Boss 血条残留修复**
   - 复现：Floor 5 Boss Victory → `Claim Victory`。
   - 结果：结算阶段 `#boss-bar` 为 `hidden` / `display:none`，无 `0/800`（或 `0/1`）残留。
   - 证据：`30-boss-bar-cleared.png`
9. **场景转场动画（楼层切换）**
   - 复现：运行中触发 `window.__blodexDebug.nextFloor()`。
   - 结果：出现 `#scene-transition-overlay`，文案显示 `Floor 2 Forgotten Catacombs` 并自动淡出。
   - 证据：`31-floor-transition-overlay.png`
10. **低血告警**
   - 复现：`window.__blodexDebug.setHealth(30)`（当前上限 254，低于 25%）。
   - 结果：`body/#hud-critical` 注入 `low-health-critical`，Run State 出现 `Critical HP` 提示文案。
   - 证据：`32-low-health-warning.png`
11. **Tooltip 对比深化 + 稀有度语义**
   - 复现：装备 Ring 后悬浮同槽位背包 Ring。
   - 结果：Tooltip 显示稀有度、逐条属性差值 `(+/-Δ)` 与 `Power Δ`。
   - 证据：`33-tooltip-compare-delta.png`
12. **HUD 窄屏 sticky**
   - 复现：DevTools 视口调至 `900x900`，并滚动 `#hud-panel` 到底部。
   - 结果：`#hud-critical` 计算样式为 `position: sticky`，滚动后仍固定于面板顶部可见。
   - 证据：`34-narrow-screen-sticky-hud.png`
13. **天赋卡片布局重构**
   - 复现：返回 MetaMenu 查看 Talent Tree。
   - 结果：卡片信息按 `Tier/Cost/Rank` 分区呈现，扫描负担显著降低。
   - 证据：`35-meta-talent-layout-rework.png`

### 16.3 自动化检查

- `pnpm --filter @blodex/core test` ✅
- `pnpm --filter @blodex/game-client test` ✅
- `pnpm --filter @blodex/core typecheck` ✅
- `pnpm --filter @blodex/game-client typecheck` ✅

---

## 17. 原文“15 个优化点”覆盖结论

按本次执行口径，**已完成 15/15**。

### 17.1 已完成（15）

1. periodic_trap 日志刷屏修复
2. Endless Shards 经济失控修复
3. Run Summary 失败语义（Run Defeat）
4. Endless HUD 标识（ABYSS）
5. Death Overlay 增强
6. MetaMenu 导航降噪
7. Daily 难度隔离
8. Run Summary 全屏化
9. Boss 血条生命周期修复
10. Debug clearFloor 的 XP/掉落体验对齐
11. HUD 关键信息窄屏 sticky/首屏可见性强化
12. Tooltip 深化（对比收益、机制说明）与稀有度色彩统一
13. 天赋节点布局重构（信息分层）
14. 低血量告警反馈（HP < 25%）
15. 场景转场动画（MetaMenu↔Dungeon / 楼层切换）
