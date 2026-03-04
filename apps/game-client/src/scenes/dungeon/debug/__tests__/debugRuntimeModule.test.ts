import { describe, expect, it, vi } from "vitest";
import { DebugRuntimeModule } from "../DebugRuntimeModule";
import type { DebugCommandRegistry } from "../DebugCommandRegistry";
import type { DebugApiBinder } from "../DebugApiBinder";

function createRegistryMock() {
  return {
    addObols: vi.fn(),
    grantConsumables: vi.fn(),
    spawnEvent: vi.fn(),
    openMerchant: vi.fn(),
    clearFloor: vi.fn(),
    jumpFloor: vi.fn(),
    setHealth: vi.fn(() => 42),
    killPlayer: vi.fn(),
    forceChallenge: vi.fn(() => true),
    startChallenge: vi.fn(() => true),
    settleChallenge: vi.fn(() => true),
    openBossVictory: vi.fn(() => true),
    enterAbyss: vi.fn(() => true),
    nextFloor: vi.fn(() => true),
    forceSynergy: vi.fn(() => ["syn"]),
    diagnostics: vi.fn(() => ({ ok: true })),
    stressRuns: vi.fn(() => ({ iterations: 1 })),
    help: vi.fn(() => ["Alt+H: Show cheat commands"]),
    showHelp: vi.fn()
  };
}

describe("DebugRuntimeModule", () => {
  it("installs debug api when debug is enabled", () => {
    const registry = createRegistryMock();
    const binder = {
      install: vi.fn(),
      remove: vi.fn()
    };
    const module = new DebugRuntimeModule({
      debugApiBinder: binder as unknown as DebugApiBinder,
      commandRegistry: registry as unknown as DebugCommandRegistry,
      isDebugEnabled: () => true,
      onResetRun: vi.fn()
    });

    module.install();

    expect(binder.install).toHaveBeenCalledOnce();
    const api = binder.install.mock.calls[0]?.[0] as { addObols: (amount?: number) => void };
    api.addObols();
    expect(registry.addObols).toHaveBeenCalledWith(30);
  });

  it("removes debug api when debug is disabled", () => {
    const registry = createRegistryMock();
    const binder = {
      install: vi.fn(),
      remove: vi.fn()
    };
    const module = new DebugRuntimeModule({
      debugApiBinder: binder as unknown as DebugApiBinder,
      commandRegistry: registry as unknown as DebugCommandRegistry,
      isDebugEnabled: () => false,
      onResetRun: vi.fn()
    });

    module.install();

    expect(binder.install).not.toHaveBeenCalled();
    expect(binder.remove).toHaveBeenCalledOnce();
  });

  it("routes handled hotkeys and prevents default", () => {
    const registry = createRegistryMock();
    const binder = {
      install: vi.fn(),
      remove: vi.fn()
    };
    const module = new DebugRuntimeModule({
      debugApiBinder: binder as unknown as DebugApiBinder,
      commandRegistry: registry as unknown as DebugCommandRegistry,
      isDebugEnabled: () => true,
      onResetRun: vi.fn()
    });

    const event = {
      altKey: true,
      code: "KeyO",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent;

    const handled = module.handleHotkey(event);

    expect(handled).toBe(true);
    expect(registry.addObols).toHaveBeenCalledWith(30);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("ignores unknown hotkeys", () => {
    const registry = createRegistryMock();
    const binder = {
      install: vi.fn(),
      remove: vi.fn()
    };
    const module = new DebugRuntimeModule({
      debugApiBinder: binder as unknown as DebugApiBinder,
      commandRegistry: registry as unknown as DebugCommandRegistry,
      isDebugEnabled: () => true,
      onResetRun: vi.fn()
    });

    const event = {
      altKey: true,
      code: "KeyZ",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent;

    const handled = module.handleHotkey(event);

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
