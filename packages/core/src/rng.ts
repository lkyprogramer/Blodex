import seedrandom from "seedrandom";
import type { RngLike } from "./contracts/types";

export class SeededRng implements RngLike {
  private readonly prng: seedrandom.PRNG;
  private cursor = 0;

  constructor(seed: string, cursor = 0) {
    this.prng = seedrandom(seed);
    if (cursor > 0) {
      this.skip(cursor);
    }
  }

  next(): number {
    this.cursor += 1;
    return this.prng.quick();
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from empty array.");
    }
    const index = this.nextInt(0, items.length - 1);
    const item = items[index];
    if (item === undefined) {
      throw new Error("Random pick index out of bounds.");
    }
    return item;
  }

  getCursor(): number {
    return this.cursor;
  }

  skip(drawCount: number): void {
    const steps = Math.max(0, Math.floor(drawCount));
    for (let i = 0; i < steps; i += 1) {
      this.next();
    }
  }
}
