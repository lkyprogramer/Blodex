# Phase 5 V2 PR Checklist

## 1. 基本信息

1. PR ID:
2. 阶段:
3. 对应风险 ID:
4. 负责人:

## 2. 变更范围

1. 修改文件列表:
2. 影响规则点:
3. 是否涉及资源链路（图片/音频）:

## 3. 契约一致性

1. 是否遵守 `contracts.md` 单位定义:
2. 是否新增可见属性:
3. 若新增可见属性，是否已有结算消费路径:

## 4. 架构边界

1. 是否新增 `Record<string, any>` host 依赖:
2. 是否新增逻辑回流到 `DungeonScene/MetaMenuScene/HudContainer`:
3. Host Port 接口是否保持显式化:

## 5. 验证

### 5.1 自动化命令

```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/game-client test
pnpm check:architecture-budget
pnpm ci:check
```

### 5.2 手动冒烟

1. 默认优先使用金手指（debug cheats）快速覆盖关键场景。
2. 需记录场景、步骤、结果、截图或日志。
3. 若涉及平衡体感，补一轮非金手指复测。

## 6. 回滚与风险

1. 回滚粒度:
2. 开关或回退策略:
3. 未关闭风险与豁免单:

## 7. 完成声明

1. 是否满足阶段出口门禁:
2. 是否允许进入下一阶段:

