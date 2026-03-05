import type { BaseStats, ItemInstance } from "@blodex/core";

const MAX_HEARTBEAT_EVENTS = 128;
const MAX_BUILD_PIVOTS = 64;
const MAX_KEY_ITEMS = 16;

export type HeartbeatEventType =
  | "key_drop"
  | "key_pickup"
  | "key_levelup"
  | "key_kill"
  | "key_branch";

export interface HeartbeatEvent {
  type: HeartbeatEventType;
  floor: number;
  source: string;
  timestampMs: number;
  detail: string;
}

export interface BuildPivotPoint {
  type: "item" | "levelup" | "branch" | "kill";
  floor: number;
  source: string;
  timestampMs: number;
  detail: string;
}

export interface BuildIdentitySnapshot {
  tags: string[];
  keyItemDefIds: string[];
  pivots: BuildPivotPoint[];
}

export interface RunRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  reason: string;
  action: string;
}

export interface BuildIdentityPort {
  recordDrop(item: ItemInstance, floor: number, source: string, timestampMs: number): void;
  recordPickup(item: ItemInstance, floor: number, source: string, timestampMs: number): void;
  recordLevelUpChoice(stat: keyof BaseStats, floor: number, source: string, timestampMs: number): void;
  recordBranch(source: string, floor: number, timestampMs: number): void;
  recordKeyKill(kind: "boss" | "elite", floor: number, source: string, timestampMs: number): void;
  snapshotBuildIdentity(): BuildIdentitySnapshot;
}

export interface HeartbeatEventPort {
  recordHeartbeat(event: HeartbeatEvent): void;
  listHeartbeatEvents(limit?: number): HeartbeatEvent[];
}

export interface RunRecommendationPort {
  buildRecommendations(): RunRecommendation[];
}

export class TasteRuntimePortHub implements BuildIdentityPort, HeartbeatEventPort, RunRecommendationPort {
  private readonly tags = new Set<string>();
  private readonly keyItemDefIds: string[] = [];
  private readonly pivots: BuildPivotPoint[] = [];
  private readonly heartbeatEvents: HeartbeatEvent[] = [];

  recordDrop(item: ItemInstance, floor: number, source: string, timestampMs: number): void {
    if (item.rarity !== "rare" && item.kind !== "unique") {
      return;
    }
    this.pushKeyItem(item.defId);
    this.addBuildTagsFromItem(item);
    this.pushPivot({
      type: "item",
      floor,
      source,
      timestampMs,
      detail: `${item.defId}:${item.rarity}`
    });
    this.recordHeartbeat({
      type: "key_drop",
      floor,
      source,
      timestampMs,
      detail: item.defId
    });
  }

  recordPickup(item: ItemInstance, floor: number, source: string, timestampMs: number): void {
    if (item.rarity !== "rare" && item.kind !== "unique") {
      return;
    }
    this.pushKeyItem(item.defId);
    this.addBuildTagsFromItem(item);
    this.recordHeartbeat({
      type: "key_pickup",
      floor,
      source,
      timestampMs,
      detail: item.defId
    });
  }

  recordLevelUpChoice(stat: keyof BaseStats, floor: number, source: string, timestampMs: number): void {
    this.tags.add(`stat:${stat}`);
    if (stat === "strength" || stat === "dexterity" || stat === "intelligence") {
      this.tags.add("build:offense");
    }
    if (stat === "vitality") {
      this.tags.add("build:defense");
    }
    this.pushPivot({
      type: "levelup",
      floor,
      source,
      timestampMs,
      detail: stat
    });
    this.recordHeartbeat({
      type: "key_levelup",
      floor,
      source,
      timestampMs,
      detail: stat
    });
  }

  recordBranch(source: string, floor: number, timestampMs: number): void {
    this.tags.add("build:branching");
    this.pushPivot({
      type: "branch",
      floor,
      source,
      timestampMs,
      detail: source
    });
    this.recordHeartbeat({
      type: "key_branch",
      floor,
      source,
      timestampMs,
      detail: source
    });
  }

  recordKeyKill(kind: "boss" | "elite", floor: number, source: string, timestampMs: number): void {
    this.tags.add(kind === "boss" ? "kill:boss" : "kill:elite");
    this.pushPivot({
      type: "kill",
      floor,
      source,
      timestampMs,
      detail: kind
    });
    this.recordHeartbeat({
      type: "key_kill",
      floor,
      source,
      timestampMs,
      detail: kind
    });
  }

  snapshotBuildIdentity(): BuildIdentitySnapshot {
    return {
      tags: [...this.tags],
      keyItemDefIds: [...this.keyItemDefIds],
      pivots: [...this.pivots]
    };
  }

  recordHeartbeat(event: HeartbeatEvent): void {
    this.heartbeatEvents.push(event);
    if (this.heartbeatEvents.length > MAX_HEARTBEAT_EVENTS) {
      this.heartbeatEvents.splice(0, this.heartbeatEvents.length - MAX_HEARTBEAT_EVENTS);
    }
  }

  listHeartbeatEvents(limit = MAX_HEARTBEAT_EVENTS): HeartbeatEvent[] {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    return this.heartbeatEvents.slice(-normalizedLimit);
  }

  buildRecommendations(): RunRecommendation[] {
    const recommendations: RunRecommendation[] = [];
    const eventCount = this.heartbeatEvents.length;
    const hasDefense = this.tags.has("build:defense");
    const hasOffense = this.tags.has("build:offense");
    const branchCount = this.heartbeatEvents.filter((event) => event.type === "key_branch").length;
    const pickupCount = this.heartbeatEvents.filter((event) => event.type === "key_pickup").length;

    if (!hasDefense) {
      recommendations.push({
        id: "defense-gap",
        priority: "high",
        title: "补足防御轴",
        reason: "本局未形成明确防御标签。",
        action: "下局优先选择 VIT 或含护甲/回复词缀的装备。"
      });
    }

    if (!hasOffense) {
      recommendations.push({
        id: "offense-gap",
        priority: "high",
        title: "补足输出轴",
        reason: "本局缺少明确输出构筑标签。",
        action: "下局优先选择 STR/DEX/INT 分支并锁定主伤害技能。"
      });
    }

    if (branchCount < 2) {
      recommendations.push({
        id: "branch-low",
        priority: "medium",
        title: "增加构筑分岔",
        reason: `本局关键分岔事件仅 ${branchCount} 次。`,
        action: "优先触发商店/事件/升级选择，避免线性推进。"
      });
    }

    if (pickupCount === 0 && eventCount > 0) {
      recommendations.push({
        id: "key-item-miss",
        priority: "medium",
        title: "提高关键件命中率",
        reason: "本局未获得关键掉落。",
        action: "提高清图密度并优先处理精英与高价值房间。"
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: "stabilize-build",
        priority: "low",
        title: "保持主轴连贯",
        reason: "构筑标签较完整，暂无明显短板。",
        action: "下局围绕当前主轴继续堆叠同向词缀。"
      });
    }

    return recommendations;
  }

  private pushKeyItem(itemDefId: string): void {
    if (this.keyItemDefIds.includes(itemDefId)) {
      return;
    }
    this.keyItemDefIds.push(itemDefId);
    if (this.keyItemDefIds.length > MAX_KEY_ITEMS) {
      this.keyItemDefIds.splice(0, this.keyItemDefIds.length - MAX_KEY_ITEMS);
    }
  }

  private pushPivot(pivot: BuildPivotPoint): void {
    this.pivots.push(pivot);
    if (this.pivots.length > MAX_BUILD_PIVOTS) {
      this.pivots.splice(0, this.pivots.length - MAX_BUILD_PIVOTS);
    }
  }

  private addBuildTagsFromItem(item: ItemInstance): void {
    const allAffixEntries = [
      ...Object.entries(item.rolledAffixes),
      ...Object.entries(item.rolledSpecialAffixes ?? {})
    ];
    for (const [key, value] of allAffixEntries) {
      if (value === undefined || value <= 0) {
        continue;
      }
      if (key === "attackPower" || key === "critChance" || key === "critDamage" || key === "attackSpeed") {
        this.tags.add("build:offense");
      }
      if (key === "maxHealth" || key === "armor" || key === "healthRegen" || key === "thorns") {
        this.tags.add("build:defense");
      }
      if (key === "moveSpeed" || key === "aoeRadius" || key === "cooldownReduction" || key === "xpBonus") {
        this.tags.add("build:utility");
      }
    }
  }
}
