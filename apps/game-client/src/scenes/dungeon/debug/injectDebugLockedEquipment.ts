import type { ItemInstance, PlayerState } from "@blodex/core";
import { t } from "../../../i18n";
import { RunLogService } from "../logging/RunLogService";

export interface InjectDebugLockedEquipmentOptions {
  player: PlayerState;
  nowMs: number;
  runSeed: string;
  iconId: string;
  runLog: RunLogService;
}

export function injectDebugLockedEquipment(options: InjectDebugLockedEquipmentOptions): PlayerState {
  const { player, nowMs, runSeed, iconId, runLog } = options;
  const existing = player.inventory.find((item) => item.defId === "debug_locked_ring");
  if (existing !== undefined) {
    return player;
  }

  const requiredLevel = Math.max(player.level + 2, 3);
  const debugItem: ItemInstance = {
    id: `debug_locked_ring_${Math.floor(nowMs)}`,
    defId: "debug_locked_ring",
    name: `Debug Sealed Ring (Lv${requiredLevel})`,
    slot: "ring",
    kind: "equipment",
    rarity: "rare",
    requiredLevel,
    iconId,
    seed: `debug-${runSeed}`,
    rolledAffixes: {
      attackPower: 4,
      armor: 2
    }
  };

  runLog.debug(
    t("log.debug.locked_item_added", {
      itemName: debugItem.name
    }),
    "info",
    nowMs
  );

  return {
    ...player,
    inventory: [...player.inventory, debugItem]
  };
}
