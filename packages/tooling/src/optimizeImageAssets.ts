import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

interface OptimizedAssetConfig {
  primaryFormat: "webp";
  fallbackFormat: "png";
  targetSize: {
    width: number;
    height: number;
  };
  primaryOutputPath: string;
  fallbackOutputPath: string;
}

interface AssetManifestEntry {
  id: string;
  optimized?: OptimizedAssetConfig;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const MANIFEST_PATH = resolve(ROOT, "assets/generated/manifest.json");
const RAW_DIR = resolve(ROOT, "output/imagegen/raw");
const GENERATED_DIR = resolve(ROOT, "apps/game-client/public/generated");
const PUBLIC_MANIFEST_PATH = resolve(GENERATED_DIR, "manifest.json");

const RAW_EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const GENERATED_EXTENSIONS = new Set([".png", ".webp"]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function indexRawImages(): Map<string, string> {
  assert(existsSync(RAW_DIR), `Raw directory not found: ${RAW_DIR}`);

  const byId = new Map<string, string>();
  for (const fileName of readdirSync(RAW_DIR)) {
    const ext = extname(fileName).toLowerCase();
    if (!RAW_EXTENSIONS.has(ext)) {
      continue;
    }

    const id = fileName.slice(0, -ext.length);
    const absolute = resolve(RAW_DIR, fileName);
    const previous = byId.get(id);

    if (previous === undefined) {
      byId.set(id, absolute);
      continue;
    }

    if (ext === ".png") {
      byId.set(id, absolute);
    }
  }

  return byId;
}

function removeStaleOutputs(expectedAbsolutePaths: Set<string>): number {
  if (!existsSync(GENERATED_DIR)) {
    return 0;
  }

  let removed = 0;
  for (const fileName of readdirSync(GENERATED_DIR)) {
    const ext = extname(fileName).toLowerCase();
    if (!GENERATED_EXTENSIONS.has(ext)) {
      continue;
    }

    const absolute = resolve(GENERATED_DIR, fileName);
    if (!expectedAbsolutePaths.has(absolute)) {
      unlinkSync(absolute);
      removed += 1;
    }
  }

  return removed;
}

function getOptimizedConfig(entry: AssetManifestEntry): OptimizedAssetConfig {
  assert(entry.optimized !== undefined, `optimized config missing for ${entry.id}`);
  return entry.optimized;
}

async function optimizeEntry(entry: AssetManifestEntry, sourcePath: string): Promise<{ rawBytes: number; optimizedBytes: number }> {
  const optimized = getOptimizedConfig(entry);
  const primaryAbsolutePath = resolve(ROOT, optimized.primaryOutputPath);
  const fallbackAbsolutePath = resolve(ROOT, optimized.fallbackOutputPath);

  mkdirSync(dirname(primaryAbsolutePath), { recursive: true });
  mkdirSync(dirname(fallbackAbsolutePath), { recursive: true });

  const basePipeline = sharp(sourcePath).resize(optimized.targetSize.width, optimized.targetSize.height, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  });

  await basePipeline
    .clone()
    .webp({
      quality: 82,
      alphaQuality: 90,
      effort: 4
    })
    .toFile(primaryAbsolutePath);

  await basePipeline
    .clone()
    .png({
      compressionLevel: 9,
      effort: 7
    })
    .toFile(fallbackAbsolutePath);

  const rawBytes = statSync(sourcePath).size;
  const optimizedBytes = statSync(primaryAbsolutePath).size + statSync(fallbackAbsolutePath).size;

  return { rawBytes, optimizedBytes };
}

async function main(): Promise<void> {
  assert(existsSync(MANIFEST_PATH), `Missing manifest: ${MANIFEST_PATH}`);

  const entries = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as AssetManifestEntry[];
  assert(Array.isArray(entries), "Manifest must be an array.");
  assert(entries.length > 0, "Manifest must contain at least one entry.");

  mkdirSync(GENERATED_DIR, { recursive: true });

  const rawById = indexRawImages();
  const expectedOutputs = new Set<string>();

  for (const entry of entries) {
    const optimized = getOptimizedConfig(entry);
    expectedOutputs.add(resolve(ROOT, optimized.primaryOutputPath));
    expectedOutputs.add(resolve(ROOT, optimized.fallbackOutputPath));
  }

  const staleRemoved = removeStaleOutputs(expectedOutputs);

  let totalRawBytes = 0;
  let totalOptimizedBytes = 0;

  for (const entry of entries) {
    const sourcePath = rawById.get(entry.id);
    assert(sourcePath !== undefined, `Raw source image missing for asset id: ${entry.id}`);

    const result = await optimizeEntry(entry, sourcePath);
    totalRawBytes += result.rawBytes;
    totalOptimizedBytes += result.optimizedBytes;

    process.stdout.write(
      `[optimize] ${entry.id}: ${formatSize(result.rawBytes)} -> ${formatSize(result.optimizedBytes)} (webp+png)\n`
    );
  }

  const reduction = totalRawBytes === 0 ? 0 : ((totalRawBytes - totalOptimizedBytes) / totalRawBytes) * 100;

  writeFileSync(PUBLIC_MANIFEST_PATH, readFileSync(MANIFEST_PATH, "utf-8"), "utf-8");

  process.stdout.write(`[optimize] entries: ${entries.length}\n`);
  process.stdout.write(`[optimize] stale removed: ${staleRemoved}\n`);
  process.stdout.write(`[optimize] total raw: ${formatSize(totalRawBytes)}\n`);
  process.stdout.write(`[optimize] total optimized: ${formatSize(totalOptimizedBytes)}\n`);
  process.stdout.write(`[optimize] reduction: ${reduction.toFixed(2)}%\n`);
  process.stdout.write(`[optimize] synced manifest: ${PUBLIC_MANIFEST_PATH}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
