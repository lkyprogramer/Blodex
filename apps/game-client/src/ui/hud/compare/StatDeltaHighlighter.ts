import type { DerivedStats } from "@blodex/core";
import { resolveDeltaDirection, type DeltaDirection } from "./EquipmentDeltaPresenter";

export type HudStatHighlightKey = "attackPower" | "armor" | "critChance";

export interface HudStatHighlight {
  key: HudStatHighlightKey;
  direction: DeltaDirection;
}

export interface HudStatHighlightEntry extends HudStatHighlight {
  expiresAtMs: number;
}

const HIGHLIGHTED_STAT_KEYS: readonly HudStatHighlightKey[] = ["attackPower", "armor", "critChance"];

export function buildHudStatHighlightEntries(
  beforeStats: DerivedStats,
  afterStats: DerivedStats,
  nowMs: number,
  durationMs: number
): HudStatHighlightEntry[] {
  if (durationMs <= 0) {
    return [];
  }

  const entries: HudStatHighlightEntry[] = [];
  for (const key of HIGHLIGHTED_STAT_KEYS) {
    const before = beforeStats[key];
    const after = afterStats[key];
    const delta = after - before;
    if (Math.abs(delta) < 1e-6) {
      continue;
    }
    entries.push({
      key,
      direction: resolveDeltaDirection(delta),
      expiresAtMs: nowMs + durationMs
    });
  }
  return entries;
}

export function collectActiveHudStatHighlights(
  entries: readonly HudStatHighlightEntry[],
  nowMs: number
): {
  active: HudStatHighlight[];
  persisted: HudStatHighlightEntry[];
  nextRefreshAt: number;
} {
  const persisted: HudStatHighlightEntry[] = [];
  let nextRefreshAt = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    if (entry.expiresAtMs <= nowMs) {
      continue;
    }
    persisted.push(entry);
    if (entry.expiresAtMs < nextRefreshAt) {
      nextRefreshAt = entry.expiresAtMs;
    }
  }
  return {
    active: persisted.map((entry) => ({
      key: entry.key,
      direction: entry.direction
    })),
    persisted,
    nextRefreshAt
  };
}
