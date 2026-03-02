# UI 与视觉优化（PR 级实施规范，修订版）

**日期**: 2026-03-02  
**目标**: 在不破坏现有 `@blodex/core` 领域边界的前提下，系统性提升 HUD / MetaMenu / 反馈动效的可读性、可感知性与品质感。  
**范围**: `apps/game-client` 前端 UI（CSS + DOM 组件 + Scene 绑定），不涉及 core 战斗规则。

---

## 1. 评审结论与本次修订点

对现有文档与代码核对后，原方案方向正确，但存在“可执行粒度不足”和“实现边界未收敛”问题。本次修订已补齐以下关键点：

1. **从“样式清单”升级为“PR 清单”**：每个改动点都落到文件、接口、验收和测试。
2. **补齐状态链路**：新增视觉状态（如 newly-acquired）不再停留在 CSS，明确 UI 状态来源与生命周期。
3. **补齐场景清理语义**：MetaMenu DOM 化后，补充监听器解绑与 scene restart 防重复绑定。
4. **补齐门禁命令**：使用仓库真实命令（`pnpm --filter @blodex/game-client test` / `typecheck`），不再用模糊 `pnpm test`。
5. **补齐回退策略**：结构性重做（尤其 MetaMenu）提供 feature flag 与可回滚路径。

---

## 2. 当前事实基线（代码核对）

### 2.1 已确认现状

1. `style.css` 当前 **863 行**，几乎无系统化过渡/关键帧动效。
2. `Hud.ts` 仍以字符串模板拼装，状态展示以纯文本为主（HP/Mana/XP 无进度条）。
3. `SkillBar.ts` 冷却态只通过 `.cooldown` 透明度表达，无进度遮罩与 ready flash。
4. `Minimap.ts` 固定 `MINIMAP_SIZE = 160`，玩家点无脉冲表达。
5. `RunSummaryScreen.ts` 为简单静态列表（无胜负视觉分型）。
6. `MetaMenuScene.ts` 仍是 Phaser Text 列表，不是可复用 DOM 组件。

### 2.2 非目标（明确不做）

1. 不改动战斗规则与数值平衡。
2. 不改动 core 类型契约（`packages/core`）与协议字段。
3. 不引入新的渲染框架（保持 Phaser + 原生 DOM）。
4. 不做线上排行榜服务或后端 API。

---

## 3. 不可协商约束

1. **功能零回归**：视觉改造不能破坏装备/丢弃/消耗品/技能/事件交互。
2. **监听器可回收**：任何 DOM/键盘绑定都必须在 scene shutdown/restart 可清理。
3. **低风险渐进**：先做 CSS 增强，再做结构改造（MetaMenu 最后）。
4. **可访问性最小保障**：支持 `prefers-reduced-motion` 降级。
5. **移动端不退化**：`max-width: 640px` 下布局不溢出、不遮挡关键按钮。

---

## 4. 接口与组件变更（Public Surface）

### 4.1 `Hud` 视图状态（客户端内部）

```typescript
interface HudRunViewState {
  // existing fields...
  consumables?: ConsumableSlotView[];
  skillSlots?: SkillSlotView[];

  // new (optional)
  newlyAcquiredItemIds?: string[]; // highlight inventory cells for short window
}
```

说明：
- 字段为可选，默认空数组，保持向后兼容。
- `newlyAcquiredItemIds` 只用于视觉，不进入 core/存档。

### 4.2 新增 UI 组件

1. `apps/game-client/src/ui/components/MetaMenuPanel.ts`（new）
2. `apps/game-client/src/ui/components/PlayerBars.ts`（可选拆分，默认先并入 `Hud.ts`，仅当 `Hud.ts` 在 PR-UI-04 中新增超过 ~200 行再拆）

### 4.3 `index.html` 容器扩展

新增：

```html
<div id="meta-menu" class="hidden"></div>
```

用于承载 DOM 化 MetaMenu 浮层。

---

## 5. PR 拆分（决策完备）

## 批次 A（低风险，样式增强）

### PR-UI-01：全局动效基础与降级开关

**修改文件**
- `apps/game-client/src/style.css`

**实施内容**
1. 为按钮/可交互项补齐统一 transition token。
2. 增加 `fadeIn/fadeScaleIn/pulseGlow/pulseBorder/countUp` keyframes。
3. 为 `#event-panel` 与 `#death-overlay` 增加入场动画。
4. 增加：

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

**验收**
- 交互 hover 无瞬变；弹层有平滑入场。
- 开启 reduced motion 后动画正确降级。

---

### PR-UI-02：物品反馈与字体可读性修复

**修改文件**
- `apps/game-client/src/style.css`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**实施内容**
1. 背包/装备 hover 反馈（边框+阴影+微位移）。
2. 新增 `.inventory-cell.newly-acquired` 动画样式。
3. 在 `DungeonScene` 捕获 `loot:pickup` 时维护短时队列（2s TTL）。
4. 在 `renderHud()` 中透传 `newlyAcquiredItemIds` 到 `Hud`。
5. 将低于 11px 的文字统一升到 11px，并对可能溢出的名称做 ellipsis。

**验收**
- 新拾取物品格有 2s 内可见脉冲。
- HUD 无 <11px 文本（`log-time`, `hotkey-badge`, `slot-status`, `equip-slot-name` 等）。

---

### PR-UI-03：面板质感增强（深度/纹理/阴影）

**修改文件**
- `apps/game-client/src/style.css`

**实施内容**
1. 为 `.panel-block/.compact-block` 增加 inset 与外层阴影层次。
2. 为 `#hud-panel` 增加顶部弱光渐变。
3. Tooltip 阴影升级为多层。
4. 噪点纹理仅用于大面板，避免所有节点开启伪元素导致重绘压力。

**验收**
- 面板视觉层次提升但不影响文字对比。
- DevTools 观察无明显 FPS 回退（手动验证）。

---

## 批次 B（结构性改造）

### PR-UI-04：玩家资源条（HP/Mana/XP）

**修改文件**
- `apps/game-client/src/style.css`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/ui/components/HudPanel.ts`（若拆分）

**实施内容**
1. 将纯文本 HP/Mana/XP 改为进度条组件。
2. HP < 25% 时触发低血脉冲样式。
3. 进度条宽度更新使用 transition。

**验收**
- 受伤/治疗/耗蓝/升级时进度条平滑变化。
- 低血警示稳定触发并可恢复。

---

### PR-UI-05：技能冷却可视化

**修改文件**
- `apps/game-client/src/style.css`
- `apps/game-client/src/ui/components/SkillBar.ts`
- `apps/game-client/src/ui/components/SkillBar.test.ts`

**实施内容**
1. 每个技能槽增加 `cooldown overlay` + 剩余秒数字。
2. 冷却结束触发一次 `ready-flash`。
3. `baseCooldownMs` 缺失时 fallback 到无进度模式（仅显示 Ready/Cooldown）。

**验收**
- 冷却期间遮罩按比例退场。
- 冷却刚结束有一次闪烁，不重复抖动。
- 现有快捷键逻辑不变。

---

### PR-UI-06：小地图增强与响应式

**修改文件**
- `apps/game-client/src/style.css`
- `apps/game-client/src/ui/components/Minimap.ts`

**实施内容**
1. `MINIMAP_SIZE 160 -> 200`；大屏提升至 240（CSS media query）。
2. 玩家点增加轻量脉冲（基于时间函数）。
3. 增加罗盘 N 标识装饰。
4. 保持 `configure(layoutHash)` 的探索缓存语义不变。

**验收**
- 小地图尺寸和可读性提升。
- 玩家点脉冲平滑，无明显渲染抖动。

---

### PR-UI-07：结算面板重做

**修改文件**
- `apps/game-client/src/style.css`
- `apps/game-client/src/ui/components/RunSummaryScreen.ts`

**实施内容**
1. 区分 victory/defeat 主题卡片。
2. 统计项 staggered reveal（CSS delay）。
3. Soul Shard 奖励突出展示。

**验收**
- 胜负样式差异明显。
- Continue 按钮流程与当前一致。

---

### PR-UI-08：MetaMenu DOM 化（高风险收口 PR）

**修改文件**
- `apps/game-client/index.html`
- `apps/game-client/src/style.css`
- `apps/game-client/src/ui/components/MetaMenuPanel.ts`（new）
- `apps/game-client/src/scenes/MetaMenuScene.ts`

**实施内容**
1. 使用 `#meta-menu` 渲染 DOM 浮层，替换 Phaser 文本列表。
2. 按 tier 分组渲染 unlock cards。
3. 保留原快捷键（1-0、Q/W/E、Enter）。
4. 引入监听器解绑机制，防 restart 叠加：

```typescript
private unbindDomActions: Array<() => void> = [];

private teardownDomBindings(): void {
  for (const off of this.unbindDomActions) off();
  this.unbindDomActions = [];
}
```

5. `create()` 前先 `teardownDomBindings()`；`shutdown()` 再次清理并隐藏 `#meta-menu`。

**验收**
- MetaMenu 视觉层级显著提升。
- 多次 scene restart 不会重复触发 click/keyboard handler。
- 开始运行后浮层正确隐藏。

---

## 6. Feature Flag 与回退策略

为降低 UI 重构风险，建议引入：

```typescript
const UI_POLISH_FLAGS = {
  metaMenuDomEnabled: true,
  runSummaryV2Enabled: true,
  skillCooldownOverlayEnabled: true
};
```

落地约束：

1. flag 常量统一放在 `apps/game-client/src/config/uiFlags.ts`，禁止在 Scene/组件内散落定义。
2. 读取入口统一由 `apps/game-client/src/main.ts` 注入，避免测试环境与运行环境出现双份默认值。
3. 每个 flag 必须有单测覆盖至少一个 `true/false` 分支（最少快照或 DOM 结构断言）。

回退策略：
1. `metaMenuDomEnabled=false` 时回退 Phaser 旧菜单。
2. `runSummaryV2Enabled=false` 时回退旧 `RunSummaryScreen`。
3. `skillCooldownOverlayEnabled=false` 时仅保留 opacity 冷却态。

---

## 7. 测试矩阵

### 7.1 自动化测试

**新增/更新建议**
1. `SkillBar.test.ts`：冷却遮罩百分比、ready flash class
2. `RunSummaryScreen.test.ts`（new）：victory/defeat 模板输出
3. `MetaMenuPanel.test.ts`（new）：tier 分组、状态 class、按钮数据属性
4. `ui-state-adapter.test.ts`：`newlyAcquiredItemIds` 可选字段兼容

### 7.2 手工验证清单

1. 事件弹窗、死亡弹窗入场动画
2. 拾取物品高亮生命周期（2s）
3. HP/Mana/XP 条与低血提示
4. 技能冷却遮罩与 ready 闪光
5. 小地图尺寸与脉冲
6. 结算卡片分型与动画顺序
7. MetaMenu 卡片交互、快捷键、重复进入/退出

### 7.3 命令门禁

1. `pnpm --filter @blodex/game-client typecheck`
2. `pnpm --filter @blodex/game-client test`
3. `pnpm --filter @blodex/core test`

---

## 8. 实施顺序（强约束）

1. `PR-UI-01` -> `PR-UI-03`（纯样式，低风险）
2. `PR-UI-04` -> `PR-UI-07`（组件改造，中风险）
3. `PR-UI-08`（MetaMenu DOM 化，高风险，最后收口）

原因：
- MetaMenu 改动涉及 scene 生命周期与事件绑定，回归面最大。

---

## 9. 最终验收门禁（Gate）

- [ ] 批次 A 视觉增强全部达成且无功能回归
- [ ] HP/Mana/XP、Skill cooldown、小地图、结算卡片改造完成
- [ ] MetaMenu DOM 化完成并通过 restart 监听器无泄漏验证
- [ ] 移动端（<640px）布局可用且无关键按钮遮挡
- [ ] `game-client` typecheck/test 全绿
- [ ] `core` test 不受影响

---

## 10. 风险清单

1. **风险**：CSS 增量导致样式覆盖顺序混乱  
   **缓解**：新增规则集中在文件尾部并按组件分组。
2. **风险**：MetaMenu 监听器泄漏导致重复购买/重复启动  
   **缓解**：统一 `unbind` 池 + `shutdown` 清理。
3. **风险**：动画过多影响低端机  
   **缓解**：`prefers-reduced-motion` + 关键动画限定在 overlay/card。
4. **风险**：UI 状态字段扩展导致渲染适配遗漏  
   **缓解**：字段均可选，默认分支完整兜底。
