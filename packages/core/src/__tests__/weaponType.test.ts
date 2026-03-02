import { describe, expect, it } from "vitest";
import type { ItemDef, WeaponType, WeaponTypeDef } from "../contracts/types";
import { createInitialMeta } from "../run";
import {
  collectUnlockedWeaponTypes,
  isItemDefUnlockedByWeaponType,
  resolveEquippedWeaponType,
  resolveItemWeaponType
} from "../weaponType";

const WEAPON_TYPE_DEFS: Record<WeaponTypeDef["id"], WeaponTypeDef> = {
  sword: {
    id: "sword",
    attackSpeedMultiplier: 1,
    attackRange: 1.5,
    damageMultiplier: 1,
    mechanic: { type: "none" },
    unlock: { type: "default" }
  },
  axe: {
    id: "axe",
    attackSpeedMultiplier: 0.9,
    attackRange: 1.6,
    damageMultiplier: 1.12,
    mechanic: { type: "aoe_cleave", radius: 1.2, secondaryDamagePercent: 0.35 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_axe" }
  },
  dagger: {
    id: "dagger",
    attackSpeedMultiplier: 1.2,
    attackRange: 1.35,
    damageMultiplier: 0.88,
    mechanic: { type: "crit_bonus", critChanceBonus: 0.08, critDamageMultiplier: 1.8 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_dagger" }
  },
  staff: {
    id: "staff",
    attackSpeedMultiplier: 0.95,
    attackRange: 1.7,
    damageMultiplier: 0.95,
    mechanic: { type: "skill_amp", skillDamagePercent: 0.18 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_staff" }
  },
  hammer: {
    id: "hammer",
    attackSpeedMultiplier: 0.82,
    attackRange: 1.45,
    damageMultiplier: 1.2,
    mechanic: { type: "stagger", chance: 0.2, slowPercent: 0.3, durationMs: 1200 },
    unlock: { type: "blueprint", blueprintId: "bp_weapon_hammer" }
  }
};

describe("weapon type", () => {
  it("resolves equipped weapon type with sword fallback", () => {
    const swordType = resolveEquippedWeaponType({
      equipment: {}
    });
    expect(swordType).toBe("sword");

    const daggerType = resolveEquippedWeaponType({
      equipment: {
        weapon: {
          id: "item-dagger",
          defId: "dagger",
          name: "Dagger",
          slot: "weapon",
          weaponType: "dagger",
          rarity: "common",
          requiredLevel: 1,
          iconId: "item_weapon_01",
          seed: "seed",
          rolledAffixes: {}
        }
      }
    });
    expect(daggerType).toBe("dagger");
  });

  it("collects unlocked weapon types from forged blueprints", () => {
    const meta = {
      ...createInitialMeta(),
      blueprintForgedIds: ["bp_weapon_axe", "bp_weapon_staff"]
    };
    const unlocked = collectUnlockedWeaponTypes(meta, WEAPON_TYPE_DEFS);
    expect([...unlocked.values()].sort()).toEqual(["axe", "staff", "sword"]);
  });

  it("filters locked weapon drops", () => {
    const unlocked = new Set<WeaponType>(["sword"]);
    const swordDef: ItemDef = {
      id: "rusted_sabre",
      name: "Rusted Sabre",
      slot: "weapon",
      weaponType: "sword",
      rarity: "common",
      requiredLevel: 1,
      iconId: "item_weapon_01",
      minAffixes: 0,
      maxAffixes: 0,
      affixPool: []
    };
    const axeDef: ItemDef = {
      ...swordDef,
      id: "raider_axe",
      name: "Raider Axe",
      weaponType: "axe"
    };
    expect(isItemDefUnlockedByWeaponType(swordDef, unlocked)).toBe(true);
    expect(isItemDefUnlockedByWeaponType(axeDef, unlocked)).toBe(false);
    expect(resolveItemWeaponType(axeDef)).toBe("axe");
  });
});
