import type { Board, Cell, Piece, TetrominoType } from './types';
import { COLS, ROWS, COLORS, SHAPES, PieceBag, rotateCW } from './tetrominos';

// ─── Scoring ─────────────────────────────────────────────────────────────────

const LINE_SCORES = [0, 100, 300, 500, 800];

function dropInterval(level: number): number {
  // ~1 second at level 1, ~100 ms at level 10+
  return Math.max(100, 1000 - (level - 1) * 90);
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface GameState {
  board: Board;
  current: Piece;
  next: Piece;
  held: Piece | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  paused: boolean;
  dropInterval: number;
  /** Accumulated time (ms) since last gravity tick */
  dropAccum: number;
  /** Flash effect for cleared lines */
  clearFlash: number;
  bag: PieceBag;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(null));
}

function makePiece(type: TetrominoType): Piece {
  const matrix = SHAPES[type].map(row => [...row]);
  const startX = Math.floor((COLS - matrix[0].length) / 2);
  return { type, pos: { x: startX, y: 0 }, matrix };
}

/** Returns true if placing `piece` at its position (+ optional offset) causes a collision */
function collides(board: Board, piece: Piece, dx = 0, dy = 0): boolean {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue;
      const nx = piece.pos.x + x + dx;
      const ny = piece.pos.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] !== null) return true;
    }
  }
  return false;
}

/** Drop piece straight down until it lands, return final Y */
export function calcGhostY(state: GameState): number {
  let dy = 0;
  while (!collides(state.board, state.current, 0, dy + 1)) dy++;
  return state.current.pos.y + dy;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGame(): GameState {
  const bag = new PieceBag();
  const current = makePiece(bag.next());
  const next = makePiece(bag.next());
  return {
    board: createBoard(),
    current,
    next,
    held: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    paused: false,
    dropInterval: dropInterval(1),
    dropAccum: 0,
    clearFlash: 0,
    bag,
  };
}

// ─── Lock & spawn ─────────────────────────────────────────────────────────────

function lockAndSpawn(state: GameState): void {
  const { board, current } = state;
  const color = COLORS[current.type];

  // Paint cells
  for (let y = 0; y < current.matrix.length; y++) {
    for (let x = 0; x < current.matrix[y].length; x++) {
      if (!current.matrix[y][x]) continue;
      const ny = current.pos.y + y;
      if (ny < 0) { state.gameOver = true; return; }
      board[ny][current.pos.x + x] = color;
    }
  }

  // Detect & clear completed rows
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if ((board[y] as Cell[]).every(c => c !== null)) {
      board.splice(y, 1);
      board.unshift(new Array<Cell>(COLS).fill(null));
      cleared++;
      y++; // re-examine shifted row
    }
  }

  if (cleared > 0) {
    state.lines += cleared;
    state.score += LINE_SCORES[cleared] * state.level;
    state.level = Math.floor(state.lines / 10) + 1;
    state.dropInterval = dropInterval(state.level);
    state.clearFlash = 200; // ms
  }

  state.current = state.next;
  state.next = makePiece(state.bag.next());
  state.canHold = true;

  if (collides(state.board, state.current)) {
    state.gameOver = true;
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function moveLeft(state: GameState): boolean {
  if (state.paused || state.gameOver) return false;
  if (collides(state.board, state.current, -1, 0)) return false;
  state.current.pos.x--;
  return true;
}

export function moveRight(state: GameState): boolean {
  if (state.paused || state.gameOver) return false;
  if (collides(state.board, state.current, 1, 0)) return false;
  state.current.pos.x++;
  return true;
}

/** Soft drop — moves down one row; returns false if piece locked */
export function softDrop(state: GameState): boolean {
  if (state.paused || state.gameOver) return false;
  if (!collides(state.board, state.current, 0, 1)) {
    state.current.pos.y++;
    state.score += 1; // soft drop bonus
    state.dropAccum = 0;
    return true;
  }
  lockAndSpawn(state);
  return false;
}

/** Hard drop — slam piece to bottom immediately */
export function hardDrop(state: GameState): void {
  if (state.paused || state.gameOver) return;
  const dy = calcGhostY(state) - state.current.pos.y;
  state.current.pos.y += dy;
  state.score += dy * 2; // hard drop bonus
  lockAndSpawn(state);
}

/** Rotate CW with basic wall-kick offsets */
export function rotate(state: GameState): void {
  if (state.paused || state.gameOver) return;
  const original = state.current.matrix;
  state.current.matrix = rotateCW(original);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    state.current.pos.x += kick;
    if (!collides(state.board, state.current)) return;
    state.current.pos.x -= kick;
  }
  // No valid position found — revert
  state.current.matrix = original;
}

/** Hold current piece — swap with held, or store if empty */
export function holdPiece(state: GameState): void {
  if (state.paused || state.gameOver || !state.canHold) return;
  const prev = state.held;
  state.held = { ...state.current, pos: { x: 0, y: 0 } };
  if (prev) {
    state.current = makePiece(prev.type);
  } else {
    state.current = state.next;
    state.next = makePiece(state.bag.next());
  }
  state.canHold = false;
}

/** Called every frame with delta time in ms */
export function tick(state: GameState, dt: number): void {
  if (state.paused || state.gameOver) return;
  if (state.clearFlash > 0) state.clearFlash -= dt;
  state.dropAccum += dt;
  if (state.dropAccum >= state.dropInterval) {
    state.dropAccum -= state.dropInterval;
    softDrop(state);
  }
}

export function togglePause(state: GameState): void {
  if (!state.gameOver) state.paused = !state.paused;
}
