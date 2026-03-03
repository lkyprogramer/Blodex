export interface EncounterControllerDeps {
  updateCombat: (nowMs: number) => void;
  updateMonsters: (deltaSeconds: number, nowMs: number) => void;
  updateMonsterCombat: (nowMs: number) => void;
  updateBossCombat: (nowMs: number) => void;
  updateChallengeRoom: (nowMs: number) => void;
}

export interface EncounterFrameInput {
  deltaSeconds: number;
  nowMs: number;
}

export class EncounterController {
  constructor(private readonly deps: EncounterControllerDeps) {}

  updateFrame(input: EncounterFrameInput): void {
    this.deps.updateCombat(input.nowMs);
    this.deps.updateMonsters(input.deltaSeconds, input.nowMs);
    this.deps.updateMonsterCombat(input.nowMs);
    this.deps.updateBossCombat(input.nowMs);
    this.deps.updateChallengeRoom(input.nowMs);
  }
}
