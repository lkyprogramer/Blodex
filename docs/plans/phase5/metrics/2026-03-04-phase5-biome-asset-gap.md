# Phase 5 美术资源新需求核查与补充记录

**日期**: 2026-03-04  
**核查范围**: `docs/plans/phase5/*`、`packages/content/src/biomes.ts`、`assets/source-prompts/asset-plan.yaml`、`assets/generated/manifest.json`、`apps/game-client/public/generated/*`  
**风格规范基线**: `docs/art-style-bible.md`（`painterly-dark-fantasy-v1`）

---

## 1. 核查结论

本轮核查识别到 1 个已落地但资源未独立化的明确新需求：

1. `venom_swamp` 仍复用 `biome_molten_tile_floor_01`，与 Phase 5 文档提出的“沼泽独立地砖”目标不一致。

本轮未发现其他必须立即新增的硬性美术缺口（其余多为可复用 VFX/SFX 或后续阶段实现项）。
但 Phase 5 文档存在音频增量场景（5.3 SFX 变体、5.5 biome ambient），必须纳入音频计划链路执行。

---

## 2. 补充动作（按 art-style-bible 执行）

### 2.1 新增资源定义

1. `biome_venom_tile_floor_01`
2. `biome_venom_tile_wall_01`

已在 `assets/source-prompts/asset-plan.yaml` 新增两条 `tile` 资产定义，风格参数遵循：

1. Mood/Rendering：`painterly dark fantasy`，保留笔触质感。
2. Palette：`damp stone green / charcoal / muted yellow-green`。
3. Lighting：低照度、顶部可读性优先。
4. Constraints：沿用 bible footer（原生 IP、无 logo/watermark、可读性优先）。

### 2.2 运行时接入

1. `packages/content/src/biomes.ts`
   - `venom_swamp.floorTilesetKey` 切换为 `biome_venom_tile_floor_01`。
2. `apps/game-client/src/scenes/dungeon/presentation/BiomeVisualThemeRegistry.ts`
   - `venom_swamp.floorTileKey` 切换为 `biome_venom_tile_floor_01`。
3. `apps/game-client/src/scenes/DungeonScene.ts`
   - 预加载列表新增 `biome_venom_tile_floor_01`。
4. `apps/game-client/src/scenes/dungeon/presentation/__tests__/biomeVisualThemeRegistry.test.ts`
   - floor 材质最小区分阈值从 `>=4` 提升到 `>=5`。

### 2.3 资源文件与清单

1. 新增图片文件：
   - `apps/game-client/public/generated/biome_venom_tile_floor_01.png`
   - `apps/game-client/public/generated/biome_venom_tile_floor_01.webp`
   - `apps/game-client/public/generated/biome_venom_tile_wall_01.png`
   - `apps/game-client/public/generated/biome_venom_tile_wall_01.webp`
2. 新增 raw 源图：
   - `output/imagegen/raw/biome_venom_tile_floor_01.png`
   - `output/imagegen/raw/biome_venom_tile_wall_01.png`
3. 清单同步：
   - `assets/generated/manifest.json` 更新为 70 entries。
   - `apps/game-client/public/generated/manifest.json` 同步更新。

---

## 3. 验证结果

执行结果：

1. `pnpm assets:compile`：Pass（jobs=70）
2. `pnpm --filter @blodex/tooling assets:validate`：Pass（Manifest valid: 70 entries）
3. `pnpm --filter @blodex/game-client typecheck`：Pass
4. `pnpm --filter @blodex/game-client test src/scenes/dungeon/presentation/__tests__/biomeVisualThemeRegistry.test.ts`：Pass
5. `pnpm --filter @blodex/content test`：Pass
6. `pnpm check:architecture-budget`：Pass

---

## 4. 后续建议

1. 若 5.5 继续推进 Biome 细化，可追加 `venom_swamp` 专属 hazard decal（毒沼区）而非复用 lava/ice/spike 语义。
2. 若新增该类资源，继续通过 `asset-plan -> manifest -> validate` 链路落地，避免“代码接入先于资源存在”的断层。
3. 若新增音频资源，必须并行走 `audio-plan -> audio-manifest -> assets:audio:validate`，并在 5.7 发布收口中留存命令证据。
