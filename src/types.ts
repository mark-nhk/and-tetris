export type Cell = string | null;
export type Board = Cell[][];
export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Piece {
  type: TetrominoType;
  pos: Vec2;
  matrix: number[][];
}
