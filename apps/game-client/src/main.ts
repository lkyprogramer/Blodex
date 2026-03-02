import Phaser from "phaser";
import { detectPreferredImageFormat } from "./assets/imageAsset";
import { DungeonScene } from "./scenes/DungeonScene";
import { MetaMenuScene } from "./scenes/MetaMenuScene";
import "./style.css";

const root = document.querySelector("#game-root") as HTMLDivElement;
detectPreferredImageFormat();

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
