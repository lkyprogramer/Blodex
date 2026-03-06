import { t } from "../../../i18n";

export type DebugLogLevel = "info" | "warn" | "success" | "danger";

export interface DebugCommandEntry {
  combo: string;
  descriptionKey: string;
}

export const DEBUG_COMMANDS: readonly DebugCommandEntry[] = [
  { combo: "Alt+H", descriptionKey: "ui.debug.help.alt_h" },
  { combo: "Alt+L", descriptionKey: "ui.debug.help.alt_l" },
  { combo: "Alt+J", descriptionKey: "ui.debug.help.alt_j" },
  { combo: "Alt+O", descriptionKey: "ui.debug.help.alt_o" },
  { combo: "Alt+C", descriptionKey: "ui.debug.help.alt_c" },
  { combo: "Alt+E", descriptionKey: "ui.debug.help.alt_e" },
  { combo: "Alt+M", descriptionKey: "ui.debug.help.alt_m" },
  { combo: "Alt+K", descriptionKey: "ui.debug.help.alt_k" },
  { combo: "Alt+X", descriptionKey: "ui.debug.help.alt_x" },
  { combo: "API.setHealth(value)", descriptionKey: "ui.debug.help.api_set_health" },
  { combo: "Alt+1..5", descriptionKey: "ui.debug.help.alt_floor_jump" },
  { combo: "Alt+N", descriptionKey: "ui.debug.help.alt_n" },
  { combo: "API.forceChallenge()", descriptionKey: "ui.debug.help.api_force_challenge" },
  { combo: "API.startChallenge()", descriptionKey: "ui.debug.help.api_start_challenge" },
  { combo: "API.settleChallenge(true|false)", descriptionKey: "ui.debug.help.api_settle_challenge" },
  { combo: "API.openBossVictory()", descriptionKey: "ui.debug.help.api_open_boss_victory" },
  { combo: "API.enterAbyss()", descriptionKey: "ui.debug.help.api_enter_abyss" },
  { combo: "API.nextFloor()", descriptionKey: "ui.debug.help.api_next_floor" },
  { combo: "API.forceSynergy(id)", descriptionKey: "ui.debug.help.api_force_synergy" }
] as const;

export function describeDebugCommands(): string[] {
  return DEBUG_COMMANDS.map((entry) => `${entry.combo}: ${t(entry.descriptionKey)}`);
}

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
