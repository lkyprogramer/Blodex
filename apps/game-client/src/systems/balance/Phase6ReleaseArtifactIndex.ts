export type Phase6ReleaseArtifactKind = "document" | "report" | "screenshot" | "video";
export type Phase6ReleaseArtifactAvailability = "present" | "pending";

export interface Phase6ReleaseArtifactEntry {
  id: string;
  kind: Phase6ReleaseArtifactKind;
  path: string;
  owner: string;
  generatedAt: string;
  availability: Phase6ReleaseArtifactAvailability;
  description: string;
}

export const PHASE6_RELEASE_ARTIFACT_INDEX: Record<string, Phase6ReleaseArtifactEntry> = {
  "phase6-performance-compare-doc": {
    id: "phase6-performance-compare-doc",
    kind: "report",
    path: "docs/plans/phase6/release/2026-03-06-phase6-performance-compare.md",
    owner: "release-engineering",
    generatedAt: "2026-03-06T00:00:00+08:00",
    availability: "present",
    description: "Phase 6 pacing 与 heuristic-vs-real balance 对照报告。"
  },
  "phase6-release-readiness-doc": {
    id: "phase6-release-readiness-doc",
    kind: "document",
    path: "docs/plans/phase6/release/2026-03-06-phase6-release-readiness.md",
    owner: "release-engineering",
    generatedAt: "2026-03-06T00:00:00+08:00",
    availability: "present",
    description: "Phase 6 最终发布 readiness 文档。"
  },
  "phase6-regression-matrix-doc": {
    id: "phase6-regression-matrix-doc",
    kind: "document",
    path: "docs/plans/phase6/release/2026-03-06-phase6-regression-matrix.md",
    owner: "qa",
    generatedAt: "2026-03-06T00:00:00+08:00",
    availability: "present",
    description: "Phase 6 阻塞 smoke matrix 与扩展回归矩阵。"
  },
  "phase6-release-notes-doc": {
    id: "phase6-release-notes-doc",
    kind: "document",
    path: "docs/plans/phase6/release/2026-03-06-phase6-release-notes.md",
    owner: "release-engineering",
    generatedAt: "2026-03-06T00:00:00+08:00",
    availability: "present",
    description: "Phase 6 用户向 release notes。"
  },
  "phase6-rollback-playbook-doc": {
    id: "phase6-rollback-playbook-doc",
    kind: "document",
    path: "docs/plans/phase6/release/2026-03-06-phase6-rollback-playbook.md",
    owner: "release-engineering",
    generatedAt: "2026-03-06T00:00:00+08:00",
    availability: "present",
    description: "Phase 6 回滚与止损操作手册。"
  },
  "phase6-taste-signoff-doc": {
    id: "phase6-taste-signoff-doc",
    kind: "document",
    path: "docs/plans/phase6/release/2026-03-06-phase6-taste-signoff.md",
    owner: "design-review",
    generatedAt: "2026-03-06T00:00:00+08:00",
    availability: "present",
    description: "Phase 6 Taste sign-off 文档。"
  },
  "phase6-browser-smoke-report-doc": {
    id: "phase6-browser-smoke-report-doc",
    kind: "report",
    path: "docs/plans/phase6/release/2026-03-07-phase6-browser-smoke-report.md",
    owner: "qa",
    generatedAt: "2026-03-07T00:00:00+08:00",
    availability: "present",
    description: "Chrome DevTools + debug cheats 的 Phase 6 浏览器烟测报告。"
  },
  "phase6-browser-smoke-skill-choice-shot": {
    id: "phase6-browser-smoke-skill-choice-shot",
    kind: "screenshot",
    path: "docs/plans/phase6/release/assets/browser-smoke/phase6-6.1-skill-choice.png",
    owner: "qa",
    generatedAt: "2026-03-07T00:00:00+08:00",
    availability: "present",
    description: "6.1 技能 3 选 1 浏览器截图。"
  },
  "phase6-browser-smoke-build-formed-shot": {
    id: "phase6-browser-smoke-build-formed-shot",
    kind: "screenshot",
    path: "docs/plans/phase6/release/assets/browser-smoke/phase6-6.3-build-formed-toast.png",
    owner: "qa",
    generatedAt: "2026-03-07T00:00:00+08:00",
    availability: "present",
    description: "6.3 build formed feedback 浏览器截图。"
  },
  "phase6-browser-smoke-compare-prompt-shot": {
    id: "phase6-browser-smoke-compare-prompt-shot",
    kind: "screenshot",
    path: "docs/plans/phase6/release/assets/browser-smoke/phase6-6.3-compare-prompt.png",
    owner: "qa",
    generatedAt: "2026-03-07T00:00:00+08:00",
    availability: "present",
    description: "6.3 equipment compare prompt 浏览器截图。"
  },
  "phase6-browser-smoke-boss-reward-compare-shot": {
    id: "phase6-browser-smoke-boss-reward-compare-shot",
    kind: "screenshot",
    path: "docs/plans/phase6/release/assets/browser-smoke/phase6-boss-reward-compare-fixed.png",
    owner: "qa",
    generatedAt: "2026-03-07T00:00:00+08:00",
    availability: "present",
    description: "6.2 boss reward compare 修复后的浏览器截图。"
  },
  "phase6-class-parity-video": {
    id: "phase6-class-parity-video",
    kind: "document",
    path: "docs/plans/phase6/release/assets/manual/phase6-class-parity.md",
    owner: "design-review",
    generatedAt: "2026-03-08T00:00:00+08:00",
    availability: "present",
    description: "warrior / ranger / arcanist 起步深度入口白盒样本与签署记录。"
  },
  "phase6-buff-damagetype-video": {
    id: "phase6-buff-damagetype-video",
    kind: "document",
    path: "docs/plans/phase6/release/assets/manual/phase6-buff-damagetype-contract.md",
    owner: "qa",
    generatedAt: "2026-03-08T00:00:00+08:00",
    availability: "present",
    description: "buff / damageType / synergy 运行时入口白盒样本与合同交叉校验。"
  },
  "phase6-design-signoff-record": {
    id: "phase6-design-signoff-record",
    kind: "document",
    path: "docs/plans/phase6/release/assets/manual/phase6-design-signoff.md",
    owner: "design-review",
    generatedAt: "2026-03-08T00:00:00+08:00",
    availability: "present",
    description: "最终 Taste / Design / Release 三方签署记录。"
  }
};

export function listPhase6ReleaseArtifacts(): Phase6ReleaseArtifactEntry[] {
  return Object.values(PHASE6_RELEASE_ARTIFACT_INDEX).map((artifact) => ({ ...artifact }));
}

export function getPhase6ReleaseArtifact(
  artifactId: string
): Phase6ReleaseArtifactEntry | undefined {
  const artifact = PHASE6_RELEASE_ARTIFACT_INDEX[artifactId];
  return artifact === undefined ? undefined : { ...artifact };
}
