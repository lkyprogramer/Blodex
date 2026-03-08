import { t } from "../../i18n";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseTooltipNumber(raw: string | undefined): number {
  if (raw === undefined) {
    return 0;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function formatCooldownLabel(cooldownLeftMs: number): string {
  return cooldownLeftMs > 0
    ? t("ui.hud.cooldown.label", {
        seconds: (cooldownLeftMs / 1000).toFixed(1)
      })
    : t("ui.hud.cooldown.ready");
}

function formatTargetingLabel(targeting: string, range: number): string {
  const roundedRange = Number.isFinite(range) && range > 0 ? Number.parseFloat(range.toFixed(1)) : 0;
  if (targeting === "self") {
    return t("ui.hud.targeting.self");
  }
  if (targeting === "nearest") {
    return roundedRange > 0
      ? t("ui.hud.targeting.nearest_enemy_range", { range: roundedRange })
      : t("ui.hud.targeting.nearest_enemy");
  }
  if (targeting === "aoe_around") {
    return roundedRange > 0
      ? t("ui.hud.targeting.around_you_radius", { radius: roundedRange })
      : t("ui.hud.targeting.around_you");
  }
  if (targeting === "directional") {
    return roundedRange > 0
      ? t("ui.hud.targeting.directional_range", { range: roundedRange })
      : t("ui.hud.targeting.directional");
  }
  return t("ui.hud.targeting.unknown");
}

function buildConsumableTooltipHtml(element: HTMLElement): string {
  const name = escapeHtml(element.dataset.tooltipName ?? t("ui.hud.tooltip.consumable_default_name"));
  const descriptionRaw = element.dataset.tooltipDescription ?? "";
  const hotkey = escapeHtml(element.dataset.tooltipHotkey ?? "-");
  const charges = parseTooltipNumber(element.dataset.tooltipCharges);
  const cooldownLeftMs = parseTooltipNumber(element.dataset.tooltipCooldownLeftMs);
  const status = formatCooldownLabel(cooldownLeftMs);
  const disabledReasonRaw = element.dataset.tooltipDisabledReason;
  return `
    <div class="tooltip-name">${name}</div>
    <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.hotkey", { hotkey }))}</div>
    ${
      descriptionRaw.length > 0
        ? `<div class="tooltip-body">${escapeHtml(descriptionRaw)}</div>`
        : ""
    }
    <div class="tooltip-divider"></div>
    <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.charges", { charges }))}</div>
    <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.status", { status }))}</div>
    ${
      disabledReasonRaw === undefined
        ? ""
        : `<div class="tooltip-warning">${escapeHtml(disabledReasonRaw)}</div>`
    }
  `;
}

function buildSkillTooltipHtml(element: HTMLElement): string {
  const name = escapeHtml(element.dataset.tooltipName ?? t("ui.hud.tooltip.skill_default_name"));
  const descriptionRaw = element.dataset.tooltipDescription ?? "";
  const hotkey = escapeHtml(element.dataset.tooltipHotkey ?? "-");
  const cooldownLeftMs = parseTooltipNumber(element.dataset.tooltipCooldownLeftMs);
  const baseCooldownMs = parseTooltipNumber(element.dataset.tooltipBaseCooldownMs);
  const manaCost = parseTooltipNumber(element.dataset.tooltipManaCost);
  const targeting = element.dataset.tooltipTargeting ?? "";
  const range = parseTooltipNumber(element.dataset.tooltipRange);
  const locked = element.dataset.tooltipLocked === "1";
  const outOfMana = element.dataset.tooltipOutOfMana === "1";
  const status = locked ? t("ui.common.locked") : formatCooldownLabel(cooldownLeftMs);
  const targetingLabel = formatTargetingLabel(targeting, range);
  return `
    <div class="tooltip-name">${name}</div>
    <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.hotkey", { hotkey }))}</div>
    ${
      descriptionRaw.length > 0
        ? `<div class="tooltip-body">${escapeHtml(descriptionRaw)}</div>`
        : ""
    }
    <div class="tooltip-divider"></div>
    <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.status", { status }))}</div>
    ${locked ? "" : `<div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.mana_cost", { manaCost }))}</div>`}
    ${locked || baseCooldownMs <= 0 ? "" : `<div class="tooltip-meta">${escapeHtml(
      t("ui.hud.tooltip.base_cd", {
        seconds: (baseCooldownMs / 1000).toFixed(1)
      })
    )}</div>`}
    ${locked ? "" : `<div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.target", { target: targetingLabel }))}</div>`}
    ${!locked && outOfMana ? `<div class="tooltip-warning">${t("ui.hud.tooltip.not_enough_mana")}</div>` : ""}
  `;
}

export function buildQuickbarTooltipHtml(element: HTMLElement): string | null {
  const kind = element.dataset.tooltipKind;
  if (kind === "consumable") {
    return buildConsumableTooltipHtml(element);
  }
  if (kind === "skill") {
    return buildSkillTooltipHtml(element);
  }
  return null;
}
