# Phase 4.0 基线冻结与规范收敛实施文档（PR 级）

**日期**: 2026-03-03  
**阶段**: Phase 4 / 4.0  
**目标摘要**: 在进入 4.1~4.7 的代码重构与玩法迭代前，先完成执行基线统一、质量门禁落地与开发流程固化，确保后续改造“可持续、可回归、可收敛”。

**关联文档**:
1. `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md`（主计划）
2. `docs/plans/phase4/2026-03-03-phase4-review-and-roadmap.md`
3. `docs/plans/phase4/2026-03-03-dungeon-deep-refactor-foundation.md`
4. `docs/plans/phase3/2026-03-03-r1-scene-ui-architecture-refactor.md`（结构参考）

---

## 1. 直接结论

4.0 必须先完成“治理面收口”，再进入功能与架构深改。执行顺序如下：

1. 统一计划基线：确定唯一主文档与文档跳转策略，停止平行路线图分叉。
2. 锁定工程门禁：把架构预算检查、CI 链路、执行命令固化到仓库。
3. 固化 PR 交付协议：每个后续 PR 强制携带同构验收矩阵、风险说明和回滚路径。
4. 冻结启动快照：记录 4.0 结束时的行数、方法数、flag 引用、测试缺口，作为 4.1 起点。

4.0 的本质不是“改功能”，而是把后续所有改造置于可控系统之内。

---

## 2. 范围与非目标

### 2.1 范围

1. 计划与执行文档治理（统一主计划、旧文档迁移说明、阶段文档建立）。
2. 架构预算门禁治理（脚本、CI 接入、预算白名单与收紧策略）。
3. PR 验收矩阵与执行模板治理（开发过程标准化）。
4. 4.0 基线数据冻结（可量化指标与核验命令）。

### 2.2 非目标

1. 不进行 `DungeonScene` 业务逻辑迁移（4.1 起执行）。
2. 不进行 HUD/Boss/Endless 等功能增强（4.4+ / 4.5+ 执行）。
3. 不修改玩法规则或数值平衡。
4. 不扩大 `@blodex/core` 协议或存档 schema。

---

## 3. 现状基线（4.0 输入）

> 以下为 4.0 编写时的工作区实测数据，用于后续阶段对比。

### 3.1 体量快照

| 文件 | 当前行数 |
|---|---:|
| `apps/game-client/src/scenes/DungeonScene.ts` | 6301 |
| `apps/game-client/src/ui/Hud.ts` | 963 |
| `apps/game-client/src/scenes/MetaMenuScene.ts` | 1093 |
| `packages/core/src/contracts/types.ts` | 818 |

### 3.2 架构预算快照

当前预算检查输出（临时白名单）：

1. `DungeonScene.ts`: `6301/7000`, `161/220 methods`
2. `MetaMenuScene.ts`: `1093/1300`, `40/90 methods`
3. `Hud.ts`: `963/1100`, `10/80 methods`

### 3.3 Flag 与债务快照

`UI_POLISH_FLAGS` 仍有引用，且全部为 `true`。

高频引用位置：

1. `apps/game-client/src/scenes/DungeonScene.ts`
2. `apps/game-client/src/scenes/MetaMenuScene.ts`
3. `apps/game-client/src/ui/components/RunSummaryScreen.ts`
4. `apps/game-client/src/ui/components/SkillBar.ts`
5. `apps/game-client/src/main.ts`

---

## 4. 4.0 输出物定义

4.0 完成后，仓库应稳定具备以下输出物：

1. 唯一主计划文档：`2026-03-03-phase4-integrated-execution-plan.md`。
2. 旧文档迁移提示：原路线图与地基文档顶部均指向主计划。
3. 架构预算门禁：`scripts/check-architecture-budgets.sh` 与 `package.json` 的 `check:architecture-budget`/`ci:check` 链路。
4. PR 模板：`docs/plans/phase4/templates/phase4-pr-checklist.md`。
5. 冒烟矩阵模板：`docs/plans/phase4/templates/phase4-smoke-matrix.md`。
6. 4.0 基线快照：`docs/plans/phase4/metrics/2026-03-03-phase4-0-baseline.md`。
7. 阶段实施文档：本文件（4.0）作为 4.1~4.7 的模板基准。

---

## 5. PR 级实施计划（4.0）

> 规则：每个 PR 单目标、可回滚、可复核；禁止把 4.1 逻辑混入 4.0 PR。

### PR-4.0-01：统一执行基线落地

**目标**: 建立唯一执行入口，终止并行计划。

**修改范围**:

1. 新建/更新主计划文档。
2. 在旧文档顶部添加“已整合到主计划”的迁移提示。
3. 在 `docs/plans/phase4` 下建立阶段文档命名规则。

**验收标准**:

1. 团队成员打开任一旧文档可在首屏看到主计划跳转。
2. 主计划覆盖 4.0~4.7 的完整顺序与出口门禁。
3. 文档之间不存在冲突性执行指令。

---

### PR-4.0-02：架构预算与 CI 门禁收敛

**目标**: 防止重构过程中出现新的超级大类回退。

**修改范围**:

1. `scripts/check-architecture-budgets.sh`
2. `package.json` (`check:architecture-budget` + `ci:check`)

**关键要求**:

1. 本地可执行（兼容常见 shell 环境）。
2. 预算超标时 CI 明确失败并给出文件级报错。
3. 白名单是“技术债清单”，不是永久豁免。

**验收标准**:

1. `pnpm check:architecture-budget` 成功。
2. `pnpm ci:check` 链路包含预算检查步骤。
3. 白名单文件与阈值可审计且可逐阶段收紧。

---

### PR-4.0-03：PR 交付协议与执行矩阵固化

**目标**: 把后续 4.1~4.7 的交付标准前置为模板。

**落地文件**:

1. `docs/plans/phase4/templates/phase4-pr-checklist.md`
2. `docs/plans/phase4/templates/phase4-smoke-matrix.md`

**模板内容最小要求**:

1. 阶段编号与任务编号（如 `4.2 / PR-05`）。
2. 变更边界（改了什么、没改什么）。
3. 自动化命令结果记录。
4. 手动冒烟记录（Normal/Boss/Endless/Save）。
5. 风险点与回滚方案。

**验收标准**:

1. 模板可直接复制用于新 PR。
2. 模板字段足够支撑代码评审与回归定位。
3. 不依赖口头约定。

---

### PR-4.0-04：4.0 阶段快照冻结

**目标**: 形成 4.1 的可比较起点。

**落地文件**:

1. `docs/plans/phase4/metrics/2026-03-03-phase4-0-baseline.md`

**快照项**:

1. 关键文件行数。
2. 架构预算检查输出。
3. `UI_POLISH_FLAGS` 引用清单。
4. 核心测试覆盖缺口（AISystem/MovementSystem/MonsterSpawnSystem）。

**验收标准**:

1. 快照数据可通过命令复核。
2. 作为 4.1 里程碑对比输入可直接使用。

---

## 6. 执行步骤（可直接照做）

### 6.1 Step A：文档统一

```bash
# 1) 确认主计划存在
ls docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md

# 2) 检查旧文档已添加迁移提示
sed -n '1,10p' docs/plans/phase4/2026-03-03-phase4-review-and-roadmap.md
sed -n '1,10p' docs/plans/phase4/2026-03-03-dungeon-deep-refactor-foundation.md
```

### 6.2 Step B：门禁核验

```bash
# 1) 独立运行预算检查
pnpm check:architecture-budget

# 2) 验证 CI 链路包含预算检查
node -e "const p=require('./package.json');console.log(p.scripts['ci:check'])"
```

### 6.3 Step C：基线快照冻结

```bash
# 文件体量
wc -l apps/game-client/src/scenes/DungeonScene.ts \
      apps/game-client/src/ui/Hud.ts \
      apps/game-client/src/scenes/MetaMenuScene.ts \
      packages/core/src/contracts/types.ts

# flag 引用清单
rg -n "UI_POLISH_FLAGS|sceneRefactorR1Enabled|metaMenuDomEnabled|runSummaryV2Enabled|skillCooldownOverlayEnabled|i18nInfrastructureEnabled" apps/game-client/src -S
```

### 6.4 Step D：模板与快照文件核验

```bash
# 模板文件存在性
ls docs/plans/phase4/templates/phase4-pr-checklist.md
ls docs/plans/phase4/templates/phase4-smoke-matrix.md

# 基线快照文件存在性
ls docs/plans/phase4/metrics/2026-03-03-phase4-0-baseline.md
```

---

## 7. 出口门禁（4.0 Done 定义）

4.0 只有在以下条件全部满足时才视为完成：

1. 主计划是唯一执行入口，旧文档都已标注迁移。
2. 架构预算检查可运行，并已挂入 `ci:check`。
3. PR 模板与冒烟矩阵模板已落地并可复用。
4. 4.0 基线快照文件完成且可复核。
5. 团队确认从下一 PR 起按 4.1 顺序执行，不跨阶段插单。

---

## 8. 风险与回滚策略

| 风险 | 等级 | 表现 | 处理 |
|---|:---:|---|---|
| 文档仍分叉执行 | 中 | 不同成员引用不同计划 | 统一 PR 模板首项强制填写主计划链接 |
| 门禁脚本环境兼容问题 | 中 | 本地可跑但 CI 失败（或反之） | 用最小 shell 特性，补充兼容注释与自测命令 |
| 白名单长期不收敛 | 高 | 每阶段未收紧阈值 | 在阶段出口门禁中加入“阈值收紧”硬要求 |
| 4.0 与 4.1 任务混改 | 中 | PR 过大，无法回归 | 严格按 PR-4.0-* 编号与范围审核 |

回滚原则：

1. 4.0 变更以文档和门禁为主，可直接按文件粒度回滚。
2. 回滚后必须重新确认 `ci:check` 完整链路，防止“假绿”。

---

## 9. 与 4.1 的交接清单

进入 4.1 前必须确认：

1. `docs/plans/phase4/2026-03-03-phase4-0-baseline-freeze-and-governance.md` 已评审通过。
2. `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md` 无冲突项待定。
3. `pnpm check:architecture-budget` 稳定通过。
4. 4.0 基线快照已提交并可被 4.1 用于比较。
5. 4.1 的首个 PR 已明确“仅迁移 Debug/Save，不触碰玩法语义”。

---

## 10. 备注（执行纪律）

1. 4.0 是治理阶段，不以“改了多少代码”为成功标准。
2. 4.0 的成功标准是：后续阶段每个 PR 都可被低成本验证与回滚。
3. 若 4.0 没有做扎实，4.1~4.7 的复杂改造会快速失控。
