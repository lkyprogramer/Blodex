# Phase 6 Buff / DamageType Runtime Access + Contract Evidence

**Date**: `2026-03-08`  
**Method**: Chrome DevTools + `?debugCheats=1` white-box smoke, plus contract code/test cross-check  
**Scope**: `S6-07 buff / damageType / synergy 运行时入口与合同校验`

## 1. Evidence Assets

1. `war_cry` early offer: `./phase6-buff-contract-war-cry-offer.png`
2. `war_cry` runtime activation sample: `./phase6-buff-contract-war-cry-runtime.png`
3. `shadow_step` early offer: `./phase6-buff-contract-shadow-step-offer.png`
4. `frost_nova` early offer: `./phase6-buff-contract-frost-nova-offer.png`

## 2. Browser White-Box Samples

### 2.1 War Cry

1. Fresh run on Normal difficulty with `debugCheats=1`.
2. Use `window.__blodexDebug.clearFloor()` to force the level-up skill choice.
3. The skill picker surfaced `战吼` (`war_cry`) as a baseline reward.
4. After selection, `战吼 Lv.1` was mounted into the active skill bar, confirming runtime access instead of dead content.
5. In the strengthened runtime sample, `战吼` was actually cast after pending level-up panels were cleared.
6. The sidebar stat block changed from `攻击 30` to `攻击 42` immediately after cast.
7. The in-run log also recorded:
   - `已使用技能：war_cry`
   - `Buff observed: war_cry on 先驱者 for 6000ms`
8. This is now a direct white-box runtime sample, not just a picker-access sample.

### 2.2 Shadow Step

1. Reset run with `window.__blodexDebug.newRun()` and re-roll once.
2. Early skill picker surfaced `影袭步` (`shadow_step`) as a new ranger pick.
3. This confirms the guaranteed-crit mobility skill is still reachable in the rebuilt baseline pipeline.

### 2.3 Frost Nova

1. On a separate early-game sample, the follow-up picker surfaced `冰霜新星` (`frost_nova`).
2. This validates arcanist debuff access in the same rebuilt early-game pipeline.

## 3. Code / Contract Cross Check

### 3.1 Buff Runtime

1. [packages/content/src/buffs.ts](/Users/luo/Documents/github/Blodex-phase7-7.1/packages/content/src/buffs.ts) defines:
   - `war_cry`
   - `guaranteed_crit`
   - `frost_slow`
2. [packages/core/src/buff.ts](/Users/luo/Documents/github/Blodex-phase7-7.1/packages/core/src/buff.ts) aggregates:
   - additive stat modifiers
   - multiplicative stat modifiers
   - `guaranteedCrit`
   - `slowMultiplier`
3. [apps/game-client/src/scenes/DungeonScene.ts](/Users/luo/Documents/github/Blodex-phase7-7.1/apps/game-client/src/scenes/DungeonScene.ts) applies buff aggregation to both player and monster runtime state.

### 3.2 Damage Type Split

1. [packages/core/src/combat.ts](/Users/luo/Documents/github/Blodex-phase7-7.1/packages/core/src/combat.ts) applies a differentiated multiplier on `armored` targets:
   - `physical -> ARMORED_PHYSICAL_DAMAGE_MULTIPLIER`
   - `arcane -> ARMORED_ARCANE_DAMAGE_MULTIPLIER`
2. The differential is intentionally minimal and currently scoped to the `armored` affix, not a full elemental resistance table.
3. The behavior is pinned by [packages/core/src/__tests__/combat.contract.test.ts](/Users/luo/Documents/github/Blodex-phase7-7.1/packages/core/src/__tests__/combat.contract.test.ts).

### 3.3 Synergy

1. `synergy` activation and feedback were already validated in browser smoke:
   - [2026-03-07-phase6-browser-smoke-report.md](/Users/luo/Documents/github/Blodex-phase7-7.1/docs/plans/phase6/release/2026-03-07-phase6-browser-smoke-report.md)
2. This manual contract note therefore focuses on the remaining `buff / damageType` closure.

## 4. Sign-off Conclusion

`S6-07` is considered **Pass**.

Reasoning:

1. `war_cry`, `shadow_step`, and `frost_nova` are all reachable in browser white-box samples.
2. `war_cry` now has a real runtime activation sample showing both stat change and buff observation log.
3. Buff runtime is wired through content definition, aggregation, and scene application.
4. `physical` vs `arcane` differentiation is implemented and pinned by contract tests on `armored` targets.

## 5. Scope Boundary

This artifact signs off a **hybrid proof**:

1. Browser white-box samples prove runtime access to the relevant skills in the rebuilt Phase 6 baseline pipeline.
2. `war_cry` has an additional real runtime activation sample that directly shows a stat delta and buff observation log.
3. Code and contract tests prove the runtime behavior for `shadow_step` guaranteed crit, `frost_nova` slow, buff aggregation, and minimal damage-type split.
4. It still does **not** claim that browser samples frame-traced every slow tick or every guaranteed crit resolution one frame at a time.
