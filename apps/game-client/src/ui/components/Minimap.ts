interface MinimapLayout {
  width: number;
  height: number;
  walkable: boolean[][];
  layoutHash: string;
}

interface MinimapPoint {
  x: number;
  y: number;
}

export interface MinimapFrame {
  player: MinimapPoint;
  monsters: MinimapPoint[];
  loot: MinimapPoint[];
  staircase?: MinimapPoint;
  eventNode?: MinimapPoint;
  revealAll?: boolean;
}

const MINIMAP_SIZE = 200;
const FOG_RADIUS = 5;

export class Minimap {
  private readonly root: HTMLDivElement | null;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly ctx: CanvasRenderingContext2D | null;

  private layout: MinimapLayout | null = null;
  private explored = new Set<number>();

  constructor(rootSelector = "#minimap") {
    this.root = document.querySelector(rootSelector) as HTMLDivElement | null;
    if (this.root === null) {
      this.canvas = null;
      this.ctx = null;
      return;
    }

    this.root.className = "panel-block minimap-panel";
    this.root.innerHTML = `
      <div class="minimap-head">
        <h2>Minimap</h2>
        <span class="minimap-compass">N</span>
      </div>
      <canvas width="${MINIMAP_SIZE}" height="${MINIMAP_SIZE}"></canvas>
    `;
    this.canvas = this.root.querySelector("canvas");
    this.ctx = this.canvas?.getContext("2d") ?? null;
  }

  configure(layout: MinimapLayout): void {
    if (this.layout?.layoutHash === layout.layoutHash) {
      return;
    }
    this.layout = layout;
    this.explored = new Set<number>();
    this.clear();
  }

  reset(): void {
    this.explored.clear();
    this.clear();
  }

  render(frame: MinimapFrame): void {
    if (this.ctx === null || this.canvas === null || this.layout === null) {
      return;
    }

    const { width, height, walkable } = this.layout;
    const cell = Math.max(2, Math.floor(MINIMAP_SIZE / Math.max(width, height)));
    const offsetX = Math.floor((MINIMAP_SIZE - width * cell) / 2);
    const offsetY = Math.floor((MINIMAP_SIZE - height * cell) / 2);

    this.revealAround(frame.player, width, height, frame.revealAll === true);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#081018";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!walkable[y]?.[x]) {
          continue;
        }

        const id = this.toKey(x, y, width);
        const inVision = this.distance(frame.player, { x, y }) <= FOG_RADIUS;
        const seen = frame.revealAll === true || inVision || this.explored.has(id);
        if (!seen) {
          continue;
        }

        this.ctx.fillStyle = inVision || frame.revealAll === true ? "#3f556f" : "#222f3d";
        this.ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
      }
    }

    this.drawPoints(frame.loot, frame.player, cell, offsetX, offsetY, "#d9b95f", frame.revealAll === true);
    this.drawPoints(frame.monsters, frame.player, cell, offsetX, offsetY, "#d16a6a", false);
    if (frame.staircase !== undefined) {
      this.drawPoint(frame.staircase, cell, offsetX, offsetY, "#7fcd95");
    }
    if (frame.eventNode !== undefined) {
      this.drawPoint(frame.eventNode, cell, offsetX, offsetY, "#6ea8d7");
    }
    this.drawPlayerPoint(frame.player, cell, offsetX, offsetY);
  }

  private drawPoints(
    points: MinimapPoint[],
    player: MinimapPoint,
    cell: number,
    offsetX: number,
    offsetY: number,
    color: string,
    ignoreVision: boolean
  ): void {
    for (const point of points) {
      if (!ignoreVision && this.distance(player, point) > FOG_RADIUS) {
        continue;
      }
      this.drawPoint(point, cell, offsetX, offsetY, color);
    }
  }

  private drawPoint(point: MinimapPoint, cell: number, offsetX: number, offsetY: number, color: string): void {
    if (this.ctx === null) {
      return;
    }
    const x = offsetX + point.x * cell + cell / 2;
    const y = offsetY + point.y * cell + cell / 2;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(1.2, cell * 0.34), 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawPlayerPoint(point: MinimapPoint, cell: number, offsetX: number, offsetY: number): void {
    if (this.ctx === null) {
      return;
    }
    const x = offsetX + point.x * cell + cell / 2;
    const y = offsetY + point.y * cell + cell / 2;
    const pulseRatio = 0.7 + Math.abs(Math.sin(performance.now() / 260)) * 0.45;
    const baseRadius = Math.max(1.3, cell * 0.34);
    const pulseRadius = Math.max(baseRadius + 1.2, baseRadius * pulseRatio);

    this.ctx.fillStyle = "rgba(244, 247, 251, 0.25)";
    this.ctx.beginPath();
    this.ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = "#f4f7fb";
    this.ctx.beginPath();
    this.ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private revealAround(player: MinimapPoint, width: number, height: number, revealAll: boolean): void {
    if (this.layout === null) {
      return;
    }
    if (revealAll) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (this.layout.walkable[y]?.[x]) {
            this.explored.add(this.toKey(x, y, width));
          }
        }
      }
      return;
    }

    const minX = Math.max(0, Math.floor(player.x - FOG_RADIUS));
    const maxX = Math.min(width - 1, Math.ceil(player.x + FOG_RADIUS));
    const minY = Math.max(0, Math.floor(player.y - FOG_RADIUS));
    const maxY = Math.min(height - 1, Math.ceil(player.y + FOG_RADIUS));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (!this.layout.walkable[y]?.[x]) {
          continue;
        }
        if (this.distance(player, { x, y }) <= FOG_RADIUS) {
          this.explored.add(this.toKey(x, y, width));
        }
      }
    }
  }

  private clear(): void {
    if (this.ctx !== null && this.canvas !== null) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private toKey(x: number, y: number, width: number): number {
    return y * width + x;
  }

  private distance(a: MinimapPoint, b: MinimapPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
