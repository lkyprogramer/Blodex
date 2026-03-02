import type { BlueprintDef, BlueprintDropSource, MetaProgression, RngLike } from "./contracts/types";

export interface BlueprintRollContext {
  sourceType: BlueprintDropSource["type"];
  sourceId?: string;
  floor: number;
}

function matchesSource(
  source: BlueprintDropSource,
  context: BlueprintRollContext,
  alreadyFoundIds: Set<string>,
  blueprintId: string
): boolean {
  if (source.type !== context.sourceType) {
    return false;
  }
  if (source.sourceId !== undefined && source.sourceId !== context.sourceId) {
    return false;
  }
  if (source.floorMin !== undefined && context.floor < source.floorMin) {
    return false;
  }
  if (source.onlyIfNotFound === true && alreadyFoundIds.has(blueprintId)) {
    return false;
  }
  return true;
}

function rollSingleBlueprint(
  def: BlueprintDef,
  context: BlueprintRollContext,
  rng: RngLike,
  alreadyFoundIds: Set<string>
): boolean {
  for (const source of def.dropSources) {
    if (!matchesSource(source, context, alreadyFoundIds, def.id)) {
      continue;
    }
    if (rng.next() <= source.chance) {
      return true;
    }
  }
  return false;
}

export function rollBlueprintDiscoveries(
  defs: BlueprintDef[],
  context: BlueprintRollContext,
  rng: RngLike,
  alreadyFoundIds: string[]
): string[] {
  const known = new Set(alreadyFoundIds);
  const discovered: string[] = [];
  for (const def of defs) {
    if (known.has(def.id)) {
      continue;
    }
    if (!rollSingleBlueprint(def, context, rng, known)) {
      continue;
    }
    discovered.push(def.id);
    known.add(def.id);
  }
  return discovered;
}

export function mergeFoundBlueprints(meta: MetaProgression, runFound: string[]): MetaProgression {
  if (runFound.length === 0) {
    return meta;
  }
  const merged = [...meta.blueprintFoundIds];
  const known = new Set(merged);
  for (const blueprintId of runFound) {
    if (known.has(blueprintId)) {
      continue;
    }
    known.add(blueprintId);
    merged.push(blueprintId);
  }
  return {
    ...meta,
    blueprintFoundIds: merged
  };
}

export function canForgeBlueprint(meta: MetaProgression, blueprint: BlueprintDef): boolean {
  if (!meta.blueprintFoundIds.includes(blueprint.id)) {
    return false;
  }
  if (meta.blueprintForgedIds.includes(blueprint.id)) {
    return false;
  }
  return meta.soulShards >= blueprint.forgeCost;
}

export function forgeBlueprint(meta: MetaProgression, blueprint: BlueprintDef): MetaProgression {
  if (!canForgeBlueprint(meta, blueprint)) {
    return meta;
  }
  return {
    ...meta,
    soulShards: meta.soulShards - blueprint.forgeCost,
    totalShardsSpent: meta.totalShardsSpent + blueprint.forgeCost,
    blueprintForgedIds: [...meta.blueprintForgedIds, blueprint.id]
  };
}
