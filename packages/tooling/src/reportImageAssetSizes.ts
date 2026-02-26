import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const RAW_DIR = resolve(ROOT, "output/imagegen/raw");
const GENERATED_DIR = resolve(ROOT, "apps/game-client/public/generated");

const RAW_EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const GENERATED_EXTENSIONS = new Set([".png", ".webp"]);

const DEFAULT_IMAGE_BUDGET_MB = 11;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sumDirFiles(dir: string, allowedExtensions: Set<string>): { totalBytes: number; files: Array<{ name: string; bytes: number }> } {
  let totalBytes = 0;
  const files: Array<{ name: string; bytes: number }> = [];

  for (const name of readdirSync(dir)) {
    const ext = extname(name).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      continue;
    }

    const bytes = statSync(resolve(dir, name)).size;
    totalBytes += bytes;
    files.push({ name, bytes });
  }

  return { totalBytes, files };
}

function toMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

function main(): void {
  assert(existsSync(RAW_DIR), `Raw image directory not found: ${RAW_DIR}`);
  assert(existsSync(GENERATED_DIR), `Generated image directory not found: ${GENERATED_DIR}`);

  const budgetMb = Number(process.env.IMAGE_SIZE_BUDGET_MB ?? DEFAULT_IMAGE_BUDGET_MB);
  assert(Number.isFinite(budgetMb) && budgetMb > 0, `IMAGE_SIZE_BUDGET_MB must be a positive number, got: ${budgetMb}`);

  const raw = sumDirFiles(RAW_DIR, RAW_EXTENSIONS);
  const optimized = sumDirFiles(GENERATED_DIR, GENERATED_EXTENSIONS);

  assert(raw.files.length > 0, "No raw images found for reporting.");
  assert(optimized.files.length > 0, "No optimized images found for reporting.");

  const rawMb = toMB(raw.totalBytes);
  const optimizedMb = toMB(optimized.totalBytes);
  const reduction = raw.totalBytes === 0 ? 0 : ((raw.totalBytes - optimized.totalBytes) / raw.totalBytes) * 100;

  const topHeavy = [...optimized.files].sort((a, b) => b.bytes - a.bytes).slice(0, 5);

  process.stdout.write(`[assets:images:report] raw total: ${rawMb.toFixed(2)} MB (${raw.files.length} files)\n`);
  process.stdout.write(
    `[assets:images:report] optimized total: ${optimizedMb.toFixed(2)} MB (${optimized.files.length} files)\n`
  );
  process.stdout.write(`[assets:images:report] reduction: ${reduction.toFixed(2)}%\n`);
  process.stdout.write(`[assets:images:report] budget: <= ${budgetMb.toFixed(2)} MB\n`);

  if (topHeavy.length > 0) {
    process.stdout.write("[assets:images:report] top optimized files:\n");
    for (const file of topHeavy) {
      process.stdout.write(`  - ${file.name}: ${toMB(file.bytes).toFixed(2)} MB\n`);
    }
  }

  assert(
    optimizedMb <= budgetMb,
    `optimized images exceed budget: ${optimizedMb.toFixed(2)} MB > ${budgetMb.toFixed(2)} MB`
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
