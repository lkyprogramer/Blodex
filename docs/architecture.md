# Blodex 项目深度分析

## 一、项目概述

**Blodex** 是一个基于浏览器的 **等距视角（Isometric）黑暗奇幻 ARPG MVP**，采用 Phaser 3 + TypeScript 构建，核心玩法类似 Diablo / Path of Exile 的单次运行（Roguelike-like）地牢爬行游戏。

---

## 二、整体架构图

```mermaid
graph TB
  subgraph Browser["浏览器运行时"]
    subgraph GameClient["apps/game-client (Vite + Phaser 3)"]
      main["main.ts\nPhaser.Game 初始化"]
      DungeonScene["DungeonScene.ts\n797行 主游戏场景"]
      Hud["Hud.ts\n270行 UI/HUD 系统"]
      iso["systems/iso.ts\n等距坐标变换"]
    end
  end

  subgraph Packages["packages/ (纯逻辑层，无 UI 依赖)"]
    subgraph Core["@blodex/core"]
      combat["combat.ts\n战斗解算"]
      stats["stats.ts\n属性衍生计算"]
      xp["xp.ts\n经验升级"]
      loot["loot.ts\n掉落物品生成"]
      inventory["inventory.ts\n物品装备"]
      pathfinding["pathfinding.ts\nA* 寻路"]
      procgen["procgen.ts\n程序地牢生成"]
      rng["rng.ts\n确定性随机数"]
      run["run.ts\n运行状态管理"]
      types["contracts/types.ts\n所有类型定义"]
    end
    subgraph Content["@blodex/content"]
      monsters["monsters.ts\n3种怪物原型"]
      items["items.ts\n20+物品定义"]
      lootTables["lootTables.ts\n3张掉落表"]
      config["config.ts\n游戏配置常量"]
    end
    subgraph Tooling["@blodex/tooling"]
      assetPipeline["资产管道\n编译+验证"]
    end
  end

  subgraph Storage["持久化"]
    localStorage["localStorage\nblodex_meta_v1\n元游戏进度"]
  end

  subgraph Assets["public/generated/"]
    sprites["17 张 PNG 精灵\n(AI 生成)"]
    manifest["manifest.json\n资产版本追踪"]
  end

  main --> DungeonScene
  DungeonScene --> Hud
  DungeonScene --> iso
  DungeonScene --> Core
  DungeonScene --> Content
  DungeonScene <--> localStorage
  DungeonScene --> sprites
  Tooling --> manifest
```

---

## 三、模块依赖关系

```mermaid
graph LR
  subgraph L1["第一层：类型契约"]
    types["@blodex/core/contracts/types.ts"]
    events["@blodex/core/contracts/events.ts"]
  end

  subgraph L2["第二层：纯函数核心逻辑"]
    rng["rng.ts\nSeededRng"]
    stats["stats.ts"]
    combat["combat.ts"]
    xp["xp.ts"]
    pathfinding["pathfinding.ts"]
    procgen["procgen.ts"]
    run["run.ts"]
  end

  subgraph L3["第三层：数据内容"]
    monsters["content/monsters.ts"]
    items["content/items.ts"]
    lootTables["content/lootTables.ts"]
    loot["core/loot.ts"]
    inventory["core/inventory.ts"]
  end

  subgraph L4["第四层：游戏渲染层"]
    iso["systems/iso.ts"]
    DungeonScene["DungeonScene.ts"]
    Hud["Hud.ts"]
  end

  types --> L2
  types --> L3
  rng --> procgen
  rng --> loot
  stats --> combat
  combat --> events
  items --> loot
  lootTables --> loot
  monsters --> DungeonScene
  loot --> DungeonScene
  inventory --> DungeonScene
  L2 --> DungeonScene
  iso --> DungeonScene
  DungeonScene --> Hud
```

---

## 四、游戏初始化流程

```mermaid
flowchart TD
  Start["用户打开 localhost:5173"]
  --> HTML["index.html 加载"]
  --> ViteBundle["Vite 加载 main.ts + 依赖"]
  --> PhaserGame["new Phaser.Game({scene: DungeonScene})"]
  --> Preload

  subgraph Preload["DungeonScene.preload()"]
    LoadSprites["加载所有 PNG 纹理\n(player, monsters, items, tiles)"]
  end

  Preload --> Create

  subgraph Create["DungeonScene.create()"]
    LoadMeta["从 localStorage 读取\nMetaProgression"]
    --> GenDungeon["generateDungeon(46×46, seed)"]
    --> InitPlayer["初始化 PlayerState\n(level=1, Str/Dex/Vit=8, Int=5)"]
    --> DeriveStats["deriveStats(player)\n计算衍生属性"]
    --> SpawnMonsters["生成 13 个怪物\n(循环3种类型)"]
    --> BuildTerrain["渲染等距地形\n棋盘纹理 + 网格线"]
    --> SpawnSprites["创建玩家 + 怪物精灵对象"]
    --> Camera["相机跟随玩家 (缓动 0.12)"]
    --> InitHUD["初始化 Hud\n绑定 UI 事件监听"]
    --> InputSetup["注册点击输入\n(点击地板 → 寻路移动)"]
  end

  Create --> GameLoop["进入 update() 游戏主循环"]
```

---

## 五、游戏主循环流程

```mermaid
flowchart TD
  Update["update(deltaMs: number)\n每帧调用 (~60fps)"]

  Update --> CheckAlive{"玩家存活?"}
  CheckAlive -- 否 --> DeathFlow["触发游戏结束流程"]
  CheckAlive -- 是 --> Movement

  subgraph Movement["1. 玩家移动更新"]
    HasPath{"当前路径存在?"}
    HasPath -- 是 --> MoveAlongPath["沿路径移动\n速度 = moveSpeed/130 格/帧"]
    MoveAlongPath --> CheckWaypoint{"到达路径点\n(距离 < 0.02格)?"}
    CheckWaypoint -- 是 --> NextWaypoint["切换到下一路径点"]
    CheckWaypoint -- 否 --> UpdateSpritePos["更新精灵等距坐标"]
    NextWaypoint --> UpdateSpritePos
    HasPath -- 否 --> SkipMove["跳过移动"]
  end

  Movement --> Combat

  subgraph Combat["2. 玩家战斗"]
    FindTarget["查找最近存活怪物\n(范围 ≤ 1.5 格)"]
    --> AttackCooldown{"攻击冷却结束?\n(1000ms / attackSpeed)"}
    AttackCooldown -- 是 --> ResolveAttack["resolvePlayerAttack()\n计算伤害/暴击"]
    ResolveAttack --> ApplyDamage["怪物扣血"]
    ApplyDamage --> CheckMonsterDead{"怪物死亡?"}
    CheckMonsterDead -- 是 --> MonsterDeath["标记死亡 + 生成战利品 + 给予XP"]
    MonsterDeath --> CheckLevelUp{"XP 达到升级阈值?"}
    CheckLevelUp -- 是 --> LevelUp["升级处理\n+1属性 + 回复部分血/魔"]
  end

  Combat --> MonsterAI

  subgraph MonsterAI["3. 怪物 AI 更新"]
    ForEachMonster["遍历所有存活怪物"]
    --> CalcDist["计算到玩家距离"]
    --> AIDecision{"AI 状态判断"}
    AIDecision -- "距离 > 7格" --> Idle["idle: 随机游走"]
    AIDecision -- "1.5格 < 距离 ≤ 7格" --> Chase["chase: 直线追击玩家"]
    AIDecision -- "距离 ≤ attackRange" --> Attack{"攻击冷却结束?\n(1800ms)"}
    Attack -- 是 --> MonsterAttack["resolveMonsterAttack()\n计算伤害/闪避"]
    MonsterAttack --> PlayerHit{"命中?"}
    PlayerHit -- 是 --> PlayerDamage["玩家扣血"]
  end

  MonsterAI --> LootCollection

  subgraph LootCollection["4. 自动拾取"]
    CheckLoot["检查地面战利品\n(距离 < 0.7 格内自动拾取)"]
    --> AddToInventory["addToInventory()\n加入背包"]
  end

  LootCollection --> WinCheck{"胜利检查\n击杀数 ≥ 12?"}
  WinCheck -- 是 --> Victory["游戏胜利\n显示总结面板"]
  WinCheck -- 否 --> HUDUpdate["5. HUD 脏标记更新\n(仅在状态变化时重渲)"]
  HUDUpdate --> Update
```

---

## 六、战斗系统详细流程

```mermaid
flowchart LR
  subgraph PlayerAttack["玩家攻击流程"]
    PA1["读取 player.derivedStats"]
    --> PA2["random.float() < critChance?"]
    PA2 -- 暴击 --> PA3["damage = floor(attackPower × 1.7)"]
    PA2 -- 普通 --> PA4["damage = floor(attackPower × 1.0)"]
    PA3 --> PA5["damage = max(1, damage)"]
    PA4 --> PA5
    PA5 --> PA6["monster.health -= damage"]
    PA6 --> PA7{"health ≤ 0?"}
    PA7 -- 是 --> PA8["emit: 'death'\n触发掉落+XP"]
    PA7 -- 否 --> PA9["emit: 'damage' or 'crit'"]
  end

  subgraph MonsterAttack["怪物攻击流程"]
    MA1["读取 player.derivedStats.critChance"]
    --> MA2["dodgeChance = min(0.35, critChance × 0.8)"]
    MA2 --> MA3["random.float() < dodgeChance?"]
    MA3 -- 闪避 --> MA4["emit: 'dodge'\n显示 DODGE 文字"]
    MA3 -- 命中 --> MA5["rawDmg = monster.damage"]
    MA5 --> MA6["reducedDmg = floor(rawDmg - armor × 0.1)"]
    MA6 --> MA7["damage = max(1, reducedDmg)"]
    MA7 --> MA8["player.health -= damage"]
    MA8 --> MA9{"health ≤ 0?"}
    MA9 -- 是 --> MA10["emit: 'death'\n游戏结束"]
    MA9 -- 否 --> MA11["emit: 'damage'"]
  end
```

---

## 七、物品与装备系统流程

```mermaid
flowchart TD
  subgraph LootGeneration["物品掉落生成"]
    MonsterDie["怪物死亡\n(dropTableId 决定用哪张掉落表)"]
    --> DropCheck["查找对应 LootTable"]
    --> FilterItems["按 minFloor 过滤有效物品"]
    --> WeightedRoll["按 weight 加权随机选取 ItemDef"]
    --> RollAffixes["rollAffixes(rng, affixPool)\n随机选 minAffixes~maxAffixes 个仿射"]
    --> CreateInstance["创建 ItemInstance\n{id, defId, rolledAffixes}"]
    --> SpawnOnGround["在怪物死亡位置生成地面物品精灵"]
  end

  subgraph AutoPickup["自动拾取 (距离 < 0.7格)"]
    NearLoot["检测到附近物品"]
    --> addToInventory["addToInventory(player, item)\n加入 player.inventory 数组"]
    --> HUDRefresh["HUD 刷新背包格子显示"]
  end

  subgraph EquipFlow["装备物品 (点击 HUD 装备槽)"]
    ClickItem["玩家点击背包中的物品"]
    --> CheckLevel{"player.level ≥ item.requiredLevel?"}
    CheckLevel -- 否 --> ShowError["显示等级不足提示"]
    CheckLevel -- 是 --> CheckSlotOccupied{"对应装备槽已有装备?"}
    CheckSlotOccupied -- 是 --> UnequipOld["unequip 旧装备 → 返回背包"]
    CheckSlotOccupied -- 否 --> Equip
    UnequipOld --> Equip["equip(player, item)\n放入 player.equipment[slot]"]
    Equip --> RecalcStats["deriveStats(player)\n重新计算全部衍生属性"]
    RecalcStats --> HUDRefresh2["HUD 刷新属性面板"]
  end

  subgraph UnequipFlow["卸下装备 (点击已装备槽)"]
    ClickEquipped["玩家点击已装备物品"]
    --> UnequipItem["unequip(player, slot)\n返回 player.inventory"]
    --> RecalcStats2["deriveStats(player)\n重新计算属性"]
    --> HUDRefresh3["HUD 刷新"]
  end
```

---

## 八、地牢生成流程

```mermaid
flowchart TD
  subgraph ProcGen["generateDungeon(options)"]
    Init["初始化 46×46 全不可走网格\nwalkable[y][x] = false"]
    --> GenRooms["尝试生成 12 个房间\n最多 72 次尝试"]
    --> CheckOverlap{"新房间与已有房间重叠?"}
    CheckOverlap -- 是 --> GenRooms
    CheckOverlap -- 否 --> MarkWalkable["标记房间格为可行走"]
    MarkWalkable --> ConnectRooms["L形走廊连接相邻房间对"]

    ConnectRooms --> FindSpawns["收集生成点\n走廊端点 + 房间边界\n(排除玩家出生房)"]
    FindSpawns --> PlayerSpawn["玩家出生点 = 第一个房间中心"]
    PlayerSpawn --> Return["返回 DungeonLayout\n{walkable, rooms, corridors,\nspawnPoints, playerSpawn}"]
  end

  subgraph Render["等距地形渲染"]
    Loop["遍历所有格 (46×46)"]
    --> IsWalkable{"walkable[y][x]?"}
    IsWalkable -- 是 --> DrawTile["绘制地板瓦片\n(x+y)%2 交替深浅色"]
    IsWalkable -- 否 --> Skip["跳过(黑色)"]
    DrawTile --> GridLine["叠加网格线 (alpha 0.2)"]
  end
```

---

## 九、运行生命周期与元游戏流程

```mermaid
stateDiagram-v2
  [*] --> LoadMeta: 打开游戏
  LoadMeta: 加载 localStorage\n读取 MetaProgression\n(totalRuns, bestFloor, bestTime)

  LoadMeta --> NewRun: bootstrapRun()

  state NewRun {
    [*] --> GenerateDungeon
    GenerateDungeon: 程序生成地牢\n(随机种子)
    GenerateDungeon --> InitPlayer: 初始化玩家\nLevel 1 + 基础属性
    InitPlayer --> SpawnEnemies: 生成 13 个怪物
    SpawnEnemies --> [*]
  }

  NewRun --> Playing: 游戏开始

  state Playing {
    [*] --> Exploring: 点击移动
    Exploring --> Fighting: 靠近敌人
    Fighting --> Exploring: 敌人死亡
    Fighting --> Dead: 玩家血量归零
    Exploring --> Victory: 击杀数 ≥ 12
  }

  Playing --> RunEnd: 运行结束

  state RunEnd {
    [*] --> CalcResult
    CalcResult: 统计结果\n(kills, loot, time, floor)
    CalcResult --> UpdateMeta
    UpdateMeta: 更新 MetaProgression\n存入 localStorage\n(totalRuns++, bestFloor, bestTime)
    UpdateMeta --> ShowSummary
    ShowSummary: 显示运行总结面板
    ShowSummary --> [*]
  }

  RunEnd --> NewRun: 点击"New Run"
```

---

## 十、属性计算系统

```mermaid
flowchart LR
  subgraph BaseStats["基础属性 (BaseStats)"]
    STR["strength: 8\n(初始值)"]
    DEX["dexterity: 8"]
    VIT["vitality: 8"]
    INT["intelligence: 5"]
  end

  subgraph Equipment["装备仿射加成"]
    EqAffixes["rolledAffixes\n{key: value, ...}"]
  end

  subgraph DerivedStats["衍生属性 (DerivedStats) — deriveStats()"]
    HP["maxHealth\n= 100 + vit×18\n+ equipment.maxHealth"]
    MP["maxMana\n= 40 + int×10\n+ equipment.maxMana"]
    AR["armor\n= dex×1.5\n+ equipment.armor"]
    AP["attackPower\n= 8 + str×2.2\n+ equipment.attackPower"]
    CC["critChance\n= 0.03 + dex×0.0015\n+ equipment.critChance/100\n(上限 0.5)"]
    AS["attackSpeed\n= 1 + dex×0.002\n+ equipment.attackSpeed/100"]
    MS["moveSpeed\n= 140 + dex×0.3\n+ equipment.moveSpeed"]
  end

  STR --> AP
  DEX --> AR
  DEX --> CC
  DEX --> AS
  DEX --> MS
  VIT --> HP
  INT --> MP
  EqAffixes --> HP
  EqAffixes --> MP
  EqAffixes --> AR
  EqAffixes --> AP
  EqAffixes --> CC
  EqAffixes --> AS
  EqAffixes --> MS
```

---

## 十一、怪物 AI 状态机

```mermaid
stateDiagram-v2
  [*] --> idle: 生成

  idle: idle\n随机游走 / 原地待机

  state "追击判断" as chase_check
  idle --> chase_check: 每帧检查距离

  chase_check --> idle: distance > 7格
  chase_check --> chase: distance ≤ 7格

  chase: chase\n直线移动向玩家\n速度 = monster.moveSpeed

  state "攻击判断" as attack_check
  chase --> attack_check: 每帧检查距离

  attack_check --> chase: distance > attackRange
  attack_check --> attack: distance ≤ attackRange

  attack: attack\n每 1800ms 发起一次攻击\nresolveMonsterAttack()

  attack --> chase: 玩家移走
  attack --> dead: 被玩家击杀

  dead: dead\n播放死亡效果\n生成掉落物品\n给予玩家 XP
  dead --> [*]
```

---

## 十二、游戏怎么玩

### 目标

在随机生成的等距地牢中，消灭 **12 个敌人** 即可完成本次运行。

---

### 基本操作

| 操作 | 说明 |
|------|------|
| **点击地板** | 玩家自动寻路移动到目标位置 |
| **靠近敌人** | 距离 ≤ 1.5 格时自动攻击（无需手动操作） |
| **靠近掉落物** | 距离 < 0.7 格时自动拾取，无需点击 |
| **点击背包物品** | 装备物品（需满足等级要求） |
| **点击已装备物品** | 卸下装备，返回背包 |

---

### 游戏流程

```
1. 游戏开始 → 随机生成地牢地图（12 个房间 + 走廊）
2. 玩家出生在第一个房间中心
3. 13 个怪物散布在走廊/房间边界处
4. 探索地图，找到并消灭敌人
5. 击杀后拾取物品 → 在 HUD 中装备提升属性
6. 击杀 12 个敌人 → 胜利
   玩家血量归零 → 失败
7. 查看本次运行统计，点击"New Run"重新开始
```

---

### 三种敌人

| 敌人 | 血量 | 特点 | 策略 |
|------|------|------|------|
| **Crypt Hound（墓地獒犬）** | 基准 | 近战，速度普通 | 直接靠近打 |
| **Ash Acolyte（灰烬侍僧）** | -25% | 远程 5 格攻击，较快 | 快速逼近取消其远程优势 |
| **Iron Revenant（铁复仇者）** | +70% | 近战坦克，高伤害，高 XP | 优先处理，可获 40XP |

---

### 成长系统

**升级**：击杀敌人获得 XP，满足 `80 + level² × 18` 经验后升级，每级：
- +1 基础属性点（优先分配 strength）
- 恢复部分血量 (+12) 和魔法值 (+4)

**装备**：物品有三种稀有度（普通/魔法/稀有），不同槽位：
- `weapon` 武器：提升攻击力/暴击/攻速
- `helm` 头盔：提升护甲/血量
- `chest` 胸甲：提升护甲/血量
- `boots` 靴子：提升移速/护甲
- `ring` 戒指：各类属性加成

---

### HUD 面板说明

**左侧 HUD（340px 宽）包含：**
- **Meta**：历史统计（总运行次数、最佳楼层、最佳时间）
- **Stats**：当前角色属性（等级、XP、HP/Mana、攻击力、护甲）
- **Run**：本次进度（楼层、击杀数 x/12、拾取物品数）
- **Inventory**：5 个装备槽 + 背包格子
- **Summary**（运行结束后）：本次总结

---

### 胜利/失败条件

- **胜利**：击杀数 ≥ 12 → 显示总结面板，更新最佳记录
- **失败**：HP 归零 → 运行结束，同样显示总结面板
- **重置**：点击"New Run"按钮 → 重新生成地牢开始新运行

---

## 十三、关键文件路径索引

| 文件 | 路径 | 功能 |
|------|------|------|
| 游戏入口 | `apps/game-client/src/main.ts` | Phaser.Game 初始化 |
| 主游戏场景 | `apps/game-client/src/scenes/DungeonScene.ts` | 游戏循环、实体、渲染 |
| HUD 系统 | `apps/game-client/src/ui/Hud.ts` | UI 交互与渲染 |
| 等距坐标 | `apps/game-client/src/systems/iso.ts` | 网格⟷屏幕坐标转换 |
| 战斗逻辑 | `packages/core/src/combat.ts` | 伤害计算 |
| 属性计算 | `packages/core/src/stats.ts` | 衍生属性推导 |
| A* 寻路 | `packages/core/src/pathfinding.ts` | 移动路径规划 |
| 地牢生成 | `packages/core/src/procgen.ts` | 程序地图生成 |
| 掉落系统 | `packages/core/src/loot.ts` | 物品生成 |
| 物品库 | `packages/content/src/items.ts` | 20+ 物品定义 |
| 怪物库 | `packages/content/src/monsters.ts` | 3 种怪物原型 |
| 掉落表 | `packages/content/src/lootTables.ts` | 3 张掉落表配置 |
| 类型定义 | `packages/core/src/contracts/types.ts` | 所有实体类型 |
