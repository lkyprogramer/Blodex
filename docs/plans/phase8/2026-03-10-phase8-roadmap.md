# Phase 8 总体执行路线图（战斗主动性、持续反馈与节奏兑现）

**日期**: 2026-03-10  
**状态**: Proposed  
**适用分支**: `main`  
**前置输入**:

1. `docs/plans/phase7/2026-03-09-phase7-final-summary-report.md`
2. `docs/plans/phase7/2026-03-07-phase7-technical-debt-first-refactor-roadmap.md`
3. `docs/architecture.md`
4. `docs/art-style-bible.md`

---

## 1. 直接结论

Phase 7 已经把系统骨架、运行时闭环、内容体量和资源入口做到了一个可持续迭代的基线。  
Phase 8 不应该继续优先堆 Boss、元素、楼层或系统数量，而应该优先解决三个会直接决定玩家体感的问题：

1. **战斗主动性不够**  
   当前战斗仍主要依赖移动、自动攻击和技能补充，缺少真正的主动规避与反应性动词。
2. **构筑反馈不够持续可见**  
   Buff、元素、套装、协同已经进入规则链路，但玩家在 run 中缺少稳定、持续、可解释的状态反馈。
3. **节奏结构不够强**  
   8 层拓扑和节点已经成立，但“紧张 -> 喘息 -> 准备 -> 高潮”的情绪分段仍不明显。

因此，Phase 8 的主题定义为：

`把 Phase 7 已完成的系统和内容，兑现成更强的操作感、反馈感和叙事节奏。`

执行顺序必须固定为：

1. `8.0A` 战斗主动性（Combat Agency）
2. `8.0B` 持续反馈层（Feedback Surface）
3. `8.0C` 节奏设计（Pacing Pass）
4. `8.1` 第二批内容扩展（仅在前三者完成后允许启动）

本路线图已经拆分为逐阶段执行文档：

1. `docs/plans/phase8/2026-03-10-phase8-8.0a-combat-agency.md`
2. `docs/plans/phase8/2026-03-10-phase8-8.0b-feedback-surface.md`
3. `docs/plans/phase8/2026-03-10-phase8-8.0c-pacing-pass.md`
4. `docs/plans/phase8/2026-03-10-phase8-8.1-content-batch-two.md`
5. `docs/plans/phase8/2026-03-10-phase8-resource-generation-plan.md`

---

## 2. 当前主干基线（Phase 8 输入事实）

基于 `main` 当前状态，以下事实已经成立：

### 2.1 已完成的基础能力

1. `DungeonScene / HudContainer / MetaMenuScene` 已从 God Object 级别压回硬预算。
2. `RunSaveV3`、evidence registry、content gate 已经形成稳定基线。
3. `story run` 已扩到 `8` 层，并具有：
   - 分叉楼层；
   - merchant 保底楼层；
   - challenge 保底楼层；
   - 中期固定事件节点；
   - endless 入口。
4. `Boss`、`merchant`、`consumable`、`set`、`element`、`enemy profile` 已进入真实运行时主链。
5. Phase 7 的高频运行时视觉资源已补齐到可用状态。

### 2.2 已知仍未解决的体验问题

当前主干的战斗操控模型仍然是：

`click-to-move + 自动攻击 + 主动技能/消耗品补充`

Phase 8 的战斗设计必须在这个事实基础上定义，而不是假定当前已经是纯 WASD/主动攻击模型。

1. 没有真正的 `dodge / roll / parry`。
2. `shadow_step / rift_step / wind_dash` 等位移语义技能仍未真正改变玩家坐标。
3. Buff / Debuff 规则已生效，但缺少独立 HUD 状态栏。
4. 元素克制与抗性规则已存在，但缺少清晰的玩家反馈。
5. 当前节奏点存在，但玩家很难明确感受到“准备室 / 安全区 / 蓄势窗口”。

### 2.3 已经改善、无需重复立项的点

1. 移动输入已支持更快打断旧路径，且基础移动速度已小幅上调。
2. 技能槽位默认已提升到 `3`，系统上限提升到 `5`。
3. 技能槽位已满时不再默认替换第一个技能，而是显式选择替换目标。
4. 重复选择同技能已经明确作为技能升级链路存在。

Phase 8 不应把这些已解决点重新当作主问题立项。

---

## 3. Signature Experience（Phase 8 口径）

Phase 8 的目标不是“新增更多内容”，而是让玩家在同一局中持续感受到以下体验：

1. **我可以主动规避和反应，而不是只看角色自动打。**
2. **我知道自己当前 build 在怎么生效。**
3. **8 层 run 有明确的起伏、准备和高潮，而不是简单地重复刷层。**

Phase 8 冻结口径：

`玩家在普通 run 中必须持续感知到战斗主动性、构筑持续反馈和层间节奏差异；Phase 8 的完成标准以这些体验合同为主，而不是新增系统数量。`

---

## 4. 全局硬约束

1. 不允许把业务逻辑重新回流到 `DungeonScene / HudContainer / MetaMenuScene`。
2. Phase 8 不得破坏以下既有门禁：
   - `check:architecture-budget`
   - `phase7:content-gate:check`
   - `phase6:evidence:check`
3. 所有新增战斗反馈与 HUD 语义，必须：
   - 有明确 runtime 数据来源；
   - 有玩家可见表现；
   - 有测试或至少可验证白盒路径。
4. 新增资源必须继续遵循：
   - `art-style-bible`
   - `asset-plan / manifest / assets:validate`
   - `audio-plan / audio-manifest / assets:audio:validate`
5. 不允许用“新增更多 toast”替代持续反馈层建设。
6. 在 `8.0A ~ 8.0C` 完成前，不允许优先启动新的大型内容池扩展。

---

## 5. 非目标

1. 不新增第 4 个职业。
2. 不优先继续扩主线楼层数到 `10+`。
3. 不优先继续扩新的元素种类或第二批大型 Boss 池。
4. 不做新的架构大重构，除非是 Phase 8 实现中暴露出的局部必要拆分。
5. 不以“系统更多”作为完成指标。

---

## 6. 三个核心问题定义

### 6.1 问题一：战斗缺少主动动词

当前战斗主循环仍然主要是：

`移动 -> 自动攻击 -> 技能补充`

缺失的不是“更多技能”，而是：

1. 主动规避；
2. 瞬时位移；
3. 对 telegraph 的可回应性；
4. 操作引发的高质量风险-收益判断。

### 6.2 问题二：构筑反馈缺少持续可见层

当前规则链已具备：

1. Buff/Debuff
2. 元素抗性与克制
3. Set/Synergy
4. Talent/Consumable

但玩家缺少持续性 UI/反馈层来理解：

1. 我当前身上有什么状态；
2. 为什么这次伤害更高/更低；
3. 什么时候 build 达成关键阈值；
4. 我的套装/协同是否仍然在生效。

### 6.3 问题三：节奏点存在，但情绪结构不够强

当前 8 层 run 已有结构性节点，但“准备、休整、蓄势、高潮”的情绪对比仍然不足。  
Phase 8 要解决的是：

1. 让节点不仅存在，而且有清晰情绪功能；
2. 让 Boss 前后形成明显的段落感；
3. 让 8 层 run 更像一条有叙事节奏的旅程，而不是更长的线性刷图。

---

## 7. 阶段顺序（8.0A ~ 8.1）

### 8.0A Combat Agency（P0）

**目标**: 让玩家在战斗中拥有真正的主动规避与反应能力。

#### Dodge 交互设计冻结

Phase 8 默认采用以下交互方案，不在 `8.0A` 内部反复摇摆：

1. **输入方式**
   - 默认按键：`Space`
   - `Space` 在 `event overlay / compare prompt / blocking overlay` 打开时不生效
   - 鼠标右键仍保留给现有点击移动/交互模型，不与 dodge 复用
   - 当前主干没有既有 `Space` 绑定冲突，`8.0A` 不需要先做键位迁移
2. **方向判定**
   - 若当前存在最近一次有效移动输入向量，则按该向量翻滚
   - 否则按 `玩家 -> 鼠标当前世界坐标` 的归一化方向翻滚
   - 若两者都不可用，则回退为 `玩家面朝/最近移动方向`
   - 这里的“最近一次有效移动输入向量”明确指最近一次 click-to-move 点击目标相对于玩家当前位置的归一化方向，不使用 A* 当前路径段方向
3. **初始参数**
   - 位移距离：`2` 格
   - 无敌帧：`80ms`
   - 冷却：`700ms`
   - 这些值是首版参数，不视为最终调优值，但 `8.0A` 不得低于“可明显规避 telegraph”的体感下限
4. **与当前移动/自动攻击的关系**
   - dodge 会立即取消当前路径
   - dodge 会立即打断当前自动攻击动作与目标追踪
   - dodge 会显式清空当前 `attackTargetId`
   - dodge 结束后**不自动恢复旧路径，也不自动走回目标**
   - 玩家必须通过新的移动输入或新的攻击意图重新进入战斗
5. **与不可通行格子的关系**
   - dodge 沿目标方向做逐格 walkability 检查
   - 若完整 `2` 格路径都可通行，则落到目标格
   - 若中途遇到不可通行格子，则停在最后一个可通行格子
   - 不允许穿墙，也不允许停在不可通行格子内部
   - 若第 `1` 格即被完全挡住，则记为 `blocked dodge`：
     - 不位移
     - 不进入无敌帧
     - 不消耗冷却

#### 自动攻击立场

Phase 8 在 `8.0A` 采用以下立场：

1. **保留自动攻击**
2. 自动攻击不再凌驾于 dodge 之上
3. dodge 是高优先级输入，会中断：
   - 当前路径
   - 当前自动攻击动作
   - 当前近战追敌行为

原因：

1. 这是改动成本最低、风险最可控的方案；
2. 不会强行推翻当前 click-to-move + auto-attack 的用户习惯；
3. 足以建立 `telegraph -> dodge -> 重新决策` 的主动性闭环。

#### Dodge 最低视觉标准

`8.0A` 不要求完整 sprite-sheet 动画，但必须至少满足以下 tween 级表现标准：

1. dodge 期间角色有明确 `tint / alpha` 变化，表示无敌帧
2. dodge 路径上生成短残影或速度拖尾
3. 落地时有轻微 camera nudge 或等价速度反馈
4. 如果看不出“角色在翻滚/闪避”，则视为 `8.0A` 未完成

#### 主要工作

1. 新增 `dodge / roll`：
   - 独立输入；
   - 固定短位移；
   - 明确冷却；
   - 短无敌帧。
2. 让 `shadow_step / rift_step / wind_dash` 真正改变玩家坐标。
3. `Boss telegraph -> dodge success -> damage avoided` 闭环成立。
4. 所有主动位移必须：
   - 可打断当前路径；
   - 与点击移动和平共存；
   - 不破坏现有 auto-attack / skill 逻辑。

#### 推荐 PR 拆分

1. `PR-8.0A-01`：`DodgeRuntime` + 输入绑定 + 路径/攻击打断 + 基础无敌帧
2. `PR-8.0A-02`：位移技能真实改坐标（`shadow_step / rift_step / wind_dash`）
3. `PR-8.0A-03`：Boss telegraph 规避闭环 + dodge 白盒/浏览器验证

#### 架构放置建议

1. `DodgeRuntime` 放在 `apps/game-client/src/scenes/dungeon/shell/`
2. `core` 层位移契约在 `8.0A` 冻结为显式 `displacement` 描述，不采用按 skill id 在 scene 侧特判
3. teleport/displacement 的坐标应用与运行时表现通过 scene-side runtime/host 接入
4. telegraph evade 判定继续收在 `encounter/` 侧，不回流到 `DungeonScene`

#### 出口门禁

1. 玩家可以通过主动输入规避 AoE 或关键攻击。
2. 位移技能不再只是文字语义，而是真位移。
3. Boss 战中“站着挨打”和“主动规避”有明确结果差异。
4. 白盒测试和浏览器烟测都能验证这条链。

#### 验证建议

1. 技能位移后坐标变化测试
2. dodge i-frame 与 cooldown 测试
3. telegraph 命中/未命中两条路径测试
4. 浏览器白盒：
   - 进入 boss floor
   - 触发 telegraph
   - dodge 成功规避

---

### 8.0B Feedback Surface（P0）

**目标**: 让玩家持续感知到自己的状态、build 和元素关系。

#### 内部优先级

`8.0B` 内部执行顺序固定为：

1. `P0` Buff / Debuff HUD 图标栏
2. `P0` Combat feedback 分层 + 关键操作音效
3. `P1` 元素克制/抗性提示
4. `P1` Set / Synergy 持续激活标记

原因：

1. Buff rail 和 combat feedback 是持续体感的第一层；
2. 元素与 set/synergy 的价值建立在玩家已经能稳定看懂基础反馈之后。

#### 主要工作

1. 新增 Buff / Debuff HUD 图标栏：
   - buff 图标；
   - 剩余时间；
   - 来源区分（技能 / consumable / debuff）。
2. Combat feedback 分层：
   - 暴击；
   - 闪避；
   - 普通命中；
   - 关键防御结果（首版仅处理 dodge/evade，`Block / Guard` 当前未实现，仅预留分类枚举）；
   - 不同反馈层级要有明确颜色/字重/持续时间区分。
3. 新增关键操作音效反馈：
   - dodge 成功
   - crit 命中
   - 元素弱点命中
   - buff 激活
4. 元素克制与抗性提示：
   - `Weak`
   - `Resist`
   - 可区分的伤害色彩或标签；
   - 仅当倍率达到阈值时才显示。
5. Set / Synergy 持续激活标记：
   - 激活状态标识；
   - 套装层数；
   - 协同激活提示不再只靠 toast。

#### Buff Rail 布局冻结

为避免 `8.0B` 实现成“状态噪音墙”，Buff / Debuff HUD 图标栏采用以下固定规则：

1. 默认最多展示 `6` 个图标位
2. 超出部分显示为 `+N`
3. 排序优先级固定为：
   - Debuff
   - 生存相关 Buff
   - 输出相关 Buff
   - 工具/功能类 Buff
4. 同类内部按剩余时间从短到长排序
5. 不允许在 `8.0B` 首版中引入横向无限展开的滚动条或第二排图标
6. `Set / Synergy` 持续激活标记不占用 buff rail 的 `6` 个状态位，使用独立 persistent indicator 区域承载

#### 元素反馈阈值冻结

基于当前 `enemyProfiles.ts` 中仍存在 `+6% / -6%` 这类保守倍率，`8.0B` 采用以下 UI 阈值：

1. `damageProfile[type] >= 1.10` 才显示 `Weak`
2. `damageProfile[type] <= 0.85` 才显示 `Resist`
3. 介于两者之间的轻微修正仍生效，但默认不显示显式标签

如果后续要把元素系统做得更重，应该在 `8.1` 之后单独上调 profile 极差，而不是在 `8.0B` 用夸大的 UI 提示掩盖保守数值。

#### Buff 分类冻结

`8.0B` 首版状态分类固定为：

1. `frost_slow` -> `Debuff`
2. `war_cry` -> `输出`
3. `guaranteed_crit` -> `输出`
4. `frenzy_tonic` -> `输出`
5. `phantom_brew` -> `工具`

#### 推荐 PR 拆分

1. `PR-8.0B-01`：Buff / Debuff HUD 图标栏
2. `PR-8.0B-02`：Combat feedback 分层 + 关键 SFX
3. `PR-8.0B-03`：元素提示 + set/synergy 持续标记

#### 架构放置建议

1. Buff rail 不直接堆回 `HudContainer`，优先新增 `HudBuffController` / `HudStatusRailPresenter`
2. combat feedback 继续通过 `feedbackEventRouter + SFXSystem + VFXSystem` 扩展
3. 元素提示在 combat event metadata 上补“有效性分类”，避免 UI 层自己再计算一次
4. set/synergy persistent indicator 放在 HUD/controller 层，不重复依赖瞬时 toast

#### 出口门禁

1. 玩家能在 HUD 上持续看到关键 buff/debuff。
2. 元素抗性和弱点具有玩家可见反馈。
3. 套装/协同激活不是只在日志或 code path 中存在。
4. 关键反馈不会只停留在瞬时 toast。

#### 验证建议

1. Buff HUD 图标渲染与倒计时测试
2. 元素命中反馈样式测试
3. Set/Synergy 标记测试
4. 浏览器白盒：
   - 使用 `frenzy_tonic`
   - 触发 `war_cry / frost_slow / guaranteed_crit`
   - 命中弱点/抗性目标

---

### 8.0C Pacing Pass（P1）

**目标**: 把现有 8 层拓扑变成有清晰情绪结构的 run。

#### 主要工作

1. `4 -> 5` 增加中段准备/整理窗口。
2. `7 -> 8` 增加最终 Boss 前准备窗口。
3. 强化当前既有节点的情绪功能：
   - merchant：补给与整理
   - forge：强化与 build 推进
   - gamble：风险与赌局
   - challenge：节奏升压
4. 调整节点前后的怪物密度与情绪对比，而不是单纯继续加楼层。

#### 节奏节点语义冻结

`8.0C` 默认采用以下实现口径：

1. 准备室/休整窗口是**现有 8 层拓扑内的非战斗节点或保底房间语义**
2. `8.0C` 不通过新增 story floor 数来实现准备室
3. 准备室的最低语义要求：
   - 无普通怪物生成
   - 不保留上一段战斗的自动攻击锁定
   - 允许玩家完成补给、整理 build、确认下个目标
4. 当前 story topology 的最终 Boss 位于 `floor 8`
5. `8.0C` 首版按“单一最终 Boss 在 floor 8”冻结，不假定存在 `floor 5` mid-boss
6. `8.0C` 首版不把“Boss 后休整节点”列为 story mode 必做项；story 模式优先做 Boss 前准备与 Boss 后结算收束

#### 推荐 PR 拆分

1. `PR-8.0C-01`：中段准备窗口 / 最终 Boss 前准备窗口
2. `PR-8.0C-02`：story finale 的 compare / reward / summary 收束强化 + floor pacing evidence 更新
3. `PR-8.0C-03`：merchant/forge/gamble/challenge 的情绪功能强化

#### 架构放置建议

1. 节奏节点与楼层编排继续放在 `scenes/dungeon/world/` 与 `storyRun` 相关配置中
2. 不把“准备室/休整节点”逻辑散落进 `DungeonScene`
3. dedicated evidence 继续通过 `phase7:long-run:evidence:report` 或等价入口维护

#### 出口门禁

1. `8-floor` run 至少有两处清晰的准备/整理窗口。
2. `7 -> 8` 的最终 Boss 前节奏与普通楼层明显不同。
3. 新节奏结构不会破坏 `7.8B` 的 long-run evidence。

#### 验证建议

1. dedicated `8-floor` evidence 更新
2. floor-level pacing 报告
3. 浏览器白盒：
   - `jumpFloor(4)` / `jumpFloor(7)` 验证准备窗口
   - 完成 Boss 后验证 compare / reward / summary 收束

---

### 8.1 Content Batch Two（P2，受前置门限制）

**目标**: 只有在 `8.0A ~ 8.0C` 完成后，才开启下一批内容扩展。

#### 候选内容

1. 第二批 Boss
2. 更多元素/敌人画像
3. 更深的 set / item batch
4. 更强的中后段 challenge 变体

#### 启动前提

1. `8.0A` 已完成
2. `8.0B` 已完成
3. `8.0C` 已完成
4. 玩家已经能持续感知 battle/build/pacing 三条主线
5. `phase8:content-gate:check` 已通过

---

## 8. 建议验证矩阵

### 8.A 自动化

1. `typecheck`
2. 关键 runtime 测试
3. UI/HUD 渲染测试
4. `phase7:content-gate:check`
5. `phase7:long-run:evidence:report`
6. `phase8:content-gate:check`

### 8.B 浏览器白盒

1. 新开局与继续挑战
2. boss floor
3. challenge floor
4. dodge / roll
5. teleport skill
6. buff HUD
7. element feedback
8. set/synergy persistent indicator
9. 8-floor pacing节点

### 8.C 人工体验检查

1. 玩家是否能明确感受到“我在战斗，而不是 AI 在替我打”
2. 玩家是否能解释“这次 build 为什么成型了”
3. 玩家是否能感受到 run 前中后段节奏有区别

---

## 9. 风险与止损

### 9.1 风险：战斗主动性改造破坏现有移动系统

止损：

1. 先通过独立 runtime/controller 注入；
2. 不直接重写 `MovementSystem` 的基础路径逻辑；
3. 先做 `dodge` 的最小闭环，再扩展更多位移动词。

### 9.2 风险：反馈层过度堆 UI，反而噪音化

止损：

1. 优先做持续状态栏，不先堆更多 toast；
2. 每类反馈限定优先级和出现频率；
3. 先做最关键的 `buff / element / set / synergy`。

### 9.3 风险：节奏设计变成继续堆节点数量

止损：

1. 不以“新增节点种类”作为完成指标；
2. 先强化现有 8 层结构的情绪差异；
3. 所有新节点都必须回答“它在节奏上承担什么功能”。

---

## 10. 一句话总结

Phase 8 不该再优先加更多骨头。  
它的任务是让 Phase 7 已经长出来的骨架、肌肉和器官，真正被玩家感受到。

如果 Phase 7 解决的是“系统能不能成立”，  
那么 Phase 8 要解决的是：

`玩家能不能清楚地操作、感知并记住这局 run。`
