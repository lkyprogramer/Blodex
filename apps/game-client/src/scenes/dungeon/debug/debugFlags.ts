const DEBUG_FLAG_VALUES = new Set(["1", "true", "yes", "on"]);

export function resolveDebugQueryFlag(queryKey: string, search = window.location.search): boolean {
  const raw = new URLSearchParams(search).get(queryKey);
  if (raw === null) {
    return false;
  }
  return DEBUG_FLAG_VALUES.has(raw.trim().toLowerCase());
}

export function resolveDebugCheatsEnabled(queryKey: string): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  return resolveDebugQueryFlag(queryKey);
}

export function resolveDebugLockedEquipEnabled(options: {
  debugCheatsEnabled: boolean;
  queryKey: string;
}): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  return options.debugCheatsEnabled || resolveDebugQueryFlag(options.queryKey);
}
