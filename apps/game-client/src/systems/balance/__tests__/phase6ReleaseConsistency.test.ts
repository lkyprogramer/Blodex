import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPhase6EvidencePack } from "../Phase6EvidencePack";
import {
  checkPhase6ReleaseConsistency,
  extractMarkdownTableRowById
} from "../Phase6ReleaseConsistency";
import {
  getPhase6ReleaseArtifact,
  listPhase6ReleaseArtifacts
} from "../Phase6ReleaseArtifactIndex";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../../..");
const tempDirs: string[] = [];

function copyPresentArtifactsToTempRepo(): string {
  const tempRepoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase6-release-consistency-"));
  tempDirs.push(tempRepoRoot);

  for (const artifact of listPhase6ReleaseArtifacts()) {
    if (artifact.availability !== "present") {
      continue;
    }
    const sourcePath = path.join(REPO_ROOT, artifact.path);
    const targetPath = path.join(tempRepoRoot, artifact.path);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }

  return tempRepoRoot;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("phase6 release consistency", () => {
  it("keeps release docs, artifact paths, and derived evidence outputs aligned", () => {
    const pack = createPhase6EvidencePack(18);
    const result = checkPhase6ReleaseConsistency(pack);

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  }, 20_000);

  it("parses regression matrix rows by id", () => {
    const markdown = [
      "| 场景 ID | 场景 | 自动化/手动 | 结果 | 证据 |",
      "|---|---|---|---|---|",
      "| S6-01 | Normal story run | 自动化 | Pass | docs/a.md |",
      "| S6-02 | Hard story run | 自动化 | Pending | docs/b.md |"
    ].join("\n");

    expect(extractMarkdownTableRowById(markdown, "S6-02")).toEqual([
      "S6-02",
      "Hard story run",
      "自动化",
      "Pending",
      "docs/b.md"
    ]);
  });

  it("reports regression matrix status mismatch against the exact row", () => {
    const pack = createPhase6EvidencePack(18);
    const tempRepoRoot = copyPresentArtifactsToTempRepo();
    const regressionMatrixPath = getPhase6ReleaseArtifact("phase6-regression-matrix-doc")?.path;
    expect(regressionMatrixPath).toBeDefined();

    const absoluteMatrixPath = path.join(tempRepoRoot, regressionMatrixPath!);
    const original = fs.readFileSync(absoluteMatrixPath, "utf8");
    const mutated = original.replace(
      /^\|\s*S6-02\s*\|([^\n]*?)\|\s*Pass\s*\|/m,
      "| S6-02 | Hard story run | 自动化 | Pending |"
    );
    expect(mutated).not.toBe(original);
    fs.writeFileSync(absoluteMatrixPath, mutated, "utf8");

    const result = checkPhase6ReleaseConsistency(pack, tempRepoRoot);

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("regression_matrix_status_mismatch:S6-02:Pending!=Pass")
      ])
    );
  });

  it("reports missing present artifacts without throwing", () => {
    const pack = createPhase6EvidencePack(18);
    const tempRepoRoot = copyPresentArtifactsToTempRepo();
    const releaseReadinessPath = getPhase6ReleaseArtifact("phase6-release-readiness-doc")?.path;
    expect(releaseReadinessPath).toBeDefined();

    fs.rmSync(path.join(tempRepoRoot, releaseReadinessPath!), { force: true });

    const result = checkPhase6ReleaseConsistency(pack, tempRepoRoot);

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining(["artifact_missing:phase6-release-readiness-doc"])
    );
  });
});
