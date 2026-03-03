# 质量门禁（R4）

本文件定义 `Blodex` 在 R4 后的工程治理基线。所有合并到主干的改动都必须通过以下门禁。

## 必过门禁

| Gate | Command | 说明 |
| --- | --- | --- |
| TypeCheck | `pnpm check` | 全工作区 TypeScript 类型检查 |
| Unit Tests | `pnpm test` | `core` + `game-client` + `content` 测试 |
| i18n Catalog | `pnpm --filter @blodex/game-client i18n:check` | UI/log key 与占位符一致性 |
| CSS Architecture | `pnpm --filter @blodex/game-client css:check` | 样式模块结构、导入顺序、特异性与 magic number 门禁 |
| Content Locale Consistency | `pnpm check:content-i18n` | 内容词条 en-US/zh-CN 覆盖与一致性 |
| Source Hygiene | `pnpm check:source-hygiene` | 检查 `src/**` 下非法构建产物 |

## 本地一键预检

```bash
pnpm precheck
```

`precheck` 与 CI 门禁语义一致，建议在提交前执行。

## CI 规则

- 工作流文件：`.github/workflows/ci.yml`
- 阻断策略：任意门禁失败即阻断合并。
- 入口命令：`pnpm ci:check`

## CSS 治理规则

- 样式入口固定为 `apps/game-client/src/styles/` 模块化结构。
- `apps/game-client/src/main.ts` 必须按既定顺序导入 CSS 模块。
- 禁止新增未登记的 ID 选择器。
- 禁止新增未登记的 `px` 字面量（默认通过 token 与 allowlist 管控）。

## 源码卫生规则

- `apps/*/src` 与 `packages/*/src` 下禁止出现：
  - `*.js`
  - `*.js.map`
  - `*.d.ts`
  - `*.d.ts.map`
- 构建产物统一进入 `dist/**` 或工具指定输出目录。

## 多语言内容规则

- 玩家可见文本必须走 i18n key。
- 新增 content 数据时，必须同步覆盖：
  - `en-US`
  - `zh-CN`
- 不允许通过 fallback 形成“伪翻译完成”。

## 例外机制

- 所有例外（例如临时 allowlist）必须在 PR 描述中写明：
  - 例外原因
  - 影响范围
  - 清理截止日期
