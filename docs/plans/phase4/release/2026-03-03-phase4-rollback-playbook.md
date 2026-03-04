# Phase 4 回滚手册（Rollback Playbook）

**日期**: 2026-03-03  
**阶段**: Phase 4.7  
**适用范围**: Phase 4.0~4.6 交付在发布窗口内的紧急回滚。

---

## 1. 回滚触发条件

1. 出现 P0 故障（崩溃、卡死、关键流程不可达）。
2. 旧档迁移失败或存档恢复错误（兼容故障）。
3. 性能显著退化并影响主流程（无法在窗口内热修复）。
4. 发布后 30 分钟内连续出现高严重告警。

---

## 2. 回滚策略

### 2.1 最小影响原则

1. 优先按 PR 粒度回滚，避免整批撤销。
2. 优先回滚最近引入且风险最高的变更。
3. 回滚后必须立即复跑最小阻塞矩阵。

### 2.2 推荐回滚顺序

1. 先回滚 4.6 高风险玩法层（G4/G6/G7）。
2. 如仍异常，再回滚 4.5 体验增强层。
3. 最后才处理 4.4 及更早结构层（风险高，需谨慎）。

---

## 3. 标准回滚步骤

```bash
# 1) identify target commits

git log --oneline --decorate -n 30

# 2) rollback by PR commit(s)

git revert <commit_sha_1> <commit_sha_2>

# 3) validate gates

pnpm check:architecture-budget
pnpm ci:check

# 4) push rollback branch

git push origin <rollback_branch>
```

---

## 4. 数据与兼容注意事项

1. Save/Meta 仅做前向迁移，不支持线上“降版本迁移”。
2. 如回滚涉及 schema 字段，必须保证读取路径对新字段具备容错。
3. 回滚后发现存档不兼容时，优先上线兼容补丁，再评估是否扩大回滚范围。

---

## 5. 回滚后验证

| 检查项 | 标准 | 结果 | 证据 |
|---|---|---|---|
| 自动化门禁 | `pnpm ci:check` 通过 | Pending | 待填 |
| 主流程冒烟 | Normal/Boss/Endless 可通过 | Pending | 待填 |
| 兼容验证 | 旧 save/meta 可加载 | Pending | 待填 |
| 性能验证 | 关键指标恢复至基线附近 | Pending | 待填 |

---

## 6. 回滚演练记录

| 演练日期 | 演练版本 | 触发条件 | 演练结果 | 记录人 | 备注 |
|---|---|---|---|---|---|
| 待填 | 待填 | 待填 | Pending | 待填 | 待填 |
