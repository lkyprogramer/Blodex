import { describe, expect, it, vi } from "vitest";
import { EncounterController } from "../EncounterController";

describe("EncounterController", () => {
  it("runs combat pipeline without challenge-room resolution", () => {
    const deps = {
      updateCombat: vi.fn(),
      updateMonsters: vi.fn(),
      updateMonsterCombat: vi.fn(),
      updateBossCombat: vi.fn(),
      updateChallengeRoom: vi.fn()
    };
    const controller = new EncounterController(deps);

    controller.updateFrame({
      deltaSeconds: 0.016,
      nowMs: 120
    });

    expect(deps.updateCombat).toHaveBeenCalledWith(120);
    expect(deps.updateMonsters).toHaveBeenCalledWith(0.016, 120);
    expect(deps.updateMonsterCombat).toHaveBeenCalledWith(120);
    expect(deps.updateBossCombat).toHaveBeenCalledWith(120);
    expect(deps.updateChallengeRoom).not.toHaveBeenCalled();
  });

  it("runs challenge-room resolution in dedicated phase", () => {
    const deps = {
      updateCombat: vi.fn(),
      updateMonsters: vi.fn(),
      updateMonsterCombat: vi.fn(),
      updateBossCombat: vi.fn(),
      updateChallengeRoom: vi.fn()
    };
    const controller = new EncounterController(deps);

    controller.updateChallenge(330);

    expect(deps.updateChallengeRoom).toHaveBeenCalledOnce();
    expect(deps.updateChallengeRoom).toHaveBeenCalledWith(330);
  });
});
