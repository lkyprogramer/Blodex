import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkCatalogCompleteness,
  checkPlaceholderConsistency,
  collectSourceI18nKeys,
  readCatalogMessages
} from "../src/i18n/catalogDiagnostics.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(scriptDir, "../src");

const enUsCatalogPath = path.resolve(srcRoot, "i18n/catalog/en-US.ts");
const zhCnCatalogPath = path.resolve(srcRoot, "i18n/catalog/zh-CN.ts");

const enUsMessages = readCatalogMessages(enUsCatalogPath);
const zhCnMessages = readCatalogMessages(zhCnCatalogPath);

const sourceKeys = collectSourceI18nKeys(srcRoot);
const completeness = checkCatalogCompleteness(sourceKeys, enUsMessages, {
  ignoredUnusedPrefixes: ["ui.common."]
});
const placeholderIssues = checkPlaceholderConsistency(enUsMessages, zhCnMessages, "zh-CN");

if (completeness.missingKeys.length > 0) {
  console.error("[i18n] Missing keys in en-US catalog:");
  for (const key of completeness.missingKeys) {
    console.error(`- ${key}`);
  }
}

if (completeness.unusedKeys.length > 0) {
  console.error("[i18n] Unused keys in en-US catalog:");
  for (const key of completeness.unusedKeys) {
    console.error(`- ${key}`);
  }
}

if (placeholderIssues.length > 0) {
  console.error("[i18n] Placeholder mismatches:");
  for (const issue of placeholderIssues) {
    console.error(
      `- ${issue.key} (${issue.targetLocale}): base=[${issue.basePlaceholders.join(","
      )}] target=[${issue.targetPlaceholders.join(",")}]`
    );
  }
}

if (
  completeness.missingKeys.length > 0 ||
  completeness.unusedKeys.length > 0 ||
  placeholderIssues.length > 0
) {
  process.exitCode = 1;
} else {
  console.log("[i18n] Catalog checks passed.");
}
