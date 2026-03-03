const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const ciWorkflowPath = path.join(repoRoot, ".github", "workflows", "ci.yml");

function fail(message: string): never {
  console.error(`[toolchain] ${message}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const packageManager = packageJson.packageManager;

if (typeof packageManager !== "string") {
  fail("package.json is missing 'packageManager'.");
}

const packageManagerMatch = /^pnpm@(.+)$/.exec(packageManager);
if (!packageManagerMatch) {
  fail(`packageManager must be in 'pnpm@x.y.z' format, got '${packageManager}'.`);
}

const packageManagerPnpmVersion = packageManagerMatch[1];
const engines = packageJson.engines ?? {};
const enginePnpmVersion = engines.pnpm;

if (typeof enginePnpmVersion !== "string") {
  fail("package.json is missing 'engines.pnpm'.");
}

if (enginePnpmVersion !== packageManagerPnpmVersion) {
  fail(
    `Version drift detected: packageManager='${packageManagerPnpmVersion}' but engines.pnpm='${enginePnpmVersion}'.`
  );
}

const ciWorkflow = fs.readFileSync(ciWorkflowPath, "utf8");
const ciPnpmMatch = ciWorkflow.match(
  /- name:\s*Setup pnpm[\s\S]*?uses:\s*pnpm\/action-setup@v\d+[\s\S]*?version:\s*["']?([^\s"']+)["']?/
);

if (!ciPnpmMatch) {
  fail("Unable to find pnpm version in .github/workflows/ci.yml setup step.");
}

const ciPnpmVersion = ciPnpmMatch[1];
if (ciPnpmVersion !== packageManagerPnpmVersion) {
  fail(
    `Version drift detected: CI uses '${ciPnpmVersion}' but packageManager uses '${packageManagerPnpmVersion}'.`
  );
}

console.log(
  `[toolchain] pnpm version is consistent across packageManager, engines and CI: ${packageManagerPnpmVersion}`
);
