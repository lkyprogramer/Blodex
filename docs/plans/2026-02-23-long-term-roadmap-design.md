# Blodex Long-Term Roadmap Design

**Date**: 2026-02-23
**Direction**: Roguelike short-run (Hades/Vampire Survivors style) + content diversity priority
**Strategy**: Refactor-first (Phase 0A/0B) then layer features bottom-up (Phase 1A/1B/2/3)

---

## Current State Assessment

### What Works Well
- **Type system & contracts** — comprehensive, enables safe refactoring
- **Core simulation logic** — clean, testable, deterministic (pure functions + SeededRng)
- **Content data layer** — easy to iterate on items/monsters/loot tables
- **Monorepo structure** — proper separation of core/content/client

### Critical Blockers for Scale
- **DungeonScene god object** (~800 lines) — mixes AI, combat, movement, rendering, HUD updates
- **No event system** — combat results applied inline; adding side effects requires modifying multiple update methods
- **Content-client coupling** — monster drop tables hard-coded in scene with `if/else`
- **Test coverage ~50%** — no integration tests, no stat formula regression tests
- **No skill/ability system** — can't add gameplay depth without rearchitecting combat

### Non-Negotiable Alignment Constraints
- **Schema compatibility first** — existing canonical fields remain source-of-truth:
  - `MetaProgression.runsPlayed` (not `totalRuns`)
  - `RunState.floor` / `PlayerState` fields remain backward compatible during migration
- **Determinism first** — all gameplay-affecting randomness must be reproducible via explicit run seed
- **Domain/UI boundary** — `packages/core` only emits domain events and state transitions; VFX/SFX/UI stay in client subscribers
- **Storage-safe evolution** — `blodex_meta_v1` to `v2` migration must be idempotent and reversible (fallback defaults)

---

## Phase 0 — Architecture Refactoring (0A/0B)

**Goal**: split `DungeonScene` into testable subsystems, then introduce event-driven wiring on top of stable boundaries.

**Execution order (hard requirement):**
- **0A** first: scene decoupling + data-driven config + integration baseline
- **0B** second: EventBus + deterministic run seed + replay hooks

### 0A.1 DungeonScene Split

Extract 4 systems from DungeonScene:

| New Module | Path | Responsibility |
|-----------|------|----------------|
| `EntityManager` | `apps/game-client/src/systems/EntityManager.ts` | Entity lifecycle, queries, optional spatial indexing |
| `CombatSystem` | `apps/game-client/src/systems/CombatSystem.ts` | Attack cooldowns, damage resolution, death handling, XP |
| `AISystem` | `apps/game-client/src/systems/AISystem.ts` | Monster state machine (idle/chase/attack), targeting |
| `MovementSystem` | `apps/game-client/src/systems/MovementSystem.ts` | Player path following, monster movement, collision |

Post-split DungeonScene retains only:
- Phaser lifecycle (preload/create/update)
- Sprite creation & render sync
- Camera control
- Input → system bridging
- System initialization & orchestration

Target:
- first milestone: `DungeonScene` reduced from ~800 to ~350 lines with unchanged behavior
- second milestone (after 0B): converge to ~250 lines

### 0A.2 Data-Driven Monster Config

Migrate hardcoded AI/drop parameters from scene into `MonsterArchetype`:

```typescript
interface MonsterArchetype {
  // existing fields...
  dropTableId: string;
  aiConfig: {
    chaseRange: number;
    attackCooldownMs: number;
    fleeThreshold?: number;
    wanderRadius?: number;
  };
}
```

### 0A.3 Test Coverage Baseline

| Category | Target |
|----------|--------|
| Unit tests | Edge cases for combat/stats/loot (0 armor, 100% crit, empty affix pool) |
| Integration tests | Kill → drop → pickup → equip → stat change flow |
| Regression tests | Stat formula snapshot tests (prevent accidental coefficient changes) |
| Core coverage target | `packages/core` line coverage ≥ 75%, branch coverage ≥ 60% |

### 0B.1 EventBus

Add typed, synchronous EventBus in `packages/core` with strict event-layer boundaries.

```
Domain events (core-owned):
  combat:hit / combat:dodge / combat:death
  player:levelup / player:move
  loot:drop / loot:pickup
  item:equip / item:unequip
  run:start / run:end / floor:enter
  monster:stateChange

Presentation events (client-owned, optional):
  vfx:* / sfx:* / ui:*
```

Design principles:
- Type-safe payload map in `contracts/events.ts`
- Synchronous dispatch within game loop
- `on` / `off` / `emit`, zero external dependencies
- `packages/core` emits **domain** events only; client maps domain events to VFX/SFX/UI side effects

### 0B.2 Deterministic Seed & Replay Hooks

- Introduce explicit `RunSeed` at run start (no implicit `Date.now()` in gameplay logic)
- Seed all procedural/random systems from `RunSeed` derivation (`runSeed + floor`)
- Persist lightweight replay log:
  - input timeline (movement target, skill use)
  - seed and version metadata
  - end-of-run checksum for regression verification

---

## Phase 1 — Core System Expansion

**Goal**: Build the four pillars of Roguelike gameplay: multi-floor dungeon, skills, boss fights, meta-progression.

**Execution split (risk control):**
- **1A**: multi-floor dungeon + boss fight (complete run loop first)
- **1B**: skill/buff + meta-progression (add depth after loop is stable)

**1A exit criteria:**
- can complete full 1→5 floor run with deterministic replay
- boss kill and death branches both end correctly with consistent summary/meta writes

**1B exit criteria:**
- at least 3 viable builds (clear rate gap within target band)
- meta progression changes starting state but does not break deterministic combat resolution

### 1.1 Multi-Floor Dungeon

```
Run structure:
  Floor 1-2  → Normal floors (current difficulty)
  Floor 3-4  → Medium floors (new monster combos + denser)
  Floor 5    → Boss floor (single-room boss fight)

Per-floor:
  - Independent seed = runSeed + floorNumber (deterministic)
  - Clear 70% of floor monsters → downward staircase appears
  - Staircase position = room farthest from player spawn
  - No return to previous floor (one-way Roguelike)
```

Difficulty scaling (`packages/content` new `floorScaling.ts`):

| Parameter | Formula | Floor 1 | Floor 3 | Floor 5 |
|-----------|---------|---------|---------|---------|
| Monster HP | `base × (1 + (floor - 1) × 0.25)` | ×1.00 | ×1.50 | ×2.00 |
| Monster damage | `base × (1 + (floor - 1) × 0.15)` | ×1.00 | ×1.30 | ×1.60 |
| Monster count | `12 + (floor - 1) × 2` | 12 | 16 | Boss floor override |
| Loot quality | `minFloor` filter (built-in) | normal/magic | magic/rare | rare+boss exclusive |

Changes needed:
- `packages/core` new `floor.ts`: floor state, staircase generation, floor transition
- `contracts/types.ts`: extend `RunState` with `currentFloor`, `floorsCleared`
- `procgen.ts`: `generateDungeon` accepts `floorNumber`, affects room count and density
- `content/floorScaling.ts`: data-driven difficulty curves
- `DungeonScene`: staircase entity rendering + floor transition animation

Victory condition changes to: defeat Floor 5 Boss → run victory.

### 1.2 Skill System

Architecture:

```typescript
SkillDef {
  id: string
  name: string
  description: string
  icon: string
  cooldownMs: number
  manaCost: number
  damageType: DamageType
  targeting: "self" | "nearest" | "directional" | "aoe_around"
  range: number
  effects: SkillEffect[]
  unlockCondition?: string    // meta-progression unlock ID
}

SkillEffect {
  type: "damage" | "heal" | "buff" | "debuff" | "summon"
  value: number | { base: number, scaling: StatKey, ratio: number }
  duration?: number
  radius?: number
}

PlayerSkillState {
  skillSlots: (SkillInstance | null)[]  // max 4 active skill slots
  cooldowns: Map<string, number>
}
```

Initial 5 skills:

| Skill | Type | Cooldown | Effect | Key |
|-------|------|----------|--------|-----|
| Cleave | AOE melee | 3s | 120% attack power to all enemies within 1.5 tiles | 1 |
| Shadow Step | Dash | 5s | Teleport behind nearest enemy + next attack guaranteed crit | 2 |
| Blood Drain | Single target | 8s | 80% attack power damage, heal equal amount | 3 |
| Frost Nova | AOE control | 10s | 50% slow to enemies within 2 tiles, 3s duration | 4 |
| War Cry | Self buff | 15s | +30% attack power, +20% attack speed, 6s duration | Q |

Skill acquisition (Hades-style):

```
On level up → show skill picker panel:
  → Display 3 random skills (from unlocked pool)
  → Player picks 1
  → If skill slots full, choose which to replace
```

Changes needed:
- `packages/core` new `skill.ts`: skill resolution, cooldown management, effect application
- `packages/core` new `buff.ts`: buff/debuff system (time-driven, per-frame update)
- `contracts/types.ts`: `SkillDef`, `SkillEffect`, `BuffInstance`, `PlayerSkillState`
- `packages/content` new `skills.ts`: skill data definitions
- EventBus new events: `skill:use`, `skill:cooldown`, `buff:apply`, `buff:expire`
- HUD: skill bar UI (4 slots + cooldown indicators), level-up picker panel
- Input: keyboard 1-4 / Q bindings

### 1.3 Boss Fight System

```typescript
BossDef {
  id: string
  name: string
  spriteKey: string
  baseHealth: number
  phases: BossPhase[]
  dropTableId: string
  exclusiveFloor: number
}

BossPhase {
  hpThreshold: number         // trigger threshold (0.0-1.0)
  attackPattern: BossAttack[]
  enrageTimer?: number
}

BossAttack {
  id: string
  cooldownMs: number
  telegraphMs: number         // warning time (red circle)
  type: "melee" | "projectile" | "aoe_zone" | "summon"
  damage: number
  range: number
  radius?: number
}
```

First boss — Bone Sovereign:

```
Floor 5 Boss, single-room fight

Phase 1 (100%-50% HP):
  - Heavy strike (melee, high damage, 1.5s telegraph)
  - Summon 2 Crypt Hounds (every 15s)

Phase 2 (50%-0% HP):
  - New AOE bone spikes (3 random positions, 2s telegraph)
  - Summon frequency increased (every 10s)
  - Move speed +30%

Boss room:
  - Large room (12×12 tiles)
  - Door seals on entry
  - Defeat → treasure chest + run victory
```

Changes needed:
- `packages/core` new `boss.ts`: boss AI state machine (phase management + attack pattern scheduling)
- `AISystem`: boss-specific AI behaviors (telegraph zones, summoning, phase transitions)
- `contracts/types.ts`: `BossDef`, `BossPhase`, `BossAttack`
- `packages/content` new `bosses.ts`: boss data definitions
- Dungeon generation: Floor 5 uses special boss room layout
- HUD: boss health bar (top-of-screen wide bar + phase indicators)

### 1.4 Meta-Progression System

```typescript
MetaProgression {
  // existing
  runsPlayed: number
  bestFloor: number
  bestTimeMs: number

  // new
  soulShards: number            // persistent meta currency
  unlocks: string[]             // JSON-safe storage, Set built at runtime if needed
  schemaVersion: 2

  permanentUpgrades: {
    startingHealth: number     // +0/+10/+20/+30 initial HP
    startingArmor: number      // +0/+2/+4/+6 initial armor
    luckBonus: number          // +0%/+5%/+10% rare drop rate
    skillSlots: number         // 2/3/4 skill slots (default 2)
    potionCharges: number      // 0/1/2/3 potion uses
  }
}

RunEconomyState {
  obols: number                // in-run only currency, cleared at run end
}
```

Soul Shard acquisition:

| Source | Amount |
|--------|--------|
| Per monster kill | +1 |
| Clear a floor | +5 |
| Defeat boss | +20 |
| Complete run | +10 |
| Death (floor) | 50% of earned |

Obol acquisition (in-run only):

| Source | Amount |
|--------|--------|
| Per monster kill | +1 |
| Chest/Event reward | +3 ~ +12 |
| Floor clear bonus | +5 |

Unlock tree (4 tiers):

```
Tier 1 (0 cumulative shards):
  ├── +10 starting HP (cost: 10)
  ├── Unlock skill: Cleave (cost: 15)
  └── Unlock affix: Frenzied (cost: 10)

Tier 2 (50 cumulative):
  ├── +2 starting armor (cost: 20)
  ├── 3rd skill slot (cost: 30)
  ├── Unlock skill: Shadow Step (cost: 25)
  └── Unlock Biome: Molten Caverns (cost: 35)

Tier 3 (150 cumulative):
  ├── +5% rare drop rate (cost: 40)
  ├── 4th skill slot (cost: 50)
  ├── Unlock skill: Frost Nova (cost: 40)
  └── 1 potion charge (cost: 45)

Tier 4 (300 cumulative):
  ├── +20 starting HP (cost: 60)
  ├── Unlock skill: Blood Drain (cost: 55)
  └── Unlock Boss: Bone Sovereign enhanced (cost: 70)
```

Changes needed:
- `packages/core` new `meta.ts`: meta-progression management, unlock logic, shard calculation
- `contracts/types.ts`: extend `MetaProgression`, new `UnlockDef`, `PermanentUpgrade`
- `packages/content` new `unlocks.ts`: unlock tree data
- `run.ts`: run bootstrap reads meta-progression to apply permanent upgrades and initializes `RunEconomyState`
- `stats.ts`: `deriveStats` considers permanent upgrade bonuses
- New scene: `MetaMenuScene` (between-run menu, shows unlock tree + spend shards)
- localStorage upgrade: version migration (`blodex_meta_v1` → `v2`)

Migration contract (`blodex_meta_v1` -> `v2`):
- `runsPlayed` keep as-is; missing -> `0`
- `bestFloor` keep as-is; missing -> `0`
- `bestTimeMs` keep as-is; missing -> `0`
- new fields default:
  - `soulShards = 0`
  - `unlocks = []`
  - `schemaVersion = 2`
  - `permanentUpgrades` all to baseline tier
- migration must be idempotent:
  - repeated reads should not duplicate unlocks or re-apply rewards

---

## Phase 2 — Content Explosion

**Goal**: Fill the system skeleton from Phase 1 with diverse content so each run feels distinct.

### 2.1 Biome System

```typescript
BiomeDef {
  id: string
  name: string
  tilesetKey: string
  wallStyle: string
  ambientColor: number
  roomCount: { min: number, max: number }
  gridSize: { w: number, h: number }
  monsterPool: string[]
  hazards: HazardDef[]
  lootBias: Partial<Record<EquipmentSlot, number>>
}
```

Initial 4 biomes:

| Biome | Floors | Feature | Hazard | Monster Pool |
|-------|--------|---------|--------|-------------|
| Forgotten Catacombs | 1-2 | Current dungeon, baseline | None | Crypt Hound, Ash Acolyte |
| Molten Caverns | 3-4 | Red tint, narrow corridors | Lava floor (standing DOT) | Magma Crawler, Ember Wraith |
| Frozen Halls | 3-4 | Blue tint, large rooms | Ice floor (slide on movement) | Frost Warden, Ice Specter |
| Bone Throne | 5 | Boss-only, dark purple | Bone spike traps (periodic) | Boss + summons |

Biome selection logic:

```
Floor 1-2: Fixed Forgotten Catacombs (beginner friendly)
Floor 3:   Random pick from [Molten Caverns, Frozen Halls] (runSeed)
Floor 4:   The other one
Floor 5:   Fixed Bone Throne

→ Floor 3-4 order varies per run
→ Adding more biomes = just expand candidate pool
```

Hazard system (`packages/core` new `hazard.ts`):

```typescript
HazardDef {
  id: string
  type: "damage_zone" | "movement_modifier" | "periodic_trap"
  damagePerTick?: number
  tickIntervalMs?: number
  movementMultiplier?: number   // ice = 1.5 (slide), swamp = 0.5 (slow)
  triggerIntervalMs?: number
  telegraphMs?: number
  tileAppearance: string
}
```

### 2.2 Monster Faction Expansion

New AI behavior modes (extend `AISystem`):

| Behavior | Description | Users |
|----------|-------------|-------|
| `kite` | Maintain 3-5 tile distance, ranged attack, retreat when approached | Ember Wraith, Ice Specter |
| `ambush` | Invisible until player within 2 tiles, first hit 200% damage | Shadow Lurker |
| `swarm` | Weak solo, but 3+ alive = +25% attack speed | Magma Crawler |
| `shield` | 50% damage reduction from front, must flank | Frost Warden |
| `support` | Heal nearby allies, don't attack | Bone Priest (boss summon) |

New monster definitions (7 total):

| Monster | Biome | AI | Trait |
|---------|-------|-----|-------|
| Magma Crawler | Molten Caverns | swarm | Low HP, high attack speed, swarm bonus |
| Ember Wraith | Molten Caverns | kite | Ranged fire bolt, keeps distance |
| Flame Brute | Molten Caverns | chase | High HP melee, explodes on death (1 tile AOE) |
| Frost Warden | Frozen Halls | shield | Frontal damage reduction, attacks slow |
| Ice Specter | Frozen Halls | kite | Ranged ice bolt, hit slows 30% for 2s |
| Shadow Lurker | Any (rare spawn) | ambush | Invisible, high first-hit, low HP |
| Bone Priest | Bone Throne | support | Boss summon, heals boss |

Monster affix system (Floor 3+):

| Affix | Effect |
|-------|--------|
| Frenzied | +40% attack speed, -20% HP |
| Armored | +50% armor, -20% move speed |
| Vampiric | Attacks heal 15% of damage dealt |
| Splitting | On death, split into 2 half-HP minions |

20% of monsters on each floor gain 1 random affix. Boss floor summons have no affixes.

### 2.3 Item & Affix Pool Expansion

New affix types:

```
Offensive:
  lifesteal, aoeRadius, critDamage, damageOverTime

Defensive:
  thorns, healthRegen, dodgeChance

Utility:
  xpBonus, soulShardBonus, cooldownReduction
```

New item categories:

```
Consumables:
  - Health Potion: instant 40% max HP heal (charges from meta-progression)
  - Mana Potion: instant 60% max Mana
  - Scroll of Mapping: reveal full floor map

Unique equipment (fixed affixes, no random):
  - Bloodthirst Blade (weapon): lifesteal 12%, attackPower +15, critChance -5%
  - Ironwall Helm (helm): thorns 8, armor +20, moveSpeed -15
  - Windrunner Boots (boots): moveSpeed +40, dodgeChance +8%, armor -5

Boss exclusive drops:
  - Bone Crown (helm): +30 maxHealth, healthRegen 3, xpBonus 15%
  - Sovereign's Signet (ring): +10 all base stats, soulShardBonus 20%
```

Total items: ~45 (current 18 + ~25 new + boss exclusives)

### 2.4 Random Event System

```typescript
RandomEventDef {
  id: string
  name: string
  description: string
  floorRange: { min: number, max: number }
  biomes?: string[]
  choices: EventChoice[]
  spawnWeight: number
}

EventChoice {
  label: string
  description: string
  cost?: { type: "health" | "mana" | "obol", amount: number }
  rewards: EventReward[]
  risk?: { chance: number, penalty: EventReward }
}
```

Initial 6 events:

| Event | Trigger | Choices |
|-------|---------|---------|
| Mysterious Shrine | Special room | A: Sacrifice 20% HP → random buff (+30% ATK / +50 armor / full heal) for floor. B: Ignore |
| Trapped Chest | Corridor dead-end | A: Open → 70% rare item, 30% poison gas (-30% HP). B: Ignore |
| Wandering Merchant | Random room | Buy items with Obols (in-run currency). 3 random items, 5-15 obols each |
| Cursed Altar | Floor 3+ | A: Accept curse (-20% max HP) get advanced skill. B: Purify (50% Mana) get XP |
| Fallen Adventurer | Random corridor | A: Loot body → 1-2 magic items. B: Pray → small XP + HP heal |
| Unstable Portal | Floor 2+ | A: Enter → skip next floor (miss that floor's drops). B: Ignore |

---

## Phase 3 — Experience Polish

**Goal**: Elevate from playable to enjoyable. Systems and content are in place; focus on sensory feedback, UI quality, and numerical balance.

### 3.1 Combat Feedback System

Visual feedback:

| Effect | Implementation | Trigger |
|--------|---------------|---------|
| Hit flash | Sprite tint white 50ms | Any entity takes damage |
| Knockback | Push 0.3 tiles opposite direction (Tween 150ms) | Normal attack hit |
| Screen shake | Camera offset ±3px, 100ms decay | Crit, boss attack |
| Crit text | 1.5x size + yellow + bounce animation | Critical hit |
| Death effect | Sprite shrink + fade + red particle burst | Monster/player death |
| Skill VFX | Per-skill particle/flash effects | Skill cast |
| Loot glow | Rarity-colored pulsing glow | Item on ground |
| Boss phase transition | Full-screen flash + 1s slow-mo + boss color change | Boss enters new phase |

Sound framework (Phaser Web Audio, EventBus-driven):

```
combat:hit      → hit_01.ogg ~ hit_03.ogg (random)
combat:crit     → crit_impact.ogg
combat:dodge    → dodge_swoosh.ogg
combat:death    → death_thud.ogg / death_player.ogg
skill:use       → per-skill sound
loot:pickup     → pickup_coin.ogg
item:equip      → equip_metal.ogg
player:levelup  → levelup_fanfare.ogg
floor:enter     → ambient loop per biome
boss:phaseChange → boss_roar.ogg
```

New modules:
- `apps/game-client/src/systems/VFXSystem.ts`: particle management, tweens, screen effects
- `apps/game-client/src/systems/SFXSystem.ts`: sound loading, playback, EventBus subscription
- Both are pure EventBus subscribers — no game logic modification needed

### 3.2 UI/UX Overhaul

UI architecture upgrade:

```
Current: Hud.ts directly manipulates DOM innerHTML

Target:
  UIManager (apps/game-client/src/ui/UIManager.ts)
    ├── HudPanel        — Left fixed panel (stats/inventory)
    ├── SkillBar         — Bottom skill bar (4 slots + cooldowns)
    ├── BossHealthBar    — Top boss health bar
    ├── EventDialog      — Random event popup
    ├── LevelUpPicker    — Level-up skill selection
    ├── MetaMenuScreen   — Between-run main menu
    ├── RunSummaryScreen — Run summary
    ├── DamageNumbers    — Floating damage text (Phaser text objects)
    └── Minimap          — Top-right minimap
```

Minimap design:

```
Top-right 160×160px fixed panel
- Real-time current floor layout
- Explored areas shown normally, unexplored areas dark
- Player = white dot
- Monsters = red dots (only within vision range)
- Loot = yellow dots
- Staircase = green dot
- Event rooms = blue dot

Fog of War:
  Player vision radius: 5 tiles
  Previously visited areas permanently visible (within floor)
  Unvisited areas hidden on minimap
```

### 3.3 Difficulty Curve & Balance

Difficulty modes (meta-progression unlocked):

```
Normal:    Baseline (default)
Hard:      Monsters +30% HP/damage, Soul Shards +50%
Nightmare: Monsters +60% HP/damage, all monsters have 1 affix, Soul Shards +100%

Unlock conditions:
  Hard      — Complete 1 Normal run
  Nightmare — Complete 1 Hard run
```

Balance simulation tool (`packages/core/src/balance.ts`):

```typescript
simulateRun(config: BalanceConfig): RunSimulation
  // Pure numerical simulation of a full run (no rendering)
  // Output: per-floor time, player HP curve, death rate, DPS curve, item distribution

BalanceConfig {
  difficulty: "normal" | "hard" | "nightmare"
  playerBehavior: "optimal" | "average" | "poor"
  sampleSize: number
}

// Usable as test assertions:
// "average player on normal should have 40%-60% clear rate"
// "optimal player on hard should have 60%-80% clear rate"
```

### 3.4 Performance Optimization

| Issue | Solution |
|-------|----------|
| AI update cost with many monsters | Spatial hash grid, only update monsters within 10 tiles of player |
| Particle effect overhead | Object pool for particle emitters, cap active particles |
| Large map rendering | Camera culling, only render visible viewport tiles |
| Pathfinding blocking | A* result caching + frame-splitting (>N steps → split across 2 frames) |
| Memory leaks | Strict Phaser object destruction on floor transition + EventBus subscription cleanup |

---

## Delivery Gates (DoD / Go-NoGo)

| Stage | Gate |
|-------|------|
| **0A** | Scene split complete, behavior parity pass, `packages/core` coverage reaches target baseline |
| **0B** | Domain event pipeline stable, deterministic replay checksum consistent across 20 fixed seeds |
| **1A** | Full 1→5 loop completable, boss branch and death branch both produce valid run summary/meta updates |
| **1B** | At least 3 viable builds; average player clear rate on Normal in target band (40%-60%) |
| **2** | New biome/monster/item can be added via data config without touching core combat loop |
| **3** | Frame pacing stable under content stress test; VFX/SFX/UI modules have no cross-layer logic leakage |

## Phase Output Summary

| Phase | New Modules | New Content | Core Experience Gain |
|-------|------------|-------------|---------------------|
| **0A** | EntityManager, CombatSystem, AISystem, MovementSystem | — | Maintainability baseline |
| **0B** | EventBus, replay hooks | — | Determinism + extensibility |
| **1A** | floor.ts, boss.ts | 1 boss, floor progression | Complete run loop |
| **1B** | skill.ts, buff.ts, meta.ts, MetaMenuScene | 5 skills, meta tree | Build diversity + long-term goals |
| **2** | hazard.ts, randomEvents.ts, expanded AI behaviors | 4 biomes, 7 monsters, monster affixes, ~25 items, 6 random events | Replayability |
| **3** | VFXSystem, SFXSystem, UIManager, Minimap, balance.ts | Difficulty modes, SFX, VFX | Game feel + polish |
