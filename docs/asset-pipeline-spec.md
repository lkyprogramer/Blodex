# Blodex 资产生成与获取规范

**Date**: 2026-02-23  
**Status**: Active Spec  
**Applies To**: `docs/plans/2026-02-23-long-term-roadmap-design.md` 中 Phase 1A/1B/2/3 的所有新增怪物、地图、特效、UI、音频资源

---

## 1. 目标与原则

本规范用于回答并约束以下问题：
- 新增怪物、地图、Boss、技能特效、UI 图标、音效和环境音应该从哪里来？
- 如何批量生成、版本管理、回滚和复现？
- 如何确保许可证安全，避免后期法务风险？

核心原则：
1. 先可用再精修：先提供可运行资产，再替换高质量资产。
2. 资产即数据：所有资产都必须有 manifest 记录，禁止“手工丢文件”。
3. 可复现：同一输入配置可复现同一资产版本。
4. 可审计：每个资产都能追溯来源、许可、版本。

---

## 2. 现状与差距

### 2.1 现状（已具备）
- 图片资产已具备完整流水线：
  - 源配置：`assets/source-prompts/asset-plan.yaml`
  - 编译脚本：`packages/tooling/src/compileAssetPlan.ts`
  - 生成脚本：`scripts/generate_assets.sh`
  - 清单：`assets/generated/manifest.json`
  - 运行时输出：`apps/game-client/public/generated/`

### 2.2 差距（未具备）
- 音频没有对应的计划文件、清单、校验、同步流程。
- 许可策略未形成统一门禁（仅有 `license` 字段，不足以覆盖来源分类和可商用约束）。
- 没有分阶段的“资产就绪 DoD”。

---

## 3. 资产来源策略（双轨制）

### 3.1 Track A：AI 生成资产（默认）
适用：
- 怪物立绘、地图贴图、道具图标、部分 VFX sprite、临时 UI 图。

优点：
- 产能快，便于迭代。
- 与现有图片流水线兼容。

限制：
- 需要统一风格与 prompt 约束。
- 需要人工验收可读性和一致性。

### 3.2 Track B：外部授权资产（补强）
适用：
- 关键 Boss 音效、UI 反馈音、环境循环音、特定高质量素材。

优点：
- 质量稳定，风格可控。

限制：
- 必须经过许可白名单。
- 必须记录来源与归属信息。

---

## 4. 许可与合规门禁

### 4.1 许可分级
- `allowed`: CC0 / 自有原创 / 明确可商用授权（无传染条款）。
- `review-required`: CC-BY（允许，但必须记录 attribution）。
- `blocked`: CC-BY-SA / GPL / 来源不明 / license 缺失。

### 4.2 强制字段（manifest）
每个资产必须包含：
- `id`
- `category`
- `sourceType` (`generated` | `external`)
- `sourceRef`（prompt 文件路径或外部资源链接/包名）
- `license`
- `attribution`（若不需要可为空字符串，但字段必须存在）
- `revision`

### 4.3 发布门禁
- `assets:validate` 必须同时校验：
  - 唯一 ID
  - 许可不为空
  - `blocked` 许可不得进入运行时目录

---

## 5. 目录与命名规范

### 5.1 图片资产
- 源计划：`assets/source-prompts/asset-plan.yaml`
- 生成清单：`assets/generated/manifest.json`
- 运行目录：`apps/game-client/public/generated/`

命名约定：
- `monster_<biome>_<role>_<index>.png`
- `biome_<name>_tile_<kind>_<index>.png`
- `boss_<name>_<phase>_<index>.png`
- `vfx_<skill_or_event>_<index>.png`

### 5.2 音频资产（新增）
- 源计划：`assets/source-prompts/audio-plan.yaml`（新增）
- 生成清单：`assets/generated/audio-manifest.json`（新增）
- 原始缓存：`output/audio/raw/`（新增）
- 运行目录：`apps/game-client/public/audio/`（新增）

命名约定：
- `sfx_combat_hit_01.ogg`
- `sfx_skill_war_cry_01.ogg`
- `sfx_boss_phase_change_01.ogg`
- `amb_biome_frozen_halls_loop_01.ogg`
- `ui_levelup_fanfare_01.ogg`

---

## 6. 流水线设计

## 6.1 图片流水线（沿用并增强）

现有命令（保留）：
```bash
pnpm assets:compile
pnpm assets:generate
pnpm assets:validate
```

增强项：
1. 在 `asset-plan.yaml` 中增加类别：
- `biome_tile`
- `boss_sprite`
- `hazard_tile`
- `vfx_sprite`
- `ui_icon`

2. manifest 增加字段：
- `sourceType`
- `sourceRef`
- `attribution`

3. 增加验收脚本（建议）：
- 尺寸、透明背景、命名、重复检测。

## 6.2 音频流水线（新增）

建议新增命令：
```bash
pnpm assets:audio:compile
pnpm assets:audio:generate
pnpm assets:audio:validate
pnpm assets:audio:sync
```

建议实现文件：
- `packages/tooling/src/compileAudioPlan.ts`
- `packages/tooling/src/validateAudioManifest.ts`
- `scripts/generate_audio_assets.sh`

`audio-plan.yaml` 示例：
```yaml
styleTag: grim-fantasy-audio-v1
defaults:
  format: ogg
  sampleRate: 48000
assets:
  - id: sfx_combat_hit_01
    category: sfx
    eventKey: combat:hit
    sourceType: external
    sourceRef: "pack://example-hit-pack"
    license: "CC0"
    attribution: ""
    outputName: sfx_combat_hit_01.ogg
```

`audio-manifest.json` 条目示例：
```json
{
  "id": "sfx_combat_hit_01",
  "category": "sfx",
  "eventKey": "combat:hit",
  "sourceType": "external",
  "sourceRef": "pack://example-hit-pack",
  "license": "CC0",
  "attribution": "",
  "outputPath": "apps/game-client/public/audio/sfx_combat_hit_01.ogg",
  "revision": 1
}
```

---

## 7. 与 Roadmap 阶段对齐的资产 DoD

| 阶段 | 最低资产要求（DoD） |
|------|----------------------|
| 1A | 每层至少 1 套可用 tile + 1 套怪物 sprite + Boss 基础 sprite + 核心战斗 SFX（hit/death/crit） |
| 1B | 5 个技能全部具备 `icon + cast SFX + 基础 VFX`，并与事件键绑定 |
| 2 | 每个新增 biome 至少具备 `tileset + 环境音 loop + 2 怪 + 1 hazard 视觉` |
| 3 | 关键事件全量音频覆盖（含 UI/Boss phase），资源音量标准化并通过性能回归 |

---

## 8. 质量标准

### 8.1 图片
- 可读性：在实际缩放下轮廓清晰。
- 风格一致：符合 `docs/art-style-bible.md`。
- 技术规格：尺寸、透明背景、命名与 category 一致。

### 8.2 音频
- 峰值与响度标准化（避免爆音或过小）。
- 循环音无明显爆点/断点。
- 事件触发延迟可接受（主循环反馈优先）。

---

## 9. 执行流程（每次新增资产）

1. 在计划文件新增条目（图片或音频）。
2. 编译计划，生成 jobs 与 manifest。
3. 生成/导入资产并同步到运行目录。
4. 执行 manifest 校验（含许可门禁）。
5. 在客户端完成事件绑定并手动 smoke。
6. PR 中附：
- 变更清单
- 许可说明
- 回放/截图/短录屏（可选但推荐）

---

## 10. 后续动作（建议立即执行）

1. 在 `docs/plans/2026-02-23-long-term-roadmap-design.md` 增加本规范链接。  
2. 新建 `assets/source-prompts/audio-plan.yaml` 初版（覆盖 Phase 1A 最小 SFX 集）。  
3. 在 `packages/tooling` 增加音频 compile/validate 脚本并接入 `package.json`。  
4. 将 `assets:validate` 升级为图片+音频统一许可门禁。  

