# Phase 4.0 基线快照（冻结记录）

**快照日期**: 2026-03-04  
**基线来源**: 4.0 阶段冻结快照（以本文件内命令输出为准，避免 commit hash 漂移）  
**目的**: 作为 4.1 起点，提供可复核的体量、门禁、flag 债务与测试缺口证据。

---

## 1. 关键文件体量快照

命令：

```bash
wc -l apps/game-client/src/scenes/DungeonScene.ts \
      apps/game-client/src/ui/Hud.ts \
      apps/game-client/src/scenes/MetaMenuScene.ts \
      packages/core/src/contracts/types.ts
```

结果：

| 文件 | 行数 |
|---|---:|
| `apps/game-client/src/scenes/DungeonScene.ts` | 6301 |
| `apps/game-client/src/ui/Hud.ts` | 963 |
| `apps/game-client/src/scenes/MetaMenuScene.ts` | 1093 |
| `packages/core/src/contracts/types.ts` | 818 |

---

## 2. 架构预算门禁快照

命令：

```bash
pnpm check:architecture-budget
```

结果：

```text
[architecture-budget] temporary debt allowlist:
 - apps/game-client/src/scenes/DungeonScene.ts lines=6301/7000 methods=161/220
 - apps/game-client/src/scenes/MetaMenuScene.ts lines=1093/1300 methods=40/90
 - apps/game-client/src/ui/Hud.ts lines=963/1100 methods=10/80
[architecture-budget] checks passed.
```

结论：门禁可执行，白名单可见且当前通过。

---

## 3. CI 全链路门禁快照

命令：

```bash
pnpm ci:check
```

结果摘要：

1. `check:toolchain` 通过。
2. workspace `typecheck` 通过。
3. `packages/core`、`apps/game-client`、`packages/content` 全量测试通过。
4. `i18n:check`、`css:check`、`check:content-i18n`、`check:source-hygiene` 通过。
5. `check:architecture-budget` 通过。

结论：4.0 当前主干在本地具备完整 CI 级绿灯。

---

## 4. UI Flag 债务快照

命令：

```bash
rg -n "UI_POLISH_FLAGS|sceneRefactorR1Enabled|metaMenuDomEnabled|runSummaryV2Enabled|skillCooldownOverlayEnabled|i18nInfrastructureEnabled" apps/game-client/src -S
```

摘要：

1. `apps/game-client/src/config/uiFlags.ts` 仍定义 5 个开关且全部为 `true`。
2. 运行时代码仍存在开关分支引用，主要在：
   - `apps/game-client/src/main.ts`
   - `apps/game-client/src/scenes/DungeonScene.ts`
   - `apps/game-client/src/scenes/MetaMenuScene.ts`
   - `apps/game-client/src/ui/components/RunSummaryScreen.ts`
   - `apps/game-client/src/ui/components/SkillBar.ts`

---

## 5. 核心系统测试缺口快照

目标系统文件：

1. `apps/game-client/src/systems/AISystem.ts`
2. `apps/game-client/src/systems/MovementSystem.ts`
3. `apps/game-client/src/systems/MonsterSpawnSystem.ts`

核查结论：当前 `apps/game-client/src/systems/__tests__/` 下未发现上述 3 个系统的专属测试文件。

复核命令（期望输出为空；若为空由 `echo` 给出提示行）：

```bash
rg --files apps/game-client/src/systems/__tests__ \
  | rg -i "(ai|movement|monster.?spawn)" \
  || echo "[expected-empty] no dedicated tests found for AISystem/MovementSystem/MonsterSpawnSystem"
```

建议：在 4.4（E4）之前补齐最小行为覆盖，并纳入阶段门禁。

---

## 6. 复核命令清单

```bash
pnpm check:architecture-budget
wc -l apps/game-client/src/scenes/DungeonScene.ts \
      apps/game-client/src/ui/Hud.ts \
      apps/game-client/src/scenes/MetaMenuScene.ts \
      packages/core/src/contracts/types.ts
rg -n "UI_POLISH_FLAGS|sceneRefactorR1Enabled|metaMenuDomEnabled|runSummaryV2Enabled|skillCooldownOverlayEnabled|i18nInfrastructureEnabled" apps/game-client/src -S
rg --files apps/game-client/src/systems/__tests__ \
  | rg -i "(ai|movement|monster.?spawn)" \
  || echo "[expected-empty] no dedicated tests found for AISystem/MovementSystem/MonsterSpawnSystem"
```
