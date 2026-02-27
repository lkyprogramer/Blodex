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
  optimized?: OptimizedAssetConfig;
}

type BackgroundOutcome = "applied" | "rolled_back" | "skipped";

interface OptimizeEntryResult {
  rawBytes: number;
  optimizedBytes: number;
  backgroundOutcome: BackgroundOutcome;
}

interface BackgroundRemovalOptions {
  alphaThreshold: number;
  seedTolerance: number;
  growTolerance: number;
  localTolerance: number;
  quantizeStep: number;
  maxSeedColors: number;
  minSeedCoverage: number;
  minRemainingRatio: number;
  minLargestComponentRatio: number;
  whiteThreshold: number;
  whiteSaturationTolerance: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const MANIFEST_PATH = resolve(ROOT, "assets/generated/manifest.json");
const RAW_DIR = resolve(ROOT, "output/imagegen/raw");
const GENERATED_DIR = resolve(ROOT, "apps/game-client/public/generated");
const PUBLIC_MANIFEST_PATH = resolve(GENERATED_DIR, "manifest.json");

const RAW_EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const GENERATED_EXTENSIONS = new Set([".png", ".webp"]);
const BACKGROUND_REMOVAL_CATEGORIES: ReadonlySet<string> = new Set([
  "player_sprite",
  "monster_sprite",
  "boss_sprite"
]);
const BACKGROUND_REMOVAL_OPTIONS: BackgroundRemovalOptions = {
  alphaThreshold: 8,
  seedTolerance: 40,
  growTolerance: 34,
  localTolerance: 0,
  quantizeStep: 16,
  maxSeedColors: 3,
  minSeedCoverage: 0.82,
  minRemainingRatio: 0.12,
  minLargestComponentRatio: 0.72,
  whiteThreshold: 180,
  whiteSaturationTolerance: 45
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function colorDistanceSq(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function quantizeColor(color: Rgb, step: number): number {
  const q = Math.max(1, step);
  const r = Math.floor(color.r / q);
  const g = Math.floor(color.g / q);
  const b = Math.floor(color.b / q);
  return (r << 16) | (g << 8) | b;
}

function decodeQuantizedColor(key: number, step: number): Rgb {
  const q = Math.max(1, step);
  const half = Math.floor(q / 2);
  const r = ((key >> 16) & 0xff) * q + half;
  const g = ((key >> 8) & 0xff) * q + half;
  const b = (key & 0xff) * q + half;
  return {
    r: Math.min(255, r),
    g: Math.min(255, g),
    b: Math.min(255, b)
  };
}

function collectBorderPositions(width: number, height: number): number[] {
  const positions: number[] = [];
  for (let x = 0; x < width; x += 1) {
    positions.push(x);
    if (height > 1) {
      positions.push((height - 1) * width + x);
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    positions.push(y * width);
    if (width > 1) {
      positions.push(y * width + (width - 1));
    }
  }
  return positions;
}

function computeOpaqueMaskStats(
  pixels: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): { opaqueCount: number; largestComponentCount: number } {
  const totalPixels = width * height;
  const opaqueMask = new Uint8Array(totalPixels);
  let opaqueCount = 0;
  for (let pos = 0; pos < totalPixels; pos += 1) {
    const alpha = pixels[pos * 4 + 3] ?? 0;
    if (alpha < alphaThreshold) {
      continue;
    }
    opaqueMask[pos] = 1;
    opaqueCount += 1;
  }

  if (opaqueCount === 0) {
    return { opaqueCount: 0, largestComponentCount: 0 };
  }

  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let largestComponentCount = 0;

  for (let start = 0; start < totalPixels; start += 1) {
    if (opaqueMask[start] !== 1 || visited[start] === 1) {
      continue;
    }

    visited[start] = 1;
    let componentCount = 0;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const current = queue[head] ?? -1;
      head += 1;
      if (current < 0) {
        continue;
      }

      componentCount += 1;
      const x = current % width;
      const y = Math.floor(current / width);

      const left = x > 0 ? current - 1 : -1;
      const right = x < width - 1 ? current + 1 : -1;
      const up = y > 0 ? current - width : -1;
      const down = y < height - 1 ? current + width : -1;

      const neighbors = [left, right, up, down];
      for (const next of neighbors) {
        if (next < 0 || opaqueMask[next] !== 1 || visited[next] === 1) {
          continue;
        }
        visited[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }

    if (componentCount > largestComponentCount) {
      largestComponentCount = componentCount;
    }
  }

  return { opaqueCount, largestComponentCount };
}

function pickSeedColors(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: BackgroundRemovalOptions
): Rgb[] {
  const histogram = new Map<number, number>();
  const borderPositions = collectBorderPositions(width, height);
  let validCount = 0;

  for (const pos of borderPositions) {
    const idx = pos * 4;
    if ((pixels[idx + 3] ?? 0) < options.alphaThreshold) {
      continue;
    }
    validCount += 1;
    const key = quantizeColor(
      {
        r: pixels[idx] ?? 0,
        g: pixels[idx + 1] ?? 0,
        b: pixels[idx + 2] ?? 0
      },
      options.quantizeStep
    );
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }

  if (validCount === 0 || histogram.size === 0) {
    return [];
  }

  const ranked = [...histogram.entries()].sort((a, b) => b[1] - a[1]);
  const picked: Rgb[] = [];
  let covered = 0;
  for (const [key, count] of ranked) {
    picked.push(decodeQuantizedColor(key, options.quantizeStep));
    covered += count;
    if (
      picked.length >= options.maxSeedColors ||
      covered / validCount >= options.minSeedCoverage
    ) {
      break;
    }
  }

  return picked;
}

function nearAny(color: Rgb, seeds: Rgb[], toleranceSq: number): boolean {
  for (const seed of seeds) {
    if (colorDistanceSq(color, seed) <= toleranceSq) {
      return true;
    }
  }
  return false;
}

function removeConnectedBackgroundPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: BackgroundRemovalOptions
): BackgroundOutcome {
  const snapshot = pixels.slice();
  const seeds = pickSeedColors(pixels, width, height, options);
  if (seeds.length === 0) {
    return "skipped";
  }

  const seedToleranceSq = options.seedTolerance * options.seedTolerance;
  const growToleranceSq = options.growTolerance * options.growTolerance;
  const localToleranceSq = options.localTolerance * options.localTolerance;

  const positions = collectBorderPositions(width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let opaqueBefore = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) >= options.alphaThreshold) {
      opaqueBefore += 1;
    }
  }
  if (opaqueBefore === 0) {
    return "skipped";
  }

  for (const pos of positions) {
    if (visited[pos] === 1) {
      continue;
    }
    const idx = pos * 4;
    if ((pixels[idx + 3] ?? 0) < options.alphaThreshold) {
      visited[pos] = 1;
      continue;
    }
    const color = {
      r: pixels[idx] ?? 0,
      g: pixels[idx + 1] ?? 0,
      b: pixels[idx + 2] ?? 0
    };
    if (!nearAny(color, seeds, seedToleranceSq)) {
      continue;
    }
    visited[pos] = 1;
    queue[tail] = pos;
    tail += 1;
  }

  const neighbors = [-1, 1, -width, width];
  while (head < tail) {
    const current = queue[head] ?? -1;
    head += 1;
    if (current < 0) {
      continue;
    }
    const currentX = current % width;
    const currentY = Math.floor(current / width);
    const currentIdx = current * 4;
    const currentColor = {
      r: pixels[currentIdx] ?? 0,
      g: pixels[currentIdx + 1] ?? 0,
      b: pixels[currentIdx + 2] ?? 0
    };

    for (const offset of neighbors) {
      const next = current + offset;
      if (next < 0 || next >= width * height || visited[next] === 1) {
        continue;
      }
      const nextX = next % width;
      const nextY = Math.floor(next / width);
      if (Math.abs(nextX - currentX) + Math.abs(nextY - currentY) !== 1) {
        continue;
      }

      const nextIdx = next * 4;
      if ((pixels[nextIdx + 3] ?? 0) < options.alphaThreshold) {
        visited[next] = 1;
        continue;
      }

      const nextColor = {
        r: pixels[nextIdx] ?? 0,
        g: pixels[nextIdx + 1] ?? 0,
        b: pixels[nextIdx + 2] ?? 0
      };
      const growsBySeed = nearAny(nextColor, seeds, growToleranceSq);
      const growsByLocal = colorDistanceSq(nextColor, currentColor) <= localToleranceSq;
      if (!growsBySeed && !growsByLocal) {
        continue;
      }

      visited[next] = 1;
      queue[tail] = next;
      tail += 1;
    }
  }

  let removed = 0;
  for (let i = 0; i < visited.length; i += 1) {
    if (visited[i] !== 1) {
      continue;
    }
    const alphaIdx = i * 4 + 3;
    if ((pixels[alphaIdx] ?? 0) >= options.alphaThreshold) {
      pixels[alphaIdx] = 0;
      removed += 1;
    }
  }

  if (removed === 0) {
    return "skipped";
  }

  const opaqueAfter = opaqueBefore - removed;
  const remainingRatio = opaqueAfter / opaqueBefore;
  if (remainingRatio < options.minRemainingRatio) {
    pixels.set(snapshot);
    return "rolled_back";
  }

  const maskStats = computeOpaqueMaskStats(pixels, width, height, options.alphaThreshold);
  if (maskStats.opaqueCount === 0) {
    pixels.set(snapshot);
    return "rolled_back";
  }
  const largestComponentRatio = maskStats.largestComponentCount / maskStats.opaqueCount;
  if (largestComponentRatio < options.minLargestComponentRatio) {
    pixels.set(snapshot);
    return "rolled_back";
  }

  return "applied";
}

function isNearWhite(
  color: Rgb,
  whiteThreshold: number,
  whiteSaturationTolerance: number
): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max >= whiteThreshold && max - min <= whiteSaturationTolerance;
}

function removeConnectedNearWhitePixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: BackgroundRemovalOptions
): BackgroundOutcome {
  const snapshot = pixels.slice();
  const borderPositions = collectBorderPositions(width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let opaqueBefore = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) >= options.alphaThreshold) {
      opaqueBefore += 1;
    }
  }
  if (opaqueBefore === 0) {
    return "skipped";
  }

  for (const pos of borderPositions) {
    const idx = pos * 4;
    if ((pixels[idx + 3] ?? 0) < options.alphaThreshold) {
      continue;
    }
    const color = {
      r: pixels[idx] ?? 0,
      g: pixels[idx + 1] ?? 0,
      b: pixels[idx + 2] ?? 0
    };
    if (!isNearWhite(color, options.whiteThreshold, options.whiteSaturationTolerance)) {
      continue;
    }
    visited[pos] = 1;
    queue[tail] = pos;
    tail += 1;
  }

  const neighbors = [-1, 1, -width, width];
  while (head < tail) {
    const current = queue[head] ?? -1;
    head += 1;
    if (current < 0) {
      continue;
    }
    const currentX = current % width;
    const currentY = Math.floor(current / width);
    for (const offset of neighbors) {
      const next = current + offset;
      if (next < 0 || next >= width * height || visited[next] === 1) {
        continue;
      }
      const nextX = next % width;
      const nextY = Math.floor(next / width);
      if (Math.abs(nextX - currentX) + Math.abs(nextY - currentY) !== 1) {
        continue;
      }
      const idx = next * 4;
      if ((pixels[idx + 3] ?? 0) < options.alphaThreshold) {
        continue;
      }
      const color = {
        r: pixels[idx] ?? 0,
        g: pixels[idx + 1] ?? 0,
        b: pixels[idx + 2] ?? 0
      };
      if (!isNearWhite(color, options.whiteThreshold, options.whiteSaturationTolerance)) {
        continue;
      }
      visited[next] = 1;
      queue[tail] = next;
      tail += 1;
    }
  }

  let removed = 0;
  for (let i = 0; i < visited.length; i += 1) {
    if (visited[i] !== 1) {
      continue;
    }
    const alphaIdx = i * 4 + 3;
    if ((pixels[alphaIdx] ?? 0) >= options.alphaThreshold) {
      pixels[alphaIdx] = 0;
      removed += 1;
    }
  }

  if (removed === 0) {
    return "skipped";
  }

  const opaqueAfter = opaqueBefore - removed;
  const remainingRatio = opaqueAfter / opaqueBefore;
  if (remainingRatio < options.minRemainingRatio) {
    pixels.set(snapshot);
    return "rolled_back";
  }

  const maskStats = computeOpaqueMaskStats(pixels, width, height, options.alphaThreshold);
  if (maskStats.opaqueCount === 0) {
    pixels.set(snapshot);
    return "rolled_back";
  }
  const largestComponentRatio = maskStats.largestComponentCount / maskStats.opaqueCount;
  if (largestComponentRatio < options.minLargestComponentRatio) {
    pixels.set(snapshot);
    return "rolled_back";
  }
  return "applied";
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

async function optimizeEntry(
  entry: AssetManifestEntry,
  sourcePath: string
): Promise<OptimizeEntryResult> {
  const optimized = getOptimizedConfig(entry);
  const primaryAbsolutePath = resolve(ROOT, optimized.primaryOutputPath);
  const fallbackAbsolutePath = resolve(ROOT, optimized.fallbackOutputPath);

  mkdirSync(dirname(primaryAbsolutePath), { recursive: true });
  mkdirSync(dirname(fallbackAbsolutePath), { recursive: true });

  const resized = await sharp(sourcePath)
    .resize(optimized.targetSize.width, optimized.targetSize.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  assert(info.channels === 4, `Expected RGBA output, got ${info.channels} channels for ${entry.id}`);
  const pixels = Uint8Array.from(data);
  const backgroundOutcome = BACKGROUND_REMOVAL_CATEGORIES.has(entry.category)
    ? (() => {
        const nearWhite = removeConnectedNearWhitePixels(
          pixels,
          info.width,
          info.height,
          BACKGROUND_REMOVAL_OPTIONS
        );
        if (nearWhite === "applied") {
          return nearWhite;
        }

        const connected = removeConnectedBackgroundPixels(
          pixels,
          info.width,
          info.height,
          BACKGROUND_REMOVAL_OPTIONS
        );
        if (connected === "applied") {
          return connected;
        }
        return nearWhite === "rolled_back" || connected === "rolled_back" ? "rolled_back" : "skipped";
      })()
    : "skipped";

  const output = sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  });

  await output
    .clone()
    .webp({
      quality: 82,
      alphaQuality: 90,
      effort: 4
    })
    .toFile(primaryAbsolutePath);

  await output
    .clone()
    .png({
      compressionLevel: 9,
      effort: 7
    })
    .toFile(fallbackAbsolutePath);

  const rawBytes = statSync(sourcePath).size;
  const optimizedBytes = statSync(primaryAbsolutePath).size + statSync(fallbackAbsolutePath).size;

  return {
    rawBytes,
    optimizedBytes,
    backgroundOutcome
  };
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
  let backgroundApplied = 0;
  let backgroundRolledBack = 0;
  let backgroundSkipped = 0;

  for (const entry of entries) {
    const sourcePath = rawById.get(entry.id);
    assert(sourcePath !== undefined, `Raw source image missing for asset id: ${entry.id}`);

    const result = await optimizeEntry(entry, sourcePath);
    totalRawBytes += result.rawBytes;
    totalOptimizedBytes += result.optimizedBytes;

    if (result.backgroundOutcome === "applied") {
      backgroundApplied += 1;
    } else if (result.backgroundOutcome === "rolled_back") {
      backgroundRolledBack += 1;
    } else {
      backgroundSkipped += 1;
    }

    process.stdout.write(
      `[optimize] ${entry.id}: ${formatSize(result.rawBytes)} -> ${formatSize(result.optimizedBytes)} (webp+png, bg=${result.backgroundOutcome})\n`
    );
  }

  const reduction = totalRawBytes === 0 ? 0 : ((totalRawBytes - totalOptimizedBytes) / totalRawBytes) * 100;

  writeFileSync(PUBLIC_MANIFEST_PATH, readFileSync(MANIFEST_PATH, "utf-8"), "utf-8");

  process.stdout.write(`[optimize] entries: ${entries.length}\n`);
  process.stdout.write(`[optimize] stale removed: ${staleRemoved}\n`);
  process.stdout.write(`[optimize] total raw: ${formatSize(totalRawBytes)}\n`);
  process.stdout.write(`[optimize] total optimized: ${formatSize(totalOptimizedBytes)}\n`);
  process.stdout.write(`[optimize] reduction: ${reduction.toFixed(2)}%\n`);
  process.stdout.write(
    `[optimize] background processing: applied=${backgroundApplied}, rolled_back=${backgroundRolledBack}, skipped=${backgroundSkipped}\n`
  );
  process.stdout.write(`[optimize] synced manifest: ${PUBLIC_MANIFEST_PATH}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
