export type PreferredImageFormat = "webp" | "png";

let cachedPreferredFormat: PreferredImageFormat | null = null;

function normalizeAssetId(assetId: string): string {
  const normalized = assetId.trim();
  if (normalized.length === 0) {
    throw new Error("assetId must not be empty");
  }
  return normalized;
}

function browserSupportsWebp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    if (canvas.getContext === undefined) {
      return false;
    }

    const encoded = canvas.toDataURL("image/webp");
    return encoded.startsWith("data:image/webp");
  } catch {
    return false;
  }
}

export function detectPreferredImageFormat(): PreferredImageFormat {
  if (cachedPreferredFormat !== null) {
    return cachedPreferredFormat;
  }

  cachedPreferredFormat = browserSupportsWebp() ? "webp" : "png";
  return cachedPreferredFormat;
}

export function resolveGeneratedAssetUrl(assetId: string, preferred: PreferredImageFormat): string {
  const id = normalizeAssetId(assetId);
  return `/generated/${encodeURIComponent(id)}.${preferred}`;
}

export function resolveGeneratedPngFallback(assetId: string): string {
  return resolveGeneratedAssetUrl(assetId, "png");
}
