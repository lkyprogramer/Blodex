import { describe, expect, it } from "vitest";
import { BLUEPRINT_DEFS, ITEM_DEFS, RANDOM_EVENT_DEFS, WEAPON_TYPE_DEFS } from "@blodex/content";

describe("content integrity", () => {
  it("event blueprint unlock targets match random event unlock ids", () => {
    const validUnlockIds = new Set(
      RANDOM_EVENT_DEFS.flatMap((eventDef) => (eventDef.unlockId === undefined ? [] : [eventDef.unlockId]))
    );
    const danglingEventBlueprints = BLUEPRINT_DEFS.filter(
      (blueprint) => blueprint.category === "event" && !validUnlockIds.has(blueprint.unlockTargetId)
    ).map((blueprint) => blueprint.id);

    expect(danglingEventBlueprints).toEqual([]);
  });

  it("weapon blueprints are consumed by weapon type unlock definitions", () => {
    const consumedWeaponBlueprintIds = new Set(
      WEAPON_TYPE_DEFS.flatMap((weaponTypeDef) =>
        weaponTypeDef.unlock.type === "blueprint" ? [weaponTypeDef.unlock.blueprintId] : []
      )
    );
    const danglingWeaponBlueprints = BLUEPRINT_DEFS.filter(
      (blueprint) => blueprint.category === "weapon" && !consumedWeaponBlueprintIds.has(blueprint.id)
    ).map((blueprint) => blueprint.id);

    expect(danglingWeaponBlueprints).toEqual([]);
  });

  it("blueprint-locked weapon types have at least one corresponding weapon item", () => {
    const itemWeaponTypes = new Set(
      ITEM_DEFS.flatMap((itemDef) =>
        itemDef.slot === "weapon" && itemDef.weaponType !== undefined ? [itemDef.weaponType] : []
      )
    );
    const missingWeaponTypeItems = WEAPON_TYPE_DEFS.filter(
      (weaponTypeDef) => weaponTypeDef.unlock.type === "blueprint" && !itemWeaponTypes.has(weaponTypeDef.id)
    ).map((weaponTypeDef) => weaponTypeDef.id);

    expect(missingWeaponTypeItems).toEqual([]);
  });
});
