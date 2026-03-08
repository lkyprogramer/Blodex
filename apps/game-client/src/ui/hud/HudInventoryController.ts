import type {
  ConsumableId,
  EquipmentSlot,
  ItemInstance,
  PlayerState
} from "@blodex/core";
import { calculateItemPowerScore as calculateTradeoffItemPowerScore, canEquip } from "@blodex/core";
import {
  detectPreferredImageFormat,
  resolveGeneratedAssetUrl,
  resolveGeneratedPngFallback
} from "../../assets/imageAsset";
import { getContentLocalizer, t } from "../../i18n";
import {
  buildEquipmentCompareView,
  summaryKeyLabelKey
} from "./compare/EquipmentCompareViewPresenter";
import type { EquipmentDeltaSummaryKey } from "./compare/EquipmentDeltaPresenter";

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["weapon", "helm", "chest", "boots", "ring"];

const AFFIX_LABEL_KEYS: Readonly<Record<string, string>> = {
  maxHealth: "ui.hud.affix.maxHealth",
  maxMana: "ui.hud.affix.maxMana",
  armor: "ui.hud.affix.armor",
  attackPower: "ui.hud.affix.attackPower",
  critChance: "ui.hud.affix.critChance",
  attackSpeed: "ui.hud.affix.attackSpeed",
  moveSpeed: "ui.hud.affix.moveSpeed",
  lifesteal: "ui.hud.affix.lifesteal",
  critDamage: "ui.hud.affix.critDamage",
  aoeRadius: "ui.hud.affix.aoeRadius",
  skillBonusDamage: "ui.hud.affix.skillBonusDamage",
  thorns: "ui.hud.affix.thorns",
  healthRegen: "ui.hud.affix.healthRegen",
  dodgeChance: "ui.hud.affix.dodgeChance",
  xpBonus: "ui.hud.affix.xpBonus",
  soulShardBonus: "ui.hud.affix.soulShardBonus",
  cooldownReduction: "ui.hud.affix.cooldownReduction"
};

const RARITY_LABEL_KEYS: Readonly<Record<string, string>> = {
  common: "ui.hud.rarity.common",
  magic: "ui.hud.rarity.magic",
  rare: "ui.hud.rarity.rare"
};

const WEAPON_TYPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  sword: "ui.hud.weapon_type.sword",
  axe: "ui.hud.weapon_type.axe",
  dagger: "ui.hud.weapon_type.dagger",
  staff: "ui.hud.weapon_type.staff",
  hammer: "ui.hud.weapon_type.hammer",
  sword_master: "ui.hud.weapon_type.sword_master"
};

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slotLabel(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return t("ui.hud.inventory.slot.weapon.short");
    case "helm":
      return t("ui.hud.inventory.slot.helm.short");
    case "chest":
      return t("ui.hud.inventory.slot.chest.short");
    case "boots":
      return t("ui.hud.inventory.slot.boots.short");
    case "ring":
      return t("ui.hud.inventory.slot.ring.short");
  }
}

function slotLongLabel(slot: EquipmentSlot): string {
  switch (slot) {
    case "weapon":
      return t("ui.hud.inventory.slot.weapon.long");
    case "helm":
      return t("ui.hud.inventory.slot.helm.long");
    case "chest":
      return t("ui.hud.inventory.slot.chest.long");
    case "boots":
      return t("ui.hud.inventory.slot.boots.long");
    case "ring":
      return t("ui.hud.inventory.slot.ring.long");
  }
}

function formatAffixNameFallback(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function localizeAffixName(key: string): string {
  const i18nKey = AFFIX_LABEL_KEYS[key];
  if (i18nKey === undefined) {
    return formatAffixNameFallback(key);
  }
  const localized = t(i18nKey);
  return localized === i18nKey ? formatAffixNameFallback(key) : localized;
}

function localizeRarity(rarity: string): string {
  const i18nKey = RARITY_LABEL_KEYS[rarity];
  if (i18nKey === undefined) {
    return rarity.toUpperCase();
  }
  const localized = t(i18nKey);
  return localized === i18nKey ? rarity.toUpperCase() : localized;
}

function localizeWeaponType(weaponType: string): string {
  const i18nKey = WEAPON_TYPE_LABEL_KEYS[weaponType];
  if (i18nKey === undefined) {
    return weaponType.toUpperCase();
  }
  const localized = t(i18nKey);
  return localized === i18nKey ? weaponType.toUpperCase() : localized;
}

function formatAffixValue(key: string, value: number): string {
  const absolute = Math.abs(value);
  const normalized = Number.isInteger(absolute) ? absolute.toString() : absolute.toFixed(1);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const percentValue = `${(absolute * 100).toFixed(1)}%`;
  if (
    key === "critChance" ||
    key === "lifesteal" ||
    key === "critDamage" ||
    key === "aoeRadius" ||
    key === "dodgeChance" ||
    key === "xpBonus" ||
    key === "soulShardBonus" ||
    key === "cooldownReduction"
  ) {
    return `${prefix}${percentValue}`;
  }
  if (key === "healthRegen") {
    return `${prefix}${normalized}/s`;
  }
  return `${prefix}${normalized}`;
}

function formatSignedValue(value: number): string {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  if (value > 0) {
    return `+${normalized}`;
  }
  return normalized;
}

function directionToDeltaClass(direction: "up" | "down" | "equal"): string {
  switch (direction) {
    case "up":
      return "delta-up";
    case "down":
      return "delta-down";
    case "equal":
      return "delta-equal";
  }
}

function directionSymbol(direction: "up" | "down" | "equal"): string {
  switch (direction) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "equal":
      return "≈";
  }
}

function summaryLabel(key: EquipmentDeltaSummaryKey): string {
  switch (key) {
    case "offense":
      return t("ui.hud.tooltip.summary.offense");
    case "defense":
      return t("ui.hud.tooltip.summary.defense");
    case "utility":
      return t("ui.hud.tooltip.summary.utility");
  }
}

export class HudInventoryController {
  private readonly preferredImageFormat = detectPreferredImageFormat();
  private readonly contentLocalizer = getContentLocalizer();
  private readonly tooltipEl: HTMLDivElement;

  constructor(
    private readonly inventoryEl: HTMLDivElement,
    private readonly onEquip: (itemId: string) => void,
    private readonly onUnequip: (slot: EquipmentSlot) => void,
    private readonly onDiscard: (itemId: string) => void
  ) {
    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "inventory-tooltip hidden";
    document.body.appendChild(this.tooltipEl);
  }

  renderInventory(player: PlayerState, newlyAcquiredItemIds: string[]): void {
    const itemById = new Map<string, ItemInstance>();
    for (const item of player.inventory) {
      itemById.set(item.id, item);
    }
    const newlyAcquiredSet = new Set(newlyAcquiredItemIds);
    for (const item of Object.values(player.equipment)) {
      if (item !== undefined) {
        itemById.set(item.id, item);
      }
    }

    this.inventoryEl.className = "panel-block compact-block inventory-panel";

    const equipmentGrid = EQUIPMENT_SLOTS.map((slot) => {
      const equipped = player.equipment[slot];
      if (equipped === undefined) {
        return `
          <div class="equip-slot empty">
            <div class="equip-slot-name">${slotLabel(slot)}</div>
            <div class="equip-slot-empty">-</div>
          </div>
        `;
      }
      const equippedName = this.contentLocalizer.itemName(equipped.defId, equipped.name);

      return `
        <div class="equip-slot filled ${equipped.rarity}" data-item-id="${equipped.id}">
          <div class="equip-slot-head">
            <div class="equip-slot-name">${slotLabel(slot)}</div>
            <button data-unequip-slot="${slot}" title="${escapeHtml(
              t("ui.hud.inventory.unequip", { slot: slotLongLabel(slot) })
            )}">×</button>
          </div>
          <img class="item-icon" data-asset-id="${equipped.iconId}" src="${resolveGeneratedAssetUrl(
            equipped.iconId,
            this.preferredImageFormat
          )}" alt="${escapeHtml(equippedName)}" />
        </div>
      `;
    }).join("");

    const inventoryGrid = player.inventory
      .map((item) => {
        const itemName = this.contentLocalizer.itemName(item.defId, item.name);
        const equipable = canEquip(player, item);
        const compareItem = player.equipment[item.slot];
        const powerDelta =
          compareItem === undefined
            ? 0
            : calculateTradeoffItemPowerScore(item) - calculateTradeoffItemPowerScore(compareItem);
        const isDowngrade = equipable && compareItem !== undefined && powerDelta < 0;
        const newlyAcquiredClass = newlyAcquiredSet.has(item.id) ? "newly-acquired" : "";
        const equipActionTitle = equipable
          ? isDowngrade
            ? t("ui.hud.inventory.equip_downgrade", {
                item: itemName,
                delta: formatSignedValue(powerDelta)
              })
            : t("ui.hud.inventory.equip", { item: itemName })
          : t("ui.hud.inventory.need_level", { level: item.requiredLevel });
        return `
          <div class="inventory-cell ${item.rarity} ${equipable ? "" : "locked"} ${newlyAcquiredClass}" data-item-id="${item.id}">
            <img class="item-icon" data-asset-id="${item.iconId}" src="${resolveGeneratedAssetUrl(
              item.iconId,
              this.preferredImageFormat
            )}" alt="${escapeHtml(itemName)}" />
            <div class="inventory-cell-actions">
              <button
                class="${equipable ? "" : "blocked"} ${isDowngrade ? "downgrade" : ""}"
                data-item-id="${item.id}"
                title="${escapeHtml(equipActionTitle)}"
              >${equipable ? "E" : escapeHtml(t("ui.hud.inventory.need_level_short", { level: item.requiredLevel }))}</button>
              <button
                class="discard"
                data-discard-item-id="${item.id}"
                title="${escapeHtml(t("ui.hud.inventory.discard", { item: itemName }))}"
              >D</button>
            </div>
            ${
              isDowngrade
                ? `<small class="equip-downgrade-hint">${escapeHtml(
                    t("ui.hud.inventory.downgrade_hint", {
                      delta: formatSignedValue(powerDelta)
                    })
                  )}</small>`
                : ""
            }
            ${equipable ? "" : `<small class="equip-lock-hint">${escapeHtml(
              t("ui.hud.inventory.equip_lock_hint", {
                level: item.requiredLevel
              })
            )}</small>`}
          </div>
        `;
      })
      .join("");

    this.inventoryEl.innerHTML = `
      <h2>${t("ui.hud.inventory.title")}</h2>
      <div class="equipment-grid">${equipmentGrid}</div>
      <div class="inventory-subhead">${t("ui.hud.inventory.subhead", { count: player.inventory.length })}</div>
      <div class="inventory-scroll">
        <div class="inventory-grid">${inventoryGrid || `<div class="inventory-empty">${escapeHtml(
          t("ui.hud.inventory.empty")
        )}</div>`}</div>
      </div>
    `;
    this.bindGeneratedImageFallbacks(this.inventoryEl);

    this.inventoryEl.querySelectorAll("button[data-item-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = (button as HTMLButtonElement).dataset.itemId;
        if (id !== undefined) {
          this.onEquip(id);
        }
      });
    });

    this.inventoryEl.querySelectorAll("button[data-unequip-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        const slot = (button as HTMLButtonElement).dataset.unequipSlot as EquipmentSlot | undefined;
        if (slot !== undefined) {
          this.onUnequip(slot);
        }
      });
    });

    this.inventoryEl.querySelectorAll("button[data-discard-item-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = (button as HTMLButtonElement).dataset.discardItemId;
        if (id !== undefined) {
          this.hideTooltip();
          this.onDiscard(id);
        }
      });
    });

    this.inventoryEl.querySelectorAll<HTMLElement>("[data-item-id]").forEach((element) => {
      element.addEventListener("mouseenter", (event) => {
        const itemId = element.dataset.itemId;
        if (itemId === undefined) {
          return;
        }
        const item = itemById.get(itemId);
        if (item === undefined) {
          return;
        }
        this.showTooltip(item, player.equipment[item.slot]?.id === item.id ? undefined : player.equipment[item.slot], event as MouseEvent);
      });

      element.addEventListener("mousemove", (event) => {
        const itemId = element.dataset.itemId;
        if (itemId === undefined) {
          return;
        }
        const item = itemById.get(itemId);
        if (item === undefined) {
          return;
        }
        this.showTooltip(item, player.equipment[item.slot]?.id === item.id ? undefined : player.equipment[item.slot], event as MouseEvent);
      });

      element.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });
    });
  }

  bindGeneratedImageFallbacks(container: ParentNode): void {
    container.querySelectorAll<HTMLImageElement>("img[data-asset-id]").forEach((image) => {
      image.addEventListener("error", () => {
        const assetId = image.dataset.assetId;
        if (assetId === undefined) {
          return;
        }
        if (image.dataset.fallbackApplied === "1") {
          return;
        }
        image.dataset.fallbackApplied = "1";
        image.src = resolveGeneratedPngFallback(assetId);
      });
    });
  }

  showTooltipHtml(contentHtml: string, event: MouseEvent): void {
    this.tooltipEl.innerHTML = contentHtml;
    this.tooltipEl.classList.remove("hidden");
    this.positionTooltip(event.clientX, event.clientY);
  }

  positionTooltip(clientX: number, clientY: number): void {
    const offset = 14;
    const margin = 8;
    const rect = this.tooltipEl.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;
    const nextLeft = Math.max(margin, Math.min(maxLeft, clientX + offset));
    const nextTop = Math.max(margin, Math.min(maxTop, clientY + offset));
    this.tooltipEl.style.left = `${nextLeft}px`;
    this.tooltipEl.style.top = `${nextTop}px`;
  }

  showTooltip(item: ItemInstance, compareItem: ItemInstance | undefined, event: MouseEvent): void {
    const localizedItemName = this.contentLocalizer.itemName(item.defId, item.name);
    const localizedCompareName =
      compareItem === undefined
        ? undefined
        : this.contentLocalizer.itemName(compareItem.defId, compareItem.name);
    const compareView = buildEquipmentCompareView(item, compareItem);
    const affixLines = compareView.affixLines
      .map((line) => {
        const deltaClass = directionToDeltaClass(line.direction);
        return `
          <div class="tooltip-affix-line">
            <span>${escapeHtml(localizeAffixName(line.key))}</span>
            <span class="tooltip-affix-value ${deltaClass}">${escapeHtml(
              formatAffixValue(line.key, line.value)
            )}${line.delta === undefined ? "" : ` (${escapeHtml(formatSignedValue(line.delta))})`}</span>
          </div>
        `;
      })
      .join("");
    const powerDeltaClass = directionToDeltaClass(compareView.powerDirection);
    const compareSummaryLines =
      compareItem === undefined
        ? []
        : compareView.summaryLines.map((line) => `
            <div class="tooltip-compare-summary-line">
              <span>${escapeHtml(summaryLabel(summaryKeyLabelKey(line.key)))}</span>
              <span class="tooltip-compare-summary-value ${directionToDeltaClass(line.direction)}">${directionSymbol(
                line.direction
              )}</span>
            </div>
          `);

    this.showTooltipHtml(
      `
      <div class="tooltip-name">${escapeHtml(localizedItemName)}</div>
      <div class="tooltip-rarity ${item.rarity}">${escapeHtml(localizeRarity(item.rarity))}</div>
      <div class="tooltip-meta">${escapeHtml(
        t("ui.hud.tooltip.slot", {
          slot: `${slotLongLabel(item.slot)}${
            item.weaponType === undefined ? "" : ` · ${localizeWeaponType(item.weaponType)}`
          }`
        })
      )}</div>
      <div class="tooltip-meta">${escapeHtml(t("ui.hud.tooltip.req_level", { level: item.requiredLevel }))}</div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-affixes">${affixLines || escapeHtml(t("ui.hud.tooltip.no_affixes"))}</div>
      ${
        compareItem === undefined
          ? ""
          : `
            <div class="tooltip-divider"></div>
            <div class="tooltip-compare-head">${escapeHtml(
              t("ui.hud.tooltip.compare", { name: localizedCompareName ?? compareItem.name })
            )}</div>
            <div class="tooltip-compare-summary">
              ${compareSummaryLines.join("")}
            </div>
            <div class="tooltip-compare-score ${powerDeltaClass}">
              ${escapeHtml(
                t("ui.hud.tooltip.power_delta", {
                  delta: formatSignedValue(compareView.powerDelta)
                })
              )}
            </div>
          `
      }
    `,
      event
    );
  }

  hideTooltip(): void {
    this.tooltipEl.classList.add("hidden");
  }

  reset(): void {
    this.hideTooltip();
    this.inventoryEl.className = "hidden";
    this.inventoryEl.innerHTML = "";
  }
}
