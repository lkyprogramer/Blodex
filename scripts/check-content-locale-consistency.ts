const { execSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const command =
  "pnpm --filter @blodex/game-client exec vitest run src/i18n/content/__tests__/content-coverage.test.ts";

try {
  execSync(command, {
    cwd: repoRoot,
    stdio: "inherit"
  });
  console.log("[content-i18n] locale consistency checks passed.");
} catch (error) {
  console.error("[content-i18n] locale consistency checks failed.");
  if (error && typeof error === "object" && "status" in error) {
    process.exit(error.status ?? 1);
  }
  process.exit(1);
}
