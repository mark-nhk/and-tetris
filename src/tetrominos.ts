import type { TetrominoType } from './types';

export const COLS = 10;
export const ROWS = 20;

/** Neon palette — one vivid color per piece type */
export const COLORS: Record<TetrominoType, string> = {
  I: '#00f5ff',
  O: '#ffe600',
  T: '#cc44ff',
  S: '#00ff88',
  Z: '#ff1155',
  J: '#3377ff',
  L: '#ff8800',
};

/** Each shape stored as a bounding-box matrix (1 = filled) */
export const SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const ALL_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** 7-bag randomizer — fair shuffle of all piece types */
export class PieceBag {
  private bag: TetrominoType[] = [];

  next(): TetrominoType {
    if (this.bag.length === 0) this.refill();
    return this.bag.pop()!;
  }

  private refill(): void {
    this.bag = [...ALL_TYPES];
    // Fisher-Yates shuffle
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }
}

/** 90° clockwise rotation */
export function rotateCW(matrix: number[][]): number[][] {
  const n = matrix.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      out[x][n - 1 - y] = matrix[y][x];
    }
  }
  return out;
}
