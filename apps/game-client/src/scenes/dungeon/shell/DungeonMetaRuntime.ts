import {
  collectTalentEffectTotals,
  createInitialMeta,
  equipItem,
  isDifficultyUnlocked,
  migrateMeta,
  normalizeDifficultyMode,
  resolveSelectedDifficulty,
  type DifficultyMode,
  type MetaProgression,
  type PlayerState,
  type WeaponType
} from "@blodex/core";
import { MUTATION_DEFS, TALENT_DEFS } from "@blodex/content";
import type { RunLogService } from "../logging/RunLogService";
import type { DungeonScene } from "../../DungeonScene";

const META_STORAGE_KEY_V1 = "blodex_meta_v1";
const META_STORAGE_KEY_V2 = "blodex_meta_v2";
const DAILY_WEAPON_ROTATION: WeaponType[] = ["sword", "axe", "dagger", "staff", "hammer"];
const DAILY_MUTATION_COUNT = 2;

export interface DungeonMetaSource {
  pendingRunMode: DungeonScene["pendingRunMode"];
  pendingDifficulty: DungeonScene["pendingDifficulty"];
  meta: MetaProgression;
  talentEffects: DungeonScene["talentEffects"];
  dailyFixedWeaponType: DungeonScene["dailyFixedWeaponType"];
  runSeed: string;
  runLog: Pick<RunLogService, "appendKey">;
  refreshPlayerStatsFromEquipment(player: PlayerState): PlayerState;
}

export class DungeonMetaRuntime {
  constructor(private readonly resolveSource: () => DungeonMetaSource) {}

  private get source(): DungeonMetaSource {
    return this.resolveSource();
  }

  loadMeta(): MetaProgression {
    const rawV2 = window.localStorage.getItem(META_STORAGE_KEY_V2);
    if (rawV2 !== null) {
      try {
        return migrateMeta(JSON.parse(rawV2));
      } catch {
        return createInitialMeta();
      }
    }

    const rawV1 = window.localStorage.getItem(META_STORAGE_KEY_V1);
    if (rawV1 !== null) {
      try {
        const migrated = migrateMeta(JSON.parse(rawV1));
        window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(migrated));
        return migrated;
      } catch {
        return createInitialMeta();
      }
    }

    return createInitialMeta();
  }

  saveMeta(meta: MetaProgression): boolean {
    const source = this.source;
    try {
      window.localStorage.setItem(META_STORAGE_KEY_V2, JSON.stringify(meta));
      source.talentEffects = collectTalentEffectTotals(meta.talentPoints, TALENT_DEFS);
      return true;
    } catch {
      return false;
    }
  }

  refreshTalentEffects(): void {
    this.source.talentEffects = collectTalentEffectTotals(this.source.meta.talentPoints, TALENT_DEFS);
  }

  resolveSelectedDifficultyForRun(): DifficultyMode {
    const source = this.source;
    if (source.pendingRunMode === "daily") {
      source.pendingDifficulty = null;
      return resolveSelectedDifficulty(source.meta);
    }
    const requested = source.pendingDifficulty ?? source.meta.selectedDifficulty;
    const normalized = normalizeDifficultyMode(requested, "normal");
    const resolved = isDifficultyUnlocked(source.meta, normalized)
      ? normalized
      : resolveSelectedDifficulty(source.meta);
    source.pendingDifficulty = null;
    if (resolved !== source.meta.selectedDifficulty) {
      source.meta = {
        ...source.meta,
        selectedDifficulty: resolved
      };
      this.saveMeta(source.meta);
    }
    return resolved;
  }

  resolveDailyWeaponType(runSeed: string): WeaponType {
    let hash = 0;
    for (let idx = 0; idx < runSeed.length; idx += 1) {
      hash = (hash * 31 + runSeed.charCodeAt(idx)) >>> 0;
    }
    return DAILY_WEAPON_ROTATION[hash % DAILY_WEAPON_ROTATION.length] ?? "sword";
  }

  resolveDailyMutationIds(runSeed: string): string[] {
    const candidates = MUTATION_DEFS.map((entry) => entry.id).sort((left, right) => left.localeCompare(right));
    if (candidates.length === 0) {
      return [];
    }
    let hash = 2166136261;
    for (let idx = 0; idx < runSeed.length; idx += 1) {
      hash ^= runSeed.charCodeAt(idx);
      hash = Math.imul(hash, 16777619);
    }
    const picked: string[] = [];
    const pool = [...candidates];
    while (picked.length < DAILY_MUTATION_COUNT && pool.length > 0) {
      const index = hash % pool.length;
      const [selected] = pool.splice(index, 1);
      if (selected !== undefined) {
        picked.push(selected);
      }
      hash = Math.imul(hash ^ 0x9e3779b9, 16777619) >>> 0;
    }
    return picked;
  }

  applyDailyLoadout(player: PlayerState, nowMs: number): PlayerState {
    const source = this.source;
    if (source.dailyFixedWeaponType === null) {
      return player;
    }
    const dailyWeapon = this.createDailyWeaponInstance(source.dailyFixedWeaponType);
    const inventory = [
      ...player.inventory.filter((entry) => !(entry.slot === "weapon" && entry.id.startsWith("daily_weapon_"))),
      dailyWeapon
    ];
    let nextPlayer: PlayerState = {
      ...player,
      inventory
    };
    nextPlayer = equipItem(nextPlayer, dailyWeapon.id);
    source.runLog.appendKey(
      "log.run.daily_loadout_active",
      {
        weaponName: dailyWeapon.name
      },
      "info",
      nowMs
    );
    return source.refreshPlayerStatsFromEquipment(nextPlayer);
  }

  private createDailyWeaponInstance(weaponType: WeaponType) {
    const source = this.source;
    const baseAttackPower =
      weaponType === "hammer" ? 9 : weaponType === "staff" ? 7 : weaponType === "axe" ? 8 : 7;
    const baseCritChance = weaponType === "dagger" ? 0.04 : weaponType === "staff" ? 0.01 : 0.02;
    return {
      id: `daily_weapon_${weaponType}_${source.runSeed.slice(0, 8)}`,
      defId: `daily_weapon_${weaponType}`,
      name: `Daily Armament (${weaponType})`,
      slot: "weapon",
      kind: "equipment",
      weaponType,
      rarity: "magic",
      requiredLevel: 1,
      iconId: "item_weapon_02",
      seed: `${source.runSeed}:daily_weapon:${weaponType}`,
      rolledAffixes: {
        attackPower: baseAttackPower,
        critChance: baseCritChance,
        attackSpeed: 2
      }
    } satisfies PlayerState["inventory"][number];
  }
}
