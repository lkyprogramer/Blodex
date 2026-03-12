import Phaser from "phaser";
import type { DungeonProp } from "@blodex/core";
import { gridToIso } from "./iso";

function propTint(prop: DungeonProp): number {
  if (prop.tint !== undefined) {
    return prop.tint;
  }
  switch (prop.id) {
    case "brazier":
      return 0xe2a35d;
    case "bookshelf":
      return 0x6a4d33;
    case "altar":
      return 0xcab7a3;
    case "bone_heap":
      return 0xbfb3a1;
    default:
      return 0x7d8794;
  }
}

export function renderDungeonProps(args: {
  scene: Phaser.Scene;
  props: DungeonProp[] | undefined;
  origin: { x: number; y: number };
  tileWidth: number;
  tileHeight: number;
  entityDepthOffset: number;
}): void {
  if (args.props === undefined || args.props.length === 0) {
    return;
  }

  for (const prop of args.props) {
    const iso = gridToIso(
      prop.position.x,
      prop.position.y,
      args.tileWidth,
      args.tileHeight,
      args.origin.x,
      args.origin.y
    );
    const depth = iso.y + args.entityDepthOffset - 2;
    const scale = prop.scale ?? 1;
    if (prop.assetId !== undefined && args.scene.textures.exists(prop.assetId)) {
      args.scene.add
        .image(iso.x, iso.y - 2, prop.assetId)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setDepth(depth);
      continue;
    }

    const tint = propTint(prop);
    switch (prop.id) {
      case "pillar":
        args.scene.add
          .rectangle(iso.x, iso.y - 12, 12 * scale, 24 * scale, tint, 0.95)
          .setStrokeStyle(1, 0x1d2228, 0.9)
          .setDepth(depth);
        break;
      case "bookshelf":
        args.scene.add
          .rectangle(iso.x, iso.y - 10, 18 * scale, 18 * scale, tint, 0.95)
          .setStrokeStyle(1, 0x1d2228, 0.9)
          .setDepth(depth);
        break;
      case "altar":
        args.scene.add
          .rectangle(iso.x, iso.y - 8, 18 * scale, 10 * scale, tint, 0.92)
          .setStrokeStyle(1, 0x242b34, 0.9)
          .setDepth(depth);
        break;
      case "bone_heap":
        args.scene.add
          .ellipse(iso.x, iso.y - 4, 18 * scale, 10 * scale, tint, 0.92)
          .setStrokeStyle(1, 0x242b34, 0.8)
          .setDepth(depth);
        break;
      default:
        args.scene.add
          .ellipse(iso.x, iso.y - 6, 14 * scale, 14 * scale, tint, 0.95)
          .setStrokeStyle(1, 0x242b34, 0.85)
          .setDepth(depth);
        break;
    }
  }
}
