import type { EventChoice, MerchantOffer, RandomEventDef } from "@blodex/core";

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
  const buttons = choices
    .map(({ choice, enabled, disabledReason }) => {
      return `
        <button
          class="dialog-action ${enabled ? "" : "disabled"}"
          data-choice-id="${choice.id}"
          ${enabled ? "" : "disabled"}
          title="${escapeHtml(disabledReason ?? choice.description)}"
        >
          <span class="dialog-action-title">${escapeHtml(choice.name)}</span>
          <small>${escapeHtml(choice.description)}</small>
        </button>
      `;
    })
    .join("");

  return `
    <div class="dialog-card event-dialog-card">
      <h2>${escapeHtml(eventDef.name)}</h2>
      <p>${escapeHtml(eventDef.description)}</p>
      <div class="dialog-actions">${buttons}</div>
      <button class="dialog-close" data-event-close="1">Close</button>
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
          <button class="dialog-action" data-offer-id="${offer.offerId}">Buy (${offer.priceObol})</button>
        </div>
      `;
    })
    .join("");

  return `
    <div class="dialog-card merchant-dialog-card">
      <h2>Wandering Merchant</h2>
      <p>Spend Obol to buy items for this run.</p>
      <div class="merchant-list">${rows || '<p class="log-empty">Sold out.</p>'}</div>
      <button class="dialog-close" data-event-close="1">Leave</button>
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
