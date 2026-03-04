# Phase 4 PR 交付检查清单（模板）

**用途**: 约束 Phase 4 每个 PR 的变更边界、验证证据、风险与回滚路径。  
**适用范围**: `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md` 下的全部 PR（4.0~4.7）。

---

## 1. PR 元信息

| 字段 | 内容 |
|---|---|
| 阶段 | `4.x` |
| PR 编号 | `PR-4.x-yy` |
| 分支 | `codex/...` |
| 负责人 | `@owner` |
| 关联任务 | issue / ticket 链接 |
| 主计划链接 | `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md` |

---

## 2. 变更边界

### 2.1 本 PR 改了什么

1. ...
2. ...

### 2.2 本 PR 明确不改什么

1. ...
2. ...

### 2.3 风险评估

| 风险项 | 等级 | 影响范围 | 缓解措施 |
|---|:---:|---|---|
| ... | 高/中/低 | ... | ... |

---

## 3. 自动化验证记录

| 命令 | 结果 | 证据 |
|---|---|---|
| `pnpm check:architecture-budget` | Pass / Fail | 终端输出摘要 |
| `pnpm ci:check` | Pass / Fail | 终端输出摘要 |
| 其他必要命令 | Pass / Fail | 终端输出摘要 |

> 要求：失败命令必须记录原因、影响和修复结论；禁止“本地未执行”。

---

## 4. 手动冒烟记录

1. 冒烟矩阵文件：`docs/plans/phase4/templates/phase4-smoke-matrix.md`（复制后填充本次 PR 记录）。
2. 最小覆盖：Normal / Boss / Endless / Save-Load。
3. 每条冒烟必须包含：输入步骤、预期、实际、截图或日志证据。

---

## 5. 回滚方案

### 5.1 回滚触发条件

1. ...
2. ...

### 5.2 回滚步骤（按可执行命令）

```bash
# example
git revert <commit>
pnpm ci:check
```

### 5.3 回滚后验证

1. 关键链路回归通过。
2. 架构预算门禁通过。
3. 无新增阻塞级缺陷。

---

## 6. 验收结论

- [ ] 变更边界清晰且符合阶段目标。
- [ ] 自动化验证完整且证据可追溯。
- [ ] 冒烟矩阵完成并可复核。
- [ ] 风险与回滚路径完整。
- [ ] 可进入下一阶段/下一 PR。
