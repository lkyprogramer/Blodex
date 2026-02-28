import type { ConsumableId } from "@blodex/core";
import {
  resolveGeneratedAssetUrl,
  type PreferredImageFormat
} from "../../assets/imageAsset";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface ConsumableSlotView {
  id: ConsumableId;
  name: string;
  hotkey: string;
  iconId: string;
  description?: string;
  charges: number;
  cooldownLeftMs: number;
  baseCooldownMs?: number;
  disabledReason?: string;
}

export interface SkillSlotView {
  id?: string;
  hotkey: string;
  name: string;
  iconId?: string;
  description?: string;
  cooldownLeftMs: number;
  baseCooldownMs?: number;
  manaCost?: number;
  targeting?: string;
  range?: number;
  outOfMana: boolean;
  locked: boolean;
}

export interface SkillBarView {
  consumables?: ConsumableSlotView[];
  skillSlots?: SkillSlotView[];
}

export function renderSkillBar(view: SkillBarView, preferredImageFormat: PreferredImageFormat): string {
  const consumables = view.consumables ?? [];
  const skillSlots = view.skillSlots ?? [];

  const consumablesHtml = consumables
    .map((entry) => {
      const disabled = entry.disabledReason !== undefined;
      const cooldown = entry.cooldownLeftMs > 0 ? `${(entry.cooldownLeftMs / 1000).toFixed(1)}s` : "Ready";
      const disabledReasonAttr =
        entry.disabledReason === undefined
          ? ""
          : ` data-tooltip-disabled-reason="${escapeHtml(entry.disabledReason)}"`;
      return `
        <button
          class="consumable-slot ${disabled ? "disabled" : "ready"}"
          data-consumable-id="${entry.id}"
          data-consumable-disabled="${disabled ? "1" : "0"}"
          data-tooltip-kind="consumable"
          data-tooltip-name="${escapeHtml(entry.name)}"
          data-tooltip-description="${escapeHtml(entry.description ?? "")}"
          data-tooltip-hotkey="${escapeHtml(entry.hotkey)}"
          data-tooltip-charges="${entry.charges}"
          data-tooltip-cooldown-left-ms="${entry.cooldownLeftMs}"
          data-tooltip-base-cooldown-ms="${entry.baseCooldownMs ?? 0}"
          ${disabled ? 'aria-disabled="true" tabindex="-1"' : ""}
          ${disabledReasonAttr}
          title="${escapeHtml(entry.disabledReason ?? `Use ${entry.name}`)}"
        >
          <div class="quick-head">
            <img class="quick-icon" data-asset-id="${entry.iconId}" src="${resolveGeneratedAssetUrl(
              entry.iconId,
              preferredImageFormat
            )}" alt="${escapeHtml(entry.name)}" />
            <span class="hotkey-badge">${escapeHtml(entry.hotkey)}</span>
          </div>
          <span class="consumable-meta">${escapeHtml(entry.name)}</span>
          <small class="slot-status">${entry.charges} left · ${cooldown}</small>
        </button>
      `;
    })
    .join("");

  const skillsHtml = skillSlots
    .map((slot) => {
      const statusText = slot.locked
        ? "Locked"
        : slot.cooldownLeftMs > 0
          ? `${(slot.cooldownLeftMs / 1000).toFixed(1)}s`
          : "Ready";
      const classes = [
        "skill-slot",
        slot.locked ? "locked" : "",
        !slot.locked && slot.cooldownLeftMs > 0 ? "cooldown" : "ready",
        !slot.locked && slot.outOfMana ? "oom" : ""
      ]
        .filter((entry) => entry.length > 0)
        .join(" ");
      const iconId = slot.iconId ?? "meta_unlock_locked";
      return `
        <div
          class="${classes}"
          data-tooltip-kind="skill"
          data-tooltip-name="${escapeHtml(slot.name)}"
          data-tooltip-description="${escapeHtml(slot.description ?? "")}"
          data-tooltip-hotkey="${escapeHtml(slot.hotkey)}"
          data-tooltip-cooldown-left-ms="${slot.cooldownLeftMs}"
          data-tooltip-base-cooldown-ms="${slot.baseCooldownMs ?? 0}"
          data-tooltip-mana-cost="${slot.manaCost ?? 0}"
          data-tooltip-targeting="${escapeHtml(slot.targeting ?? "")}"
          data-tooltip-range="${slot.range ?? 0}"
          data-tooltip-locked="${slot.locked ? "1" : "0"}"
          data-tooltip-out-of-mana="${slot.outOfMana ? "1" : "0"}"
          title="${escapeHtml(slot.locked ? "Locked skill slot" : slot.name)}"
        >
          <div class="quick-head">
            <img class="quick-icon" data-asset-id="${iconId}" src="${resolveGeneratedAssetUrl(
              iconId,
              preferredImageFormat
            )}" alt="${escapeHtml(slot.name)}" />
            <span class="hotkey-badge">${escapeHtml(slot.hotkey)}</span>
          </div>
          <span class="skill-name">${escapeHtml(slot.name)}</span>
          <small class="slot-status">${statusText}</small>
        </div>
      `;
    })
    .join("");

  return `
    <div class="panel-block compact-block skillbar-panel">
      ${consumablesHtml.length > 0 ? `<div class="consumable-bar">${consumablesHtml}</div>` : ""}
      ${skillsHtml.length > 0 ? `<div class="skill-bar">${skillsHtml}</div>` : ""}
    </div>
  `;
}

export function bindConsumableBarActions(
  container: ParentNode,
  onUseConsumable: (consumableId: ConsumableId) => void
): void {
  container.querySelectorAll<HTMLButtonElement>("button[data-consumable-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.consumableDisabled === "1") {
        return;
      }
      const id = button.dataset.consumableId as ConsumableId | undefined;
      if (id !== undefined) {
        onUseConsumable(id);
      }
    });
  });
}
