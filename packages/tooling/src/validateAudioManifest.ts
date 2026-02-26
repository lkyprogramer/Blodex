import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const AUDIO_MANIFEST_PATH = resolve(ROOT, "assets/generated/audio-manifest.json");

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  assert(existsSync(AUDIO_MANIFEST_PATH), `Missing audio manifest: ${AUDIO_MANIFEST_PATH}`);

  const entries = JSON.parse(readFileSync(AUDIO_MANIFEST_PATH, "utf-8")) as AudioManifestEntry[];
  assert(Array.isArray(entries), "Audio manifest must be an array.");

  const ids = new Set<string>();
  for (const entry of entries) {
    assert(typeof entry.id === "string" && entry.id.length > 0, "Audio entry id is required.");
    assert(!ids.has(entry.id), `Duplicate audio id: ${entry.id}`);
    ids.add(entry.id);

    assert(["sfx", "amb", "ui"].includes(entry.category), `category invalid on ${entry.id}`);
    assert(typeof entry.eventKey === "string" && entry.eventKey.length > 0, `eventKey missing on ${entry.id}`);
    assert(entry.sourceType === "generated" || entry.sourceType === "external", `sourceType invalid on ${entry.id}`);
    assert(typeof entry.sourceRef === "string" && entry.sourceRef.length > 0, `sourceRef missing on ${entry.id}`);
    assert(typeof entry.license === "string" && entry.license.length > 0, `license missing on ${entry.id}`);
    assert(typeof entry.attribution === "string", `attribution missing on ${entry.id}`);
    assert(typeof entry.outputPath === "string" && entry.outputPath.length > 0, `outputPath missing on ${entry.id}`);
    assert(Number.isInteger(entry.revision) && entry.revision > 0, `revision invalid on ${entry.id}`);

    assert(entry.license !== "blocked", `blocked license is not allowed on ${entry.id}`);
    if (entry.license === "review-required") {
      assert(entry.attribution.length > 0, `review-required license requires attribution on ${entry.id}`);
    }

    const absoluteOutputPath = resolve(ROOT, entry.outputPath);
    assert(existsSync(absoluteOutputPath), `audio output missing: ${entry.outputPath} (${entry.id})`);
  }

  process.stdout.write(`Audio manifest valid: ${entries.length} entries\n`);
}

main();
