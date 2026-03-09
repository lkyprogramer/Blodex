# Phase 6 Class Baseline Access Manual Evidence

**Date**: `2026-03-08`  
**Method**: Chrome DevTools + `?debugCheats=1` white-box smoke  
**Scope**: `S6-05 warrior / ranger / arcanist 起步深度入口白盒样本`

## 1. Evidence Assets

1. Mixed opening skill offer: `./phase6-class-parity-skill-offer.png`
2. Warrior-leaning path after first pick: `./phase6-class-parity-warrior-path.png`
3. Ranger-leaning path with explicit branch unlock log: `./phase6-class-parity-ranger-offer-stronger.png`
4. Shared arcanist path sample: `./phase6-buff-contract-frost-nova-offer.png`

## 2. Manual Notes

### 2.1 Warrior

1. Fresh run on Normal difficulty with `debugCheats=1`.
2. Use `window.__blodexDebug.clearFloor()` to force early level-up choice.
3. Opening offer included `处决突刺` (`execution_drive`) as a new warrior skill.
4. After selecting `execution_drive`, the run remained stable and the warrior path could continue from an explicit skill pick instead of a blueprint gate.

### 2.2 Ranger

1. Fresh run rerolled with `window.__blodexDebug.newRun()` and `clearFloor()`.
2. Early offer included `影袭步` (`shadow_step`) together with other ranger picks.
3. The strengthened sample now also captures the follow-up run log `第 1 层构筑分岔已通过技能升级选择解锁` after `shadow_step` is chosen.
4. This proves not only picker visibility, but that ranger mobility / crit identity can be entered as an explicit branching path in the rebuilt early pipeline.

### 2.3 Arcanist

1. Fresh run opening offer included `灵爆` (`spirit_burst`) in the first skill choice.
2. Follow-up offer after a warrior pick still surfaced `冰霜新星` (`frost_nova`), proving arcanist baseline skills remain reachable in the shared early-game pool.
3. Combined with the existing baseline `血能汲取` (`blood_drain`) start slot, arcanist no longer has the old “2/5 free skills” depth problem.
4. The arcanist sample remains a white-box entry sample rather than a full directed run, but it is now anchored to a shared artifact path and no longer only inferred from text description.

## 3. Code-Level Cross Check

1. All three archetypes currently expose five baseline skills in [packages/content/src/skills.ts](/Users/luo/Documents/github/Blodex-phase7-7.1/packages/content/src/skills.ts).
2. Early weighted offers still prefer the strongest-stat archetype but do not hard-lock the pool, see [packages/core/src/skill.ts](/Users/luo/Documents/github/Blodex-phase7-7.1/packages/core/src/skill.ts).
3. Phase 6 removed the arcanist baseline gameplay lock behind blueprint unlocks; blueprints now act as augments, not access gates.

## 4. Sign-off Conclusion

`S6-05` is considered **Pass**.

Reasoning:

1. Warrior, ranger, and arcanist all surfaced valid early-game path entries in browser smoke.
2. Ranger evidence has been strengthened from simple availability to an explicit branch-entry sample.
3. Arcanist depth regression from Phase 5 is closed at the baseline access layer.
4. No archetype required a meta unlock or blueprint gate to expose its first meaningful build direction.

## 5. Scope Boundary

This artifact signs off **baseline access parity**, not full-run class balance parity.

1. It proves that all three archetypes can enter a meaningful early build direction without blueprint gating.
2. It does **not** claim that warrior / ranger / arcanist have identical full-run power curves or encounter parity.
3. Full-run class balance remains part of later balance governance, not a Phase 6 release blocker.
