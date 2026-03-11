import { resolveEquippedItemSetEffects, type PlayerState, type SynergyRuntimeEffects } from "@blodex/core";
import { BUFF_DEF_MAP, ITEM_SET_DEFS, ITEM_SET_DEF_MAP } from "@blodex/content";
import { getI18nService, t } from "../../../i18n";
import type { HudStatusBuffEntry, HudStatusRailState, HudStatusTone } from "../../../ui/hud/HudStatusRailTypes";

const MAX_VISIBLE_BUFFS = 6;
const BUFF_PRIORITY: Record<HudStatusTone, number> = {
  debuff: 0,
  survival: 1,
  offense: 2,
  utility: 3
};
const BUFF_TONE_BY_ID: Partial<Record<string, HudStatusTone>> = {
  frost_slow: "debuff",
  war_cry: "offense",
  guaranteed_crit: "offense",
  frenzy_tonic: "offense",
  phantom_brew: "utility"
};

export interface HudStatusRailBuildResult {
  state?: HudStatusRailState;
  nextRefreshAt: number;
}

function localizeBuffLabel(buffId: string, fallback: string): string {
  const i18n = getI18nService();
  const key = `ui.hud.status.buff.${buffId}`;
  return i18n.hasKey(key) ? i18n.t(key) : fallback;
}

function localizeSynergyLabel(synergyId: string): string {
  const i18n = getI18nService();
  const key = `ui.feedback.synergy.${synergyId}.title`;
  return i18n.hasKey(key) ? i18n.t(key) : synergyId;
}

function toShortLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= 3) {
    return trimmed.toUpperCase();
  }
  const words = trimmed.split(/\s+/).filter((segment) => segment.length > 0);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return trimmed.slice(0, 3).toUpperCase();
}

function buildBuffEntries(player: PlayerState, nowMs: number): { entries: HudStatusBuffEntry[]; nextRefreshAt: number } {
  const entries = (player.activeBuffs ?? [])
    .filter((buff) => buff.expiresAtMs > nowMs)
    .map((buff) => {
      const buffDef = BUFF_DEF_MAP[buff.defId];
      const label = localizeBuffLabel(buff.defId, buffDef?.name ?? buff.defId);
      const remainingMs = Math.max(0, buff.expiresAtMs - nowMs);
      const tone = BUFF_TONE_BY_ID[buff.defId] ?? "utility";
      return {
        id: buff.defId,
        label,
        shortLabel: toShortLabel(label),
        remainingMs,
        tone
      } satisfies HudStatusBuffEntry;
    })
    .sort((left, right) => {
      const byTone = BUFF_PRIORITY[left.tone] - BUFF_PRIORITY[right.tone];
      if (byTone !== 0) {
        return byTone;
      }
      if (left.remainingMs !== right.remainingMs) {
        return left.remainingMs - right.remainingMs;
      }
      return left.label.localeCompare(right.label);
    });

  const nextExpiry = entries.reduce((next, entry) => Math.min(next, nowMs + entry.remainingMs), Number.POSITIVE_INFINITY);
  return {
    entries,
    nextRefreshAt:
      entries.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(nextExpiry, nowMs + 250)
  };
}

export function buildHudStatusRailState(input: {
  player: PlayerState;
  synergyRuntime: Pick<SynergyRuntimeEffects, "activeSynergyIds">;
  nowMs: number;
  itemSetName(setId: string, fallback: string): string;
}): HudStatusRailBuildResult {
  const buffState = buildBuffEntries(input.player, input.nowMs);
  const equippedItems = Object.values(input.player.equipment).filter((item): item is NonNullable<typeof item> => item !== undefined);
  const itemSetEffects = resolveEquippedItemSetEffects(equippedItems, ITEM_SET_DEFS);
  const indicators = [
    ...Object.entries(itemSetEffects.countsBySetId)
      .filter((entry): entry is [string, number] => typeof entry[0] === "string" && (entry[1] ?? 0) > 0)
      .sort((left, right) => {
        if (left[1] !== right[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .map(([setId, pieces]) => {
      const setDef = ITEM_SET_DEF_MAP[setId];
      const activeThresholds = itemSetEffects.activeThresholdsBySetId[setId] ?? [];
      const maxPieces = Math.max(...(setDef?.bonuses.map((bonus) => bonus.pieces) ?? [pieces]));
      return {
        id: `set:${setId}`,
        label: input.itemSetName(setId, setDef?.name ?? setId),
        detail:
          activeThresholds.length === 0
            ? `${pieces}/${maxPieces}`
            : t("ui.hud.status.set_detail", {
                pieces,
                total: maxPieces,
                active: activeThresholds.join("/")
              }),
        tone: "set" as const
      };
    }),
    ...input.synergyRuntime.activeSynergyIds.map((synergyId) => ({
      id: `synergy:${synergyId}`,
      label: localizeSynergyLabel(synergyId),
      tone: "synergy" as const
    }))
  ];

  if (buffState.entries.length === 0 && indicators.length === 0) {
    return {
      nextRefreshAt: Number.POSITIVE_INFINITY
    };
  }

  return {
    state: {
      buffs: buffState.entries.slice(0, MAX_VISIBLE_BUFFS),
      overflowCount: Math.max(0, buffState.entries.length - MAX_VISIBLE_BUFFS),
      indicators
    },
    nextRefreshAt: buffState.nextRefreshAt
  };
}
