import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const srcRoot = path.resolve(projectRoot, "src");
const stylesRoot = path.resolve(srcRoot, "styles");
const mainTsPath = path.resolve(srcRoot, "main.ts");
const legacyStylePath = path.resolve(srcRoot, "style.css");

const EXPECTED_STYLE_FILES = [
  "tokens.css",
  "base.css",
  "layout.css",
  "hud.css",
  "components.css",
  "overlays.css",
  "meta-menu.css",
  "responsive.css",
  "animations.css"
] as const;

const ALLOWED_ID_SELECTORS = new Set([
  "app",
  "boss-bar",
  "death-overlay",
  "equipment-compare-overlay",
  "event-panel",
  "game-root",
  "heartbeat-toast-layer",
  "hud-critical",
  "hud-panel",
  "language-gate",
  "log",
  "meta-menu",
  "minimap",
  "run-summary-overlay",
  "scene-transition-overlay",
  "skillbar",
  "stats"
]);

const ALLOWED_PX_VALUES = new Set([
  "0",
  "0.2",
  "0.3",
  "0.35",
  "0.4",
  "0.45",
  "0.5",
  "0.8",
  "1",
  "1.5",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "18",
  "20",
  "22",
  "24",
  "26",
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
  "42",
  "46",
  "48",
  "60",
  "74",
  "76",
  "160",
  "170",
  "190",
  "200",
  "210",
  "220",
  "240",
  "280",
  "320",
  "340",
  "420",
  "440",
  "460",
  "520",
  "620",
  "640",
  "980",
  "999",
  "1100",
  "1400"
]);

const violations: string[] = [];

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function toRelative(filePath: string): string {
  return path.relative(projectRoot, filePath);
}

function checkStyleFiles(): void {
  if (fs.existsSync(legacyStylePath)) {
    violations.push(`Legacy stylesheet must be removed: ${toRelative(legacyStylePath)}`);
  }

  if (!fs.existsSync(stylesRoot)) {
    violations.push(`Missing styles directory: ${toRelative(stylesRoot)}`);
    return;
  }

  const actualFiles = fs
    .readdirSync(stylesRoot)
    .filter((file) => file.endsWith(".css"))
    .sort((a, b) => a.localeCompare(b));

  const expectedSet = new Set(EXPECTED_STYLE_FILES);
  const actualSet = new Set(actualFiles);

  for (const expected of EXPECTED_STYLE_FILES) {
    if (!actualSet.has(expected)) {
      violations.push(`Missing style module: src/styles/${expected}`);
    }
  }

  for (const actual of actualFiles) {
    if (!expectedSet.has(actual)) {
      violations.push(`Unexpected style module: src/styles/${actual}`);
    }
  }
}

function checkStyleImportOrder(): void {
  const source = fs.readFileSync(mainTsPath, "utf8");
  const imports: string[] = [];
  const importPattern = /import\s+["']\.\/styles\/([^"']+\.css)["'];/g;
  for (const match of source.matchAll(importPattern)) {
    const importedFile = match[1];
    if (importedFile !== undefined) {
      imports.push(importedFile);
    }
  }

  const expected = [...EXPECTED_STYLE_FILES];
  if (imports.length !== expected.length || imports.some((value, index) => value !== expected[index])) {
    violations.push(
      [
        "Invalid CSS import order in src/main.ts",
        `expected: ${expected.join(", ")}`,
        `actual: ${imports.join(", ") || "<none>"}`
      ].join(" | ")
    );
  }
}

function checkIdSelectors(filePath: string, source: string): void {
  const sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectorChunkPattern = /([^{}]+)\{/g;

  for (const match of sourceWithoutComments.matchAll(selectorChunkPattern)) {
    const rawSelector = match[1]?.trim() ?? "";
    if (rawSelector.length === 0 || rawSelector.startsWith("@")) {
      continue;
    }

    const normalized = rawSelector.replace(/\s+/g, " ").trim();
    if (normalized === "from" || normalized === "to" || /^[0-9.]+%$/.test(normalized)) {
      continue;
    }

    const idPattern = /#([A-Za-z][A-Za-z0-9_-]*)/g;
    for (const idMatch of rawSelector.matchAll(idPattern)) {
      const id = idMatch[1];
      if (id === undefined || ALLOWED_ID_SELECTORS.has(id)) {
        continue;
      }
      const selectorIndex = match.index ?? 0;
      const idIndex = idMatch.index ?? 0;
      const line = lineOf(sourceWithoutComments, selectorIndex + idIndex);
      violations.push(`${toRelative(filePath)}:${line} disallowed ID selector #${id}`);
    }
  }
}

function checkMagicNumbers(filePath: string, source: string): void {
  const pxPattern = /\b(\d+(?:\.\d+)?)px\b/g;
  for (const match of source.matchAll(pxPattern)) {
    const value = match[1];
    if (value === undefined || ALLOWED_PX_VALUES.has(value)) {
      continue;
    }
    const line = lineOf(source, match.index ?? 0);
    violations.push(`${toRelative(filePath)}:${line} new px literal '${value}px' is not in allowlist`);
  }
}

function checkStyleRules(): void {
  for (const fileName of EXPECTED_STYLE_FILES) {
    const filePath = path.resolve(stylesRoot, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    checkIdSelectors(filePath, source);
    checkMagicNumbers(filePath, source);
  }
}

checkStyleFiles();
checkStyleImportOrder();
checkStyleRules();

if (violations.length > 0) {
  console.error("[css] architecture checks failed:");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log("[css] architecture checks passed.");
}
