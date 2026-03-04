import { DebugApiBinder } from "./DebugApiBinder";
import { DebugCommandRegistry } from "./DebugCommandRegistry";
import type { BlodexDebugApi } from "./types";

export interface DebugRuntimeModuleOptions {
  debugApiBinder: DebugApiBinder;
  commandRegistry: DebugCommandRegistry;
  isDebugEnabled: () => boolean;
  onResetRun: () => void;
}

export class DebugRuntimeModule {
  constructor(private readonly options: DebugRuntimeModuleOptions) {}

  install(): void {
    if (!this.options.isDebugEnabled()) {
      this.uninstall();
      return;
    }

    const api: BlodexDebugApi = {
      addObols: (amount = 30) => this.options.commandRegistry.addObols(amount),
      grantConsumables: (charges = 2) => this.options.commandRegistry.grantConsumables(charges),
      spawnEvent: (eventId) => this.options.commandRegistry.spawnEvent(eventId),
      openMerchant: () => this.options.commandRegistry.openMerchant(),
      clearFloor: () => this.options.commandRegistry.clearFloor(),
      jumpFloor: (floor) => this.options.commandRegistry.jumpFloor(floor),
      setHealth: (value) => this.options.commandRegistry.setHealth(value),
      killPlayer: () => this.options.commandRegistry.killPlayer(),
      newRun: () => this.options.onResetRun(),
      forceChallenge: () => this.options.commandRegistry.forceChallenge(),
      startChallenge: () => this.options.commandRegistry.startChallenge(),
      settleChallenge: (success = true) => this.options.commandRegistry.settleChallenge(success),
      openBossVictory: () => this.options.commandRegistry.openBossVictory(),
      enterAbyss: () => this.options.commandRegistry.enterAbyss(),
      nextFloor: () => this.options.commandRegistry.nextFloor(),
      forceSynergy: (synergyId = "syn_staff_chain_lightning_overload") =>
        this.options.commandRegistry.forceSynergy(synergyId),
      diagnostics: () => this.options.commandRegistry.diagnostics(),
      stressRuns: (iterations = 12) => this.options.commandRegistry.stressRuns(iterations),
      help: () => this.options.commandRegistry.help()
    };

    this.options.debugApiBinder.install(api);
  }

  uninstall(): void {
    this.options.debugApiBinder.remove();
  }

  handleHotkey(event: KeyboardEvent): boolean {
    if (!this.options.isDebugEnabled() || !event.altKey) {
      return false;
    }

    let handled = true;
    switch (event.code) {
      case "KeyH":
        this.options.commandRegistry.showHelp();
        break;
      case "KeyL":
        this.options.commandRegistry.diagnostics();
        break;
      case "KeyJ":
        this.options.commandRegistry.stressRuns(12);
        break;
      case "KeyO":
        this.options.commandRegistry.addObols(30);
        break;
      case "KeyC":
        this.options.commandRegistry.grantConsumables(2);
        break;
      case "KeyE":
        this.options.commandRegistry.spawnEvent();
        break;
      case "KeyM":
        this.options.commandRegistry.openMerchant();
        break;
      case "KeyK":
        this.options.commandRegistry.clearFloor();
        break;
      case "KeyX":
        this.options.commandRegistry.killPlayer();
        break;
      case "KeyN":
        this.options.onResetRun();
        break;
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
        this.options.commandRegistry.jumpFloor(Number.parseInt(event.code.slice(-1), 10));
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
    return handled;
  }
}
