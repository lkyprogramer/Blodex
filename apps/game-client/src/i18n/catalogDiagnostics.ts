import fs from "node:fs";
import path from "node:path";

const KEY_LITERAL_PATTERN = /["'`](ui|log)\.[A-Za-z0-9_.-]+["'`]/g;
const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;
const CATALOG_ENTRY_PATTERN =
  /(["'`])((?:ui|log)\.[A-Za-z0-9_.-]+)\1\s*:\s*(["'`])((?:\\.|(?!\3)[\s\S])*)\3/g;

function shouldScanFile(filePath: string): boolean {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
    return false;
  }
  if (filePath.includes("/i18n/catalog/")) {
    return false;
  }
  if (filePath.includes("/__tests__/")) {
    return false;
  }
  if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
    return false;
  }
  return true;
}

function walkFiles(rootDir: string, acc: string[]): void {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }
    if (shouldScanFile(fullPath)) {
      acc.push(fullPath);
    }
  }
}

export function collectSourceI18nKeys(rootDir: string): Set<string> {
  const files: string[] = [];
  walkFiles(rootDir, files);

  const keys = new Set<string>();
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(KEY_LITERAL_PATTERN)) {
      const literal = match[0];
      keys.add(literal.slice(1, -1));
    }
  }
  return keys;
}

export function extractCatalogMessages(source: string): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const match of source.matchAll(CATALOG_ENTRY_PATTERN)) {
    const key = match[2];
    const value = match[4];
    if (key === undefined || value === undefined) {
      continue;
    }
    messages[key] = value;
  }
  return messages;
}

export function readCatalogMessages(filePath: string): Record<string, string> {
  return extractCatalogMessages(fs.readFileSync(filePath, "utf8"));
}

export function checkCatalogCompleteness(
  sourceKeys: Set<string>,
  catalogMessages: Readonly<Record<string, string>>,
  options?: {
    ignoredUnusedPrefixes?: readonly string[];
  }
): {
  missingKeys: string[];
  unusedKeys: string[];
} {
  const catalogKeys = new Set(Object.keys(catalogMessages));
  const missingKeys = [...sourceKeys].filter((key) => !catalogKeys.has(key)).sort((a, b) => a.localeCompare(b));

  const ignoredUnusedPrefixes = options?.ignoredUnusedPrefixes ?? ["content."];
  const unusedKeys = [...catalogKeys]
    .filter((key) => {
      if (sourceKeys.has(key)) {
        return false;
      }
      return !ignoredUnusedPrefixes.some((prefix) => key.startsWith(prefix));
    })
    .sort((a, b) => a.localeCompare(b));

  return {
    missingKeys,
    unusedKeys
  };
}

function placeholdersOf(message: string): string[] {
  const values = new Set<string>();
  for (const match of message.matchAll(PLACEHOLDER_PATTERN)) {
    const placeholder = match[1];
    if (placeholder !== undefined) {
      values.add(placeholder);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

export function checkPlaceholderConsistency(
  baseMessages: Readonly<Record<string, string>>,
  targetMessages: Readonly<Record<string, string>>,
  targetLocale: string
): Array<{
  key: string;
  targetLocale: string;
  basePlaceholders: string[];
  targetPlaceholders: string[];
}> {
  const issues: Array<{
    key: string;
    targetLocale: string;
    basePlaceholders: string[];
    targetPlaceholders: string[];
  }> = [];

  for (const [key, message] of Object.entries(targetMessages)) {
    const baseMessage = baseMessages[key];
    if (baseMessage === undefined) {
      continue;
    }
    const basePlaceholders = placeholdersOf(baseMessage);
    const targetPlaceholders = placeholdersOf(message);
    if (!sameValues(basePlaceholders, targetPlaceholders)) {
      issues.push({
        key,
        targetLocale,
        basePlaceholders,
        targetPlaceholders
      });
    }
  }

  return issues.sort((a, b) => a.key.localeCompare(b.key));
}
