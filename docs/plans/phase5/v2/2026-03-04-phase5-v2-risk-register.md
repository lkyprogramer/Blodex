# Phase 5 V2 风险台账（5.0 冻结）

**日期**: 2026-03-04  
**阶段**: 5.0 Baseline Contract Freeze

---

## 1. 风险矩阵

| Risk ID | 分类 | 描述 | 严重度 | 对应阶段 | 止损策略 |
|---|---|---|---|---|---|
| R-F1 | 规则 | special affix 可见不可用导致信任破坏 | Critical | 5.1 | 聚合层 + 显式消费 + 回归测试 |
| R-F2 | 规则 | `critChance` 单位错配导致数值失真 | Critical | 5.1 | 全量单位统一 + fixture 更新 |
| R-F3 | 规则 | AI 穿墙导致空间博弈失效 | Critical | 5.2 | move 校验 walkable + stuck 回退 |
| R-F4 | 平衡 | 护甲线性减伤后期失效 | High | 5.3 | 百分比减伤公式 + K 值回归 |
| R-F5 | 经济 | 掉落分层弱导致进度感不足 | High | 5.3 | loot floor band 重配 |
| R-F6 | 成长 | 升级无属性选择导致构筑单一 | High | 5.3 | 升级属性选择面板 |
| R-F7 | 规则 | monster affix 规则分裂 | High | 5.2 | core 规则归一 + scene 去逻辑 |
| R-F8 | 经济 | biome lootBias 未生效 | High | 5.3 | 掉落权重接入 biome bias |
| R-A1 | 架构 | Host `any` 依赖导致类型失效 | Critical | 5.4 | Host Port 接口化 |
| R-A2 | 方法论 | heuristic 模拟误导平衡决策 | High | 5.6 | 真实规则仿真管线 |
| R-EXP | 体验 | 体验增强抢跑掩盖规则缺陷 | High | 5.5 | 5.1~5.4 完成前禁止体验大改 |
| R-ASSET | 资源 | 音频资源引用与清单不一致 | High | 5.5/5.7 | `assets:audio:validate` 阻断 |

---

## 2. 触发与升级机制

1. 任意 Critical 风险触发后，立即阻断跨阶段推进。
2. 同一风险连续 2 个 PR 未收敛，升级为阶段阻塞项。
3. 豁免必须记录负责人、到期版本、替代控制措施。

---

## 3. 证据要求

每个风险关闭时至少提交以下证据：

1. 自动化测试结果。
2. 手动冒烟记录（默认优先金手指）。
3. 关键日志或指标截图。

