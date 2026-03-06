import type { BiomeId, BranchChoice, RunSummary } from "@blodex/core";
import { t } from "../../../i18n";
import type {
  BuildIdentitySnapshot,
  HeartbeatEvent,
  RunRecommendation
} from "./TasteRuntimePorts";

export interface NextRunSuggestion {
  id: string;
  lane: "stabilize" | "pivot";
  title: string;
  reason: string;
  action: string;
}

export interface RunOutcomeAnalysis {
  failureHeadline: string;
  missedOpportunities: string[];
  suggestions: [NextRunSuggestion, NextRunSuggestion];
}

export interface AnalyzeRunOutcomeInput {
  summary: RunSummary;
  buildIdentity: BuildIdentitySnapshot;
  heartbeats: HeartbeatEvent[];
  recommendations: RunRecommendation[];
  branchChoice?: BranchChoice;
  currentBiomeId?: BiomeId;
  lastDeathReason?: string;
}

function alternativeRoute(choice: BranchChoice | undefined): BranchChoice {
  return choice === "molten_route" ? "frozen_route" : "molten_route";
}

function routeName(choice: BranchChoice): string {
  return choice === "molten_route"
    ? t("ui.summary.route.molten")
    : t("ui.summary.route.frozen");
}

function routeReason(choice: BranchChoice): string {
  return choice === "molten_route"
    ? t("ui.summary.route_reason.molten")
    : t("ui.summary.route_reason.frozen");
}

function hasTag(snapshot: BuildIdentitySnapshot, tag: string): boolean {
  return snapshot.tags.includes(tag);
}

function countHeartbeats(events: HeartbeatEvent[], type: HeartbeatEvent["type"]): number {
  return events.filter((event) => event.type === type).length;
}

function fallbackRecommendation(
  recommendations: RunRecommendation[],
  excludedIds: Set<string>
): NextRunSuggestion {
  const candidate = recommendations.find((entry) => !excludedIds.has(entry.id));
  if (candidate !== undefined) {
    return {
      id: candidate.id,
      lane: "stabilize",
      title: candidate.title,
      reason: candidate.reason,
      action: candidate.action
    };
  }
  return {
    id: "stabilize-build",
    lane: "stabilize",
    title: t("ui.summary.suggestion.stabilize.title"),
    reason: t("ui.summary.suggestion.stabilize.reason"),
    action: t("ui.summary.suggestion.stabilize.action")
  };
}

export function analyzeRunOutcome(input: AnalyzeRunOutcomeInput): RunOutcomeAnalysis {
  const { summary, buildIdentity, heartbeats, recommendations } = input;
  const hasDefense = hasTag(buildIdentity, "build:defense");
  const hasOffense = hasTag(buildIdentity, "build:offense");
  const pickupCount = countHeartbeats(heartbeats, "key_pickup");
  const branchCount = countHeartbeats(heartbeats, "key_branch");
  const keyKillCount = countHeartbeats(heartbeats, "key_kill");
  const missedOpportunities: string[] = [];

  let failureHeadline = t("ui.summary.failure.attrition");
  if (summary.isVictory) {
    failureHeadline = t("ui.summary.failure.victory");
  } else if (summary.floorReached >= 5 || input.lastDeathReason?.toLowerCase().includes("boss") === true) {
    failureHeadline = t("ui.summary.failure.boss");
  } else if (!hasDefense) {
    failureHeadline = t("ui.summary.failure.defense");
  } else if (!hasOffense) {
    failureHeadline = t("ui.summary.failure.offense");
  } else if (summary.floorReached <= 2) {
    failureHeadline = t("ui.summary.failure.early");
  }

  if (!hasDefense) {
    missedOpportunities.push(t("ui.summary.missed.defense"));
  }
  if (!hasOffense) {
    missedOpportunities.push(t("ui.summary.missed.offense"));
  }
  if (pickupCount === 0 && heartbeats.length > 0) {
    missedOpportunities.push(t("ui.summary.missed.key_drop"));
  }
  if (branchCount < 2) {
    missedOpportunities.push(t("ui.summary.missed.branching"));
  }
  if (!summary.isVictory && summary.floorReached >= 5 && keyKillCount === 0) {
    missedOpportunities.push(t("ui.summary.missed.boss"));
  }
  if (missedOpportunities.length === 0) {
    missedOpportunities.push(t("ui.summary.missed.none"));
  }

  const usedSuggestionIds = new Set<string>();
  let stabilizeSuggestion: NextRunSuggestion = fallbackRecommendation(recommendations, usedSuggestionIds);
  if (!hasDefense) {
    stabilizeSuggestion = {
      id: "stabilize-defense",
      lane: "stabilize",
      title: t("ui.summary.suggestion.defense.title"),
      reason: t("ui.summary.suggestion.defense.reason"),
      action: t("ui.summary.suggestion.defense.action")
    };
  } else if (!hasOffense) {
    stabilizeSuggestion = {
      id: "stabilize-offense",
      lane: "stabilize",
      title: t("ui.summary.suggestion.offense.title"),
      reason: t("ui.summary.suggestion.offense.reason"),
      action: t("ui.summary.suggestion.offense.action")
    };
  } else if (pickupCount === 0) {
    stabilizeSuggestion = {
      id: "stabilize-loot",
      lane: "stabilize",
      title: t("ui.summary.suggestion.loot.title"),
      reason: t("ui.summary.suggestion.loot.reason"),
      action: t("ui.summary.suggestion.loot.action")
    };
  } else {
    stabilizeSuggestion = {
      ...stabilizeSuggestion,
      lane: "stabilize"
    };
  }
  usedSuggestionIds.add(stabilizeSuggestion.id);

  const nextRoute = alternativeRoute(input.branchChoice);
  const pivotSuggestion: NextRunSuggestion = {
    id: `pivot-route-${nextRoute}`,
    lane: "pivot",
    title: t("ui.summary.suggestion.route.title", {
      route: routeName(nextRoute)
    }),
    reason: routeReason(nextRoute),
    action:
      branchCount < 2
        ? t("ui.summary.suggestion.route.action_branch", {
            route: routeName(nextRoute)
          })
        : t("ui.summary.suggestion.route.action_default", {
            route: routeName(nextRoute)
          })
  };

  return {
    failureHeadline,
    missedOpportunities: missedOpportunities.slice(0, 3),
    suggestions: [
      stabilizeSuggestion,
      pivotSuggestion
    ]
  };
}
