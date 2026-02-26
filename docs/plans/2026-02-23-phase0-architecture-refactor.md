# Phase 0 架构重构实施方案（0A/0B）

**Date**: 2026-02-23  
**Scope**: 仅覆盖 Phase 0（不引入新玩法，不改变可见行为）  
**Goal**: 在不改变现有可玩体验的前提下，完成场景降耦、事件化基础、确定性运行与回归测试基线。

---

## 1. 目标与边界

### 1.1 目标
- 将 `DungeonScene` 从 God Object 拆分为可测试、可演进的系统模块。
- 建立 typed EventBus（仅用于领域事件）。
- 将怪物 AI 参数与掉落表映射彻底数据化。
- 建立确定性运行基线（RunSeed + replay hook）。
- 提升核心测试覆盖，形成后续 Phase 1 的安全地板。

### 1.2 非目标
- 不做技能系统、Boss、多层地牢、元进度扩展。
- 不做视觉表现升级（VFX/SFX/UI 重构放到后续阶段）。
- 不改动现有数值平衡与战斗手感目标值。

---

## 2. 当前基线（来自现有仓库）

- `DungeonScene` 约 797 行，输入/移动/AI/战斗/掉落/UI/存档耦合在单类中。
- 关键硬编码仍在场景层：
  - 怪物 `dropTableId` 使用 `if/else` 计算。
  - `chaseRange=7`、`attackCooldown=1800ms` 固定写死。
- 运行种子使用 `Date.now()`，缺少可复盘能力。
- `core` 已有纯函数基础与单测，但集成级回归不足。

---

## 3. 不可协商约束（Hard Constraints）

1. 行为兼容优先
- Phase 0 的目标是“结构变化”，不是“玩法变化”。
- 所有 PR 必须通过行为等价验收（手动 smoke + 自动回归）。

2. Schema 兼容优先
- 现有字段命名保持 canonical：`MetaProgression.runsPlayed` 等不重命名。
- 不在 Phase 0 引入破坏性存档结构变更。

3. 分层边界清晰
- `packages/core` 只处理领域状态与领域事件。
- `apps/game-client` 承担渲染、输入、UI、副作用编排。

4. 确定性优先
- 所有影响战斗和掉落的随机行为必须可由 `RunSeed` 重放。

---

## 4. 实施总览：0A / 0B

## 4.1 Phase 0A（先降耦）

**目标**: 拆分场景职责 + 数据驱动 + 回归基线，不引入事件总线依赖。  
**产出**: 结构性重构完成，行为保持一致。

### 0A-1 数据驱动怪物配置

**修改范围**
- `packages/content/src/monsters.ts`
- `packages/content/src/types.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**实施内容**
- 在 `MonsterArchetypeDef` 增加：
  - `dropTableId`
  - `aiConfig: { chaseRange, attackCooldownMs, fleeThreshold?, wanderRadius? }`
- 删除场景中的掉落与 AI 参数硬编码，统一读取 archetype 配置。

**验收标准**
- 怪物追击距离与攻击间隔与当前版本一致。
- 掉落表分配逻辑结果不变（只改数据来源，不改结果）。

### 0A-2 场景拆分（不引入事件总线）

**新增模块（client 层）**
- `apps/game-client/src/systems/EntityManager.ts`
- `apps/game-client/src/systems/MovementSystem.ts`
- `apps/game-client/src/systems/AISystem.ts`
- `apps/game-client/src/systems/CombatSystem.ts`

**职责约束**
- `EntityManager`: 实体生命周期、查询、索引（可选）。
- `MovementSystem`: 路径计算与移动更新。
- `AISystem`: 决策（idle/chase/attack）与冷却节奏。
- `CombatSystem`: 战斗结算、击杀后经验与掉落判定。
- `DungeonScene`: Phaser 生命周期、渲染同步、输入桥接、系统编排。

**验收标准**
- `DungeonScene` 行数显著下降（阶段目标：先降到约 300~400）。
- 一局完整流程可用：移动、战斗、掉落、装备、结算、重开。

### 0A-3 测试基线补齐

**新增/增强测试**
- `packages/core/src/__tests__/stats.test.ts`
  - 公式回归快照（防止系数漂移）。
- `packages/core/src/__tests__/combat.test.ts`
  - 最小伤害、极端护甲、死亡状态分支等边界。
- `packages/core/src/__tests__/integration.test.ts`
  - `kill -> drop -> pickup -> equip` 主链路。

**覆盖目标**
- `packages/core` line coverage >= 75%
- `packages/core` branch coverage >= 60%

---

## 4.2 Phase 0B（再事件化 + 确定性）

**目标**: 在 0A 稳定边界上接入 EventBus 与 deterministic replay hook。  
**产出**: 可观测、可扩展、可重放的运行基础设施。

### 0B-1 Typed EventBus（core）

**新增文件**
- `packages/core/src/eventBus.ts`
- `packages/core/src/__tests__/eventBus.test.ts`

**导出调整**
- `packages/core/src/index.ts` 增加 `eventBus` export。

**API 要求**
- `on/off/emit/removeAll`
- 同步分发
- 强类型事件映射

### 0B-2 领域事件定义与边界

**修改文件**
- `packages/core/src/contracts/events.ts`

**原则**
- 只定义领域事件（Domain Events），例如：
  - `combat:*`, `player:*`, `loot:*`, `item:*`, `run:*`, `floor:*`, `monster:*`
- 表现层事件（`vfx:*`, `sfx:*`, `ui:*`）不进入 core 事件契约。
- 为平滑迁移保留 legacy 导出，但标记 deprecated。

### 0B-3 RunSeed 与 Replay Hook

**建议修改范围**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/run.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`

**实施内容**
- 引入显式 `RunSeed`，禁用隐式 `Date.now()` 驱动关键逻辑。
- 统一种子派生规则：`runSeed + floor`。
- 记录轻量 replay hook：
  - 输入时间线（移动目标、技能触发等）
  - 种子与版本元数据
  - 结束校验摘要（checksum）

**验收标准**
- 固定 seed 下，核心结果一致：
  - 击杀数、掉落序列、升级节点、run summary。

---

## 5. PR 拆分与依赖顺序

1. PR-01: 怪物配置数据化（drop + aiConfig）
- 低风险、收益立竿见影，先做。

2. PR-02: EntityManager 抽离
- 把实体与渲染对象解耦。

3. PR-03: MovementSystem + AISystem 抽离
- 保留行为，拆掉场景中移动/决策逻辑。

4. PR-04: CombatSystem 抽离
- 收拢战斗链路，准备事件化。

5. PR-05: core 测试基线补齐
- stats/combat/integration 回归。

6. PR-06: EventBus + GameEventMap
- 先接入核心事件流，再做订阅迁移。

7. PR-07: RunSeed + replay hook
- 完成确定性闭环。

8. PR-08: Phase 0 收敛
- 清理冗余代码、文档更新、最终 DoD 验收。

---

### 5.1 依赖关系图（执行顺序）

```text
PR-01 -> PR-02 -> PR-03 -> PR-04 -> PR-06 -> PR-07 -> PR-08
              \\-> PR-05 ----------------------^
```

说明:
- `PR-05`（测试补齐）可在 `PR-02` 后并行推进，但合并前必须 rebase 到主线最新版本。
- `PR-06`（EventBus 接入）必须在核心系统拆分稳定后进行，避免边拆边接事件导致双重重构。
- `PR-07` 依赖 `PR-06`，因为 replay hook 需要稳定的事件/状态边界。

---

## 6. PR 执行模板（可直接复制到 PR 描述）

### 6.1 通用模板

```md
## Background
- 本 PR 解决的问题:
- 对应 Phase 0 子目标:

## Scope
- 变更文件:
- 变更类型: [refactor | test | infra]
- 非目标（明确不做）:

## Design Constraints
- [ ] 不改变可见行为
- [ ] 不引入破坏性 schema 变更
- [ ] core/client 分层边界不被打破
- [ ] 随机行为仍可被 seed 复现（若适用）

## Verification
- [ ] `pnpm --filter @blodex/core test`
- [ ] `pnpm --filter @blodex/core build`
- [ ] `pnpm --filter @blodex/content build`（若适用）
- [ ] `pnpm --filter @blodex/game-client typecheck`
- [ ] 手动 smoke 通过（附最小记录）

## Risk & Rollback
- 风险点:
- 回滚策略（最小回滚单元）:

## Acceptance
- [ ] 对应 DoD 条款满足
- [ ] Code review 无跨层耦合问题
```

### 6.2 PR-01 到 PR-08 专项清单

#### PR-01: 怪物配置数据化（drop + aiConfig）
- [x] `MonsterArchetypeDef` 增加 `dropTableId` 与 `aiConfig`。
- [x] `DungeonScene` 中移除对应硬编码分支。
- [x] 行为对比:
  - [x] 追击范围一致
  - [x] 攻击间隔一致
  - [x] 掉落表映射结果一致

#### PR-02: EntityManager 抽离
- [x] 实体生命周期操作从 `DungeonScene` 移出。
- [x] 渲染对象生命周期与实体状态一致（无残留 sprite）。
- [x] run reset 后实体与渲染缓存均清空。

#### PR-03: MovementSystem + AISystem 抽离
- [x] 玩家路径与寻路行为保持一致。
- [x] 怪物 `idle/chase/attack` 决策行为一致。
- [x] 不引入新的时间源与帧依赖抖动。

#### PR-04: CombatSystem 抽离
- [x] 玩家攻击节奏、伤害、击杀后 XP/掉落逻辑一致。
- [x] 怪物攻击与死亡判定一致。
- [x] 战斗链路不再在 `DungeonScene` 内直接耦合多处状态修改。

#### PR-05: core 测试基线补齐
- [x] `stats` 回归测试覆盖关键系数。
- [x] `combat` 边界测试覆盖死亡/最小伤害/极值防护。
- [x] `integration` 覆盖 kill->drop->pickup->equip 主链路。
- [x] 覆盖率达到目标基线。

#### PR-06: EventBus + GameEventMap
- [x] EventBus API 完整且有独立单测。
- [x] `contracts/events.ts` 仅定义领域事件（无 `ui:*`/`vfx:*`/`sfx:*`）。
- [x] `DungeonScene` 接入事件流后行为无变化。
- [x] 订阅生命周期有清理机制（避免泄漏）。

#### PR-07: RunSeed + replay hook
- [x] 关键逻辑不再依赖 `Date.now()` 作为随机输入源。
- [x] `RunSeed` 驱动地图、掉落、战斗相关随机行为。
- [x] replay 元数据可回放并生成一致 checksum。
- [x] 固定 seed 样本复验通过（>= 3 组）。

#### PR-08: Phase 0 收敛
- [x] 删除过渡代码与重复逻辑。
- [x] 文档与实现一致（roadmap、phase0 计划、注释）。
- [x] 0A/0B DoD 全部满足。
- [x] 为 Phase 1 留出明确扩展点（无临时耦合残留）。

### 6.3 建议工时与并行策略（供排期）

| PR | 估算 | 并行性 |
|----|------|--------|
| PR-01 | 0.5~1d | 可先行单独完成 |
| PR-02 | 1~1.5d | 与 PR-05 可部分并行 |
| PR-03 | 1~1.5d | 依赖 PR-02 |
| PR-04 | 1~1.5d | 依赖 PR-03 |
| PR-05 | 1d | 依赖 PR-01/02 稳定接口 |
| PR-06 | 1~1.5d | 依赖 PR-04 |
| PR-07 | 1~1.5d | 依赖 PR-06 |
| PR-08 | 0.5~1d | 最后收敛 |

---

## 7. 验证与验收

### 7.1 自动化验证

```bash
pnpm --filter @blodex/core test
pnpm --filter @blodex/core build
pnpm --filter @blodex/content build
pnpm --filter @blodex/game-client typecheck
```

### 7.2 手动 smoke 清单
- 点击移动路径正常。
- 怪物追击/攻击节奏与重构前一致。
- 击杀后掉落、自动拾取、装备/卸下正常。
- 胜利/死亡结算与 New Run 正常。
- 固定 seed 下两次运行结果一致（至少 3 组样本）。

### 7.3 0A / 0B DoD

| Gate | DoD |
|------|-----|
| 0A Done | 场景拆分完成且行为等价，核心测试覆盖达到目标基线 |
| 0B Done | 事件总线稳定、RunSeed 生效、replay checksum 在固定样本内一致 |

---

## 8. 主要风险与缓解

1. 重构引入隐性行为漂移
- 缓解: 每个 PR 附最小回归测试 + 手动 smoke 录像对照。

2. 事件边界污染（UI 事件进入 core）
- 缓解: code review 强约束，`contracts/events.ts` 仅允许领域事件。

3. 确定性受帧率和时间源影响
- 缓解: 关键逻辑使用统一时间与 seed 派生，不以 wall-clock 直接驱动判定。

4. PR 过大导致回滚困难
- 缓解: 严格按 PR-01~PR-08 小步提交，每步可独立回退。

---

## 9. 交付物清单

### 新增（预期）
- `packages/core/src/eventBus.ts`
- `packages/core/src/__tests__/eventBus.test.ts`
- `packages/core/src/__tests__/stats.test.ts`
- `packages/core/src/__tests__/integration.test.ts`
- `apps/game-client/src/systems/EntityManager.ts`
- `apps/game-client/src/systems/MovementSystem.ts`
- `apps/game-client/src/systems/AISystem.ts`
- `apps/game-client/src/systems/CombatSystem.ts`

### 重点修改（预期）
- `apps/game-client/src/scenes/DungeonScene.ts`
- `packages/core/src/contracts/events.ts`
- `packages/core/src/index.ts`
- `packages/content/src/monsters.ts`
- `packages/content/src/types.ts`

---

## 10. 完成定义（Phase 0 Ready for Phase 1）

满足以下条件后，才进入 Phase 1：
- 0A/0B 全部 Gate 通过。
- 固定 seed 的回放结果可复现。
- 新增玩法功能不再需要修改 `DungeonScene` 核心流程代码。
- 代码评审确认 core/client 边界清晰，无新增跨层耦合。
