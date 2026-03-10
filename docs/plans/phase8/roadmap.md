# Phase 8 Roadmap（入口）

**更新时间**: 2026-03-10  
**主入口**: `docs/plans/phase8/2026-03-10-phase8-roadmap.md`

---

## 1. Phase 8 主题

1. Phase 8 的第一优先级不是继续扩内容池，而是把 Phase 7 已经建立好的系统与内容，转成玩家真正能持续感知的战斗与构筑体验。
2. 当前主干最核心的缺口，不在架构或基础系统，而在：
   - 战斗主动性不足；
   - 构筑反馈缺少持续可见层；
   - 8 层节奏点存在，但情绪强度和“蓄势/喘息/高潮”结构还不够强。
3. 因此 Phase 8 的执行顺序固定为：
   - `8.0A` 战斗主动性
   - `8.0B` 持续反馈层
   - `8.0C` 节奏设计
   - `8.1` 第二批内容扩展（仅在前三者收口后启动）
4. `8.0A` 已明确冻结：
   - `Space` 触发 dodge
   - dodge 默认 `2` 格 / `80ms` i-frame / `700ms` 冷却
   - dodge 会打断自动攻击和自动寻路，但不移除自动攻击系统本身
5. `8.0B` 已明确冻结：
   - `P0` 先做 Buff rail 与 combat feedback + SFX
   - 元素 `Weak/Resist` 采用阈值显示，而不是对所有轻微倍率差都显示标签
   - Buff rail 默认最多 `6` 个图标位，超出显示 `+N`
6. `8.0C` 已明确冻结：
   - 准备室/休整窗口优先作为现有 `8` 层内的非战斗节点实现
   - 不通过继续增加 story floor 数来实现节奏窗口

---

## 2. 文档索引

1. `docs/plans/phase8/2026-03-10-phase8-roadmap.md`
2. `docs/plans/phase8/2026-03-10-phase8-8.0a-combat-agency.md`
3. `docs/plans/phase8/2026-03-10-phase8-8.0b-feedback-surface.md`
4. `docs/plans/phase8/2026-03-10-phase8-8.0c-pacing-pass.md`
5. `docs/plans/phase8/2026-03-10-phase8-8.1-content-batch-two.md`
6. `docs/plans/phase8/2026-03-10-phase8-resource-generation-plan.md`
