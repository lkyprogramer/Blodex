# Phase 4B — 蓝图 + 变异 + 武器类型（PR 级实施规范）

**优先级**: P2（Blueprint/Mutation）+ P4（WeaponType）  
**目标**: 建立“局内发现 -> 局外解锁 -> 下局可用”的长期循环，并形成可控的开局 Build 选择。  
**前置条件**: 4A 全部门禁通过（尤其 save/resume 同态）。

---

## 1. 范围与非目标

### 1.1 范围

1. `Meta v3 -> v4`：蓝图、回响、变异槽位与解锁池
2. Blueprint 发现/锻造闭环（含失败 run 保留）
3. Mutation 选择、冲突校验、效果执行
4. WeaponType 系统（分两阶段）
5. Soul Forge / Mutation 预选 UI
6. Hidden Room（可实现版本）

### 1.2 非目标

1. 不做完整 Synergy 百科（4C）
2. 不在 4B 强制落地 staff 投射物（可选 feature flag）
3. 不做分支路径与双楼梯（4C）

---

## 2. 不可协商约束

1. **字段统一**：蓝图字段统一使用 `blueprint*Ids` 命名。
2. **失败保留**：run 失败也保留本局发现蓝图。
3. **变异可判定**：effect 禁止自由字符串，采用判别联合类型。
4. **武器渐进交付**：先落地数值差异与近战机制，再做投射物。
5. **可回放**：Blueprint/Mutation 触发应纳入 deterministic 测试。

---

## 3. 数据契约

### 3.1 Meta v4

```typescript
interface MetaProgressionV4 {
  // v3 fields ...
  schemaVersion: 4;

  blueprintFoundIds: string[];   // 已发现（未必锻造）
  blueprintForgedIds: string[];  // 已锻造（永久可用）

  echoes: number;
  mutationSlots: number;         // 1..3
  mutationUnlockedIds: string[];
  selectedMutationIds: string[]; // 下局默认预选（长度 <= mutationSlots）
}
```

### 3.2 RunSave v1 扩展字段（前向兼容）

```typescript
interface RunSaveDataV1 {
  // existing 4A fields ...
  blueprintFoundIdsInRun?: string[];
  selectedMutationIds?: string[];
}
```

### 3.3 Blueprint 契约

```typescript
interface BlueprintDef {
  id: string;
  name: string;
  category: "skill" | "weapon" | "consumable" | "event" | "mutation";
  unlockTargetId: string;
  forgeCost: number;
  rarity: "common" | "rare" | "legendary";
  dropSources: BlueprintDropSource[];
}

interface BlueprintDropSource {
  type:
    | "monster_affix"
    | "boss_kill"
    | "boss_first_kill"
    | "challenge_room"
    | "hidden_room"
    | "random_event"
    | "floor_clear";
  sourceId?: string;
  chance: number;
  floorMin?: number;
  onlyIfNotFound?: boolean;
}
```

### 3.4 Mutation 契约（去字符串化）

```typescript
interface MutationDef {
  id: string;
  name: string;
  category: "offensive" | "defensive" | "utility";
  tier: 1 | 2 | 3;
  unlock: { type: "default" } | { type: "blueprint"; blueprintId: string } | { type: "echo"; cost: number };
  incompatibleWith?: string[];
  effects: MutationEffect[];
}

type MutationEffect =
  | { type: "on_kill_heal_percent"; value: number }
  | { type: "on_kill_attack_speed"; value: number; durationMs: number; maxStacks: number }
  | { type: "on_hit_invuln"; chance: number; durationMs: number; cooldownMs: number }
  | { type: "on_hit_reflect_percent"; value: number }
  | { type: "once_per_floor_lethal_guard"; invulnMs: number }
  | { type: "drop_bonus"; soulShardPercent: number; obolPercent: number }
  | { type: "move_speed_multiplier"; value: number }
  | { type: "potion_heal_amp_and_self_damage"; healPercent: number; selfDamageCurrentHpPercent: number }
  | { type: "hidden_room_reveal_radius"; value: number };
```

### 3.5 WeaponType 契约

```typescript
type WeaponType = "sword" | "axe" | "dagger" | "staff" | "hammer";

interface WeaponTypeDef {
  id: WeaponType;
  attackSpeedMultiplier: number;
  attackRange: number;
  damageMultiplier: number;
  mechanic:
    | { type: "none" }
    | { type: "crit_bonus"; critChanceBonus: number; critDamageMultiplier?: number }
    | { type: "aoe_cleave"; radius: number; secondaryDamagePercent: number }
    | { type: "stagger"; chance: number; slowPercent: number; durationMs: number }
    | { type: "skill_amp"; skillDamagePercent: number }
    | { type: "projectile"; speed: number }; // phase-2 optional
  unlock: { type: "default" } | { type: "blueprint"; blueprintId: string };
}

interface ItemDef {
  // existing fields ...
  weaponType?: WeaponType;
}
```

---

## 4. Blueprint 闭环

### 4.1 生命周期

```text
Drop -> pickup -> add to run.blueprintFoundIdsInRun
Run end (victory/death/abandon) -> merge into meta.blueprintFoundIds
Soul Forge spend shards -> move to meta.blueprintForgedIds
```

### 4.2 合并规则（幂等）

```typescript
function mergeFoundBlueprints(meta: MetaProgressionV4, runFound: string[]): MetaProgressionV4 {
  // set-union semantics, idempotent
}
```

### 4.3 Soul Forge 规则

1. 只允许锻造“已发现且未锻造”蓝图
2. 扣费后立刻持久化 meta
3. 锻造失败（余额不足）不改变状态

### 4.4 初始蓝图池（20）

为避免开发阶段反复改口，4B 固定首批蓝图规模为 20：

1. `skill`：5
2. `weapon`：5
3. `consumable`：3
4. `mutation`：5
5. `event`：2

实现建议：

1. `packages/content/src/blueprints.ts` 内维护分组常量 + 扁平 `BLUEPRINT_DEFS`
2. 每条定义必须包含 `unlockTargetId` 与至少一个 `dropSources`
3. `onlyIfNotFound=true` 仅用于一次性掉落来源（如首杀）

---

## 5. Hidden Room（可实现建模）

原方案“与主图不连通”对现有 `DungeonLayout.walkable` 与寻路成本过高，4B 采用可实现版本：

1. Hidden room 物理上连通，但入口 tile 初始 `blocked`
2. 玩家点击 cracked wall 后入口改为 `walkable`
3. 入口改动触发一次小范围重建路径缓存

```typescript
interface HiddenRoomState {
  roomId: string;
  entrance: { x: number; y: number };
  revealed: boolean;
  rewardsClaimed: boolean;
}

interface DungeonLayout {
  // existing fields ...
  hiddenRooms?: HiddenRoomState[];
}
```

---

## 6. Mutation 预选与运行时

### 6.1 预选流程

1. MetaMenu 打开 MutationPanel
2. 根据 `mutationSlots` 选择 `selectedMutationIds`
3. 开局时注入 player run-state

### 6.2 冲突校验

```typescript
function validateMutationSelection(selected: string[], defs: Record<string, MutationDef>, slots: number): {
  ok: true;
} | {
  ok: false;
  reason: string;
};
```

### 6.3 回响规则

- 每次 run 结束（胜/负/弃）`+1 echo`
- 奖励发放必须按 `runId` 幂等，避免重复结算

### 6.4 初始变异池（12）

1. offensive: 4
2. defensive: 4
3. utility: 4

实现约束：

1. 默认可用至少 3 个（每类至少 1 个），避免新手无可选项
2. `tier=3` 变异不得出现在默认池
3. `incompatibleWith` 必须是双向约束（A 排斥 B，B 也排斥 A）

---

## 7. WeaponType 分阶段实施

### 阶段 A（必须）

1. 接入 `damage/speed/range` 三参数
2. 接入 `crit_bonus/aoe_cleave/stagger/skill_amp`
3. Loot 池按 `blueprintForgedIds` 控制可见类型

### 阶段 B（可选，feature flag）

1. Staff `projectile` 机制
2. 新增 projectile runtime entity 与碰撞
3. 通过 `weaponStaffProjectileEnabled` 灰度开关控制

默认：4B gate 不要求阶段 B。

---

## 8. PR 拆分（可直接执行）

### PR-4B-01：Meta v4 + migration

**修改文件**
- `packages/core/src/contracts/types.ts`
- `packages/core/src/meta.ts`
- `packages/core/src/__tests__/meta.test.ts`

**交付点**
- `schemaVersion: 4`
- v3->v4 迁移幂等

---

### PR-4B-02：Blueprint domain + save integration

**新增文件**
- `packages/core/src/blueprint.ts`
- `packages/core/src/__tests__/blueprint.test.ts`
- `packages/content/src/blueprints.ts`

**修改文件**
- `packages/core/src/save.ts`
- `packages/core/src/index.ts`
- `packages/content/src/index.ts`

**交付点**
- 掉落判定与拾取入 run
- run end 合并入 meta
- 锻造逻辑与扣费

---

### PR-4B-03：Mutation domain

**新增文件**
- `packages/core/src/mutation.ts`
- `packages/core/src/__tests__/mutation.test.ts`
- `packages/content/src/mutations.ts`

**修改文件**
- `packages/core/src/contracts/events.ts`

**交付点**
- 预选、冲突检查、槽位上限
- 运行时触发与事件上报

---

### PR-4B-04：WeaponType 阶段 A

**新增文件**
- `packages/core/src/weaponType.ts`
- `packages/core/src/__tests__/weaponType.test.ts`
- `packages/content/src/weaponTypes.ts`

**修改文件**
- `packages/core/src/combat.ts`
- `apps/game-client/src/systems/CombatSystem.ts`
- `packages/content/src/items.ts`

**交付点**
- 武器类型数值与近战机制生效
- ItemDef 带 `weaponType`

---

### PR-4B-05：Hidden Room + UI

**修改文件**
- `packages/core/src/procgen.ts`
- `packages/core/src/contracts/types.ts`
- `apps/game-client/src/scenes/DungeonScene.ts`
- `apps/game-client/src/ui/SoulForgePanel.ts`（new）
- `apps/game-client/src/ui/MutationPanel.ts`（new）

**交付点**
- hidden room 生成、揭示、奖励
- Soul Forge 与 Mutation 预选 UI 可用

---

### PR-4B-06：阶段 B（可选）+ 综合回归

**修改文件**
- `apps/game-client/src/systems/CombatSystem.ts`
- `apps/game-client/src/systems/EntityManager.ts`
- `apps/game-client/src/systems/RenderSystem.ts`

**交付点**
- staff projectile（flag 控制）
- 4B 回归与平衡报告

---

## 9. 测试矩阵

### 9.1 Core

1. Blueprint 掉落来源与概率边界
2. 失败 run 蓝图保留
3. Forge 扣费与解锁幂等
4. Mutation 冲突组合拦截
5. WeaponType 数值差异与机制触发

### 9.2 Client

1. Soul Forge found/forged/undiscovered 展示
2. MutationPanel 槽位与冲突提示
3. Hidden room 揭示后路径可达
4. Staff projectile flag 开/关行为（若实现阶段 B）

---

## 10. 4B 验收门禁（Gate）

- [ ] `Meta v3 -> v4` 迁移幂等通过
- [ ] 蓝图发现/锻造闭环可用，失败 run 保留蓝图
- [ ] 变异槽位与冲突约束生效
- [ ] 武器类型阶段 A 完整可用（阶段 B 可选）
- [ ] Hidden room 在当前地图模型下可生成可揭示
- [ ] 4B 变更不破坏 4A save/resume

---

## 11. 已知风险与缓解

1. **风险**：Mutation 与 Talent 叠加导致数值爆炸  
   **缓解**：统一 additive-first 策略，乘法只用于少数白名单效果。
2. **风险**：Blueprint 概率偏低导致体验断层  
   **缓解**：加入 floor pity（连续 N 层未掉提升概率）。
3. **风险**：投射物实现拖慢 4B 收敛  
   **缓解**：默认按阶段 A 达成 gate，阶段 B 独立 flag。
