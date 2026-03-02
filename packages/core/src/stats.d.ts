import type { AggregatedBuffEffect, BaseStats, DerivedStats, ItemInstance, PermanentUpgrade } from "./contracts/types";
import type { TalentEffectTotals } from "./talent";
export declare function deriveStats(base: BaseStats, equippedItems: ItemInstance[], buffEffects?: AggregatedBuffEffect, permanentUpgrades?: PermanentUpgrade, talentEffects?: Pick<TalentEffectTotals, "derivedFlat" | "derivedPercent">): DerivedStats;
export declare function defaultBaseStats(): BaseStats;
//# sourceMappingURL=stats.d.ts.map