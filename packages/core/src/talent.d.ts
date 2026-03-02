import type { BaseStats, DerivedStats, MetaProgression, PermanentUpgrade, TalentNodeDef } from "./contracts/types";
export interface TalentEffectTotals {
    baseStats: Partial<Record<keyof BaseStats, number>>;
    derivedFlat: Partial<Record<keyof DerivedStats, number>>;
    derivedPercent: Partial<Record<"attackPower" | "attackSpeed" | "moveSpeed" | "critChance", number>>;
    economy: Partial<Record<"deathRetention" | "merchantDiscount", number>>;
    capacity: Partial<Record<"skillSlots" | "potionCharges", number>>;
    trigger: Partial<Record<"lethalGuard" | "phaseDodge" | "manaShield", number>>;
}
export declare function createEmptyTalentEffectTotals(): TalentEffectTotals;
export declare function normalizeTalentPoints(input: unknown): Record<string, number>;
export declare function collectTalentEffectTotals(talentPoints: Record<string, number>, talentDefs: TalentNodeDef[]): TalentEffectTotals;
export declare function canPurchaseTalent(meta: MetaProgression, node: TalentNodeDef): boolean;
export declare function derivePermanentUpgradesFromTalents(talentPoints: Record<string, number>): PermanentUpgrade;
export declare function mapLegacyPermanentUpgradesToTalents(permanentUpgrades: PermanentUpgrade): Record<string, number>;
export declare function calculateTotalShardsSpentFromTalents(talentPoints: Record<string, number>, talentDefs: TalentNodeDef[]): number;
export declare function estimateLegacyShardsSpentFromTalents(talentPoints: Record<string, number>): number;
export declare function purchaseTalent(meta: MetaProgression, node: TalentNodeDef): MetaProgression;
//# sourceMappingURL=talent.d.ts.map