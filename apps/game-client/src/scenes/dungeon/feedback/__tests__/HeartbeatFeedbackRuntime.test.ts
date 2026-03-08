import { createEventBus, type GameEventMap, type ItemInstance } from "@blodex/core";
import { ITEM_DEF_MAP } from "@blodex/content";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeartbeatFeedbackRuntime, type HeartbeatFeedbackRuntimeHost } from "../HeartbeatFeedbackRuntime";

function makeItem(defId: string, overrides: Partial<ItemInstance> = {}): ItemInstance {
  const def = ITEM_DEF_MAP[defId]!;
  return {
    id: `${defId}-instance`,
    defId: def.id,
    name: def.name,
    slot: def.slot,
    kind: def.kind ?? "equipment",
    ...(def.weaponType === undefined ? {} : { weaponType: def.weaponType }),
    rarity: def.rarity,
    requiredLevel: def.requiredLevel,
    iconId: def.iconId,
    seed: `${defId}-seed`,
    rolledAffixes: {},
    ...(def.fixedSpecialAffixes === undefined ? {} : { rolledSpecialAffixes: { ...def.fixedSpecialAffixes } }),
    ...overrides
  };
}

function createHost(): {
  host: HeartbeatFeedbackRuntimeHost;
  runtime: HeartbeatFeedbackRuntime;
  showHeartbeatToast: ReturnType<typeof vi.fn>;
  showEquipmentComparePrompt: ReturnType<typeof vi.fn>;
  routeFeedback: ReturnType<typeof vi.fn>;
} {
  const player = {
    inventory: [] as ItemInstance[],
    equipment: {
      weapon: makeItem("rusted_sabre", {
        rolledAffixes: {
          attackPower: 2
        }
      })
    }
  };
  const eventBus = createEventBus<GameEventMap>();
  const showHeartbeatToast = vi.fn();
  const showEquipmentComparePrompt = vi.fn();
  const routeFeedback = vi.fn();
  const host: HeartbeatFeedbackRuntimeHost = {
    eventBus,
    uiManager: {
      showHeartbeatToast,
      hideHeartbeatToast: vi.fn(),
      showEquipmentComparePrompt,
      hideEquipmentComparePrompt: vi.fn()
    },
    contentLocalizer: {
      itemName: (itemDefId, fallback) => ITEM_DEF_MAP[itemDefId]?.name ?? fallback
    },
    player,
    routeFeedback,
    eventPanelOpen: false,
    comparePromptOpen: false,
    hudDirty: false
  };
  const runtime = new HeartbeatFeedbackRuntime(host);
  runtime.bind();
  return {
    host,
    runtime,
    showHeartbeatToast,
    showEquipmentComparePrompt,
    routeFeedback
  };
}

describe("HeartbeatFeedbackRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shares the build-family budget between build formed and synergy activated", () => {
    const { host, showHeartbeatToast } = createHost();

    host.eventBus.emit("build_formed", {
      floor: 2,
      source: "test",
      timestampMs: 1000,
      tags: ["build:offense"],
      keyItemDefIds: []
    });
    host.eventBus.emit("synergy_activated", {
      floor: 2,
      synergyId: "syn_frost_spirit_resonance",
      timestampMs: 1200
    });

    expect(showHeartbeatToast).toHaveBeenCalledTimes(1);
  });

  it("queues compare prompts and routes the compare cue when a prompt opens", () => {
    const { runtime, showEquipmentComparePrompt, routeFeedback } = createHost();
    const first = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16
      }
    });
    const second = makeItem("oathbound_cuirass", {
      rolledAffixes: {
        armor: 14
      }
    });

    runtime.maybeQueueEquipmentCompare(first, "boss_reward");
    runtime.maybeQueueEquipmentCompare(second, "boss_reward");

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(1);
    expect(routeFeedback).toHaveBeenCalledWith({
      type: "equipment:compare"
    });

    const firstCall = showEquipmentComparePrompt.mock.calls[0]!;
    const options = firstCall[2] as { onAction: (action: "equip" | "later" | "ignore") => void };
    options.onAction("ignore");

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(2);
  });

  it("defers later prompts behind new immediate prompts instead of treating them like ignore", () => {
    const { runtime, showEquipmentComparePrompt } = createHost();
    const first = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16
      }
    });
    const second = makeItem("oathbound_cuirass", {
      rolledAffixes: {
        armor: 14
      }
    });

    runtime.maybeQueueEquipmentCompare(first, "boss_reward");
    const firstOptions = showEquipmentComparePrompt.mock.calls[0]![2] as {
      onAction: (action: "equip" | "later" | "ignore") => void;
    };
    firstOptions.onAction("later");

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(1);

    runtime.maybeQueueEquipmentCompare(second, "boss_reward");
    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(2);
    expect(showEquipmentComparePrompt.mock.calls[1]![0]).toMatchObject({
      id: second.id
    });

    const secondOptions = showEquipmentComparePrompt.mock.calls[1]![2] as {
      onAction: (action: "equip" | "later" | "ignore") => void;
    };
    secondOptions.onAction("ignore");

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(3);
    expect(showEquipmentComparePrompt.mock.calls[2]![0]).toMatchObject({
      id: first.id
    });
  });

  it("supports deferred compare binding without opening the prompt immediately", () => {
    const { runtime, showEquipmentComparePrompt } = createHost();
    const deferred = makeItem("oathbound_cuirass", {
      rolledAffixes: {
        armor: 14
      }
    });
    const immediate = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16
      }
    });

    runtime.maybeQueueEquipmentCompare(deferred, "boss_reward", "deferred");

    expect(showEquipmentComparePrompt).not.toHaveBeenCalled();
    expect(runtime.captureComparePromptState()).toEqual({
      immediate: [],
      deferred: [
        {
          itemId: deferred.id,
          source: "boss_reward"
        }
      ],
      drainMode: "all"
    });

    runtime.maybeQueueEquipmentCompare(immediate, "boss_reward");

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(1);
    expect(showEquipmentComparePrompt.mock.calls[0]![0]).toMatchObject({
      id: immediate.id
    });
  });

  it("captures the active compare prompt in session state while the prompt is open", () => {
    const { runtime } = createHost();
    const first = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16
      }
    });

    runtime.maybeQueueEquipmentCompare(first, "boss_reward");

    expect(runtime.captureComparePromptState()).toEqual({
      active: {
        itemId: first.id,
        source: "boss_reward"
      },
      immediate: [],
      deferred: [],
      drainMode: "all"
    });
  });

  it("reopens the restored active compare prompt immediately when the UI is unblocked", () => {
    const { host, runtime, showEquipmentComparePrompt } = createHost();
    const first = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16
      }
    });
    host.player.inventory.push(first);

    runtime.restoreComparePromptState({
      active: {
        itemId: first.id,
        source: "boss_reward"
      },
      immediate: [],
      deferred: [],
      drainMode: "all"
    });

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(1);
    expect(showEquipmentComparePrompt.mock.calls[0]![0]).toMatchObject({
      id: first.id
    });
    expect(runtime.captureComparePromptState()).toEqual({
      active: {
        itemId: first.id,
        source: "boss_reward"
      },
      immediate: [],
      deferred: [],
      drainMode: "all"
    });
  });

  it("keeps restored compare prompts pending while blocked and shows them after an explicit flush", () => {
    const { host, runtime, showEquipmentComparePrompt } = createHost();
    const first = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16
      }
    });
    host.player.inventory.push(first);
    host.eventPanelOpen = true;

    runtime.restoreComparePromptState({
      active: {
        itemId: first.id,
        source: "boss_reward"
      },
      immediate: [],
      deferred: [],
      drainMode: "immediate"
    });

    expect(showEquipmentComparePrompt).not.toHaveBeenCalled();
    expect(runtime.captureComparePromptState()).toEqual({
      immediate: [
        {
          itemId: first.id,
          source: "boss_reward"
        }
      ],
      deferred: [],
      drainMode: "immediate"
    });

    host.eventPanelOpen = false;
    runtime.flushImmediateComparePrompts();

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(1);
    expect(showEquipmentComparePrompt.mock.calls[0]![0]).toMatchObject({
      id: first.id
    });
  });

  it("does not open compare prompts for low-value merchant purchases", () => {
    const { host, runtime, showEquipmentComparePrompt } = createHost();
    host.player.equipment.weapon = makeItem("sanctified_greatsword", {
      id: "equipped-rare",
      rolledAffixes: {
        attackPower: 16,
        critChance: 4,
        attackSpeed: 4
      }
    });
    const lowValue = makeItem("rusted_sabre", {
      id: "merchant-low-value",
      rolledAffixes: {
        attackPower: 1
      }
    });
    const highValue = makeItem("sanctified_greatsword", {
      id: "merchant-high-value",
      rolledAffixes: {
        attackPower: 18
      }
    });

    runtime.maybeQueueEquipmentCompare(lowValue, "merchant_purchase");
    expect(showEquipmentComparePrompt).not.toHaveBeenCalled();

    runtime.maybeQueueEquipmentCompare(highValue, "merchant_purchase");
    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(1);
  });

  it("defers compare prompts while the event panel is open and flushes them after close", () => {
    const { host, runtime, showEquipmentComparePrompt } = createHost();
    const first = makeItem("sanctified_greatsword", {
      rolledAffixes: {
        attackPower: 16
      }
    });
    const second = makeItem("oathbound_cuirass", {
      rolledAffixes: {
        armor: 14
      }
    });
    const onDrained = vi.fn();
    host.eventPanelOpen = true;

    runtime.maybeQueueEquipmentCompare(first, "boss_reward");
    runtime.maybeQueueEquipmentCompare(second, "boss_reward");

    expect(showEquipmentComparePrompt).not.toHaveBeenCalled();

    host.eventPanelOpen = false;
    runtime.flushImmediateComparePrompts(onDrained);

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(1);
    const firstOptions = showEquipmentComparePrompt.mock.calls[0]![2] as {
      onAction: (action: "equip" | "later" | "ignore") => void;
    };
    firstOptions.onAction("later");

    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(2);
    const secondOptions = showEquipmentComparePrompt.mock.calls[1]![2] as {
      onAction: (action: "equip" | "later" | "ignore") => void;
    };
    secondOptions.onAction("ignore");

    expect(onDrained).toHaveBeenCalledTimes(1);
    expect(showEquipmentComparePrompt).toHaveBeenCalledTimes(2);
  });

  it("renders a unique drop toast when the presentation rarity is unique", () => {
    const { host, showHeartbeatToast } = createHost();

    host.eventBus.emit("rare_drop_presented", {
      floor: 4,
      source: "boss_reward",
      timestampMs: 800,
      itemDefId: "sovereign_requiem",
      rarity: "unique"
    });

    expect(showHeartbeatToast).toHaveBeenCalledWith({
      title: "Unique Drop",
      detail: "Sovereign Requiem",
      tone: "rare"
    });
  });

  it("routes pressure peaks through the spike cue and localized toast copy", () => {
    const { host, showHeartbeatToast, routeFeedback } = createHost();

    host.eventBus.emit("pressure_peak", {
      floor: 3,
      kind: "elite_kill",
      timestampMs: 2_000,
      label: "Iron Revenant"
    });

    expect(routeFeedback).toHaveBeenCalledWith({
      type: "power_spike",
      major: false
    });
    expect(showHeartbeatToast).toHaveBeenCalledWith({
      title: "Elite Down",
      detail: "Iron Revenant just collapsed. The lane is open.",
      tone: "spike"
    });
  });
});
