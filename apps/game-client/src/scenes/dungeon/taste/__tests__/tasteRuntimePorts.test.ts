import { describe, expect, it } from "vitest";
import type { ItemInstance } from "@blodex/core";
import { TasteRuntimePortHub } from "../TasteRuntimePorts";

function makeRareItem(defId: string, affixes: ItemInstance["rolledAffixes"]): ItemInstance {
  return {
    id: `${defId}-id`,
    defId,
    name: defId,
    kind: "equipment",
    slot: "weapon",
    rarity: "rare",
    requiredLevel: 1,
    iconId: defId,
    seed: `seed-${defId}`,
    rolledAffixes: affixes
  };
}

describe("TasteRuntimePortHub", () => {
  it("captures build identity from key item and level-up choices", () => {
    const hub = new TasteRuntimePortHub();
    hub.recordDrop(makeRareItem("item_weapon_rare", { attackPower: 12, critChance: 0.1 }), 2, "combat", 1000);
    hub.recordLevelUpChoice("vitality", 2, "levelup", 1200);
    hub.recordBranch("merchant", 2, 1400);

    const snapshot = hub.snapshotBuildIdentity();
    expect(snapshot.keyItemDefIds).toContain("item_weapon_rare");
    expect(snapshot.tags).toContain("build:offense");
    expect(snapshot.tags).toContain("build:defense");
    expect(snapshot.tags).toContain("build:branching");
    expect(snapshot.pivots.length).toBeGreaterThanOrEqual(3);
  });

  it("produces fallback recommendations when build axis is missing", () => {
    const hub = new TasteRuntimePortHub();
    hub.recordBranch("event", 1, 500);

    const recommendations = hub.buildRecommendations();
    expect(recommendations.some((entry) => entry.id === "defense-gap")).toBe(true);
    expect(recommendations.some((entry) => entry.id === "offense-gap")).toBe(true);
  });

  it("clears run-scoped state when resetRunState is called", () => {
    const hub = new TasteRuntimePortHub();
    hub.recordDrop(makeRareItem("item_weapon_rare", { attackPower: 12 }), 1, "combat", 100);
    hub.recordBranch("merchant", 1, 200);
    expect(hub.snapshotBuildIdentity().tags.length).toBeGreaterThan(0);
    expect(hub.listHeartbeatEvents().length).toBeGreaterThan(0);

    hub.resetRunState();

    const snapshot = hub.snapshotBuildIdentity();
    expect(snapshot.tags).toHaveLength(0);
    expect(snapshot.keyItemDefIds).toHaveLength(0);
    expect(snapshot.pivots).toHaveLength(0);
    expect(hub.listHeartbeatEvents()).toHaveLength(0);
  });
});
