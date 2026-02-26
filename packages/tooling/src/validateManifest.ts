import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const MANIFEST_PATH = resolve(ROOT, "assets/generated/manifest.json");

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

const TARGET_SIZE_BY_CATEGORY: Record<AssetManifestEntry["category"], { width: number; height: number }> = {
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

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFileExists(pathLike: string, message: string): void {
  assert(pathLike.length > 0, message);
  const abs = resolve(ROOT, pathLike);
  assert(existsSync(abs), `${message}; missing file: ${pathLike}`);
}

function main(): void {
  assert(existsSync(MANIFEST_PATH), `Missing manifest: ${MANIFEST_PATH}`);
  const entries = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as AssetManifestEntry[];

  assert(Array.isArray(entries), "Manifest must be an array.");
  assert(entries.length > 0, "Manifest must contain at least one asset entry.");

  const ids = new Set<string>();

  for (const entry of entries) {
    assert(typeof entry.id === "string" && entry.id.length > 0, "Entry id is required.");
    assert(!ids.has(entry.id), `Duplicate asset id: ${entry.id}`);
    ids.add(entry.id);
    assert(typeof entry.styleTag === "string" && entry.styleTag.length > 0, `styleTag missing on ${entry.id}`);
    assert(typeof entry.promptHash === "string" && entry.promptHash.length >= 8, `promptHash invalid on ${entry.id}`);
    assert(typeof entry.outputPath === "string" && entry.outputPath.length > 0, `outputPath missing on ${entry.id}`);
    assert(Number.isInteger(entry.revision) && entry.revision > 0, `revision invalid on ${entry.id}`);
    assert(entry.sourceType === "generated" || entry.sourceType === "external", `sourceType invalid on ${entry.id}`);
    assert(typeof entry.sourceRef === "string" && entry.sourceRef.length > 0, `sourceRef missing on ${entry.id}`);
    assert(typeof entry.attribution === "string", `attribution missing on ${entry.id}`);
    assert(entry.license !== "blocked", `blocked license is not allowed on ${entry.id}`);
    if (entry.license === "review-required") {
      assert(entry.attribution.length > 0, `review-required license requires attribution on ${entry.id}`);
    }

    assert(entry.optimized !== undefined, `optimized config missing on ${entry.id}`);
    assert(entry.optimized.primaryFormat === "webp", `primaryFormat must be webp on ${entry.id}`);
    assert(entry.optimized.fallbackFormat === "png", `fallbackFormat must be png on ${entry.id}`);

    const expectedSize = TARGET_SIZE_BY_CATEGORY[entry.category];
    const actualSize = entry.optimized.targetSize;
    assert(Number.isInteger(actualSize.width) && actualSize.width > 0, `target width invalid on ${entry.id}`);
    assert(Number.isInteger(actualSize.height) && actualSize.height > 0, `target height invalid on ${entry.id}`);
    assert(
      actualSize.width === expectedSize.width && actualSize.height === expectedSize.height,
      `targetSize mismatch on ${entry.id}; expected ${expectedSize.width}x${expectedSize.height}`
    );

    assert(
      entry.outputPath === entry.optimized.fallbackOutputPath,
      `outputPath must match fallbackOutputPath on ${entry.id}`
    );

    assertFileExists(entry.optimized.primaryOutputPath, `primaryOutputPath missing on ${entry.id}`);
    assertFileExists(entry.optimized.fallbackOutputPath, `fallbackOutputPath missing on ${entry.id}`);
  }

  process.stdout.write(`Manifest valid: ${entries.length} entries\n`);
}

main();
