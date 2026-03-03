import type { LocaleCode } from "../../i18n/types";
import { t } from "../../i18n";

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface LanguageGateModalView {
  selectedLocale: LocaleCode;
}

export interface LanguageGateModalHandlers {
  onSelectLocale: (locale: LocaleCode) => void;
  onConfirm: () => void;
}

const LOCALE_OPTIONS: Array<{ code: LocaleCode; labelKey: string; hintKey: string }> = [
  {
    code: "en-US",
    labelKey: "ui.locale.english",
    hintKey: "ui.language_gate.option.english_hint"
  },
  {
    code: "zh-CN",
    labelKey: "ui.locale.zh_cn",
    hintKey: "ui.language_gate.option.zh_cn_hint"
  }
];

export function renderLanguageGateModal(view: LanguageGateModalView): string {
  const options = LOCALE_OPTIONS.map((option, index) => {
    const selected = option.code === view.selectedLocale;
    return `
      <button
        class="language-gate-option ${selected ? "selected" : ""}"
        data-action="select-language"
        data-locale="${option.code}"
        aria-pressed="${selected ? "true" : "false"}"
      >
        <span class="language-gate-option-head">
          <span class="meta-keycap">${index + 1}</span>
          <span>${escapeHtml(t(option.labelKey))}</span>
        </span>
        <small>${escapeHtml(t(option.hintKey))}</small>
      </button>
    `;
  }).join("");

  return `
    <div class="language-gate-shell" role="dialog" aria-modal="true" aria-labelledby="language-gate-title">
      <h2 id="language-gate-title">${t("ui.language_gate.title")}</h2>
      <p>${t("ui.language_gate.subtitle")}</p>
      <div class="language-gate-options">${options}</div>
      <p class="language-gate-help">${t("ui.language_gate.help")}</p>
      <button class="meta-start-button" data-action="confirm-language">${t("ui.language_gate.confirm")}</button>
    </div>
  `;
}

export function bindLanguageGateModalActions(
  container: ParentNode,
  handlers: LanguageGateModalHandlers
): Array<() => void> {
  const unbindActions: Array<() => void> = [];

  container.querySelectorAll<HTMLButtonElement>("button[data-action='select-language']").forEach((button) => {
    const locale = button.dataset.locale as LocaleCode | undefined;
    if (locale === undefined) {
      return;
    }
    const onClick = () => handlers.onSelectLocale(locale);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  const confirmButton = container.querySelector<HTMLButtonElement>("button[data-action='confirm-language']");
  if (confirmButton !== null) {
    const onClick = () => handlers.onConfirm();
    confirmButton.addEventListener("click", onClick);
    unbindActions.push(() => confirmButton.removeEventListener("click", onClick));
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "1") {
      handlers.onSelectLocale("en-US");
      return;
    }
    if (event.key === "2") {
      handlers.onSelectLocale("zh-CN");
      return;
    }
    if (event.key === "Enter") {
      handlers.onConfirm();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  unbindActions.push(() => window.removeEventListener("keydown", onKeyDown));

  return unbindActions;
}
