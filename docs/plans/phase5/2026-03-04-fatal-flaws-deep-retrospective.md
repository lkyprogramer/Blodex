# Blodex 致命缺陷深层反思 — 资深 ARPG 总监视角

**日期**: 2026-03-04
**视角**: 拥有 10+ 年 ARPG 开发经验的游戏总监（Diablo / Path of Exile / Hades 方向）
**目的**: 在继续功能开发之前，识别并修复会从根本上破坏游戏体验的致命缺陷

---

## 0. 总体评价

Blodex 在工程基础设施层面做得相当扎实：monorepo 架构、类型系统、保存/回放、元进度、i18n、CI 质量门禁。作为一个独立开发的 MVP，这些基建远超平均水准。

**但从游戏设计层面，项目存在若干致命缺陷——不是"可以以后再优化"的技术债，而是会从根本上破坏 ARPG 核心循环的设计错误。** 如果继续在这些缺陷之上堆叠功能，后续推倒重来的代价将远大于现在修复。

---

## 1. 致命缺陷清单（按严重程度排序）

### F1 [FATAL] Special Affixes 完全无效 — 物品差异化的核心断裂

**现象**: `rolledSpecialAffixes` 字段存在于物品实例上，`rollSpecialAffixes()` 正确生成了值，但 **`deriveStats()` 和整个战斗管道完全不读取这些值**。

**涉及的无效属性** (10 个):
- `lifesteal` — 吸血，零效果
- `critDamage` — 暴击伤害倍率，零效果
- `aoeRadius` — AOE 范围，零效果
- `damageOverTime` — 持续伤害，零效果
- `thorns` — 反伤，零效果
- `healthRegen` — 生命回复，零效果
- `dodgeChance` — 闪避，零效果
- `xpBonus` — 经验加成，零效果
- `soulShardBonus` — 灵魂碎片加成，零效果
- `cooldownReduction` — 技能冷却缩减，零效果

**为什么是致命的**:
- ARPG 的核心吸引力是"刷出更好的装备"。物品稀有度（common → rare → unique）的差异化主要来自 special affixes。当 special affixes 全部无效时，一件 rare 物品和一件 common 物品只有基础数值（armor/attackPower 等）的微小差别，失去了"毕业装"的追求动力。
- 玩家拿到标注 "lifesteal +8%" 的 Sanctified Greatsword 后发现不回血，这是**信任破坏**——比没有这个属性更糟。

**证据**:
```
stats.ts:42-49   — deriveStats() 只遍历 item.rolledAffixes (keyof DerivedStats)
                   完全不处理 item.rolledSpecialAffixes
combat.ts:99     — resolveMonsterAttack 不读取 dodgeChance/thorns/healthRegen
combat.ts:60-80  — resolvePlayerAttack 不读取 lifesteal/critDamage/aoeRadius
```

**修复方向**: 在 `deriveStats` 之外新建 `resolveSpecialAffixes()` 函数，将 special affixes 聚合为一个 `SpecialAffixTotals` 对象，在战斗 resolve 函数中显式消费。

---

### F2 [FATAL] critChance 单位不一致 — 数值系统的地基裂缝

**现象**: `DerivedStats.critChance` 是 `[0.0, 1.0]` 范围的小数（`0.03 + DEX * 0.0015`），但物品 affix pool 中 critChance 的 `min/max` 使用整数：

```
items.ts:46   — { key: "critChance", min: 1, max: 2 }     // 实际叠加 +1.0 ~ +2.0
items.ts:78   — { key: "critChance", min: 2, max: 4 }     // 实际叠加 +2.0 ~ +4.0
items.ts:298  — { key: "critChance", min: 2, max: 4 }     // 叠加后 critChance > 4.0
```

**后果**: 任何装了中高端装备的角色，`critChance` 瞬间溢出到 `Math.min(0.5, x)` 的上限 50%。所有带 critChance 的物品词缀失去区分度——+1 和 +4 效果完全相同，都是直接撞上限。

**为什么是致命的**: 数值系统是 ARPG 的骨骼。当 critChance 这样的核心属性的单位在不同层级不一致时，意味着整个 affix 数值体系可能都存在同类问题。这会导致所有基于数值的平衡工作建立在错误的地基上。

**修复方向**: 统一 critChance 为小数表示。将所有 affix pool 中的 critChance `min/max` 乘以 `0.01`（如 `{min: 0.01, max: 0.04}`）。

---

### F3 [FATAL] 怪物 AI 完全无视地图碰撞 — 空间博弈的彻底失效

**现象**: `AISystem.moveToward()` 和 `moveAway()` 直接修改 `monster.state.position` 的坐标，**不检查目标位置是否 walkable**。怪物会穿越墙壁追击玩家。

```typescript
// AISystem.ts:24-34 — moveToward 完全没有 walkability 检查
private moveToward(monster, target, dt, multiplier = 1) {
    const dx = target.x - monster.state.position.x;
    const dy = target.y - monster.state.position.y;
    // ... 直接修改 position，无碰撞检测
    monster.state.position.x += (dx / dist) * step;
    monster.state.position.y += (dy / dist) * step;
}
```

**为什么是致命的**:
- ARPG 的核心空间玩法是"地形利用"：用走廊单挑、拉风筝、卡位。如果怪物穿墙，整个地图生成系统（房间、走廊、隐藏房间）对 AI 毫无意义。
- 你花了大量精力实现 procgen（BSP 房间 + L 型走廊 + 隐藏房间），但这些结构对怪物来说不存在。
- 玩家走 A* 寻路绕路，怪物直线穿墙到达，体验上是"怪物比我聪明"的错觉，实际是"怪物在作弊"。

**修复方向**:
- **最低限度**: `moveToward`/`moveAway` 后验证新位置 walkability，不可走则找最近可走邻格。
- **推荐方案**: 近距离怪物（≤5格视距）使用简化 A* 或 steering behavior + obstacle avoidance；远距离怪物使用全量 A*。

---

### F4 [HIGH] 护甲减伤公式无扩展性 — 数值天花板过低

**现象**:
```typescript
// combat.ts:99
const mitigatedDamage = Math.max(1, Math.floor(monster.damage - player.derivedStats.armor * 0.1));
```

线性减法公式：`damage - armor × 0.1`。

**数值分析**:
- 玩家初始 armor = `8 × 1.5 = 12`，减免 `1.2` 点
- 穿满 rare 装备后 armor ≈ 40-60，减免 4-6 点
- Floor 1 怪物伤害 7-8，减免后 2-4 点 → armor 有感知
- Floor 5 Boss 伤害 `85 × 1.6 = 136`... 等等，这是错误的理解——boss 伤害实际是 `monster.damage` 字段
- 总之，armor 的收益是 **恒定的绝对值**，不会随着伤害数值增长而保持有效

**ARPG 标准方案**: `damage × (1 - armor / (armor + K))`（K 通常取 80-200）。这样：
- armor = 12 → 减免 13%（K=80）
- armor = 40 → 减免 33%
- armor = 80 → 减免 50%
- 永远不会到 100%，且在整个数值范围都有意义

**修复方向**: 替换为百分比减伤公式，K 值根据目标数值区间调整。

---

### F5 [HIGH] 物品掉落无楼层分层 — 进度感缺失

**现象**: 所有 lootTable 中 `minFloor` 全部为 1。Floor 1 的 catacomb_common 表和 Floor 4 的表可以掉落完全相同的物品。

**为什么严重**: ARPG 的进度驱动力有三个：
1. 角色变强（升级/属性）— 当前只有自动加力量，感知弱
2. 装备变好（更好的掉落）— **当前完全不存在**
3. 挑战变难（更强的敌人）— 数值缩放太线性

三个驱动力中最重要的（装备变好）完全缺失。

**修复方向**:
- Magic 物品 `minFloor: 2`，Rare 物品 `minFloor: 3`，Unique 物品 `minFloor: 4` 或 Boss 专属
- 在 `rollItemDrop` 中检查当前楼层，过滤 `minFloor > currentFloor` 的条目

---

### F6 [HIGH] 升级无玩家选择 — Build 多样性为零

**现象**:
```typescript
// xp.ts:22
base[statPreference] += 1  // statPreference 默认 "strength"
```

升级时自动给力量加 1 点，玩家没有任何选择。

**为什么严重**: ARPG 的 replayability 核心是 build 多样性。"我这局走暴击流""我这局走坦克流""我这局走法师流"——这些选择构成了每局游戏的独特性。当前升级机制让每局角色成长轨迹完全相同。

技能系统（3 选 1 升级时选技能）是正确的方向，但属性成长没有对应的选择机制。DEX 已经是最全能的属性（同时影响 armor、critChance、attackSpeed、moveSpeed），如果开放属性选择但不重新平衡属性公式，DEX 会成为唯一正确答案。

**修复方向**:
- 短期：升级时让玩家从 2-3 个属性中选择加点方向
- 中期：引入 archetype 关联的属性推荐（战士推荐 STR/VIT，游侠推荐 DEX，法师推荐 INT）
- 需要同步解决 DEX 过于全能的问题（将 armor 从 DEX 移到 VIT，或拆分为物理/魔法防御）

---

### F7 [HIGH] Vampiric / Splitting 怪物词缀是空壳

**现象**:
```typescript
// monsterAffix.ts:76-78
case "vampiric":
case "splitting":
    break;  // 空实现
```

这两个词缀会被 `rollMonsterAffixes` 随机选中并显示在怪物名字上，但完全没有效果。

**为什么严重**: 怪物词缀是 Diablo 系列增加战斗变化的核心机制。带 "vampiric" 的怪物应该让玩家紧张（它在回血，必须快速击杀），带 "splitting" 的怪物应该让玩家改变策略（杀死后会分裂，可能需要 AOE）。空壳词缀会让玩家对所有怪物词缀失去信任。

---

### F8 [HIGH] Biome lootBias 未实现 — 生物群系无掉落个性

**现象**: 每个 BiomeDef 都定义了 `lootBias`（如 frozen_crypt 偏向掉落 helm），但 `rollItemDrop()` 完全不接受也不使用 biome 参数。

---

## 2. 架构层面的深层问题

### A1. 上帝类的"假拆分" — 比不拆更危险

DungeonScene 在 Phase 4 被"拆分"为多个 RuntimeModule，但这些 Module 通过 `this as unknown as Record<string, unknown>` 访问 Scene 的私有字段。这不是解耦，是把一个上帝类的内脏通过反射暴露给了所有碎片。

**为什么比不拆更危险**:
- 原来的上帝类至少有 TypeScript 类型保护——你访问一个不存在的字段会编译报错
- 现在通过 `Record<string, unknown>` 访问，拼写错误、字段重命名、类型变更全部不会在编译期报错，只会在运行时崩溃
- 每个 Module 对 DungeonScene 的隐式依赖是一张不可见的依赖图——没有任何接口定义"模块需要 Scene 的哪些字段"

**建议**: 为每个 Module 定义显式的 Host 接口（如 `BossModuleHost`），DungeonScene 实现这些接口。这样编译器会告诉你哪些模块依赖哪些字段。

### A2. 数值平衡模拟是"假模拟"

`balance.ts::simulateSingleRun` 使用经验系数（`0.72 + floor × 0.14`）和线性公式来模拟游戏过程，不运行真实的战斗公式、物品生成、AI 行为。这种模拟产出的 clearRate、hpCurve 数据**不反映真实游戏体验**。

基于这个假模拟做出的平衡决策，等于在沙上建塔。

---

## 3. 游戏设计层面的根本性反思

### D1. 技能定位与 ARPG 核心循环倒置

**ARPG 的正确循环**: 技能是主要输出手段 → 普攻是资源回收/连接手段 → 装备强化技能效果

**Blodex 的当前循环**: 普攻是主要输出 → 技能是可选补充 → 装备只影响基础属性

这导致战斗手感像"带技能的鼠标点击游戏"，而不是真正的 ARPG。技能 CD 3-15 秒，mana 消耗高且回复慢（杀怪 +4 mana），大部分时间玩家在看角色自动普攻。

### D2. 数值跨度太小，缺乏"数量级成长感"

| 指标 | Floor 1 | Floor 5 | 增长倍率 |
|---|---|---|---|
| 怪物 HP | 85 | 170 | 2.0x |
| 怪物伤害 | 7 | 11.2 | 1.6x |
| 玩家 HP | 244 | ~280（升3级） | 1.15x |
| 玩家攻击力 | 25.6 | ~30（升3级+装备） | 1.17x |

整个游戏的数值范围在 1-2 倍之间。Diablo 3 的正常游戏流程中，伤害从几百到几百万，有 3-4 个数量级的成长。Path of Exile 更是以复杂的数值缩放著称。

当然 Blodex 是 5 层的短程 roguelike，不需要 Diablo 的数量级跨度。但至少应该有 5-10 倍的明显成长感——让玩家在 Floor 5 回头看 Floor 1 的怪物时，有"一刀秒"的爽感。

### D3. 缺乏"爽感时刻"(Power Fantasy Moment)

ARPG 的核心吸引力是 **Power Fantasy**：
- Diablo: "我的旋风斩把屏幕上 30 个怪全清了"
- Hades: "我的 cast + dash + special 连招把 boss 秒了"
- Path of Exile: "我的 build 终于成型，伤害翻了 10 倍"

Blodex 当前没有任何系统能产出这种爽感时刻：
- 没有 AOE 清屏的视觉冲击（技能有 AOE 但效果不明显）
- 没有 build 成型的转折点
- 没有"这件装备改变了我的打法"的物品
- 没有连招或操作深度

---

## 4. 修复优先级与执行建议

### Tier 0 — 不修就不应继续开发（1-2 天）

| 编号 | 缺陷 | 修复工作量 | 影响范围 |
|---|---|---|---|
| F1 | Special Affixes 无效 | 中（新增聚合函数 + 战斗管道接入） | combat.ts, stats.ts, 新文件 |
| F2 | critChance 单位不一致 | 小（修改 items.ts 中的数值） | items.ts |
| F3 | 怪物穿墙 | 中（AISystem 增加 walkability 检查） | AISystem.ts |

### Tier 1 — 影响核心游戏循环（3-5 天）

| 编号 | 缺陷 | 修复工作量 | 影响范围 |
|---|---|---|---|
| F4 | 护甲公式 | 小 | combat.ts |
| F5 | 掉落无分层 | 小 | lootTables.ts |
| F6 | 升级无选择 | 中（UI + 逻辑） | xp.ts, HUD, DungeonScene |
| F7 | 空壳词缀 | 中 | monsterAffix.ts, DungeonScene |
| F8 | lootBias 无效 | 小 | loot.ts |

### Tier 2 — 提升游戏深度（可与功能开发并行）

| 编号 | 问题 | 说明 |
|---|---|---|
| D1 | 技能定位 | 重新设计技能 CD / mana 回复 / 普攻节奏 |
| D2 | 数值跨度 | 重新设计 floor scaling 曲线 |
| D3 | 爽感时刻 | 需要在 AOE、连招、build 成型上做设计 |
| A1 | 假拆分架构 | 定义 Host 接口替代 unsafe cast |
| A2 | 假平衡模拟 | 建立基于真实战斗公式的自动化测试 |

---

## 5. 一句话总结

**Blodex 有扎实的工程骨架，但物品系统的核心功能（special affixes）完全不生效、怪物 AI 穿墙、数值单位混乱——这三个问题叠加在一起，意味着当前的"可玩版本"中，玩家看到的物品属性是假的、怪物的空间行为是假的、战斗数值也是假的。在这个基础上做任何新功能开发，都是在给一个心脏没接上血管的身体做整容手术。**

先接血管，再做整容。
