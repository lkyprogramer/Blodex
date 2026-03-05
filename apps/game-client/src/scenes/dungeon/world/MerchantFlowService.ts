import {
  collectLoot,
  createMerchantOffers,
  resolveEndlessMutatorModifiers,
  rollItemDrop,
  spendRunObols,
  type ItemDef
} from "@blodex/core";
import { ITEM_DEF_MAP, LOOT_TABLE_MAP } from "@blodex/content";
import type { MerchantPurchaseResult, RuntimeEventHost } from "./types";

export interface MerchantFlowServiceOptions {
  host: RuntimeEventHost;
}

export class MerchantFlowService {
  constructor(private readonly options: MerchantFlowServiceOptions) {}

  ensureOffers(nowMs: number): boolean {
    const host = this.options.host;
    const merchantPool = LOOT_TABLE_MAP.merchant_pool;
    if (merchantPool === undefined) {
      host.runLog.appendKey("log.merchant.pool_missing", undefined, "warn", nowMs);
      return false;
    }
    if (host.merchantOffers.length > 0) {
      return true;
    }

    const visibleEntries = merchantPool.entries.filter((entry) => {
      const itemDef = ITEM_DEF_MAP[entry.itemDefId];
      return itemDef !== undefined && host.isItemDefUnlocked(itemDef);
    });
    const mutatorModifiers = resolveEndlessMutatorModifiers(host.run.mutatorActiveIds ?? []);
    const scarcitySurcharge = visibleEntries.length <= 4 ? 2 : visibleEntries.length <= 6 ? 1 : 0;
    const floorPriceStep =
      host.run.currentFloor >= 6 ? Math.floor((host.run.currentFloor - 5) / 2) : 0;
    host.merchantOffers = createMerchantOffers(
      visibleEntries,
      host.run.currentFloor,
      host.merchantRng,
      3,
      {
        floorPriceStep,
        scarcitySurcharge,
        priceMultiplier: mutatorModifiers.merchantPriceMultiplier
      }
    );
    host.eventBus.emit("merchant:offer", {
      floor: host.run.currentFloor,
      offerCount: host.merchantOffers.length,
      timestampMs: nowMs
    });
    if (host.merchantOffers.length > 0) {
      host.markHighValueChoice("merchant", nowMs);
    }
    return true;
  }

  buildView(): Array<Record<string, unknown>> {
    const host = this.options.host;
    return host.merchantOffers.map((offer: { itemDefId: string }) => {
      const itemDef = ITEM_DEF_MAP[offer.itemDefId];
      return {
        ...offer,
        itemName:
          itemDef === undefined
            ? offer.itemDefId
            : host.contentLocalizer.itemName(itemDef.id, itemDef.name),
        rarity: itemDef?.rarity ?? "common"
      };
    });
  }

  tryBuyOffer(offerId: string, nowMs: number): MerchantPurchaseResult {
    const host = this.options.host;
    const offer = host.merchantOffers.find((entry: { offerId: string }) => entry.offerId === offerId);
    if (offer === undefined) {
      host.runLog.appendKey(
        "log.merchant.offer_unavailable",
        {
          offerId
        },
        "warn",
        nowMs
      );
      return { kind: "missing_offer" };
    }
    if (host.run.runEconomy.obols < offer.priceObol) {
      host.runLog.appendKey(
        "log.merchant.not_enough_obol",
        {
          itemDefId: offer.itemDefId
        },
        "warn",
        nowMs
      );
      return { kind: "insufficient_obol" };
    }

    const item = rollItemDrop(
      {
        id: `merchant-${offer.itemDefId}`,
        entries: [{ itemDefId: offer.itemDefId, weight: 1, minFloor: 1 }]
      },
      ITEM_DEF_MAP,
      host.run.currentFloor,
      host.lootRng,
      `merchant-${offer.offerId}-${Math.floor(nowMs)}`,
      host.resolveLootRollOptions({
        isItemEligible: (itemDef: ItemDef) => host.isItemDefUnlocked(itemDef)
      })
    );
    if (item === null) {
      host.runLog.appendKey(
        "log.merchant.delivery_failed",
        {
          itemDefId: offer.itemDefId
        },
        "warn",
        nowMs
      );
      return { kind: "delivery_failed" };
    }

    host.run = spendRunObols(host.run, offer.priceObol);
    host.player = collectLoot(host.player, item);
    host.run = {
      ...host.run,
      lootCollected: host.run.lootCollected + 1
    };
    host.eventBus.emit("merchant:purchase", {
      offerId: offer.offerId,
      itemId: item.id,
      itemName: host.contentLocalizer.itemName(item.defId, item.name),
      priceObol: offer.priceObol,
      timestampMs: nowMs
    });
    host.merchantOffers = host.merchantOffers.filter((entry: { offerId: string }) => entry.offerId !== offer.offerId);

    if (host.merchantOffers.length === 0) {
      host.runLog.appendKey("log.merchant.sold_out", undefined, "info", nowMs);
      return { kind: "sold_out" };
    }
    return { kind: "remaining_offers" };
  }
}
