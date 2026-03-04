# Phase 5 V2 契约冻结文档（5.0）

**日期**: 2026-03-04  
**阶段**: 5.0 Baseline Contract Freeze  
**状态**: Frozen for Phase 5 V2

---

## 1. 目标

本文件用于冻结 Phase 5 V2 的规则契约，避免实现过程中出现“显示语义”和“结算语义”漂移。

---

## 2. 全局约束

1. Phase 5 V2 不考虑旧存档兼容。
2. 所有规则改动必须有自动化测试与手动冒烟证据。
3. 任何文案中出现的可见属性，必须在结算链路可追踪。

---

## 3. 数值单位契约

## 3.1 DerivedStats

| 字段 | 单位 | 约束 |
|---|---|---|
| `maxHealth` | absolute | `>= 1` |
| `maxMana` | absolute | `>= 0` |
| `armor` | absolute | `>= 0` |
| `attackPower` | absolute | `>= 1` |
| `critChance` | ratio (`0~1`) | 常规上限 `<= 0.5`，特殊状态可突破 |
| `attackSpeed` | multiplier | `>= 0.2` |
| `moveSpeed` | world unit | `>= 40` |

## 3.2 Item Affix

1. `ItemAffix.key` 指向 `DerivedStats`，单位必须与目标字段一致。
2. `critChance` affix 统一使用小数（例如 `0.01` 表示 1%）。
3. 固定词缀与随机词缀不得使用不同单位体系。

## 3.3 Special Affix

| Special Affix | 单位 | 目标消费通道 |
|---|---|---|
| `lifesteal` | ratio (`0~1`) | combat hit -> player heal |
| `critDamage` | multiplier bonus | crit damage formula |
| `aoeRadius` | ratio or flat radius delta | skill/cleave radius |
| `damageOverTime` | absolute per tick or ratio | DOT runtime |
| `thorns` | ratio | on-hit reflect |
| `healthRegen` | absolute per second | periodic regen tick |
| `dodgeChance` | ratio (`0~1`) | incoming damage avoid |
| `xpBonus` | ratio | xp gain settlement |
| `soulShardBonus` | ratio | shard gain settlement |
| `cooldownReduction` | ratio | skill cooldown settlement |

备注：具体数值缩放在 5.1 实施中确定，但单位语义在本文件冻结。

---

## 4. 事件与消费契约

## 4.1 Combat Event

1. `combat:hit` 必须可定位基础伤害与词缀贡献。
2. `combat:death` 必须绑定明确 `sourceId/targetId`。
3. `combat:dodge` 与 `monster:leech` 需可追溯触发条件。

## 4.2 Monster Affix

1. `vampiric/splitting` 必须由统一规则入口处理。
2. Scene 层负责分发事件，不承担词缀规则定义。

## 4.3 Loot Bias

1. `BiomeDef.lootBias` 必须进入 `rollItemDrop` 权重计算。
2. 生物群系偏置结果必须可通过统计样本复核。

---

## 5. 架构边界契约

1. `scenes/dungeon/*` 模块不允许使用 `Record<string, any>` 作为 Host 类型。
2. RuntimeModule 必须定义显式 Host Port 接口。
3. 不允许业务逻辑回流 `DungeonScene/MetaMenuScene/HudContainer`。

---

## 6. 验收契约

完成任一规则修复 PR 时，必须同时提交：

1. 单元测试或集成测试（覆盖新增规则路径）。
2. 手动冒烟记录（默认优先使用金手指快速覆盖）。
3. 回滚点说明（文件或开关粒度）。

