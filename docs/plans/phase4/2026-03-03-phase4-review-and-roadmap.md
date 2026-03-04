# Phase 4 全面审查与改进路线图

> 状态：已整合到统一主计划。请优先使用  
> `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md`

**日期**: 2026-03-03
**文档位置**: `docs/plans/phase4/2026-03-03-phase4-review-and-roadmap.md`
**参考基线**: Phase 3 全部文档、`docs/plans/phase4/metrics/2026-03-03-phase4-0-baseline.md`（4.0 冻结快照）

---

## 1. 直接结论

Phase 3 在工程治理（R4）和 i18n 基础设施（R2/R3）上交付质量较高，但 R1 场景解耦的核心目标（DungeonScene < 2500 行）未达成——在 4.0 冻结时点 `DungeonScene` 仍为 **6301 行**。游戏内容丰富度已远超 MVP，但多项机制停留在"数据已定义、运行时未完整接入"的半成品状态，玩家感知不到差异。

Phase 4 建议围绕两条主线推进：

1. **工程收敛**（E 系列）：完成 R1 遗留的瘦身、清理 feature flag 债务、补充核心系统测试。
2. **体验深化**（G 系列）：将已有但未落地的机制接入运行时，强化战斗反馈与成长感知，提升 Endless 模式的长期可玩性。

---

## 2. 现状证据（代码基线）

### 2.1 体量数据

| 文件 | 行数 | Phase 3 目标 | 差距 |
|---|---:|---|---|
| `DungeonScene.ts` | 6,301 | < 2,500 | **+3,801 行未达标** |
| `Hud.ts` | 963 | — | 8 个职责混合 |
| `MetaMenuScene.ts` | 1,093 | — | — |
| `packages/core/src/contracts/types.ts` | 818 | — | — |

> 注：以上为 4.0 冻结历史基线；2026-03-04 的 `origin/main` 实测 `DungeonScene.ts` 已降至 5200 行。阶段执行时应以“当前 main 实测”回填。

### 2.2 系统类拆分现状

Phase 3 R1 新增了 13 个独立系统类：

| 系统 | 文件 | 职责 |
|---|---|---|
| AISystem | `systems/AISystem.ts` | 怪物 AI（6 种行为） |
| CombatSystem | `systems/CombatSystem.ts` | 战斗解算 |
| MovementSystem | `systems/MovementSystem.ts` | 玩家移动 |
| EntityManager | `systems/EntityManager.ts` | 实体生命周期 |
| MonsterSpawnSystem | `systems/MonsterSpawnSystem.ts` | 怪物生成 |
| RenderSystem | `systems/RenderSystem.ts` | 渲染 |
| VFXSystem | `systems/VFXSystem.ts` | 视觉特效 |
| SFXSystem | `systems/SFXSystem.ts` | 音效 |
| AudioSystem | `systems/AudioSystem.ts` | 背景音乐 |
| SaveManager | `systems/SaveManager.ts` | 存档（含多 tab lease） |
| feedbackEventRouter | `systems/feedbackEventRouter.ts` | 战斗反馈路由 |
| spatialHash | `systems/spatialHash.ts` | 空间哈希碰撞查询 |
| ParticlePool | `systems/pools/ParticlePool.ts` | 粒子对象池 |

**问题**：系统类已拆分，但 DungeonScene 仍承担大量编排与流程细节，导致文件体量和认知负担持续偏高。

### 2.3 Feature Flag 状态

`apps/game-client/src/config/uiFlags.ts` 中 5 个 flag 均已设为 `true`：

```typescript
metaMenuDomEnabled: true,
runSummaryV2Enabled: true,
skillCooldownOverlayEnabled: true,
sceneRefactorR1Enabled: true,
i18nInfrastructureEnabled: true
```

所有新路径均已激活，仍有遗留 flag 分支与兼容代码增加维护成本。

### 2.4 测试覆盖

| 包 | 测试文件数 | 说明 |
|---|---:|---|
| `packages/core` | 40 | 覆盖面广 |
| `apps/game-client` | 25 | 含 8 个 systems 测试 |
| `packages/content` | 2 | 仅 R4 新增的 ID 唯一性 + 完整性 |

**缺口**：AISystem、MovementSystem、MonsterSpawnSystem 无单元测试。

### 2.5 游戏机制落地状态

| 机制 | 数据定义 | 运行时接入 | 备注 |
|---|:---:|:---:|---|
| 武器类型差异（6 种） | ✅ | ✅（基础） | CombatSystem 已处理 crit_bonus/aoe_cleave/stagger/skill_amp；`sword_master` 复用 crit_bonus。当前 `weaponTypes.ts` 无 `projectile` 机制定义 |
| 生物群系视觉差异（6 种） | ✅ | ❌ | 全部 `floorTilesetKey: "tile_floor_01"`，未接入差异化渲染 |
| 受击闪白 / 暴击震屏 | — | ✅ | VFXSystem.playCombatHit 已实现 |
| 技能释放特效 | — | ✅ | VFXSystem.playSkillCast 已实现（5 种颜色） |
| Boss Phase 切换特效 | — | ✅ | VFXSystem.playBossPhaseChange 已实现 |
| 升级视觉特效 | — | ❌ | 仅日志输出，无 VFX/SFX 反馈 |
| 怪物攻击地面预警（Telegraph） | ✅ | ⚠️ 部分 | 基础设施存在但仅用于挑战房和危害区，Boss 技能无预警 |
| 装备 Tooltip 对比提示 | — | ✅（基础） | 已有 `delta-up/down/equal` 颜色与总强度差值；缺箭头符号和装备后 HUD 属性高亮 |
| Endless 深渊突变 | ❌ | ⚠️ 部分 | 已有数值缩放 + 词缀加码（`resolveEndlessAffixBonusCount`），无规则级玩法突变 |
| 排行榜 | ❌ | ❌ | 不存在 |

---

## 3. Phase 4 问题清单与改进方案

### E1. DungeonScene 旧路径清除（工程 · P0）

**问题**：R1 的 DoD 要求 DungeonScene < 2500 行，4.0 冻结时点仍为 6301 行。当前主要瓶颈不只是“旧路径残留”，而是 DungeonScene 仍承载了过多编排 + 业务 + UI 逻辑，且保留少量 feature flag 分支。

**影响**：
- 维护成本翻倍（改 bug 需同步两条路径）
- 新开发者阅读困难
- 死代码增加编译和搜索噪声

**方案**：
1. 先清理剩余 flag 分支（保留单一路径），再做职责下沉：按 BossCombat → EventFlow → HazardLoop → SaveSnapshot → FloorTransition 顺序拆分，每个模块一个 PR
2. 每个 PR 必须通过 `pnpm ci:check` + 手动冒烟测试（完成一局游戏）
3. 删除所有 feature flag 守护代码及 `uiFlags.ts` 中对应字段（含对应测试改造）
4. 目标：DungeonScene < 2500 行

**验证方式**：
- `wc -l DungeonScene.ts` < 2500
- `pnpm test` 全部通过
- 手动完整通关一局（Normal 难度 5 层 + Boss）

**风险**：中。旧路径可能包含新路径遗漏的边缘 case。每个 PR 需仔细对比新旧路径的行为差异。

---

### E2. Feature Flag 债务清理（工程 · P0）

**问题**：`uiFlags.ts` 中 5 个 flag 均为 `true`，旧路径已是死代码。

**影响**：
- 类型系统中保留无用的 `if (flag)` 分支
- 增加代码理解成本

**方案**：
1. 作为 E1 的附属工作，每清除一个模块的旧路径，同步删除对应 flag
2. 最终删除 `UiPolishFlags` 接口和 `UI_POLISH_FLAGS` 常量（若全部 flag 清除）
3. 如有其他代码引用 flag，改为直接执行新路径

**验证方式**：
- `grep -r "UI_POLISH_FLAGS\|uiFlags\|sceneRefactorR1Enabled\|i18nInfrastructureEnabled"` 返回零结果
- `pnpm test` 通过

---

### E3. Hud.ts 职责拆分与增量渲染（工程 · P2）

**问题**：Hud.ts 963 行，混合 8 个职责（状态栏 / SkillBar / 死亡 Overlay / 事件面板 / 商人面板 / Tooltip / 日志 / 背包），`innerHTML` 替换 24 处，每帧全量重建 DOM。

**影响**：
- 单文件修改任何 UI 区块都可能破坏其他区块
- 全量 innerHTML 替换在怪物数量多时有性能抖动风险
- 难以为单个面板添加动画或过渡效果

**方案**：

方案 A（推荐）：**拆分为独立面板组件**
1. 按职责拆分为独立类：`StatusPanel`、`SkillBarPanel`、`InventoryPanel`、`LogPanel`、`TooltipManager`、`OverlayManager`
2. 每个组件管理自己的 DOM 节点，只在数据变化时更新
3. Hud.ts 降级为容器编排器（< 200 行）
4. 高频更新（HP/Mana/XP 条）采用 `style.width` 或 `textContent` 直接修改，避免 innerHTML

方案 B：**保持单文件但引入增量更新**
1. 不拆分文件，但将 `render()` 改为 diff-based 更新
2. 为每个区域维护 DOM 引用，只在对应数据变化时更新
3. 优点：改动量小；缺点：单文件仍臃肿

**验证方式**：
- 使用 Chrome DevTools Performance 面板录制 30 秒战斗，确认无 >16ms 的 Layout/Recalc Style 帧
- HUD 所有功能正常（tooltip、装备对比、技能冷却覆盖、日志滚动）

---

### E4. 核心系统单元测试补充（工程 · P2）

**问题**：AISystem、MovementSystem、MonsterSpawnSystem 无单元测试。

**影响**：
- 重构或修改 AI 行为无回归保障
- 6 种 AI 行为（chase/kite/ambush/swarm/shield/support）的边缘 case 无法自动验证

**方案**：
1. 为 AISystem 编写测试：覆盖 6 种行为的移动决策逻辑（mock Phaser 场景依赖）
2. 为 MovementSystem 编写测试：路径计算、碰撞检测、边界处理
3. 为 MonsterSpawnSystem 编写测试：生成数量、位置合法性、精英/Boss 生成规则

**验证方式**：
- `pnpm test` 新增测试全部通过
- 覆盖率目标：每个系统 > 70%（按分支覆盖率）

---

### G1. 生物群系视觉差异落地（体验 · P1）

**问题**：6 种 Biome 在 `packages/content/src/biomes.ts` 中均配置为 `floorTilesetKey: "tile_floor_01"`。`RenderSystem.ts:94-102` 统一使用该贴图。玩家在不同楼层看到完全相同的视觉环境，缺乏"探索新区域"的感知。

**影响**：
- 降低楼层间的区分度和新鲜感
- 浪费了已定义的 6 种 Biome 配置
- 环境危害（lava/ice/bone_spike）缺乏视觉语境支撑

**方案**：
1. 为每种 Biome 创建或复用差异化地砖贴图（至少 3 种：暖色系/冷色系/中性）
2. 修改 `biomes.ts` 中各 Biome 的 `floorTilesetKey` 指向对应贴图
3. `RenderSystem` 改为根据当前 Biome 的 `floorTilesetKey` 动态加载
4. 可选：为每种 Biome 添加环境色调滤镜（Phaser Camera pipeline），用最小成本制造视觉差异

**验证方式**：
- 进入不同楼层，地砖颜色/纹理有明显差异
- 截图对比 6 种 Biome 的渲染效果

---

### G2. 武器类型差异感知增强（体验 · P1）

**问题**：当前 6 种武器机制已可运行，但差异主要停留在数值层。`staff` 当前机制是 `skill_amp`（非 projectile），`sword_master` 复用 `crit_bonus`，缺少可感知的动作层差异。

**已接入证据**（`CombatSystem.ts`）：
- ✅ `crit_bonus`（第 218 行）
- ✅ `aoe_cleave`（第 228 行）
- ✅ `stagger`（第 240 行）
- ✅ `skill_amp`（第 328 行）
- ✅ `sword_master`（在 `weaponTypes.ts` 中复用 `crit_bonus`）
- ⚠️ `projectile` 类型在类型定义中存在，但当前 `weaponTypes.ts` 未使用

**影响**：
- 武器选择存在“算数差异”，但缺乏“手感差异”
- 玩家对不同武器的识别度不足

**方案**：
1. 明确方向二选一：
   - 方向 A：引入真实 `projectile` 机制（新增武器或重定义 staff），补齐 CombatSystem + VFXSystem 弹道逻辑
   - 方向 B：保持现有机制，但补充机制专属反馈（如 cleave 扇形、stagger 命中反馈、skill_amp 施法 aura）
2. `sword_master` 若继续复用 `crit_bonus`，建议在描述层/特效层做差异化，避免与 dagger 同质化
3. 为 6 种武器补齐机制级测试用例（含伤害、状态、反馈触发）

**验证方式**：
- 单元测试覆盖 6 种武器定义的关键行为
- 手动对比 6 种武器至少 1 条“可见反馈差异”是否成立

---

### G3. 升级视觉与音效反馈（体验 · P1）

**问题**：玩家升级时仅在日志中输出"升级！{player} 达到 Lv{level}"，无任何视觉或音效反馈。VFXSystem 中不存在 `playLevelUp` 方法。

**影响**：
- 升级是 ARPG 的核心正反馈，缺乏即时感知会降低成长快感
- 与暴击震屏、Boss Phase 切换等已有特效相比，升级反馈严重缺位

**方案**：
1. 在 VFXSystem 中新增 `playLevelUp(player: EntitySprite)`：
   - 金色光环扩散（复用 `playSkillCast` 的椭圆扩散模式，色值 `0xf1b264`）
   - "LEVEL UP!" 浮动文字（大号、金色、上升消散）
   - 摄像机轻微闪白（`camera.flash(100, 255, 240, 200)`）
2. 在 SFXSystem 中新增升级音效触发
3. 在 DungeonScene 升级逻辑处调用新方法

**验证方式**：
- 手动游戏至升级，确认金色特效 + 浮动文字 + 闪白 + 音效同步出现
- 确认不影响游戏帧率（VFXSystem 的 transient 对象上限保护已存在）

---

### G4. Boss 战技能预警强化（体验 · P2）

**问题**：Boss（Bone Sovereign）有 `heavy_strike`、`bone_spikes`、`summon_hounds` 三个技能，但缺乏玩家可躲避的地面预警。当前 Telegraph 系统基础设施已存在（`EntityManager.addTelegraph` + `RenderSystem.spawnTelegraphCircle`），但仅用于挑战房标记和环境危害区域。

**影响**：
- Boss 战缺乏操作深度，玩家只能"站桩对打"
- 削弱了 Boss 战的紧张感和策略性

**方案**：
1. 为 Boss 的 `bone_spikes` 技能添加 AOE 预警：
   - 释放前 800ms 在目标位置显示红色 Telegraph 圆圈
   - 圆圈从半透明渐变为不透明，表示即将触发
   - 触发后造成伤害，圆圈消散
2. 为 `heavy_strike` 添加方向性预警（扇形或线性指示器）
3. 玩家在预警期间有足够时间移动躲避（需配合寻路响应速度）

**验证方式**：
- Boss 战中 `bone_spikes` 有明确的红色预警区域
- 玩家在预警期间移走可以避免伤害
- 死亡率对比：无预警 vs 有预警，后者应略低（说明操作空间生效）

---

### G5. 装备变更属性对比增强（体验 · P2）

**问题**：当前装备 Tooltip 已有颜色与强度差值对比（`delta-up/down/equal` + `power_delta`），但在高压战斗节奏下仍可进一步强化可读性。

**影响**：
- 快速拾取场景下，玩家仍需扫读文本确认增减项
- 装备替换后的收益感知滞后（HUD 无即时高亮）

**方案**：
1. 保留现有颜色机制，补充方向箭头（`↑/↓`）与视觉层级（正向优先显示）
2. 强化总强度变化展示（维持现有 `power_delta`，增加更醒目的正负样式）
3. 装备更换后短暂高亮受影响的 HUD 关键属性（attack/armor/crit）

**验证方式**：
- Hover 地面装备时 Tooltip 显示与当前装备的颜色对比
- 绿色/红色箭头正确反映实际属性变化方向

---

### G6. Endless 模式深渊突变（体验 · P3）

**问题**：Endless 模式当前已有数值缩放（每层 HP/Damage +25%）和词缀加码（8 层 +1、10 层 +2），但仍缺规则级玩法变化。无排行榜系统。

**影响**：
- 数值膨胀但玩法不变，高层体验单调
- 缺乏挑战自己或他人的动力

**方案**：

**方案 A（推荐）：深渊突变系统**
1. 在 `packages/core` 中新增 `abyssMutator.ts`：
   - 定义 8~10 种全局突变（每隔 3 层叠加一种）
   - 示例突变：
     - `blood_tithe`：玩家每次攻击损失 1% 当前 HP
     - `fog_of_war`：视野半径缩小 30%
     - `rapid_decay`：药水效果减半
     - `monster_regen`：怪物每秒回复 0.5% 最大 HP
     - `trap_frenzy`：环境危害触发频率 ×2
     - `elite_surge`：精英怪比例从 20% 提升到 40%
2. 在 HUD 中展示当前生效的突变列表（图标 + Tooltip 说明）
3. 深渊突变增加 Soul Shards 奖励系数

**方案 B：本地排行榜**
1. 在 MetaProgression 中新增 `endlessLeaderboard: Array<{floor, timeMs, date, mutations}>`
2. MetaMenu 中新增"排行榜"面板，按最高楼层排序
3. 支持每日模式和 Endless 模式独立排行

**验证方式**：
- Endless 第 8、11、14 层分别叠加新突变
- HUD 正确显示突变图标和数量
- 突变效果在战斗和环境中可观测到

---

### G7. 随机事件与商人交互深化（体验 · P3）

**问题**：6 种随机事件已包含风险收益分支（如 `trapped_chest.force_open`、`mysterious_shrine.touch_relic`、`cursed_altar.blood_trade`），但中后期“策略分化”仍不足。商店当前按楼层 `minFloor` 动态，尚未按难度动态。

**影响**：
- 事件选择缺乏策略张力
- 玩家可能形成固定的"最优选择"模式，降低重玩价值

**方案**：
1. 为现有事件增加"高风险高收益"选项：
   - `cursed_altar`：增加"献祭 50% 当前 HP，获得随机稀有装备"选项
   - `mysterious_shrine`：增加"赌博"选项（50% 概率双倍收益，50% 概率负面效果）
   - `trapped_chest`：增加"强行开启"选项（必触发陷阱但保证稀有掉落）
2. 商人物品池在现有楼层动态基础上，进一步引入难度维度：
   - 高楼层提供更高等级的物品
   - Nightmare 难度商人有独占稀有物品
   - 价格随楼层递增

**验证方式**：
- 同一事件在不同选择下有明显不同结果
- 商人在第 1 层和第 5 层的物品池存在差异

---

## 4. 优先级总览与依赖关系

```
E1 (DungeonScene 瘦身) ──┬── E2 (Feature Flag 清理)
                          │
                          └── G1~G3 (依赖清晰的 Scene 结构)

E3 (Hud 拆分) ──────────── G5 (装备对比增强)

E4 (系统测试) ──────────── 可并行，无硬依赖

G1 (Biome 视觉) ─────────── 独立，可并行
G2 (武器机制) ──────────── 独立，可并行
G3 (升级特效) ──────────── 独立，可并行
G4 (Boss 预警) ──────────── 独立（建议在 E1 后实施以降低改动冲突）
G6 (深渊突变) ──────────── 独立（与 G1 无硬依赖）
G7 (事件深化) ──────────── 独立，可并行
```

### 推荐执行顺序

| 阶段 | 工作项 | 预估规模 |
|:---:|---|---|
| **Phase 4.1** | E1 + E2：DungeonScene 旧路径清除 + Flag 清理 | 大（~8 PR） |
| **Phase 4.2** | G1 + G2 + G3：Biome 视觉 + 武器机制 + 升级特效（可并行） | 中（各 1~2 PR） |
| **Phase 4.3** | E3 + E4：Hud 拆分 + 系统测试 | 中（各 2~3 PR） |
| **Phase 4.4** | G4 + G5：Boss 预警 + 装备对比 | 中（各 1~2 PR） |
| **Phase 4.5** | G6 + G7：Endless 突变 + 事件深化 | 中~大（各 2~3 PR） |

---

## 5. 完成标准（DoD）

### 工程指标

- [ ] `DungeonScene.ts` < 2,500 行
- [ ] `uiFlags.ts` 中无遗留 feature flag（或文件已删除）
- [ ] `Hud.ts` < 300 行（拆分后的容器编排器）
- [ ] AISystem / MovementSystem / MonsterSpawnSystem 单元测试覆盖率 > 70%
- [ ] `pnpm ci:check` 全部通过

### 体验指标

- [ ] 6 种 Biome 有可区分的视觉表现
- [ ] 6 种武器类型均有可感知的战斗差异
- [ ] 升级有视觉 + 音效反馈
- [ ] Boss 技能有地面预警且可躲避
- [ ] 装备对比有颜色标注
- [ ] Endless 在现有词缀加码之外引入规则级突变（建议从第 8/11/14 层分段叠加）
- [ ] 至少 3 种事件新增“条件化收益”或“延迟收益”分支（不与现有高风险选项重复）

### 兼容性

- [ ] MetaProgression 存档向后兼容（如需 schema 升级，必须有迁移逻辑）
- [ ] 中英文双语同步更新

---

## 6. 风险评估

| 风险 | 等级 | 缓解措施 |
|---|:---:|---|
| E1 旧路径删除遗漏边缘 case | 中 | 逐模块 PR + 每 PR 手动冒烟 + 自动化测试 |
| G1 贴图资产缺失 | 低 | 可用 Phaser tint 着色替代自定义贴图 |
| G4 Boss 预警改变难度平衡 | 中 | 需同步调整 Boss 数值（伤害略增以补偿可躲避） |
| G6 深渊突变过于惩罚性 | 中 | 设计时确保每种突变有对应的应对策略 |
| 大规模重构期间引入回归 bug | 中 | 遵循 E1 逐模块策略 + CI 门禁 + 手动冒烟 |

---

## 7. 建议补充的执行护栏（增强项）

### 7.1 PR 级验收矩阵（建议新增）

为避免 E1/E3 大改动“看起来通过，实际上回归”，建议每个 PR 附带固定验收矩阵：

- 自动化：`pnpm ci:check` + 相关模块测试（最小子集）
- 玩法冒烟：Normal 1 层、5 层、Boss 层各 1 次
- 性能快检：HUD 高频战斗场景 30 秒录制，记录长帧比例
- 回档验证：保存后重进，验证 Run/Meta 关键字段一致

### 7.2 存档迁移测试（建议新增）

G6/G7 可能引入 Meta 字段扩展（例如排行榜、突变记录），建议把“向后兼容”从口号变成显式测试：

- 使用 `v1/v2/v3` 历史存档样本跑一次加载回归
- 对未知字段、缺失字段、老字段做容错断言
- 在 `packages/core/src/__tests__/save*.test.ts` 增加迁移用例

### 7.3 DoD 增加“可观测性”约束（建议新增）

当前 DoD 偏功能结果，建议补三条可观测指标：

- 关键事件日志覆盖：`player:levelup`、`boss:*`、`merchant:*`、`event:*`
- 核心循环指标：平均每分钟击杀、受伤次数、事件交互次数
- Endless 指标：到达 8/11/14 层的人次占比（用于评估突变强度）
