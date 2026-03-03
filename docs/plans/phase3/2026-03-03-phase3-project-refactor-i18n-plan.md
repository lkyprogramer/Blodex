# Phase 3 项目级重构与 i18n 实施方案（深度分析版）

**日期**: 2026-03-03  
**文档位置**: `docs/plans/phase3/2026-03-03-phase3-project-refactor-i18n-plan.md`  
**参考基线**: `docs/plans/phase2/README.md`、`docs/plans/phase2/ui-art-review.md`、`docs/plans/2026-02-27-phase3-experience-polish.md`

---

## 1. 直接结论

当前项目在“玩法完整性”上已经过 Phase 2/3 的大规模扩展，但工程结构已进入“高耦合 + 高体量 + 高维护成本”阶段：

1. `apps/game-client/src/scenes/DungeonScene.ts` 达到 **5,788 行 / 157 个 private 方法**，承担过多职责（场景编排、战斗循环、事件系统、日志、存档、调试、UI喂数）。
2. UI 文案与内容文案仍以英文硬编码为主，缺少统一翻译层；目前不具备“页面与内容可切换语言”的基础架构。
3. CSS 已扩张为 **1,817 行单文件**，变量体系存在但模块化不足，特异性与 magic number 问题持续累积。
4. `packages/content` 没有测试；`src` 内混入编译产物（`.js/.d.ts/.map`）导致边界不清。

建议采用“**先解耦、再本地化、最后收敛质量门禁**”的三阶段路线：

- **R1-R2**：场景与 UI 架构拆分，建立 i18n 基础设施；
- **R3**：完成首批 `zh-CN` 本地化（UI + content），并在游戏开始时提供语言选择；
- **R4**：测试门禁与工程治理（CSS 模块化、内容翻译完整性校验、构建产物隔离）。

---

## 2. 现状证据（代码基线）

### 2.1 体量与测试

| 维度 | 现状 |
|---|---|
| `apps/game-client/src`（ts+css, excluding `.d.ts`） | 16,172 行 |
| `packages/core/src`（ts, excluding `.d.ts`） | 9,865 行 |
| `packages/content/src`（ts, excluding `.d.ts`） | 2,888 行 |
| core 测试数 | 40 |
| game-client 测试数 | 13 |
| content 测试数 | 0 |

### 2.2 高风险大文件（按行数）

| 文件 | 行数 | 主要风险 |
|---|---:|---|
| `apps/game-client/src/scenes/DungeonScene.ts` | 5,788 | 单类多职责、回归面过大、i18n 注入难 |
| `apps/game-client/src/style.css` | 1,817 | 单文件维护成本高、选择器治理困难 |
| `apps/game-client/src/scenes/MetaMenuScene.ts` | 882 | 菜单流程 + 数据编排 +字符串文案耦合 |
| `apps/game-client/src/ui/Hud.ts` | 846 | UI 拼接 + tooltip + log + inventory 职责过重 |
| `apps/game-client/src/ui/components/MetaMenuPanel.ts` | 571 | 大量模板字符串，文案提取成本高 |

### 2.3 i18n 现状证据

1. 未发现 `i18n/locale/messages/translator` 等基础设施。
2. `packages/content/src/*.ts` 中 `name` 字段约 **159** 处、`description` 约 **82** 处，均为英文内容定义。
3. `DungeonScene.ts` 存在约 **79** 处 `appendLog(...)` 文案输出，当前为英文模板拼接。
4. `Hud.ts`、`MetaMenuPanel.ts` 存在大量硬编码 UI 文案（rough count: 190 / 177）。

### 2.4 工程卫生问题

`src` 目录混入产物文件（示例统计）：

- `packages/core/src`: `.js` 14、`.d.ts` 14、`.js.map` 14
- `packages/content/src`: `.js` 6、`.d.ts` 6、`.js.map` 6
- `apps/game-client/src`: `.d.ts` 10、`.js.map` 10

这会增加搜索噪声、误改风险、审查成本。

---

## 3. 技术债深度分析（项目级）

### 3.1 Client 架构债务

1. **场景编排对象过大（`DungeonScene`）**
   - 现状：战斗、事件、挑战房、危害、存档、调试、日志和 HUD 数据组装都在同一类。
   - 风险：任一功能改动都可能引入跨域回归；单测难覆盖核心路径。
   - 直接影响：i18n 改造将分散在大量方法中，落地成本和遗漏风险都高。

2. **UI 渲染方式“模板字符串中心化”**
   - `Hud`/`MetaMenuPanel` 使用 `innerHTML` + 大片模板字符串。
   - 风险：文案抽取困难、局部重用差、可测试性一般、事件绑定与 DOM 生命周期耦合。

3. **UIManager 仍偏“转发层”**
   - 当前 `UIManager` 大多是 `Hud` 的 wrapper，尚未形成稳定的 UI 领域模型（例如统一 i18n 上下文、统一 formatter 层）。

### 3.2 Core / Content 债务

1. **`MetaProgression.schemaVersion` 固定为 `5`，偏业务扩展导向**
   - 若要把 `preferredLocale` 纳入玩家偏好，需要安全迁移策略（建议升级到 v6）。

2. **内容文本和逻辑定义耦合在同一对象**
   - 例如 `items.ts`、`skills.ts`、`randomEvents.ts` 的 `name/description` 与战斗数值同体。
   - 风险：翻译工作会高频触碰玩法定义文件，增加冲突与回归概率。

3. **`packages/content` 无测试门禁**
   - 缺少翻译完整性、key 一致性、回退策略（fallback）验证。

### 3.3 体验与视觉债务

1. **CSS 体量持续增长但缺少分层模块化**（详见第 10 节）。
2. **组件可维护性不均衡**：`SkillBar`/`RunSummaryScreen`体量可控，而 `Hud`/`MetaMenuPanel` 已接近“二级场景”。
3. **缺少统一文本格式化层**：如日期、数值、模式标签、日志句式都在业务代码拼接。

### 3.4 工程流程债务

1. 缺失 CI 工作流文件（仓库未见 `.github/workflows`）。
2. lint 主要依赖 `tsc --noEmit`，未引入结构化样式/文案规则（如 stylelint、i18n key lint）。
3. 构建产物目录边界不严（`src` 混入产物）。

---

## 4. 重构优化总方案（分阶段）

> 目标：在不破坏 deterministic 和 core/client 边界的前提下，把“可玩项目”升级为“可持续演进项目”。

### R1：结构解耦（先拆客户端耦合）

**目标**：把 `DungeonScene` 从“巨石类”拆成可组合系统。

**建议拆分**：

1. `RunFlowCoordinator`：开局/切层/结算/模式切换。
2. `EncounterController`：怪物更新、Boss、挑战房。
3. `WorldEventController`：随机事件、商店、hazard。
4. `HudPresenter`：将运行态映射成 UI snapshot（不包含文案拼接）。
5. `RunLogService`：统一日志事件 -> message key。

**收益**：

- i18n 后续只接 `HudPresenter + RunLogService`，不再穿透所有 gameplay 方法。

### R2：UI 文案层治理（建立可翻译边界）

**目标**：所有可见文本走统一 `t(key, params)`；UI 组件不再直接写文案常量。

**改造点**：

1. 新增 `apps/game-client/src/i18n`：
   - `types.ts`：`LocaleCode = "en-US" | "zh-CN"`
   - `catalog/en-US.ts`、`catalog/zh-CN.ts`
   - `I18nService.ts`：`t()`、`setLocale()`、`getLocale()`、fallback
2. `Hud.ts`、`MetaMenuPanel.ts`、`RunSummaryScreen.ts`、`EventDialog.ts` 全量接入。
3. `DungeonScene.appendLog` 全部从自由文本改为 message key + params。

### R3：内容本地化（i18n 核心阶段）

**目标**：游戏页面 + 内容定义全部支持中英文切换；首发 `zh-CN`。

**建议策略（推荐）**：

- 保留现有 `packages/content` 英文定义为 canonical（不破坏现有逻辑）
- 新增 locale 覆盖层（按 `id` 定位翻译）

```typescript
export interface ContentLocalePack {
  item: Record<string, { name?: string }>;
  skill: Record<string, { name?: string; description?: string }>;
  unlock: Record<string, { name?: string; description?: string }>;
  mutation: Record<string, { name?: string }>;
  event: Record<string, { name?: string; description?: string; choices?: Record<string, { name?: string; description?: string }> }>;
  biome: Record<string, { name?: string }>;
  monster: Record<string, { name?: string }>;
}
```

**解析方式**：

- UI 渲染前经 `contentLocalizer.translate(domain, id, field, fallback)`。

### R4：工程收敛与质量门禁

1. CSS 模块化拆分（见第 10 节）。
2. `packages/content` 增加测试（翻译完整性、孤儿 key、fallback）。
3. 清理 `src` 编译产物，规范 `outDir` 与 `.gitignore`。
4. 增加 CI 最低门禁：`typecheck + core test + client test + content test`。

---

## 5. i18n 专项方案（含“游戏开始选语言”）

### 5.1 设计目标

1. 启动即有语言选择入口。
2. 首批支持 `zh-CN`，默认保留 `en-US`。
3. 页面文案与内容文案同一套 locale 驱动。
4. 无翻译项时自动回退英文，避免空白/崩溃。

### 5.2 语言状态存储策略

### 方案 A（低风险快速）

- `localStorage['blodex_locale_v1']` 持久化，独立于 `MetaProgression`。
- 优点：不改 core schema，落地快。
- 缺点：偏好与 meta 分离。

### 方案 B（长期推荐）

- `MetaProgression` 升级到 `schemaVersion: 6`，新增 `preferredLocale`。
- `migrateMeta` 注入默认值（优先已有 localStorage 值，其次 `navigator.language` 映射）。
- 优点：单一真源；跨页面逻辑统一。
- 缺点：需升级迁移与相关测试。

**建议**：先 A 快速上线，下一迭代收敛到 B。

### 5.3 “游戏开始选择语言”交互设计

### 首次启动（无 locale）

1. 进入 `MetaMenuScene` 前显示 `LanguageGateModal`（阻塞 Start）。
2. 提供选项：`English` / `简体中文`。
3. 确认后写入 locale，并重渲染 MetaMenu。

### 非首次启动

1. 直接使用已保存 locale。
2. 在 MetaMenu 顶部保留语言切换入口（即时切换，当前界面重渲染）。

### 推荐落点文件

- `apps/game-client/src/scenes/MetaMenuScene.ts`
- `apps/game-client/src/ui/components/MetaMenuPanel.ts`
- `apps/game-client/src/style.css`（新增语言选择弹层样式）

### 5.4 首批 `zh-CN` 覆盖范围

1. UI 固定文案
   - HUD、MetaMenu、RunSummary、Event/Merchant Dialog、Tooltip、Death Overlay、按钮/状态标签。
2. 运行日志文案
   - `DungeonScene` 中 `appendLog` 的所有玩家可见消息。
3. 内容文案
   - Items、Skills、Talents、Mutations、RandomEvents（含 choice）、Monsters、Biomes、Unlocks、Blueprints。

### 5.5 i18n key 规范

```text
ui.meta.title
ui.meta.start_run
ui.hud.run.mode
ui.summary.victory
ui.summary.defeat
log.equip.success
log.event.discovered
content.skill.cleave.name
content.skill.cleave.description
content.event.mysterious_shrine.choice.offer_obol.name
```

规范要求：

1. key 稳定，不随文案修改而变。
2. 参数化文案统一 `{param}` 占位，禁止字符串拼接。
3. 内容 key 优先基于 domain + id + field。

---

## 6. 验证与测试计划

### 6.1 自动化

```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/game-client test
pnpm --filter @blodex/game-client typecheck
pnpm --filter @blodex/content typecheck
```

新增建议：

1. `apps/game-client/src/i18n/__tests__/catalog-completeness.test.ts`
2. `apps/game-client/src/i18n/__tests__/fallback.test.ts`
3. `packages/content/src/__tests__/locale-pack-consistency.test.ts`
4. `apps/game-client/src/ui/components/MetaMenuPanel.i18n.test.ts`
5. `apps/game-client/src/systems/__tests__/run-log-i18n.test.ts`

### 6.2 手工 Smoke

1. 首次启动必须出现语言选择。
2. 选择 `简体中文` 后：MetaMenu/HUD/事件弹窗/结算/死亡文案全部切为中文。
3. 切回 `English` 后即时生效，无需刷新。
4. Daily/Endless/Challenge/Boss 场景日志无英文残留（允许术语白名单）。

### 6.3 验收门槛

1. 文案渲染中缺失 key 比例为 0（CI fail-fast）。
2. `zh-CN` 覆盖率 >= 95%（可定义白名单字段）。
3. 语言切换不影响存档兼容与 run 结算结果。

---

## 7. 风险与缓解

1. **风险：一次性提取文案过多，回归面大**
   - 缓解：先提取 UI 固定文案，再提取日志，再提取内容文案。
2. **风险：翻译遗漏导致空字符串**
   - 缓解：强制 fallback + key 完整性测试。
3. **风险：Runtime 切语言引起性能抖动**
   - 缓解：静态 label 缓存；仅在 locale 切换时重建模板。
4. **风险：schema 升级影响旧存档**
   - 缓解：A/B 两阶段策略，先 localStorage，再 schema v6。

---

## 8. 执行拆分（PR 级）

### PR-I18N-01（基础设施）

- 新增 `i18n` 目录、`en-US/zh-CN` catalog、`I18nService`。
- 接入 `MetaMenuPanel` 与 `RunSummaryScreen`。

### PR-I18N-02（启动语言选择）

- MetaMenu 增加 `LanguageGateModal`。
- 首次进入必须选择语言；保留快捷切换入口。

### PR-I18N-03（HUD + 日志）

- `Hud.ts` 全部标签/tooltip 文案 key 化。
- `DungeonScene` `appendLog` 改为 key + params。

### PR-I18N-04（内容本地化）

- 新增 `packages/content` locale pack。
- event/skill/item/monster/biome/unlock/talent/mutation 文案接入 localizer。

### PR-REF-01（场景解耦）

- 拆出 `RunFlowCoordinator`、`WorldEventController`、`HudPresenter`。
- `DungeonScene` 仅保留生命周期编排。

### PR-REF-02（CSS 模块化）

- `style.css` 分拆为 `styles/base.css`、`styles/hud.css`、`styles/meta-menu.css`、`styles/overlays.css`、`styles/responsive.css`。
- 统一变量 token 与断点常量。

### PR-REF-03（工程卫生）

- 清理 `src` 编译产物；统一 `outDir`。
- 增加内容翻译一致性测试与 CI 门禁。

---

## 9. 里程碑建议

1. **M1（1 周）**：PR-I18N-01/02 + PR-REF-03（先把基础设施和工程边界拉起来）。
2. **M2（1 周）**：PR-I18N-03/04（完成 `zh-CN` 覆盖）。
3. **M3（1-2 周）**：PR-REF-01/02（结构重构与 CSS 模块化收敛）。

---

## 10. CSS 代码质量评估（承接 Phase 2）

### 10.1 现状

- `style.css` 当前 **1,817 行**（较 phase2 审查基线 1,513 行继续增长）
- CSS 变量体系存在：`--bg-*`, `--text-*`, `--accent-*`, `--rarity-*`
- keyframe：`fadeIn/fadeScaleIn/deathPulse/pulseGlow/pulseBorder/countUp`
- 响应式断点：`980px / 640px / 1400px`

### 10.2 技术债务

1. **单文件过大**：1,817 行单文件导致定位/复用/回归困难。
2. **选择器特异性不一致**：`#id` 与 `.class` 混用；约 29 个顶层 ID 选择器。
3. **Magic numbers**：`px` 字面量约 396 处，缺少统一尺寸 token。
4. **动画语义分散**：已有动画定义，但触发场景与组件状态未形成统一约定。
5. **主题体系不完整**：当前偏深色 + 高对比模式，尚无完整浅色主题策略（可按产品定位决定是否保留现状）。

### 10.3 组件代码质量

| 组件 | 当前行数 | 评价 |
|------|------:|------|
| `MetaMenuPanel.ts` | 571 | 功能完整，但模板字符串体量偏大，建议拆子组件与文案层 |
| `Hud.ts` | 846 | 多职责聚合（stats/bars/minimap/inventory/log/tooltip/overlay），建议 Presenter + 子组件拆分 |
| `SkillBar.ts` | 180 | 体量合理，适合作为 i18n 接入样板 |
| `RunSummaryScreen.ts` | 74 | 轻量，重构风险低，适合优先接入多语言 |
| `Minimap.ts` | 238 | 逻辑清晰，可保持独立，仅需文案点位 i18n 化 |

---

## 11. 本文档交付范围

本文仅定义 **重构与 i18n 的实施方案**（设计与执行计划），未直接修改业务代码。建议按第 8 节 PR 顺序落地，优先完成语言基础设施与启动选择流程，再扩展到内容翻译与结构性重构。
