# Phase 6 总体执行路线图（体验兑现、战斗节奏与契约收口）

**日期**: 2026-03-06  
**状态**: Proposed  
**适用分支**: `main`

---

## 1. 直接结论

Phase 6 的目标不是继续堆系统，而是把 Phase 5 已有的系统兑现成玩家真正能感知、能决策、能记住的体验。

基于当前代码核实，Phase 6 必须同时解决七类问题：

1. `choice` 已有骨架，但很多仍是后台逻辑，不是玩家代理权。
2. `power spike` 缺少 runtime 保底、幅度标准和 Boss 奖励闭环。
3. `taste` 已有 run 内采集和 run-end 诊断，但缺少 run 中途的消费者。
4. 战斗节奏仍高度依赖自动攻击，技能因 `mana + CD` 双重门槛而更像点缀。
5. 属性与装备的 trade-off 不够清晰，例如 DEX 过于全能、装备大多只做正向堆高。
6. 已有部分系统仍停留在“内容定义存在、runtime 不闭环”的状态，例如 buff/debuff、damageType、synergy 激活反馈。
7. 仍存在契约漂移与类型边界债，例如：
   - `damageOverTime` 名称语义与实现不一致；
   - `boss` 胜利路径未形成明确 runtime 掉落闭环；
   - `scenes/dungeon/*` 仍残留大量 `[key: string]: any` Host Port。

因此，Phase 6 的主题定义为：

`从“规则正确”升级到“体验兑现”；从“事后诊断”升级到“过程反馈”；从“局部修补”升级到“可签署的体验合同”。`

---

## 2. Phase 6 输入问题清单（基于已核实结果）

### 2.1 玩家代理权不足

1. `ensureFloorChoiceBudget` 只保证“每层至少一次属性面板式选择”，并不保证“每层至少一次高深度构筑选择”。
2. 升级属性仍以 `+1 STR/DEX/INT/VIT` 为主，属于微调而不是路线塑形。
3. 升级技能目前是后台加权抽取并自动写入技能槽，不是玩家可见的 `3 选 1`。

### 2.2 战斗节奏缺口

1. 普通战斗主轴仍是自动攻击，技能为手动补充。
2. 当前没有常驻 `mana` 自动回复；法力主要来自初始法力池、击杀 `+4`、药水和事件。
3. 多数技能 CD 位于 `5s~12s`，高值技能到 `15s`，配合 mana 成本后，技能更像稀缺资源而不是循环主轴。
4. 当前没有玩家主动触发的 `dodge / parry / active defense` 机制；已有的 `dodgeChance / on_hit_invuln / lethal_guard` 更偏被动触发。

### 2.3 战力跃迁没有被编码成 runtime 合同

1. 稀有掉落存在楼层门槛，但普通流程没有“每 2 层至少一次跃迁”的明确保底状态机。
2. `boss` 相关掉落接口存在于 core / simulator，但实机场景胜利路径未体现明确消费闭环。
3. 当前很多“跃迁”仍停留在数值变化，没有配套表达层事件。
4. 当前没有“跃迁幅度”最低标准，导致即使次数满足，也可能只有轻微数值变化。

### 2.4 表达层缺口

1. rare / unique 掉落没有独立 VFX / SFX / 屏幕表现。
2. build identity 已可在 taste runtime 中被记录，但没有“build 成型”实时反馈。
3. Equipment compare 只存在于背包 hover tooltip，没有拾取时的主动展示。
4. 普通战斗有规则和日志，但高压时刻的情绪调度仍弱。

### 2.5 属性与装备 trade-off 不足

1. DEX 当前同时贡献 `armor + critChance + attackSpeed + moveSpeed`，过于全能。
2. 当前代码里，VIT 也贡献 `maxHealth + armor + moveSpeed`，但与 DEX 的边界仍不够干净。
3. 当前同 slot 装备大多是“更高数值”而不是“不同代价下的更强/更稳”。
4. 物品内容数据目前基本只有正向 affix；若直接引入负面词缀，还需先修 HUD / tooltip 的 signed value 表达。

### 2.6 语义与契约漂移

1. `damageOverTime` 已有数值效果，但现在实现更像“技能平伤加成”，不是名字承诺的 DOT runtime。
2. `arcanist` 只有 2 个默认可用技能，3 个核心技能被 blueprint 锁定，和 warrior / ranger 明显不对齐。
3. `Host Port` 的类型边界仍不稳，`[key: string]: any` 与 Phase 5 V2 合同冲突。

### 2.7 运行时效果闭环与身份维度缺口

1. `resolveSkill()` 已能产出 `buffsApplied`，但 runtime 没有把它写回 player / monster state，也没有统一 `BuffRegistry` 消费链。
2. `PlayerState.activeBuffs` 已存在，但 `MonsterState` 缺少对应承载；`war_cry / guaranteed_crit / frost_slow` 这类效果在实机里没有真正闭环。
3. `damageType` 已贯穿 skill def 与 combat event 契约，但结算层没有 `physical / arcane` 差异化规则。
4. `synergyRuntime` 已可计算激活结果，但玩家侧没有“synergy activated”反馈，触发后仍然像隐形数值。

### 2.8 节奏与时长控制缺口

1. 目前只有 `elapsedMs` 结算记录，没有主流程 pacing engine。
2. 没有 floor-level time target、节奏偏移报警、动态补偿或明确的 15 分钟调优框架。

---

## 3. Phase 6 Signature Experience（冻结口径）

Phase 6 延续原口径，但收紧为可观测合同：

`15 分钟 5 层地牢；每层至少 1 次玩家可感知的关键构筑选择；每 2 层至少 1 次玩家可感知且达到最低幅度标准的战力跃迁。`

### 3.1 关键选择合同

关键选择必须满足全部条件：

1. 玩家显式看到候选项。
2. 玩家主动做决定，而不是后台自动分配。
3. 选择结果在 `30~90s` 内能被感知。
4. 选择结果会影响后续装备、技能、路线或生存节奏中的至少一项。

合法来源：

1. 升级技能选择
2. 升级属性选择（仅在有 delta preview 且能形成显著偏向时）
3. 路线分叉
4. 事件 sacrifice / reward
5. 商店与装备替换抉择
6. 核心 blueprint / mutation / rare 装备抉择

### 3.2 战力跃迁合同

战力跃迁必须同时满足：

1. 结算层真实生效；
2. 运行时写入 `power_spike` 事件；
3. 表达层有明确 cue；
4. 玩家能在短窗口内感知清怪效率、存活能力或操作节奏的变化；
5. 达到最低幅度标准。

最低幅度标准：

1. Offensive spike：预测 DPS `>= +30%`，或代表性目标 TTK `<= -25%`。
2. Defensive spike：EHP `>= +40%`，或 sustain score `>= +35%`。
3. 每局至少有 1 次 major spike：单一维度达到 `>= +50%` 的可感知跃迁。

合法来源：

1. rare / unique 掉落
2. 技能解锁或关键技能升级
3. build threshold 达成
4. 路线 pivot 导致的装备池重塑
5. boss / elite 奖励

### 3.3 战斗节奏合同

Phase 6 不承诺完整主动防御系统重写，但必须满足最低战斗节奏合同：

1. 技能不再只是偶发点缀，而是稳定进入战斗循环。
2. 常规战斗中，玩家平均每 `2.5s~4s` 至少有一次主动输入窗口。
3. 通过 `mana regen / cooldown / skill offer` 调优后，技能输出占比必须显著提升。
4. 若仅靠数值调优仍无法满足该合同，再把主动闪避 / 防反立为后续阶段输入，而不是在本轮提前承诺完整重写。

### 3.4 心跳时刻合同

每局至少需要 4 个玩家可记忆心跳时刻：

1. 第一件定义构筑的核心件
2. 第一次 build 成型提示
3. 一次高压战斗峰值（elite / boss / near-death reversal）
4. run-end 失败分析或下一局建议

### 3.5 系统闭环合同

1. 已进入内容定义的 buff/debuff 必须在 runtime 真正生效，不能只停留在 `buffId`。
2. `physical / arcane` 至少形成最小策略差异，不再只是日志标签。
3. `synergy` 激活必须在玩家侧可感知，而不是只写入 meta 发现或 debug 输出。

---

## 4. 全局硬约束

1. 不考虑旧存档兼容，允许直接调整 `RunState / Save / Meta` 结构。
2. 不允许业务逻辑回流 `DungeonScene / MetaMenuScene / HudContainer`。
3. 继续遵守架构预算：
   - `DungeonScene.ts <= 1500`
   - `MetaMenuScene.ts <= 650`
   - `HudContainer.ts <= 450`
4. 新增视觉资源必须沿用 `asset-plan -> manifest -> assets:validate`；新增音频资源必须沿用 `audio-plan -> audio-manifest -> assets:audio:validate`。
5. 所有新增玩家可见语义，必须在规则链路可追踪；所有新增规则语义，必须在玩家侧可感知。
6. 新增 runtime 事件命名统一进入 Taste / Feedback / RunLog 三条链，不允许只写一半。

---

## 5. 非目标

1. 不新增第 4 个职业或全新职业大类。
2. 不新增长线 meta 经济系统。
3. 不做完整战斗系统重写。
4. 不扩展主线楼层数，仍以 5 层短程 run 为基线。
5. 不做大规模美术风格改版；Phase 6 优先解决反馈时机、反馈强度、选择深度与战斗节奏，而非整体换皮。

---

## 6. 阶段顺序（6.0 ~ 6.5）

### 6.0 基线冻结、观测补线与架构边界收口（P0）

**目标**: 把 Phase 6 要解决的问题从评论语义转成 runtime 可观测对象，并同步清理会阻碍后续迭代的 Host Port 边界。

#### 主要工作

1. 冻结 Phase 6 体验合同与事件字典。
2. 引入统一事件：
   - `player_facing_choice`
   - `power_spike`
   - `build_formed`
   - `rare_drop_presented`
   - `boss_reward_closed`
   - `combat_rhythm_window`
3. 给 run log、taste runtime、summary 增加对应统计口径。
4. 输出一版 Phase 6 baseline 报告：
   - 每层 choice 次数
   - 每局 spike 次数
   - build formed 次数
   - 平均 run 时长
   - 技能释放频率
   - 自动攻击 / 技能伤害占比
   - 平均无主动输入间隔
5. 在 `RealBalanceSimulator` 或等价工具中补齐至少一版“带技能使用”的观测路径；在该能力就绪前，不允许只用现有 simulator 为战斗节奏签署。
6. 清理 `scenes/dungeon/*` 中阻碍后续迭代的核心 `[key: string]: any` Host Port。
7. 输出一版 `cue asset gap audit`：
   - 明确 6.3 必需新增的音频 cue；
   - 明确可复用的现有视觉表现；
   - 明确可选而非 P0 的视觉资产增量。
8. 输出一版 `runtime effect gap audit`：
   - 明确 `buffsApplied -> player/monster state` 的断点；
   - 明确 `damageType` 在结算层的空转位置；
   - 明确 `synergy activated` 玩家侧缺失的反馈入口。

#### 重点模块

1. `apps/game-client/src/scenes/dungeon/taste/*`
2. `apps/game-client/src/scenes/dungeon/run/*`
3. `apps/game-client/src/systems/feedbackEventRouter.ts`
4. `apps/game-client/src/scenes/dungeon/logging/*`
5. `apps/game-client/src/scenes/dungeon/*Runtime*`

#### 出口门禁

1. 所有 Phase 6 关键体验项都能被事件化记录。
2. 现有 run summary 能展示 choice / spike / build formed / rhythm 基本统计。
3. 核心 dungeon runtime module 不再依赖裸 `any` Host。
4. 6.3 所需资源缺口已被归档为“音频必需 / 视觉可选 / 现有可复用”三类。
5. 6.1 所需的 buff / damageType / synergy 缺口已被量化。

---

### 6.1 玩家代理权、战斗节奏与职业起步深度（P0）

**目标**: 让“每层至少一次关键选择”从预算兜底升级为玩家可感知的高价值选择，并把战斗从“主要看自动攻击”拉回到“技能稳定参与循环”。

#### 主要工作

1. 把升级技能从后台自动发放改成玩家可见的 `3 选 1`。
2. 为升级属性面板增加 `delta preview`：
   - 伤害变化
   - 生存变化
   - 关键技能收益变化
3. 调整 `floor choice budget` 的定义：
   - 从“本层至少一次选择面板”
   - 升级为“本层至少一次 player-facing high-value choice”
4. 引入最低战斗节奏调优：
   - 加入基础 mana 自动回复；
   - 重排核心技能 CD，使常规技能进入 `2s~5s` 主循环；
   - 保留高影响技能的较长 CD，但不允许全职业都依赖长窗等待。
5. 给战斗节奏设运行时指标：
   - 每 30s 技能释放次数
   - 自动攻击 / 技能伤害占比
   - 平均无主动输入窗口长度
6. 补齐 `arcanist` 起步深度：
   - 把 blueprint 从“解锁基础玩法”收口为“扩展或强化玩法”；
   - 起步技能池与 warrior / ranger 做可用性对齐。
   - 默认优先采用最小成本方案：移除 `chain_lightning / spirit_burst / rift_step` 的基础 `unlockCondition`，并把原 blueprint 改成高级变体、强化或额外修饰解锁；仅当该方案验证失败时，再考虑新增无 blueprint 门槛的新技能。
7. 补齐 `buff/debuff` runtime 闭环：
   - 引入权威 `BuffDefMap / BuffRuntimeRegistry`；
   - 让 `resolveSkill().buffsApplied` 真正落到 player / monster runtime；
   - 统一 apply / update / expire 与属性、移速、暴击保证的消费链。
8. 引入 `DamageTypeResolverV1`：
   - `physical` 继续主受 armor 影响；
   - `arcane` 获得最小差异化结算，不再与 physical 完全同轨；
   - 不在 Phase 6 承诺完整元素抗性表。

#### 调优原则

1. 优先用数值与资源曲线改节奏，不先承诺完整主动防御重写。
2. 若 Phase 6.1 结束后技能仍无法成为循环主轴，再把主动闪避 / 防反列入后续版本输入。
3. 6.1 默认复用现有 skill icon、面板样式与基础 UI 声音，不把新增美术/音频资源作为前置。

#### 交付件

1. `LevelUpSkillOfferDialog`
2. `LevelUpStatDeltaPreview`
3. `FloorChoiceBudgetV2`
4. `CombatRhythmTelemetry`
5. `ManaRegenBaseline`
6. `ArcanistOpeningParity`
7. `BuffRuntimeClosure`
8. `DamageTypeResolverV1`

#### 出口门禁

1. 每层至少有 1 次 `player_facing_choice`。
2. 技能成长从后台逻辑变成玩家代理权。
3. 常规战斗中，玩家平均每 `2.5s~4s` 有一次主动输入窗口。
4. `arcanist` 开局深度不再明显低于 warrior / ranger。
5. `war_cry / shadow_step / frost_nova` 这类 buff/debuff 技能在 runtime 中真实生效。
6. `physical / arcane` 差异对玩家可感知，`arcanist` 获得最小身份维度。

---

### 6.2 战力跃迁保底、跃迁幅度与 Boss 奖励闭环（P0）

**目标**: 把“每 2 层至少 1 次跃迁”做成 runtime 合同，而不是运气现象，并确保每次跃迁的幅度达到玩家可感知阈值。

#### 主要工作

1. 引入 `PowerSpikeBudget`：
   - 按 floor pair（1-2, 3-4, 5）统计；
   - 当未命中跃迁时，后续通过事件 / 商店 / elite / reward 补偿。
2. 定义 spike 来源和优先级：
   - rare / unique 掉落
   - 技能解锁
   - build threshold
   - 路线 pivot
   - boss reward
3. 给 spike 写入幅度评分：
   - offensive delta
   - defensive delta
   - utility delta
   - TTK / EHP 变化
   - 默认以 `spike trigger` 发生前的即时快照作为基准，而不是楼层起始快照
4. 修复 boss reward runtime 闭环：
   - 明确 story boss 胜利后的 reward 语义；
   - 决定是战后掉落、结算前奖励，还是进入 abyss 前选择奖励；
   - 统一 core / runtime / simulator 行为。
5. 为 rare / unique / core mutation 设置“定义构筑”的最小池，不再只看 rarity 标签。

#### 交付件

1. `PowerSpikeBudgetRuntime`
2. `PowerSpikeAmplitudeScorer`
3. `BossRewardRuntimeModule`
4. `SpikeSourceResolver`
5. `StoryRunSpikeReport`

#### 出口门禁

1. 任意正常 run 中，floor 1-2 与 floor 3-4 至少各出现 1 次 `power_spike`。
2. 所有计入合同的 `power_spike` 都达到最低幅度标准。
3. boss reward 语义在实机与 simulator 对齐。
4. 6.2 默认复用现有胜利/奖励面板外观；Boss reward 的专属音画 cue 统一在 6.3 补齐。

---

### 6.3 心跳时刻表达层与装备比较反馈（P1）

**目标**: 为已有规则补齐玩家真正能看见、听见、记住的反馈层，并把装备比较从被动 hover 升级为主动时刻。

#### 主要工作

1. rare / unique 掉落反馈：
   - 屏幕 flash / hit-stop / audio cue
   - 拾取后主动弹出装备对比或可关闭提示
2. build formed 反馈：
   - 达到阈值时 toast
   - HUD 或角色外观轻量变化
   - summary 与 run log 一致记录
3. boss / elite / near-death 表达增强：
   - 普通战斗中补高压反馈
   - 保持不过度噪音
4. Feedback Router 扩展为真正覆盖：
   - `loot:rare_drop`
   - `build:formed`
   - `power_spike`
   - `boss:reward`
5. 装备比较反馈前置：
   - 从“hover tooltip”升级为“拾取/购买/升级后的主动比较”
   - 支持关闭、稍后再看、直接装备
6. 资源策略明确化：
   - 视觉层默认先用现有 `VFXSystem` 的 flash / shake / floating text / ellipse 完成基线；
   - 音频层新增一组最小专属 cue，至少覆盖 rare drop、build formed、boss reward、equipment compare；
   - 若追加视觉资源，只允许做少量 `ui/vfx` 增量，不把大规模新美术设为前置。
7. synergy 激活反馈：
   - 当 `activeSynergyIds` 新增时触发 toast / HUD / log cue；
   - 与 build formed 共享反馈预算与限频；
   - 玩家能知道“刚刚触发了什么”和“它改变了什么”。

#### 交付件

1. `RareDropFeedbackProfile`
2. `BuildFormedCueRuntime`
3. `PowerSpikePresentationBinder`
4. `FeedbackRouterV2`
5. `EquipmentComparePrompt`
6. `SynergyActivationCueRuntime`

#### 出口门禁

1. 每局至少 4 个可见心跳时刻。
2. rare / build / boss 三类峰值均有专属 cue。
3. 装备比较不再只依赖 hover tooltip。
4. 若本阶段新增了视觉或音频资源，对应 manifest 与校验链必须全部通过。
5. synergy 激活在玩家侧可见，不再只存在于后台 runtime。

---

### 6.4 属性 trade-off、语义修复与装备权衡（P1）

**目标**: 修复现在“数值上能跑，但权衡感与语义不对”的问题，让选择真正变成 trade-off。

#### 主要工作

1. 修复 DEX 全能问题：
   - 去掉或显著降低 `DEX -> armor`；
   - 让 `VIT` 成为 `maxHealth + armor` 的主轴；
   - 让 `DEX` 更专注于 `critChance + attackSpeed + moveSpeed`。
2. 修复 `damageOverTime`：
   - 方案 A：实现真正 DOT runtime；
   - 方案 B：若不做 DOT，则更名为 `skillBonusDamage` 或等价语义；
   - 二者必须二选一，不能继续漂移。
3. 引入 curated negative affix / trade-off item：
   - 不对全池开放；
   - 优先在部分 rare / unique 中引入“高收益伴随明确代价”的装备；
   - 例如伤害换移速、冷却换耐久、吸血换暴击等。
4. 在启用 negative affix 前补齐 signed value 支持：
   - HUD affix 格式化
   - tooltip 对比
   - item score / compare score
   - run summary 文案
5. 统一 affix 命名、表现、结算三侧语义。

#### 交付件

1. `AttributeTradeoffRebaseline`
2. `SignedAffixPresentation`
3. `CuratedNegativeAffixSet`
4. `DamageOverTimeSemanticFix`

#### 出口门禁

1. `STR / DEX / VIT / INT` 选择边界清晰，不再出现 DEX 明显全能。
2. 所有玩家可见词缀都与实际语义一致。
3. 至少一组 rare / unique 装备提供真实 trade-off，而不是单纯更高数值。

---

### 6.5 Pacing 调优、验证证据与发布签署（P0）

**目标**: 把“15 分钟 5 层”从文案口径变成可调优、可验收、可签署的节奏目标，并统一完成 Phase 6 发布收口。

#### 主要工作

1. 引入 floor-level pacing 指标：
   - 每层目标耗时
   - combat time share
   - traversal time share
   - event / merchant 占比
2. 建立主流程调优手柄：
   - 地图尺寸
   - 怪物数量
   - 清层阈值
   - 楼梯显现时机
   - 玩家移动速度
   - 商店 / 事件密度
3. simulator 与手动冒烟拆开：
   - simulator 用于结构偏差检测；
   - 手动录像 / 录屏用于真实 15 分钟体验验证。
4. 完成 Phase 6 smoke matrix。
5. 完成 taste 签署 checklist：
   - 每层 choice
   - 每 2 层 spike
   - rare / build / boss 心跳时刻
   - 战斗节奏合同
   - 15 分钟 pacing
6. 生成最终 evidence 包：
   - 自动化测试
   - balance report
   - 手动 run 录像清单
   - known issue 清单
   - 资源校验与缺口关闭记录

#### 建议目标

1. Normal 中位数 run 时长：`12~18 min`
2. Normal P90：`<= 20 min`
3. Hard / Nightmare 可以偏短或偏长，但必须有明确目标区间，不再默认继承

#### 出口门禁

1. 有可复现实验报告，不再只看主观快慢。
2. 15 分钟承诺有对应参数表和样本记录。
3. 技术门禁与 taste 门禁同时通过。
4. 如 Phase 6 存在资源增量，视觉/音频链路校验与 fallback 检查一并归档。

---

## 7. 子文档索引

1. `docs/plans/phase6/2026-03-06-phase6-6.0-baseline-observability-and-architecture-closure.md`
2. `docs/plans/phase6/2026-03-06-phase6-6.1-combat-tempo-choice-agency-and-arcanist-parity.md`
3. `docs/plans/phase6/2026-03-06-phase6-6.2-power-spike-guarantee-magnitude-and-boss-reward-closure.md`
4. `docs/plans/phase6/2026-03-06-phase6-6.3-heartbeat-expression-and-equipment-compare-feedback.md`
5. `docs/plans/phase6/2026-03-06-phase6-6.4-attribute-tradeoff-semantic-repair-and-item-choice.md`
6. `docs/plans/phase6/2026-03-06-phase6-6.5-pacing-tuning-release-closure-and-taste-signoff.md`

---

## 8. 重点工作流与 PR 拆分建议

### PR-6.0-x：观测与边界冻结

1. 定义 Phase 6 事件字典与统计字段。
2. 给 summary / log / taste runtime 增加基础观测。
3. 清理关键 dungeon Host Port 类型边界。

### PR-6.1-x：代理权与战斗节奏

1. 升级技能改为可见 `3 选 1`。
2. 升级属性 delta preview。
3. 基础 mana regen 与技能 CD 重排。
4. arcanist 起步深度补齐。

### PR-6.2-x：跃迁保底与幅度

1. `PowerSpikeBudget`。
2. `PowerSpikeAmplitudeScorer`。
3. boss reward runtime 接入。

### PR-6.3-x：表达层与装备比较

1. rare / build / boss cue。
2. Feedback Router V2。
3. 主动装备比较提示。

### PR-6.4-x：trade-off 与语义修复

1. DEX / VIT 属性边界重排。
2. `damageOverTime` 修复或重命名。
3. signed affix UI。
4. curated negative affix。

### PR-6.5-x：节奏调优与签署

1. pacing instrumentation。
2. 参数表。
3. real balance + manual smoke evidence。
4. release checklist。

---

## 9. 自动化与验证方案

### 9.1 自动化

```bash
pnpm quality:precheck
pnpm check
pnpm test
pnpm --filter @blodex/core test
pnpm --filter @blodex/game-client test
pnpm --filter @blodex/game-client i18n:check
pnpm --filter @blodex/game-client css:check
pnpm assets:audio:compile
pnpm assets:audio:validate
pnpm assets:validate
pnpm check:architecture-budget
pnpm ci:check
```

### 9.2 新增测试类型

1. `choice depth` 合同测试：
   - 每层至少 1 次 `player_facing_choice`
   - 升级技能是显式选择而非自动发放
2. `combat rhythm` 合同测试：
   - 常规 30s 战斗窗口内技能可用次数达到目标
   - 基础 mana regen 后不会长期技能饥饿
3. `power spike` 合同测试：
   - floor 1-2 / 3-4 的 spike 预算稳定命中
   - 所有合同 spike 达到最低幅度标准
   - boss reward runtime 闭环存在
   - `PowerSpikeAmplitudeScorer` 以前一刻快照为基准计算，不使用楼层起始快照
4. `feedback` 合同测试：
   - rare drop / build formed / boss reward 都会路由到 feedback
   - `synergy activated` 会路由到玩家侧反馈
5. `semantic` 合同测试：
   - `damageOverTime` 名称与实现一致
   - signed affix 能正确渲染负值
6. `runtime effect` 合同测试：
   - `resolveSkill().buffsApplied` 会进入 player / monster runtime
   - `buff:apply / buff:expire` 与属性、移速、暴击保证一致生效
   - `physical / arcane` 的最小差异化可被验证
7. `architecture` 合同测试：
   - dungeon runtime 不再依赖 `[key: string]: any`

### 9.3 手动冒烟

1. Debug fast-forward：
   - floor 1~5 全链路 choice / spike / rhythm 记录
2. Non-cheat normal run：
   - 至少 3 局完整 run
3. Class parity：
   - warrior / ranger / arcanist 各 1 局
4. Build formed 验证：
   - lifesteal / crit / aoe / dot 路线至少各 1 次
5. Pacing 录像：
   - 记录 floor split time 与总时长
6. Trade-off 装备验证：
   - 至少 2 次出现“更强但更痛”的装备替换抉择
7. Rhythm before/after 验证：
   - 对比 `6.0 baseline` 与 `6.1` 后的平均无主动输入间隔、技能释放频率与自动攻击占比
8. 资源冒烟验证：
   - 检查 rare / build / boss / compare cue 的资源引用、fallback 与表现一致性
9. runtime effect 验证：
   - `war_cry / shadow_step / frost_nova` 至少各触发 1 次并验证真实效果
   - `physical / arcane` 至少各跑 1 组对比，确认结算差异存在
   - 至少触发 1 次 `synergy activated` 反馈

---

## 10. 风险与止损

1. 风险：为了保底而过度脚本化，损失随机性。  
   止损：保底的是“体验节点类型”和“跃迁幅度”，不是固定物品。

2. 风险：反馈层过量，变成噪音。  
   止损：建立 cue 分级与冷却，不允许每个小增益都触发强反馈。

3. 风险：只调技能数值仍无法改善战斗节奏。  
   止损：在 6.1 明确记录战斗节奏指标；若未达标，再把主动闪避 / 防反升级为下一阶段输入。

4. 风险：arcanist 补齐后职业强度失衡。  
   止损：先做可用性对齐，再做数值调优，不在同一个 PR 混做。

5. 风险：`damageOverTime` 修复牵出大面积命名与存档变更。  
   止损：Phase 6 明确不考虑旧存档兼容；如需改名，提供短期兼容层但不延续到 Phase 7。

6. 风险：negative affix 直接上线导致 UI、评分与 compare 混乱。  
   止损：先完成 signed value 支持，再只在 curated item set 中启用。

---

## 11. 回滚计划

1. 所有新增体验机制都应支持 feature flag 或 runtime option：
   - `phase6.choice_depth_v2`
   - `phase6.combat_rhythm_v2`
   - `phase6.power_spike_budget`
   - `phase6.feedback_v2`
   - `phase6.dot_semantics_v2`
   - `phase6.boss_reward_runtime`
   - `phase6.negative_affix_v1`
2. 若反馈层存在严重噪音，可先关闭 presentation，不回退规则层。
3. 若 spike budget 导致过强，可先降保底强度，再考虑关闭预算。
4. 若 combat rhythm 调优造成职业失衡，可先关闭 mana regen / CD rebaseline，保留 telemetry。
5. 若 pacing 调参失败，允许回到上一版参数表，但保留观测埋点。

---

## 12. Phase 6 完成定义（Definition of Done）

只有当以下条件全部满足时，Phase 6 才允许结束：

1. `每层至少 1 次关键构筑选择` 已由 runtime 合同和手动冒烟同时证明。
2. `每 2 层至少 1 次战力跃迁` 已由 spike 事件统计和幅度评分同时证明。
3. rare / build formed / boss reward 都有玩家可见反馈。
4. 战斗节奏合同达标，技能不再只是偶发点缀。
5. 已进入内容定义的 buff/debuff 不再停留在 `buffId`，而是 runtime 真正生效。
6. `physical / arcane` 至少形成最小策略差异。
7. `damageOverTime` 不再处于语义漂移状态。
8. `arcanist` 与 warrior / ranger 的起步深度差距被显著收敛。
9. `STR / DEX / VIT / INT` 的 trade-off 边界清晰。
10. 至少一组核心装备提供真实 trade-off，而不是单纯更高数值。
11. 至少一类 synergy 激活在玩家侧有明确反馈。
12. 15 分钟目标有真实样本报告支撑。
13. dungeon Host Port 的 `any` 债被实质收口。
14. 技术门禁与 taste 门禁同时通过。
15. 若 Phase 6 产生新增视觉或音频资源，对应 manifest 校验全部通过。
