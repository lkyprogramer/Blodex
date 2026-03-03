# Blodex `zh-CN` 术语表（R3）

**版本**: 2026-03-03  
**适用范围**: `apps/game-client` UI、日志、内容词典  
**目标**: 统一关键术语翻译，降低多版本文案漂移风险。

## 术语映射

| English | 中文术语 | 备注 |
| --- | --- | --- |
| Soul Shards | 灵魂碎片 | Meta 资源，长期成长货币 |
| Echoes | 回响 | 用于解锁 Echo Mutation |
| Obol | 欧铂 | 局内货币 |
| Abyss | 深渊 | Endless 模式语义 |
| Affix | 词缀 | 怪物附加特性 |
| Cooldown | 冷却 | 技能/物品可再次使用前等待时间 |
| Challenge | 挑战 | Challenge room / daily challenge |
| Daily | 每日 | Daily run 与相关状态文案 |
| Practice | 练习 | Daily scored 用尽后的回退模式 |
| Vanguard | 先驱者 | 玩家角色称呼 |
| Run | 挑战 | 一次完整对局流程 |
| Meta Progression | 元进度 | 脱离单局的长期成长系统 |
| Blueprint | 蓝图 | 可锻造/解锁内容来源 |
| Mutation | 异变 | Build 增益槽位能力 |
| Forge | 魂铸 | Blueprint 消耗碎片进行制作 |
| Sanctum | 圣域 | 返回菜单/基地语义 |
| Boss | 首领 | 楼层关底敌人 |
| Floor | 层 | 地牢层级 |

## 规范

1. 新增玩家可见文本必须先命名 i18n key，再落词条。
2. 同一术语在 UI、日志、文档中保持一致，不允许同义词随意切换。
3. 若术语在战斗反馈里有长度压力，优先保持语义准确，其次再做缩写。
