export type DebugLogLevel = "info" | "warn" | "success" | "danger";

export interface DebugCommandEntry {
  combo: string;
  description: string;
}

export const DEBUG_COMMANDS: readonly DebugCommandEntry[] = [
  { combo: "Alt+H", description: "Show cheat commands" },
  { combo: "Alt+L", description: "Dump diagnostics snapshot to console/log" },
  { combo: "Alt+J", description: "Run lifecycle smoke reset loop (12 iterations)" },
  { combo: "Alt+O", description: "Add 30 Obol" },
  { combo: "Alt+C", description: "Grant 2 charges for all consumables" },
  { combo: "Alt+E", description: "Force spawn random event and open panel" },
  { combo: "Alt+M", description: "Open wandering merchant panel" },
  { combo: "Alt+K", description: "Clear current floor instantly" },
  { combo: "Alt+X", description: "Force player death (death feedback check)" },
  { combo: "API.setHealth(value)", description: "Set player HP directly for HUD/feedback validation" },
  { combo: "Alt+1..5", description: "Jump to floor 1-5 (biome/hazard/boss checks)" },
  { combo: "Alt+N", description: "Start a fresh run" },
  { combo: "API.forceChallenge()", description: "Inject a challenge room on current floor" },
  { combo: "API.startChallenge()", description: "Start challenge encounter immediately" },
  { combo: "API.settleChallenge(true|false)", description: "Force challenge success/failure" },
  { combo: "API.openBossVictory()", description: "Open boss victory choice instantly" },
  { combo: "API.enterAbyss()", description: "Force enter abyss/endless" },
  { combo: "API.nextFloor()", description: "Advance to next floor immediately" },
  { combo: "API.forceSynergy(id)", description: "Inject loadout to activate a synergy quickly" }
] as const;

export interface BlodexDebugApi {
  addObols: (amount?: number) => void;
  grantConsumables: (charges?: number) => void;
  spawnEvent: (eventId?: string) => void;
  openMerchant: () => void;
  clearFloor: () => void;
  jumpFloor: (floor: number) => void;
  setHealth: (value: number) => number;
  killPlayer: () => void;
  newRun: () => void;
  forceChallenge: () => boolean;
  startChallenge: () => boolean;
  settleChallenge: (success?: boolean) => boolean;
  openBossVictory: () => boolean;
  enterAbyss: () => boolean;
  nextFloor: () => boolean;
  forceSynergy: (synergyId?: string) => string[];
  diagnostics: () => Record<string, unknown>;
  stressRuns: (iterations?: number) => Record<string, unknown>;
  help: () => string[];
}

declare global {
  interface Window {
    __blodexDebug?: BlodexDebugApi;
  }
}

export {};
