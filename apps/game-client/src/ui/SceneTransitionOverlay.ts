import { resolveGeneratedAssetUrl } from "../assets/imageAsset";

interface SceneTransitionOptions {
  title: string;
  subtitle?: string;
  durationMs?: number;
  mode?: "scene" | "floor";
  backdropAssetId?: string;
  accentAssetId?: string;
}

let hideTimer: number | null = null;

function getOverlayRoot(): HTMLDivElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector<HTMLDivElement>("#scene-transition-overlay");
}

export function hideSceneTransition(): void {
  const root = getOverlayRoot();
  if (root === null) {
    return;
  }
  root.classList.add("hidden");
  root.classList.remove("active");
  root.innerHTML = "";
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

export function playSceneTransition(options: SceneTransitionOptions): void {
  const root = getOverlayRoot();
  if (root === null) {
    return;
  }
  const durationMs = Math.max(160, options.durationMs ?? 480);
  const backdropHtml =
    options.backdropAssetId === undefined
      ? ""
      : `<img class="scene-transition-backdrop" src="${resolveGeneratedAssetUrl(options.backdropAssetId, "webp")}" alt="" />`;
  const accentHtml =
    options.accentAssetId === undefined
      ? ""
      : `<img class="scene-transition-accent" src="${resolveGeneratedAssetUrl(options.accentAssetId, "webp")}" alt="" />`;
  root.innerHTML = `
    <div class="scene-transition-card ${options.mode === "floor" ? "floor" : "scene"}">
      ${backdropHtml}
      ${accentHtml}
      <div class="scene-transition-title">${options.title}</div>
      ${options.subtitle === undefined ? "" : `<div class="scene-transition-subtitle">${options.subtitle}</div>`}
    </div>
  `;
  root.className = "scene-transition-overlay";
  root.classList.remove("hidden");
  root.classList.remove("active");
  window.requestAnimationFrame(() => {
    root.classList.add("active");
  });

  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
  }
  hideTimer = window.setTimeout(() => {
    hideSceneTransition();
  }, durationMs);
}
