# Phase 6 Rollback Playbook

**基线 commit**: `19574b7`  
**状态**: `Ready`

## 1. 触发条件与回滚粒度

1. 出现 P0 故障或主流程不可达。
2. pacing / reward / compare / runtime effect 出现不可接受回归。
3. 资源 fallback 失败导致运行时缺件。

## 2. 推荐回滚顺序

1. 先回滚 6.4 / 6.3 体验层 PR。
2. 再回滚 6.2 / 6.1 规则层 PR。
3. 最后才回滚 6.0 观测基线层。

## 3. 标准回滚步骤

```bash
git log --oneline --decorate -n 30
git revert <commit_sha_1> <commit_sha_2>
pnpm check:architecture-budget
pnpm ci:check
git push origin <rollback_branch>
```

## 4. 回滚后验证

| 检查项 | 标准 | 结果 | 证据 |
|---|---|---|---|
| 自动化门禁 | `pnpm ci:check` 通过 | Pass | 2026-03-07 本地执行 |
| story run | Normal / Hard / Nightmare 可执行 | Pass | `pnpm phase6:evidence:report` 已生成三难度结果 |
| compare / heartbeat / reward | 关键链路可降级 | Pending | 需人工冒烟确认 |
| 资源 fallback | cue 可降级或静默失效 | N/A | 6.5 无资源增量 |

## 5. 演练记录

| 演练日期 | 触发条件 | 演练结果 | 记录人 | 备注 |
|---|---|---|---|---|
| 待填 | 待填 | Pending | 待填 | 待填 |
