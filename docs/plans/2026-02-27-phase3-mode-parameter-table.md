# Phase 3 Difficulty Parameter Table

Date: 2026-02-27  
Scope: Phase 3C-03 parameterization and balancing baseline

## 1. Canonical Difficulty Modifiers

| Mode | Monster HP | Monster Damage | Affix Policy | Soul Shard Multiplier |
|---|---:|---:|---|---:|
| Normal | 1.0x | 1.0x | `default` | 1.0x |
| Hard | 1.3x | 1.3x | `default` | 1.5x |
| Nightmare | 1.6x | 1.6x | `forceOne` | 2.0x |

Source of truth:
- `packages/core/src/difficulty.ts`
- `packages/content/src/config.ts` (`DIFFICULTY_CONFIG`, content-side mirror)

## 2. Floor Scaling Composition

Runtime floor scalar in `getFloorConfig(floor, difficultyScale)`:

- Base HP scalar: `1 + (floor - 1) * 0.25` (boss floor fixed baseline 2.0)
- Base DMG scalar: `1 + (floor - 1) * 0.15` (boss floor fixed baseline 1.6)
- Effective floor HP scalar: `baseHp * difficulty.monsterHealthMultiplier`
- Effective floor DMG scalar: `baseDmg * difficulty.monsterDamageMultiplier`

This keeps floor progression shape stable while moving all mode differences to explicit multipliers.

## 3. Affix Policy

- `default`: existing probabilistic affix roll by floor.
- `forceOne`: non-boss monsters force at least one affix; if unlocked affix pool is empty, fallback to built-in core affix ids.

Applied in:
- `apps/game-client/src/systems/MonsterSpawnSystem.ts`
- `apps/game-client/src/scenes/DungeonScene.ts` (boss summons)

## 4. Reward Policy

Soul shards now include mode multiplier in `calculateSoulShardReward`:

- Victory: `floor/kill/boss reward * soulShardMultiplier`
- Defeat: `floor/kill/boss reward * 0.5 * soulShardMultiplier`

## 5. Balance Gate Baseline

Simulation tool: `packages/core/src/balance.ts`

CI gate assertions:
- `average-normal clear rate`: `0.40 ~ 0.60`
- `optimal-hard clear rate`: `0.60 ~ 0.80`

Tests:
- `packages/core/src/__tests__/balance.simulation.test.ts`

## 6. Evolution Rules

When tuning balance:
1. Keep difficulty unlock semantics unchanged (`normal -> hard -> nightmare`).
2. Change multipliers in one place (`difficulty.ts`) and mirror in content if presentation/config needs it.
3. Re-run simulation gates before gameplay subjective tuning.
