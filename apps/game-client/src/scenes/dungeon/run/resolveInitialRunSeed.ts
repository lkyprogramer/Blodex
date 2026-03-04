import { createRunSeed } from "@blodex/core";

export function resolveInitialRunSeed(pendingRunSeed: string | undefined, search = window.location.search): string {
  if (pendingRunSeed !== undefined && pendingRunSeed.trim().length > 0) {
    return pendingRunSeed.trim();
  }
  const requested = new URLSearchParams(search).get("seed");
  if (requested !== null && requested.trim().length > 0) {
    return requested.trim();
  }
  return createRunSeed();
}
