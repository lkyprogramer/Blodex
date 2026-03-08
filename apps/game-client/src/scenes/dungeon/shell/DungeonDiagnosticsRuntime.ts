import type { RunState } from "@blodex/core";
import { difficultyLabel } from "../../../i18n/labelResolvers";
import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";

interface DungeonDiagnosticsSource {
  diagnosticsService: DiagnosticsService;
  isEnabled(): boolean;
  getRun(): RunState;
  getAiCounts(): { near: number; far: number };
  getEventBusListenerCount(): number;
  getEntityDiagnostics(): {
    monsters: number;
    livingMonsters: number;
    loot: number;
    telegraphs: number;
  };
  getRenderDiagnostics(): {
    monstersVisible: number;
    monstersCulled: number;
  };
  getVfxDiagnostics(): {
    activeTransientObjects: number;
    droppedEffects: number;
  };
  getSfxDiagnostics(): {
    ambientActive: boolean;
    ambientKey?: string | null;
  };
  getActualFps(): number;
  getPhase6Summary(): unknown;
  getTasteSnapshot(): {
    buildIdentity: unknown;
    recentHeartbeats: unknown;
    recommendations: unknown;
  };
}

export class DungeonDiagnosticsRuntime {
  constructor(private readonly source: DungeonDiagnosticsSource) {}

  init(): void {
    this.source.diagnosticsService.init(this.source.isEnabled());
  }

  render(nowMs: number): void {
    const run = this.source.getRun();
    const ai = this.source.getAiCounts();
    const entity = this.source.getEntityDiagnostics();
    const render = this.source.getRenderDiagnostics();
    const vfx = this.source.getVfxDiagnostics();
    const sfx = this.source.getSfxDiagnostics();
    this.source.diagnosticsService.render(this.source.isEnabled(), nowMs, [
      `FPS ${this.source.getActualFps().toFixed(1)} | floor ${run.currentFloor} ${difficultyLabel(run.difficulty)}`,
      `AI near/far ${ai.near}/${ai.far}`,
      `Listeners eventBus ${this.source.getEventBusListenerCount()}`,
      `Entity M ${entity.monsters} (alive ${entity.livingMonsters}) L ${entity.loot} T ${entity.telegraphs}`,
      `Render visible/culled ${render.monstersVisible}/${render.monstersCulled}`,
      `VFX active ${vfx.activeTransientObjects} dropped ${vfx.droppedEffects}`,
      `SFX ambient ${sfx.ambientActive ? sfx.ambientKey ?? "on" : "off"}`
    ]);
  }

  snapshot(): Record<string, unknown> {
    const run = this.source.getRun();
    return {
      floor: run.currentFloor,
      difficulty: run.difficulty,
      ai: this.source.getAiCounts(),
      listeners: {
        eventBus: this.source.getEventBusListenerCount()
      },
      entity: this.source.getEntityDiagnostics(),
      render: this.source.getRenderDiagnostics(),
      vfx: this.source.getVfxDiagnostics(),
      sfx: this.source.getSfxDiagnostics(),
      phase6: this.source.getPhase6Summary(),
      taste: this.source.getTasteSnapshot()
    };
  }

  reset(): void {
    this.source.diagnosticsService.reset();
  }
}
