import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase6EvidencePack } from "./Phase6EvidencePack";
import { getPhase6ReleaseArtifact } from "./Phase6ReleaseArtifactIndex";

export interface Phase6ReleaseConsistencyResult {
  passed: boolean;
  violations: string[];
}

function resolveRepoRoot(): string {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(dirname, "../../../../../");
}

function readArtifactFile(repoRoot: string, artifactId: string): string {
  const artifact = getPhase6ReleaseArtifact(artifactId);
  if (artifact === undefined) {
    throw new Error(`Unknown phase6 release artifact: ${artifactId}`);
  }
  const absolutePath = path.join(repoRoot, artifact.path);
  return fs.readFileSync(absolutePath, "utf8");
}

function documentIncludesArtifactReference(content: string, artifactPath: string): boolean {
  return content.includes(artifactPath) || content.includes(path.basename(artifactPath));
}

export function extractMarkdownTableRowById(
  content: string,
  rowId: string
): string[] | undefined {
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
    .find((cells) => cells[0] === rowId);
}

export function checkPhase6ReleaseConsistency(
  pack: Phase6EvidencePack,
  repoRoot = resolveRepoRoot()
): Phase6ReleaseConsistencyResult {
  const violations: string[] = [];

  for (const artifact of pack.releaseArtifactIndex) {
    if (artifact.availability !== "present") {
      continue;
    }
    const absolutePath = path.join(repoRoot, artifact.path);
    if (!fs.existsSync(absolutePath)) {
      violations.push(`artifact_missing:${artifact.id}`);
    }
  }

  const releaseReadiness = readArtifactFile(repoRoot, "phase6-release-readiness-doc");
  for (const artifactId of [
    "phase6-browser-smoke-report-doc",
    "phase6-regression-matrix-doc",
    "phase6-taste-signoff-doc"
  ]) {
    const artifact = getPhase6ReleaseArtifact(artifactId);
    if (artifact !== undefined && !documentIncludesArtifactReference(releaseReadiness, artifact.path)) {
      violations.push(`release_readiness_missing_ref:${artifactId}`);
    }
  }

  const regressionMatrix = readArtifactFile(repoRoot, "phase6-regression-matrix-doc");
  for (const row of pack.smokeMatrix) {
    const status = row.status === "pass" ? "Pass" : row.status === "fail" ? "Fail" : "Pending";
    const matrixRow = extractMarkdownTableRowById(regressionMatrix, row.id);
    if (matrixRow === undefined) {
      violations.push(`regression_matrix_missing_row:${row.id}`);
      continue;
    }
    if (matrixRow[3] !== status) {
      violations.push(`regression_matrix_status_mismatch:${row.id}:${matrixRow[3] ?? "unknown"}!=${status}`);
    }
  }

  const tasteSignoff = readArtifactFile(repoRoot, "phase6-taste-signoff-doc");
  for (const artifactId of [
    "phase6-browser-smoke-report-doc",
    "phase6-regression-matrix-doc"
  ]) {
    const artifact = getPhase6ReleaseArtifact(artifactId);
    if (artifact !== undefined && !documentIncludesArtifactReference(tasteSignoff, artifact.path)) {
      violations.push(`taste_signoff_missing_ref:${artifactId}`);
    }
  }

  const browserSmoke = readArtifactFile(repoRoot, "phase6-browser-smoke-report-doc");
  for (const artifactId of [
    "phase6-browser-smoke-skill-choice-shot",
    "phase6-browser-smoke-build-formed-shot",
    "phase6-browser-smoke-compare-prompt-shot",
    "phase6-browser-smoke-boss-reward-compare-shot"
  ]) {
    const artifact = getPhase6ReleaseArtifact(artifactId);
    if (artifact !== undefined) {
      const relativePath = `./assets/browser-smoke/${path.basename(artifact.path)}`;
      if (!browserSmoke.includes(relativePath)) {
        violations.push(`browser_smoke_missing_asset_ref:${artifactId}`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations
  };
}
