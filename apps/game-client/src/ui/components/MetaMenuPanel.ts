import type { BlueprintDef, DifficultyMode, MutationDef, TalentPath } from "@blodex/core";
import type { LocaleCode } from "../../i18n/types";
export { renderMetaMenuPanel } from "./MetaMenuPanelRender";

export interface MetaMenuDifficultyView {
  mode: DifficultyMode;
  label: string;
  shortcut: string;
  selected: boolean;
  unlocked: boolean;
  requirement: string;
}

export interface MetaMenuRunSaveView {
  canContinue: boolean;
  canAbandon: boolean;
  statusText: string;
  detailText: string;
}

export interface MetaMenuDailyView {
  date: string;
  mode: "scored" | "practice";
  statusText: string;
}

export interface MetaMenuUnlockCardView {
  index: number;
  id: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  shortcut: string;
  effectText: string;
  statusText: string;
  unlocked: boolean;
  purchasable: boolean;
}

export interface MetaMenuUnlockGroupView {
  tier: number;
  unlocks: MetaMenuUnlockCardView[];
}

export interface MetaMenuTalentCardView {
  id: string;
  name: string;
  description: string;
  path: TalentPath;
  tier: number;
  rank: number;
  maxRank: number;
  cost: number;
  statusText: string;
  purchasable: boolean;
}

export interface MetaMenuTalentGroupView {
  path: TalentPath;
  label: string;
  talents: MetaMenuTalentCardView[];
}

export interface MetaMenuBlueprintCardView {
  id: string;
  name: string;
  category: BlueprintDef["category"];
  rarity: BlueprintDef["rarity"];
  forgeCost: number;
  detailText: string;
  statusText: string;
  forged: boolean;
  canForge: boolean;
}

export interface MetaMenuBlueprintGroupView {
  category: BlueprintDef["category"];
  label: string;
  blueprints: MetaMenuBlueprintCardView[];
}

export interface MetaMenuMutationCardView {
  id: string;
  name: string;
  category: MutationDef["category"];
  tier: MutationDef["tier"];
  unlockText: string;
  effectText: string;
  statusText: string;
  selected: boolean;
  canToggle: boolean;
  canUnlockEcho: boolean;
}

export interface MetaMenuMutationGroupView {
  category: MutationDef["category"];
  label: string;
  mutations: MetaMenuMutationCardView[];
}

export interface MetaMenuPanelView {
  locale: LocaleCode;
  availableLocales: Array<{
    code: LocaleCode;
    label: string;
    selected: boolean;
  }>;
  soulShards: number;
  echoes: number;
  unlockedCount: number;
  totalUnlocks: number;
  difficulties: MetaMenuDifficultyView[];
  runSave: MetaMenuRunSaveView | null;
  daily: MetaMenuDailyView;
  talentGroups: MetaMenuTalentGroupView[];
  unlockGroups: MetaMenuUnlockGroupView[];
  blueprintGroups: MetaMenuBlueprintGroupView[];
  mutationGroups: MetaMenuMutationGroupView[];
  mutationSlots: number;
  selectedMutations: number;
  startRunEnabled: boolean;
}

export interface MetaMenuPanelHandlers {
  onSetLocale: (locale: LocaleCode) => void;
  onPurchase: (index: number) => void;
  onPurchaseTalent: (talentId: string) => void;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  onForgeBlueprint: (blueprintId: string) => void;
  onUnlockMutation: (mutationId: string) => void;
  onToggleMutation: (mutationId: string) => void;
  onStartRun: () => void;
  onStartDaily: () => void;
  onContinueRun: () => void;
  onAbandonRun: () => void;
}

export function bindMetaMenuPanelActions(
  container: ParentNode,
  handlers: MetaMenuPanelHandlers
): Array<() => void> {
  const unbindActions: Array<() => void> = [];

  container.querySelectorAll<HTMLButtonElement>("button[data-action='set-locale']").forEach((button) => {
    const locale = button.dataset.locale as LocaleCode | undefined;
    if (locale === undefined) {
      return;
    }
    const onClick = () => handlers.onSetLocale(locale);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='purchase']").forEach((button) => {
    const onClick = () => {
      const index = Number.parseInt(button.dataset.index ?? "", 10);
      if (Number.isFinite(index)) {
        handlers.onPurchase(index);
      }
    };
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='purchase-talent']").forEach((button) => {
    const talentId = button.dataset.talentId;
    if (talentId === undefined) {
      return;
    }
    const onClick = () => handlers.onPurchaseTalent(talentId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='difficulty']").forEach((button) => {
    const mode = button.dataset.mode as DifficultyMode | undefined;
    if (mode === undefined) {
      return;
    }
    const onClick = () => handlers.onSelectDifficulty(mode);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='forge-blueprint']").forEach((button) => {
    const blueprintId = button.dataset.blueprintId;
    if (blueprintId === undefined) {
      return;
    }
    const onClick = () => handlers.onForgeBlueprint(blueprintId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='unlock-mutation']").forEach((button) => {
    const mutationId = button.dataset.mutationId;
    if (mutationId === undefined) {
      return;
    }
    const onClick = () => handlers.onUnlockMutation(mutationId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  container.querySelectorAll<HTMLButtonElement>("button[data-action='toggle-mutation']").forEach((button) => {
    const mutationId = button.dataset.mutationId;
    if (mutationId === undefined) {
      return;
    }
    const onClick = () => handlers.onToggleMutation(mutationId);
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  const startButton = container.querySelector<HTMLButtonElement>("button[data-action='start']");
  if (startButton !== null) {
    const onClick = () => handlers.onStartRun();
    startButton.addEventListener("click", onClick);
    unbindActions.push(() => startButton.removeEventListener("click", onClick));
  }

  const startDailyButton = container.querySelector<HTMLButtonElement>("button[data-action='start-daily']");
  if (startDailyButton !== null) {
    const onClick = () => handlers.onStartDaily();
    startDailyButton.addEventListener("click", onClick);
    unbindActions.push(() => startDailyButton.removeEventListener("click", onClick));
  }

  const continueButton = container.querySelector<HTMLButtonElement>("button[data-action='continue']");
  if (continueButton !== null) {
    const onClick = () => handlers.onContinueRun();
    continueButton.addEventListener("click", onClick);
    unbindActions.push(() => continueButton.removeEventListener("click", onClick));
  }

  const abandonButton = container.querySelector<HTMLButtonElement>("button[data-action='abandon']");
  if (abandonButton !== null) {
    const onClick = () => handlers.onAbandonRun();
    abandonButton.addEventListener("click", onClick);
    unbindActions.push(() => abandonButton.removeEventListener("click", onClick));
  }

  container.querySelectorAll<HTMLButtonElement>("button[data-action='jump-section']").forEach((button) => {
    const targetId = button.dataset.target;
    if (targetId === undefined || targetId.length === 0) {
      return;
    }
    const onClick = () => {
      const target = container.querySelector<HTMLElement>(`#${targetId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    button.addEventListener("click", onClick);
    unbindActions.push(() => button.removeEventListener("click", onClick));
  });

  return unbindActions;
}
