import type Phaser from "phaser";

interface BackgroundRemovalOptions {
  alphaThreshold?: number;
  seedTolerance?: number;
  growTolerance?: number;
  localTolerance?: number;
  quantizeStep?: number;
  maxSeedColors?: number;
  minSeedCoverage?: number;
  minRemainingRatio?: number;
  minLargestComponentRatio?: number;
  whiteThreshold?: number;
  whiteSaturationTolerance?: number;
}

const DEFAULT_OPTIONS: Required<BackgroundRemovalOptions> = {
  alphaThreshold: 8,
  seedTolerance: 40,
  growTolerance: 34,
  localTolerance: 0,
  quantizeStep: 16,
  maxSeedColors: 3,
  minSeedCoverage: 0.82,
  minRemainingRatio: 0.12,
  minLargestComponentRatio: 0.72,
  whiteThreshold: 180,
  whiteSaturationTolerance: 45
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function colorDistanceSq(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function decodeQuantizedColor(key: number, step: number): Rgb {
  const q = Math.max(1, step);
  const half = Math.floor(q / 2);
  const r = ((key >> 16) & 0xff) * q + half;
  const g = ((key >> 8) & 0xff) * q + half;
  const b = (key & 0xff) * q + half;
  return {
    r: Math.min(255, r),
    g: Math.min(255, g),
    b: Math.min(255, b)
  };
}

function quantizeColor(color: Rgb, step: number): number {
  const q = Math.max(1, step);
  const r = Math.floor(color.r / q);
  const g = Math.floor(color.g / q);
  const b = Math.floor(color.b / q);
  return (r << 16) | (g << 8) | b;
}

function collectBorderPositions(width: number, height: number): number[] {
  const positions: number[] = [];

  for (let x = 0; x < width; x += 1) {
    positions.push(x);
    if (height > 1) {
      positions.push((height - 1) * width + x);
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    positions.push(y * width);
    if (width > 1) {
      positions.push(y * width + (width - 1));
    }
  }

  return positions;
}

function computeOpaqueMaskStats(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold: number
): { opaqueCount: number; largestComponentCount: number } {
  const totalPixels = width * height;
  const opaqueMask = new Uint8Array(totalPixels);
  let opaqueCount = 0;
  for (let pos = 0; pos < totalPixels; pos += 1) {
    if ((data[pos * 4 + 3] ?? 0) < alphaThreshold) {
      continue;
    }
    opaqueMask[pos] = 1;
    opaqueCount += 1;
  }

  if (opaqueCount === 0) {
    return { opaqueCount: 0, largestComponentCount: 0 };
  }

  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let largestComponentCount = 0;

  for (let start = 0; start < totalPixels; start += 1) {
    if (opaqueMask[start] !== 1 || visited[start] === 1) {
      continue;
    }

    visited[start] = 1;
    let componentCount = 0;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const current = queue[head] ?? -1;
      head += 1;
      if (current < 0) {
        continue;
      }

      componentCount += 1;
      const x = current % width;
      const y = Math.floor(current / width);

      const left = x > 0 ? current - 1 : -1;
      const right = x < width - 1 ? current + 1 : -1;
      const up = y > 0 ? current - width : -1;
      const down = y < height - 1 ? current + width : -1;
      const neighbors = [left, right, up, down];

      for (const next of neighbors) {
        if (next < 0 || opaqueMask[next] !== 1 || visited[next] === 1) {
          continue;
        }
        visited[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }

    if (componentCount > largestComponentCount) {
      largestComponentCount = componentCount;
    }
  }

  return { opaqueCount, largestComponentCount };
}

function pickSeedColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: Required<BackgroundRemovalOptions>
): Rgb[] {
  const histogram = new Map<number, number>();
  const borderPositions = collectBorderPositions(width, height);
  let validBorderPixelCount = 0;

  for (const position of borderPositions) {
    const i = position * 4;
    if ((data[i + 3] ?? 0) < options.alphaThreshold) {
      continue;
    }

    validBorderPixelCount += 1;
    const key = quantizeColor(
      {
        r: data[i] ?? 0,
        g: data[i + 1] ?? 0,
        b: data[i + 2] ?? 0
      },
      options.quantizeStep
    );
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }

  if (validBorderPixelCount === 0 || histogram.size === 0) {
    return [];
  }

  const ranked = [...histogram.entries()].sort((a, b) => b[1] - a[1]);
  const picked: Rgb[] = [];
  let covered = 0;
  for (const [key, count] of ranked) {
    picked.push(decodeQuantizedColor(key, options.quantizeStep));
    covered += count;
    if (
      picked.length >= options.maxSeedColors ||
      covered / validBorderPixelCount >= options.minSeedCoverage
    ) {
      break;
    }
  }

  return picked;
}

function isNearAny(color: Rgb, seeds: Rgb[], toleranceSq: number): boolean {
  for (const seed of seeds) {
    if (colorDistanceSq(color, seed) <= toleranceSq) {
      return true;
    }
  }
  return false;
}

function removeConnectedBackgroundPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: Required<BackgroundRemovalOptions>
): boolean {
  const snapshot = data.slice();
  const seeds = pickSeedColors(data, width, height, options);
  if (seeds.length === 0) {
    return false;
  }

  const seedToleranceSq = options.seedTolerance * options.seedTolerance;
  const growToleranceSq = options.growTolerance * options.growTolerance;
  const localToleranceSq = options.localTolerance * options.localTolerance;

  const borderPositions = collectBorderPositions(width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let opaqueBefore = 0;

  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) >= options.alphaThreshold) {
      opaqueBefore += 1;
    }
  }
  if (opaqueBefore === 0) {
    return false;
  }

  for (const position of borderPositions) {
    if (visited[position] === 1) {
      continue;
    }
    const pixelIdx = position * 4;
    if ((data[pixelIdx + 3] ?? 0) < options.alphaThreshold) {
      visited[position] = 1;
      continue;
    }

    const color = {
      r: data[pixelIdx] ?? 0,
      g: data[pixelIdx + 1] ?? 0,
      b: data[pixelIdx + 2] ?? 0
    };
    if (!isNearAny(color, seeds, seedToleranceSq)) {
      continue;
    }

    visited[position] = 1;
    queue[tail] = position;
    tail += 1;
  }

  const neighbors = [-1, 1, -width, width];
  while (head < tail) {
    const current = queue[head] ?? -1;
    head += 1;
    if (current < 0) {
      continue;
    }
    const currentX = current % width;
    const currentY = Math.floor(current / width);
    const currentIdx = current * 4;
    const currentColor = {
      r: data[currentIdx] ?? 0,
      g: data[currentIdx + 1] ?? 0,
      b: data[currentIdx + 2] ?? 0
    };

    for (const offset of neighbors) {
      const next = current + offset;
      if (next < 0 || next >= width * height || visited[next] === 1) {
        continue;
      }
      const nextX = next % width;
      const nextY = Math.floor(next / width);
      if (Math.abs(nextX - currentX) + Math.abs(nextY - currentY) !== 1) {
        continue;
      }

      const nextIdx = next * 4;
      if ((data[nextIdx + 3] ?? 0) < options.alphaThreshold) {
        visited[next] = 1;
        continue;
      }

      const nextColor = {
        r: data[nextIdx] ?? 0,
        g: data[nextIdx + 1] ?? 0,
        b: data[nextIdx + 2] ?? 0
      };
      const growsBySeed = isNearAny(nextColor, seeds, growToleranceSq);
      const growsByLocal = colorDistanceSq(nextColor, currentColor) <= localToleranceSq;
      if (!growsBySeed && !growsByLocal) {
        continue;
      }

      visited[next] = 1;
      queue[tail] = next;
      tail += 1;
    }
  }

  let removed = 0;
  for (let i = 0; i < visited.length; i += 1) {
    if (visited[i] !== 1) {
      continue;
    }
    const alphaIdx = i * 4 + 3;
    if ((data[alphaIdx] ?? 0) >= options.alphaThreshold) {
      data[alphaIdx] = 0;
      removed += 1;
    }
  }

  if (removed === 0) {
    return false;
  }

  const opaqueAfter = opaqueBefore - removed;
  const remainingRatio = opaqueAfter / opaqueBefore;
  if (remainingRatio < options.minRemainingRatio) {
    data.set(snapshot);
    return false;
  }

  const maskStats = computeOpaqueMaskStats(data, width, height, options.alphaThreshold);
  if (maskStats.opaqueCount === 0) {
    data.set(snapshot);
    return false;
  }
  const largestComponentRatio = maskStats.largestComponentCount / maskStats.opaqueCount;
  if (largestComponentRatio < options.minLargestComponentRatio) {
    data.set(snapshot);
    return false;
  }

  return true;
}

function isNearWhite(
  color: Rgb,
  whiteThreshold: number,
  whiteSaturationTolerance: number
): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max >= whiteThreshold && max - min <= whiteSaturationTolerance;
}

function removeConnectedNearWhitePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: Required<BackgroundRemovalOptions>
): boolean {
  const snapshot = data.slice();
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  let opaqueBefore = 0;
  const borderPositions = collectBorderPositions(width, height);

  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) >= options.alphaThreshold) {
      opaqueBefore += 1;
    }
  }
  if (opaqueBefore === 0) {
    return false;
  }

  for (const position of borderPositions) {
    const i = position * 4;
    if ((data[i + 3] ?? 0) < options.alphaThreshold) {
      continue;
    }
    const color = {
      r: data[i] ?? 0,
      g: data[i + 1] ?? 0,
      b: data[i + 2] ?? 0
    };
    if (!isNearWhite(color, options.whiteThreshold, options.whiteSaturationTolerance)) {
      continue;
    }
    visited[position] = 1;
    queue[tail] = position;
    tail += 1;
  }

  const neighbors = [-1, 1, -width, width];
  while (head < tail) {
    const current = queue[head] ?? -1;
    head += 1;
    if (current < 0) {
      continue;
    }
    const currentX = current % width;
    const currentY = Math.floor(current / width);
    for (const offset of neighbors) {
      const next = current + offset;
      if (next < 0 || next >= width * height || visited[next] === 1) {
        continue;
      }
      const nextX = next % width;
      const nextY = Math.floor(next / width);
      if (Math.abs(nextX - currentX) + Math.abs(nextY - currentY) !== 1) {
        continue;
      }
      const i = next * 4;
      if ((data[i + 3] ?? 0) < options.alphaThreshold) {
        continue;
      }
      const color = {
        r: data[i] ?? 0,
        g: data[i + 1] ?? 0,
        b: data[i + 2] ?? 0
      };
      if (!isNearWhite(color, options.whiteThreshold, options.whiteSaturationTolerance)) {
        continue;
      }
      visited[next] = 1;
      queue[tail] = next;
      tail += 1;
    }
  }

  let removed = 0;
  for (let i = 0; i < visited.length; i += 1) {
    if (visited[i] !== 1) {
      continue;
    }
    const alphaIdx = i * 4 + 3;
    if ((data[alphaIdx] ?? 0) >= options.alphaThreshold) {
      data[alphaIdx] = 0;
      removed += 1;
    }
  }

  if (removed === 0) {
    return false;
  }

  const opaqueAfter = opaqueBefore - removed;
  const remainingRatio = opaqueAfter / opaqueBefore;
  if (remainingRatio < options.minRemainingRatio) {
    data.set(snapshot);
    return false;
  }

  const maskStats = computeOpaqueMaskStats(data, width, height, options.alphaThreshold);
  if (maskStats.opaqueCount === 0) {
    data.set(snapshot);
    return false;
  }
  const largestComponentRatio = maskStats.largestComponentCount / maskStats.opaqueCount;
  if (largestComponentRatio < options.minLargestComponentRatio) {
    data.set(snapshot);
    return false;
  }

  return true;
}

function isCanvasImageSource(value: unknown): value is CanvasImageSource {
  return (
    value instanceof HTMLImageElement ||
    value instanceof HTMLCanvasElement ||
    value instanceof HTMLVideoElement ||
    (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas) ||
    (typeof SVGImageElement !== "undefined" && value instanceof SVGImageElement)
  );
}

function toImageSource(source: unknown): CanvasImageSource | null {
  if (isCanvasImageSource(source)) {
    return source;
  }

  if (Array.isArray(source)) {
    for (const candidate of source) {
      const resolved = toImageSource(candidate);
      if (resolved !== null) {
        return resolved;
      }
    }
    return null;
  }

  if (source !== null && typeof source === "object") {
    const candidates = [
      (source as { source?: unknown }).source,
      (source as { image?: unknown }).image,
      (source as { canvas?: unknown }).canvas
    ];
    for (const candidate of candidates) {
      const resolved = toImageSource(candidate);
      if (resolved !== null) {
        return resolved;
      }
    }
  }

  return null;
}

function resolveImageDimensions(source: CanvasImageSource): { width: number; height: number } | null {
  const withNatural = source as { naturalWidth?: number; naturalHeight?: number };
  const naturalWidth = withNatural.naturalWidth;
  const naturalHeight = withNatural.naturalHeight;
  if (typeof naturalWidth === "number" && typeof naturalHeight === "number" && naturalWidth > 0 && naturalHeight > 0) {
    return { width: naturalWidth, height: naturalHeight };
  }

  const withVideo = source as { videoWidth?: number; videoHeight?: number };
  const videoWidth = withVideo.videoWidth;
  const videoHeight = withVideo.videoHeight;
  if (typeof videoWidth === "number" && typeof videoHeight === "number" && videoWidth > 0 && videoHeight > 0) {
    return { width: videoWidth, height: videoHeight };
  }

  const withWidth = source as { width?: number; height?: number };
  const width = withWidth.width;
  const height = withWidth.height;
  if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) {
    return { width, height };
  }

  return null;
}

export type BackgroundRemovalResult = "removed" | "already_transparent" | "failed";

function isBorderMostlyTransparent(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold: number
): boolean {
  const positions = collectBorderPositions(width, height);
  if (positions.length === 0) {
    return false;
  }

  let transparent = 0;
  for (const pos of positions) {
    if ((data[pos * 4 + 3] ?? 0) < alphaThreshold) {
      transparent += 1;
    }
  }

  return transparent / positions.length >= 0.85;
}

export function removeConnectedBackgroundFromTexture(
  scene: Phaser.Scene,
  textureKey: string,
  overrides?: BackgroundRemovalOptions
): BackgroundRemovalResult {
  if (!scene.textures.exists(textureKey)) {
    return "failed";
  }

  const options: Required<BackgroundRemovalOptions> = {
    ...DEFAULT_OPTIONS,
    ...overrides
  };
  const texture = scene.textures.get(textureKey);
  const sourceImage = toImageSource(texture.getSourceImage());
  if (sourceImage === null) {
    return "failed";
  }

  const dimensions = resolveImageDimensions(sourceImage);
  if (dimensions === null) {
    return "failed";
  }
  const { width: sourceWidth, height: sourceHeight } = dimensions;

  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    return "failed";
  }

  context.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight);
  const imageData = context.getImageData(0, 0, sourceWidth, sourceHeight);

  if (isBorderMostlyTransparent(imageData.data, sourceWidth, sourceHeight, options.alphaThreshold)) {
    return "already_transparent";
  }

  const backup = imageData.data.slice();
  const removedNearWhite = removeConnectedNearWhitePixels(
    imageData.data,
    sourceWidth,
    sourceHeight,
    options
  );
  if (!removedNearWhite && !removeConnectedBackgroundPixels(imageData.data, sourceWidth, sourceHeight, options)) {
    imageData.data.set(backup);
    return "failed";
  }

  context.putImageData(imageData, 0, 0);
  scene.textures.remove(textureKey);
  scene.textures.addCanvas(textureKey, canvas);
  return "removed";
}
