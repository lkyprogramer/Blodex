import type {
  ItemDef,
  ItemInstance,
  MetaProgression,
  PlayerState,
  WeaponType,
  WeaponTypeDef
} from "./contracts/types";

const DEFAULT_WEAPON_TYPE: WeaponType = "sword";
const KNOWN_WEAPON_TYPES = new Set<WeaponType>(["sword", "axe", "dagger", "staff", "hammer", "sword_master"]);

export function normalizeWeaponType(input: unknown): WeaponType {
  if (typeof input === "string" && KNOWN_WEAPON_TYPES.has(input as WeaponType)) {
    return input as WeaponType;
  }
  return DEFAULT_WEAPON_TYPE;
}

export function resolveEquippedWeaponType(player: Pick<PlayerState, "equipment">): WeaponType {
  const weapon = player.equipment.weapon;
  return normalizeWeaponType(weapon?.weaponType);
}

export function resolveItemWeaponType(item: Pick<ItemDef | ItemInstance, "slot" | "weaponType"> | undefined): WeaponType {
  if (item === undefined || item.slot !== "weapon") {
    return DEFAULT_WEAPON_TYPE;
  }
  return normalizeWeaponType(item.weaponType);
}

function defaultWeaponTypeDef(weaponType: WeaponType): WeaponTypeDef {
  return {
    id: weaponType,
    attackSpeedMultiplier: 1,
    attackRange: 1.5,
    damageMultiplier: 1,
    mechanic: { type: "none" },
    unlock: { type: "default" }
  };
}

export function resolveWeaponTypeDef(
  weaponType: WeaponType,
  defs: Partial<Record<WeaponType, WeaponTypeDef>>
): WeaponTypeDef {
  return defs[weaponType] ?? defaultWeaponTypeDef(weaponType);
}

export function collectUnlockedWeaponTypes(
  meta: MetaProgression,
  defs: Partial<Record<WeaponType, WeaponTypeDef>>
): Set<WeaponType> {
  const unlocked = new Set<WeaponType>();
  const forged = new Set(meta.blueprintForgedIds);
  const candidateDefs = Object.values(defs).filter(
    (weaponTypeDef): weaponTypeDef is WeaponTypeDef => weaponTypeDef !== undefined
  );

  for (const def of candidateDefs) {
    if (def.unlock.type === "default") {
      unlocked.add(def.id);
      continue;
    }
    if (forged.has(def.unlock.blueprintId)) {
      unlocked.add(def.id);
    }
  }

  if (unlocked.size === 0) {
    unlocked.add(DEFAULT_WEAPON_TYPE);
  }

  return unlocked;
}

export function isItemDefUnlockedByWeaponType(itemDef: ItemDef, unlockedWeaponTypes: Set<WeaponType>): boolean {
  if (itemDef.slot !== "weapon") {
    return true;
  }
  return unlockedWeaponTypes.has(resolveItemWeaponType(itemDef));
}
