import type { EventChoice, MerchantOffer, RandomEventDef } from "@blodex/core";
import { getContentLocalizer, t } from "../../i18n";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface EventChoiceView {
  choice: EventChoice;
  enabled: boolean;
  disabledReason?: string;
}

export function renderEventDialog(eventDef: RandomEventDef, choices: EventChoiceView[]): string {
  const contentLocalizer = getContentLocalizer();
  const eventName = contentLocalizer.eventName(eventDef.id, eventDef.name);
  const eventDescription = contentLocalizer.eventDescription(eventDef.id, eventDef.description);
  const buttons = choices
    .map(({ choice, enabled, disabledReason }) => {
      const choiceName = contentLocalizer.eventChoiceName(eventDef.id, choice.id, choice.name);
      const choiceDescription = contentLocalizer.eventChoiceDescription(
        eventDef.id,
        choice.id,
        choice.description
      );
      return `
        <button
          class="dialog-action ${enabled ? "" : "disabled"}"
          data-choice-id="${choice.id}"
          ${enabled ? "" : "disabled"}
          title="${escapeHtml(disabledReason ?? choiceDescription)}"
        >
          <span class="dialog-action-title">${escapeHtml(choiceName)}</span>
          <small>${escapeHtml(choiceDescription)}</small>
        </button>
      `;
    })
    .join("");

  return `
    <div class="dialog-card event-dialog-card">
      <h2>${escapeHtml(eventName)}</h2>
      <p>${escapeHtml(eventDescription)}</p>
      <div class="dialog-actions">${buttons}</div>
      <button class="dialog-close" data-event-close="1">${t("ui.event.close")}</button>
    </div>
  `;
}

export function renderMerchantDialog(
  offers: Array<MerchantOffer & { itemName: string; rarity: string }>
): string {
  const rows = offers
    .map((offer) => {
      return `
        <div class="merchant-offer">
          <div>
            <div class="merchant-name">${escapeHtml(offer.itemName)}</div>
            <small class="merchant-rarity ${offer.rarity}">${escapeHtml(offer.rarity.toUpperCase())}</small>
          </div>
          <button class="dialog-action" data-offer-id="${offer.offerId}">${t("ui.event.merchant.buy", {
            price: offer.priceObol
          })}</button>
        </div>
      `;
    })
    .join("");

  return `
    <div class="dialog-card merchant-dialog-card">
      <h2>${t("ui.event.merchant.title")}</h2>
      <p>${t("ui.event.merchant.subtitle")}</p>
      <div class="merchant-list">${rows || `<p class="log-empty">${escapeHtml(t("ui.event.merchant.sold_out"))}</p>`}</div>
      <button class="dialog-close" data-event-close="1">${t("ui.event.leave")}</button>
    </div>
  `;
}

export function bindEventDialogActions(
  container: ParentNode,
  onChoose: (choiceId: string) => void,
  onClose: () => void
): void {
  container.querySelectorAll<HTMLButtonElement>("button[data-choice-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const choiceId = button.dataset.choiceId;
      if (choiceId !== undefined) {
        onChoose(choiceId);
      }
    });
  });
  container.querySelector<HTMLButtonElement>("button[data-event-close='1']")?.addEventListener("click", onClose);
}

export function bindMerchantDialogActions(
  container: ParentNode,
  onBuy: (offerId: string) => void,
  onClose: () => void
): void {
  container.querySelectorAll<HTMLButtonElement>("button[data-offer-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const offerId = button.dataset.offerId;
      if (offerId !== undefined) {
        onBuy(offerId);
      }
    });
  });
  container.querySelector<HTMLButtonElement>("button[data-event-close='1']")?.addEventListener("click", onClose);
}
