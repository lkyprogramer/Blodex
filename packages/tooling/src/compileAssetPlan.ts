import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

interface AssetPromptSpec {
  id: string;
  category: ManifestEntry["category"];
  prompt: string;
  scene?: string;
  subject?: string;
  style?: string;
  composition?: string;
  lighting?: string;
  palette?: string;
  materials?: string;
  constraints: string;
  avoid?: string;
  outputName: string;
  background?: "transparent" | "opaque" | "auto";
  outputFormat?: "png" | "webp";
  sourceType?: "generated" | "external";
  sourceRef?: string;
  attribution?: string;
}

interface AssetPlan {
  styleTag: string;
  useCase: string;
  defaults: {
    size: string;
    quality: "low" | "medium" | "high" | "auto";
    background?: "transparent" | "opaque" | "auto";
    outputFormat?: "png" | "webp";
  };
  assets: AssetPromptSpec[];
}

interface ManifestEntry {
  id: string;
  category:
    | "player_sprite"
    | "monster_sprite"
    | "boss_sprite"
    | "tile"
    | "item_icon"
    | "skill_icon"
    | "hud"
    | "fx"
    | "ui_icon";
  styleTag: string;
  promptHash: string;
  sourcePath: string;
  outputPath: string;
  license: string;
  revision: number;
  sourceType: "generated" | "external";
  sourceRef: string;
  attribution: string;
  optimized: {
    primaryFormat: "webp";
    fallbackFormat: "png";
    targetSize: { width: number; height: number };
    primaryOutputPath: string;
    fallbackOutputPath: string;
  };
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const ASSET_PLAN_PATH = resolve(ROOT, "assets/source-prompts/asset-plan.yaml");
const OUT_DIR = resolve(ROOT, "tmp/imagegen");
const OUT_FILE = resolve(OUT_DIR, "jobs.jsonl");
const MANIFEST_PATH = resolve(ROOT, "assets/generated/manifest.json");

const DEFAULT_IMAGE_MODEL = process.env.IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";
const DEFAULT_SOURCE_REF = `gemini:${DEFAULT_IMAGE_MODEL}`;

const TARGET_SIZE_BY_CATEGORY: Record<ManifestEntry["category"], { width: number; height: number }> = {
  player_sprite: { width: 384, height: 384 },
  monster_sprite: { width: 320, height: 320 },
  boss_sprite: { width: 448, height: 448 },
  tile: { width: 320, height: 320 },
  item_icon: { width: 192, height: 192 },
  skill_icon: { width: 192, height: 192 },
  hud: { width: 192, height: 192 },
  fx: { width: 320, height: 320 },
  ui_icon: { width: 192, height: 192 }
};

function stableHash(raw: string): string {
  return createHash("sha1").update(raw).digest("hex").slice(0, 10);
}

function loadManifestById(): Record<string, ManifestEntry> {
  if (!existsSync(MANIFEST_PATH)) {
    return {};
  }

  const existing = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as ManifestEntry[];
  return Object.fromEntries(existing.map((entry) => [entry.id, entry]));
}

function main(): void {
  const raw = readFileSync(ASSET_PLAN_PATH, "utf-8");
  const parsed = parse(raw) as AssetPlan;
  const existingManifest = loadManifestById();

  const assetsById = new Map(parsed.assets.map((entry) => [entry.id, entry]));

  const rows = parsed.assets.map((entry) => {
    const promptHash = stableHash(
      `${parsed.styleTag}:${entry.prompt}:${entry.constraints}:${entry.style ?? ""}:${entry.palette ?? ""}`
    );
    return {
      prompt: entry.prompt,
      use_case: parsed.useCase,
      scene: entry.scene,
      subject: entry.subject,
      style: entry.style,
      composition: entry.composition,
      lighting: entry.lighting,
      palette: entry.palette,
      materials: entry.materials,
      constraints: entry.constraints,
      negative: entry.avoid,
      size: parsed.defaults.size,
      quality: parsed.defaults.quality,
      background: entry.background ?? parsed.defaults.background,
      output_format: entry.outputFormat ?? parsed.defaults.outputFormat,
      output_name: entry.outputName,
      out: entry.outputName,
      metadata: {
        id: entry.id,
        category: entry.category,
        styleTag: parsed.styleTag,
        promptHash
      }
    };
  });

  const manifest: ManifestEntry[] = rows.map((row) => {
    const spec = assetsById.get(row.metadata.id);
    if (spec === undefined) {
      throw new Error(`asset id not found in plan while compiling manifest: ${row.metadata.id}`);
    }

    const previous = existingManifest[row.metadata.id];
    const revision =
      previous === undefined
        ? 1
        : previous.promptHash === row.metadata.promptHash
          ? previous.revision
          : previous.revision + 1;

    const fallbackOutputPath = `apps/game-client/public/generated/${row.metadata.id}.png`;
    const primaryOutputPath = `apps/game-client/public/generated/${row.metadata.id}.webp`;

    return {
      id: row.metadata.id,
      category: row.metadata.category,
      styleTag: row.metadata.styleTag,
      promptHash: row.metadata.promptHash,
      sourcePath: "assets/source-prompts/asset-plan.yaml",
      outputPath: fallbackOutputPath,
      license: "generated-original",
      revision,
      sourceType: spec.sourceType ?? "generated",
      sourceRef: spec.sourceRef ?? DEFAULT_SOURCE_REF,
      attribution: spec.attribution ?? "",
      optimized: {
        primaryFormat: "webp",
        fallbackFormat: "png",
        targetSize: TARGET_SIZE_BY_CATEGORY[row.metadata.category],
        primaryOutputPath,
        fallbackOutputPath
      }
    };
  });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT_FILE,
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf-8"
  );
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  process.stdout.write(`Wrote ${rows.length} jobs to ${OUT_FILE}\n`);
  process.stdout.write(`Synced manifest to ${MANIFEST_PATH}\n`);
}

main();
