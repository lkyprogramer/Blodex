# R3 首批 `zh-CN` 本地化与启动语言选择实施文档（PR 级，长期主义版）

**日期**: 2026-03-03  
**阶段**: Phase 3 / R3  
**目标摘要**: 在 R2 i18n 基础设施上，完成首批 `zh-CN` 的产品级交付（UI + content + log），并在游戏开始时提供语言选择能力。  
**关联文档**:
- `docs/plans/phase3/2026-03-03-r1-scene-ui-architecture-refactor.md`
- `docs/plans/phase3/2026-03-03-r2-i18n-infrastructure.md`
- `docs/plans/phase3/2026-03-03-phase3-project-refactor-i18n-plan.md`

---

## 1. 直接结论

R3 的目标是“**把 i18n 基础设施变成用户可感知功能**”，并确保可长期演进：

1. 首次进入游戏时，必须先完成语言选择（English / 简体中文）。
2. 项目核心可见文本实现双语切换：UI、日志、内容名称/描述。
3. 语言偏好持久化进入长期稳定模型（推荐落入 `MetaProgression.preferredLocale`，并兼容 R2 的 localStorage）。
4. 切换语言不影响 run 逻辑、存档恢复、结算一致性。

R3 完成后，用户视角能力应为：

- 打开游戏即可选语言；
- 进入 MetaMenu / Dungeon 后文本即时按所选语言显示；
- 可在菜单中切换语言并立即生效；
- `zh-CN` 覆盖达到可发布标准。

---

## 2. 产品范围与非目标

### 2.1 范围

1. 启动语言选择流程（Language Gate）。
2. `zh-CN` UI 文案全量落地。
3. `zh-CN` 日志文案全量落地。
4. `zh-CN` 内容文案首批全量落地（items/skills/events/talents/mutations/...）。
5. 语言偏好跨会话持久化。

### 2.2 非目标

1. 不新增第三种语言。
2. 不改玩法数值和平衡。
3. 不在 R3 内做 CSS 模块化治理（R4 处理）。
4. 不引入远程翻译服务（本地静态词典即可）。

---

## 3. R3 入口条件（依赖 R2）

R3 开始前需满足：

1. `I18nService`、`CatalogRegistry`、`ContentLocalizer` 已可用。
2. UI/日志已 key 化出口（不再新增硬编码文本）。
3. i18n 检查脚本与占位符校验已接入。

若入口条件未满足，优先回补 R2 PR，再执行 R3。

---

## 4. 关键设计决策（长期演进）

## 4.1 语言偏好真源（Source of Truth）

**决策**: R3 将语言偏好纳入 `MetaProgression`，升级 `schemaVersion: 6`。

理由：

1. 语言偏好属于玩家配置，应该与 meta 一起迁移与备份。
2. 避免长期依赖分散的 localStorage key。
3. 为未来云存档/多端同步留接口。

迁移策略：

1. 读取优先级：`meta.preferredLocale` > `blodex_locale_v1` > `navigator.language` 映射 > `en-US`。
2. 写入策略：R3 过渡期双写（meta + localStorage），R4 后可清理 localStorage 回退链。

## 4.2 启动语言选择交互策略

**决策**: 在 MetaMenu 场景入口设置阻塞式 `LanguageGateModal`。

流程：

1. 首次运行（无偏好）时显示 gate，屏蔽 `Start New Run` 等入口。
2. 用户选择后立即应用 locale 并持久化。
3. 非首次运行直接进入主菜单；菜单顶部保留“语言切换”。

## 4.3 文本回退策略

1. `zh-CN` 缺失词条时自动回退 `en-US`。
2. `en-US` 缺失词条时回退 key 并上报诊断（可在 dev 模式显示）。
3. 严禁渲染空字符串。

---

## 5. 覆盖矩阵（R3 交付范围）

### 5.1 UI 覆盖

1. MetaMenu（标题、分区、状态、按钮、提示、language selector）。
2. HUD（stats、run state、labels、warnings）。
3. Overlay（RunSummary、Death、Event、Merchant、SceneTransition）。
4. Tooltip（装备、技能、消耗品）。

### 5.2 日志覆盖

1. 装备/卸下/丢弃。
2. 技能/消耗品使用与失败原因。
3. 事件发现、选择、奖励与惩罚。
4. 层切换、Boss、Challenge、Endless/Daily 状态日志。

### 5.3 内容覆盖

1. Biomes / Monsters / Affixes。
2. Items / Skills / Talents / Mutations / Blueprints / Unlocks。
3. RandomEvents（event name/description + choice name/description）。

---

## 6. PR 级实施计划（R3）

### PR-R3-01：语言偏好迁移到 Meta（schema v6）

**目标**: 建立长期稳定的语言偏好持久化模型。

**修改文件**:
- `packages/core/src/contracts/types.ts`
- `packages/core/src/meta.ts`
- `packages/core/src/run.ts`（`createInitialMeta`）
- `packages/core/src/__tests__/meta.test.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**关键点**:
1. `MetaProgression` 新增 `preferredLocale`。
2. `schemaVersion` 升级到 `6`，迁移幂等。
3. 兼容 R2 localStorage locale，过渡期双写。

**验收**:
- 老存档可无损迁移。
- locale 偏好跨会话稳定。

---

### PR-R3-02：LanguageGateModal（启动语言选择）

**目标**: 首次进入时必须选择语言。

**新增文件**:
- `apps/game-client/src/ui/components/LanguageGateModal.ts`

**修改文件**:
- `apps/game-client/index.html`
- `apps/game-client/src/style.css`
- `apps/game-client/src/scenes/MetaMenuScene.ts`

**关键点**:
1. 新增容器 `#language-gate`。
2. 无偏好时 gate 阻塞主菜单交互。
3. 支持键盘与点击确认。

**验收**:
- 首次启动不选语言无法开始游戏。
- 选择后立即进入对应语言界面。

---

### PR-R3-03：MetaMenu 语言切换入口

**目标**: 在菜单中可随时切换语言并即时生效。

**修改文件**:
- `apps/game-client/src/ui/components/MetaMenuPanel.ts`
- `apps/game-client/src/scenes/MetaMenuScene.ts`
- `apps/game-client/src/i18n/catalog/en-US.ts`
- `apps/game-client/src/i18n/catalog/zh-CN.ts`

**关键点**:
1. 顶部新增 locale switcher（`English` / `简体中文`）。
2. 切换后触发全界面重渲染。
3. 热键提示与状态文案同步切换。

**验收**:
- 切换无刷新、无状态丢失。

---

### PR-R3-04：`zh-CN` UI 词典全量交付

**目标**: 完成 UI 相关 key 的中文词条。

**新增文件**:
- `apps/game-client/src/i18n/catalog/zh-CN.ts`

**修改文件**:
- `apps/game-client/src/i18n/catalog/en-US.ts`

**关键点**:
1. 与 en-US key 集合严格对齐。
2. 占位符命名必须一致。

**验收**:
- `catalog-completeness` 与 `placeholder-consistency` 通过。

---

### PR-R3-05：`zh-CN` 日志词典与术语统一

**目标**: 完成日志 key 的中文词条并统一术语体系。

**新增文件**:
- `docs/plans/phase3/glossary-zh-CN.md`

**修改文件**:
- `apps/game-client/src/i18n/catalog/zh-CN.ts`
- `apps/game-client/src/scenes/dungeon/logging/RunLogService.ts`

**关键点**:
1. 统一术语（示例：Soul Shards、Obol、Abyss、Affix、Cooldown）。
2. 保持战斗反馈语气一致、长度可读。

**验收**:
- 关键战斗流程日志无英文泄漏（白名单除外）。

---

### PR-R3-06：内容本地化词典（第一批全量）

**目标**: 完成内容展示相关 `zh-CN` 词条。

**新增文件**:
- `apps/game-client/src/i18n/content/zh-CN.content.ts`

**修改文件**:
- `apps/game-client/src/i18n/content/contentKeys.ts`
- `apps/game-client/src/i18n/content/ContentLocalizer.ts`
- `packages/content/src/*`（仅在确需增加稳定 id 时最小改动）

**关键点**:
1. 以 id 为锚点映射翻译，不改玩法数值结构。
2. RandomEvent choices 采用 `eventId + choiceId` 双键定位。

**验收**:
- Items/Skills/Events/Monsters/Biomes/Talents/Mutations 展示均可中文化。

---

### PR-R3-07：Dungeon 实际运行链路中文化收敛

**目标**: 覆盖真实对局内所有关键文本出口。

**修改文件**:
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/ui/Hud.ts`
- `apps/game-client/src/ui/components/EventDialog.ts`
- `apps/game-client/src/ui/components/RunSummaryScreen.ts`

**关键点**:
1. Daily/Endless/Challenge/Boss 相关文本全链路验证。
2. Tooltip 里的数值格式与单位中文化。

**验收**:
- 从开局到结算完整流程中文可读且无错位。

---

### PR-R3-08：字体与排版适配（中文可读性）

**目标**: 避免中文字符在现有字体栈下可读性下降。

**修改文件**:
- `apps/game-client/src/style.css`
- `apps/game-client/src/main.ts`（如需根据 locale 设置字体 class）

**关键点**:
1. 为 `zh-CN` 增加可读字体 fallback 栈。
2. 检查按钮、tooltip、日志在中文长度下的溢出策略。

**验收**:
- 720p/1080p 下中文 UI 不截断关键语义。

---

### PR-R3-09：自动化验证补齐（zh-CN 维度）

**目标**: 将中文覆盖纳入回归门禁。

**新增文件**:
- `apps/game-client/src/i18n/__tests__/zh-cn-smoke.test.ts`
- `apps/game-client/src/i18n/__tests__/content-localizer-zh-cn.test.ts`

**关键点**:
1. 校验 `zh-CN` key 覆盖率与 fallback 命中率阈值。
2. 校验关键路径词条（run summary / event / skill / item）存在。

**验收**:
- CI 中可稳定执行并 fail-fast。

---

### PR-R3-10：默认策略收敛与文档更新

**目标**: R3 收尾，确保可发布与可维护。

**修改文件**:
- `docs/plans/phase3/*.md`（索引更新）
- `README.md`（增加多语言说明）

**关键点**:
1. 明确默认语言策略（建议：首次按浏览器语言，之后跟随偏好）。
2. 更新开发约束：新增玩家可见文本必须走 i18n key。

**验收**:
- 文档、代码、测试门禁一致。

---

## 7. 测试与验收计划

### 7.1 每个 PR 最低门禁

```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/game-client typecheck
pnpm --filter @blodex/game-client test
pnpm --filter @blodex/game-client i18n:check
```

### 7.2 R3 阶段手工场景

1. 首次启动：弹出语言选择，选择中文后进入中文 MetaMenu。
2. 运行中切换语言：返回 MetaMenu 切换后再开局，HUD/日志中文生效。
3. Daily 模式：开始、结算、返回菜单文本一致。
4. Endless 模式：ABYSS 文案、层数、奖励提示中文正确。
5. Resume/Abandon：恢复存档后语言偏好不丢失。

### 7.3 发布前硬门槛

1. `zh-CN` key 覆盖率 >= 95%（白名单需显式登记）。
2. fallback 命中率 <= 5%（仅允许术语白名单）。
3. 无 P0/P1 文案缺陷（错位、占位符渲染失败、关键按钮不可理解）。

---

## 8. 风险与缓解

### 8.1 主要风险

1. 词条量大导致翻译质量不一致。
2. 中文文本长度引起布局溢出。
3. schema 升级（v6）带来兼容风险。

### 8.2 缓解方案

1. 术语表先行 + 关键流程优先验收。
2. UI 组件层面增加 `text-overflow` 与多行策略。
3. schema 迁移先做单测与回归快照，再放量。

---

## 9. R3 完成定义（Definition of Done）

1. 启动语言选择可用且稳定。
2. `zh-CN` 首批本地化达到可发布标准（UI + log + content）。
3. 语言偏好持久化模型稳定（含旧数据兼容）。
4. 中文排版在主流分辨率下可读。
5. 自动化门禁可持续阻止 i18n 质量倒退。

---

## 10. R3 对 R4 的承接

R3 完成后，R4 可专注工程治理，不再纠缠业务文案结构：

1. CSS 模块化可基于稳定文案结构推进。
2. 构建产物隔离与仓库卫生治理不会受 i18n 重构牵制。
3. 翻译质量校验可纳入统一 CI 门禁链路。

R3 的长期价值：**把多语言从“功能点”升级为“工程能力”，为后续语言扩展与长期维护打下稳定基础。**
