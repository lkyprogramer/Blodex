import Phaser from "phaser";
import { detectPreferredImageFormat } from "./assets/imageAsset";
import { UI_POLISH_FLAGS } from "./config/uiFlags";
import { initializeI18n } from "./i18n";
import { DungeonScene } from "./scenes/DungeonScene";
import { MetaMenuScene } from "./scenes/MetaMenuScene";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/hud.css";
import "./styles/components.css";
import "./styles/overlays.css";
import "./styles/meta-menu.css";
import "./styles/responsive.css";
import "./styles/animations.css";

const root = document.querySelector("#game-root") as HTMLDivElement;
detectPreferredImageFormat();
if (UI_POLISH_FLAGS.i18nInfrastructureEnabled) {
  initializeI18n();
}

function resolveGameViewport(): { width: number; height: number } {
  const mobileLayout = window.innerWidth <= 980;
  const width = mobileLayout ? window.innerWidth : Math.max(window.innerWidth - 340, 800);
  return {
    width: Math.max(360, Math.floor(width)),
    height: Math.max(480, Math.floor(window.innerHeight))
  };
}

const viewport = resolveGameViewport();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: viewport.width,
  height: viewport.height,
  parent: root,
  backgroundColor: "#10141a",
  scene: [MetaMenuScene, DungeonScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  }
});

window.addEventListener("resize", () => {
  const next = resolveGameViewport();
  game.scale.resize(next.width, next.height);
});
