![Blodex](docs/assets/Blodex.png)

# Blodex

Blodex 是一个基于 Phaser + TypeScript 的等距视角黑暗奇幻 ARPG MVP。
当前主干已完成 Phase 4 的核心改造，架构从 `DungeonScene` 超大类演进为“场景壳 + 模块化运行时 + UI 容器化”。

## 环境要求

- Node.js `22.x`
- pnpm `10.23.0`（由 `packageManager` 固定）
- Bash（资产脚本依赖）

## 快速开始

```bash
corepack enable
corepack prepare pnpm@10.23.0 --activate
pnpm install
pnpm dev
```

## Monorepo 结构

- `apps/game-client`: Phaser + Vite 客户端，包含场景、系统、UI、反馈与存档适配层
- `packages/core`: 纯逻辑核心（战斗、成长、随机、存档协议、迁移）
- `packages/content`: 配置数据（怪物、物品、掉落、Biome、事件、关卡配置）
- `packages/tooling`: 资产管线工具（计划编译、manifest 校验、音频校验）

## 常用命令

开发与验证：
- `pnpm dev`: 本地启动游戏（先构建 core/content，再启动 client）
- `pnpm test`: 运行 `core + game-client + content` 测试
- `pnpm build`: 构建所有 workspace 包
- `pnpm check`: 全仓 TypeScript 检查
- `pnpm quality:precheck`: 提交前本地门禁
- `pnpm ci:check`: CI 等价门禁（typecheck/test/i18n/css/content/budget）

架构与治理：
- `pnpm check:architecture-budget`: 类文件行数/方法数预算门禁
- `pnpm check:toolchain`: 本地与 CI 工具链一致性检查
- `pnpm check:source-hygiene`: 阻止 `src/**` 下产物污染
- `pnpm check:content-i18n`: 内容层多语言一致性检查
- `pnpm --filter @blodex/game-client i18n:check`: 客户端文案校验
- `pnpm --filter @blodex/game-client css:check`: CSS 架构规则检查

资产管线：
- `pnpm assets:compile`: 编译图片资产计划
- `pnpm assets:generate`: 生成图片资产并复制到客户端目录
- `pnpm assets:images:optimize`: 图片压缩与优化
- `pnpm assets:images:report`: 图片资产体积报告
- `pnpm assets:audio:compile`: 编译音频计划
- `pnpm assets:audio:sync`: 同步音频到客户端
- `pnpm assets:audio:validate`: 校验音频 manifest
- `pnpm assets:validate`: 统一校验图片 + 音频资产

## 当前架构快照（Phase 4）

- `DungeonScene` 作为场景壳，负责 Phaser 生命周期与模块装配。
- 帧流程编排由 `RunFlowOrchestrator + EncounterController + WorldEventController` 负责。
- 运行时模块按职责拆分到 `apps/game-client/src/scenes/dungeon/*`：
  - `debug`: Debug API 与热键
  - `save`: 运行快照构建、恢复、保存调度
  - `encounter`: Boss 与战斗遭遇流程
  - `world`: 事件、危险区、楼层推进、延迟收益
  - `run`: Run 完结、结算、Abyss 入口
- HUD 已容器化：`Hud.ts` 仅保留薄入口，主要逻辑在 `ui/hud/HudContainer.ts` 与 `ui/components/*`。
- 详细分层与数据流见 `docs/architecture.md`。

## 存档与兼容性

- Meta 存档：
  - key: `blodex_meta_v2`（兼容读取 v1）
  - schema: `6`
  - 能力：难度进度、天赋、Blueprint、Mutation、Synergy、Daily 历史、语言偏好
- Run 存档：
  - key: `blodex_run_save_v2`（兼容读取 v1 并回写 v2）
  - schema: `2`
  - 支持：多 tab lease、自动保存、`deferredOutcomes` 延迟收益恢复

## 调试入口（仅本地开发）

URL Query：
- `?debugCheats=1`: 开启调试命令
- `?debugDiagnostics=1`: 打开诊断面板
- `?disableVfx=1`: 关闭 VFX
- `?disableSfx=1`: 关闭 SFX
- `?debugEquipGate=1`: 注入锁定装备调试路径

调试热键（开启 `debugCheats` 后）：
- `Alt+H`: 帮助
- `Alt+L`: 诊断快照
- `Alt+J`: 压测命令
- `Alt+1..5`: 跳层
- `Alt+N`: New Run

## 文档索引

- 架构文档：`docs/architecture.md`
- 产品规格：`docs/mvp-spec.md`
- 美术风格：`docs/art-style-bible.md`
- 工程门禁：`docs/engineering/quality-gates.md`
- Phase 4 主计划：`docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md`
