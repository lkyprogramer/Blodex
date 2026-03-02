const LEGACY_TALENT_TO_UPGRADE = {
    core_vitality_training: { startingHealth: 10 },
    core_iron_skin: { startingArmor: 2 },
    core_keen_eye: { luckBonus: 0.05 },
    utility_skill_slot_i: { skillSlots: 1 },
    utility_skill_slot_ii: { skillSlots: 1 },
    utility_potion_satchel: { potionCharges: 1 }
};
const LEGACY_TALENT_COST = {
    core_vitality_training: 24,
    core_iron_skin: 24,
    core_keen_eye: 20,
    utility_skill_slot_i: 30,
    utility_skill_slot_ii: 35,
    utility_potion_satchel: 25
};
const LEGACY_UPGRADE_TO_TALENT = {
    startingHealth: {
        talentId: "core_vitality_training",
        perRank: 10,
        maxRank: 1
    },
    startingArmor: {
        talentId: "core_iron_skin",
        perRank: 2,
        maxRank: 1
    },
    luckBonus: {
        talentId: "core_keen_eye",
        perRank: 0.05,
        maxRank: 1
    },
    skillSlots: {
        talentId: "utility_skill_slot_i",
        perRank: 1,
        maxRank: 2
    },
    potionCharges: {
        talentId: "utility_potion_satchel",
        perRank: 1,
        maxRank: 1
    }
};
function clampRank(value, maxRank) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(maxRank, Math.floor(value)));
}
export function createEmptyTalentEffectTotals() {
    return {
        baseStats: {},
        derivedFlat: {},
        derivedPercent: {},
        economy: {},
        capacity: {},
        trigger: {}
    };
}
export function normalizeTalentPoints(input) {
    if (typeof input !== "object" || input === null) {
        return {};
    }
    const normalized = {};
    for (const [talentId, rank] of Object.entries(input)) {
        if (typeof rank !== "number" || !Number.isFinite(rank)) {
            continue;
        }
        const clamped = Math.max(0, Math.floor(rank));
        if (clamped > 0) {
            normalized[talentId] = clamped;
        }
    }
    return normalized;
}
export function collectTalentEffectTotals(talentPoints, talentDefs) {
    const totals = createEmptyTalentEffectTotals();
    for (const node of talentDefs) {
        const rank = clampRank(talentPoints[node.id] ?? 0, node.maxRank);
        if (rank <= 0) {
            continue;
        }
        const mirroredByLegacyUpgrade = Object.prototype.hasOwnProperty.call(LEGACY_TALENT_TO_UPGRADE, node.id);
        for (const effect of node.effects) {
            // Legacy-compatible talents are already materialized into permanentUpgrades.
            // Skip these effects here to avoid applying the same bonus twice.
            if (mirroredByLegacyUpgrade) {
                continue;
            }
            const scaledValue = effect.value * rank;
            if (effect.type === "base_stat_flat") {
                totals.baseStats[effect.stat] = (totals.baseStats[effect.stat] ?? 0) + scaledValue;
                continue;
            }
            if (effect.type === "derived_stat_flat") {
                totals.derivedFlat[effect.stat] = (totals.derivedFlat[effect.stat] ?? 0) + scaledValue;
                continue;
            }
            if (effect.type === "derived_stat_percent") {
                totals.derivedPercent[effect.stat] = (totals.derivedPercent[effect.stat] ?? 0) + scaledValue;
                continue;
            }
            if (effect.type === "economy") {
                totals.economy[effect.key] = (totals.economy[effect.key] ?? 0) + scaledValue;
                continue;
            }
            if (effect.type === "capacity") {
                totals.capacity[effect.key] = (totals.capacity[effect.key] ?? 0) + scaledValue;
                continue;
            }
            totals.trigger[effect.key] = (totals.trigger[effect.key] ?? 0) + scaledValue;
        }
    }
    return totals;
}
function talentMeetsPrerequisites(talentPoints, node) {
    return node.prerequisites.every((prerequisite) => {
        return (talentPoints[prerequisite.talentId] ?? 0) >= prerequisite.minRank;
    });
}
export function canPurchaseTalent(meta, node) {
    const currentRank = meta.talentPoints[node.id] ?? 0;
    if (currentRank >= node.maxRank) {
        return false;
    }
    if (meta.soulShards < node.cost) {
        return false;
    }
    return talentMeetsPrerequisites(meta.talentPoints, node);
}
export function derivePermanentUpgradesFromTalents(talentPoints) {
    const next = {
        startingHealth: 0,
        startingArmor: 0,
        luckBonus: 0,
        skillSlots: 2,
        potionCharges: 0
    };
    for (const [talentId, deltas] of Object.entries(LEGACY_TALENT_TO_UPGRADE)) {
        const rank = Math.max(0, Math.floor(talentPoints[talentId] ?? 0));
        if (rank <= 0) {
            continue;
        }
        if (deltas.startingHealth !== undefined) {
            next.startingHealth += deltas.startingHealth * rank;
        }
        if (deltas.startingArmor !== undefined) {
            next.startingArmor += deltas.startingArmor * rank;
        }
        if (deltas.luckBonus !== undefined) {
            next.luckBonus += deltas.luckBonus * rank;
        }
        if (deltas.skillSlots !== undefined) {
            next.skillSlots += deltas.skillSlots * rank;
        }
        if (deltas.potionCharges !== undefined) {
            next.potionCharges += deltas.potionCharges * rank;
        }
    }
    return next;
}
export function mapLegacyPermanentUpgradesToTalents(permanentUpgrades) {
    const talentPoints = {};
    const healthEntry = LEGACY_UPGRADE_TO_TALENT.startingHealth;
    const healthRank = clampRank(permanentUpgrades.startingHealth / healthEntry.perRank, healthEntry.maxRank);
    if (healthRank > 0) {
        talentPoints[healthEntry.talentId] = healthRank;
    }
    const armorEntry = LEGACY_UPGRADE_TO_TALENT.startingArmor;
    const armorRank = clampRank(permanentUpgrades.startingArmor / armorEntry.perRank, armorEntry.maxRank);
    if (armorRank > 0) {
        talentPoints[armorEntry.talentId] = armorRank;
    }
    const luckEntry = LEGACY_UPGRADE_TO_TALENT.luckBonus;
    const luckRank = clampRank(permanentUpgrades.luckBonus / luckEntry.perRank, luckEntry.maxRank);
    if (luckRank > 0) {
        talentPoints[luckEntry.talentId] = luckRank;
    }
    const skillSlotExtra = Math.max(0, Math.floor(permanentUpgrades.skillSlots) - 2);
    if (skillSlotExtra >= 1) {
        talentPoints.utility_skill_slot_i = 1;
    }
    if (skillSlotExtra >= 2) {
        talentPoints.utility_skill_slot_ii = 1;
    }
    const potionEntry = LEGACY_UPGRADE_TO_TALENT.potionCharges;
    const potionRank = clampRank(permanentUpgrades.potionCharges / potionEntry.perRank, potionEntry.maxRank);
    if (potionRank > 0) {
        talentPoints[potionEntry.talentId] = potionRank;
    }
    return talentPoints;
}
export function calculateTotalShardsSpentFromTalents(talentPoints, talentDefs) {
    let total = 0;
    for (const node of talentDefs) {
        const rank = clampRank(talentPoints[node.id] ?? 0, node.maxRank);
        if (rank <= 0) {
            continue;
        }
        total += node.cost * rank;
    }
    return total;
}
export function estimateLegacyShardsSpentFromTalents(talentPoints) {
    let total = 0;
    for (const [talentId, cost] of Object.entries(LEGACY_TALENT_COST)) {
        const rank = Math.max(0, Math.floor(talentPoints[talentId] ?? 0));
        if (rank <= 0) {
            continue;
        }
        total += rank * cost;
    }
    return total;
}
export function purchaseTalent(meta, node) {
    if (!canPurchaseTalent(meta, node)) {
        return meta;
    }
    const nextTalentPoints = {
        ...meta.talentPoints,
        [node.id]: (meta.talentPoints[node.id] ?? 0) + 1
    };
    return {
        ...meta,
        soulShards: meta.soulShards - node.cost,
        totalShardsSpent: meta.totalShardsSpent + node.cost,
        talentPoints: nextTalentPoints,
        permanentUpgrades: derivePermanentUpgradesFromTalents(nextTalentPoints)
    };
}
//# sourceMappingURL=talent.js.map