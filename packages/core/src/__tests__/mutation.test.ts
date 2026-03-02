import { describe, expect, it } from "vitest";
import {
  buildMutationDefMap,
  checkIncompatibleSymmetry,
  clampMutationSlots,
  collectUnlockedMutationIds,
  normalizeMutationMetaState,
  unlockEchoMutation,
  validateMutationSelection
} from "../mutation";
import { createInitialMeta } from "../run";
import type { MutationDef } from "../contracts/types";

const MUTATIONS: MutationDef[] = [
  {
    id: "mut_default_offense",
    name: "Battle Instinct",
    category: "offensive",
    tier: 1,
    unlock: { type: "default" },
    effects: [{ type: "on_kill_attack_speed", value: 0.05, durationMs: 4000, maxStacks: 3 }]
  },
  {
    id: "mut_bp_guarded",
    name: "Guarded Core",
    category: "defensive",
    tier: 2,
    unlock: { type: "blueprint", blueprintId: "bp_mutation_guarded_core" },
    incompatibleWith: ["mut_echo_phase"],
    effects: [{ type: "once_per_floor_lethal_guard", invulnMs: 1200 }]
  },
  {
    id: "mut_echo_phase",
    name: "Phase Skin",
    category: "defensive",
    tier: 2,
    unlock: { type: "echo", cost: 2 },
    incompatibleWith: ["mut_bp_guarded"],
    effects: [{ type: "on_hit_invuln", chance: 0.18, durationMs: 1000, cooldownMs: 9000 }]
  }
];

describe("mutation domain", () => {
  it("clamps slots between 1 and 3", () => {
    expect(clampMutationSlots(0)).toBe(1);
    expect(clampMutationSlots(2)).toBe(2);
    expect(clampMutationSlots(7)).toBe(3);
  });

  it("collects unlocked mutations from defaults, blueprints and explicit echo unlocks", () => {
    const meta = {
      ...createInitialMeta(),
      blueprintForgedIds: ["bp_mutation_guarded_core"],
      mutationUnlockedIds: ["mut_echo_phase"]
    };
    expect(collectUnlockedMutationIds(meta, MUTATIONS)).toEqual([
      "mut_echo_phase",
      "mut_default_offense",
      "mut_bp_guarded"
    ]);
  });

  it("validates slot limits and incompatibilities", () => {
    const defs = buildMutationDefMap(MUTATIONS);
    const unlocked = ["mut_default_offense", "mut_bp_guarded", "mut_echo_phase"];

    const valid = validateMutationSelection(["mut_default_offense"], defs, 1, unlocked);
    expect(valid.ok).toBe(true);

    const overflow = validateMutationSelection(["mut_default_offense", "mut_bp_guarded"], defs, 1, unlocked);
    expect(overflow.ok).toBe(false);

    const conflict = validateMutationSelection(["mut_bp_guarded", "mut_echo_phase"], defs, 2, unlocked);
    expect(conflict.ok).toBe(false);
  });

  it("normalizes selected mutations when unlocked set changes", () => {
    const meta = {
      ...createInitialMeta(),
      mutationSlots: 2,
      selectedMutationIds: ["mut_default_offense", "mut_bp_guarded"],
      mutationUnlockedIds: [],
      blueprintForgedIds: []
    };
    const normalized = normalizeMutationMetaState(meta, MUTATIONS);
    expect(normalized.selectedMutationIds).toEqual(["mut_default_offense"]);
  });

  it("unlocks echo mutation only when currency is sufficient", () => {
    const lowEchoMeta = {
      ...createInitialMeta(),
      echoes: 1
    };
    const fail = unlockEchoMutation(lowEchoMeta, MUTATIONS[2]!);
    expect(fail.ok).toBe(false);

    const richMeta = {
      ...createInitialMeta(),
      echoes: 3
    };
    const ok = unlockEchoMutation(richMeta, MUTATIONS[2]!);
    expect(ok.ok).toBe(true);
    if (!ok.ok) {
      return;
    }
    expect(ok.meta.echoes).toBe(1);
    expect(ok.meta.mutationUnlockedIds).toContain("mut_echo_phase");
  });

  it("checks incompatible constraints are bidirectional", () => {
    expect(checkIncompatibleSymmetry(MUTATIONS)).toEqual([]);
  });
});

