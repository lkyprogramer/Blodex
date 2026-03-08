import { describe, expect, it, vi } from "vitest";
import {
  createDungeonSceneHostBridge,
  readonlyHostField,
  mutableHostField,
  DUNGEON_SCENE_HOST_METHOD_KEYS,
  DUNGEON_SCENE_HOST_MUTABLE_KEYS,
  DUNGEON_SCENE_HOST_READONLY_KEYS,
  type DungeonSceneHostBridge,
  type DungeonSceneHostBridgeSource
} from "./dungeonSceneHostFactories";

type HostState = Record<keyof DungeonSceneHostBridge, unknown>;

const REQUIRED_MUTABLE_KEYS = [
  "meta",
  "talentEffects",
  "eventNode",
  "mutationRuntime",
  "spawnRng",
  "combatRng",
  "lootRng",
  "skillRng",
  "bossRng",
  "biomeRng",
  "hazardRng",
  "eventRng",
  "merchantRng",
  "unlockedBiomeIds",
  "unlockedAffixIds",
  "unlockedEventIds",
  "unlockedWeaponTypes",
  "synergyRuntime"
] as const satisfies ReadonlyArray<keyof DungeonSceneHostBridge>;

const REQUIRED_READONLY_KEYS = [
  "saveManager",
  "uiManager",
  "sfxSystem",
  "vfxSystem",
  "combatRuntime",
  "metaRuntime"
] as const satisfies ReadonlyArray<keyof DungeonSceneHostBridge>;

const REQUIRED_METHOD_KEYS = [
  "replaceMeta",
  "isBlockingOverlayOpen",
  "resolveMutationMoveSpeedMultiplier",
  "updateKeyboardMoveIntent",
  "updatePlayerMovement",
  "updateRuntimeBuffs",
  "renderDiagnosticsPanel",
  "resolveMinimumActiveSkillManaCost",
  "computePathTo",
  "tryUseSkill",
  "tryUseConsumable"
] as const satisfies ReadonlyArray<keyof DungeonSceneHostBridge>;

function createBridgeFixture() {
  const state = {} as HostState;
  const methods = Object.fromEntries(
    DUNGEON_SCENE_HOST_METHOD_KEYS.map((key) => [
      key,
      vi.fn(() => {
        if (key === "isBlockingOverlayOpen") {
          return false;
        }
        if (key === "resolveMutationMoveSpeedMultiplier") {
          return 1;
        }
        return undefined;
      })
    ])
  ) as Record<(typeof DUNGEON_SCENE_HOST_METHOD_KEYS)[number], ReturnType<typeof vi.fn>>;

  state.meta = { selectedDifficulty: "normal" };
  state.talentEffects = { attackPower: 0 };
  state.eventNode = null;
  state.saveManager = { saveRun: vi.fn() };

  const source: Record<string, unknown> = {};
  for (const key of DUNGEON_SCENE_HOST_MUTABLE_KEYS) {
    source[key] = mutableHostField(
      () => state[key],
      (value) => {
        state[key] = value;
      }
    );
  }
  for (const key of DUNGEON_SCENE_HOST_READONLY_KEYS) {
    source[key] = readonlyHostField(() => state[key]);
  }
  for (const key of DUNGEON_SCENE_HOST_METHOD_KEYS) {
    source[key] = methods[key];
  }

  return {
    state,
    methods,
    bridge: createDungeonSceneHostBridge(source as DungeonSceneHostBridgeSource)
  };
}

describe("createDungeonSceneHostBridge", () => {
  it("keeps the required runtime contract surface pinned even if registries drift", () => {
    for (const key of REQUIRED_MUTABLE_KEYS) {
      expect(DUNGEON_SCENE_HOST_MUTABLE_KEYS).toContain(key);
    }
    for (const key of REQUIRED_READONLY_KEYS) {
      expect(DUNGEON_SCENE_HOST_READONLY_KEYS).toContain(key);
    }
    for (const key of REQUIRED_METHOD_KEYS) {
      expect(DUNGEON_SCENE_HOST_METHOD_KEYS).toContain(key);
    }
  });

  it("exposes mutable runtime fields that shell bootstrap writes during init", () => {
    const { bridge, state } = createBridgeFixture();
    const nextMeta = { selectedDifficulty: "hard" };
    const nextTalentEffects = { attackPower: 12 };
    const nextEventNode = { resolved: false, position: { x: 2, y: 3 } };

    expect(() => {
      bridge.meta = nextMeta as never;
      bridge.talentEffects = nextTalentEffects as never;
      bridge.eventNode = nextEventNode as never;
    }).not.toThrow();

    expect(state.meta).toBe(nextMeta);
    expect(state.talentEffects).toBe(nextTalentEffects);
    expect(state.eventNode).toBe(nextEventNode);
  });

  it("keeps readonly fields readonly while exposing required frame/runtime methods", () => {
    const { bridge, methods } = createBridgeFixture();
    const saveManagerDescriptor = Object.getOwnPropertyDescriptor(bridge, "saveManager");
    const metaDescriptor = Object.getOwnPropertyDescriptor(bridge, "meta");

    expect(saveManagerDescriptor?.set).toBeUndefined();
    expect(metaDescriptor?.set).toBeTypeOf("function");
    expect(bridge.isBlockingOverlayOpen()).toBe(false);
    expect(bridge.resolveMutationMoveSpeedMultiplier()).toBe(1);
    expect(methods.isBlockingOverlayOpen).toHaveBeenCalledTimes(1);
    expect(methods.resolveMutationMoveSpeedMultiplier).toHaveBeenCalledTimes(1);
  });
});
