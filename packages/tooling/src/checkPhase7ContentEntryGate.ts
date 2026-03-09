import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

interface Phase7AssetGateEntry {
  id: string;
  category: string;
  gemini_key_required: boolean;
  generation_status: string;
  placeholder_allowed?: boolean;
  runtime_binding?: {
    binding_mode: "generated_manifest_entry" | "placeholder_binding";
    manifest_entry_id?: string;
    placeholder_manifest_entry_id?: string;
    placeholder_surface: string;
  };
}

interface Phase7AssetGateStage {
  description: string;
  assets: Phase7AssetGateEntry[];
}

interface Phase7AssetPlanGateMetadata {
  art_style_bible: string;
  minimum_ship_set: Record<string, Phase7AssetGateStage>;
  optional_enhancement_set: Record<string, Phase7AssetGateStage>;
  placeholder_policy: {
    gameplay_validation_with_placeholders: boolean;
    require_manifest_entry_before_runtime_binding: boolean;
    generated_art_requires_gemini_key: boolean;
    generated_art_default_label: string;
    direct_generation_forbidden_without_gemini_key: boolean;
  };
}

interface AssetPlanDocument {
  styleTag: string;
  phase7_content_gate?: Phase7AssetPlanGateMetadata;
}

interface Phase7AudioGateEntry {
  id: string;
  category: string;
  event_key: string;
  implementation_status: string;
  runtime_binding?: {
    binding_mode: "generated_audio_manifest_entry" | "placeholder_binding";
    audio_manifest_entry_id?: string;
    placeholder_audio_manifest_entry_id?: string;
    placeholder_surface: string;
  };
}

interface Phase7AudioGateStage {
  description: string;
  cues: Phase7AudioGateEntry[];
}

interface Phase7AudioPlanGateMetadata {
  naming_policy: {
    id_pattern: string;
    event_key_pattern: string;
    output_name_pattern: string;
  };
  minimum_ship_set: Record<string, Phase7AudioGateStage>;
  optional_enhancement_set: Record<string, Phase7AudioGateStage>;
}

interface AudioPlanDocument {
  phase7_content_gate?: Phase7AudioPlanGateMetadata;
}

interface Phase7ContentEntryGateResult {
  passed: boolean;
  violations: string[];
}

interface GeneratedManifestEntry {
  id: string;
  category: string;
}

interface GeneratedAudioManifestEntry {
  id: string;
  category: string;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../..");

const PHASE7_STAGE_IDS = ["7.4", "7.5", "7.6", "7.7", "7.8"] as const;

const PHASE7_STAGE_DOC_REQUIREMENTS = [
  {
    id: "7.0A",
    path: "docs/plans/phase7/2026-03-07-phase7-7.0a-scene-shell-ui-shell-and-meta-shell-reconstruction.md",
    requiredPhrases: ["Development Complete", "Automation Pass", "Browser Smoke Pass"]
  },
  {
    id: "7.0B",
    path: "docs/plans/phase7/2026-03-07-phase7-7.0b-runsavev3-and-restore-pipeline-rebuild.md",
    requiredPhrases: ["Development Complete", "Automation Pass", "Browser Smoke Pass"]
  },
  {
    id: "7.0C",
    path: "docs/plans/phase7/2026-03-07-phase7-7.0c-evidence-registry-and-release-closure-infrastructure.md",
    requiredPhrases: ["Development Complete", "Automation Pass", "Ready for 7.1 input"]
  },
  {
    id: "7.1",
    path: "docs/plans/phase7/2026-03-07-phase7-7.1-phase6-final-signoff-closure.md",
    requiredPhrases: ["Development Complete", "Automation Pass", "Manual Sign-off Pass"]
  }
] as const;

const PHASE7_7_0A_TARGET_FILES = [
  "apps/game-client/src/scenes/DungeonScene.ts",
  "apps/game-client/src/scenes/MetaMenuScene.ts",
  "apps/game-client/src/ui/Hud.ts",
  "apps/game-client/src/ui/hud/HudContainer.ts"
] as const;

const PHASE7_7_0A_MAX_LINES: Record<(typeof PHASE7_7_0A_TARGET_FILES)[number], number> = {
  "apps/game-client/src/scenes/DungeonScene.ts": 1532,
  "apps/game-client/src/scenes/MetaMenuScene.ts": 650,
  "apps/game-client/src/ui/Hud.ts": 300,
  "apps/game-client/src/ui/hud/HudContainer.ts": 450
};

const ASSET_PLACEHOLDER_CATEGORY_ALLOWLIST: Record<string, readonly string[]> = {
  node_marker: ["ui_icon", "tile"],
  ui_badge: ["ui_icon", "item_icon"],
  fx_sheet: ["fx"],
  boss_sprite: ["boss_sprite"],
  boss_portrait: ["boss_sprite", "ui_icon"],
  item_icon: ["item_icon"],
  ui_icon: ["ui_icon", "item_icon"],
  ui_banner: ["ui_icon"],
  minimap_marker: ["ui_icon", "tile"],
  ui_frame: ["ui_icon"],
  boss_variant: ["boss_sprite"],
  portrait: ["boss_sprite", "ui_icon"],
  ui_card: ["ui_icon"],
  ui_panel: ["ui_icon"]
};

const AUDIO_PLACEHOLDER_CATEGORY_ALLOWLIST: Record<string, readonly string[]> = {
  ui: ["ui"],
  sfx: ["sfx"],
  amb: ["amb"]
};

function readText(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function parseAssetPlan(): AssetPlanDocument {
  return parse(readText("assets/source-prompts/asset-plan.yaml")) as AssetPlanDocument;
}

function parseAudioPlan(): AudioPlanDocument {
  return parse(readText("assets/source-prompts/audio-plan.yaml")) as AudioPlanDocument;
}

function parseGeneratedManifestEntries(): Map<string, GeneratedManifestEntry> {
  const entries = JSON.parse(readText("assets/generated/manifest.json")) as GeneratedManifestEntry[];
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function parseGeneratedAudioManifestEntries(): Map<string, GeneratedAudioManifestEntry> {
  const entries = JSON.parse(readText("assets/generated/audio-manifest.json")) as GeneratedAudioManifestEntry[];
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function assertDocContains(
  violations: string[],
  docId: string,
  relativePath: string,
  requiredPhrases: readonly string[]
): void {
  const content = readText(relativePath);
  for (const phrase of requiredPhrases) {
    if (!content.includes(phrase)) {
      violations.push(`missing_stage_phrase:${docId}:${phrase}`);
    }
  }
}

function assertSignedReleaseReadiness(violations: string[]): void {
  const content = readText("docs/plans/phase6/release/2026-03-06-phase6-release-readiness.md");
  if (!content.includes("**状态**: `Signed`")) {
    violations.push("phase6_release_readiness_not_signed");
  }
}

function extractMarkdownTableRows(content: string): string[][] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    )
    .filter((cells) => cells.length >= 4 && cells[0] !== "场景 ID" && cells[0] !== "---");
}

function assertRegressionMatrixFullyPassed(violations: string[]): void {
  const content = readText("docs/plans/phase6/release/2026-03-06-phase6-regression-matrix.md");
  const rows = extractMarkdownTableRows(content).filter((cells) => /^S6-0[1-7]$/.test(cells[0] ?? ""));
  for (const stageId of ["S6-01", "S6-02", "S6-03", "S6-04", "S6-05", "S6-06", "S6-07"]) {
    const row = rows.find((cells) => cells[0] === stageId);
    if (row === undefined) {
      violations.push(`phase6_regression_matrix_missing_row:${stageId}`);
      continue;
    }
    if (row[3] !== "Pass") {
      violations.push(`phase6_regression_matrix_not_pass:${stageId}:${row[3] ?? "unknown"}`);
    }
  }
}

function extractDebtCeilingFunctionBody(script: string, functionName: string): string {
  const marker = `${functionName}() {`;
  const start = script.indexOf(marker);
  if (start < 0) {
    return "";
  }
  const rest = script.slice(start + marker.length);
  const end = rest.indexOf("\n}");
  return end < 0 ? rest : rest.slice(0, end);
}

function assertNoCoreDebtCeiling(violations: string[]): void {
  const script = readText("scripts/check-architecture-budgets.sh");
  const linesBody = extractDebtCeilingFunctionBody(script, "resolve_debt_ceiling_lines");
  const methodsBody = extractDebtCeilingFunctionBody(script, "resolve_debt_ceiling_methods");
  for (const filePath of PHASE7_7_0A_TARGET_FILES) {
    if (linesBody.includes(filePath)) {
      violations.push(`architecture_budget_debt_ceiling_lines_present:${filePath}`);
    }
    if (methodsBody.includes(filePath)) {
      violations.push(`architecture_budget_debt_ceiling_methods_present:${filePath}`);
    }
  }
}

function assert7_0AClosureBaseline(violations: string[]): void {
  for (const [relativePath, maxLines] of Object.entries(PHASE7_7_0A_MAX_LINES) as Array<
    [keyof typeof PHASE7_7_0A_MAX_LINES, number]
  >) {
    const lineCount = readText(relativePath).split("\n").length;
    if (lineCount > maxLines) {
      violations.push(`phase7_7_0A_line_budget_exceeded:${relativePath}:${lineCount}>${maxLines}`);
    }
  }
}

function assertArtStyleBinding(violations: string[], assetPlan: AssetPlanDocument): void {
  const gate = assetPlan.phase7_content_gate;
  if (gate === undefined) {
    violations.push("asset_plan_missing_phase7_content_gate");
    return;
  }
  const artBiblePath = resolve(ROOT, gate.art_style_bible);
  if (!existsSync(artBiblePath)) {
    violations.push(`art_style_bible_missing:${gate.art_style_bible}`);
    return;
  }
  const artBible = readFileSync(artBiblePath, "utf8");
  const styleTagMatch = artBible.match(/`([^`]+)`/);
  const expectedStyleTag = styleTagMatch?.[1];
  if (expectedStyleTag === undefined) {
    violations.push("art_style_bible_style_tag_missing");
    return;
  }
  if (assetPlan.styleTag !== expectedStyleTag) {
    violations.push(`asset_plan_style_tag_mismatch:${assetPlan.styleTag}!=${expectedStyleTag}`);
  }
}

function assertAssetGateMetadata(
  violations: string[],
  assetPlan: AssetPlanDocument,
  generatedManifestEntries: ReadonlyMap<string, GeneratedManifestEntry>
): void {
  const gate = assetPlan.phase7_content_gate;
  if (gate === undefined) {
    violations.push("asset_plan_missing_phase7_content_gate");
    return;
  }
  const placeholderPolicy = gate.placeholder_policy;
  if (
    placeholderPolicy.gameplay_validation_with_placeholders !== true ||
    placeholderPolicy.require_manifest_entry_before_runtime_binding !== true ||
    placeholderPolicy.generated_art_requires_gemini_key !== true ||
    placeholderPolicy.direct_generation_forbidden_without_gemini_key !== true ||
    placeholderPolicy.generated_art_default_label !== "Gemini Key Required"
  ) {
    violations.push("asset_plan_placeholder_policy_incomplete");
  }
  for (const stageId of PHASE7_STAGE_IDS) {
    const minimumStage = gate.minimum_ship_set[stageId];
    const optionalStage = gate.optional_enhancement_set[stageId];
    if (minimumStage === undefined || minimumStage.assets.length === 0) {
      violations.push(`asset_plan_missing_minimum_ship_set:${stageId}`);
      continue;
    }
    if (optionalStage === undefined || optionalStage.assets.length === 0) {
      violations.push(`asset_plan_missing_optional_enhancement_set:${stageId}`);
    }
    for (const entry of [...minimumStage.assets, ...(optionalStage?.assets ?? [])]) {
      if (entry.gemini_key_required !== true) {
        violations.push(`asset_plan_missing_gemini_key_flag:${stageId}:${entry.id}`);
      }
      if (entry.generation_status !== "prompt_frozen" && entry.generation_status !== "generated") {
        violations.push(`asset_plan_generation_status_invalid:${stageId}:${entry.id}:${entry.generation_status}`);
      }
      if (entry.runtime_binding === undefined) {
        violations.push(`asset_plan_missing_runtime_binding:${stageId}:${entry.id}`);
        continue;
      }
      if (!entry.runtime_binding.placeholder_surface) {
        violations.push(`asset_plan_runtime_binding_surface_missing:${stageId}:${entry.id}`);
      }
      if (entry.runtime_binding.binding_mode === "generated_manifest_entry") {
        const manifestEntryId = entry.runtime_binding.manifest_entry_id;
        if (!manifestEntryId) {
          violations.push(`asset_plan_runtime_binding_manifest_id_missing:${stageId}:${entry.id}`);
          continue;
        }
        const manifestEntry = generatedManifestEntries.get(manifestEntryId);
        if (manifestEntry === undefined) {
          violations.push(`asset_plan_runtime_binding_manifest_missing:${stageId}:${entry.id}:${manifestEntryId}`);
          continue;
        }
        if (manifestEntry.category !== entry.category) {
          violations.push(
            `asset_plan_runtime_binding_category_incompatible:${stageId}:${entry.id}:${manifestEntry.category}`
          );
        }
        if (entry.generation_status !== "generated") {
          violations.push(`asset_plan_generated_binding_status_mismatch:${stageId}:${entry.id}`);
        }
      }
      if (entry.runtime_binding.binding_mode === "placeholder_binding") {
        const placeholderId = entry.runtime_binding.placeholder_manifest_entry_id;
        if (!placeholderId) {
          violations.push(`asset_plan_placeholder_binding_missing:${stageId}:${entry.id}`);
          continue;
        }
        const placeholderEntry = generatedManifestEntries.get(placeholderId);
        if (placeholderEntry === undefined) {
          violations.push(`asset_plan_placeholder_manifest_missing:${stageId}:${entry.id}:${placeholderId}`);
          continue;
        }
        const allowedCategories = ASSET_PLACEHOLDER_CATEGORY_ALLOWLIST[entry.category];
        if (allowedCategories === undefined) {
          violations.push(`asset_plan_placeholder_category_unmapped:${stageId}:${entry.id}:${entry.category}`);
          continue;
        }
        if (!allowedCategories.includes(placeholderEntry.category)) {
          violations.push(
            `asset_plan_placeholder_category_incompatible:${stageId}:${entry.id}:${placeholderEntry.category}`
          );
        }
        if (entry.generation_status === "generated") {
          violations.push(`asset_plan_placeholder_generated_status_mismatch:${stageId}:${entry.id}`);
        }
      }
    }
  }
}

function assertAudioGateMetadata(
  violations: string[],
  audioPlan: AudioPlanDocument,
  generatedAudioManifestEntries: ReadonlyMap<string, GeneratedAudioManifestEntry>
): void {
  const gate = audioPlan.phase7_content_gate;
  if (gate === undefined) {
    violations.push("audio_plan_missing_phase7_content_gate");
    return;
  }
  const naming = gate.naming_policy;
  if (!naming.id_pattern || !naming.event_key_pattern || !naming.output_name_pattern) {
    violations.push("audio_plan_naming_policy_incomplete");
  }
  for (const stageId of PHASE7_STAGE_IDS) {
    const minimumStage = gate.minimum_ship_set[stageId];
    const optionalStage = gate.optional_enhancement_set[stageId];
    if (minimumStage === undefined || minimumStage.cues.length === 0) {
      violations.push(`audio_plan_missing_minimum_ship_set:${stageId}`);
      continue;
    }
    if (optionalStage === undefined || optionalStage.cues.length === 0) {
      violations.push(`audio_plan_missing_optional_enhancement_set:${stageId}`);
    }
    for (const cue of [...minimumStage.cues, ...(optionalStage?.cues ?? [])]) {
      if (!cue.id || !cue.event_key || !cue.implementation_status) {
        violations.push(`audio_plan_incomplete_cue:${stageId}:${cue.id || "unknown"}`);
      }
      if (cue.runtime_binding === undefined) {
        violations.push(`audio_plan_missing_runtime_binding:${stageId}:${cue.id}`);
        continue;
      }
      if (!cue.runtime_binding.placeholder_surface) {
        violations.push(`audio_plan_runtime_binding_surface_missing:${stageId}:${cue.id}`);
      }
      if (cue.runtime_binding.binding_mode === "generated_audio_manifest_entry") {
        const manifestEntryId = cue.runtime_binding.audio_manifest_entry_id;
        if (!manifestEntryId) {
          violations.push(`audio_plan_runtime_binding_manifest_id_missing:${stageId}:${cue.id}`);
          continue;
        }
        const manifestEntry = generatedAudioManifestEntries.get(manifestEntryId);
        if (manifestEntry === undefined) {
          violations.push(`audio_plan_runtime_binding_manifest_missing:${stageId}:${cue.id}:${manifestEntryId}`);
          continue;
        }
        const allowedCategories = AUDIO_PLACEHOLDER_CATEGORY_ALLOWLIST[cue.category];
        if (allowedCategories !== undefined && !allowedCategories.includes(manifestEntry.category)) {
          violations.push(
            `audio_plan_runtime_binding_category_incompatible:${stageId}:${cue.id}:${manifestEntry.category}`
          );
        }
      }
      if (cue.runtime_binding.binding_mode === "placeholder_binding") {
        const placeholderId = cue.runtime_binding.placeholder_audio_manifest_entry_id;
        if (!placeholderId) {
          violations.push(`audio_plan_placeholder_binding_missing:${stageId}:${cue.id}`);
          continue;
        }
        const placeholderEntry = generatedAudioManifestEntries.get(placeholderId);
        if (placeholderEntry === undefined) {
          violations.push(`audio_plan_placeholder_manifest_missing:${stageId}:${cue.id}:${placeholderId}`);
          continue;
        }
        const allowedCategories = AUDIO_PLACEHOLDER_CATEGORY_ALLOWLIST[cue.category];
        if (allowedCategories === undefined) {
          violations.push(`audio_plan_placeholder_category_unmapped:${stageId}:${cue.id}:${cue.category}`);
          continue;
        }
        if (!allowedCategories.includes(placeholderEntry.category)) {
          violations.push(
            `audio_plan_placeholder_category_incompatible:${stageId}:${cue.id}:${placeholderEntry.category}`
          );
        }
      }
    }
  }
}

function runCommand(command: string, violations: string[], violationId: string): void {
  try {
    execSync(command, {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf8"
    });
  } catch (error) {
    const detail =
      error instanceof Error && "stdout" in error
        ? String((error as { stdout?: string }).stdout ?? "")
        : "";
    violations.push(`${violationId}${detail ? `:${detail.trim().slice(0, 160)}` : ""}`);
  }
}

export function checkPhase7ContentExpansionEntryGate(): Phase7ContentEntryGateResult {
  const violations: string[] = [];
  const assetPlan = parseAssetPlan();
  const audioPlan = parseAudioPlan();
  const generatedManifestEntries = parseGeneratedManifestEntries();
  const generatedAudioManifestEntries = parseGeneratedAudioManifestEntries();

  runCommand("pnpm check:architecture-budget", violations, "architecture_budget_failed");
  runCommand("pnpm phase6:evidence:check", violations, "phase6_evidence_check_failed");

  assertNoCoreDebtCeiling(violations);
  assert7_0AClosureBaseline(violations);
  assertSignedReleaseReadiness(violations);
  assertRegressionMatrixFullyPassed(violations);
  assertArtStyleBinding(violations, assetPlan);
  assertAssetGateMetadata(violations, assetPlan, generatedManifestEntries);
  assertAudioGateMetadata(violations, audioPlan, generatedAudioManifestEntries);

  for (const requirement of PHASE7_STAGE_DOC_REQUIREMENTS) {
    assertDocContains(violations, requirement.id, requirement.path, requirement.requiredPhrases);
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

function main(): void {
  const result = checkPhase7ContentExpansionEntryGate();
  if (!result.passed) {
    process.stderr.write("[phase7-content-gate] violations detected:\n");
    for (const violation of result.violations) {
      process.stderr.write(` - ${violation}\n`);
    }
    process.exit(1);
  }
  process.stdout.write("[phase7-content-gate] checks passed.\n");
}

main();
