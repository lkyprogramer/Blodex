import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

interface AudioPlanAsset {
  id: string;
  category: "sfx" | "amb" | "ui";
  eventKey: string;
  sourceType?: "generated" | "external";
  sourceRef: string;
  license: string;
  attribution?: string;
  outputName: string;
}

interface AudioPlan {
  styleTag: string;
  defaults?: {
    format?: "ogg" | "wav" | "mp3";
  };
  assets: AudioPlanAsset[];
}

interface AudioManifestEntry {
  id: string;
  category: "sfx" | "amb" | "ui";
  eventKey: string;
  sourceType: "generated" | "external";
  sourceRef: string;
  license: string;
  attribution: string;
  outputPath: string;
  revision: number;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const AUDIO_PLAN_PATH = resolve(ROOT, "assets/source-prompts/audio-plan.yaml");
const AUDIO_MANIFEST_PATH = resolve(ROOT, "assets/generated/audio-manifest.json");

function stableHash(raw: string): string {
  return createHash("sha1").update(raw).digest("hex").slice(0, 10);
}

function loadManifestById(): Record<string, AudioManifestEntry> {
  if (!existsSync(AUDIO_MANIFEST_PATH)) {
    return {};
  }

  const existing = JSON.parse(readFileSync(AUDIO_MANIFEST_PATH, "utf-8")) as AudioManifestEntry[];
  return Object.fromEntries(existing.map((entry) => [entry.id, entry]));
}

function main(): void {
  const raw = readFileSync(AUDIO_PLAN_PATH, "utf-8");
  const parsed = parse(raw) as AudioPlan;
  const existingManifest = loadManifestById();

  const manifest: AudioManifestEntry[] = parsed.assets.map((asset) => {
    const hash = stableHash(`${asset.id}:${asset.sourceRef}:${asset.eventKey}`);
    const previous = existingManifest[asset.id];
    const revision =
      previous === undefined
        ? 1
        : stableHash(`${previous.id}:${previous.sourceRef}:${previous.eventKey}`) === hash
          ? previous.revision
          : previous.revision + 1;

    const ext = parsed.defaults?.format ?? "ogg";
    const outputName = asset.outputName.endsWith(`.${ext}`) ? asset.outputName : `${asset.outputName}.${ext}`;

    return {
      id: asset.id,
      category: asset.category,
      eventKey: asset.eventKey,
      sourceType: asset.sourceType ?? "external",
      sourceRef: asset.sourceRef,
      license: asset.license,
      attribution: asset.attribution ?? "",
      outputPath: `apps/game-client/public/audio/${outputName}`,
      revision
    };
  });

  mkdirSync(resolve(ROOT, "assets/generated"), { recursive: true });
  writeFileSync(AUDIO_MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  process.stdout.write(`Synced audio manifest to ${AUDIO_MANIFEST_PATH}\n`);
}

main();
