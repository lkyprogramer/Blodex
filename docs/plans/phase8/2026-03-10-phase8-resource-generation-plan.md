> 执行前必须先完整阅读并接受：`docs/plans/phase8/2026-03-10-phase8-roadmap.md`

# Phase 8 资源生成方案（美术与音频）

**日期**: `2026-03-10`  
**适用阶段**: `8.0A / 8.0B / 8.0C / 8.1`  
**目的**: 将 `Phase 8` 的视觉与音频资源需求从“概念要求”收口为可执行的生成与接线文档。

---

## 1. 总体原则

### 1.1 美术风格约束

所有 `Phase 8` 新增美术资源必须遵循：

- [docs/art-style-bible.md](/Users/luo/Documents/github/Blodex/docs/art-style-bible.md)

硬约束：

1. 风格标签固定为：`painterly-dark-fantasy-v1`
2. 氛围固定为：`somber medieval-cathedral gloom`
3. 必须适配等距视角阅读
4. 必须保持高轮廓清晰度
5. 禁止：
   - 霓虹色
   - 过亮 bloom
   - logo / watermark / 文字

### 1.2 Gemini Key 前置规则

`Phase 8` 的**任何美术资源实际生成**都必须先满足：

1. 已冻结 prompt / 命名 / runtime binding
2. 已明确资源归属阶段
3. **用户已显式提供 Gemini Key**

在用户没有提供 Gemini Key 前：

1. 允许编写 prompt
2. 允许冻结 `asset-plan`
3. 允许写 manifest 入口位
4. 允许做 placeholder binding
5. **不允许直接执行图片生成**

执行生成前，必须主动向用户说明：

`将开始生成 Phase 8 美术资源，需要 Gemini Key 才能继续。`

### 1.3 音频资源规则

音频资源继续遵循既有命名与接线约束：

1. `audio-plan.yaml`
2. `audio-manifest`
3. `assets:audio:validate`

如果音频资源尚未实际生成：

1. 允许先冻结 cue 清单
2. 允许 placeholder binding
3. 不得把“尚未登记的音频 cue”直接接入主线运行时

### 1.4 产出顺序

所有 `Phase 8` 资源统一遵循以下顺序：

1. 先冻结资源清单与命名
2. 再写 prompt 与生成说明
3. 再声明 runtime binding / placeholder binding
4. 美术资源在取得 Gemini Key 后再执行生成
5. 生成完成后才允许接线到最终 manifest 入口

---

## 2. 阶段资源结论

### 2.1 `8.0A Combat Agency`

**结论**: `8.0A` 不要求强制新增大批美术资源，但存在少量**增强型资源需求**。

#### 最小发货要求

1. 首版 `dodge` 可以先使用：
   - tint
   - alpha
   - 残影
   - camera nudge
2. 首版不要求 sprite-sheet 动画
3. 首版允许复用现有战斗反馈资源

#### 推荐新增资源（增强项）

美术：

1. `fx_dodge_afterimage_01`
   - 类别：`fx_sheet`
   - 用途：dodge 残影/拖尾
2. `fx_dodge_ground_swipe_01`
   - 类别：`fx_sheet`
   - 用途：落地速度感

音频：

1. `sfx_combat_dodge_01`
2. `sfx_combat_evade_success_01`

#### 生成说明

美术 prompt 方向：

1. 半透明、短寿命、低饱和拖尾
2. 不要强发光，不要霓虹
3. 需要在深色地牢地面上可辨识

音频方向：

1. 短促风切
2. 低混响
3. 避免夸张动漫感

### 2.2 `8.0B Feedback Surface`

**结论**: `8.0B` 存在明确的美术与音频生成需求，而且属于本阶段的高优先级内容。

#### 必须新增的美术资源

1. `ui_buff_rail_frame_01`
   - 类别：`ui_frame`
   - 用途：buff/debuff rail 容器
2. `ui_status_buff_batch_01`
   - 类别：`ui_badge`
   - 用途：输出/生存/功能类 buff 图标
3. `ui_status_debuff_batch_01`
   - 类别：`ui_badge`
   - 用途：slow / vulnerability / curse 等 debuff 图标
4. `ui_element_weak_badge_01`
   - 类别：`ui_badge`
5. `ui_element_resist_badge_01`
   - 类别：`ui_badge`
6. `ui_set_active_badge_01`
   - 类别：`ui_badge`
7. `ui_synergy_active_badge_01`
   - 类别：`ui_badge`

#### 必须新增的音频资源

1. `sfx_combat_crit_heavy_01`
2. `sfx_element_weak_hit_01`
3. `sfx_element_resist_hit_01`
4. `ui_buff_activate_01`

说明：

1. `sfx_combat_dodge_01` 已归属 `8.0A`
2. `8.0B` 不重复登记 dodge SFX，避免资源归属分叉

#### 生成说明

美术风格要求：

1. 图标在深色 HUD 上必须高可读
2. 统一使用 `painterly-dark-fantasy-v1`
3. 强调金属、皮革、灰石、灰烬、秘法纹理
4. 不使用现代 UI 扁平图标风格

布局要求：

1. 按 `6` 个图标位设计
2. 需兼容小尺寸 HUD
3. 图标边缘不可过细

### 2.3 `8.0C Pacing Pass`

**结论**: `8.0C` 有明确的资源需求，主要是节点和过场表达资源。

#### 必须新增的美术资源

1. `node_prep_room_marker_01`
   - 类别：`node_marker`
2. `node_recovery_room_marker_01`
   - 类别：`node_marker`
3. `panel_prep_room_01`
   - 类别：`transition_panel`
4. `panel_recovery_room_01`
   - 类别：`transition_panel`
5. `card_prep_room_01`
   - 类别：`ui_card`
6. `card_recovery_room_01`
   - 类别：`ui_card`

#### 推荐新增的音频资源

1. `ui_prep_room_enter_01`
2. `ui_recovery_room_enter_01`
3. `amb_prep_room_loop_01`
4. `amb_recovery_room_loop_01`

#### 生成说明

视觉方向：

1. 准备室偏“静、冷、整理”
2. 休整节点偏“余震、缓和、收束”
3. 必须与战斗层有可感知视觉差异，但不能跳出整体美术风格

### 2.4 `8.1 Content Batch Two`

**结论**: `8.1` 的资源需求必须在具体内容包选定后再冻结，不应在当前阶段预先大批量生成。

#### 当前只允许冻结的资源类型

1. 第二批 Boss 的 sprite / portrait / reward badge / telegraph
2. 第二批元素/敌人画像 icon
3. 第二批 set / item icon
4. challenge 变体节点资源

#### 当前不应直接生成的内容

1. 未被具体立项的第二批 Boss 美术
2. 未被 gameplay 选定的元素图标大包
3. 未被实际接线的 panel / portrait 扩展包

---

## 3. 推荐文档与配置更新顺序

在真正进入 Phase 8 实现时，建议按以下顺序更新：

1. `asset-plan.yaml`
2. `audio-plan.yaml`
3. `generated manifest / audio-manifest`
4. 各阶段文档中的资源章节
5. 运行时接线

---

## 4. 执行前提示模板

当实际要开始生成 Phase 8 美术资源时，必须先向用户发出类似提示：

`将开始生成 Phase 8 美术资源。按当前项目规则，实际生成前需要你提供 Gemini Key。收到 Key 后我再执行图片生成；在此之前我只会冻结 prompt、manifest 入口和 placeholder binding。`

---

## 5. 当前状态

当前状态：

- `Phase 8 资源需求已冻结`
- `美术生成前置条件已明确`
- `待实际生成时向用户索取 Gemini Key`
