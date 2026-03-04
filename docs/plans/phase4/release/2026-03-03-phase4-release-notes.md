# Phase 4 发布说明（Release Notes）

**日期**: 2026-03-03  
**版本范围**: Phase 4.0 ~ 4.7  
**候选提交**: `fd4ea52`

---

## 1. 版本摘要

Phase 4 完成了从“超大场景类”到“模块化运行时”的重构主线，并补齐中后期体验增强与发布收口流程。该版本重点在于稳定性、可维护性和可回滚能力。

---

## 2. 工程与架构改造

1. Scene 深拆完成（Debug/Save/Event/Boss/Hazard/Progression 逐步迁移）。
2. HUD 从大类拆分为容器化结构，降低耦合和维护成本。
3. 架构预算门禁纳入 CI，防止 God Class 反弹。
4. 发布阶段补齐 readiness、回归矩阵、性能报告和回滚手册。

---

## 3. 体验增强（G1~G7）

1. G1：Biome 视觉可辨识度增强。
2. G2：武器反馈差异增强（不改变伤害语义）。
3. G3：升级反馈形成 VFX + SFX + HUD 闭环。
4. G4：Boss 关键技能预警可感知、可规避。
5. G5：装备对比方向性提示增强。
6. G6：Endless 引入规则级 mutator 突变。
7. G7：Event/Merchant 引入条件分支与延迟收益机制。

---

## 4. 兼容与迁移

1. Run Save 维持 V1->V2 迁移链兼容。
2. Meta schema 迁移链保持向后兼容。
3. 延迟收益等新增字段采用可选字段策略，保障旧档加载。

---

## 5. 已知风险与限制

1. `DungeonScene.ts < 2500` DoD 目标当前仍需收口（详见 readiness 阻塞项）。
2. 4.7 发布签署前需完成全量回归与性能采样，当前仍在执行中。

---

## 6. 发布前核对清单

1. `phase4-release-readiness.md` 中阻塞项为 0。
2. `phase4-regression-matrix.md` 全量场景 Pass。
3. `phase4-performance-compare.md` 判定为 Pass 或有批准豁免。
4. `phase4-rollback-playbook.md` 完成演练并通过评审。

---

## 7. 相关文档

1. `docs/plans/phase4/2026-03-03-phase4-integrated-execution-plan.md`
2. `docs/plans/phase4/2026-03-03-phase4-7-release-closure-and-dod.md`
3. `docs/plans/phase4/release/2026-03-03-phase4-release-readiness.md`
4. `docs/plans/phase4/release/2026-03-03-phase4-regression-matrix.md`
5. `docs/plans/phase4/release/2026-03-03-phase4-performance-compare.md`
6. `docs/plans/phase4/release/2026-03-03-phase4-rollback-playbook.md`
