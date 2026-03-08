import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  listPhase6ReleaseArtifacts,
  type Phase6ReleaseArtifactEntry
} from "../Phase6ReleaseArtifactIndex";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../../..");

describe("phase6 release artifact index", () => {
  it("indexes present artifacts to real files and keeps pending artifacts explicit", () => {
    const artifacts = listPhase6ReleaseArtifacts();
    const presentArtifacts = artifacts.filter((artifact) => artifact.availability === "present");
    const pendingArtifacts = artifacts.filter((artifact) => artifact.availability === "pending");

    expect(presentArtifacts.length).toBeGreaterThanOrEqual(10);
    expect(pendingArtifacts.map((artifact) => artifact.id)).toEqual(
      expect.arrayContaining(["phase6-class-parity-video", "phase6-buff-damagetype-video", "phase6-design-signoff-record"])
    );

    for (const artifact of presentArtifacts) {
      expect(fs.existsSync(path.join(REPO_ROOT, artifact.path)), artifact.id).toBe(true);
    }
  });

  it("keeps artifact ids unique", () => {
    const ids = listPhase6ReleaseArtifacts().map((artifact: Phase6ReleaseArtifactEntry) => artifact.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
