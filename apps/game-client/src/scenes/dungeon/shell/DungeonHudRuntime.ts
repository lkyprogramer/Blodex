import {
  canUseConsumable,
  CONSUMABLE_DEFS,
  createSkillDefForLevel,
  describeEndlessMutator,
  type BossRuntimeState,
  type ConsumableId,
  type ConsumableState,
  type MetaProgression,
  type PlayerState,
  type RunState,
  type SkillDef
} from "@blodex/core";
import { SKILL_DEFS, type FloorConfig } from "@blodex/content";
import type { UIManager } from "../../../ui/UIManager";
import type { HudPresenter } from "../ui/HudPresenter";
import {
  buildHudStatHighlightEntries,
  collectActiveHudStatHighlights,
  type HudStatHighlightEntry
} from "../../../ui/hud/compare/StatDeltaHighlighter";
import { t } from "../../../i18n";
import { consumableDescriptionLabel, consumableFailureReasonLabel, consumableNameLabel, difficultyLabel } from "../../../i18n/labelResolvers";

const SKILL_READY_FLASH_DURATION_MS = 480;
const CONSUMABLE_ICON_BY_ID: Record<ConsumableId, string> = {
  health_potion: "item_consumable_health_potion_01",
  mana_potion: "item_consumable_mana_potion_01",
  scroll_of_mapping: "item_consumable_scroll_mapping_01"
};
const SKILL_DEF_BY_ID = new Map(SKILL_DEFS.map((entry) => [entry.id, entry]));

export interface DungeonHudSource {
  time: { now: number };
  player: PlayerState;
  consumables: ConsumableState;
  meta: MetaProgression;
  run: RunState;
  currentBiome: { id: string; name: string };
  bossState: BossRuntimeState | null;
  floorConfig: FloorConfig;
  uiManager: Pick<UIManager, "getLogs" | "renderSnapshot">;
  hudPresenter: Pick<HudPresenter, "buildSnapshot">;
  statHighlightEntries: HudStatHighlightEntry[];
  levelUpPulseUntilMs: number;
  levelUpPulseLevel: number | null;
  previousSkillCooldownLeftById: Map<string, number>;
  skillReadyFlashUntilMsById: Map<string, number>;
  newlyAcquiredItemUntilMs: Map<string, number>;
  nextTransientHudRefreshAt: number;
  debugCheatsEnabled: boolean;
  runEnded: boolean;
  staircaseState: { visible: boolean };
  mapRevealActive: boolean;
  contentLocalizer: {
    biomeName(id: string, fallback: string): string;
    skillName(id: string, fallback: string): string;
    skillDescription(id: string, fallback: string): string;
  };
  resolveRuntimeSkillDef(skillDef: SkillDef): SkillDef;
}

function collectNewlyAcquiredItemIds(source: DungeonHudSource, nowMs: number): string[] {
  if (source.newlyAcquiredItemUntilMs.size === 0) {
    return [];
  }
  const inventoryIds = new Set(source.player.inventory.map((item) => item.id));
  const visibleIds: string[] = [];
  for (const [itemId, expiresAtMs] of source.newlyAcquiredItemUntilMs) {
    if (expiresAtMs <= nowMs || !inventoryIds.has(itemId)) {
      source.newlyAcquiredItemUntilMs.delete(itemId);
      continue;
    }
    visibleIds.push(itemId);
  }
  return visibleIds;
}

function recomputeNextTransientHudRefreshAt(
  source: DungeonHudSource,
  nowMs: number,
  hasActiveSkillCooldown: boolean,
  nextStatHighlightAt = Number.POSITIVE_INFINITY
): void {
  let next = Number.POSITIVE_INFINITY;
  for (const expiresAtMs of source.newlyAcquiredItemUntilMs.values()) {
    if (expiresAtMs > nowMs && expiresAtMs < next) {
      next = expiresAtMs;
    }
  }
  for (const expiresAtMs of source.skillReadyFlashUntilMsById.values()) {
    if (expiresAtMs > nowMs && expiresAtMs < next) {
      next = expiresAtMs;
    }
  }
  if (hasActiveSkillCooldown) {
    next = Math.min(next, nowMs + 120);
  }
  if (source.levelUpPulseUntilMs > nowMs) {
    next = Math.min(next, source.levelUpPulseUntilMs);
  }
  if (nextStatHighlightAt > nowMs) {
    next = Math.min(next, nextStatHighlightAt);
  }
  source.nextTransientHudRefreshAt = next;
}

export class DungeonHudRuntime {
  constructor(private readonly resolveSource: () => DungeonHudSource) {}

  private get source(): DungeonHudSource {
    return this.resolveSource();
  }

  render(): void {
    const source = this.source;
    const nowMs = source.time.now;
    const newlyAcquiredItemIds = collectNewlyAcquiredItemIds(source, nowMs);
    const statHighlightSnapshot = collectActiveHudStatHighlights(source.statHighlightEntries, nowMs);
    source.statHighlightEntries = statHighlightSnapshot.persisted;
    if (source.levelUpPulseUntilMs <= nowMs) {
      source.levelUpPulseLevel = null;
    }
    const levelUpPulseLevel =
      source.levelUpPulseUntilMs > nowMs ? (source.levelUpPulseLevel ?? source.player.level) : undefined;
    const consumables = CONSUMABLE_DEFS.map((def) => {
      const cooldownLeftMs = Math.max(0, (source.consumables.cooldowns[def.id] ?? 0) - nowMs);
      const availability = canUseConsumable(source.player, source.consumables, def.id, nowMs);
      return {
        id: def.id,
        name: consumableNameLabel(def.id, def.name),
        description: consumableDescriptionLabel(def.id, def.description),
        hotkey: def.hotkey ?? "-",
        iconId: CONSUMABLE_ICON_BY_ID[def.id],
        charges: source.consumables.charges[def.id] ?? 0,
        cooldownLeftMs,
        ...(availability.ok ? {} : { disabledReason: consumableFailureReasonLabel(availability.reason) })
      };
    });

    const activeSkillIds = new Set<string>();
    let hasActiveSkillCooldown = false;
    const skillSlots = (source.player.skills?.skillSlots ?? []).map((slot, index) => {
      if (slot === null) {
        return {
          hotkey: String(index + 1),
          name: t("ui.skillbar.locked_slot_name"),
          description: t("ui.skillbar.locked_slot_description"),
          iconId: "meta_unlock_locked",
          cooldownLeftMs: 0,
          outOfMana: false,
          locked: true
        };
      }
      activeSkillIds.add(slot.defId);
      const skillDef = SKILL_DEF_BY_ID.get(slot.defId);
      const scaledSkillDef = skillDef === undefined ? undefined : createSkillDefForLevel(skillDef, slot.level);
      const runtimeSkillDef =
        scaledSkillDef === undefined ? undefined : source.resolveRuntimeSkillDef(scaledSkillDef);
      const cooldownLeftMs = Math.max(0, (source.player.skills?.cooldowns[slot.defId] ?? 0) - nowMs);
      if (cooldownLeftMs > 0) {
        hasActiveSkillCooldown = true;
      }
      const previousCooldownLeftMs = source.previousSkillCooldownLeftById.get(slot.defId) ?? 0;
      if (previousCooldownLeftMs > 0 && cooldownLeftMs === 0) {
        source.skillReadyFlashUntilMsById.set(slot.defId, nowMs + SKILL_READY_FLASH_DURATION_MS);
      }
      source.previousSkillCooldownLeftById.set(slot.defId, cooldownLeftMs);
      const readyFlashUntilMs = source.skillReadyFlashUntilMsById.get(slot.defId) ?? 0;
      const readyFlash = readyFlashUntilMs > nowMs;
      if (!readyFlash && readyFlashUntilMs > 0) {
        source.skillReadyFlashUntilMsById.delete(slot.defId);
      }
      const baseCooldownMs = runtimeSkillDef?.cooldownMs ?? scaledSkillDef?.cooldownMs ?? skillDef?.cooldownMs ?? 0;
      const resolvedName = runtimeSkillDef?.name ?? scaledSkillDef?.name ?? skillDef?.name ?? slot.defId;
      const resolvedDescription =
        runtimeSkillDef?.description ?? scaledSkillDef?.description ?? skillDef?.description ?? "";
      return {
        id: slot.defId,
        hotkey: String(index + 1),
        name: `${source.contentLocalizer.skillName(slot.defId, resolvedName)} Lv.${slot.level}`,
        description: source.contentLocalizer.skillDescription(slot.defId, resolvedDescription),
        iconId: runtimeSkillDef?.icon ?? scaledSkillDef?.icon ?? skillDef?.icon ?? "meta_unlock_available",
        cooldownLeftMs,
        baseCooldownMs,
        cooldownProgress: baseCooldownMs > 0 ? Math.min(1, Math.max(0, cooldownLeftMs / baseCooldownMs)) : 0,
        readyFlash,
        manaCost: runtimeSkillDef?.manaCost ?? scaledSkillDef?.manaCost ?? skillDef?.manaCost ?? 0,
        targeting: runtimeSkillDef?.targeting ?? scaledSkillDef?.targeting ?? skillDef?.targeting ?? "self",
        range: runtimeSkillDef?.range ?? scaledSkillDef?.range ?? skillDef?.range ?? 0,
        outOfMana:
          source.player.mana <
          (runtimeSkillDef?.manaCost ?? scaledSkillDef?.manaCost ?? skillDef?.manaCost ?? 0),
        locked: false
      };
    });

    for (const skillId of [...source.previousSkillCooldownLeftById.keys()]) {
      if (!activeSkillIds.has(skillId)) {
        source.previousSkillCooldownLeftById.delete(skillId);
        source.skillReadyFlashUntilMsById.delete(skillId);
      }
    }

    const runState = {
      floor: source.run.currentFloor,
      difficulty: source.run.difficulty,
      runMode: source.run.runMode,
      inEndless: source.run.inEndless,
      endlessFloor: source.run.endlessFloor,
      endlessMutators: (source.run.mutatorActiveIds ?? []).map((mutatorId) => describeEndlessMutator(mutatorId)),
      biome: source.contentLocalizer.biomeName(source.currentBiome.id, source.currentBiome.name),
      kills: source.run.kills,
      lootCollected: source.run.lootCollected,
      targetKills: source.floorConfig.monsterCount,
      obols: source.run.runEconomy.obols,
      floorGoalReached: source.staircaseState.visible || source.mapRevealActive,
      mappingRevealed: source.mapRevealActive,
      newlyAcquiredItemIds,
      ...(levelUpPulseLevel === undefined ? {} : { levelUpPulseLevel }),
      ...(statHighlightSnapshot.active.length === 0 ? {} : { statHighlights: statHighlightSnapshot.active }),
      consumables,
      skillSlots,
      isBossFloor: source.floorConfig.isBossFloor,
      bossPhase: source.bossState?.currentPhaseIndex ?? 0,
      ...(source.bossState === null
        ? {}
        : {
            bossHealth: source.bossState.health,
            bossMaxHealth: source.bossState.maxHealth
          })
    };
    recomputeNextTransientHudRefreshAt(source, nowMs, hasActiveSkillCooldown, statHighlightSnapshot.nextRefreshAt);

    const snapshot = source.hudPresenter.buildSnapshot({
      view: {
        player: source.player,
        run: runState,
        meta: source.meta
      },
      logs: source.uiManager.getLogs(),
      flags: {
        runEnded: source.runEnded,
        eventPanelOpen: false,
        debugCheatsEnabled: source.debugCheatsEnabled,
        timestampMs: nowMs
      }
    });
    source.uiManager.renderSnapshot(snapshot);
  }

  registerStatDeltaHighlights(
    beforeStats: PlayerState["derivedStats"],
    afterStats: PlayerState["derivedStats"],
    nowMs: number
  ): void {
    const source = this.source;
    const nextEntries = buildHudStatHighlightEntries(
      beforeStats,
      afterStats,
      nowMs,
      1_300
    );
    if (nextEntries.length === 0) {
      return;
    }
    const activeEntries = source.statHighlightEntries.filter((entry) => entry.expiresAtMs > nowMs);
    const mergedByKey = new Map(activeEntries.map((entry) => [entry.key, entry] as const));
    for (const entry of nextEntries) {
      mergedByKey.set(entry.key, entry);
      if (entry.expiresAtMs < source.nextTransientHudRefreshAt) {
        source.nextTransientHudRefreshAt = entry.expiresAtMs;
      }
    }
    source.statHighlightEntries = [...mergedByKey.values()];
  }
}
