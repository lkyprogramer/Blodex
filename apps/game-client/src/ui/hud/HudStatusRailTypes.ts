export type HudStatusTone = "debuff" | "survival" | "offense" | "utility";

export interface HudStatusBuffEntry {
  id: string;
  label: string;
  shortLabel: string;
  remainingMs: number;
  tone: HudStatusTone;
}

export interface HudPersistentIndicator {
  id: string;
  label: string;
  detail?: string;
  tone: "set" | "synergy";
}

export interface HudStatusRailState {
  buffs: HudStatusBuffEntry[];
  overflowCount: number;
  indicators: HudPersistentIndicator[];
}
