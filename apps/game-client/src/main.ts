import Phaser from "phaser";
import { DungeonScene } from "./scenes/DungeonScene";
import { MetaMenuScene } from "./scenes/MetaMenuScene";
import "./style.css";

const root = document.querySelector("#game-root") as HTMLDivElement;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: Math.max(window.innerWidth - 340, 800),
  height: window.innerHeight,
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
  const width = Math.max(window.innerWidth - 340, 800);
  const height = window.innerHeight;
  game.scale.resize(width, height);
});
